import { RejectContentDocumentSchema } from "@qcet/contracts/documents";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { documentActionRoute } from "../shared";

export const POST = documentActionRoute(
  RejectContentDocumentSchema,
  async (user, body, { documentId, requestId }) => ({
    workflow: await OutgoingDocumentService.rejectContent(
      { documentId, notes: body.notes ?? undefined },
      user,
      { requestId }
    ),
  }),
  { allowEmpty: true }
);
