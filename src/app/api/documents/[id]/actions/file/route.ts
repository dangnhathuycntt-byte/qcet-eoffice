import { z } from "zod";
import { fileDocument } from "@/server/documents/incoming-document-service";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { getDocumentTypeById } from "@/server/documents/document-service";
import { NotFoundError } from "@/server/api/errors";
import { documentActionRoute } from "../shared";

const FileDocumentSchema = z.object({
  dossierId: z.string().trim().max(100).optional().nullable(),
  filingNotes: z.string().trim().max(2000).optional().nullable(),
  storageLocation: z.string().trim().max(255).optional().nullable(),
}).strict();

export const POST = documentActionRoute(
  FileDocumentSchema,
  async (user, body, { documentId, requestId }) => {
    // Phân nhánh theo loại văn bản (ADR-004)
    const doc = await getDocumentTypeById(documentId);
    if (!doc) throw new NotFoundError("Văn bản không tồn tại");

    if (doc.type === "VAN_BAN_DI") {
      return OutgoingDocumentService.fileOutgoingDocument(
        { documentId, filingNotes: body.filingNotes ?? undefined },
        user,
        { requestId }
      );
    }

    // Văn bản đến
    return fileDocument(
      {
        documentId,
        dossierId: body.dossierId ?? undefined,
        filingNotes: body.filingNotes ?? undefined,
        storageLocation: body.storageLocation ?? undefined,
      },
      user,
      requestId
    );
  },
  { allowEmpty: true }
);
