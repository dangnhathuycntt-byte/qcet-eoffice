import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { NotFoundError, ForbiddenError } from "@/server/api/errors";
import { canReadDocument } from "@/server/policies/document-policy";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { authorize } from "@/server/authorization/authorization-engine";
import { buildDocumentResource } from "@/server/authorization/available-actions";
import { prisma } from "@/lib/prisma";

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

    const workflow = await prisma.documentOutgoingWorkflow.findFirst({
      where: { documentId: id },
      include: {
        document: {
          include: {
            attachments: true,
            signatures: { orderBy: { signedAt: "asc" } },
          },
        },
        contentReviewer: { select: { id: true, name: true, email: true } },
        formatReviewer: { select: { id: true, name: true, email: true } },
        authorizedSigner: { select: { id: true, name: true, email: true } },
        numberer: { select: { id: true, name: true, email: true } },
        orgSigner: { select: { id: true, name: true, email: true } },
        issuer: { select: { id: true, name: true, email: true } },
      },
    });

    if (!workflow) {
      throw new NotFoundError("Không tìm thấy quy trình xử lý văn bản đi.");
    }

    if (workflow.document) {
      const authContext = await loadAuthorizationContext(authUser.id);
      const docResource = buildDocumentResource(workflow.document);
      const readDecision = authorize(authContext, "document.read", docResource);
      if (!readDecision.allowed || !canReadDocument(authUser, workflow.document)) {
        throw new ForbiddenError(
          readDecision.reason || "Bạn không có quyền truy cập văn bản đi này"
        );
      }
    }

    return apiSuccess(workflow, { requestId, status: 200 });
  } catch (error) {
    return apiError(error, requestId);
  }
}
