import { z } from 'zod';
import { PaginationQuerySchema } from './common';

/**
 * Notification query filtering schema with boolean coercion for read status.
 */
export const NotificationQuerySchema = PaginationQuerySchema.extend({
  read: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        const lower = val.trim().toLowerCase();
        if (lower === 'true' || lower === '1') return true;
        if (lower === 'false' || lower === '0') return false;
      }
      return val;
    }, z.boolean())
    .optional(),
  type: z.string().trim().max(50, 'Type cannot exceed 50 characters').optional(),
});

export type NotificationQuery = z.infer<typeof NotificationQuerySchema>;

/**
 * Push subscription keys schema.
 */
export const PushSubscriptionKeysSchema = z
  .object({
    p256dh: z
      .string()
      .trim()
      .min(1, 'p256dh key is required')
      .max(255, 'p256dh key cannot exceed 255 characters'),
    auth: z
      .string()
      .trim()
      .min(1, 'auth key is required')
      .max(255, 'auth key cannot exceed 255 characters'),
  })
  .strict();

export type PushSubscriptionKeys = z.infer<typeof PushSubscriptionKeysSchema>;

/**
 * Web Push subscription contract.
 * Strictly checks endpoint URL and bounds key sizes.
 */
export const SubscribePushSchema = z
  .object({
    endpoint: z
      .string()
      .trim()
      .url('Push endpoint must be a valid URL')
      .max(1024, 'Endpoint cannot exceed 1024 characters'),
    keys: PushSubscriptionKeysSchema,
    deviceType: z
      .string()
      .trim()
      .max(50, 'Device type cannot exceed 50 characters')
      .optional()
      .nullable(),
    userAgent: z
      .string()
      .trim()
      .max(500, 'User agent cannot exceed 500 characters')
      .optional()
      .nullable(),
  })
  .strict();

export type SubscribePushInput = z.infer<typeof SubscribePushSchema>;

/**
 * Test push notification contract.
 */
export const TestPushSchema = z
  .object({
    title: z
      .string()
      .trim()
      .max(100, 'Title cannot exceed 100 characters')
      .optional(),
    body: z
      .string()
      .trim()
      .max(255, 'Body cannot exceed 255 characters')
      .optional(),
  })
  .strict();

export type TestPushInput = z.infer<typeof TestPushSchema>;
