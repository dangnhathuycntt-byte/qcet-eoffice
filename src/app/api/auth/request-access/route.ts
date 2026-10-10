import { NextRequest } from "next/server";
import { z } from "zod";
import { logAuditEvent, AuditAction, AuditEntityType } from "@/lib/db/audit";
import { getApiContext } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { parseAndValidateJson } from "@/server/api/validation";
import { assertRateLimit } from "@/server/security/rate-limit";

const RequestAccessSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    name: z.string().trim().max(255).optional(),
  })
  .strict();

/**
 * POST /api/auth/request-access — endpoint công khai (chưa đăng nhập).
 * Giới hạn tần suất theo IP và validate độ dài để không bị dùng làm nguồn spam audit log.
 */
export async function POST(req: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    await assertRateLimit(`request-access:${context.ip || "unknown"}`, "AUTH_REGISTER");

    const { email, name } = await parseAndValidateJson(req, RequestAccessSchema, { maxBytes: 4 * 1024 });

    await logAuditEvent({
      action: AuditAction.ACCESS_REQUESTED,
      entityType: AuditEntityType.USER,
      entityId: email,
      metadata: {
        type: "ACCESS_REQUEST",
        email,
        name: name || undefined,
        timestamp: new Date().toISOString(),
        source: "LOGIN_FLOW",
        ip: context.ip,
      },
    });

    return apiSuccess(
      {
        success: true,
        message: "Đã gửi yêu cầu cấp quyền. Quản trị viên sẽ xem và phản hồi qua email.",
      },
      { requestId, headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return apiError(error, requestId, { "Cache-Control": "private, no-store" });
  }
}
