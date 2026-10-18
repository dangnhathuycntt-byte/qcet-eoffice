import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { NotFoundError } from "@/server/api/errors";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { assertDocumentReadable } from "@/server/documents/authorize-on-document";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";

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

    const workflow = await OutgoingDocumentService.getOutgoingDocument(id);

    if (!workflow) {
      throw new NotFoundError("Không tìm thấy quy trình xử lý văn bản đi.");
    }

    if (workflow.document) {
      assertDocumentReadable(
        await loadAuthorizationContext(authUser.id),
        authUser,
        workflow.document,
        "Bạn không có quyền truy cập văn bản đi này"
      );
    }

    return apiSuccess(workflow, { requestId, status: 200 });
  } catch (error) {
    return apiError(error, requestId);
  }
}
