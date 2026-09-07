import * as webpush from "web-push";
import { prisma } from "@/lib/prisma";

export type TaskPushEventType =
  | "TASK_ASSIGNED"
  | "DELIVERABLE_SUBMITTED"
  | "DELIVERABLE_APPROVED"
  | "DELIVERABLE_REVISION"
  | "DEADLINE_WARNING_24H"
  | "EXECUTIVE_DIRECTIVE";

export interface TaskPushInput {
  event: TaskPushEventType;
  taskId: string;
  taskTitle: string;
  actorName: string;
  dueDateStr?: string;
  directiveNote?: string;
  linkHref?: string;
}

export interface PushNotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag: string;
  renotify?: boolean;
  data: {
    linkHref: string;
    taskId?: string;
    event?: string;
    [key: string]: unknown;
  };
  actions?: PushNotificationAction[];
}

export interface PushResultDetail {
  endpoint: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

export interface PushResult {
  success: boolean;
  totalSubscriptions: number;
  sentCount: number;
  failedCount: number;
  revokedCount: number;
  details: PushResultDetail[];
}

export type PushSender = (
  subscription: webpush.PushSubscription,
  payload?: string | Buffer | null,
  options?: webpush.RequestOptions
) => Promise<webpush.SendResult>;

let activePushSender: PushSender = (sub, p, opts) => webpush.sendNotification(sub, p, opts);

/**
 * Override the push notification sender (useful for testing and deterministic mocks).
 */
export function setPushSenderForTesting(sender: PushSender | null): void {
  if (sender) {
    activePushSender = sender;
  } else {
    activePushSender = (sub, p, opts) => webpush.sendNotification(sub, p, opts);
  }
}

// Fallback deterministic keys for testing and development environments
const FALLBACK_VAPID_PUBLIC_KEY =
  "BEKF42_wI0u1qzKMAQhGVUIavbocDLKDifh2GLfPCI5PgJxGO14b2ip5NwXUswFnWBwwkbAbfTMR3LGxC2SYAZs";
const FALLBACK_VAPID_PRIVATE_KEY =
  "OPNPWoAtL4ELRvkkUI184i0leP51nj8IgilmoDsJKs8";
const DEFAULT_VAPID_SUBJECT = "mailto:admin@qcet.edu.vn";

let isVapidConfigured = false;

function ensureVapidConfigured(): { publicKey: string; privateKey: string; subject: string } {
  let publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || FALLBACK_VAPID_PUBLIC_KEY;
  let privateKey = process.env.VAPID_PRIVATE_KEY || FALLBACK_VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT;

  if (!isVapidConfigured) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      isVapidConfigured = true;
    } catch (err) {
      // In case the configured keys are malformed, fallback to deterministic keys
      console.warn("Invalid VAPID credentials in environment. Falling back to test keys.", err);
      publicKey = FALLBACK_VAPID_PUBLIC_KEY;
      privateKey = FALLBACK_VAPID_PRIVATE_KEY;
      webpush.setVapidDetails(DEFAULT_VAPID_SUBJECT, publicKey, privateKey);
      isVapidConfigured = true;
    }
  }

  return { publicKey, privateKey, subject };
}

/**
 * Returns the public VAPID key to be consumed by client-side service worker registration.
 */
export function getVapidPublicKey(): string {
  const { publicKey } = ensureVapidConfigured();
  return publicKey;
}

/**
 * Strict character budget truncator for lock-screen push notifications.
 * Ensures the output string is at most maxChars long and ends with an ellipsis if truncated.
 */
export function truncatePushText(text: string, maxChars: number): string {
  if (!text) return "";
  if (maxChars <= 0) return "";
  if (text.length <= maxChars) return text;
  if (maxChars === 1) return "…";

  const truncated = text.slice(0, maxChars - 1).trimEnd();
  return `${truncated}…`;
}

/**
 * Formats a standardized Vietnamese push notification payload adhering to the
 * lock screen budget (Title <= 35 chars, Body <= 90 chars).
 */
export function formatTaskPushPayload(input: TaskPushInput): PushNotificationPayload {
  const { event, taskId, taskTitle, actorName, dueDateStr, directiveNote, linkHref } = input;

  let rawTitle = "";
  let rawBody = "";
  let eventShort = "task";

  switch (event) {
    case "TASK_ASSIGNED": {
      eventShort = "assign";
      rawTitle = `[GIAO VIỆC] ${taskTitle}`;
      rawBody = dueDateStr
        ? `${actorName} vừa giao việc: "${taskTitle}". Hạn: ${dueDateStr}`
        : `${actorName} vừa giao việc: "${taskTitle}"`;
      break;
    }
    case "DELIVERABLE_SUBMITTED": {
      eventShort = "submit";
      rawTitle = `[NỘP DUYỆT] ${taskTitle}`;
      rawBody = `${actorName} đã gửi sản phẩm kết quả cần duyệt`;
      break;
    }
    case "DELIVERABLE_APPROVED": {
      eventShort = "approve";
      rawTitle = `[ĐÃ DUYỆT] ${taskTitle}`;
      rawBody = `${actorName} đã phê duyệt sản phẩm công việc`;
      break;
    }
    case "DELIVERABLE_REVISION": {
      eventShort = "revision";
      rawTitle = `[YÊU CẦU SỬA] ${taskTitle}`;
      rawBody = `${actorName} yêu cầu chỉnh sửa/bổ sung sản phẩm`;
      break;
    }
    case "DEADLINE_WARNING_24H": {
      eventShort = "deadline";
      rawTitle = `[SẮP HẾT HẠN] ${taskTitle}`;
      rawBody = dueDateStr
        ? `Còn 24 giờ đến hạn hoàn thành: ${dueDateStr}`
        : "Còn 24 giờ đến hạn hoàn thành công việc";
      break;
    }
    case "EXECUTIVE_DIRECTIVE": {
      eventShort = "directive";
      rawTitle = `[CHỈ ĐẠO BGH] ${taskTitle}`;
      rawBody = directiveNote
        ? `${actorName}: "${directiveNote}"`
        : `${actorName} đã ban hành chỉ đạo điều hành`;
      break;
    }
    default: {
      eventShort = (event as string).toLowerCase();
      rawTitle = `[THÔNG BÁO] ${taskTitle}`;
      rawBody = `${actorName} vừa cập nhật công việc`;
      break;
    }
  }

  const title = truncatePushText(rawTitle, 35);
  const body = truncatePushText(rawBody, 90);
  const tag = `task-${taskId}-${eventShort}`;
  const targetHref = linkHref || `/portal?task=${encodeURIComponent(taskId)}`;

  return {
    title,
    body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag,
    renotify: true,
    data: {
      linkHref: targetHref,
      taskId,
      event,
    },
    actions: [
      {
        action: "open",
        title: "Xem ngay",
      },
    ],
  };
}

/**
 * Dispatches a push notification to all active devices/subscriptions of a user.
 * Self-healing: if an endpoint returns 404 Not Found or 410 Gone, marks subscription as REVOKED.
 */
export async function sendPushNotificationToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<PushResult> {
  ensureVapidConfigured();

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId,
      status: "ACTIVE",
    },
  });

  if (subscriptions.length === 0) {
    return {
      success: true,
      totalSubscriptions: 0,
      sentCount: 0,
      failedCount: 0,
      revokedCount: 0,
      details: [],
    };
  }

  let sentCount = 0;
  let failedCount = 0;
  let revokedCount = 0;
  const details: PushResultDetail[] = [];

  const notificationPayload = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await activePushSender(
          pushSubscription,
          notificationPayload,
          {
            TTL: 86400,
            urgency: "high",
          }
        );

        sentCount++;
        details.push({
          endpoint: sub.endpoint,
          success: true,
          statusCode: 200,
        });

        if (sub.failureCount > 0) {
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: {
              failureCount: 0,
              lastFailureCode: null,
            },
          }).catch(() => {});
        }
      } catch (err: unknown) {
        const errorObj = err as { statusCode?: number; status?: number; message?: string };
        const statusCode =
          errorObj?.statusCode ||
          (typeof errorObj?.status === "number" ? errorObj.status : undefined);
        const isGone = statusCode === 404 || statusCode === 410;

        if (isGone) {
          revokedCount++;
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: {
              status: "REVOKED",
              lastFailureCode: statusCode,
            },
          }).catch(() => {});
        } else {
          failedCount++;
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: {
              failureCount: { increment: 1 },
              lastFailureCode: statusCode ?? 500,
            },
          }).catch(() => {});
        }

        details.push({
          endpoint: sub.endpoint,
          success: false,
          statusCode,
          error: errorObj?.message || String(err),
        });
      }
    })
  );

  return {
    success: sentCount > 0 || subscriptions.length === 0,
    totalSubscriptions: subscriptions.length,
    sentCount,
    failedCount,
    revokedCount,
    details,
  };
}

