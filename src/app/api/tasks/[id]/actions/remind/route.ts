import { NextRequest } from "next/server";
import { taskDomainActionService } from "@/lib/services/task-domain-actions";
import { RemindInputSchema } from "@/lib/services/task-domain-actions";
import { apiSuccess } from "@/server/api/response";
import {
  ActionRouteContext,
  handleActionError,
  resolveActionContext,
} from "../shared";

export async function POST(request: NextRequest, context: ActionRouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const { session, taskId, body, requestId: reqId } = await resolveActionContext(
      request,
      context,
      RemindInputSchema,
      "task.remind"
    );
    requestId = reqId;
    const result = await taskDomainActionService.remind(session, taskId, body);

    return apiSuccess(
      {
        success: true,
        data: result,
      },
      { requestId }
    );
  } catch (error) {
    return handleActionError(error, requestId);
  }
}
