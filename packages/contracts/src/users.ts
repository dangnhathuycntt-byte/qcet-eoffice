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

/** Người dùng rút gọn và đơn vị trong response API (dùng chung FE/BE). */
export interface UserSummaryDTO {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}

export interface UserDepartmentDTO {
  id: string;
  code?: string | null;
  name: string;
}
