/**
 * Phần dùng chung của công cụ Trợ lý: kiểu, lỗi có kiểm soát, ngày theo giờ Việt Nam, cắt chữ và giới hạn kích thước kết quả.
 * Không chứa truy vấn: mọi công cụ đọc dữ liệu qua service đã kiểm quyền.
 */
import { z } from "zod";
import type { AssistantActionDTO, AssistantSourceRef, AssistantStep, AssistantTaskProposal } from "@qcet/contracts/assistant";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import { ApiError } from "@/server/api/errors";

/** Trần ký tự của `content` gửi lại cho model trong một lần gọi tool. */
export const ASSISTANT_TOOL_RESULT_MAX_CHARS = 6000;
/** Tham số tool dài hơn mức này bị từ chối trước khi parse. */
export const ASSISTANT_TOOL_ARGS_MAX_CHARS = 4000;

/** Một câu duy nhất cho "không tìm thấy" và "không có quyền": không lộ việc bản ghi có tồn tại hay không. */
export const NOT_FOUND_MESSAGE = "Không tìm thấy hoặc Thầy/Cô không có quyền xem.";
export const RESTRICTED_MESSAGE =
  "Văn bản này là văn bản mật hoặc hạn chế nên không gửi cho Trợ lý. Thầy/Cô mở trực tiếp để xem.";
export const GENERIC_READ_ERROR = "Lỗi đọc dữ liệu, thử lại sau.";
export const OVERSIZE_MESSAGE = "Kết quả quá dài để gửi đủ, Thầy/Cô mở trực tiếp để xem.";

export interface AssistantToolContext {
  /** Ngữ cảnh phân quyền của người hỏi, nạp ở server; tool không nhận danh tính từ model. */
  authz: AuthorizationContext;
  userId: string;
  /** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
  today: string;
  /** Cuộc trò chuyện của lượt (có sau khi lưu câu hỏi); công cụ soạn thẻ hành động cần để lưu thẻ kèm cuộc. */
  conversationId?: string;
}

export interface AssistantToolOutcome {
  ok: boolean;
  /** JSON gửi cho model, tối đa ASSISTANT_TOOL_RESULT_MAX_CHARS ký tự. */
  content: string;
  step: AssistantStep;
  sources: AssistantSourceRef[];
  /** true chỉ với get_task / get_document thành công. */
  detailed: boolean;
  /** Chỉ propose_task: đề xuất đã làm sạch để giao diện hiện thẻ. */
  proposal?: AssistantTaskProposal;
  /** Chỉ công cụ soạn thẻ hành động (ADR-012): thẻ chờ duyệt đã lưu. */
  action?: AssistantActionDTO;
}

/** Kết quả thành công của một tool trước khi đóng gói thành outcome. */
export interface ToolRun {
  payload: Record<string, unknown>;
  /** Tên các mảng trong payload có thể bị cắt khi quá dài (cắt phần tử cuối). */
  lists: readonly string[];
  count: number | null;
  sources: AssistantSourceRef[];
  detailed: boolean;
  /** Nhãn bước riêng sau khi đọc xong (ví dụ có mã nhiệm vụ). */
  label?: string;
  proposal?: AssistantTaskProposal;
  action?: AssistantActionDTO;
}

/** Lỗi nghiệp vụ có câu trả lời để gửi cho model; không ghi log. */
export class ToolFailure extends Error {
  readonly userMessage: string;

  constructor(userMessage: string) {
    super(userMessage);
    this.name = "ToolFailure";
    this.userMessage = userMessage;
  }
}

/** Không tìm thấy hoặc không có quyền; sẽ được đổi thành NOT_FOUND_MESSAGE. */
export class ToolAccessDenied extends Error {
  constructor() {
    super("ToolAccessDenied");
    this.name = "ToolAccessDenied";
  }
}

const ICT_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const ICT_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "YYYY-MM-DD" là ngày có thật (2026-02-30 thì không). */
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Tham số ngày của tool: YYYY-MM-DD và là ngày có thật. */
export const CalendarDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "phải theo dạng YYYY-MM-DD" })
  .refine(isCalendarDate, { message: "phải là ngày có thật" });

/** Ngày theo giờ Việt Nam, dạng YYYY-MM-DD; null khi không có hoặc không hợp lệ. */
export function ictDate(value: Date | string | null | undefined): string | null {
  const date = toValidDate(value);
  return date ? ICT_DATE_FORMAT.format(date) : null;
}

/** Ngày giờ theo giờ Việt Nam, dạng "YYYY-MM-DD HH:mm". */
export function ictDateTime(value: Date | string | null | undefined): string | null {
  const date = toValidDate(value);
  return date ? `${ICT_DATE_FORMAT.format(date)} ${ICT_TIME_FORMAT.format(date)}` : null;
}

/** "2026-10-17" → "17/10/2026" để hiển thị trong câu trả lời. */
export function formatDmy(isoDate: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

// Phần trước "@" giới hạn 64 ký tự (RFC 5321): không quay lui bậc hai trên chuỗi liền dài
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Di động 10 số và cố định 11 số (0 + 9–10 chữ số, cho phép dấu cách/chấm/gạch); bỏ qua ngày dạng 01.02.2026 08:00
const PHONE_PATTERN = /(?:\+84|\b(?!\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b)0)(?:[ .-]?\d){8,10}\b/g;

/** Che email và số điện thoại trong chữ tự do (tiêu đề, mô tả, trích yếu, số văn bản, địa điểm…) trước khi đưa cho model hoặc lưu nguồn. Không cắt chữ. */
export function redactContact(text: string): string {
  return text.replace(EMAIL_PATTERN, "[email]").replace(PHONE_PATTERN, "[số điện thoại]");
}

/** Cắt chữ theo số ký tự sau khi che email và số điện thoại, thêm "…" khi bị cắt; null thành chuỗi rỗng. */
export function clip(text: string | null | undefined, max: number): string {
  const value = redactContact((text ?? "").trim());
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/** Nhãn bước: trích từ khóa người hỏi, tối đa 40 ký tự. */
export function quotedLabel(text: string): string {
  return `“${clip(text, 40)}”`;
}

/** Lỗi do kiểm quyền hay không tìm thấy: dùng chung một câu trả lời. */
export function isAccessDenial(error: unknown): boolean {
  if (error instanceof ToolAccessDenied) return true;
  return error instanceof ApiError && (error.statusCode === 403 || error.statusCode === 404);
}

/** Đổi lỗi thành câu gửi cho model. Lỗi lạ chỉ ghi tên lớp lỗi và tên tool, không ghi dữ liệu. */
export function toolErrorMessage(error: unknown, toolName: string): string {
  if (error instanceof ToolFailure) return error.userMessage;
  if (isAccessDenial(error)) return NOT_FOUND_MESSAGE;
  const errorName = error instanceof Error ? error.name : typeof error;
  console.error(`[assistant-tool] ${toolName} lỗi không mong đợi: ${errorName}`);
  return GENERIC_READ_ERROR;
}

/** Tham số JSON từ model: rỗng là đối tượng rỗng; quá dài hoặc hỏng thì từ chối. */
export function parseRawArgs(rawArgs: unknown): unknown {
  if (typeof rawArgs !== "string") return {};
  const text = rawArgs.trim();
  if (text.length > ASSISTANT_TOOL_ARGS_MAX_CHARS) {
    throw new ToolFailure("Tham số không hợp lệ: nội dung quá dài.");
  }
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ToolFailure("Tham số không hợp lệ: không phải JSON.");
  }
}

/** Câu lỗi tiếng Việt từ lỗi zod: tham số lạ, sai kiểu hoặc sai giá trị. */
export function formatArgIssues(error: z.ZodError): ToolFailure {
  const parts = error.issues.slice(0, 3).map((issue) => {
    if (issue.code === "unrecognized_keys") {
      return `không được có tham số ${issue.keys.map((key) => `"${key}"`).join(", ")}`;
    }
    if (issue.code === "custom") return issue.message;
    const path = issue.path.map(String).join(".");
    return path ? `"${path}" không hợp lệ` : "không hợp lệ";
  });
  return new ToolFailure(`Tham số không hợp lệ: ${parts.join("; ")}.`);
}

/** JSON của lỗi gửi cho model. */
export function errorContent(message: string): string {
  return JSON.stringify({ error: message });
}

/**
 * Đóng gói payload thành JSON không vượt trần. Khi quá dài, bỏ phần tử cuối của mảng dài nhất trong `lists`
 * rồi đặt `truncated: true`; không bao giờ cắt giữa chuỗi JSON. `fits: false` khi cắt hết mảng vẫn quá trần.
 */
export function fitToolContent(
  payload: Record<string, unknown>,
  lists: readonly string[]
): { content: string; truncated: boolean; fits: boolean } {
  let body = payload;
  let json = JSON.stringify(body);
  let truncated = false;
  while (json.length > ASSISTANT_TOOL_RESULT_MAX_CHARS) {
    let key: string | null = null;
    let longest = 0;
    for (const name of lists) {
      const value = body[name];
      if (Array.isArray(value) && value.length > longest) {
        key = name;
        longest = value.length;
      }
    }
    if (key === null) break;
    body = { ...body, [key]: (body[key] as unknown[]).slice(0, -1), truncated: true };
    truncated = true;
    json = JSON.stringify(body);
  }
  if (json.length > ASSISTANT_TOOL_RESULT_MAX_CHARS) {
    return { content: errorContent(OVERSIZE_MESSAGE), truncated: true, fits: false };
  }
  return { content: json, truncated, fits: true };
}
