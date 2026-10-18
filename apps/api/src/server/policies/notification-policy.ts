import type { AuthenticatedUser } from '@/server/api/request-context';

export interface NotificationEntity {
  id: string;
  userId: string;
  [key: string]: any;
}

/**
 * Checks if user can read the specified notification.
 * Strictly enforces OWASP API1 (BOLA): Notifications are private to the recipient.
 */
export function canReadNotification(
  user: AuthenticatedUser,
  notification: NotificationEntity
): boolean {
  if (!user || !user.id || !notification || !notification.userId) {
    return false;
  }
  return notification.userId === user.id;
}
