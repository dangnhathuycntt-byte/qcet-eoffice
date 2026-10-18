import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiSuccess, apiError } from "@/server/api/response";
import { NotFoundError } from "@/server/api/errors";
import { loadAuthorizationContext } from "@/server/authorization";
import { assertDocumentReadable } from "@/server/documents/authorize-on-document";
import {
  buildDocumentAuditTimeline,
  findDocumentForAuditTimeline,
} from "@/server/documents/document-audit-timeline";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  let requestId = crypto.randomUUID();
  try {
    const apiContext = await getApiContext(request);
    requestId = apiContext.requestId;
    const authUser = requireAuthenticated(apiContext);

    const { id } = await Promise.resolve(context.params);

    // 1. Fetch document from DB
    const document = await findDocumentForAuditTimeline(id);

    if (!document) {
      throw new NotFoundError("Văn bản không tồn tại", "DOCUMENT_NOT_FOUND");
    }

    // 2. Authorization check
    const authContext = await loadAuthorizationContext(authUser.id);
    assertDocumentReadable(authContext, authContext, document as any, "Bạn không có quyền truy cập lịch sử văn bản này");

    // 3–4. Audit events + 5-step lifecycle timeline
    const payload = await buildDocumentAuditTimeline(id, document);

    return apiSuccess(
      {
        success: true,
        data: payload,
        ...payload,
      },
      {
        headers: { "Cache-Control": "private, no-store" },
        requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}
