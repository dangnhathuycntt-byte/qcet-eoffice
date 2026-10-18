import { z } from "zod";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { documentActionRoute } from "../shared";

const OrganizationSignSchema = z.object({
  certificateMetadata: z.record(z.string(), z.unknown()).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const POST = documentActionRoute(
  OrganizationSignSchema,
  (user, body, { documentId, requestId }) =>
    OutgoingDocumentService.organizationSign(
      {
        documentId,
        certificateMetadata: (body.certificateMetadata as Record<string, unknown>) ?? undefined,
        notes: body.notes ?? undefined,
      },
      user,
      { requestId }
    ),
  { allowEmpty: true }
);
