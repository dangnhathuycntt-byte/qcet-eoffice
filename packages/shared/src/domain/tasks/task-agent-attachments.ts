/**
 * Tệp/ảnh đính kèm cho Agent soạn nhiệm vụ: loại được nhận, giới hạn và nhãn bước. Thuần, dùng được cả ở trình duyệt.
 * Server vẫn kiểm lại nội dung tệp (magic bytes) bằng `detectUploadMimeType`, không tin đuôi tệp hay MIME trình duyệt gửi.
 * Server không lưu tệp; trình duyệt gửi lại toàn bộ tệp của cuộc trò chuyện mỗi lượt.
 */

export type TaskAgentAttachmentKind = "image" | "pdf" | "docx" | "xlsx" | "text";

const KIND_BY_EXTENSION: Record<string, TaskAgentAttachmentKind> = {
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".webp": "image",
  ".pdf": "pdf",
  ".docx": "docx",
  ".xlsx": "xlsx",
  ".txt": "text",
  ".csv": "text",
};

const MB = 1024 * 1024;

/** Cả cuộc trò chuyện: tối đa 5 tệp, 10MB (middleware cắt body ở 12MB). */
export const TASK_AGENT_ATTACHMENT_MAX_FILES = 5;
export const TASK_AGENT_ATTACHMENT_MAX_TOTAL_BYTES = 10 * MB;
export const TASK_AGENT_ATTACHMENT_MAX_BYTES: Record<TaskAgentAttachmentKind, number> = {
  image: 5 * MB,
  pdf: 10 * MB,
  docx: 5 * MB,
  xlsx: 5 * MB,
  text: 1 * MB,
};
/** Chữ trích từ một tệp DOCX/XLSX/TXT/CSV, quá thì cắt và ghi "[đã cắt]". */
export const TASK_AGENT_ATTACHMENT_TEXT_MAX = 20_000;

export const TASK_AGENT_ATTACHMENT_ACCEPT = Object.keys(KIND_BY_EXTENSION).join(",");

export function getTaskAgentAttachmentKind(fileName: string): TaskAgentAttachmentKind | null {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return null;
  return KIND_BY_EXTENSION[fileName.slice(dot).toLowerCase()] ?? null;
}

const formatMb = (bytes: number) => `${Math.round(bytes / MB)}MB`;

export interface AttachmentWording {
  /** Ai nhận tệp, trong câu báo loại tệp. */
  subject: string;
  /** Phạm vi đếm số tệp, trong câu báo quá số lượng. */
  scope: string;
}

/** Trợ lý: tệp đi theo từng lượt hỏi. */
export const ASSISTANT_ATTACHMENT_WORDING: AttachmentWording = { subject: "Trợ lý", scope: "Mỗi lượt hỏi" };

/**
 * Kiểm danh sách tệp (đã có + định thêm). Trả câu báo lỗi tiếng Việt, hoặc null khi hợp lệ. Agent tạo nhiệm vụ tính cả
 * cuộc trò chuyện (gửi lại tệp mỗi lượt); Trợ lý tính từng lượt hỏi (tệp chỉ đi theo lượt gửi kèm).
 */
export function checkTaskAgentAttachments(
  files: ReadonlyArray<{ name: string; size: number }>,
  wording: AttachmentWording = { subject: "Agent", scope: "Mỗi cuộc trò chuyện" },
): string | null {
  if (files.length > TASK_AGENT_ATTACHMENT_MAX_FILES) {
    return `${wording.scope} đính kèm tối đa ${TASK_AGENT_ATTACHMENT_MAX_FILES} tệp.`;
  }
  let total = 0;
  for (const file of files) {
    const kind = getTaskAgentAttachmentKind(file.name);
    if (!kind) return `Chưa đọc được loại tệp của "${file.name}". ${wording.subject} nhận ảnh PNG/JPG/WebP, PDF, Word, Excel, TXT, CSV.`;
    if (file.size === 0) return `Tệp "${file.name}" rỗng.`;
    if (file.size > TASK_AGENT_ATTACHMENT_MAX_BYTES[kind]) {
      return `Tệp "${file.name}" lớn hơn ${formatMb(TASK_AGENT_ATTACHMENT_MAX_BYTES[kind])}.`;
    }
    total += file.size;
  }
  if (total > TASK_AGENT_ATTACHMENT_MAX_TOTAL_BYTES) {
    return `Tổng dung lượng tệp đính kèm vượt ${formatMb(TASK_AGENT_ATTACHMENT_MAX_TOTAL_BYTES)}.`;
  }
  return null;
}

export function describeTaskAgentAttachmentStep(kind: TaskAgentAttachmentKind, fileName: string): string {
  return `${kind === "image" ? "Xem ảnh" : "Đọc tệp"} ${fileName}`;
}

/** Bọc chữ trích từ tệp để mô hình phân biệt tài liệu với yêu cầu của người dùng. */
export function wrapTaskAgentAttachmentText(fileName: string, text: string): string {
  const clean = text.trim();
  const body =
    clean.length > TASK_AGENT_ATTACHMENT_TEXT_MAX ? `${clean.slice(0, TASK_AGENT_ATTACHMENT_TEXT_MAX)}\n[đã cắt]` : clean || "(tệp không có chữ)";
  return `[Tệp đính kèm: ${fileName}]\n${body}\n[Hết tệp]`;
}
