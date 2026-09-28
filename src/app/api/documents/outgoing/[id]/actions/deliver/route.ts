import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { OutgoingDocumentService } from "@/lib/services/outgoing-document-service";
import { DeliverOutgoingDocumentSchema } from "@/contracts/documents";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import { readOptionalJsonBody } from "@/server/api/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);
    assertCsrf(req);
    await assertRateLimit(authUser.id, "MUTATIONS_SENSITIVE");

    const { id } = await context.params;
    const body = DeliverOutgoingDocumentSchema.parse(await readOptionalJsonBody(req));

    const result = await OutgoingDocumentService.deliverDocument(
      { documentId: id, deliveryNotes: body.deliveryNotes ?? undefined },
      authUser as any,
      { requestId }
    );

    return apiSuccess(result, { requestId, status: 200 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
