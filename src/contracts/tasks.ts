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
 * Task query filtering and pagination schema.
 */
export const TaskQuerySchema = PaginationQuerySchema.extend({
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
  assigneeId: z.string().trim().max(128, 'Assignee ID cannot exceed 128 characters').optional(),
  academicMonth: z.coerce
    .number()
    .int('Academic month must be an integer')
    .min(1, 'Academic month must be between 1 and 12')
    .max(12, 'Academic month must be between 1 and 12')
    .optional(),
  academicYear: z.string().trim().max(20, 'Academic year cannot exceed 20 characters').optional(),
  q: z.string().trim().max(200, 'Search query cannot exceed 200 characters').optional(),
  search: z.string().trim().max(200, 'Search query cannot exceed 200 characters').optional(),
  parentTaskId: z.string().trim().max(128).optional().nullable(),
});

export type TaskQuery = z.infer<typeof TaskQuerySchema>;

/**
 * Create task command contract.
 * Strictly prevents mass-assignment injection (e.g. injected IDs, approval timestamps, creator ID).
 */
export const CreateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(255, 'Title cannot exceed 255 characters'),
    description: z
      .string()
      .max(5000, 'Description cannot exceed 5000 characters')
      .optional()
      .nullable(),
    priority: TaskPrioritySchema.default('MEDIUM'),
    departmentId: z
      .string()
      .trim()
      .max(64, 'Department ID cannot exceed 64 characters')
      .optional()
      .nullable(),
    dueDate: IsoDateStringSchema.optional().nullable(),
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
    academicYear: z.string().trim().max(20).optional(),
    parentTaskId: z.string().trim().max(128).optional().nullable(),
  })
  .strict();

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

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
    description: z
      .string()
      .max(5000, 'Description cannot exceed 5000 characters')
      .optional()
      .nullable(),
    priority: TaskPrioritySchema.optional(),
    dueDate: IsoDateStringSchema.optional().nullable(),
    departmentId: z
      .string()
      .trim()
      .max(64, 'Department ID cannot exceed 64 characters')
      .optional()
      .nullable(),
    parentTaskId: z.string().trim().max(128).optional().nullable(),
    academicMonth: z.coerce.number().int().min(1).max(12).optional(),
    academicYear: z.string().trim().max(20).optional(),
  })
  .strict();

export type UpdateTaskMetadataInput = z.infer<typeof UpdateTaskMetadataSchema>;

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
 * Approve task command contract with optimistic versioning guard.
 */
export const ApproveTaskSchema = z
  .object({
    approved: z.boolean(),
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

export type ApproveTaskInput = z.infer<typeof ApproveTaskSchema>;

/**
 * Submit task deliverable command contract.
 * Enforces file size limits (<= 50MB) and string length bounds.
 */
export const SubmitDeliverableSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(255, 'Title cannot exceed 255 characters'),
    fileUrl: z
      .string()
      .trim()
      .max(1024, 'File URL cannot exceed 1024 characters'),
    fileName: z
      .string()
      .trim()
      .max(255, 'File name cannot exceed 255 characters'),
    fileSize: z
      .number()
      .min(0, 'File size must be positive')
      .max(52428800, 'File size cannot exceed 50MB (52,428,800 bytes)'),
  })
  .strict();

export type SubmitDeliverableInput = z.infer<typeof SubmitDeliverableSchema>;
