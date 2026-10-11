import { z } from "zod";
import { OutgoingDocumentService } from "@/lib/services/outgoing-document-service";
import { documentActionRoute } from "../shared";

const ApproveFormatSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const POST = documentActionRoute(
  ApproveFormatSchema,
  (user, body, { documentId, requestId }) =>
    OutgoingDocumentService.approveFormat({ documentId, notes: body.notes ?? undefined }, user, { requestId }),
  { allowEmpty: true }
);
