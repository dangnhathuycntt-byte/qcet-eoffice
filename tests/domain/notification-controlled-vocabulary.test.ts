/**
 * Test Suite: Notification Controlled Vocabulary & Category Mapping (WI-7.2 / RFC-07)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES,
  NotificationCategoryValues,
  isValidNotificationCategory,
  isValidNotificationType,
  normalizeNotificationCategory,
  assertNotificationCategory,
  assertNotificationType,
  getCategoryForNotificationType,
  isValidCategoryTypePair,
} from '@/domain/notifications';
import { ValidationError } from '@/server/api/errors';

describe('WI-7.2: Notification Controlled Vocabulary (RFC-07)', () => {
  describe('1. Canonical Categories & Types Definition', () => {
    it('defines 5 canonical notification categories', () => {
      assert.deepStrictEqual(NOTIFICATION_CATEGORIES, [
        'TASK_ACTIVITY',
        'DOCUMENT_DISPATCH',
        'MEETING_CALENDAR',
        'DOSSIER_ARCHIVE',
        'SYSTEM_ANNOUNCEMENT',
      ]);
    });

    it('defines canonical types spanning 4 core domains plus system', () => {
      // Task domain
      assert.ok(NOTIFICATION_TYPES.includes('TASK_CREATED'));
      assert.ok(NOTIFICATION_TYPES.includes('TASK_ASSIGNED'));
      assert.ok(NOTIFICATION_TYPES.includes('TASK_APPROVED'));

      // Document domain
      assert.ok(NOTIFICATION_TYPES.includes('DOCUMENT_RECEIVED'));
      assert.ok(NOTIFICATION_TYPES.includes('DOCUMENT_DIRECTIVE'));
      assert.ok(NOTIFICATION_TYPES.includes('DOCUMENT_ISSUED'));

      // Meeting domain
      assert.ok(NOTIFICATION_TYPES.includes('MEETING_INVITED'));
      assert.ok(NOTIFICATION_TYPES.includes('MEETING_HELD'));
      assert.ok(NOTIFICATION_TYPES.includes('MEETING_MINUTES_CONFIRMED'));

      // Dossier domain
      assert.ok(NOTIFICATION_TYPES.includes('DOSSIER_CLOSED'));
      assert.ok(NOTIFICATION_TYPES.includes('DOSSIER_SUBMITTED_ARCHIVE'));
      assert.ok(NOTIFICATION_TYPES.includes('DOSSIER_ACCEPTED_ARCHIVE'));

      // System
      assert.ok(NOTIFICATION_TYPES.includes('SYSTEM_ALERT'));
    });
  });

  describe('2. Validation & Normalization Functions', () => {
    it('isValidNotificationCategory verifies valid and invalid values', () => {
      assert.strictEqual(isValidNotificationCategory('TASK_ACTIVITY'), true);
      assert.strictEqual(isValidNotificationCategory('DOCUMENT_DISPATCH'), true);
      assert.strictEqual(isValidNotificationCategory('UNKNOWN_CAT'), false);
      assert.strictEqual(isValidNotificationCategory(null), false);
    });

    it('isValidNotificationType verifies valid and invalid types', () => {
      assert.strictEqual(isValidNotificationType('TASK_APPROVED'), true);
      assert.strictEqual(isValidNotificationType('DOCUMENT_ISSUED'), true);
      assert.strictEqual(isValidNotificationType('RANDOM_EVENT'), false);
      assert.strictEqual(isValidNotificationType(123), false);
    });

    it('normalizeNotificationCategory handles uppercase, lowercase, and legacy strings', () => {
      assert.strictEqual(normalizeNotificationCategory('TASK_ACTIVITY'), 'TASK_ACTIVITY');
      assert.strictEqual(normalizeNotificationCategory('task_activity'), 'TASK_ACTIVITY');

      // Legacy normalization
      assert.strictEqual(normalizeNotificationCategory('task'), 'TASK_ACTIVITY');
      assert.strictEqual(normalizeNotificationCategory('document'), 'DOCUMENT_DISPATCH');
      assert.strictEqual(normalizeNotificationCategory('meeting'), 'MEETING_CALENDAR');
      assert.strictEqual(normalizeNotificationCategory('dossier'), 'DOSSIER_ARCHIVE');
      assert.strictEqual(normalizeNotificationCategory('system'), 'SYSTEM_ANNOUNCEMENT');

      assert.strictEqual(normalizeNotificationCategory('invalid_val'), null);
      assert.strictEqual(normalizeNotificationCategory(null), null);
    });

    it('assertNotificationCategory returns normalized category or throws ValidationError', () => {
      assert.strictEqual(assertNotificationCategory('task'), 'TASK_ACTIVITY');

      assert.throws(
        () => assertNotificationCategory('INVALID_CATEGORY'),
        (err: any) => {
          assert.ok(err instanceof ValidationError);
          assert.strictEqual(err.code, 'INVALID_NOTIFICATION_CATEGORY');
          return true;
        }
      );
    });

    it('assertNotificationType returns validated type or throws ValidationError', () => {
      assert.strictEqual(assertNotificationType('task_created'), 'TASK_CREATED');

      assert.throws(
        () => assertNotificationType('INVALID_TYPE'),
        (err: any) => {
          assert.ok(err instanceof ValidationError);
          assert.strictEqual(err.code, 'INVALID_NOTIFICATION_TYPE');
          return true;
        }
      );
    });
  });

  describe('3. Category-Type Relationship & Compatibility', () => {
    it('getCategoryForNotificationType resolves correct parent category', () => {
      assert.strictEqual(getCategoryForNotificationType('TASK_CREATED'), 'TASK_ACTIVITY');
      assert.strictEqual(getCategoryForNotificationType('DOCUMENT_DIRECTIVE'), 'DOCUMENT_DISPATCH');
      assert.strictEqual(getCategoryForNotificationType('MEETING_INVITED'), 'MEETING_CALENDAR');
      assert.strictEqual(getCategoryForNotificationType('DOSSIER_ARCHIVED' as any), 'SYSTEM_ANNOUNCEMENT');
      assert.strictEqual(getCategoryForNotificationType('DOSSIER_ACCEPTED_ARCHIVE'), 'DOSSIER_ARCHIVE');
    });

    it('isValidCategoryTypePair returns true for matched pairs and false for mismatches', () => {
      assert.strictEqual(isValidCategoryTypePair('TASK_ACTIVITY', 'TASK_APPROVED'), true);
      assert.strictEqual(isValidCategoryTypePair('DOCUMENT_DISPATCH', 'DOCUMENT_RECEIVED'), true);
      assert.strictEqual(isValidCategoryTypePair('TASK_ACTIVITY', 'DOCUMENT_RECEIVED'), false);
      assert.strictEqual(isValidCategoryTypePair('MEETING_CALENDAR', 'DOSSIER_CLOSED'), false);
    });
  });
});
