import { z } from 'zod';
import { PaginationQuerySchema, IsoDateStringSchema } from './common';

/**
 * Task priority enum schema supporting canonical database values and client aliases.
 */
export const TaskPrioritySchema = z.enum([
  'LOW',
  'MEDIUM',
  'NORMAL',
  'HIGH',
  'URGENT',
  'low',
  'medium',
  'normal',
  'high',
  'urgent',
]);
export type TaskPriorityInput = z.infer<typeof TaskPrioritySchema>;

/**
 * Task lifecycle status enum schema.
 */
export const TaskStatusSchema = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'WAITING_APPROVAL',
  'COMPLETED',
  'OVERDUE',
  'CANCELLED',
  'not_started',
  'in_progress',
  'waiting_approval',
  'completed',
  'overdue',
  'cancelled',
]);
export type TaskStatusInput = z.infer<typeof TaskStatusSchema>;

/**
 * Deliverable specification schema for task attachments and deliverables.
 */
export const TaskDeliverableInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Deliverable title is required')
      .max(255, 'Deliverable title cannot exceed 255 characters'),
    fileUrl: z
      .string()
      .trim()
      .max(1024, 'File URL cannot exceed 1024 characters')
      .optional()
      .nullable(),
    fileName: z
      .string()
      .trim()
      .max(255, 'File name cannot exceed 255 characters')
      .optional()
      .nullable(),
    fileType: z
      .string()
      .trim()
      .max(100, 'File type cannot exceed 100 characters')
      .optional()
      .nullable(),
    fileSize: z
      .number()
      .min(0, 'File size must be positive')
      .max(52428800, 'File size cannot exceed 50MB (52,428,800 bytes)')
      .optional()
      .nullable(),
  })
  .strict();

export type TaskDeliverableInput = z.infer<typeof TaskDeliverableInputSchema>;

/**
 * Canonical task query filtering and pagination schema.
 */
export const TaskQueryParamsSchema = PaginationQuerySchema.extend({
  status: z
    .enum([
      'NOT_STARTED',
      'IN_PROGRESS',
      'WAITING_APPROVAL',
      'COMPLETED',
      'OVERDUE',
      'CANCELLED',
      'not_started',
      'in_progress',
      'waiting_approval',
      'completed',
      'overdue',
      'cancelled',
      'all',
    ])
    .optional(),
  priority: z
    .enum([
      'LOW',
      'MEDIUM',
      'NORMAL',
      'HIGH',
      'URGENT',
      'low',
      'medium',
      'normal',
      'high',
      'urgent',
      'all',
    ])
    .optional(),
  departmentId: z.string().trim().max(64, 'Department ID cannot exceed 64 characters').optional(),
  dept: z.string().trim().max(64).optional(),
  view: z.enum(['related', 'unit', 'all', 'approval']).optional(),
  // @deprecated Use view instead
  scope: z
    .enum([
      'school',
      'unit',
      'personal',
      'department',
      'individual',
      'my',
      'all',
      'SCHOOL',
      'DEPARTMENT',
      'INDIVIDUAL',
    ])
    .optional(),
  assignedTo: z.string().trim().max(128).optional(),
  assigneeId: z.string().trim().max(128, 'Assignee ID cannot exceed 128 characters').optional(),
  academicMonth: z.coerce
    .number()
    .int('Academic month must be an integer')
    .min(1, 'Academic month must be between 1 and 12')
    .max(12, 'Academic month must be between 1 and 12')
    .optional(),
  month: z.union([z.coerce.number().int().min(1).max(12), z.literal('all')]).optional(),
  academicYear: z.string().trim().max(20, 'Academic year cannot exceed 20 characters').optional(),
  year: z.string().trim().max(20).optional(),
  q: z.string().trim().max(200, 'Search query cannot exceed 200 characters').optional(),
  search: z.string().trim().max(200, 'Search query cannot exceed 200 characters').optional(),
  parentTaskId: z.string().trim().max(128).optional().nullable(),
  limit: z.union([z.coerce.number().int().min(1).max(200), z.literal('all')]).optional(),
  take: z.union([z.coerce.number().int().min(1).max(200), z.literal('all')]).optional(),
  all: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
});

export const TaskQuerySchema = TaskQueryParamsSchema;
export type TaskQueryParams = z.infer<typeof TaskQueryParamsSchema>;
export type TaskQuery = TaskQueryParams;

/**
 * Canonical CreateTaskInputSchema (C1 — Create Command).
 *
 * FROZEN CONTRACT — single-writer (shard-contracts-freeze owns src/contracts/**).
 * Authority: Master Plan §5 C1 + P0-01; see .claude/rules/core.md.
 *
 * Strictly prevents mass-assignment injection of privileged system fields (e.g. id, status, createdById, approvedAt).
 * The `.strict()` boundary is load-bearing and must not be relaxed or widened
 * without domain proof; it is enforced by tests/contracts/input-contracts.test.ts
 * and tests/task-data-contracts.test.ts.
 */
export const CreateTaskInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(255, 'Title cannot exceed 255 characters'),
    description: z.string().max(10 * 1024 * 1024, 'Description cannot exceed 10MB').refine((s) => Buffer.byteLength(s, 'utf8') <= 10 * 1024 * 1024, 'Description cannot exceed 10MB')
      .optional()
      .nullable(),
    priority: TaskPrioritySchema.default('MEDIUM'),
    departmentId: z
      .string()
      .trim()
      .max(64, 'Department ID cannot exceed 64 characters')
      .optional()
      .nullable(),
    /** Phase 9: canonical — client mới gửi `leadUnitId`, client cũ gửi `departmentId` */
    leadUnitId: z.string().trim().max(64).optional().nullable(),
    startDate: z.union([IsoDateStringSchema, z.date(), z.string().min(1)]).optional().nullable(),
    dueDate: z.union([IsoDateStringSchema, z.date(), z.string().min(1)]).optional().nullable(),
    assigneeId: z
      .string()
      .trim()
      .max(128, 'Assignee ID cannot exceed 128 characters')
      .optional()
      .nullable(),
    collaboratorIds: z
      .array(z.string().trim().max(128, 'Collaborator ID cannot exceed 128 characters'))
      .max(50, 'Cannot assign more than 50 collaborators')
      .optional(),
    assigneeIds: z
      .array(z.string().trim().max(128, 'Assignee ID cannot exceed 128 characters'))
      .max(50, 'Cannot assign more than 50 assignees')
      .optional(),
    deliverables: z
      .array(TaskDeliverableInputSchema)
      .max(20, 'Cannot attach more than 20 deliverables')
      .optional(),
    scope: z
      .enum(['SCHOOL', 'DEPARTMENT', 'INDIVIDUAL', 'school', 'department', 'individual'])
      .optional(),
    academicMonth: z.coerce
      .number()
      .int()
      .min(1)
      .max(12)
      .optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    academicYear: z.string().trim().max(20).optional(),
    year: z.string().trim().max(20).optional(),
    parentTaskId: z.string().trim().max(128).optional().nullable(),
    code: z.string().trim().max(50).optional(),
    creatorId: z.string().trim().max(128).optional(),
  })
  .strict();

export const CreateTaskSchema = CreateTaskInputSchema;
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

/**
 * Canonical UpdateTaskInputSchema.
 * Allows partial updates, status transitions, progress, and assignee updates.
 */
export const UpdateTaskInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title cannot be empty')
      .max(255, 'Title cannot exceed 255 characters')
      .optional(),
    description: z.string().max(10 * 1024 * 1024, 'Description cannot exceed 10MB').refine((s) => Buffer.byteLength(s, 'utf8') <= 10 * 1024 * 1024, 'Description cannot exceed 10MB')
      .optional()
      .nullable(),
    priority: TaskPrioritySchema.optional(),
    status: TaskStatusSchema.optional(),
    progressPercent: z.coerce.number().min(0).max(100).optional(),
    progress: z.coerce.number().min(0).max(100).optional(),
    startDate: z.union([IsoDateStringSchema, z.date(), z.string().min(1)]).optional().nullable(),
    dueDate: z.union([IsoDateStringSchema, z.date(), z.string().min(1)]).optional().nullable(),
    departmentId: z
      .string()
      .trim()
      .max(64, 'Department ID cannot exceed 64 characters')
      .optional()
      .nullable(),
    assigneeId: z
      .string()
      .trim()
      .max(128, 'Assignee ID cannot exceed 128 characters')
      .optional()
      .nullable(),
    collaboratorIds: z
      .array(z.string().trim().max(128, 'Collaborator ID cannot exceed 128 characters'))
      .max(50, 'Cannot assign more than 50 collaborators')
      .optional(),
    assigneeIds: z
      .array(z.string().trim().max(128, 'Assignee ID cannot exceed 128 characters'))
      .max(50, 'Cannot assign more than 50 assignees')
      .optional(),
    parentTaskId: z.string().trim().max(128).optional().nullable(),
    academicMonth: z.coerce.number().int().min(1).max(12).optional(),
    academicYear: z.string().trim().max(20).optional(),
    notes: z.string().max(2000).optional().nullable(),
    expectedVersion: z
      .number()
      .int()
      .min(0, 'Expected version must be non-negative')
      .optional(),
    expectedUpdatedAt: z.string().optional(),
    ifMatch: z.string().optional(),
    comment: z.string().trim().max(1000).optional().nullable(),
    note: z.string().trim().max(1000).optional().nullable(),
    resolution: z
      .enum([
        'APPROVED',
        'REJECTED',
        'REVISION_REQUIRED',
        'approved',
        'rejected',
        'revision_required',
      ])
      .optional(),
    approved: z.boolean().optional(),
  })
  .strict();

export const UpdateTaskSchema = UpdateTaskInputSchema;
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;
export type UpdateTask = UpdateTaskInput;

/**
 * Update task metadata command contract.
 * Strictly bounded to prevent tampering with lifecycle status, approvals, or ownership.
 */
export const UpdateTaskMetadataSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(255, 'Title cannot exceed 255 characters')
      .optional(),
    description: z.string().max(10 * 1024 * 1024, 'Description cannot exceed 10MB').refine((s) => Buffer.byteLength(s, 'utf8') <= 10 * 1024 * 1024, 'Description cannot exceed 10MB')
      .optional()
      .nullable(),
    priority: TaskPrioritySchema.optional(),
    startDate: IsoDateStringSchema.optional().nullable(),
    dueDate: IsoDateStringSchema.optional().nullable(),
    expectedVersion: z.number().int().min(0).optional(),
    expectedUpdatedAt: z.string().datetime().optional(),
    ifMatch: z.string().trim().optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startDate && data.dueDate) {
        return new Date(data.startDate).getTime() <= new Date(data.dueDate).getTime();
      }
      return true;
    },
    {
      message: 'Ngày bắt đầu không được sau thời hạn hoàn thành (Start date cannot be after due date)',
      path: ['startDate'],
    }
  );

export type UpdateTaskMetadataInput = z.infer<typeof UpdateTaskMetadataSchema>;

export const ArchiveTaskSchema = z
  .object({
    reason: z.string().trim().min(3).max(1000),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export type ArchiveTaskInput = z.infer<typeof ArchiveTaskSchema>;

/**
 * Change task status command contract.
 */
export const ChangeTaskStatusSchema = z
  .object({
    status: TaskStatusSchema,
    comment: z
      .string()
      .trim()
      .max(1000, 'Comment cannot exceed 1000 characters')
      .optional()
      .nullable(),
  })
  .strict();

export type ChangeTaskStatusInput = z.infer<typeof ChangeTaskStatusSchema>;

/**
 * Assign task command contract.
 */
export const AssignTaskSchema = z
  .object({
    assigneeIds: z
      .array(z.string().trim().max(128, 'Assignee ID cannot exceed 128 characters'))
      .max(50, 'Cannot assign more than 50 assignees'),
  })
  .strict();

export type AssignTaskInput = z.infer<typeof AssignTaskSchema>;

/**
 * Canonical ApproveTaskInputSchema.
 * Supports resolution enum ('APPROVED' | 'REJECTED' | 'REVISION_REQUIRED'), boolean approved, and notes.
 */
export const ApproveTaskInputSchema = z
  .object({
    approved: z.boolean().optional(),
    resolution: z
      .enum([
        'APPROVED',
        'REJECTED',
        'REVISION_REQUIRED',
        'approved',
        'rejected',
        'revision_required',
      ])
      .optional(),
    comment: z
      .string()
      .trim()
      .max(1000, 'Comment cannot exceed 1000 characters')
      .optional()
      .nullable(),
    note: z
      .string()
      .trim()
      .max(1000, 'Note cannot exceed 1000 characters')
      .optional()
      .nullable(),
    expectedVersion: z
      .number()
      .int()
      .min(0, 'Expected version must be non-negative')
      .optional(),
  })
  .strict();

export const ApproveTaskSchema = ApproveTaskInputSchema;
export type ApproveTaskInput = z.infer<typeof ApproveTaskInputSchema>;

/**
 * Canonical SubmitDeliverableInputSchema.
 * Enforces file size limits (<= 50MB) and string length bounds.
 */
export const SubmitDeliverableInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(255, 'Title cannot exceed 255 characters'),
    fileUrl: z
      .string()
      .trim()
      .min(1, 'File URL is required')
      .max(1024, 'File URL cannot exceed 1024 characters'),
    fileName: z
      .string()
      .trim()
      .max(255, 'File name cannot exceed 255 characters')
      .optional()
      .nullable(),
    fileType: z
      .string()
      .trim()
      .max(100, 'File type cannot exceed 100 characters')
      .optional()
      .nullable(),
    fileSize: z
      .number()
      .min(0, 'File size must be positive')
      .max(52428800, 'File size cannot exceed 50MB (52,428,800 bytes)')
      .optional()
      .nullable(),
    notes: z
      .string()
      .trim()
      .max(2000, 'Notes cannot exceed 2000 characters')
      .optional()
      .nullable(),
    note: z
      .string()
      .trim()
      .max(2000, 'Note cannot exceed 2000 characters')
      .optional()
      .nullable(),
    uploadedById: z.string().trim().max(128).optional().nullable(),
    expectedVersion: z
      .number()
      .int()
      .min(0, 'Expected version must be non-negative')
      .optional(),
  })
  .strict();

export const SubmitDeliverableSchema = SubmitDeliverableInputSchema;
export type SubmitDeliverableInput = z.infer<typeof SubmitDeliverableInputSchema>;

/**
 * Canonical ReviewDeliverableInputSchema.
 */
export const ReviewDeliverableInputSchema = z
  .object({
    deliverableId: z.string().trim().max(128).optional(),
    reviewStatus: z.enum([
      'APPROVED',
      'REJECTED',
      'REVISION_REQUIRED',
      'approved',
      'rejected',
      'revision_required',
    ]),
    reviewNote: z
      .string()
      .trim()
      .max(1000, 'Review note cannot exceed 1000 characters')
      .optional()
      .nullable(),
    note: z
      .string()
      .trim()
      .max(1000, 'Note cannot exceed 1000 characters')
      .optional()
      .nullable(),
    comment: z
      .string()
      .trim()
      .max(1000, 'Comment cannot exceed 1000 characters')
      .optional()
      .nullable(),
    expectedVersion: z
      .number()
      .int()
      .min(0, 'Expected version must be non-negative')
      .optional(),
  })
  .strict();

export type ReviewDeliverableInput = z.infer<typeof ReviewDeliverableInputSchema>;
