import { z } from "zod";

const DossierStatusSchema = z.enum([
  "OPEN",
  "ACTIVE",
  "CLOSED",
  "READY_FOR_ARCHIVE",
  "SUBMITTED_TO_ARCHIVE",
  "ACCEPTED",
  "ARCHIVED",
]);

const DossierItemTypeSchema = z.enum([
  "DOCUMENT",
  "TASK",
  "RESULT",
  "DECISION",
  "MEETING_MINUTES",
  "ATTACHMENT",
]);

const DataClassificationSchema = z.enum(["PUBLIC", "INTERNAL", "RESTRICTED", "PERSONAL_DATA"]);
const OptionalNotesSchema = z.string().trim().max(2000).optional();

export const CreateDossierSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    code: z.string().trim().max(100).optional(),
    owningUnitId: z.string().trim().min(1).max(128),
    responsiblePersonId: z.string().trim().max(128).optional(),
    retentionRuleId: z.string().trim().max(128).optional(),
    classification: DataClassificationSchema.optional(),
    storageLocation: z.string().trim().max(255).optional(),
    notes: OptionalNotesSchema,
  })
  .strict();

export const AddDossierItemSchema = z
  .object({
    itemType: DossierItemTypeSchema,
    itemId: z.string().trim().max(128).optional(),
    documentId: z.string().trim().max(128).optional(),
    taskId: z.string().trim().max(128).optional(),
    fileUrl: z.string().trim().max(1024).optional(),
    fileName: z.string().trim().max(255).optional(),
    fileSize: z.number().int().nonnegative().max(100 * 1024 * 1024).optional(),
    title: z.string().trim().min(1).max(255),
    documentNumber: z.string().trim().max(100).optional(),
    documentDate: z.string().trim().max(100).optional(),
    pageCount: z.number().int().positive().max(100_000).optional(),
    sequence: z.number().int().positive().max(1_000_000).optional(),
    notes: OptionalNotesSchema,
  })
  .strict();

export const DossierItemIdSchema = z.string().trim().min(1).max(128);

export const DossierNotesActionSchema = z.object({ notes: OptionalNotesSchema }).strict();

export const CloseDossierSchema = DossierNotesActionSchema.extend({
  requireAllTasksCompleted: z.boolean().optional(),
});

export const AcceptArchiveSchema = z
  .object({
    storageLocation: z.string().trim().max(255).optional(),
    notes: OptionalNotesSchema,
    status: z.enum(["ACCEPTED", "ARCHIVED"]).optional(),
  })
  .strict();

export const FinalizeArchiveSchema = z
  .object({
    storageLocation: z.string().trim().max(255).optional(),
    notes: OptionalNotesSchema,
  })
  .strict();

export const RejectArchiveSchema = z.object({
  returnReason: z.string().trim().min(1).max(2000),
}).strict();

export type CreateDossierContract = z.infer<typeof CreateDossierSchema>;
export type AddDossierItemContract = z.infer<typeof AddDossierItemSchema>;
export type DossierNotesActionContract = z.infer<typeof DossierNotesActionSchema>;
