/**
 * Chữ của thẻ hành động do Trợ lý soạn (ADR-012), dùng chung cho giao diện và khối ghi lại trong lịch sử mô hình.
 * Thuần, không đụng CSDL.
 */
import type { AssistantActionDTO, AssistantActionStatus, AssistantActionView } from "@qcet/contracts/assistant";
import { getStatusDisplay } from "@qcet/shared/domain/tasks/display-config";

export const ASSISTANT_ACTION_STATUS_LABEL: Record<AssistantActionStatus, string> = {
  pending: "Chờ duyệt",
  done: "Đã thực hiện",
  rejected: "Đã bỏ qua",
  failed: "Không thực hiện được",
  undone: "Đã hoàn tác",
  expired: "Hết hạn",
};

const HISTORY_TEXT_MAX = 80;

function taskName(task: { code: string | null; title: string }): string {
  return task.code ?? task.title;
}

function clipText(text: string, max: number): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** Tên ngắn của hành động, như "Bình luận vào NV-2026-09-001". */
export function describeAssistantAction(view: AssistantActionView): string {
  switch (view.kind) {
    case "task_comment":
      return `Bình luận vào ${taskName(view.task)}`;
    case "task_status":
      return `Đổi trạng thái ${taskName(view.task)}`;
    case "task_remind":
      return `Nhắc việc ${taskName(view.task)}`;
    case "memory_save":
      return "Ghi nhớ cho các cuộc sau";
    case "meeting_minutes":
      return `${view.replaces ? "Thay dự thảo biên bản" : "Lưu dự thảo biên bản"} "${clipText(view.meeting.title, 60)}"`;
  }
}

/**
 * Chữ trên thẻ (người dùng 21/10/2026 gửi ảnh thẻ "Thay dự thảo biên bản "H…": tên cuộc họp bị cắt mất nghĩa). Tiêu đề là
 * quyết định đang hỏi, đối tượng đứng riêng một dòng (như Approval card của Hightouch UI); thẻ đã xử lý thì tiêu đề nói việc
 * đã làm. `describeAssistantAction` vẫn là tên một dòng cho khối ghi lại và nhãn trợ năng.
 */
export function assistantActionHeading(view: AssistantActionView): string {
  if (view.kind === "meeting_minutes") return view.replaces ? "Thay dự thảo biên bản" : "Lưu dự thảo biên bản";
  return describeAssistantAction(view);
}

/** Đối tượng thẻ tác động: tên nhiệm vụ, tên cuộc họp; ghi nhớ thì không có. */
export function assistantActionTarget(view: AssistantActionView): string | null {
  if ("task" in view) return view.task.title;
  if (view.kind === "meeting_minutes") return view.meeting.title;
  return null;
}

/** Tiêu đề thẻ đã thực hiện: việc đã làm, như "Đã lưu dự thảo biên bản". */
export function assistantActionResult(view: AssistantActionView): string {
  switch (view.kind) {
    case "task_comment":
      return `Đã bình luận vào ${taskName(view.task)}`;
    case "task_status":
      return `Đã chuyển ${taskName(view.task)} sang ${assistantTaskStatusLabel(view.to)}`;
    case "task_remind":
      return `Đã nhắc việc ${taskName(view.task)}`;
    case "memory_save":
      return "Đã lưu ghi nhớ";
    case "meeting_minutes":
      return view.replaces ? "Đã thay dự thảo biên bản" : "Đã lưu dự thảo biên bản";
  }
}

/** Nhãn trạng thái nhiệm vụ trong thẻ đổi trạng thái. */
export function assistantTaskStatusLabel(status: string): string {
  return getStatusDisplay(status).label;
}

/** Nội dung ngắn của hành động cho khối ghi lại (không chép đủ bình luận dài). */
function historyDetail(view: AssistantActionView): string {
  switch (view.kind) {
    case "task_comment":
      return `"${clipText(view.body, HISTORY_TEXT_MAX)}"`;
    case "task_status":
      return `${assistantTaskStatusLabel(view.from)} → ${assistantTaskStatusLabel(view.to)}`;
    case "task_remind":
      return `"${clipText(view.message, HISTORY_TEXT_MAX)}"`;
    case "memory_save":
      return `"${clipText(view.content, HISTORY_TEXT_MAX)}"`;
    case "meeting_minutes":
      return `"${clipText(view.minutes, HISTORY_TEXT_MAX)}"`;
  }
}

/**
 * Khối "[Hệ thống ghi lại: …]" nối sau tin trả lời trong lịch sử gửi mô hình: thẻ nào đã soạn và người hỏi đã duyệt,
 * bỏ qua hay hoàn tác, để lượt sau không soạn lại thẻ đã làm hay nói sai kết quả.
 */
export function actionHistoryNote(actions: readonly AssistantActionDTO[]): string {
  if (actions.length === 0) return "";
  const lines = actions.map(
    (action, i) => `${i + 1}. ${describeAssistantAction(action.view)}: ${historyDetail(action.view)} · ${ASSISTANT_ACTION_STATUS_LABEL[action.status].toLowerCase()}`,
  );
  return [`[Hệ thống ghi lại: thẻ hành động đã soạn ở lượt này]`, ...lines].join("\n");
}
