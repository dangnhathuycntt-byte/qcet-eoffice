/**
 * Nguồn của Trợ lý: đường dẫn tới bản ghi, khử trùng, chọn nguồn lưu kèm câu trả lời và tách mã nguồn trong chữ thành link.
 * Thuần, không import React, Next hay module giao diện (giữ đúng lớp domain).
 */
import type { AssistantSourceRef, AssistantSourceType } from "@/contracts/assistant";

/** Mã ngắn hơn này không tách thành link, tránh khớp nhầm số lẻ. */
const CODE_MIN_LENGTH = 3;
/** Số nguồn tối đa lưu kèm một câu trả lời. */
const CITED_MAX = 12;
/** Chữ, số và dấu tổ hợp (chữ Việt dạng NFD, ví dụ từ tên tệp trên macOS) đều thuộc một từ. */
const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;
/** Đoạn URL trong chữ: giữ nguyên như chữ thường, không tách mã nguồn bên trong. */
const URL_SPAN = /\b(?:https?:\/\/|www\.)\S+/gi;

/** Đường dẫn tới bản ghi nguồn. */
export function assistantSourceHref(type: AssistantSourceType, id: string): string {
  if (type === "task") return `/tasks/${id}`;
  // Giữ khớp getDocumentHref (lib/documents/document-view-model.ts) nhưng không import để domain không kéo lớp giao diện vào
  if (type === "document") return `/documents?docId=${encodeURIComponent(id)}`;
  return `/calendar/meetings/${id}`;
}

/** Khử trùng theo loại + mã bản ghi, giữ phần tử đầu tiên. */
export function dedupeSources(list: AssistantSourceRef[]): AssistantSourceRef[] {
  const seen = new Set<string>();
  return list.filter((source) => {
    const key = `${source.type}:${source.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Mã của nguồn nếu đủ dài để tách thành link, không thì null. */
function citableCode(source: AssistantSourceRef): string | null {
  const code = source.code?.trim();
  return code && code.length >= CODE_MIN_LENGTH ? code : null;
}

/** Dấu nối giữa mã và phần kế bên (NV-2026-09-001-A, 12/QĐ-ABC/2026): nối tiếp chữ/số thì là mã khác, không phải mã đứng riêng. */
const JOINER = /[-/.]/;

/** Mã khớp đúng tại `index`: hai đầu không dính chữ/số, và không nối qua dấu nối với chữ/số. */
function matchesAt(text: string, index: number, code: string): boolean {
  if (!text.startsWith(code, index)) return false;
  const end = index + code.length;
  const before = index > 0 ? text[index - 1] : "";
  const after = text[end] ?? "";
  if (WORD_CHAR.test(before) || WORD_CHAR.test(after)) return false;
  if (JOINER.test(after) && WORD_CHAR.test(text[end + 1] ?? "")) return false;
  if (JOINER.test(before) && WORD_CHAR.test(text[index - 2] ?? "")) return false;
  return true;
}

/**
 * Nguồn lưu kèm câu trả lời: nguồn có mã được nhắc trong chữ trước (theo thứ tự xuất hiện, URL không tính),
 * rồi tới nguồn đọc chi tiết chưa được nhắc; khử trùng, cắt còn `max`.
 */
export function selectCitedSources(
  answer: string,
  read: AssistantSourceRef[],
  detailed: AssistantSourceRef[],
  max = CITED_MAX,
): AssistantSourceRef[] {
  const candidates = dedupeSources([...detailed, ...read]);
  // Cùng quy tắc với linkSourceCodes: phần có href chính là mã đã được nhắc tới
  const mentionedHrefs: string[] = [];
  for (const part of linkSourceCodes(answer, candidates)) {
    if (part.href && !mentionedHrefs.includes(part.href)) mentionedHrefs.push(part.href);
  }
  const byHref = new Map(candidates.map((source) => [source.href, source]));
  const mentioned = mentionedHrefs.map((href) => byHref.get(href)).filter((s): s is AssistantSourceRef => s !== undefined);
  const unmentionedDetailed = dedupeSources(detailed).filter((source) => !mentionedHrefs.includes(source.href));
  return [...mentioned, ...unmentionedDetailed].slice(0, max);
}

export interface LinkedTextPart {
  text: string;
  href?: string;
  title?: string;
}

/** Tách một đoạn chữ không có URL: mã nguồn dài nhất khớp trước, phần còn lại là chữ thường. */
function linkProse(prose: string, codes: string[], byCode: Map<string, AssistantSourceRef>): LinkedTextPart[] {
  const out: LinkedTextPart[] = [];
  let plainStart = 0;
  let i = 0;
  while (i < prose.length) {
    const code = codes.find((c) => matchesAt(prose, i, c));
    const source = code ? byCode.get(code) : undefined;
    if (!code || !source) {
      i += 1;
      continue;
    }
    if (i > plainStart) out.push({ text: prose.slice(plainStart, i) });
    out.push({ text: code, href: source.href, title: source.title });
    i += code.length;
    plainStart = i;
  }
  if (plainStart < prose.length) out.push({ text: prose.slice(plainStart) });
  return out;
}

/**
 * Tách chữ thành phần thường và phần là mã của nguồn (khớp đúng, ưu tiên mã dài, hai đầu không dính chữ/số).
 * Không bao giờ tạo link ngoài danh sách nguồn; URL trong chữ giữ nguyên.
 */
export function linkSourceCodes(text: string, sources: AssistantSourceRef[]): LinkedTextPart[] {
  const byCode = new Map<string, AssistantSourceRef>();
  for (const source of sources) {
    const code = citableCode(source);
    if (code && !byCode.has(code)) byCode.set(code, source);
  }
  const codes = [...byCode.keys()].sort((a, b) => b.length - a.length);

  const parts: LinkedTextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_SPAN)) {
    const at = match.index ?? 0;
    parts.push(...linkProse(text.slice(last, at), codes, byCode));
    parts.push({ text: match[0] });
    last = at + match[0].length;
  }
  parts.push(...linkProse(text.slice(last), codes, byCode));
  return parts;
}
