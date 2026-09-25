/**
 * QCET E-Office: Notification Controlled Vocabulary & Category Mapping (WI-7.2 / RFC-07)
 *
 * Implements canonical controlled vocabulary for Notification feed events:
 * - Controlled categories (Task, Document, Meeting, Dossier, System)
 * - Controlled event types aligned with RFC-07 Action Inbox separation and WI-7.4 Domain Events
 * - Bidirectional normalization between legacy strings and canonical vocabulary
 */

import { ValidationError } from '@/server/api/errors';

/**
 * Canonical Notification Categories according to RFC-07
 */
export const NOTIFICATION_CATEGORIES = [
  'TASK_ACTIVITY',
  'DOCUMENT_DISPATCH',
  'MEETING_CALENDAR',
  'DOSSIER_ARCHIVE',
  'SYSTEM_ANNOUNCEMENT',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NotificationCategoryValues = {
  TASK_ACTIVITY: 'TASK_ACTIVITY' as const,
  DOCUMENT_DISPATCH: 'DOCUMENT_DISPATCH' as const,
  MEETING_CALENDAR: 'MEETING_CALENDAR' as const,
  DOSSIER_ARCHIVE: 'DOSSIER_ARCHIVE' as const,
  SYSTEM_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT' as const,
};

/**
 * Canonical Notification Event Types across QCET Domains
 */
export const NOTIFICATION_TYPES = [
  // Task Activity
  'TASK_CREATED',
  'TASK_ASSIGNED',
  'TASK_STATUS_CHANGED',
  'TASK_APPROVED',
  'TASK_REJECTED',
  'TASK_OVERDUE',
  'TASK_REMINDER',
  'DELIVERABLE_SUBMITTED',

  // Document Dispatch
  'DOCUMENT_RECEIVED',
  'DOCUMENT_DIRECTIVE',
  'DOCUMENT_ASSIGNED',
  'DOCUMENT_ISSUED',
  'DOCUMENT_RESOLVED',
  'DOCUMENT_OVERDUE',
  'DOCUMENT_EXPIRING_SOON',

  // Meeting Calendar
  'MEETING_INVITED',
  'MEETING_HELD',
  'MEETING_MINUTES_CONFIRMED',
  'MEETING_CANCELLED',

  // Dossier Archive
  'DOSSIER_CLOSED',
  'DOSSIER_SUBMITTED_ARCHIVE',
  'DOSSIER_ACCEPTED_ARCHIVE',

  // System Announcement
  'SYSTEM_ALERT',
  'SECURITY_ALERT',
  'BROADCAST_ANNOUNCEMENT',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Mapping table from NotificationType to its canonical NotificationCategory
 */
export const TYPE_TO_CATEGORY_MAP: Record<NotificationType, NotificationCategory> = {
  // Task Activity
  TASK_CREATED: 'TASK_ACTIVITY',
  TASK_ASSIGNED: 'TASK_ACTIVITY',
  TASK_STATUS_CHANGED: 'TASK_ACTIVITY',
  TASK_APPROVED: 'TASK_ACTIVITY',
  TASK_REJECTED: 'TASK_ACTIVITY',
  TASK_OVERDUE: 'TASK_ACTIVITY',
  TASK_REMINDER: 'TASK_ACTIVITY',
  DELIVERABLE_SUBMITTED: 'TASK_ACTIVITY',

  // Document Dispatch
  DOCUMENT_RECEIVED: 'DOCUMENT_DISPATCH',
  DOCUMENT_DIRECTIVE: 'DOCUMENT_DISPATCH',
  DOCUMENT_ASSIGNED: 'DOCUMENT_DISPATCH',
  DOCUMENT_ISSUED: 'DOCUMENT_DISPATCH',
  DOCUMENT_RESOLVED: 'DOCUMENT_DISPATCH',
  DOCUMENT_OVERDUE: 'DOCUMENT_DISPATCH',
  DOCUMENT_EXPIRING_SOON: 'DOCUMENT_DISPATCH',

  // Meeting Calendar
  MEETING_INVITED: 'MEETING_CALENDAR',
  MEETING_HELD: 'MEETING_CALENDAR',
  MEETING_MINUTES_CONFIRMED: 'MEETING_CALENDAR',
  MEETING_CANCELLED: 'MEETING_CALENDAR',

  // Dossier Archive
  DOSSIER_CLOSED: 'DOSSIER_ARCHIVE',
  DOSSIER_SUBMITTED_ARCHIVE: 'DOSSIER_ARCHIVE',
  DOSSIER_ACCEPTED_ARCHIVE: 'DOSSIER_ARCHIVE',

  // System Announcement
  SYSTEM_ALERT: 'SYSTEM_ANNOUNCEMENT',
  SECURITY_ALERT: 'SYSTEM_ANNOUNCEMENT',
  BROADCAST_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT',
};

/**
 * Legacy category string normalization mapping
 */
const LEGACY_CATEGORY_MAP: Record<string, NotificationCategory> = {
  task: 'TASK_ACTIVITY',
  tasks: 'TASK_ACTIVITY',
  document: 'DOCUMENT_DISPATCH',
  documents: 'DOCUMENT_DISPATCH',
  meeting: 'MEETING_CALENDAR',
  meetings: 'MEETING_CALENDAR',
  dossier: 'DOSSIER_ARCHIVE',
  dossiers: 'DOSSIER_ARCHIVE',
  system: 'SYSTEM_ANNOUNCEMENT',
  general: 'SYSTEM_ANNOUNCEMENT',
};

/**
 * Checks if a value is a valid canonical NotificationCategory
 */
export function isValidNotificationCategory(value: unknown): value is NotificationCategory {
  return typeof value === 'string' && NOTIFICATION_CATEGORIES.includes(value as NotificationCategory);
}

/**
 * Checks if a value is a valid canonical NotificationType
 */
export function isValidNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && NOTIFICATION_TYPES.includes(value as NotificationType);
}

/**
 * Normalizes an arbitrary category string (including legacy ones) to canonical NotificationCategory
 */
export function normalizeNotificationCategory(raw: unknown): NotificationCategory | null {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  if (isValidNotificationCategory(upper)) {
    return upper;
  }
  const lower = raw.trim().toLowerCase();
  if (LEGACY_CATEGORY_MAP[lower]) {
    return LEGACY_CATEGORY_MAP[lower];
  }
  return null;
}

/**
 * Asserts that a category is valid, throwing a ValidationError if invalid
 */
export function assertNotificationCategory(value: unknown, fieldName = 'category'): NotificationCategory {
  const normalized = normalizeNotificationCategory(value);
  if (!normalized) {
    throw new ValidationError(
      `Danh mục thông báo '${value}' không hợp lệ. Các danh mục được phép: ${NOTIFICATION_CATEGORIES.join(', ')}`,
      { [fieldName]: [`Giá trị phải thuộc: ${NOTIFICATION_CATEGORIES.join(', ')}`] },
      'INVALID_NOTIFICATION_CATEGORY'
    );
  }
  return normalized;
}

/**
 * Asserts that a notification type is valid, throwing a ValidationError if invalid
 */
export function assertNotificationType(value: unknown, fieldName = 'type'): NotificationType {
  if (typeof value !== 'string' || !isValidNotificationType(value.trim().toUpperCase())) {
    throw new ValidationError(
      `Loại thông báo '${value}' không hợp lệ.`,
      { [fieldName]: [`Giá trị không thuộc danh mục loại thông báo được phép.`] },
      'INVALID_NOTIFICATION_TYPE'
    );
  }
  return value.trim().toUpperCase() as NotificationType;
}

/**
 * Resolves the canonical category for a given notification event type
 */
export function getCategoryForNotificationType(type: NotificationType): NotificationCategory {
  return TYPE_TO_CATEGORY_MAP[type] ?? 'SYSTEM_ANNOUNCEMENT';
}

/**
 * Verifies whether a given category and type pair are semantically compatible
 */
export function isValidCategoryTypePair(category: NotificationCategory, type: NotificationType): boolean {
  return TYPE_TO_CATEGORY_MAP[type] === category;
}
