import { NextRequest } from "next/server";
import type { ZodType } from "zod";
import { getApiContext, requireAuthenticated, type AuthenticatedUser } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import { parseAndValidateJson } from "@/server/api/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export interface DocumentActionCall {
  documentId: string;
  requestId: string;
  req: NextRequest;
}

/**
 * Route chuyển trạng thái văn bản: CSRF → xác thực → giới hạn tần suất → kiểm body bằng `schema`
 * → `run`. Kích thước và Content-Type do `parseAndValidateJson` kiểm. `allowEmpty` cho phép body rỗng.
 */
export function documentActionRoute<T>(
  schema: ZodType<T>,
  run: (user: AuthenticatedUser, body: T, call: DocumentActionCall) => Promise<unknown>,
  options: { allowEmpty?: boolean } = {}
) {
  return async function POST(req: NextRequest, context: RouteContext) {
    let requestId = crypto.randomUUID();
    try {
      assertCsrf(req);
      const apiCtx = await getApiContext(req);
      requestId = apiCtx.requestId;
      const authUser = requireAuthenticated(apiCtx);
      await assertRateLimit(authUser.id, "MUTATIONS_SENSITIVE");

      const { id } = await context.params;
      const body = await parseAndValidateJson(req, schema, { allowEmpty: options.allowEmpty ?? false });

      const result = await run(authUser, body, { documentId: id, requestId, req });
      return apiSuccess(result, { requestId });
    } catch (error) {
      return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
    }
  };
}
