import { NextRequest } from "next/server";
import { z } from "zod";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import {
  assertJsonContentType,
  assertRequestBodySize,
  MAX_JSON_BODY_SIZE,
  parseAndValidateJson,
} from "@/server/api/validation";
import { fileDocument } from "@/lib/services/incoming-document-service";
import { OutgoingDocumentService } from "@/lib/services/outgoing-document-service";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/server/api/errors";

const FileDocumentSchema = z.object({
  dossierId: z.string().trim().max(100).optional().nullable(),
  filingNotes: z.string().trim().max(2000).optional().nullable(),
  archiveNow: z.boolean().optional().nullable(),
  storageLocation: z.string().trim().max(255).optional().nullable(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(req);
    assertJsonContentType(req);
    assertRequestBodySize(req, MAX_JSON_BODY_SIZE);

    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);

    const { id } = await context.params;
    const body = await parseAndValidateJson(req, FileDocumentSchema, { allowEmpty: true });

    // Phân nhánh theo loại văn bản (ADR-004)
    const doc = await prisma.document.findUnique({ where: { id }, select: { type: true } });
    if (!doc) throw new NotFoundError("Văn bản không tồn tại");

    if (doc.type === "VAN_BAN_DI") {
      const result = await OutgoingDocumentService.fileOutgoingDocument(
        {
          documentId: id,
          archiveNow: body.archiveNow ?? undefined,
          filingNotes: body.filingNotes ?? undefined,
        },
        authUser,
        { requestId }
      );
      return apiSuccess(result, { requestId });
    }

    // Văn bản đến
    const result = await fileDocument(
      {
        documentId: id,
        dossierId: body.dossierId ?? undefined,
        filingNotes: body.filingNotes ?? undefined,
        archiveNow: body.archiveNow ?? undefined,
        storageLocation: body.storageLocation ?? undefined,
      },
      authUser,
      requestId
    );
    return apiSuccess(result, { requestId });
  } catch (error) {
    return apiError(error, requestId);
  }
}
