import { z } from "zod";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { documentActionRoute } from "../shared";

export const POST = documentActionRoute(
  z.object({}).strict(),
  (user, _body, { documentId, requestId }) =>
    OutgoingDocumentService.withdrawContentReview({ documentId }, user, { requestId }),
  { allowEmpty: true }
);
