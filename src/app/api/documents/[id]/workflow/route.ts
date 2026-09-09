import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { getIncomingDocument } from "@/lib/services/incoming-document-service";
import { NotFoundError } from "@/server/api/errors";

interface RouteContext {
  params: { id: string } | Promise<{ id: string }>;
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

    return apiSuccess(workflow, {
      requestId,
      status: 200,
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}
