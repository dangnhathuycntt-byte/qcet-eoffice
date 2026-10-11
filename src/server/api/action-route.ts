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

export interface IdActionCall {
  id: string;
  requestId: string;
  req: NextRequest;
}

export interface IdActionRouteOptions {
  /** Cho phép body rỗng (schema phải chấp nhận `{}`). */
  allowEmpty?: boolean;
  /** Giữ định dạng lỗi cũ (không RFC 9457) cho các route client còn phụ thuộc. */
  legacyErrors?: boolean;
}

/**
 * POST chuyển trạng thái trên `/…/{id}/actions/*`: CSRF → xác thực → giới hạn tần suất → kiểm body
 * bằng `schema` → `run`. Kích thước và Content-Type do `parseAndValidateJson` kiểm.
 */
export function idActionRoute<T>(
  schema: ZodType<T>,
  run: (user: AuthenticatedUser, body: T, call: IdActionCall) => Promise<unknown>,
  options: IdActionRouteOptions = {}
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

      const result = await run(authUser, body, { id, requestId, req });
      return apiSuccess(result, { requestId, status: 200 });
    } catch (error) {
      return apiError(
        error,
        requestId,
        options.legacyErrors ? undefined : { rfc9457: true, instance: req.nextUrl.pathname }
      );
    }
  };
}
