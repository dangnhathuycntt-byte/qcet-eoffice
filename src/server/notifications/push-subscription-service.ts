import type { Prisma } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import {
  DEFAULT_PUSH_PREFERENCES,
  type PushPreferences,
} from "@qcet/shared/lib/pwa/push-preferences";

// Đăng ký push và tùy chọn push của người dùng.
// Client hiện tại POST /api/notifications/push/subscribe trước, chỉ quay về /api/notifications/push khi lỗi mạng
// hoặc 404; /push còn lo tùy chọn và DELETE. Hai URL dùng chung một đường ghi: upsertPushSubscription và
// revokePushSubscriptions.

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

/**
 * Đăng ký hoặc kích hoạt lại theo endpoint: ACTIVE, xóa bộ đếm lỗi và `disabledAt`.
 * Endpoint đã thuộc người khác thì chuyển sang người gọi (thiết bị dùng chung đổi chủ).
 */
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
      disabledAt: null,
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
 * Thu hồi đăng ký của chính người dùng (REVOKED kèm `disabledAt`): theo endpoint, không có
 * endpoint thì tất cả (chỉ DELETE /api/notifications/push cho phép). Endpoint của người khác
 * không bị đụng tới.
 */
export async function revokePushSubscriptions(
  userId: string,
  endpoint: string | null | undefined
) {
  await prisma.pushSubscription.updateMany({
    where: endpoint ? { userId, endpoint } : { userId },
    data: {
      status: "REVOKED",
      disabledAt: new Date(),
    },
  });
}
