import { CancelInputSchema, taskDomainActionService } from "@/lib/services/task-domain-actions";
import { taskActionRoute } from "../shared";

export const POST = taskActionRoute(CancelInputSchema, "task.cancel", (session, taskId, body) =>
  taskDomainActionService.cancel(session, taskId, body)
);
