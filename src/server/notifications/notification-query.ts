import type { Prisma } from "@prisma/client";
import { getTriageTypes, type NotificationTriageTab } from "@qcet/shared/lib/notification-triage";

// Truy vấn danh sách thông báo phía server: con trỏ phân trang và bộ lọc Prisma.

export function encodeNotificationCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

export function decodeNotificationCursor(
  cursor: string | null | undefined
): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const sep = cursor.indexOf("|");
  if (sep <= 0) return null;
  const createdAt = new Date(cursor.slice(0, sep));
  const id = cursor.slice(sep + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
}

export interface NotificationWhereInput {
  userId: string;
  unreadOnly?: boolean;
  read?: boolean;
  category?: string;
  type?: string;
  triage?: NotificationTriageTab;
  q?: string;
  cursor?: string | null;
}

/** Tập lọc của danh sách; `withCursor=false` dùng để đếm tổng khớp bộ lọc. */
export function buildNotificationWhere(
  input: NotificationWhereInput,
  withCursor = true
): Prisma.NotificationWhereInput {
  const and: Prisma.NotificationWhereInput[] = [];

  if (input.triage && input.triage !== "all") {
    const types = getTriageTypes(input.triage);
    const variants = [...new Set([...types, ...types.map((t) => t.toUpperCase())])];
    const byType: Prisma.NotificationWhereInput = { type: { in: variants } };
    and.push(
      input.triage === "action_required"
        ? { OR: [byType, { category: { equals: "action", mode: "insensitive" } }] }
        : byType
    );
  }

  const q = input.q?.trim();
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { body: { contains: q, mode: "insensitive" } },
        { actorName: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const cursor = withCursor ? decodeNotificationCursor(input.cursor) : null;
  if (cursor) {
    and.push({
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    });
  }

  return {
    userId: input.userId,
    ...(input.unreadOnly === true || input.read === false
      ? { isRead: false }
      : input.read === true
        ? { isRead: true }
        : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}
