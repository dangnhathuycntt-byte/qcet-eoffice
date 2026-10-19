import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '@qcet/db/prisma';
import type { NotificationQuerySchema } from '@qcet/contracts/notifications';
import {
  buildNotificationWhere,
  decodeNotificationCursor,
  encodeNotificationCursor,
} from '@/server/notifications/notification-query';

// Hộp thư thông báo của người dùng: đọc danh sách, tra một thông báo, đánh dấu đã đọc, lưu trữ.

/** Một trang thông báo cùng số chưa đọc và tổng khớp bộ lọc. */
export async function listNotificationsForUser(
  userId: string,
  validatedQuery: z.infer<typeof NotificationQuerySchema>
) {
  const filter = {
    userId,
    unreadOnly: validatedQuery.unreadOnly,
    read: validatedQuery.read,
    archived: validatedQuery.archived,
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
    countUnreadNotifications(userId),
    prisma.notification.count({ where: buildNotificationWhere(filter, false) }),
  ]);

  const hasMore = rows.length > validatedQuery.pageSize;
  const notifications = hasMore ? rows.slice(0, validatedQuery.pageSize) : rows;
  const last = notifications[notifications.length - 1];
  const nextCursor = hasMore && last ? encodeNotificationCursor(last.createdAt, last.id) : null;

  return { notifications, unreadCount, filteredTotal, hasMore, nextCursor };
}

/** Số chưa đọc của nút Hộp thư: chỉ tính thông báo còn trong Hộp thư. */
export function countUnreadNotifications(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false, archivedAt: null } });
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

export type NotificationArchiveTarget = { ids: string[]; archived: boolean } | { scope: 'read' | 'all' };

/**
 * Lưu trữ như Notion: thông báo rời Hộp thư và được đánh dấu đã đọc (giữ `readAt` cũ nếu đã đọc); bỏ lưu trữ chỉ đưa về Hộp thư.
 * Mọi điều kiện đều kèm `userId` nên mã của người khác không bị đụng tới (đếm 0), không lộ thông báo có tồn tại hay không.
 */
export async function archiveNotifications(userId: string, target: NotificationArchiveTarget) {
  const now = new Date();
  if ('ids' in target && !target.archived) {
    const result = await prisma.notification.updateMany({
      where: { userId, id: { in: target.ids }, archivedAt: { not: null } },
      data: { archivedAt: null },
    });
    return result.count;
  }
  if ('scope' in target && target.scope === 'read') {
    const result = await prisma.notification.updateMany({ where: { userId, archivedAt: null, isRead: true }, data: { archivedAt: now } });
    return result.count;
  }
  const scope: Prisma.NotificationWhereInput = 'ids' in target ? { userId, id: { in: target.ids }, archivedAt: null } : { userId, archivedAt: null };
  const [, archived] = await prisma.$transaction([
    prisma.notification.updateMany({ where: { ...scope, isRead: false }, data: { isRead: true, readAt: now } }),
    prisma.notification.updateMany({ where: scope, data: { archivedAt: now } }),
  ]);
  return archived.count;
}
