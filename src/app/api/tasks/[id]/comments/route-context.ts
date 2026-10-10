import { NextRequest } from "next/server";
import type { ZodType } from "zod";
import type { SessionPayload } from "@/lib/jwt-session";
import { ValidationError } from "@/server/api/errors";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import {
  assertJsonContentType,
  assertRequestBodySize,
  MAX_PAYLOAD_SIZE,
  parseAndValidateJson,
} from "@/server/api/validation";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";

export interface CommentRouteContext {
  params: Promise<{ id: string; commentId?: string }>;
}

/** Xác thực, chống CSRF, giới hạn tốc độ và đọc body (nếu có) cho các route bình luận. */
export async function resolveCommentRequest<T = undefined>(
  request: NextRequest,
  context: CommentRouteContext,
  options: { mutate: boolean; schema?: ZodType<T> }
): Promise<{ session: SessionPayload; taskId: string; commentId?: string; body: T; requestId: string }> {
  if (options.mutate) {
    assertCsrf(request);
    if (options.schema) {
      assertJsonContentType(request);
      assertRequestBodySize(request, MAX_PAYLOAD_SIZE);
    }
  }

  const apiContext = await getApiContext(request);
  const user = requireAuthenticated(apiContext);
  await assertRateLimit(user.id, options.mutate ? "MUTATIONS_SENSITIVE" : "DEFAULT_API");

  const { id, commentId } = await Promise.resolve(context.params);
  if (!id?.trim()) throw new ValidationError("Mã nhiệm vụ (id) không hợp lệ");

  const body = options.schema ? await parseAndValidateJson(request, options.schema) : (undefined as T);
  return { session: user as unknown as SessionPayload, taskId: id, commentId, body, requestId: apiContext.requestId };
}
