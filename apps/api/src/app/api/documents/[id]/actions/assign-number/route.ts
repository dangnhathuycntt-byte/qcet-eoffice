import { AssignOutgoingNumberSchema } from "@qcet/contracts/documents";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { documentActionRoute } from "../shared";

export const POST = documentActionRoute(
  AssignOutgoingNumberSchema,
  (user, body, { documentId, requestId }) =>
    OutgoingDocumentService.assignOutgoingNumber(
      {
        documentId,
        outgoingNumberStr: body.outgoingNumberStr ?? undefined,
        codeNotation: body.codeNotation ?? undefined,
        issuedDate: body.issuedDate ? new Date(body.issuedDate) : undefined,
        securityLevel: body.securityLevel ?? undefined,
        urgency: body.urgency ?? undefined,
      },
      user,
      { requestId }
    ),
  { allowEmpty: true }
);
