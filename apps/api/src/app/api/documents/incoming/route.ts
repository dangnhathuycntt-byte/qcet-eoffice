import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { registerIncomingDocument, listIncomingWorkflows } from "@/server/documents/incoming-document-service";
import { IncomingWorkflowListQuerySchema, RegisterIncomingDocumentSchema } from "@qcet/contracts/documents";
import { assertNoSuspectedDuplicate } from "@/server/documents/duplicate-check";
import { parseAndValidateJson } from "@/server/api/validation";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
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

export async function POST(req: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    assertCsrf(req);
    await assertRateLimit(authUser.id, "MUTATIONS_SENSITIVE");

    const { acknowledgeDuplicate, ...body } = await parseAndValidateJson(req, RegisterIncomingDocumentSchema);

    await assertNoSuspectedDuplicate(authUser, {
      originalNumber: body.originalNumber || body.originalDocNumber || (typeof body.documentNumber === "string" ? body.documentNumber : null),
      issuingAuthority: body.issuingAuthority || body.sender,
      acknowledgeDuplicate,
    });

    const result = await registerIncomingDocument(
      body,
      authUser as any,
      requestId
    );

    return apiSuccess(result, {
      requestId,
      status: 201,
    });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
