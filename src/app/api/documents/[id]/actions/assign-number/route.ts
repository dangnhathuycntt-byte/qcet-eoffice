import { z } from "zod";
import { DocumentSecurityLevel, DocumentUrgency } from "@prisma/client";
import { OutgoingDocumentService } from "@/lib/services/outgoing-document-service";
import { documentActionRoute } from "../shared";

const AssignNumberSchema = z.object({
  outgoingNumberStr: z.string().trim().max(100).optional().nullable(),
  codeNotation: z.string().trim().max(100).optional().nullable(),
  issuedDate: z.union([z.string().trim(), z.date()]).optional().nullable(),
  securityLevel: z.nativeEnum(DocumentSecurityLevel).optional().nullable(),
  urgency: z.nativeEnum(DocumentUrgency).optional().nullable(),
});

export const POST = documentActionRoute(
  AssignNumberSchema,
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
