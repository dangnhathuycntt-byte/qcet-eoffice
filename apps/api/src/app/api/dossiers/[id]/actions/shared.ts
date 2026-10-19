import { NextRequest } from "next/server";
import type { ZodType } from "zod";
import { getApiContext, requireAuthenticated, type AuthenticatedUser } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import { readOptionalJsonBody } from "@/server/api/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Route chuyển trạng thái hồ sơ: body tùy chọn được kiểm bằng `schema` rồi chuyển cho dịch vụ kèm `dossierId`. */
export function dossierActionRoute<T>(
  schema: ZodType<T>,
  run: (user: AuthenticatedUser, input: T & { dossierId: string }) => Promise<unknown>
) {
  return async function POST(req: NextRequest, context: RouteContext) {
    let requestId = crypto.randomUUID();
    try {
      const apiCtx = await getApiContext(req);
      requestId = apiCtx.requestId;
      const authUser = requireAuthenticated(apiCtx);

      assertCsrf(req);
      await assertRateLimit(authUser.id, "MUTATIONS_SENSITIVE");

      const { id } = await Promise.resolve(context.params);
      const body = schema.parse(await readOptionalJsonBody(req));

      const result = await run(authUser, { ...body, dossierId: id });
      return apiSuccess(result, { requestId, status: 200 });
    } catch (error) {
      return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
    }
  };
}
