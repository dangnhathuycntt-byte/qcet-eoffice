import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { fileDocument } from "@/lib/services/incoming-document-service";
import { OutgoingDocumentService } from "@/lib/services/outgoing-document-service";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/server/api/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    // Phân nhánh theo loại văn bản (ADR-004)
    const doc = await prisma.document.findUnique({ where: { id }, select: { type: true } });
    if (!doc) throw new NotFoundError("Văn bản không tồn tại");

    if (doc.type === "VAN_BAN_DI") {
      const result = await OutgoingDocumentService.fileOutgoingDocument(
        { documentId: id, archiveNow: body.archiveNow, filingNotes: body.filingNotes },
        authUser as any,
        { requestId }
      );
      return apiSuccess(result, { requestId, status: 200 });
    }

    // Văn bản đến — hành vi cũ
    const result = await fileDocument(
      {
        documentId: id,
        dossierId: body.dossierId,
        filingNotes: body.filingNotes,
        archiveNow: body.archiveNow,
        storageLocation: body.storageLocation,
      },
      authUser as any,
      requestId
    );
    return apiSuccess(result, { requestId, status: 200 });
  } catch (error) {
    return apiError(error, requestId);
  }
}
