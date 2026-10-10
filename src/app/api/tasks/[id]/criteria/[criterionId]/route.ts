import { NextRequest } from "next/server";
import { ValidationError } from "@/server/api/errors";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { CheckCriterionSchema, setTaskCriterionChecked } from "@/server/tasks/task-criteria-service";

/** PATCH /api/tasks/{id}/criteria/{criterionId} — người duyệt đánh dấu tiêu chí (T-04). */
export async function PATCH(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, {
      mutate: true,
      schema: CheckCriterionSchema,
      subIdKey: "criterionId",
    });
    requestId = ctx.requestId;
    if (!ctx.subId) throw new ValidationError("Mã tiêu chí không hợp lệ");
    const view = await setTaskCriterionChecked(ctx.session, ctx.taskId, ctx.subId, ctx.body);
    return apiSuccess(view, { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
