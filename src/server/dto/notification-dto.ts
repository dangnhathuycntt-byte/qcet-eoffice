/**
 * Notification Data Transfer Objects (DTOs) & Sanitization Mappers
 *
 * Implements OWASP API3 (Excessive Data Exposure) safeguards.
 * Strips internal user relations, tokens, push subscription hashes,
 * or raw server metadata from notification responses.
 */

export interface NotificationDTO {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationListResponseDTO {
  items: NotificationDTO[];
  unreadCount: number;
  total: number;
}

function toISOStringSafe(val: unknown): string {
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date(0).toISOString() : val.toISOString();
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

/**
 * Maps raw notification entity to NotificationDTO.
 * Returns null if raw notification is null, undefined, or not an object.
 */
export function toNotificationDTO(rawNotif: unknown): NotificationDTO | null {
  if (!rawNotif || typeof rawNotif !== 'object') return null;
  const notif = rawNotif as Record<string, any>;

  return {
    id: String(notif.id ?? ''),
    userId: String(notif.userId ?? ''),
    title: String(notif.title ?? ''),
    message: String(notif.message ?? notif.body ?? ''),
    type: String(notif.type ?? 'general'),
    link: notif.link ?? notif.linkHref ?? null,
    isRead: Boolean(notif.isRead),
    readAt: notif.readAt ? toISOStringSafe(notif.readAt) : null,
    createdAt: toISOStringSafe(notif.createdAt),
  };
}

/**
 * Maps array of raw notifications to NotificationDTO[].
 * Gracefully ignores nulls, undefined, or malformed entries.
 */
export function toNotificationDTOArray(rawNotifs: unknown[]): NotificationDTO[] {
  if (!Array.isArray(rawNotifs)) return [];
  return rawNotifs
    .map(toNotificationDTO)
    .filter((n): n is NotificationDTO => n !== null);
}

/**
 * Creates canonical NotificationListResponseDTO with counts.
 */
export function toNotificationListResponseDTO(
  rawNotifs: unknown[],
  unreadCount?: number,
  total?: number
): NotificationListResponseDTO {
  const items = toNotificationDTOArray(rawNotifs);
  const actualUnreadCount = typeof unreadCount === 'number'
    ? unreadCount
    : items.filter((n) => !n.isRead).length;
  const actualTotal = typeof total === 'number'
    ? total
    : items.length;

  return {
    items,
    unreadCount: actualUnreadCount,
    total: actualTotal,
  };
}
