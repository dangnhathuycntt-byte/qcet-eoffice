import { SignatureType } from "@prisma/client";
import { SignDocumentSchema } from "@/contracts/documents";
import { OutgoingDocumentService } from "@/lib/services/outgoing-document-service";
import { documentActionRoute } from "../shared";

export const POST = documentActionRoute(
  SignDocumentSchema,
  (user, body, { documentId, requestId }) =>
    OutgoingDocumentService.signDocument(
      {
        documentId,
        signingCapacity: body.signingCapacity ?? undefined,
        signatureType: (body.signatureType as SignatureType) ?? undefined,
        certificateMetadata: (body.certificateMetadata as Record<string, unknown>) ?? undefined,
        signingNotes: body.signingNotes ?? undefined,
      },
      user,
      { requestId }
    ),
  { allowEmpty: true, legacyErrors: true }
);
