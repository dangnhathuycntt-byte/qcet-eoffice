import { NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import type { SessionPayload } from "@/lib/jwt-session";
import { ValidationError } from "./errors";
import { getApiContext, requireAuthenticated } from "./request-context";
import { assertJsonContentType, assertRequestBodySize, MAX_PAYLOAD_SIZE, parseAndValidateJson } from "./validation";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";

export interface TaskSubresourceContext {
  params: Promise<{ id: string } & Record<string, string | undefined>>;
}

/**
 * Xác thực, chống CSRF, giới hạn tốc độ và đọc body (nếu có) cho route con của nhiệm vụ
 * (bình luận, tiêu chí). `subIdKey` là tên tham số động thứ hai nếu route có.
 */
export async function resolveTaskSubresourceRequest<T = undefined>(
  request: NextRequest,
  context: TaskSubresourceContext,
  options: { mutate: boolean; schema?: ZodType<T>; subIdKey?: string; subjectLabel?: string }
): Promise<{ session: SessionPayload; taskId: string; subId?: string; body: T; requestId: string }> {
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

  const params = await Promise.resolve(context.params);
  if (!params.id?.trim()) throw new ValidationError(`Mã ${options.subjectLabel ?? "nhiệm vụ"} (id) không hợp lệ`);

  const body = options.schema ? await parseAndValidateJson(request, options.schema) : (undefined as T);
  return {
    session: user as unknown as SessionPayload,
    taskId: params.id,
    subId: options.subIdKey ? params[options.subIdKey] : undefined,
    body,
    requestId: apiContext.requestId,
  };
}

/**
 * Như `resolveTaskSubresourceRequest` nhưng cho route tập hợp không có `[id]` hoặc có `[id]` của
 * đối tượng khác (mẫu, lịch lặp lại). Body trả về chưa kiểm kiểu: dịch vụ tự kiểm bằng schema của nó.
 */
export async function resolveSessionRequest(
  request: NextRequest,
  options: { mutate: boolean; hasBody?: boolean; context?: TaskSubresourceContext }
): Promise<{ session: SessionPayload; id?: string; body: unknown; requestId: string }> {
  if (options.mutate) {
    assertCsrf(request);
    if (options.hasBody) {
      assertJsonContentType(request);
      assertRequestBodySize(request, MAX_PAYLOAD_SIZE);
    }
  }
  const apiContext = await getApiContext(request);
  const user = requireAuthenticated(apiContext);
  await assertRateLimit(user.id, options.mutate ? "MUTATIONS_SENSITIVE" : "DEFAULT_API");
  const params = options.context ? await Promise.resolve(options.context.params) : undefined;
  if (options.context && !params?.id?.trim()) throw new ValidationError("Mã (id) không hợp lệ");
  const body = options.hasBody ? await parseAndValidateJson(request, z.unknown()) : undefined;
  return { session: user as unknown as SessionPayload, id: params?.id, body, requestId: apiContext.requestId };
}
