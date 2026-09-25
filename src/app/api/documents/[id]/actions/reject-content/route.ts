import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import { parseAndValidateJson } from "@/server/api/validation";
import { RejectContentDocumentSchema } from "@/contracts/documents";
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
    const body = await parseAndValidateJson(req, RejectContentDocumentSchema, { allowEmpty: true });

    const result = await OutgoingDocumentService.rejectContent(
      {
        documentId: id,
        notes: body.notes ?? undefined,
      },
      authUser,
      { requestId }
    );

    return apiSuccess({ workflow: result }, { requestId });
  } catch (error) {
    return apiError(error, requestId);
  }
}
