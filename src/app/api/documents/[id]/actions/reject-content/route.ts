import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import { assertRequestBodySize, MAX_JSON_BODY_SIZE, parseAndValidateJson } from "@/server/api/validation";
import { assertRateLimit } from "@/server/security/rate-limit";
import { RejectContentDocumentSchema } from "@/contracts/documents";
import { OutgoingDocumentService } from "@/lib/services/outgoing-document-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(req);
    assertRequestBodySize(req, MAX_JSON_BODY_SIZE);
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);
    await assertRateLimit(authUser.id, "MUTATIONS_SENSITIVE");

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
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
