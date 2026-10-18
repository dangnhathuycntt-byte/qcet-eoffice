import { SignDocumentSchema } from "@/contracts/documents";
import { OutgoingDocumentService, type SignDocumentInput } from "@/server/documents/outgoing-document-service";
import { documentActionRoute } from "../shared";

export const POST = documentActionRoute(
  SignDocumentSchema,
  (user, body, { documentId, requestId }) =>
    OutgoingDocumentService.signDocument(
      {
        documentId,
        signingCapacity: body.signingCapacity ?? undefined,
        signatureType: (body.signatureType as SignDocumentInput["signatureType"]) ?? undefined,
        certificateMetadata: (body.certificateMetadata as Record<string, unknown>) ?? undefined,
        signingNotes: body.signingNotes ?? undefined,
      },
      user,
      { requestId }
    ),
  { allowEmpty: true, legacyErrors: true }
);
