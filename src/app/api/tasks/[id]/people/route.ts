import { NextRequest } from "next/server";
import {
  AddPersonInputSchema,
  RemovePersonInputSchema,
  taskDomainActionService,
} from "@/lib/services/task-domain-actions";
import { apiSuccess } from "@/server/api/response";
import {
  ActionRouteContext,
  handleActionError,
  resolveActionContext,
} from "../actions/shared";

/** POST /api/tasks/{id}/people — thêm người phối hợp hoặc người theo dõi (T-07). */
export async function POST(request: NextRequest, context: ActionRouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const { session, taskId, body, requestId: reqId } = await resolveActionContext(
      request,
      context,
      AddPersonInputSchema,
      "task.assign"
    );
    requestId = reqId;
    const result = await taskDomainActionService.addPerson(session, taskId, body);
    return apiSuccess({ success: true, data: result }, { requestId, status: result.changed ? 201 : 200 });
  } catch (error) {
    return handleActionError(error, requestId);
  }
}

/** DELETE /api/tasks/{id}/people — bớt người phối hợp hoặc người theo dõi (T-07). */
export async function DELETE(request: NextRequest, context: ActionRouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const { session, taskId, body, requestId: reqId } = await resolveActionContext(
      request,
      context,
      RemovePersonInputSchema,
      "task.assign"
    );
    requestId = reqId;
    const result = await taskDomainActionService.removePerson(session, taskId, body);
    return apiSuccess({ success: true, data: result }, { requestId });
  } catch (error) {
    return handleActionError(error, requestId);
  }
}
