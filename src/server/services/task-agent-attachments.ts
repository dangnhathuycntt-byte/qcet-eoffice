import JSZip from "jszip";
import { detectUploadMimeType } from "@/lib/storage";
import { ApiError } from "@/server/api/errors";
import type { TaskAgentContentPart } from "@/domain/tasks/task-agent-draft";
import {
  TASK_AGENT_ATTACHMENT_TEXT_MAX,
  describeTaskAgentAttachmentStep,
  getTaskAgentAttachmentKind,
  wrapTaskAgentAttachmentText,
  type TaskAgentAttachmentKind,
} from "@/domain/tasks/task-agent-attachments";

/** Một mục trong tệp nén giải ra quá cỡ này thì từ chối (chặn zip bomb). */
const MAX_ZIP_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_XLSX_ROWS = 2000;

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity: string) => {
    if (entity[0] !== "#") return XML_ENTITIES[entity.toLowerCase()] ?? match;
    const code = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  });
}

const readAttr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

async function readZipEntry(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path);
  if (!entry) return null;
  // JSZip chỉ lộ kích thước giải nén qua `_data`; không biết cỡ thì coi như không an toàn
  const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
  if (typeof size !== "number" || size > MAX_ZIP_ENTRY_BYTES) throw new Error("ZIP_ENTRY_TOO_LARGE");
  return entry.async("string");
}

export async function extractDocxText(bytes: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await readZipEntry(zip, "word/document.xml");
  if (xml === null) throw new Error("DOCX_WITHOUT_DOCUMENT");
  const text = xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeXml(text).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function readXlsxCell(attrs: string, inner: string, sharedStrings: string[]): string {
  const type = readAttr(attrs, "t");
  if (type === "inlineStr") return decodeXml([...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));
  const value = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (value === undefined) return "";
  if (type === "s") return sharedStrings[Number(value)] ?? "";
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  return decodeXml(value);
}

/** Mỗi trang tính thành "## Tên trang" rồi từng hàng nối ô bằng " | ". Ngày giữ số sê-ri của Excel. */
export async function extractXlsxText(bytes: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const shared = await readZipEntry(zip, "xl/sharedStrings.xml");
  const sharedStrings = shared
    ? [...shared.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((si) =>
        decodeXml([...si[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
      )
    : [];
  const workbook = (await readZipEntry(zip, "xl/workbook.xml")) ?? "";
  const rels = (await readZipEntry(zip, "xl/_rels/workbook.xml.rels")) ?? "";
  const targets = new Map(
    [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [readAttr(m[0], "Id"), readAttr(m[0], "Target")] as const),
  );
  const sheets = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((m) => {
    const target = targets.get(readAttr(m[0], "r:id")) ?? "";
    return { name: decodeXml(readAttr(m[0], "name") ?? ""), path: target.startsWith("/") ? target.slice(1) : `xl/${target}` };
  });

  const out: string[] = [];
  let rows = 0;
  let length = 0;
  for (const sheet of sheets) {
    const xml = await readZipEntry(zip, sheet.path);
    if (!xml) continue;
    out.push(`## ${sheet.name}`);
    for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [...row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map((c) => readXlsxCell(c[1], c[2] ?? "", sharedStrings).trim());
      if (!cells.some(Boolean)) continue;
      const line = cells.join(" | ");
      out.push(line);
      rows += 1;
      length += line.length;
      if (rows >= MAX_XLSX_ROWS || length > TASK_AGENT_ATTACHMENT_TEXT_MAX) {
        out.push("[đã cắt]");
        return out.join("\n");
      }
    }
  }
  return out.join("\n");
}

export interface PreparedTaskAgentAttachment {
  kind: TaskAgentAttachmentKind;
  step: string;
  parts: TaskAgentContentPart[];
}

/**
 * Kiểm nội dung tệp (magic bytes, không tin đuôi hay MIME trình duyệt) rồi đổi sang phần nội dung gateway:
 * ảnh và PDF gửi nguyên (gateway đọc được), DOCX/XLSX/TXT/CSV trích chữ ở server (gateway không đọc DOCX/XLSX).
 */
export async function prepareTaskAgentAttachment(fileName: string, bytes: Buffer): Promise<PreparedTaskAgentAttachment> {
  const kind = getTaskAgentAttachmentKind(fileName);
  let mimeType: string;
  try {
    if (!kind) throw new Error("UNSUPPORTED");
    mimeType = detectUploadMimeType(fileName, bytes).split(";")[0];
  } catch {
    throw new ApiError(400, "ATTACHMENT_INVALID", `Tệp "${fileName}" không đúng định dạng hoặc không được phép.`);
  }
  const dataUri = () => `data:${mimeType};base64,${bytes.toString("base64")}`;
  const textPart = (text: string): TaskAgentContentPart[] => [{ type: "text", text: wrapTaskAgentAttachmentText(fileName, text) }];

  let parts: TaskAgentContentPart[];
  if (kind === "image") parts = [{ type: "image_url", image_url: { url: dataUri() } }];
  else if (kind === "pdf") parts = [{ type: "file", file: { filename: fileName, file_data: dataUri() } }];
  else if (kind === "text") parts = textPart(bytes.toString("utf8"));
  else {
    try {
      parts = textPart(kind === "docx" ? await extractDocxText(bytes) : await extractXlsxText(bytes));
    } catch {
      throw new ApiError(400, "ATTACHMENT_UNREADABLE", `Chưa đọc được nội dung tệp "${fileName}".`);
    }
  }
  return { kind, step: describeTaskAgentAttachmentStep(kind, fileName), parts };
}
