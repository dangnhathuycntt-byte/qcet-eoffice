import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { OutgoingDocumentService } from "@/lib/services/outgoing-document-service";

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

    const result = await OutgoingDocumentService.createDocumentRevision(
      {
        documentId: id,
        changeReason: body.changeReason,
        title: body.title,
        summary: body.summary,
        fileUrl: body.fileUrl,
        fileName: body.fileName,
        fileSize: body.fileSize,
      },
      authUser as any,
      { requestId }
    );

    return apiSuccess(result, {
      requestId,
      status: 200,
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}
