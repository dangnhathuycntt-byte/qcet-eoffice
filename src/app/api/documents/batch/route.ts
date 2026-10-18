import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated, type AuthenticatedUser, normalizeRole } from "@/server/api/request-context";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import {
  assertJsonContentType,
  assertRequestBodySize,
  MAX_JSON_BODY_SIZE,
} from "@/server/api/validation";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  BatchDocumentRequestSchema,
  type BatchDocumentRequest,
} from "@/contracts/documents";
import {
  ForbiddenError,
  NotFoundError,
} from "@/server/api/errors";
import { isAdmin, isManager, isClerk } from "@/server/policies/document-policy";
import { processDocumentBatch } from "@/server/documents/document-batch-service";

/**
 * Checks if the user has authorization to perform batch operations on documents.
 * Restricted strictly to:
 * - Ban Giám hiệu / Lãnh đạo trường (Executive Leadership / Admin)
 * - Trưởng đơn vị / Trưởng phòng (Unit Managers)
 * - Văn thư cơ quan / Quản trị hồ sơ (Clerical Staff)
 */
function assertBatchAuthorization(user: AuthenticatedUser) {
  const userAdmin = isAdmin(user);
  const userManager = isManager(user);
  const userClerk = isClerk(user);

  const roleUpper = (user.role || "").toUpperCase();
  const posCode = (user.positionCode || "").toUpperCase();
  const titleUpper = (user.title || "").toUpperCase();

  const isExecutive =
    userAdmin ||
    roleUpper === "BAN_GIAM_HIEU" ||
    roleUpper === "HIEU_TRUONG" ||
    roleUpper === "PHO_HIEU_TRUONG" ||
    posCode === "HIEU_TRUONG" ||
    posCode === "PHO_HIEU_TRUONG";

  const isUnitHead =
    userManager ||
    roleUpper === "TRUONG_PHONG" ||
    roleUpper === "TRUONG_DON_VI" ||
    posCode.includes("TRUONG") ||
    posCode.includes("HEAD");

  const isClericalStaff =
    userClerk ||
    roleUpper === "VAN_THU" ||
    roleUpper === "CLERK" ||
    posCode === "VAN_THU" ||
    titleUpper.includes("VĂN THƯ");

  if (!isExecutive && !isUnitHead && !isClericalStaff) {
    throw new ForbiddenError(
      "Chỉ Ban Giám hiệu, Trưởng đơn vị hoặc Văn thư mới có quyền thực hiện thao tác văn bản hàng loạt.",
      "FORBIDDEN"
    );
  }
}

export async function POST(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    // 1. Role-Based Access Control
    assertBatchAuthorization(authUser);

    // 2. CSRF assertion on mutations
    assertCsrf(request);

    // 3. Content-Type and Body size limits
    assertJsonContentType(request);
    assertRequestBodySize(request, MAX_JSON_BODY_SIZE);

    // 4. Rate limiting on mutations
    await assertRateLimit(authUser.id, "MUTATIONS_SENSITIVE");

    // 5. Parse and validate JSON input
    const rawBody = await request.json();
    const payload: BatchDocumentRequest = BatchDocumentRequestSchema.parse(rawBody);

    // 6. Execute atomic batch operations (one transaction, per-item failures collected)
    const result = await processDocumentBatch(payload, authUser, requestId);

    return apiSuccess(
      {
        success: true,
        data: result,
        summary: {
          total: result.total,
          successCount: result.successCount,
          failureCount: result.failureCount,
        },
      },
      {
        headers: { "Cache-Control": "private, no-store" },
        requestId,
        status: 200,
      }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}
