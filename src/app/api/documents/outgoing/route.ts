import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { CreateOutgoingDraftSchema, WorkflowListPaginationSchema } from "@qcet/contracts/documents";
import { parseAndValidateJson } from "@/server/api/validation";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";

export async function GET(req: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    // Tham số rỗng dùng mặc định; ngoài khoảng/không phải số nguyên → 400 (trước đây NaN, số âm vào thẳng Prisma).
    const { limit, offset } = WorkflowListPaginationSchema.parse({
      limit: url.searchParams.get("limit") || undefined,
      offset: url.searchParams.get("offset") || undefined,
    });
    const search = url.searchParams.get("search") || undefined;

    // ACL được áp trong truy vấn của service (phân trang và tổng số không lộ văn bản ngoài quyền).
    const { items, total } = await OutgoingDocumentService.listOutgoingWorkflows(authUser, {
      status: statusParam,
      limit,
      offset,
      search,
    });

    return apiSuccess({ items, total, limit, offset }, { requestId, status: 200 });
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

    const body = await parseAndValidateJson(req, CreateOutgoingDraftSchema);
    const result = await OutgoingDocumentService.createOutgoingDraft(
      body,
      authUser as any,
      { requestId }
    );

    return apiSuccess(result, {
      requestId,
      status: 201,
    });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
