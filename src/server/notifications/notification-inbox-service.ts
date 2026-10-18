import type { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { NotificationQuerySchema } from '@/contracts/notifications';
import {
  buildNotificationWhere,
  decodeNotificationCursor,
  encodeNotificationCursor,
} from '@/server/notifications/notification-query';

// Hộp thư thông báo của người dùng: đọc danh sách, tra một thông báo, đánh dấu đã đọc.

/** Một trang thông báo cùng số chưa đọc và tổng khớp bộ lọc. */
export async function listNotificationsForUser(
  userId: string,
  validatedQuery: z.infer<typeof NotificationQuerySchema>
) {
  const filter = {
    userId,
    unreadOnly: validatedQuery.unreadOnly,
    read: validatedQuery.read,
    category: validatedQuery.category,
    type: validatedQuery.type,
    triage: validatedQuery.triage,
    q: validatedQuery.q,
    cursor: validatedQuery.cursor,
  };
  const usesCursor = Boolean(decodeNotificationCursor(validatedQuery.cursor));

  const [rows, unreadCount, filteredTotal] = await Promise.all([
    prisma.notification.findMany({
      where: buildNotificationWhere(filter),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: validatedQuery.pageSize + 1,
      skip: usesCursor ? 0 : (validatedQuery.page - 1) * validatedQuery.pageSize,
    }),
    prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    }),
    prisma.notification.count({ where: buildNotificationWhere(filter, false) }),
  ]);

  const hasMore = rows.length > validatedQuery.pageSize;
  const notifications = hasMore ? rows.slice(0, validatedQuery.pageSize) : rows;
  const last = notifications[notifications.length - 1];
  const nextCursor = hasMore && last ? encodeNotificationCursor(last.createdAt, last.id) : null;

  return { notifications, unreadCount, filteredTotal, hasMore, nextCursor };
}

export async function findNotificationById(id: string) {
  return prisma.notification.findUnique({ where: { id } });
}

export async function setNotificationReadState(id: string, isReadTarget: boolean) {
  return prisma.notification.update({
    where: { id },
    data: {
      isRead: isReadTarget,
      readAt: isReadTarget ? new Date() : null,
    },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}
