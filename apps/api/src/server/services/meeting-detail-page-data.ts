import prisma from "@qcet/db/prisma";
import { ApiError } from "@/server/api/errors";
import { MeetingService } from "@/server/services/meeting-service";

// Dữ liệu đọc cho trang chi tiết cuộc họp (GET /api/page-data/meetings/[id], trang src/app/calendar/meetings/[id]/page.tsx gọi).
// Kiểm meeting.read qua MeetingService.getMeeting (cùng quy tắc với GET /api/meetings/[id]) trước khi đọc.

/**
 * Cuộc họp kèm đơn vị, người tổ chức, người tham dự, kết luận; ngày giờ đã đổi sang ISO.
 * `null` khi không có hoặc `userId` không có quyền đọc (trang trả notFound()).
 */
export async function readMeetingDetailPageData(id: string, userId: string) {
  // getMeeting bỏ qua kiểm quyền khi không có người gọi, nên không có userId thì không đọc gì.
  if (!userId) return null;
  try {
    await MeetingService.getMeeting(id, userId);
  } catch (error) {
    if (error instanceof ApiError && (error.statusCode === 403 || error.statusCode === 404)) return null;
    throw error;
  }

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
