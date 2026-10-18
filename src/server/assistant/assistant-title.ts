/**
 * Tên cuộc trò chuyện do mô hình đặt (như ChatGPT): một lần gọi gateway riêng, không công cụ, không suy nghĩ, chạy song
 * song với lượt đầu của cuộc mới. Chỉ gửi câu hỏi đầu, nhãn mục đang hỏi và nhãn tệp gửi kèm; không gửi nội dung tệp.
 */
import { cleanGeneratedTitle } from "@qcet/shared/domain/assistant/assistant-history";
import { callGateway, type GatewayConfig } from "@/server/services/agent-gateway";

/** Đặt tên chậm hơn mức này thì thôi, giữ tên lấy từ câu hỏi. */
const TITLE_TIMEOUT_MS = 15_000;
/** Câu hỏi dài chỉ cần phần đầu để đặt tên. */
const TITLE_MESSAGE_CHARS = 1000;

const TITLE_SYSTEM_PROMPT =
  "Đặt tên cho cuộc trò chuyện của cán bộ, giảng viên với Trợ lý văn phòng điện tử của trường, dựa trên câu hỏi đầu " +
  "tiên. Tên tiếng Việt có dấu, từ 2 đến 7 từ, nêu đúng chủ đề. Viết như một câu: chỉ viết hoa chữ cái đầu và tên riêng " +
  "(Phòng Đào tạo, Quyết định 418), các chữ khác viết thường. Không dấu câu ở cuối, không ngoặc kép, không emoji. Không " +
  "trả lời câu hỏi, không chào hỏi. Chỉ trả về tên.\n" +
  "Ví dụ: \"cuối tuần này có lịch họp nào không\" → Lịch họp cuối tuần. \"giao anh Minh rà soát hồ sơ tuyển sinh\" → " +
  "Giao việc rà soát hồ sơ tuyển sinh. \"tóm tắt quyết định 418 của trường\" → Tóm tắt Quyết định 418.";

export interface ConversationTitleInput {
  message: string;
  /** Mục cuộc trò chuyện gắn với ("nhiệm vụ NV-… Tên"), nếu có. */
  context: string | null;
  /** Nhãn bước của tệp gửi kèm ("Đọc tệp qd-418.pdf"). */
  attachments: string[];
}

/** Gọi mô hình đặt tên; trả null khi mô hình không trả chữ dùng được. Lỗi gateway ném ra cho nơi gọi. */
export async function generateConversationTitle(input: ConversationTitleInput, config: GatewayConfig): Promise<string | null> {
  const lines = [`Câu hỏi: ${input.message.slice(0, TITLE_MESSAGE_CHARS)}`];
  if (input.context) lines.push(`Đang hỏi về: ${input.context}`);
  if (input.attachments.length > 0) lines.push(`Tệp gửi kèm: ${input.attachments.join("; ")}`);
  const completion = await callGateway(
    [
      { role: "system", content: TITLE_SYSTEM_PROMPT },
      { role: "user", content: lines.join("\n") },
    ],
    // Không cần suy nghĩ cho một câu ngắn: nhanh hơn và không tốn ngân sách suy nghĩ
    { config: { ...config, thinkingBudget: null }, timeoutMs: TITLE_TIMEOUT_MS, subject: "Trợ lý" },
  );
  return cleanGeneratedTitle(completion.content);
}
