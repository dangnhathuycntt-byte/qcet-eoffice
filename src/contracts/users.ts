import { z } from 'zod';
import { PaginationQuerySchema } from './common';

/**
 * User query schema.
 */
export const UserQuerySchema = PaginationQuerySchema.extend({
  departmentId: z
    .string()
    .trim()
    .max(64, 'Department ID cannot exceed 64 characters')
    .optional(),
  role: z.string().trim().max(50, 'Role cannot exceed 50 characters').optional(),
  q: z.string().trim().max(200, 'Search query cannot exceed 200 characters').optional(),
  search: z.string().trim().max(200, 'Search query cannot exceed 200 characters').optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type UserQuery = z.infer<typeof UserQuerySchema>;

/**
 * Institutional roles permitted in role elevation / assignment.
 */
export const InstitutionalRoleSchema = z.enum([
  'ADMIN',
  'MANAGER',
  'STAFF',
  'BAN_GIAM_HIEU',
  'TRUONG_PHONG',
  'CHUYEN_VIEN',
  'GIANG_VIEN',
  'VAN_THU',
  'CLERK',
]);

export type InstitutionalRole = z.infer<typeof InstitutionalRoleSchema>;

/**
 * Role update command contract.
 * Strictly prevents modification of arbitrary user fields during role update.
 */
export const UpdateUserRoleSchema = z
  .object({
    role: InstitutionalRoleSchema,
  })
  .strict();

export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleSchema>;

/**
 * Onboarding input contract.
 * Harmonized with src/lib/onboarding-schema.ts, augmented with strict bounds and mass-assignment protection.
 */
export const OnboardingInputSchema = z
  .object({
    hasSeenWelcome: z.boolean().optional(),
    hasCompletedTour: z.boolean().optional(),
    completedSteps: z
      .array(z.string().trim().max(100, 'Step identifier cannot exceed 100 characters'))
      .max(50, 'Cannot record more than 50 completed steps')
      .optional(),
    isDismissed: z.boolean().optional(),
    snoozedUntil: z.string().max(100).nullable().optional(),
  })
  .strict();

export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;

export const UpdateOnboardingSchema = OnboardingInputSchema;
export type UpdateOnboardingInput = OnboardingInput;

/**
 * User profile update command contract.
 * Strictly prevents modification of role, departmentId, isActive, or arbitrary system fields.
 */
export const UpdateUserProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Họ tên phải có ít nhất 2 ký tự").max(100, "Họ tên không quá 100 ký tự").optional(),
    phone: z.string().trim().max(20, "Số điện thoại không quá 20 ký tự").nullable().optional(),
    title: z.string().trim().max(100, "Chức danh không quá 100 ký tự").nullable().optional(),
  })
  .strict();

export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;
