import { SubmitFormatCheckSchema } from "@qcet/contracts/documents";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
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
