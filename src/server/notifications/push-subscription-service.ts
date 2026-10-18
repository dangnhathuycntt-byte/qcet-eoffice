import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PUSH_PREFERENCES,
  type PushPreferences,
} from "@/lib/pwa/push-preferences";

// Đăng ký push và tùy chọn push của người dùng.
// /api/notifications/push và /api/notifications/push/subscribe ghi khác nhau (disabledAt,
// updatedAt, thu hồi tất cả): mỗi route có hàm riêng, không gộp.

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceType: string | null;
  userAgent: string | null;
}

/** Tùy chọn push đã gộp với mặc định và số đăng ký đang hoạt động. */
export async function getPushStatus(userId: string) {
  const [user, activeSubsCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingData: true },
    }),
    prisma.pushSubscription.count({
      where: {
        userId,
        status: "ACTIVE",
      },
    }),
  ]);

  const onboardingData = user?.onboardingData as Record<string, unknown> | null;
  const preferences: PushPreferences = {
    ...DEFAULT_PUSH_PREFERENCES,
    ...((onboardingData?.pushPreferences as Partial<PushPreferences>) || {}),
  };

  return { preferences, subscriptionsCount: activeSubsCount };
}

/** Đọc rồi ghi `onboardingData.pushPreferences` (không trong transaction). */
export async function savePushPreferences(
  userId: string,
  preferences: Partial<PushPreferences>
): Promise<PushPreferences> {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingData: true },
  });

  const currentData =
    existingUser?.onboardingData &&
    typeof existingUser.onboardingData === "object" &&
    !Array.isArray(existingUser.onboardingData)
      ? (existingUser.onboardingData as Record<string, unknown>)
      : {};

  const stored = (currentData.pushPreferences as Partial<PushPreferences> | undefined) ?? {};
  const updatedPrefs: PushPreferences = {
    taskAssigned: Boolean(preferences.taskAssigned ?? true),
    taskReview: Boolean(preferences.taskReview ?? true),
    deadlineReminder: Boolean(preferences.deadlineReminder ?? true),
    documentDirective: Boolean(preferences.documentDirective ?? true),
    // Máy khách cũ không gửi các khóa mới: giữ giá trị đã lưu thay vì đặt lại về bật.
    taskExtension: Boolean(preferences.taskExtension ?? stored.taskExtension ?? true),
    taskDecline: Boolean(preferences.taskDecline ?? stored.taskDecline ?? true),
    unitRequest: Boolean(preferences.unitRequest ?? stored.unitRequest ?? true),
  };

  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingData: {
        ...currentData,
        pushPreferences: updatedPrefs,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return updatedPrefs;
}

/** POST /api/notifications/push: upsert theo endpoint, đặt lại `disabledAt` khi cập nhật. */
export async function upsertPushSubscriptionClearingDisabledAt(
  userId: string,
  { endpoint, p256dh, auth, deviceType, userAgent }: PushSubscriptionInput
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId,
      p256dh,
      auth,
      deviceType: deviceType || null,
      userAgent: userAgent || null,
      status: "ACTIVE",
      failureCount: 0,
      lastFailureCode: null,
      disabledAt: null,
      updatedAt: new Date(),
    },
    create: {
      userId,
      endpoint,
      p256dh,
      auth,
      deviceType: deviceType || null,
      userAgent: userAgent || null,
      status: "ACTIVE",
      failureCount: 0,
    },
  });
}

/** POST /api/notifications/push/subscribe: upsert theo endpoint, không đụng `disabledAt`. */
export async function upsertPushSubscription(
  userId: string,
  { endpoint, p256dh, auth, deviceType, userAgent }: PushSubscriptionInput
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId,
      p256dh,
      auth,
      deviceType: deviceType || null,
      userAgent: userAgent || null,
      status: "ACTIVE",
      failureCount: 0,
      lastFailureCode: null,
      updatedAt: new Date(),
    },
    create: {
      userId,
      endpoint,
      p256dh,
      auth,
      deviceType: deviceType || null,
      userAgent: userAgent || null,
      status: "ACTIVE",
      failureCount: 0,
    },
  });
}

/**
 * DELETE /api/notifications/push: thu hồi đăng ký có endpoint này, không có endpoint thì
 * thu hồi tất cả của người dùng; đặt `disabledAt`.
 */
export async function revokePushSubscriptions(
  userId: string,
  endpoint: string | null | undefined
) {
  if (endpoint) {
    await prisma.pushSubscription.updateMany({
      where: {
        endpoint,
        userId,
      },
      data: {
        status: "REVOKED",
        disabledAt: new Date(),
      },
    });
  } else {
    // Revoke all subscriptions for this user
    await prisma.pushSubscription.updateMany({
      where: {
        userId,
      },
      data: {
        status: "REVOKED",
        disabledAt: new Date(),
      },
    });
  }
}

/** DELETE /api/notifications/push/subscribe: thu hồi theo endpoint, đặt `updatedAt`. */
export async function revokePushSubscriptionByEndpoint(userId: string, endpoint: string) {
  await prisma.pushSubscription.updateMany({
    where: {
      endpoint,
      userId,
    },
    data: {
      status: "REVOKED",
      updatedAt: new Date(),
    },
  });
}
