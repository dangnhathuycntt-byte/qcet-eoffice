/**
 * Công cụ soạn đề xuất nhiệm vụ của Trợ lý (ADR-010). Không ghi gì và không đọc dữ liệu: trả đề xuất đã làm sạch để
 * giao diện hiện thẻ; người dùng mở hộp tạo nhiệm vụ đã điền sẵn và tự bấm Tạo, quyền tạo vẫn do `POST /api/tasks` kiểm.
 * Mô hình không nhận danh sách nhân sự: người là tên người hỏi nêu, hộp tạo nhiệm vụ khớp tên ở trình duyệt.
 */
import { z } from "zod";
import { TASK_AGENT_PRIORITIES, TASK_AGENT_SUBTASKS_MAX, TASK_AGENT_TITLE_MAX } from "@qcet/shared/domain/tasks/task-agent-draft";
import { normalizeTaskProposal } from "@qcet/shared/domain/assistant/assistant-task-proposal";
import { CalendarDate, type ToolRun } from "./assistant-tool-shared";

const Title = z.string().trim().min(3).max(TASK_AGENT_TITLE_MAX);
const PersonName = z.string().trim().min(1).max(100);

export const ProposeTaskArgs = z
  .object({
    title: Title,
    description: z.string().trim().max(3000).optional(),
    priority: z.enum(TASK_AGENT_PRIORITIES).optional(),
    startDate: CalendarDate.optional(),
    dueDate: CalendarDate.optional(),
    leadAssigneeName: PersonName.optional(),
    subtasks: z
      .array(
        z
          .object({
            title: Title,
            description: z.string().trim().max(500).optional(),
            assigneeName: PersonName.optional(),
            dueDate: CalendarDate.optional(),
          })
          .strict(),
      )
      .max(TASK_AGENT_SUBTASKS_MAX)
      .optional(),
  })
  .strict();
export type ProposeTaskInput = z.infer<typeof ProposeTaskArgs>;

export const PROPOSE_TASK_DESCRIPTION =
  "Soạn đề xuất MỘT nhiệm vụ mới (có thể kèm việc con) khi Thầy/Cô muốn tạo nhiệm vụ hoặc giao việc mới. Công cụ không " +
  "tạo gì: giao diện hiện thẻ đề xuất, Thầy/Cô mở hộp tạo nhiệm vụ đã điền sẵn, xem lại và tự bấm Tạo. title ngắn, bắt " +
  "đầu bằng động từ, không ghi tên người hay hạn. priority: khẩn, gấp = URGENT; quan trọng = HIGH; bình thường = MEDIUM; " +
  "không gấp = LOW; không nói thì bỏ. dueDate, startDate, leadAssigneeName, assigneeName chỉ điền khi Thầy/Cô nêu rõ; tên " +
  "người ghi đúng như Thầy/Cô nói, không đoán, không tra cứu. Ngày dạng YYYY-MM-DD. " +
  "Chia luôn thành việc con (3–7 việc, mỗi việc một bước cụ thể để hoàn thành nhiệm vụ, ưu tiên đầu việc nêu trong văn " +
  "bản hay tệp; title việc con bắt đầu bằng động từ), trừ khi nhiệm vụ chỉ là một việc đơn lẻ hoặc Thầy/Cô bảo không chia. " +
  "Hạn và người nhận của việc con chỉ điền khi Thầy/Cô hay văn bản nêu cho đúng việc con đó, không tự chia mốc từ hạn " +
  "nhiệm vụ; có hạn thì không sau hạn nhiệm vụ.";

const PROPOSAL_NOTE =
  "Chưa tạo nhiệm vụ nào. Giao diện đã hiện thẻ đề xuất đủ nội dung. Bây giờ viết câu trả lời một hai câu: đã soạn đề " +
  "xuất, trường bắt buộc còn trống (hạn, người chủ trì) nếu có, và Thầy/Cô bấm \"Xem lại và tạo\" trên thẻ để tự tạo. " +
  "Không nhắc lại tên, mô tả, hạn, người hay việc con của đề xuất; không nói là đã tạo hay đã giao.";

export function proposeTask(args: ProposeTaskInput): ToolRun {
  const proposal = normalizeTaskProposal(args);
  return {
    payload: { created: false, note: PROPOSAL_NOTE, proposal },
    lists: [],
    count: null,
    sources: [],
    detailed: false,
    proposal,
  };
}
