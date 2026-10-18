import prisma from "@/lib/prisma";

// Dữ liệu đọc cho trang chi tiết cuộc họp (src/app/calendar/meetings/[id]/page.tsx).
// Giữ nguyên truy vấn của trang: không kiểm meeting.read ở đây (trang chỉ yêu cầu đăng nhập).

export async function readMeetingTitle(id: string): Promise<string | null> {
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: { title: true },
  });

  return meeting?.title ?? null;
}

/** Cuộc họp kèm đơn vị, người tổ chức, người tham dự, kết luận; ngày giờ đã đổi sang ISO. `null` khi không có. */
export async function readMeetingDetailPageData(id: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      unit: { select: { name: true, code: true } },
      organizer: { select: { name: true, email: true } },
      participants: {
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { role: "asc" },
      },
      resolutions: {
        include: {
          leadUnit: { select: { name: true } },
          leadUser: { select: { name: true } },
        },
        orderBy: { code: "asc" },
      },
    },
  });

  if (!meeting) return null;

  /* Serialize ---------------------------------------------------------- */
  const serialized = {
    ...meeting,
    startTime: meeting.startTime.toISOString(),
    endTime: meeting.endTime?.toISOString() ?? null,
    minutesConfirmedAt: meeting.minutesConfirmedAt?.toISOString() ?? null,
    createdAt: meeting.createdAt.toISOString(),
    updatedAt: meeting.updatedAt.toISOString(),
    participants: meeting.participants.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    resolutions: meeting.resolutions.map((r) => ({
      ...r,
      deadline: r.deadline?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  };

  return serialized;
}
