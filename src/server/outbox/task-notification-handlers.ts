/**
 * Handler outbox cho thông báo nhiệm vụ (H-1, spec task-document-gap-spec.md).
 *
 * Chỉ xử lý sự kiện chưa có đường gửi khác. Giao việc lúc tạo nhiệm vụ đi qua
 * dispatchTaskAssignedPush; trễ hạn văn bản do cron document-deadline-check tự
 * tạo thông báo; các sự kiện đó chỉ được đánh dấu đã xử lý để không gửi trùng.
 *
 * Người nhận được xác định khi xử lý, theo vai trò hiện tại trên nhiệm vụ, và
 * không bao giờ gồm người gây ra sự kiện (Quy trình 11).
 */
import type { OutboxEvent } from "@prisma/client";
import {
  OutboxEventType,
  type DbClient,
  type OutboxEventHandler,
  type OutboxHandlerContext,
  type OutboxHandlerMap,
} from "@/lib/db/outbox";
import { prisma } from "@/lib/prisma";
import {
  formatTaskPushPayload,
  sendPushNotificationToUser,
  type TaskPushEventType,
} from "@/lib/push-service";
import { logger } from "@/server/observability/logger";

/** Sự kiện cũ hơn mốc này khi được xử lý lần đầu thì bỏ qua, không gửi dồn tồn đọng. */
export const STALE_EVENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface TaskNotice {
  taskId: string;
  recipientIds: string[];
  actorId: string | null;
  type: string;
  pushEvent: TaskPushEventType;
  note?: string | null;
}

function payloadOf(event: OutboxEvent): Record<string, unknown> {
  const payload = event.payload;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function str(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function requireTaskId(event: OutboxEvent): string {
  const taskId = str(payloadOf(event), "taskId") ?? event.aggregateId;
  if (!taskId) throw new Error(`Sự kiện ${event.eventType} thiếu taskId`);
  return taskId;
}

/** Người thực hiện: người chủ trì (DRI) và người phối hợp. */
async function executorIds(db: DbClient, taskId: string): Promise<string[]> {
  const actors = await db.taskActor.findMany({
    where: { taskId, userId: { not: null }, role: { in: ["DRI", "COLLABORATOR"] } },
    select: { userId: true },
  });
  return actors.map((a) => a.userId as string);
}

/** Người duyệt được chỉ định; không có thì về người giao (người tạo). */
async function reviewerIds(db: DbClient, taskId: string): Promise<string[]> {
  const actors = await db.taskActor.findMany({
    where: { taskId, userId: { not: null }, role: { in: ["REVIEWER", "APPROVER"] } },
    select: { userId: true },
  });
  if (actors.length > 0) return actors.map((a) => a.userId as string);
  const task = await db.task.findUnique({ where: { id: taskId }, select: { createdById: true } });
  return task ? [task.createdById] : [];
}

export async function deliverTaskNotice(db: DbClient, notice: TaskNotice): Promise<string[]> {
  const recipients = [...new Set(notice.recipientIds)].filter((id) => id && id !== notice.actorId);
  if (recipients.length === 0) return [];

  const task = await db.task.findUnique({ where: { id: notice.taskId }, select: { id: true, title: true } });
  if (!task) return [];

  const actor = notice.actorId
    ? await db.user.findUnique({ where: { id: notice.actorId }, select: { name: true } })
    : null;
  const actorName = actor?.name || "Hệ thống";

  const payload = formatTaskPushPayload({
    event: notice.pushEvent,
    taskId: task.id,
    taskTitle: task.title,
    actorName,
    directiveNote: notice.note ?? undefined,
  });

  // Ghi thông báo trong ứng dụng trước, một lệnh duy nhất: nếu lỗi thì chưa có bản
  // ghi nào và sự kiện được thử lại; sau đó push lỗi không làm thử lại để tránh trùng.
  await db.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      actorName,
      title: payload.title,
      body: payload.body,
      category: "task",
      type: notice.type,
      linkHref: payload.data.linkHref,
    })),
  });

  for (const userId of recipients) {
    try {
      await sendPushNotificationToUser(userId, payload);
    } catch (error) {
      logger.warn("outbox.task_notice.push_failed", {
        metadata: { taskId: task.id, userId, type: notice.type, error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  return recipients;
}

function guarded(handler: (event: OutboxEvent, db: DbClient) => Promise<unknown>): OutboxEventHandler {
  return async (event: OutboxEvent, context?: OutboxHandlerContext) => {
    const now = context?.now ?? new Date();
    if (event.attempts === 0 && now.getTime() - event.createdAt.getTime() > STALE_EVENT_MAX_AGE_MS) {
      logger.info("outbox.event.stale_skipped", {
        metadata: { id: event.id, eventType: event.eventType, createdAt: event.createdAt.toISOString() },
      });
      return { skipped: "stale" };
    }
    return handler(event, context?.client ?? prisma);
  };
}

/** Đã có đường gửi khác: chỉ đánh dấu xử lý xong. */
const acknowledge: OutboxEventHandler = async () => ({ skipped: "delivered_elsewhere" });

export const TASK_NOTIFICATION_HANDLERS: OutboxHandlerMap = {
  [OutboxEventType.TASK_REMINDER_NOTIFICATION]: guarded(async (event, db) => {
    const p = payloadOf(event);
    const recipientIds = Array.isArray(p.recipientIds) ? p.recipientIds.filter((id): id is string => typeof id === "string") : [];
    return deliverTaskNotice(db, {
      taskId: requireTaskId(event),
      recipientIds,
      actorId: str(p, "remindedById"),
      type: "reminder",
      pushEvent: "TASK_REMINDER",
      note: str(p, "message"),
    });
  }),

  // Phát từ lệnh giao lại (reassign); giao việc khi tạo nhiệm vụ không đi qua outbox.
  [OutboxEventType.TASK_ASSIGNED_NOTIFICATION]: guarded(async (event, db) => {
    const p = payloadOf(event);
    const assignee = str(p, "newAssigneeId");
    return deliverTaskNotice(db, {
      taskId: requireTaskId(event),
      recipientIds: assignee ? [assignee] : [],
      actorId: str(p, "assignedById"),
      type: "assigned",
      pushEvent: "TASK_ASSIGNED",
    });
  }),

  [OutboxEventType.DELIVERABLE_SUBMITTED_NOTIFICATION]: guarded(async (event, db) => {
    const p = payloadOf(event);
    const taskId = requireTaskId(event);
    return deliverTaskNotice(db, {
      taskId,
      recipientIds: await reviewerIds(db, taskId),
      actorId: str(p, "submittedById"),
      type: "deliverable_submitted",
      pushEvent: "DELIVERABLE_SUBMITTED",
    });
  }),

  [OutboxEventType.TASK_REJECTED_NOTIFICATION]: guarded(async (event, db) => {
    const p = payloadOf(event);
    const taskId = requireTaskId(event);
    return deliverTaskNotice(db, {
      taskId,
      recipientIds: await executorIds(db, taskId),
      actorId: str(p, "requestedById"),
      type: "deliverable_revision",
      pushEvent: "DELIVERABLE_REVISION",
      note: str(p, "reason"),
    });
  }),

  [OutboxEventType.TASK_APPROVED_NOTIFICATION]: guarded(async (event, db) => {
    const p = payloadOf(event);
    const taskId = requireTaskId(event);
    return deliverTaskNotice(db, {
      taskId,
      recipientIds: await executorIds(db, taskId),
      actorId: str(p, "approvedById"),
      type: p.completed === false ? "progress" : "completed",
      pushEvent: "DELIVERABLE_APPROVED",
    });
  }),

  // Chỉ thông báo khi hủy; bắt đầu, cập nhật tiến độ không gửi thông báo.
  [OutboxEventType.TASK_STATUS_NOTIFICATION]: guarded(async (event, db) => {
    const p = payloadOf(event);
    if (str(p, "status") !== "CANCELLED") return { skipped: "not_notifiable" };
    const taskId = requireTaskId(event);
    return deliverTaskNotice(db, {
      taskId,
      recipientIds: await executorIds(db, taskId),
      actorId: str(p, "actorId"),
      type: "cancelled",
      pushEvent: "TASK_CANCELLED",
      note: str(p, "reason"),
    });
  }),

  // Nhắc tên trong bình luận: đọc lại bình luận lúc gửi, bình luận đã xóa thì bỏ qua.
  [OutboxEventType.TASK_COMMENT_MENTION_NOTIFICATION]: guarded(async (event, db) => {
    const p = payloadOf(event);
    const commentId = str(p, "commentId");
    const comment = commentId
      ? await db.taskComment.findUnique({ where: { id: commentId }, select: { body: true, deletedAt: true } })
      : null;
    if (!comment || comment.deletedAt) return { skipped: "comment_removed" };
    const mentioned = Array.isArray(p.mentionedUserIds)
      ? p.mentionedUserIds.filter((id): id is string => typeof id === "string")
      : [];
    return deliverTaskNotice(db, {
      taskId: requireTaskId(event),
      recipientIds: mentioned,
      actorId: str(p, "authorId"),
      type: "mention",
      pushEvent: "TASK_MENTION",
      note: comment.body.length > 80 ? `${comment.body.slice(0, 77)}...` : comment.body,
    });
  }),

  // Xin gia hạn: báo người giao (người tạo nhiệm vụ) và người được ủy làm người duyệt.
  [OutboxEventType.TASK_EXTENSION_REQUESTED_NOTIFICATION]: guarded(async (event, db) => {
    const p = payloadOf(event);
    const taskId = requireTaskId(event);
    const task = await db.task.findUnique({ where: { id: taskId }, select: { createdById: true } });
    const requestId = str(p, "requestId");
    const request = requestId
      ? await db.taskExtensionRequest.findUnique({ where: { id: requestId }, select: { status: true, reason: true } })
      : null;
    if (!task || !request || request.status !== "PENDING") return { skipped: "request_closed" };
    return deliverTaskNotice(db, {
      taskId,
      recipientIds: [task.createdById],
      actorId: str(p, "requestedById"),
      type: "extension_requested",
      pushEvent: "TASK_EXTENSION_REQUEST",
      note: request.reason.length > 80 ? `${request.reason.slice(0, 77)}...` : request.reason,
    });
  }),

  // Phản hồi gia hạn: báo người còn lại trong cặp người xin và người giao.
  [OutboxEventType.TASK_EXTENSION_DECIDED_NOTIFICATION]: guarded(async (event, db) => {
    const p = payloadOf(event);
    const notifyUserId = str(p, "notifyUserId");
    return deliverTaskNotice(db, {
      taskId: requireTaskId(event),
      recipientIds: notifyUserId ? [notifyUserId] : [],
      actorId: str(p, "actorId"),
      type: "extension_decided",
      pushEvent: "TASK_EXTENSION_DECISION",
      note: str(p, "message"),
    });
  }),

  [OutboxEventType.TASK_COMPLETED]: acknowledge,
  [OutboxEventType.DOCUMENT_OVERDUE_NOTIFICATION]: acknowledge,
  [OutboxEventType.DOCUMENT_EXPIRING_SOON_NOTIFICATION]: acknowledge,
};
