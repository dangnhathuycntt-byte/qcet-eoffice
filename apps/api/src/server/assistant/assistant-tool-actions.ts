/**
 * Công cụ soạn thẻ hành động của Trợ lý (ADR-012): bình luận, đổi trạng thái, nhắc việc, ghi nhớ. Công cụ không thực hiện
 * gì: kiểm người hỏi đọc được nhiệm vụ và có quyền làm việc đó, rồi lưu thẻ chờ duyệt. Người dùng bấm nút trên thẻ (duyệt) thì
 * `decideAssistantAction` thực hiện và kiểm quyền lại.
 */
import { z } from "zod";
import type { AssistantActionDTO, AssistantActionTask, AssistantTaskStatusValue } from "@qcet/contracts/assistant";
import { ASSISTANT_MEMORY_MAX } from "@qcet/contracts/assistant";
import { prisma } from "@qcet/db/prisma";
import { authorize } from "@/server/authorization/authorization-engine";
import { buildTaskResource } from "@/server/authorization/available-actions";
import type { CapabilityAction } from "@/server/authorization/capability";
import { readTaskForUser } from "@/server/tasks/read-task-for-user";
import { createPendingAction } from "./assistant-actions";
import { resolveTaskId } from "./assistant-tool-tasks";
import { clip, ToolFailure, type AssistantToolContext, type ToolRun } from "./assistant-tool-shared";

const COMMENT_MAX = 2000;
const REMIND_MAX = 500;
const TASK_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "WAITING_APPROVAL", "COMPLETED", "CANCELLED"] as const;
const RECIPIENTS_SHOWN = 8;

const TaskRef = {
  id: z.string().trim().min(1).max(64).optional(),
  code: z.string().trim().min(1).max(64).optional(),
};
const oneTaskRef = (value: { id?: string; code?: string }) => (value.id === undefined) !== (value.code === undefined);
const ONE_TASK_MESSAGE = { message: "Cần đúng một trong id hoặc code của nhiệm vụ." };

export const ProposeCommentArgs = z
  .object({ ...TaskRef, body: z.string().trim().min(1).max(COMMENT_MAX) })
  .strict()
  .refine(oneTaskRef, ONE_TASK_MESSAGE);
export const ProposeStatusArgs = z
  .object({ ...TaskRef, status: z.enum(TASK_STATUSES) })
  .strict()
  .refine(oneTaskRef, ONE_TASK_MESSAGE);
export const ProposeReminderArgs = z
  .object({ ...TaskRef, message: z.string().trim().min(1).max(REMIND_MAX) })
  .strict()
  .refine(oneTaskRef, ONE_TASK_MESSAGE);
export const RememberArgs = z.object({ content: z.string().trim().min(1).max(ASSISTANT_MEMORY_MAX) }).strict();

export const PROPOSE_COMMENT_DESCRIPTION =
  "Soạn thẻ bình luận vào một nhiệm vụ để Thầy/Cô duyệt; chỉ dùng khi Thầy/Cô trực tiếp nhờ viết bình luận. Bình luận " +
  "chỉ được đăng khi Thầy/Cô bấm \"Đăng bình luận\" trên thẻ. Truyền đúng một trong id hoặc code, và body là nguyên văn bình luận " +
  "(văn phong lịch sự, ngắn gọn). Ví dụ: {\"code\":\"NV-2026-09-001\",\"body\":\"Nhờ thầy cập nhật tiến độ trước thứ Sáu.\"}";
export const PROPOSE_STATUS_DESCRIPTION =
  "Soạn thẻ đổi trạng thái một nhiệm vụ để Thầy/Cô duyệt; chỉ dùng khi Thầy/Cô trực tiếp nhờ đổi trạng thái. status: " +
  "NOT_STARTED = Chưa bắt đầu, IN_PROGRESS = Đang thực hiện, WAITING_APPROVAL = Chờ duyệt, COMPLETED = Hoàn thành, " +
  "CANCELLED = Đã hủy. Máy chủ kiểm quyền; không có quyền thì báo lỗi để Thầy/Cô biết.";
export const PROPOSE_REMINDER_DESCRIPTION =
  "Soạn thẻ nhắc việc gửi cho người chủ trì, phối hợp, thực hiện của một nhiệm vụ (trừ Thầy/Cô) để Thầy/Cô duyệt; chỉ " +
  "dùng khi Thầy/Cô trực tiếp nhờ nhắc. message là nguyên văn lời nhắc. Lời nhắc chỉ gửi khi Thầy/Cô bấm \"Gửi lời nhắc\" trên thẻ.";
export const REMEMBER_DESCRIPTION =
  "Soạn thẻ ghi nhớ một điều về Thầy/Cô (cách xưng hô, đơn vị hay làm việc cùng, thói quen trình bày…) để dùng ở các " +
  "cuộc sau; chỉ dùng khi Thầy/Cô bảo nhớ. content là một câu ngắn, ngôi thứ ba, ví dụ \"Thích câu trả lời dạng bảng.\" " +
  "Ghi nhớ chỉ được lưu khi Thầy/Cô bấm \"Lưu ghi nhớ\" trên thẻ. Không ghi số điện thoại, email, mật khẩu hay dữ liệu nhạy cảm.";

/** Thẻ soạn cần cuộc trò chuyện đã có (để lưu kèm); ngoài lượt hội thoại thì không soạn được. */
function conversationOf(ctx: AssistantToolContext): string {
  if (!ctx.conversationId) throw new ToolFailure("Chưa soạn được thẻ ở đây.");
  return ctx.conversationId;
}

/** Nhiệm vụ người hỏi đọc được và có quyền `action` trên đó; không đọc được thì báo như không tìm thấy. */
async function loadActionTask(ctx: AssistantToolContext, ref: { id?: string; code?: string }, action: CapabilityAction, deniedMessage: string) {
  const taskId = await resolveTaskId(ref);
  const { task, rawTask } = await readTaskForUser(ctx.authz, taskId);
  const resource = buildTaskResource(rawTask);
  if (!authorize(ctx.authz, action, resource).allowed) throw new ToolFailure(deniedMessage);
  const view: AssistantActionTask = { id: task.id, code: task.code ?? null, title: clip(task.title, 160) };
  return { task, resource, view };
}

function actionRun(action: AssistantActionDTO, label: string, payload: Record<string, unknown>): ToolRun {
  return {
    payload: { actionId: action.id, status: "pending", ...payload, note: "Thẻ đã hiện cho Thầy/Cô; chỉ thực hiện khi Thầy/Cô bấm nút trên thẻ." },
    lists: [],
    count: null,
    sources: [],
    detailed: false,
    label,
    action,
  };
}

export async function proposeComment(args: z.output<typeof ProposeCommentArgs>, ctx: AssistantToolContext): Promise<ToolRun> {
  const conversationId = conversationOf(ctx);
  const { view } = await loadActionTask(ctx, args, "task.comment", "Thầy/Cô không có quyền bình luận vào nhiệm vụ này.");
  const action = await createPendingAction({ userId: ctx.userId, conversationId, view: { kind: "task_comment", task: view, body: args.body } });
  return actionRun(action, `Soạn bình luận cho ${view.code ?? "nhiệm vụ"}`, { task: view.code ?? view.title });
}

export async function proposeStatusChange(args: z.output<typeof ProposeStatusArgs>, ctx: AssistantToolContext): Promise<ToolRun> {
  const conversationId = conversationOf(ctx);
  const capability: CapabilityAction = args.status === "COMPLETED" ? "task.approve" : "task.update_execution";
  const denied =
    args.status === "COMPLETED"
      ? "Thầy/Cô không có quyền duyệt hoàn thành nhiệm vụ này."
      : "Thầy/Cô không có quyền đổi trạng thái nhiệm vụ này.";
  const { task, view } = await loadActionTask(ctx, args, capability, denied);
  const from = task.status as AssistantTaskStatusValue;
  if (from === args.status) throw new ToolFailure("Nhiệm vụ đã ở trạng thái này, không cần đổi.");
  const action = await createPendingAction({
    userId: ctx.userId,
    conversationId,
    view: { kind: "task_status", task: view, from, to: args.status },
  });
  return actionRun(action, `Soạn đổi trạng thái ${view.code ?? "nhiệm vụ"}`, { task: view.code ?? view.title, from, to: args.status });
}

export async function proposeReminder(args: z.output<typeof ProposeReminderArgs>, ctx: AssistantToolContext): Promise<ToolRun> {
  const conversationId = conversationOf(ctx);
  const { resource, view } = await loadActionTask(ctx, args, "task.remind", "Thầy/Cô không có quyền nhắc việc nhiệm vụ này.");
  // Cùng cách chọn người nhận như taskDomainActionService.remind (không truyền targetUserIds): chủ trì, phối hợp, thực hiện, trừ người nhắc
  const ids = new Set<string>([resource.primaryOwnerId, ...(resource.collaboratorIds ?? []), ...(resource.assigneeIds ?? [])].filter((id): id is string => Boolean(id)));
  ids.delete(ctx.userId);
  if (ids.size === 0) throw new ToolFailure("Nhiệm vụ chưa có người nhận lời nhắc (ngoài Thầy/Cô).");
  const users = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { name: true }, orderBy: { name: "asc" } });
  const names = users.map((user) => user.name);
  const recipients = names.length > RECIPIENTS_SHOWN ? [...names.slice(0, RECIPIENTS_SHOWN), `và ${names.length - RECIPIENTS_SHOWN} người khác`] : names;
  const action = await createPendingAction({
    userId: ctx.userId,
    conversationId,
    view: { kind: "task_remind", task: view, message: args.message, recipients },
  });
  return actionRun(action, `Soạn lời nhắc cho ${view.code ?? "nhiệm vụ"}`, { task: view.code ?? view.title, recipients: names.length });
}

export async function proposeMemory(args: z.output<typeof RememberArgs>, ctx: AssistantToolContext): Promise<ToolRun> {
  const conversationId = conversationOf(ctx);
  const action = await createPendingAction({ userId: ctx.userId, conversationId, view: { kind: "memory_save", content: args.content } });
  return actionRun(action, "Soạn ghi nhớ", {});
}
