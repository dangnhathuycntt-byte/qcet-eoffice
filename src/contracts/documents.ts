import { z } from 'zod';
import { PaginationQuerySchema, IsoDateStringSchema } from './common';

/**
 * Institutional document types.
 */
export const DocumentTypeSchema = z.enum([
  'INCOMING',
  'OUTGOING',
  'INTERNAL',
  'VAN_BAN_DEN',
  'VAN_BAN_DI',
  'TO_TRINH_NOI_BO',
]);
export type DocumentTypeInput = z.infer<typeof DocumentTypeSchema>;

/**
 * Document query filters schema.
 */
export const DocumentQuerySchema = PaginationQuerySchema.extend({
  type: z
    .enum([
      'INCOMING',
      'OUTGOING',
      'INTERNAL',
      'VAN_BAN_DEN',
      'VAN_BAN_DI',
      'TO_TRINH_NOI_BO',
      'all',
    ])
    .optional(),
  status: z.string().trim().max(50, 'Status cannot exceed 50 characters').optional(),
  departmentId: z
    .string()
    .trim()
    .max(64, 'Department ID cannot exceed 64 characters')
    .optional(),
  search: z.string().trim().max(200, 'Search query cannot exceed 200 characters').optional(),
  urgency: z.string().trim().max(50).optional(),
  securityLevel: z.string().trim().max(50).optional(),
  documentYear: z.coerce
    .number()
    .int()
    .min(2000, 'Year must be at least 2000')
    .max(2100, 'Year cannot exceed 2100')
    .optional(),
});

export type DocumentQuery = z.infer<typeof DocumentQuerySchema>;

/**
 * Create document contract.
 * Strictly prevents mass-assignment injection (e.g. spoofing registeredById).
 */
export const CreateDocumentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(255, 'Title cannot exceed 255 characters'),
    documentNumber: z
      .string()
      .trim()
      .min(1, 'Document number is required')
      .max(100, 'Document number cannot exceed 100 characters'),
    type: DocumentTypeSchema,
    departmentId: z
      .string()
      .trim()
      .max(64, 'Department ID cannot exceed 64 characters')
      .optional()
      .nullable(),
    summary: z
      .string()
      .max(2000, 'Summary cannot exceed 2000 characters')
      .optional()
      .nullable(),
    fileUrl: z
      .string()
      .trim()
      .max(1024, 'File URL cannot exceed 1024 characters')
      .optional()
      .nullable(),
    urgency: z.string().trim().max(50).optional(),
    securityLevel: z.string().trim().max(50).optional(),
    issuedDate: IsoDateStringSchema.optional().nullable(),
  })
  .strict();

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;

/**
 * Update document contract.
 * Bounded to updateable metadata fields only.
 */
export const UpdateDocumentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(255, 'Title cannot exceed 255 characters')
      .optional(),
    documentNumber: z
      .string()
      .trim()
      .min(1, 'Document number is required')
      .max(100, 'Document number cannot exceed 100 characters')
      .optional(),
    summary: z
      .string()
      .max(2000, 'Summary cannot exceed 2000 characters')
      .optional()
      .nullable(),
    fileUrl: z
      .string()
      .trim()
      .max(1024, 'File URL cannot exceed 1024 characters')
      .optional()
      .nullable(),
    departmentId: z
      .string()
      .trim()
      .max(64, 'Department ID cannot exceed 64 characters')
      .optional()
      .nullable(),
    urgency: z.string().trim().max(50).optional(),
    securityLevel: z.string().trim().max(50).optional(),
    status: z.string().trim().max(50).optional(),
  })
  .strict();

export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;

/**
 * Create executive directive contract.
 * Used when school executives issue actionable directives on documents.
 */
export const CreateDirectiveSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, 'Title must be at least 2 characters')
      .max(255, 'Title cannot exceed 255 characters'),
    content: z
      .string()
      .trim()
      .min(2, 'Content must be at least 2 characters')
      .max(5000, 'Content cannot exceed 5000 characters'),
    assignedToDepartmentId: z
      .string()
      .trim()
      .max(64, 'Department ID cannot exceed 64 characters')
      .optional()
      .nullable(),
    deadline: IsoDateStringSchema.optional().nullable(),
    collaboratorIds: z
      .array(z.string().trim().max(128, 'Collaborator ID cannot exceed 128 characters'))
      .max(20, 'Cannot assign more than 20 collaborator departments')
      .optional(),
  })
  .strict();

export type CreateDirectiveInput = z.infer<typeof CreateDirectiveSchema>;
