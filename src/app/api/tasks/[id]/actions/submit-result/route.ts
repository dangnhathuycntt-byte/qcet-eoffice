import { NextRequest } from "next/server";
import { taskDomainActionService } from "@/lib/services/task-domain-actions";
import { SubmitResultInputSchema } from "@/lib/services/task-domain-actions";
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
      SubmitResultInputSchema,
      "task.submit_result"
    );
    requestId = reqId;
    const result = await taskDomainActionService.submitResult(session, taskId, body);

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
