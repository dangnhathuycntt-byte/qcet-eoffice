import { SubmitFormatCheckSchema } from "@/contracts/documents";
import { OutgoingDocumentService } from "@/lib/services/outgoing-document-service";
import { documentActionRoute } from "../shared";

export const POST = documentActionRoute(
  SubmitFormatCheckSchema,
  (user, body, { documentId, requestId }) =>
    OutgoingDocumentService.submitFormatCheck(
      {
        documentId,
        formatReviewerId: body.formatReviewerId ?? undefined,
        notes: body.notes ?? undefined,
      },
      user,
      { requestId }
    ),
  { allowEmpty: true, legacyErrors: true }
);
