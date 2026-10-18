import { z } from "zod";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { documentActionRoute } from "../shared";

const ApproveContentSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const POST = documentActionRoute(
  ApproveContentSchema,
  (user, body, { documentId, requestId }) =>
    OutgoingDocumentService.approveContent({ documentId, notes: body.notes ?? undefined }, user, { requestId }),
  { allowEmpty: true }
);
