import { SubmitContentReviewSchema } from "@qcet/contracts/documents";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { documentActionRoute } from "../shared";

export const POST = documentActionRoute(
  SubmitContentReviewSchema,
  (user, body, { documentId, requestId }) =>
    OutgoingDocumentService.submitContentReview(
      {
        documentId,
        contentReviewerId: body.contentReviewerId ?? undefined,
        notes: body.notes ?? undefined,
      },
      user,
      { requestId }
    ),
  { allowEmpty: true, legacyErrors: true }
);
