import { toISOStringSafe } from './dto-helpers';
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
  actorName?: string | null;
  category?: string | null;
  isRead: boolean;
  readAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
}

export interface NotificationListResponseDTO {
  items: NotificationDTO[];
  unreadCount: number;
  total: number;
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
    actorName: typeof notif.actorName === 'string' && notif.actorName.trim() ? notif.actorName.trim() : null,
    category: typeof notif.category === 'string' && notif.category.trim() ? notif.category.trim() : null,
    isRead: Boolean(notif.isRead),
    readAt: notif.readAt ? toISOStringSafe(notif.readAt) : null,
    archivedAt: notif.archivedAt ? toISOStringSafe(notif.archivedAt) : null,
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
