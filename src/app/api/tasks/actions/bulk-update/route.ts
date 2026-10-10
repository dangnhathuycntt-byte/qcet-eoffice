import { NextRequest } from "next/server";
import { withIdempotency } from "@/lib/db/idempotency";
import type { SessionPayload } from "@/lib/jwt-session";
import { ValidationError } from "@/server/api/errors";
import { apiError, apiSuccess } from "@/server/api/response";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import {
  assertJsonContentType,
  assertRequestBodySize,
  MAX_PAYLOAD_SIZE,
  parseAndValidateJson,
} from "@/server/api/validation";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import { BulkUpdatePrioritySchema, bulkUpdateTaskPriority } from "@/server/tasks/task-bulk-service";

/**
 * POST /api/tasks/actions/bulk-update — đổi ưu tiên hàng loạt, tối đa 200 nhiệm vụ (T-08).
 * Bắt buộc `Idempotency-Key`; kết quả trả về từng dòng.
 */
export async function POST(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(request);
    assertJsonContentType(request);
    assertRequestBodySize(request, MAX_PAYLOAD_SIZE);

    const apiContext = await getApiContext(request);
    requestId = apiContext.requestId;
    const user = requireAuthenticated(apiContext);
    await assertRateLimit(user.id, "MUTATIONS_SENSITIVE");

    const key = (request.headers.get("idempotency-key") || request.headers.get("x-idempotency-key"))?.trim();
    if (!key || key.length > 255) {
      throw new ValidationError(
        "Đổi hàng loạt cần gửi Idempotency-Key (tối đa 255 ký tự).",
        { "Idempotency-Key": ["Bắt buộc; độ dài tối đa 255 ký tự."] },
        "IDEMPOTENCY_KEY_REQUIRED"
      );
    }

    const body = await parseAndValidateJson(request, BulkUpdatePrioritySchema);
    const result = await withIdempotency(
      { userId: user.id, operation: "task.bulk-update-priority", key, payload: body },
      () => bulkUpdateTaskPriority(user as unknown as SessionPayload, body)
    );
    return apiSuccess({ success: true, data: result }, { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
