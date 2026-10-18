import type { NextRequest } from "next/server";
import type { ZodType } from "zod";
import { PayloadTooLargeError, ValidationError } from "@/server/api/errors";
import { parseAndValidateJson } from "@/server/api/validation";

/** Body multipart (có tệp) tối đa 11MB, dưới mức middleware cắt (12MB). */
const MAX_MULTIPART_BYTES = 11 * 1024 * 1024;

const FILE_NAME_MAX = 120;

/**
 * Tên tệp đi vào prompt: bỏ ký tự điều khiển, ngoặc vuông (dùng làm dấu bọc tệp) và cắt ngắn. Cắt phần tên, giữ đuôi,
 * vì loại tệp đọc theo đuôi (tên dài mà mất đuôi thì tệp hợp lệ bị từ chối).
 */
export function cleanAttachmentFileName(name: string): string {
  const clean = name.replace(/[\u0000-\u001f\u007f[\]]/g, " ").trim() || "tệp";
  if (clean.length <= FILE_NAME_MAX) return clean;
  const dot = clean.lastIndexOf(".");
  const extension = dot > 0 && clean.length - dot <= 10 ? clean.slice(dot) : "";
  return `${clean.slice(0, FILE_NAME_MAX - extension.length - 1).trimEnd()}…${extension}`;
}

/**
 * Body của route Agent: JSON khi không có tệp; có tệp thì multipart/form-data, trường `payload` là JSON cùng schema và
 * các trường `files` là tệp (Agent tạo nhiệm vụ, Trợ lý). Lỗi trả đúng mã như `parseAndValidateJson` (400, 413).
 */
export async function readJsonOrMultipart<T>(
  req: NextRequest,
  schema: ZodType<T>,
  options: { jsonMaxBytes: number; invalidMessage: string },
): Promise<{ body: T; files: File[]; multipart: boolean }> {
  if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const body = await parseAndValidateJson(req, schema, { maxBytes: options.jsonMaxBytes });
    return { body, files: [], multipart: false };
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_MULTIPART_BYTES) {
    throw new PayloadTooLargeError("Tổng dung lượng tệp đính kèm vượt 10MB.");
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    // Middleware cắt body quá cỡ làm formData() ném lỗi (như /api/upload)
    throw new PayloadTooLargeError("Không đọc được tệp đính kèm. Tổng dung lượng có thể vượt 10MB.");
  }
  const raw = form.get("payload");
  let json: unknown;
  try {
    json = typeof raw === "string" && raw.length <= options.jsonMaxBytes ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message || options.invalidMessage);
  const files = form.getAll("files").filter((f): f is File => typeof f !== "string");
  return { body: parsed.data, files, multipart: true };
}
