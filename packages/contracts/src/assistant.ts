/**
 * Hợp đồng dữ liệu của Trợ lý (chỉ đọc): request, DTO lịch sử chat và sự kiện NDJSON server → trình duyệt.
 * Dùng chung cho route, service và giao diện; không chứa logic truy vấn.
 */
import { z } from "zod";
import type { TaskAgentPriority } from "@qcet/shared/domain/tasks/task-agent-draft";
import { TASK_AGENT_ATTACHMENT_MAX_FILES, type TaskAgentAttachmentKind } from "@qcet/shared/domain/tasks/task-agent-attachments";

/** Thời hạn lưu cuộc trò chuyện (ngày). Quá hạn: ẩn khỏi danh sách, không gửi lại cho mô hình, cron xóa hẳn. */
export const ASSISTANT_RETENTION_DAYS = 90;
export const ASSISTANT_MESSAGE_MAX = 4000;
export const ASSISTANT_TITLE_MAX = 120;
/**
 * Số đề xuất (thẻ) tối đa trong một lượt: đủ cho kế hoạch năm 12 tháng, mỗi tháng 4 đầu việc, mỗi đầu việc là một
 * nhiệm vụ (người dùng gửi kế hoạch năm 19/10/2026: "vài chục cái nhiệm vụ", đầu việc là việc lớn, không phải việc con).
 */
export const ASSISTANT_MAX_PROPOSALS_PER_TURN = 60;

export const ASSISTANT_CONTEXT_TYPES = ["task", "document"] as const;
export type AssistantContextType = (typeof ASSISTANT_CONTEXT_TYPES)[number];

export const ASSISTANT_TOOL_NAMES = [
  "search",
  "list_tasks",
  "get_task",
  "list_documents",
  "get_document",
  "my_inbox",
  "list_meetings",
  "propose_task",
] as const;
export type AssistantToolName = (typeof ASSISTANT_TOOL_NAMES)[number];

const entityId = z.string().trim().min(1).max(64);

export const AssistantContextRefSchema = z.object({ type: z.enum(ASSISTANT_CONTEXT_TYPES), id: entityId }).strict();
export type AssistantContextRef = z.infer<typeof AssistantContextRefSchema>;

export const AssistantChatRequestSchema = z
  .object({
    conversationId: entityId.optional(),
    message: z.string().trim().min(1, "Nhập câu hỏi").max(ASSISTANT_MESSAGE_MAX),
    // Chỉ nhận khi mở cuộc trò chuyện mới; server kiểm lại quyền đọc trước khi dùng
    context: AssistantContextRefSchema.optional(),
    // Model chọn ở ô soạn; server chỉ nhận model trong TASK_AGENT_MODELS hoặc model mặc định, không gửi thì dùng mặc định
    model: z.string().trim().min(1).max(64).optional(),
    // "Thử lại" câu hỏi có tệp đã lưu: gửi mã tệp thay vì gửi lại tệp; server chỉ nhận tệp của chính cuộc này
    attachmentIds: z.array(z.string().uuid()).max(TASK_AGENT_ATTACHMENT_MAX_FILES).optional(),
  })
  .strict();
export type AssistantChatRequest = z.infer<typeof AssistantChatRequestSchema>;

export const AssistantRenameRequestSchema = z
  .object({ title: z.string().trim().min(1, "Nhập tên cuộc trò chuyện").max(ASSISTANT_TITLE_MAX) })
  .strict();

/**
 * Cập nhật trạng thái thẻ đề xuất thứ `index` của một tin trả lời: bỏ qua/hoàn tác, hoặc đã tạo nhiệm vụ `taskId`
 * (máy chủ chỉ nhận nhiệm vụ do chính người gọi tạo và lấy mã nhiệm vụ từ CSDL).
 */
const proposalIndex = z.number().int().min(0).max(ASSISTANT_MAX_PROPOSALS_PER_TURN - 1);
export const AssistantProposalUpdateRequestSchema = z.union([
  z.object({ index: proposalIndex, dismissed: z.boolean() }).strict(),
  z.object({ index: proposalIndex, taskId: entityId }).strict(),
]);
export type AssistantProposalUpdateRequest = z.infer<typeof AssistantProposalUpdateRequestSchema>;

export const AssistantConversationListQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    contextType: z.enum(ASSISTANT_CONTEXT_TYPES).optional(),
    contextId: entityId.optional(),
    // Con trỏ mờ do server cấp (mốc thời gian và id đã mã hóa), không phải id cuộc trò chuyện
    cursor: z.string().trim().min(1).max(256).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(30),
  })
  .refine((v) => !v.contextId === !v.contextType, { message: "contextType và contextId phải đi cùng nhau" });
export type AssistantConversationListQuery = z.infer<typeof AssistantConversationListQuerySchema>;

export type AssistantSourceType = "task" | "document" | "meeting";

/** Bản ghi Trợ lý đã đọc qua tool trong lượt; là nguồn duy nhất được gắn link trong câu trả lời. */
export interface AssistantSourceRef {
  type: AssistantSourceType;
  id: string;
  /** Mã nhiệm vụ (NV-2026-09-001) hoặc số/ký hiệu văn bản; null khi không có. */
  code: string | null;
  title: string;
  href: string;
}

/**
 * Một bước Trợ lý đã làm, hiển thị dạng "Đã đọc 3 nhiệm vụ" (gọi tool) hoặc "Đọc tệp a.pdf" (tệp gửi kèm lượt hỏi, tên
 * tệp lưu cùng tin trả lời để xem lại; tệp không lưu). Không chứa dữ liệu trả về.
 */
export interface AssistantStep {
  tool: AssistantToolName | "attachment" | "unknown";
  label: string;
  count: number | null;
  ok: boolean;
}

/**
 * Đề xuất nhiệm vụ Trợ lý soạn qua `propose_task` (ADR-010): chưa tạo gì. Giao diện hiện thẻ, người dùng mở hộp tạo
 * nhiệm vụ đã điền sẵn rồi tự bấm Tạo. Người là tên người hỏi nêu (mô hình không có danh sách nhân sự), hộp khớp tên
 * với nhân sự của đơn vị, không khớp thì để trống. Lưu cùng tin trả lời (`AssistantMessageDTO.proposals`).
 */
export interface AssistantTaskProposal {
  title: string;
  description?: string;
  priority?: TaskAgentPriority;
  /** YYYY-MM-DD */
  startDate?: string;
  /** YYYY-MM-DD */
  dueDate?: string;
  leadAssigneeName?: string;
  subtasks?: AssistantTaskProposalSubtask[];
}

export interface AssistantTaskProposalSubtask {
  title: string;
  description?: string;
  assigneeName?: string;
  /** YYYY-MM-DD, không sau hạn nhiệm vụ. */
  dueDate?: string;
}

/** Nhiệm vụ đã tạo từ một thẻ đề xuất. */
export interface AssistantProposalTask {
  id: string;
  code: string | null;
}

/** Thẻ đề xuất lưu cùng tin trả lời, kèm trạng thái người dùng đã chọn để mở lại cuộc vẫn còn (như ChatGPT). */
export interface AssistantMessageProposalDTO {
  proposal: AssistantTaskProposal;
  /** Đã tạo nhiệm vụ từ thẻ này; null là chưa tạo. */
  task: AssistantProposalTask | null;
  dismissed: boolean;
}

/**
 * Tệp gửi kèm câu hỏi, đã lưu (từ 19/10/2026): mở lại cuộc vẫn thấy và lượt sau vẫn đọc được. `url` chỉ chủ cuộc tải
 * được; tệp xóa theo cuộc.
 */
export interface AssistantAttachmentDTO {
  id: string;
  name: string;
  size: number;
  kind: TaskAgentAttachmentKind;
  url: string;
}

export type AssistantMessageRole = "user" | "assistant";
export type AssistantMessageStatus = "complete" | "error" | "aborted";

export interface AssistantMessageDTO {
  id: string;
  role: AssistantMessageRole;
  content: string;
  status: AssistantMessageStatus;
  sources: AssistantSourceRef[];
  steps: AssistantStep[];
  /** Thẻ đề xuất nhiệm vụ của tin trả lời (ADR-010); rỗng với tin khác. */
  proposals: AssistantMessageProposalDTO[];
  /** Tệp gửi kèm câu hỏi (chỉ tin người dùng); không có tệp thì không có trường này. */
  attachments?: AssistantAttachmentDTO[];
  durationMs: number | null;
  createdAt: string;
}

export interface AssistantConversationSummaryDTO {
  id: string;
  title: string;
  titleEdited: boolean;
  contextType: AssistantContextType | null;
  contextId: string | null;
  createdAt: string;
  lastMessageAt: string;
}

export interface AssistantConversationDetailDTO extends AssistantConversationSummaryDTO {
  messages: AssistantMessageDTO[];
  /** Ngữ cảnh đã gắn, chỉ trả khi người xem vẫn còn quyền đọc mục đó. */
  context: AssistantSourceRef | null;
}

export interface AssistantConversationListDTO {
  items: AssistantConversationSummaryDTO[];
  nextCursor: string | null;
  retentionDays: number;
}

/** Sự kiện NDJSON của `POST /api/assistant/chat`, mỗi dòng một sự kiện. */
export type AssistantStreamEvent =
  | { type: "conversation"; conversation: AssistantConversationSummaryDTO; userMessageId: string }
  /** Tệp của câu hỏi `messageId` đã lưu xong (chạy song song với câu trả lời, phát trước `done`). */
  | { type: "attachments"; messageId: string; attachments: AssistantAttachmentDTO[] }
  /** Cuộc mới: tên do mô hình đặt thay cho tên lấy từ câu hỏi, phát trước `done`. */
  | { type: "title"; conversation: AssistantConversationSummaryDTO }
  | { type: "context"; source: AssistantSourceRef }
  | { type: "step"; step: AssistantStep }
  | { type: "thinking"; delta: string }
  | { type: "text"; delta: string }
  | { type: "sources"; sources: AssistantSourceRef[] }
  | { type: "proposal"; proposal: AssistantTaskProposal }
  | { type: "done"; messageId: string; status: AssistantMessageStatus; durationMs: number }
  | { type: "error"; error: { code: string; message: string }; messageId?: string };

export function parseAssistantStreamEvent(line: string): AssistantStreamEvent | null {
  try {
    const event = JSON.parse(line) as { type?: unknown };
    return event && typeof event.type === "string" ? (event as AssistantStreamEvent) : null;
  } catch {
    return null;
  }
}
