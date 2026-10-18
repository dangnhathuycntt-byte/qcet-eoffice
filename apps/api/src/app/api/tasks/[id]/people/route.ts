import { NextRequest } from "next/server";
import {
  AddPersonInputSchema,
  RemovePersonInputSchema,
  taskDomainActionService,
} from "@/server/tasks/task-domain-actions";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest } from "@/server/api/task-subresource-request";
import { getTaskPeople } from "@/server/tasks/task-people-view";
import { type ActionRouteContext, taskActionRoute } from "../actions/shared";

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
export const POST = taskActionRoute(
  AddPersonInputSchema,
  "task.assign",
  (session, taskId, body) => taskDomainActionService.addPerson(session, taskId, body),
  { status: (result) => (result.changed ? 201 : 200) }
);

/** DELETE /api/tasks/{id}/people — bớt người phối hợp hoặc người theo dõi (T-07). */
export const DELETE = taskActionRoute(RemovePersonInputSchema, "task.assign", (session, taskId, body) =>
  taskDomainActionService.removePerson(session, taskId, body)
);
