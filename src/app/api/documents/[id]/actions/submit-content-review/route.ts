import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { parseAndValidateJson } from "@/server/api/validation";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import { SubmitContentReviewSchema } from "@/contracts/documents";
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
    await assertRateLimit(authUser.id, 'MUTATIONS_SENSITIVE');

    const { id } = await context.params;
    const body = await parseAndValidateJson(req, SubmitContentReviewSchema, { allowEmpty: true });

    const result = await OutgoingDocumentService.submitContentReview(
      {
        documentId: id,
        contentReviewerId: body.contentReviewerId ?? undefined,
        notes: body.notes ?? undefined,
      },
      authUser,
      { requestId }
    );

    return apiSuccess(result, {
      requestId,
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}
