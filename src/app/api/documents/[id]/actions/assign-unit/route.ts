import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assignUnitWork } from "@/lib/services/incoming-document-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);

    const { id } = await context.params;
    const body = await req.json();

    const result = await assignUnitWork(
      {
        documentId: id,
        driUserId: body.driUserId,
        collaboratorUserIds: body.collaboratorUserIds,
        instruction: body.instruction,
        deadline: body.deadline,
        createTask: body.createTask,
        taskTitle: body.taskTitle,
      },
      authUser as any,
      requestId
    );

    return apiSuccess(result, {
      requestId,
      status: 200,
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}
