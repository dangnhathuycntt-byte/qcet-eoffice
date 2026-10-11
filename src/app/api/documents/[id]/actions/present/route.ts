import { PresentDocumentSchema } from "@/contracts/documents";
import { presentDocument } from "@/lib/services/incoming-document-service";
import { documentActionRoute } from "../shared";

export const POST = documentActionRoute(
  PresentDocumentSchema,
  (user, body, { documentId, requestId }) =>
    presentDocument(
      {
        documentId,
        presenterNotes: (body.presenterNotes ?? body.clerkNotes) ?? undefined,
        suggestedLeaderId: body.suggestedLeaderId ?? undefined,
      },
      user,
      requestId
    ),
  { allowEmpty: true, legacyErrors: true }
);
