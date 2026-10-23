/**
 * Hợp đồng dữ liệu của Trợ lý: request, DTO lịch sử chat và sự kiện NDJSON server → trình duyệt; thiết lập riêng, ghi
 * nhớ, kỹ năng và hành động chờ duyệt (ADR-012).
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

export const ASSISTANT_CONTEXT_TYPES = ["task", "document", "meeting"] as const;
export type AssistantContextType = (typeof ASSISTANT_CONTEXT_TYPES)[number];

export const ASSISTANT_TOOL_NAMES = [
  "search",
  "list_tasks",
  "get_task",
  "list_documents",
  "get_document",
  "my_inbox",
  "list_meetings",
  "get_meeting",
  "get_meeting_recording",
  "propose_task",
  "propose_comment",
  "propose_status_change",
  "propose_reminder",
  "remember",
  "propose_minutes",
] as const;
export type AssistantToolName = (typeof ASSISTANT_TOOL_NAMES)[number];

/** Công cụ chỉ soạn thẻ hành động chờ duyệt (ADR-012); không thay đổi gì cho tới khi người dùng bấm Duyệt. */
export const ASSISTANT_ACTION_TOOL_NAMES = ["propose_comment", "propose_status_change", "propose_reminder", "remember", "propose_minutes"] as const;

/** Số thẻ hành động tối đa mỗi lượt: mỗi thẻ người dùng phải đọc và duyệt riêng. */
export const ASSISTANT_MAX_ACTIONS_PER_TURN = 5;
/** Thẻ chưa duyệt quá chừng này thì hết hạn: dữ liệu có thể đã đổi, phải soạn lại. */
export const ASSISTANT_ACTION_TTL_HOURS = 72;
export const ASSISTANT_INSTRUCTIONS_MAX = 2000;
export const ASSISTANT_MEMORY_MAX = 300;
/** Số ghi nhớ tối đa mỗi người; tất cả được đưa vào lời nhắc nên giữ ít và ngắn. */
export const ASSISTANT_MEMORIES_PER_USER = 30;
export const ASSISTANT_SKILL_NAME_MAX = 60;
export const ASSISTANT_SKILLS_PER_USER = 30;

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
    // "Tạo lại" hoặc "Sửa" câu hỏi cuối (như ChatGPT, Claude): mã câu hỏi cuối của cuộc; câu hỏi đó và câu trả lời của nó
    // được thay bằng lượt này (không hiện, không vào lịch sử mô hình). Chỉ đi cùng conversationId
    replacesMessageId: entityId.optional(),
    // Kỹ năng người dùng chọn bằng "/" (chữ của kỹ năng đã nằm trong message): server chỉ ghi lần dùng
    skillId: entityId.optional(),
  })
  .strict();
export type AssistantChatRequest = z.infer<typeof AssistantChatRequestSchema>;

export const AssistantRenameRequestSchema = z
  .object({ title: z.string().trim().min(1, "Nhập tên cuộc trò chuyện").max(ASSISTANT_TITLE_MAX) })
  .strict();

/**
 * Cập nhật trạng thái thẻ đề xuất thứ `index` của một tin trả lời: bỏ qua/hoàn tác, hoặc đã tạo nhiệm vụ `taskId`
 * (máy chủ chỉ nhận nhiệm vụ do chính người gọi tạo và lấy mã nhiệm vụ từ CSDL). `indexes`: bỏ qua/hoàn tác nhiều thẻ
 * của cùng tin trong một lần ("Bỏ qua", "Hoàn tác" của thẻ danh sách), tất cả hoặc không thẻ nào.
 */
const proposalIndex = z.number().int().min(0).max(ASSISTANT_MAX_PROPOSALS_PER_TURN - 1);
export const AssistantProposalUpdateRequestSchema = z.union([
  z.object({ index: proposalIndex, dismissed: z.boolean() }).strict(),
  z.object({ index: proposalIndex, taskId: entityId }).strict(),
  z.object({ indexes: z.array(proposalIndex).min(1).max(ASSISTANT_MAX_PROPOSALS_PER_TURN), dismissed: z.boolean() }).strict(),
]);
export type AssistantProposalUpdateRequest = z.infer<typeof AssistantProposalUpdateRequestSchema>;

/** Duyệt, bỏ qua hoặc hoàn tác một thẻ hành động; nội dung hành động lấy từ bản ghi ở máy chủ, không nhận từ client. */
export const AssistantActionDecisionSchema = z.object({ decision: z.enum(["approve", "reject", "undo"]) }).strict();
export type AssistantActionDecision = z.infer<typeof AssistantActionDecisionSchema>["decision"];

export const AssistantPreferencesUpdateSchema = z
  .object({
    instructions: z.string().max(ASSISTANT_INSTRUCTIONS_MAX).optional(),
    briefingEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.instructions !== undefined || value.briefingEnabled !== undefined, { message: "Không có gì để lưu" });
export type AssistantPreferencesUpdate = z.infer<typeof AssistantPreferencesUpdateSchema>;

export const AssistantMemoryInputSchema = z
  .object({ content: z.string().trim().min(1, "Nhập nội dung ghi nhớ").max(ASSISTANT_MEMORY_MAX) })
  .strict();

export const AssistantSkillInputSchema = z
  .object({
    name: z.string().trim().min(1, "Nhập tên kỹ năng").max(ASSISTANT_SKILL_NAME_MAX),
    prompt: z.string().trim().min(1, "Nhập nội dung kỹ năng").max(ASSISTANT_MESSAGE_MAX),
  })
  .strict();
export type AssistantSkillInput = z.infer<typeof AssistantSkillInputSchema>;

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

export type AssistantActionKind = "task_comment" | "task_status" | "task_remind" | "memory_save" | "meeting_minutes";
export type AssistantActionStatus = "pending" | "done" | "rejected" | "failed" | "undone" | "expired";
export type AssistantTaskStatusValue = "NOT_STARTED" | "IN_PROGRESS" | "WAITING_APPROVAL" | "COMPLETED" | "CANCELLED";

/** Nhiệm vụ mà thẻ hành động tác động (đã kiểm quyền lúc soạn). */
export interface AssistantActionTask {
  id: string;
  code: string | null;
  title: string;
}

/** Cuộc họp mà thẻ biên bản tác động (đã kiểm quyền soạn biên bản lúc soạn thẻ). */
export interface AssistantActionMeeting {
  id: string;
  title: string;
}

/** Biên bản Trợ lý soạn dài tối đa chừng này ký tự (tham số `minutes` của propose_minutes). */
export const ASSISTANT_MINUTES_MAX = 10000;
/** Số chỗ cần kiểm lại tối đa trên thẻ biên bản, mỗi chỗ tối đa 200 ký tự. */
export const ASSISTANT_MINUTES_CHECKS_MAX = 6;

/** Nội dung thẻ hành động, hiện đủ để người dùng biết chính xác điều sẽ xảy ra trước khi duyệt. */
export type AssistantActionView =
  | { kind: "task_comment"; task: AssistantActionTask; body: string }
  | { kind: "task_status"; task: AssistantActionTask; from: AssistantTaskStatusValue; to: AssistantTaskStatusValue }
  | { kind: "task_remind"; task: AssistantActionTask; message: string; recipients: string[] }
  | { kind: "memory_save"; content: string }
  /**
   * Lưu dự thảo biên bản (→ Dự thảo biên bản, hoặc thay dự thảo chưa duyệt; cuộc họp chưa họp thì máy chủ tự chuyển qua Đã
   * họp vì không còn bước "Bắt đầu họp" từ 21/10/2026). `from` và `baseUpdatedAt` là trạng thái
   * và lần sửa cuối của cuộc họp lúc soạn thẻ: đổi rồi (có người vừa lưu, sửa hay duyệt biên bản) thì không lưu chồng;
   * `replaces` khi cuộc họp đã có dự thảo (thẻ nói rõ sẽ thay).
   */
  | {
      kind: "meeting_minutes";
      meeting: AssistantActionMeeting;
      from: "DRAFT_AGENDA" | "INVITED" | "HELD" | "MINUTES_DRAFT";
      minutes: string;
      replaces: boolean;
      baseUpdatedAt: string;
      /** Bản ghi biên bản lấy từ (`propose_minutes` với `recordingId`); thẻ cũ không có. */
      recording?: { id: string; name: string };
      /** Chỗ nghe chưa chắc cần Thầy/Cô kiểm trước khi lưu (tên người, con số, mã); thẻ cũ không có. */
      checks?: string[];
    };

/** Thẻ hành động chờ duyệt (ADR-012): chưa thay đổi gì cho tới khi người dùng bấm Duyệt. */
export interface AssistantActionDTO {
  id: string;
  status: AssistantActionStatus;
  view: AssistantActionView;
  /** Đã thực hiện và còn hoàn tác được (bình luận, ghi nhớ; nhắc việc đã gửi và đổi trạng thái thì không). */
  undoable: boolean;
  /** Lý do thất bại, viết cho người dùng. */
  error: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface AssistantPreferencesDTO {
  instructions: string;
  briefingEnabled: boolean;
}

export interface AssistantMemoryDTO {
  id: string;
  content: string;
  source: "user" | "assistant";
  createdAt: string;
}

export interface AssistantSkillDTO {
  id: string;
  name: string;
  prompt: string;
  lastUsedAt: string | null;
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
  /** Thẻ hành động chờ duyệt của tin trả lời (ADR-012); không có thì không có trường này. */
  actions?: AssistantActionDTO[];
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

/**
 * Hoạt động của vài cuộc (chip ở thanh dưới của khung nổi): cuộc đang có lượt chạy ở máy chủ, mốc tin mới nhất để biết
 * có trả lời mới từ lần xem trước. Tối đa 10 mã mỗi lần.
 */
export const ASSISTANT_ACTIVITY_MAX_IDS = 10;
export const AssistantConversationActivityQuerySchema = z
  .object({ ids: z.array(entityId).min(1).max(ASSISTANT_ACTIVITY_MAX_IDS) })
  .strict();
export interface AssistantConversationActivityDTO {
  id: string;
  running: boolean;
  lastMessageAt: string;
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
  /** Các công cụ của vòng này bắt đầu chạy (mô hình đã gọi xong); `step` tới khi chúng xong. Giữa hai lúc đó mô hình mới là bên đang nghĩ. */
  | { type: "tool_start" }
  | { type: "step"; step: AssistantStep }
  | { type: "thinking"; delta: string }
  | { type: "text"; delta: string }
  | { type: "sources"; sources: AssistantSourceRef[] }
  | { type: "proposal"; proposal: AssistantTaskProposal }
  /** Mô hình bắt đầu viết một lời gọi propose_task (thẻ tới sau, khi cả vòng xong): để đếm "đang soạn" trực tiếp. */
  | { type: "proposal_started" }
  /** Thẻ hành động chờ duyệt vừa soạn (ADR-012); chưa thực hiện gì. */
  | { type: "action"; action: AssistantActionDTO }
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
