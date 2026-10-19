import { readNotificationEnvelope } from "@/components/inbox/inbox-row";

// Thao tác trên thông báo dùng chung cho khung Hộp thư và trang /inbox.

export type NotificationArchiveRequest = { ids: string[]; archived: boolean } | { scope: "read" | "all" };

/** Lưu trữ / đưa về Hộp thư; máy chủ trả số đã đổi và số chưa đọc mới cho nút Hộp thư. */
export async function archiveNotificationsRequest(body: NotificationArchiveRequest): Promise<{ count: number; unreadCount: number }> {
  const res = await fetch("/api/notifications/archive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = await readNotificationEnvelope(res);
  return { count: Number(json.count) || 0, unreadCount: Number(json.unreadCount) || 0 };
}

export async function setNotificationReadRequest(id: string, isRead: boolean): Promise<void> {
  await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ isRead }),
  }).then(readNotificationEnvelope);
}
