import { prisma } from "@qcet/db/prisma";
import { getAuditActionLabel } from "@qcet/shared/lib/tasks/activity-feed-aggregator";
import type { RawTaskEntity } from "@/server/tasks/task-detail-context";

// Dữ liệu đọc cho trang chi tiết nhiệm vụ (src/app/tasks/[id]/page.tsx).
// Trang gọi hàm này sau khi đã xác thực và resolveTaskDetailContext cho phép hiển thị.

function formatAuditDescription(event: {
  action: string;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
}): string | undefined {
  const after = event.afterData as Record<string, any> | null;
  const before = event.beforeData as Record<string, any> | null;
  const meta = event.metadata as Record<string, any> | null;

  if (after?.triggerReason) return String(after.triggerReason);
  if (meta?.triggerReason) return String(meta.triggerReason);

  switch (event.action) {
    case "TASK_CREATED":
      return "Tạo mới nhiệm vụ";
    case "TASK_STATUS_CHANGED": {
      const statusMap: Record<string, string> = {
        NOT_STARTED: "Chưa thực hiện",
        IN_PROGRESS: "Đang thực hiện",
        WAITING_APPROVAL: "Chờ duyệt",
        COMPLETED: "Hoàn thành",
        CANCELLED: "Đã hủy",
      };
      const statusText = after?.status ? (statusMap[after.status] || after.status) : "";
      const reason = after?.reason ? ` (Lý do: ${after.reason})` : "";
      const note = after?.note ? ` - ${after.note}` : "";
      return statusText ? `Chuyển trạng thái sang "${statusText}"${reason}${note}` : after?.note || undefined;
    }
    case "TASK_APPROVED":
      return after?.note ? `Nghiệm thu nhiệm vụ: ${after.note}` : "Nghiệm thu và hoàn thành nhiệm vụ";
    case "TASK_REJECTED":
      return after?.reason || after?.note ? `Yêu cầu làm lại: ${after.reason || after.note}` : "Yêu cầu làm lại";
    case "TASK_DEADLINE_CHANGED":
      return "Điều chỉnh thời hạn hoàn thành";
    case "TASK_START_DATE_CHANGED":
      return "Điều chỉnh ngày bắt đầu";
    case "TASK_ASSIGNED":
      return after?.note ? `Phân công nhiệm vụ: ${after.note}` : "Phân công người phụ trách";
    case "DELIVERABLE_SUBMITTED":
      return after?.title ? `Nộp minh chứng: ${after.title}` : "Nộp tài liệu minh chứng";
    case "TASK_DELIVERABLE_DELETED":
      return before?.title ? `Xóa minh chứng: ${before.title}` : "Xóa tài liệu minh chứng";
    case "DELIVERABLE_REVIEWED":
      return after?.note || after?.reviewNote ? `Đánh giá minh chứng: ${after.note || after.reviewNote}` : "Đánh giá minh chứng";
    case "TASK_REMINDED":
      return after?.message ? `Nhắc nhở: ${after.message}` : "Gửi thông báo nhắc việc";
    case "TASK_UPDATED": {
      if (after?.note) return String(after.note);
      if (after?.progressPercent !== undefined && before?.progressPercent !== after?.progressPercent) {
        return `Cập nhật tiến độ thành ${after.progressPercent}%`;
      }
      if (after?.title && before?.title && after.title !== before.title) {
        return `Đổi tiêu đề: "${after.title}"`;
      }
      if (after?.description !== undefined && before?.description !== after.description) {
        return "Cập nhật nội dung mô tả nhiệm vụ";
      }
      return "Cập nhật thông tin nhiệm vụ";
    }
    default:
      return after?.note || after?.reason || getAuditActionLabel(event.action);
  }
}

/**
 * Lịch sử hoạt động của nhiệm vụ: audit_events của nhiệm vụ (100 mục mới nhất),
 * tên người thực hiện, cộng chỉ đạo/kết luận của nhiệm vụ; xếp mới nhất trước.
 */
export async function loadTaskDetailAuditEvents(id: string, rawTask: RawTaskEntity) {
  // 1. Fetch audit events from audit_events table
  const dbAuditEvents = await prisma.auditEvent.findMany({
    where: {
      entityType: { in: ["Task", "TASK", "task"] },
      entityId: id,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // 2. Join User to resolve actor names
  const actorIds = Array.from(
    new Set(
      dbAuditEvents
        .map((ev) => ev.actorId)
        .filter((actorId): actorId is string => Boolean(actorId))
    )
  );

  const actorUsers =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
  const actorMap = new Map(actorUsers.map((u) => [u.id, u.name]));

  const mappedAuditEvents = dbAuditEvents.map((ev) => ({
    id: ev.id,
    action: ev.action,
    timestamp: ev.createdAt ? ev.createdAt.toISOString() : new Date().toISOString(),
    actorName: (ev.actorId ? actorMap.get(ev.actorId) : undefined) || "Người điều hành",
    actorId: ev.actorId || undefined,
    description: formatAuditDescription(ev),
  }));

  // 3. Extract audit events from resolutions if present
  const resolutionEvents = ((rawTask as any).executiveResolutions || rawTask.resolutions || []).map((res: any) => ({
    id: `res-${res.id}`,
    action: res.resolutionType || "DIRECTIVE",
    timestamp: res.createdAt ? res.createdAt.toISOString() : new Date().toISOString(),
    actorName: res.actor?.name || "Người điều hành",
    actorId: res.actorId || undefined,
    description: res.directiveNote || undefined,
  }));

  // 4. Combine and sort descending by timestamp
  const combinedAuditEvents = [...mappedAuditEvents, ...resolutionEvents].sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return tB - tA;
  });

  return combinedAuditEvents;
}
