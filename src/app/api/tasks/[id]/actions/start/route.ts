import { StartInputSchema, taskDomainActionService } from "@/lib/services/task-domain-actions";
import { taskActionRoute } from "../shared";

export const POST = taskActionRoute(StartInputSchema, "task.update_execution", (session, taskId, body) =>
  taskDomainActionService.start(session, taskId, body)
);
