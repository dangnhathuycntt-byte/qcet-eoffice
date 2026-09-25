import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import { OutgoingDocumentService } from "@/lib/services/outgoing-document-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(req);
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    const result = await OutgoingDocumentService.rejectContent(
      {
        documentId: id,
        notes: body.notes,
      },
      authUser as any,
      { requestId }
    );

    return apiSuccess(
      { workflow: result },
      { requestId, status: 200 }
    );
  } catch (error) {
    return apiError(error, requestId);
  }
}
