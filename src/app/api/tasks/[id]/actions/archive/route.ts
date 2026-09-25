import { NextRequest } from "next/server";
import { ArchiveTaskSchema } from "@/contracts/tasks";
import { taskCommandService } from "@/server/tasks";
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
      ArchiveTaskSchema,
      "task.archive"
    );
    requestId = reqId;
    const result = await taskCommandService.archiveTask({ user: session }, taskId, body);
    return apiSuccess({ success: true, data: result }, { requestId });
  } catch (error) {
    return handleActionError(error, requestId);
  }
}
