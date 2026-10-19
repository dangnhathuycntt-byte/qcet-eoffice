/**
 * Công cụ soạn đề xuất nhiệm vụ của Trợ lý (ADR-010). Không ghi gì và không đọc dữ liệu: trả đề xuất đã làm sạch để
 * giao diện hiện thẻ; người dùng mở hộp tạo nhiệm vụ đã điền sẵn và tự bấm Tạo, quyền tạo vẫn do `POST /api/tasks` kiểm.
 * Mô hình không nhận danh sách nhân sự: người là tên người hỏi nêu, hộp tạo nhiệm vụ khớp tên ở trình duyệt.
 */
import { z } from "zod";
import { TASK_AGENT_PRIORITIES, TASK_AGENT_SUBTASKS_MAX, TASK_AGENT_TITLE_MAX } from "@qcet/shared/domain/tasks/task-agent-draft";
import { ASSISTANT_MAX_PROPOSALS_PER_TURN } from "@qcet/contracts/assistant";
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

/**
 * Số lời gọi propose_task nên có trong một lần trả lời: kế hoạch dài chia nhiều vòng cho mỗi vòng ngắn, xa trần thời
 * gian của vòng (chạy thật 19/10/2026: Opus 4.6 phát cả 48 lời gọi trong một vòng, 184 giây), thẻ cũng hiện dần.
 */
export const PROPOSALS_PER_REPLY = 16;

export const PROPOSE_TASK_DESCRIPTION =
  "Soạn đề xuất MỘT nhiệm vụ mới (có thể kèm việc con) khi Thầy/Cô muốn tạo nhiệm vụ hoặc giao việc mới. Công cụ không " +
  "tạo gì: giao diện hiện thẻ đề xuất, Thầy/Cô mở hộp tạo nhiệm vụ đã điền sẵn, xem lại và tự bấm Tạo. title ngắn, bắt " +
  "đầu bằng động từ, không ghi tên người hay hạn. priority: khẩn, gấp = URGENT; quan trọng = HIGH; bình thường = MEDIUM; " +
  "không gấp = LOW; không nói thì bỏ. dueDate, startDate, leadAssigneeName, assigneeName chỉ điền khi Thầy/Cô hoặc văn " +
  "bản, tệp gửi kèm nêu rõ; tên người ghi đúng như Thầy/Cô nói hay văn bản ghi, không đoán, không tra cứu. Ngày dạng " +
  "YYYY-MM-DD. " +
  "Chia luôn thành việc con (3–7 việc, mỗi việc một bước cụ thể để hoàn thành nhiệm vụ, ưu tiên đầu việc nêu trong văn " +
  "bản hay tệp; title việc con bắt đầu bằng động từ), trừ khi nhiệm vụ chỉ là một việc đơn lẻ hoặc Thầy/Cô bảo không chia. " +
  "Hạn và người nhận của việc con chỉ điền khi Thầy/Cô hay văn bản nêu cho đúng việc con đó, không tự chia mốc từ hạn " +
  "nhiệm vụ; có hạn thì không sau hạn nhiệm vụ. " +
  `Kế hoạch hay danh sách nhiều nhiệm vụ: gọi công cụ này cho từng nhiệm vụ, gọi liên tiếp (nhiều lần trong một lượt, tối đa ${ASSISTANT_MAX_PROPOSALS_PER_TURN}) đến khi đủ; ` +
  `mỗi lần trả lời gọi tối đa ${PROPOSALS_PER_REPLY} lần, còn thì nhận kết quả rồi gọi tiếp phần sau. ` +
  "Mỗi đầu việc (mục đánh số, gạch đầu dòng) của kế hoạch là một nhiệm vụ riêng, không gộp các đầu việc của một tháng " +
  "hay giai đoạn thành việc con; title giữ đúng ý đầu việc, đầu việc lặp lại qua các tháng (công việc thường xuyên) thì " +
  "thêm tháng vào title cho khỏi trùng. dueDate là hạn ghi cho tháng, giai đoạn chứa đầu việc; leadAssigneeName là người " +
  "chủ trì văn bản ghi; description một câu ngắn: thuộc kế hoạch tháng nào, sản phẩm ứng với đầu việc nếu văn bản " +
  "ghi, người và đơn vị phối hợp. Nhiệm vụ của kế hoạch không chia việc con, trừ khi văn bản ghi rõ các bước của đầu việc đó.";

const PROPOSAL_NOTE =
  "Chưa tạo nhiệm vụ nào. Giao diện đã hiện thẻ đề xuất đủ nội dung. Còn nhiệm vụ Thầy/Cô yêu cầu hay trong kế hoạch " +
  "chưa soạn thì gọi tiếp propose_task ngay, không hỏi lại. Soạn đủ rồi mới viết câu trả lời một hai câu: số đề xuất đã " +
  "soạn, trường bắt buộc còn trống (hạn, người chủ trì) nếu có, và Thầy/Cô xem lại rồi tự tạo (bấm \"Xem lại và tạo\" " +
  "trên thẻ, nhiều đề xuất thì \"Tạo tất cả\"). Không nhắc lại tên, mô tả, hạn, người hay việc con của đề xuất; không " +
  "nói là đã tạo hay đã giao.";

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
