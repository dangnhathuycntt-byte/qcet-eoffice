import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { listIncomingWorkflows } from "@/server/documents/incoming-document-service";
import { IncomingWorkflowListQuerySchema } from "@qcet/contracts/documents";
import { assertCsrf } from "@/server/security/csrf";
import { AuthorizationError } from "@/server/api/errors";
import { INCOMING_CREATE_FORBIDDEN_MESSAGE } from "@/server/policies/document-policy";
import { loadCachedAuthorizationContext } from "@/server/authorization/authorization-context-service";

export async function GET(req: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    const url = new URL(req.url);
    const leadUnitId = url.searchParams.get("leadUnitId") || undefined;
    const driUserId = url.searchParams.get("driUserId") || undefined;
    const leaderId = url.searchParams.get("leaderId") || undefined;
    const search = url.searchParams.get("search") || undefined;
    // Tham số rỗng dùng mặc định; trạng thái lạ, phân trang ngoài khoảng → 400 (trước đây vào thẳng Prisma, trả 500).
    const { status, limit, offset } = IncomingWorkflowListQuerySchema.parse({
      status: url.searchParams.get("status") || undefined,
      limit: url.searchParams.get("limit") || undefined,
      offset: url.searchParams.get("offset") || undefined,
    });

    // Ngữ cảnh đầy đủ (mọi chức danh/đơn vị, kể cả kiêm nhiệm): cùng điều kiện đọc với GET /api/documents.
    const result = await listIncomingWorkflows(await loadCachedAuthorizationContext(authUser.id), {
      status,
      leadUnitId,
      driUserId,
      leaderId,
      search,
      limit,
      offset,
    });

    return apiSuccess(result, {
      requestId,
      status: 200,
    });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}

/**
 * Không còn vào sổ văn bản đến (ADR-015): QCET chỉ gửi nhận trong trường, văn bản đến của đơn vị là văn bản đi đã
 * phát hành tới đơn vị đó. Giữ route để client cũ nhận 403 có lý do thay vì 405.
 */
export async function POST(req: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;
    requireAuthenticated(context);
    assertCsrf(req);
    throw new AuthorizationError(INCOMING_CREATE_FORBIDDEN_MESSAGE, "FORBIDDEN");
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
