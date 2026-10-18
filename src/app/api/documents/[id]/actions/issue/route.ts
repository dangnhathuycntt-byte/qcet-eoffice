import { z } from "zod";
import { RecipientsSchema } from "@/server/documents/outgoing-recipients";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { documentActionRoute } from "../shared";

const IssueDocumentSchema = z.object({
  recipientList: z.string().trim().max(2000).optional().nullable(),
  recipients: RecipientsSchema.optional(),
  replacesDocumentId: z.string().trim().min(1).optional(),
  deliveryMethod: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const POST = documentActionRoute(
  IssueDocumentSchema,
  (user, body, { documentId, requestId }) =>
    OutgoingDocumentService.issueDocument(
      {
        documentId,
        recipientList: body.recipientList ?? undefined,
        recipients: body.recipients,
        replacesDocumentId: body.replacesDocumentId,
        deliveryMethod: body.deliveryMethod ?? undefined,
        notes: body.notes ?? undefined,
      },
      user,
      { requestId }
    ),
  { allowEmpty: true }
);
