import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { getIncomingDocument } from "@/lib/services/incoming-document-service";
import { NotFoundError, ForbiddenError } from "@/server/api/errors";
import { canReadDocument } from "@/server/policies/document-policy";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { authorize } from "@/server/authorization/authorization-engine";
import { buildDocumentResource } from "@/server/authorization/available-actions";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);

    const { id } = await context.params;

    const workflow = await getIncomingDocument(id, authUser as any);
    if (!workflow) {
      throw new NotFoundError("Không tìm thấy quy trình xử lý văn bản đến.");
    }

    if (workflow.document) {
      const authContext = await loadAuthorizationContext(authUser.id);
      const docResource = buildDocumentResource(workflow.document);
      const readDecision = authorize(authContext, 'document.read', docResource);
      if (!readDecision.allowed || !canReadDocument(authUser, workflow.document)) {
        throw new ForbiddenError(
          readDecision.reason || "Bạn không có quyền truy cập quy trình văn bản này"
        );
      }
    }

    return apiSuccess(workflow, {
      requestId,
      status: 200,
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}
