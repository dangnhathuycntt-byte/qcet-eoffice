import { prisma } from "@/lib/prisma";

// Hồ sơ của chính người đang đăng nhập: đọc, cập nhật thông tin cá nhân, hoàn tất onboarding.

/** Người dùng kèm phân công chính đang hiệu lực (tối đa 1), hoặc `null` khi không có. */
export async function getCurrentUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      // Phase 9: `User.departmentId` dropped — đơn vị canonical là phân công vị trí
      // việc làm chính đang hiệu lực.
      positionAssignments: {
        where: { type: 'PRIMARY', status: 'ACTIVE' },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
        include: {
          unit: { select: { id: true, code: true, name: true } },
          positionDefinition: { select: { code: true, title: true } },
        },
      },
    },
  });
}

/** Chỉ ghi các trường được truyền (khác `undefined`). */
export async function updateCurrentUserProfile(
  userId: string,
  { name, phone, title }: { name?: string; phone?: string | null; title?: string | null }
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(title !== undefined ? { title } : {}),
    },
  });
}

/** Đánh dấu đã onboarding; ghi đè toàn bộ `onboardingData`. */
export async function completeOnboarding(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      onboardedAt: new Date(),
      onboardingData: {
        hasSeenWelcome: true,
        hasCompletedTour: true,
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      onboardedAt: true,
    },
  });
}
