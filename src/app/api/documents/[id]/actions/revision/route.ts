import { CreateDocumentRevisionSchema } from "@/contracts/documents";
import { OutgoingDocumentService } from "@/lib/services/outgoing-document-service";
import { documentActionRoute } from "../shared";

export const POST = documentActionRoute(
  CreateDocumentRevisionSchema,
  (user, body, { documentId, requestId }) =>
    OutgoingDocumentService.createDocumentRevision(
      {
        documentId,
        changeReason: body.changeReason,
        title: body.title ?? undefined,
        summary: body.summary ?? undefined,
        fileUrl: body.fileUrl ?? undefined,
        fileName: body.fileName ?? undefined,
        fileSize: body.fileSize ?? undefined,
      },
      user,
      { requestId }
    ),
  { allowEmpty: true, legacyErrors: true }
);
