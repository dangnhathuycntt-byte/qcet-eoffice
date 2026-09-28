import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertRequestBodySize, MAX_JSON_BODY_SIZE, parseAndValidateJson } from "@/server/api/validation";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import { ResolveDocumentSchema } from "@/contracts/documents";
import { resolveDocument } from "@/lib/services/incoming-document-service";
import { withIdempotency } from "@/lib/db/idempotency";
import { ValidationError } from "@/server/api/errors";

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
    await assertRateLimit(authUser.id, 'MUTATIONS_SENSITIVE');

    const { id } = await context.params;
    const body = await parseAndValidateJson(req, ResolveDocumentSchema, { allowEmpty: true });

    const command = {
      documentId: id,
      resolutionSummary: body.resolutionSummary,
      resolutionDocUrl: body.resolutionDocUrl ?? undefined,
      notes: body.notes ?? undefined,
    };
    const rawKey = req.headers.get("idempotency-key") || req.headers.get("x-idempotency-key");
    const idempotencyKey = rawKey?.trim();
    if (!idempotencyKey || idempotencyKey.length > 255) {
      throw new ValidationError(
        "Xác nhận giải quyết văn bản cần gửi Idempotency-Key (tối đa 255 ký tự).",
        { "Idempotency-Key": ["Bắt buộc; độ dài tối đa 255 ký tự."] },
        "IDEMPOTENCY_KEY_REQUIRED"
      );
    }

    const result = await withIdempotency(
      {
        userId: authUser.id,
        operation: `document.incoming.resolve:${id}`,
        key: idempotencyKey,
        payload: command,
      },
      () => resolveDocument(command, authUser, requestId)
    );

    return apiSuccess(result, {
      requestId,
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}
