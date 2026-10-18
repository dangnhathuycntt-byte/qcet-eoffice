import { ReturnDocumentSchema, returnIncomingDocument } from "@/server/documents/incoming-document-routing-service";
import { documentActionRoute } from "../shared";

/** POST /api/documents/{id}/actions/return — đơn vị chủ trì trả lại văn bản đến, kèm lý do (V-01). */
export const POST = documentActionRoute(
  ReturnDocumentSchema,
  (user, body, { documentId, requestId }) =>
    returnIncomingDocument(documentId, body, user, requestId),
);
