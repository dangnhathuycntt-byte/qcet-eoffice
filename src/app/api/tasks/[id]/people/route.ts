import { NextRequest } from "next/server";
import {
  AddPersonInputSchema,
  RemovePersonInputSchema,
  taskDomainActionService,
} from "@/lib/services/task-domain-actions";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest } from "@/server/api/task-subresource-request";
import { getTaskPeople } from "@/server/tasks/task-people-view";
import {
  ActionRouteContext,
  handleActionError,
  resolveActionContext,
} from "../actions/shared";

export const dynamic = "force-dynamic";

/** GET /api/tasks/{id}/people — người tham gia nhiệm vụ và quyền thêm, bớt của người xem (T-07). */
export async function GET(request: NextRequest, context: ActionRouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context as never, { mutate: false });
    requestId = ctx.requestId;
    return apiSuccess(await getTaskPeople(ctx.session, ctx.taskId), { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}

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
