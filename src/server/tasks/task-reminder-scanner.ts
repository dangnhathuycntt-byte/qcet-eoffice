/**
 * Bộ quét nhắc hạn nhiệm vụ (T-06, spec task-document-gap-spec.md).
 *
 * Chạy định kỳ (worker outbox, hoặc route cron). Mỗi nhắc nhở gắn một khóa
 * (nhiệm vụ, loại, mốc) ghi vào task_reminder_logs với ràng buộc duy nhất, nên chạy lại
 * hay chạy song song không gửi trùng.
 *
 * | Loại                  | Điều kiện                                         | Người nhận                         |
 * | DUE_SOON              | còn 1 ngày, chưa nộp duyệt                        | chủ trì, phối hợp                  |
 * | OVERDUE               | qua ngày hạn, chưa nộp duyệt                      | chủ trì, phối hợp, người giao      |
 * | REVIEW_PENDING_2D/4D  | chờ duyệt từ 48/96 giờ                            | người duyệt / người giao           |
 * | EXTENSION_PENDING_2D/4D | yêu cầu gia hạn chưa quyết định 48/96 giờ       | người giao / trưởng đơn vị chủ trì |
 * | DECLINE_PENDING_2D/4D | từ chối nhận việc chưa giao lại 48/96 giờ         | người giao / trưởng đơn vị chủ trì |
 * | BACKUP_REVIEWER_ACTIVATED | chờ duyệt đủ 96 giờ, có người dự phòng (T-05)  | người duyệt dự phòng               |
 *
 * Trễ ngừng đếm khi đã nộp duyệt (Quy trình 4), nên nhiệm vụ chờ duyệt không báo trễ cho
 * người thực hiện. Người dùng tắt được nhắc trước hạn và nhắc người duyệt sau 2 ngày
 * (cài đặt push); báo trễ và các mốc 4 ngày thì không tắt được.
 */
import { AssignmentStatus, ExtensionRequestStatus, TaskStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isUnitLeaderPosition } from "@/server/authorization/authorization-engine";
import { logger } from "@/server/observability/logger";
import {
  dayDiff,
  escalationStage,
  ictDayKey,
  ictDayStart,
  isDueSoon,
  isOverdueNotifiable,
  isPastReminderHour,
  OVERDUE_LOOKBACK_DAYS,
  type ReminderKind,
} from "@/domain/tasks/reminder-rules";
import { deliverTaskNotice } from "@/server/outbox/task-notification-handlers";
import { findActiveDecline } from "./task-decline-service";
import { reconcileBackupReviewer, revokeStaleBackupReviewers } from "./task-backup-reviewer-service";

type Db = Prisma.TransactionClient | typeof prisma;

export interface ReminderScanResult {
  considered: number;
  sent: Record<string, number>;
  skippedDuplicate: number;
  skippedOptOut: number;
}

type PrefKey = "deadlineReminder" | "taskReview";

const EXECUTOR_ROLES = ["DRI", "COLLABORATOR"] as const;
const REVIEWER_ROLES = ["REVIEWER", "APPROVER"] as const;

function fmtDay(date: Date): string {
  return date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
}

async function unitLeaderIds(db: Db, unitId: string | null): Promise<string[]> {
  if (!unitId) return [];
  const rows = await db.positionAssignment.findMany({
    where: { unitId, status: AssignmentStatus.ACTIVE },
    include: { positionDefinition: { select: { code: true } } },
  });
  return rows.filter((r) => isUnitLeaderPosition(r.positionDefinition.code)).map((r) => r.userId);
}

/** Bỏ những người đã tắt loại nhắc này trong cài đặt thông báo (mặc định bật). */
async function withoutOptedOut(db: Db, userIds: string[], pref: PrefKey | null): Promise<{ kept: string[]; dropped: number }> {
  if (!pref || userIds.length === 0) return { kept: userIds, dropped: 0 };
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, onboardingData: true } });
  const off = new Set(
    users
      .filter((u) => {
        const prefs = (u.onboardingData as { pushPreferences?: Partial<Record<PrefKey, boolean>> } | null)?.pushPreferences;
        return prefs?.[pref] === false;
      })
      .map((u) => u.id)
  );
  return { kept: userIds.filter((id) => !off.has(id)), dropped: off.size };
}

interface Candidate {
  taskId: string;
  kind: ReminderKind;
  dueKey: string;
  recipientIds: string[];
  pref: PrefKey | null;
  type: string;
  pushEvent: Parameters<typeof deliverTaskNotice>[1]["pushEvent"];
  note: string;
  dueDateStr?: string;
}

async function send(db: Db, c: Candidate, result: ReminderScanResult) {
  const { kept, dropped } = await withoutOptedOut(db, c.recipientIds, c.pref);
  result.skippedOptOut += dropped;
  if (kept.length === 0) return;

  // Ghi khóa trước: nếu đã có thì bỏ qua, nên không gửi trùng khi quét song song.
  const claimed = await db.taskReminderLog.createMany({
    data: [{ taskId: c.taskId, kind: c.kind, dueKey: c.dueKey }],
    skipDuplicates: true,
  });
  if (claimed.count === 0) {
    result.skippedDuplicate++;
    return;
  }
  try {
    await deliverTaskNotice(db, {
      taskId: c.taskId,
      recipientIds: kept,
      actorId: null,
      type: c.type,
      pushEvent: c.pushEvent,
      note: c.note,
      dueDateStr: c.dueDateStr,
    });
    result.sent[c.kind] = (result.sent[c.kind] ?? 0) + 1;
  } catch (error) {
    // Gửi lỗi thì nhả khóa để lần quét sau thử lại.
    await db.taskReminderLog.deleteMany({ where: { taskId: c.taskId, kind: c.kind, dueKey: c.dueKey } });
    logger.error("task.reminder.send_failed", { metadata: { taskId: c.taskId, kind: c.kind } }, error);
  }
}

export async function scanTaskReminders(
  options: { now?: Date; db?: Db; taskIds?: string[] } = {}
): Promise<ReminderScanResult> {
  const now = options.now ?? new Date();
  const db = options.db ?? prisma;
  const scope: Prisma.TaskWhereInput = options.taskIds ? { id: { in: options.taskIds } } : {};
  const result: ReminderScanResult = { considered: 0, sent: {}, skippedDuplicate: 0, skippedOptOut: 0 };

  const todayStart = ictDayStart(ictDayKey(now));
  const lookbackStart = new Date(todayStart.getTime() - OVERDUE_LOOKBACK_DAYS * 86_400_000);
  const dayAfterTomorrow = new Date(todayStart.getTime() + 2 * 86_400_000);

  // 1. Trước hạn và trễ hạn: nhiệm vụ chưa nộp duyệt, chưa lưu trữ.
  if (isPastReminderHour(now)) {
    const open = await db.task.findMany({
      where: {
        ...scope,
        archivedAt: null,
        status: { in: [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS] },
        dueDate: { gte: lookbackStart, lt: dayAfterTomorrow },
      },
      select: {
        id: true,
        dueDate: true,
        createdById: true,
        actors: { where: { role: { in: [...EXECUTOR_ROLES] }, userId: { not: null } }, select: { userId: true } },
      },
    });
    result.considered += open.length;
    for (const task of open) {
      const executors = task.actors.map((a) => a.userId as string);
      const dueKey = ictDayKey(task.dueDate);
      if (isDueSoon(task.dueDate, now)) {
        await send(db, {
          taskId: task.id,
          kind: "DUE_SOON",
          dueKey,
          recipientIds: executors,
          pref: "deadlineReminder",
          type: "deadline",
          pushEvent: "DEADLINE_WARNING_24H",
          note: `Hạn ${fmtDay(task.dueDate)}`,
          dueDateStr: fmtDay(task.dueDate),
        }, result);
      } else if (isOverdueNotifiable(task.dueDate, now)) {
        await send(db, {
          taskId: task.id,
          kind: "OVERDUE",
          dueKey,
          recipientIds: [...executors, task.createdById],
          pref: null,
          type: "overdue",
          pushEvent: "TASK_OVERDUE",
          note: `Trễ ${dayDiff(dueKey, ictDayKey(now))} ngày so với hạn ${fmtDay(task.dueDate)}`,
        }, result);
      }
    }
  }

  // 2. Chờ duyệt lâu: người duyệt sau 48 giờ, người giao sau 96 giờ.
  const waiting = await db.task.findMany({
    where: { ...scope, archivedAt: null, status: TaskStatus.WAITING_APPROVAL },
    select: {
      id: true,
      createdById: true,
      updatedAt: true,
      taskResults: { select: { submittedAt: true }, orderBy: { submittedAt: "desc" }, take: 1 },
      actors: { where: { role: { in: [...REVIEWER_ROLES] }, userId: { not: null } }, select: { userId: true } },
    },
  });
  result.considered += waiting.length;
  for (const task of waiting) {
    const since = task.taskResults[0]?.submittedAt ?? task.updatedAt;
    const stage = escalationStage(since, now);
    const dueKey = since.toISOString();
    const days = Math.floor((now.getTime() - since.getTime()) / 86_400_000);
    // Người duyệt dự phòng (T-05): nhận quyền đúng mốc 96 giờ, gỡ nếu đây là đợt chờ duyệt mới.
    const backup = await reconcileBackupReviewer(db, task.id, since, now);
    if (stage === "NONE") continue;
    const reviewers = task.actors.length > 0 ? task.actors.map((a) => a.userId as string) : [task.createdById];
    if (stage === "FIRST" || stage === "SECOND") {
      await send(db, {
        taskId: task.id, kind: "REVIEW_PENDING_2D", dueKey, recipientIds: reviewers, pref: "taskReview",
        type: "review_pending", pushEvent: "TASK_REVIEW_PENDING", note: `Đã chờ duyệt ${days} ngày`,
      }, result);
    }
    if (stage === "SECOND") {
      await send(db, {
        taskId: task.id, kind: "REVIEW_PENDING_4D", dueKey, recipientIds: [task.createdById], pref: null,
        type: "escalation", pushEvent: "TASK_ESCALATION", note: `Kết quả đã chờ duyệt ${days} ngày chưa có người duyệt`,
      }, result);
    }
    if (backup.outcome === "ACTIVATED" && backup.userId) {
      await send(db, {
        taskId: task.id, kind: "BACKUP_REVIEWER_ACTIVATED", dueKey, recipientIds: [backup.userId], pref: null,
        type: "review_pending", pushEvent: "TASK_REVIEW_PENDING", note: `Bạn là người duyệt dự phòng; kết quả đã chờ duyệt ${days} ngày`,
      }, result);
    }
  }
  // Hết đợt chờ duyệt thì gỡ quyền người dự phòng đã kích hoạt.
  await revokeStaleBackupReviewers(db, options.taskIds);

  // 3. Yêu cầu gia hạn chưa được quyết định.
  const stale = new Date(now.getTime() - 48 * 3_600_000);
  const extensions = await db.taskExtensionRequest.findMany({
    where: { status: ExtensionRequestStatus.PENDING, createdAt: { lte: stale }, task: { ...scope, archivedAt: null, status: { in: [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS, TaskStatus.WAITING_APPROVAL] } } },
    include: { task: { select: { id: true, createdById: true, leadUnitId: true } } },
  });
  result.considered += extensions.length;
  for (const req of extensions) {
    const stage = escalationStage(req.createdAt, now);
    const days = Math.floor((now.getTime() - req.createdAt.getTime()) / 86_400_000);
    await send(db, {
      taskId: req.task.id, kind: "EXTENSION_PENDING_2D", dueKey: req.id, recipientIds: [req.task.createdById], pref: null,
      type: "extension_requested", pushEvent: "TASK_EXTENSION_REQUEST", note: `Yêu cầu gia hạn đã chờ ${days} ngày chưa trả lời`,
    }, result);
    if (stage === "SECOND") {
      await send(db, {
        taskId: req.task.id, kind: "EXTENSION_PENDING_4D", dueKey: req.id, recipientIds: await unitLeaderIds(db, req.task.leadUnitId), pref: null,
        type: "escalation", pushEvent: "TASK_ESCALATION", note: `Yêu cầu gia hạn đã chờ ${days} ngày, người giao chưa trả lời`,
      }, result);
    }
  }

  // 4. Từ chối nhận việc chưa được giao lại.
  const declines = await db.taskDeclineNotice.findMany({
    where: { createdAt: { lte: stale, gte: lookbackStart }, task: { ...scope, archivedAt: null, status: TaskStatus.NOT_STARTED } },
    include: { task: { select: { id: true, createdById: true, leadUnitId: true } } },
  });
  for (const notice of declines) {
    const active = await findActiveDecline(notice.taskId);
    if (!active || active.id !== notice.id) continue; // đã giao lại hoặc có thông báo mới hơn
    result.considered++;
    const stage = escalationStage(notice.createdAt, now);
    const days = Math.floor((now.getTime() - notice.createdAt.getTime()) / 86_400_000);
    await send(db, {
      taskId: notice.task.id, kind: "DECLINE_PENDING_2D", dueKey: notice.id, recipientIds: [notice.task.createdById], pref: null,
      type: "declined", pushEvent: "TASK_DECLINED", note: `Người thực hiện đã từ chối nhận việc ${days} ngày trước, chưa giao lại`,
    }, result);
    if (stage === "SECOND") {
      await send(db, {
        taskId: notice.task.id, kind: "DECLINE_PENDING_4D", dueKey: notice.id, recipientIds: await unitLeaderIds(db, notice.task.leadUnitId), pref: null,
        type: "escalation", pushEvent: "TASK_ESCALATION", note: `Nhiệm vụ chưa giao lại sau ${days} ngày kể từ khi bị từ chối nhận`,
      }, result);
    }
  }

  return result;
}
