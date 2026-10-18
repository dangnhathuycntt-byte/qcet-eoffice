/**
 * API Route: /api/page-data/tasks
 * GET - Dữ liệu ban đầu của trang Nhiệm vụ (src/app/tasks/page.tsx): mọi nhiệm vụ gốc đọc được theo góc nhìn
 * `?view=related|unit|all|approval`, kèm thao tác được phép trên từng nhiệm vụ.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { ValidationError } from "@/server/api/errors";
import { taskQueryService } from "@/server/tasks";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { buildTaskResource, computeAvailableActions } from "@/server/authorization/available-actions";
import type { SchoolTask } from "@qcet/contracts/types/dashboard";
import type { TasksPageData } from "@qcet/contracts/page-data";

const TaskViewParamSchema = z.enum(["related", "unit", "all", "approval"]).optional();

export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const user = requireAuthenticated(ctx);

    const view = TaskViewParamSchema.safeParse(request.nextUrl.searchParams.get("view") ?? undefined);
    if (!view.success) throw new ValidationError("Góc nhìn không hợp lệ", { view: ["related, unit, all hoặc approval"] });

    const authorizationContext = await loadAuthorizationContext(user.id);
    const { tasks } = await taskQueryService.queryTasks(authorizationContext, {
      all: true,
      parentTaskId: "root",
      view: view.data,
    });
    const authorizedTasks = tasks.map((task) => ({
      ...task,
      availableActions: computeAvailableActions(authorizationContext, buildTaskResource(task)),
    }));

    const data: TasksPageData = { tasks: authorizedTasks as unknown as SchoolTask[] };
    return apiSuccess(data, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId);
  }
}
