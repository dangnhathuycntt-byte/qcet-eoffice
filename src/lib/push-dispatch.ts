import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  sendPushNotificationToUser,
  formatTaskPushPayload,
  PushResult,
} from '@/lib/push-service';
import { UserRole } from '@prisma/client';

let pendingBackgroundTasks: Promise<void>[] = [];

/**
 * Safely invokes Next.js 15 `after()` to run non-blocking work after the HTTP response.
 * If executed outside a Next.js request context (e.g. unit tests or scripts),
 * catches the request scope error and executes via an asynchronous microtask.
 */
export function safeAfter(fn: () => Promise<void> | void): void {
  try {
    after(fn);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('outside a request scope') || message.includes('`after`')) {
      const taskPromise = Promise.resolve()
        .then(fn)
        .catch((executionErr) => {
          console.error('[safeAfter test fallback execution error]', executionErr);
        });
      pendingBackgroundTasks.push(taskPromise);
      return;
    }
    throw err;
  }
}

/**
 * Flushes all pending background tasks scheduled via safeAfter fallback.
 * Essential for deterministic assertions in unit/integration tests.
 */
export async function flushSafeAfter(): Promise<void> {
  await Promise.allSettled(pendingBackgroundTasks);
  pendingBackgroundTasks = [];
}

export interface DispatchTaskAssignedParams {
  task: {
    id: string;
    title: string;
    dueDate?: Date | string | null;
    assignees?: Array<{ userId: string }>;
  };
  assigneeId?: string | null;
  actorName?: string | null;
  actorId?: string | null;
}

export interface DispatchTaskAssignedResult {
  notifiedUserIds: string[];
  pushResults: PushResult[];
}

/**
 * Dispatches TASK_ASSIGNED push notification and creates in-app notification records.
 */
export async function dispatchTaskAssignedPush(
  params: DispatchTaskAssignedParams
): Promise<DispatchTaskAssignedResult> {
  const { task, assigneeId, actorName, actorId } = params;
  const start = Date.now();

  try {
    const targetUserIdSet = new Set<string>();

    if (assigneeId) {
      targetUserIdSet.add(assigneeId);
    }

    if (task.assignees && Array.isArray(task.assignees)) {
      for (const a of task.assignees) {
        if (a?.userId) {
          targetUserIdSet.add(a.userId);
        }
      }
    }

    // Query actors from canonical TaskActor model
    if (task.id) {
      try {
        const dbActors = await prisma.taskActor.findMany({
          where: { taskId: task.id, userId: { not: null } },
          select: { userId: true },
        });
        for (const a of dbActors) {
          if (a.userId) {
            targetUserIdSet.add(a.userId);
          }
        }
      } catch (dbErr) {
        // Continue with memory assignees if DB query encounters an issue
        console.warn('[dispatchTaskAssignedPush] DB actor lookup warning:', dbErr);
      }
    }

    const targetUserIds = Array.from(targetUserIdSet);
    if (targetUserIds.length === 0) {
      return { notifiedUserIds: [], pushResults: [] };
    }

    let dueDateStr: string | undefined;
    if (task.dueDate) {
      try {
        dueDateStr = new Intl.DateTimeFormat('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
        }).format(new Date(task.dueDate));
      } catch {
        dueDateStr = undefined;
      }
    }

    const payload = formatTaskPushPayload({
      event: 'TASK_ASSIGNED',
      taskTitle: task.title,
      actorName: actorName || 'Hệ thống',
      dueDateStr,
      taskId: task.id,
    });

    const pushResults: PushResult[] = [];
    const notifiedUserIds: string[] = [];

    for (const userId of targetUserIds) {
      try {
        await prisma.notification.create({
          data: {
            userId,
            actorName: actorName || 'Hệ thống',
            title: payload.title,
            body: payload.body,
            category: 'task',
            type: 'assigned',
            linkHref: payload.data.linkHref,
          },
        });

        const pushRes = await sendPushNotificationToUser(userId, payload);
        pushResults.push(pushRes);
        notifiedUserIds.push(userId);
      } catch (userErr) {
        console.error(`[dispatchTaskAssignedPush] Failed for user ${userId}:`, userErr);
      }
    }

    return { notifiedUserIds, pushResults };
  } catch (error) {
    console.error('[after() Task Push Error]', {
      taskId: task?.id,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    });
    return { notifiedUserIds: [], pushResults: [] };
  }
}

export interface DispatchExecutiveDirectiveParams {
  taskId: string;
  taskTitle: string;
  resolutionType: string;
  directiveNote?: string | null;
  actorName?: string | null;
  actorId?: string | null;
  departmentId?: string | null;
  newOwnerId?: string | null;
}

export interface DispatchExecutiveDirectiveResult {
  notifiedUserIds: string[];
  pushResults: PushResult[];
}

/**
 * Dispatches EXECUTIVE_DIRECTIVE push notification and in-app notification
 * to relevant stakeholders (department head, assignees, new owners) excluding the actor.
 */
export async function dispatchExecutiveDirectivePush(
  params: DispatchExecutiveDirectiveParams
): Promise<DispatchExecutiveDirectiveResult> {
  const {
    taskId,
    taskTitle,
    resolutionType,
    directiveNote,
    actorName,
    actorId,
    departmentId,
    newOwnerId,
  } = params;

  const start = Date.now();

  try {
    const stakeholderUserIds = new Set<string>();

    // 1. Task actors
    try {
      const actors = await prisma.taskActor.findMany({
        where: { taskId, userId: { not: null } },
        select: { userId: true },
      });
      for (const a of actors) {
        if (a.userId) stakeholderUserIds.add(a.userId);
      }
    } catch (e) {
      console.warn('[dispatchExecutiveDirectivePush] Actor lookup error:', e);
    }

    // 2. Department head(s) of task
    if (departmentId) {
      try {
        const deptHeads = await prisma.user.findMany({
          where: {
            departmentId,
            role: UserRole.TRUONG_PHONG,
          },
          select: { id: true },
        });
        for (const h of deptHeads) {
          stakeholderUserIds.add(h.id);
        }
      } catch (e) {
        console.warn('[dispatchExecutiveDirectivePush] Dept head lookup error:', e);
      }
    }

    // 3. New owner if reassigned
    if (newOwnerId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: newOwnerId },
          select: { id: true },
        });
        if (user) {
          stakeholderUserIds.add(user.id);
        } else {
          // Check if newOwnerId is a Department ID
          const deptHeads = await prisma.user.findMany({
            where: {
              departmentId: newOwnerId,
              role: UserRole.TRUONG_PHONG,
            },
            select: { id: true },
          });
          for (const h of deptHeads) {
            stakeholderUserIds.add(h.id);
          }
        }
      } catch (e) {
        console.warn('[dispatchExecutiveDirectivePush] New owner lookup error:', e);
      }
    }

    // Exclude the leader who issued the resolution
    if (actorId) {
      stakeholderUserIds.delete(actorId);
    }

    const targetUserIds = Array.from(stakeholderUserIds);
    if (targetUserIds.length === 0) {
      return { notifiedUserIds: [], pushResults: [] };
    }

    const payload = formatTaskPushPayload({
      event: 'EXECUTIVE_DIRECTIVE',
      taskTitle,
      actorName: actorName || 'Ban Giám Hiệu',
      directiveNote: directiveNote || resolutionType,
      taskId,
    });

    const pushResults: PushResult[] = [];
    const notifiedUserIds: string[] = [];

    for (const userId of targetUserIds) {
      try {
        await prisma.notification.create({
          data: {
            userId,
            actorName: actorName || 'Ban Giám Hiệu',
            title: payload.title,
            body: payload.body,
            category: 'resolution',
            type: 'directive',
            linkHref: payload.data.linkHref,
          },
        });

        const pushRes = await sendPushNotificationToUser(userId, payload);
        pushResults.push(pushRes);
        notifiedUserIds.push(userId);
      } catch (userErr) {
        console.error(`[dispatchExecutiveDirectivePush] Failed for user ${userId}:`, userErr);
      }
    }

    return { notifiedUserIds, pushResults };
  } catch (error) {
    console.error('[after() Executive Directive Push Error]', {
      taskId,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    });
    return { notifiedUserIds: [], pushResults: [] };
  }
}
