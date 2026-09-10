import { z } from 'zod';
import { PaginationQuerySchema, IsoDateStringSchema } from './common';

/**
 * Institutional document types according to Decree 30/2020/ND-CP.
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
 * Document urgency levels.
 */
export const DocumentUrgencySchema = z.enum([
  'THUONG',
  'KHAN',
  'THUONG_KHAN',
  'HOA_TOC',
  'normal',
  'urgent',
  'top_urgent',
  'flash',
]);
export type DocumentUrgencyInput = z.infer<typeof DocumentUrgencySchema>;

/**
 * Document security levels.
 */
export const DocumentSecurityLevelSchema = z.enum([
  'THUONG',
  'MAT',
  'TOI_MAT',
  'TUYET_MAT',
]);
export type DocumentSecurityLevelInput = z.infer<typeof DocumentSecurityLevelSchema>;

/**
 * Document processing status.
 */
export const DocumentStatusSchema = z.enum([
  'CHO_PHAN_CONG',
  'DANG_XU_LY',
  'CHO_PHE_DUYET',
  'DA_HOAN_THANH',
  'LUU_THEO_DOI',
  'pending_assignment',
  'processing',
  'delegated',
  'approved',
  'completed',
]);
export type DocumentStatusInput = z.infer<typeof DocumentStatusSchema>;

/**
 * Document query filters schema.
 */
export const DocumentQuerySchema = PaginationQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  type: z
    .enum([
      'INCOMING',
      'OUTGOING',
      'INTERNAL',
      'VAN_BAN_DEN',
      'VAN_BAN_DI',
      'TO_TRINH_NOI_BO',
      'inbox',
      'outbox',
      'all',
    ])
    .optional(),
  status: DocumentStatusSchema.optional(),
  departmentId: z
    .string()
    .trim()
    .max(64, 'Department ID cannot exceed 64 characters')
    .optional(),
  leadDepartmentId: z
    .string()
    .trim()
    .max(64, 'Lead Department ID cannot exceed 64 characters')
    .optional(),
  draftingDeptId: z
    .string()
    .trim()
    .max(64, 'Drafting Department ID cannot exceed 64 characters')
    .optional(),
  search: z.string().trim().max(200, 'Search query cannot exceed 200 characters').optional(),
  q: z.string().trim().max(200, 'Search query cannot exceed 200 characters').optional(),
  urgency: z.string().trim().max(50).optional(),
  securityLevel: z.string().trim().max(50).optional(),
  documentYear: z.coerce
    .number()
    .int()
    .min(2000, 'Year must be at least 2000')
    .max(2100, 'Year cannot exceed 2100')
    .optional(),
  year: z.coerce
    .number()
    .int()
    .min(2000, 'Year must be at least 2000')
    .max(2100, 'Year cannot exceed 2100')
    .optional(),
  scope: z.string().trim().max(50).optional(),
});

export type DocumentQuery = z.infer<typeof DocumentQuerySchema>;

/**
 * Export document query schema.
 */
export const ExportDocumentQuerySchema = z.object({
  type: z.enum(['VAN_BAN_DEN', 'VAN_BAN_DI', 'inbox', 'outbox']),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  documentYear: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type ExportDocumentQuery = z.infer<typeof ExportDocumentQuerySchema>;

const AttachmentInputSchema = z.object({
  fileName: z.string().trim().max(255),
  fileUrl: z.string().trim().max(1024),
  fileSize: z.number().int().nonnegative().optional(),
  mimeType: z.string().trim().max(128).optional(),
  sha256Hash: z.string().trim().max(128).optional().nullable(),
  isOriginal: z.boolean().optional(),
});

/**
 * Create document contract.
 * Strictly validates fields and prevents mass-assignment injection (e.g. spoofing registeredById).
 */
export const CreateDocumentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(255, 'Title cannot exceed 255 characters')
      .optional()
      .nullable(),
    summary: z
      .string()
      .trim()
      .max(2000, 'Summary cannot exceed 2000 characters')
      .optional()
      .nullable(),
    documentNumber: z
      .string()
      .trim()
      .max(100, 'Document number cannot exceed 100 characters')
      .optional()
      .nullable(),
    originalNumber: z
      .string()
      .trim()
      .max(100, 'Original number cannot exceed 100 characters')
      .optional()
      .nullable(),
    type: DocumentTypeSchema,
    departmentId: z
      .string()
      .trim()
      .max(64, 'Department ID cannot exceed 64 characters')
      .optional()
      .nullable(),
    draftingDeptId: z
      .string()
      .trim()
      .max(64, 'Drafting department ID cannot exceed 64 characters')
      .optional()
      .nullable(),
    leadDepartmentId: z
      .string()
      .trim()
      .max(64, 'Lead department ID cannot exceed 64 characters')
      .optional()
      .nullable(),
    leadUserId: z
      .string()
      .trim()
      .max(64, 'Lead user ID cannot exceed 64 characters')
      .optional()
      .nullable(),
    fileUrl: z
      .string()
      .trim()
      .max(1024, 'File URL cannot exceed 1024 characters')
      .optional()
      .nullable(),
    urgency: z.string().trim().max(50).optional().nullable(),
    securityLevel: z.string().trim().max(50).optional().nullable(),
    issuedDate: z.union([IsoDateStringSchema, z.date(), z.string().trim()]).optional().nullable(),
    registeredDate: z.union([IsoDateStringSchema, z.date(), z.string().trim()]).optional().nullable(),
    dueDate: z.union([IsoDateStringSchema, z.date(), z.string().trim()]).optional().nullable(),
    issuingAuthority: z
      .string()
      .trim()
      .max(255, 'Issuing authority cannot exceed 255 characters')
      .optional()
      .nullable(),
    category: z
      .string()
      .trim()
      .max(100, 'Category cannot exceed 100 characters')
      .optional()
      .nullable(),
    documentYear: z.coerce.number().int().min(2000).max(2100).optional().nullable(),
    registrationNumber: z.coerce.number().int().optional().nullable(),
    signerName: z.string().trim().max(255).optional().nullable(),
    signerTitle: z.string().trim().max(255).optional().nullable(),
    recipientList: z.string().trim().max(1000).optional().nullable(),
    distributedCopies: z.coerce.number().int().optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    attachments: z.array(AttachmentInputSchema).optional().nullable(),
  })
  .strict()
  .refine(
    (data) => Boolean((data.title && data.title.trim().length >= 2) || (data.summary && data.summary.trim().length >= 2)),
    {
      message: 'Tiêu đề hoặc trích yếu văn bản (title/summary) là bắt buộc',
      path: ['summary'],
    }
  )
  .refine(
    (data) =>
      Boolean(
        (data.documentNumber && data.documentNumber.trim().length >= 1) ||
        (data.originalNumber && data.originalNumber.trim().length >= 1)
      ),
    {
      message: 'Số văn bản hoặc số ký hiệu gốc (documentNumber/originalNumber) là bắt buộc',
      path: ['originalNumber'],
    }
  );

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;

/**
 * Update document contract.
 * Bounded to updateable metadata fields only.
 */
export const UpdateDocumentSchema = z
  .object({
    title: z.string().trim().max(500).optional().nullable(),
    summary: z.string().trim().max(2000).optional().nullable(),
    documentNumber: z.string().trim().max(100).optional().nullable(),
    originalNumber: z.string().trim().max(100).optional().nullable(),
    type: DocumentTypeSchema.optional(),
    departmentId: z.string().trim().max(64).optional().nullable(),
    fileUrl: z.string().trim().max(1024).optional().nullable(),
    urgency: z.string().trim().max(50).optional().nullable(),
    securityLevel: z.string().trim().max(50).optional().nullable(),
    status: DocumentStatusSchema.optional().nullable(),
    category: z.string().trim().max(100).optional().nullable(),
    issuingAuthority: z.string().trim().max(255).optional().nullable(),
    dueDate: z.union([IsoDateStringSchema, z.date(), z.string().trim()]).optional().nullable(),
    signerName: z.string().trim().max(255).optional().nullable(),
    signerTitle: z.string().trim().max(255).optional().nullable(),
    draftingDeptId: z.string().trim().max(64).optional().nullable(),
    leadDepartmentId: z.string().trim().max(64).optional().nullable(),
    leadUserId: z.string().trim().max(64).optional().nullable(),
    recipientList: z.string().trim().max(1000).optional().nullable(),
    distributedCopies: z.coerce.number().int().optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    linkedTaskId: z.string().trim().max(64).optional().nullable(),
  })
  .strict();

export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;

/**
 * Create executive directive contract.
 * Used when school executives issue actionable directives on documents.
 */
export const CreateDirectiveSchema = z
  .object({
    title: z.string().trim().max(255).optional().nullable(),
    content: z.string().trim().max(5000).optional().nullable(),
    instruction: z.string().trim().max(5000).optional().nullable(),
    leaderId: z.string().trim().max(64).optional().nullable(),
    assignedToDepartmentId: z.string().trim().max(64).optional().nullable(),
    assignedDeptId: z.string().trim().max(64).optional().nullable(),
    deadline: z.union([IsoDateStringSchema, z.date(), z.string().trim()]).optional().nullable(),
    collaboratorIds: z
      .union([
        z.array(z.string().trim().max(128)),
        z.string().trim().max(1000),
      ])
      .optional()
      .nullable(),
  })
  .strict()
  .refine(
    (data) =>
      Boolean(
        (data.instruction && data.instruction.trim().length > 0) ||
        (data.content && data.content.trim().length > 0)
      ),
    {
      message: 'Nội dung chỉ đạo bút phê (instruction/content) là bắt buộc',
      path: ['instruction'],
    }
  )
  .refine(
    (data) =>
      Boolean(
        (data.assignedDeptId && data.assignedDeptId.trim().length > 0) ||
        (data.assignedToDepartmentId && data.assignedToDepartmentId.trim().length > 0)
      ),
    {
      message: 'Đơn vị chủ trì thực hiện (assignedDeptId) là bắt buộc',
      path: ['assignedDeptId'],
    }
  );

export type CreateDirectiveInput = z.infer<typeof CreateDirectiveSchema>;
