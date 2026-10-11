import { RerouteDocumentSchema, rerouteIncomingDocument } from "@/lib/services/incoming-document-routing-service";
import { documentActionRoute } from "../shared";

/** POST /api/documents/{id}/actions/reroute — Văn thư chuyển văn bản bị trả lại cho đơn vị khác (V-01). */
export const POST = documentActionRoute(
  RerouteDocumentSchema,
  (user, body, { documentId, requestId }) =>
    rerouteIncomingDocument(documentId, body, user, requestId),
);
