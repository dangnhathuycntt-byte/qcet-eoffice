import { z } from 'zod';

export const ExecutiveResolutionTypeEnum = z.enum([
  'EXTEND_DEADLINE',
  'REASSIGN_OWNER',
  'DIRECTIVE_NOTE',
  'DISMISS_BOTTLENECK',
  'REASSIGN',
  'DEMAND_EXPLANATION',
  'DIRECT_DIRECTIVE',
]);

export const CreateExecutiveResolutionSchema = z
  .object({
    taskId: z.string().trim().min(1, 'Mã nhiệm vụ không được để trống').max(128),
    resolutionType: ExecutiveResolutionTypeEnum.optional(),
    actionType: ExecutiveResolutionTypeEnum.optional(),
    type: ExecutiveResolutionTypeEnum.optional(),
    directiveNote: z
      .string()
      .trim()
      .max(2000, 'Nội dung chỉ đạo không được vượt quá 2000 ký tự')
      .optional()
      .nullable(),
    grantedDays: z.coerce
      .number()
      .int()
      .positive('Số ngày gia hạn phải là số nguyên dương')
      .max(365)
      .optional()
      .nullable(),
    extensionDays: z.coerce
      .number()
      .int()
      .positive()
      .max(365)
      .optional()
      .nullable(),
    newOwnerId: z.string().trim().max(128).optional().nullable(),
    status: z
      .enum([
        'NOT_STARTED',
        'IN_PROGRESS',
        'WAITING_APPROVAL',
        'COMPLETED',
        'OVERDUE',
        'CANCELLED',
      ])
      .optional()
      .nullable(),
    taskStatus: z
      .enum([
        'NOT_STARTED',
        'IN_PROGRESS',
        'WAITING_APPROVAL',
        'COMPLETED',
        'OVERDUE',
        'CANCELLED',
      ])
      .optional()
      .nullable(),
    priority: z
      .enum(['URGENT', 'HIGH', 'NORMAL', 'MEDIUM', 'LOW'])
      .optional()
      .nullable(),
    taskPriority: z
      .enum(['URGENT', 'HIGH', 'NORMAL', 'MEDIUM', 'LOW'])
      .optional()
      .nullable(),
    version: z.coerce.number().int().nonnegative().optional(),
    expectedVersion: z.coerce.number().int().nonnegative().optional(),
  })
  .refine(
    (data) => Boolean(data.resolutionType || data.actionType || data.type),
    {
      message: 'Thiếu thông tin bắt buộc (taskId, resolutionType/actionType)',
      path: ['resolutionType'],
    }
  );

export type CreateExecutiveResolutionInput = z.infer<
  typeof CreateExecutiveResolutionSchema
>;

export const ExecutiveResolutionQuerySchema = z.object({
  taskId: z.string().trim().max(128).optional(),
  resolutionType: z.string().trim().max(50).optional(),
  departmentId: z.string().trim().max(128).optional(),
  dept: z.string().trim().max(128).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ExecutiveResolutionQueryInput = z.infer<
  typeof ExecutiveResolutionQuerySchema
>;
