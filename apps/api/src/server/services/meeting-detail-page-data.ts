import prisma from "@qcet/db/prisma";
import { ApiError } from "@/server/api/errors";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { authorizeMeetingRead } from "@/server/services/meeting-service";

// Dữ liệu đọc cho trang chi tiết cuộc họp (GET /api/page-data/meetings/[id], trang src/app/meetings/[id]/page.tsx gọi).
// Đọc cuộc họp một lần rồi kiểm meeting.read bằng authorizeMeetingRead (cùng quy tắc với GET /api/meetings/[id]).

/**
 * Cuộc họp kèm đơn vị, người tạo, người tham dự, kết luận và các thao tác người xem làm được; ngày giờ đã đổi sang ISO.
 * `null` khi không có hoặc `userId` không có quyền đọc (trang trả notFound()).
 */
export async function readMeetingDetailPageData(id: string, userId: string) {
  // Không có người gọi thì không kiểm được quyền, nên không đọc gì.
  if (!userId) return null;

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      // Chỉ để kiểm quyền (thành viên của cơ quan họp), không gửi xuống trang
      body: { select: { memberships: { select: { userId: true } } } },
      unit: { select: { name: true, code: true } },
      // Ảnh đại diện cho cột Thuộc tính / Thành phần của trang chi tiết
      organizer: { select: { name: true, email: true, avatarUrl: true } },
      participants: {
        include: {
          user: { select: { name: true, email: true, avatarUrl: true } },
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

  let availableActions: string[];
  try {
    // Thao tác người xem làm được do máy chủ tính (giao diện không tự đoán theo vai trò): duyệt biên bản chỉ chủ tọa
    availableActions = authorizeMeetingRead(await loadAuthorizationContext(userId), meeting);
  } catch (error) {
    if (error instanceof ApiError && (error.statusCode === 403 || error.statusCode === 404)) return null;
    throw error;
  }

  /* Serialize ---------------------------------------------------------- */
  const { body: _body, ...visible } = meeting;
  const serialized = {
    ...visible,
    availableActions,
    startTime: meeting.startTime.toISOString(),
    endTime: meeting.endTime?.toISOString() ?? null,
    minutesConfirmedAt: meeting.minutesConfirmedAt?.toISOString() ?? null,
    createdAt: meeting.createdAt.toISOString(),
    updatedAt: meeting.updatedAt.toISOString(),
    participants: visible.participants.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    resolutions: visible.resolutions.map((r) => ({
      ...r,
      deadline: r.deadline?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  };

  return serialized;
}
