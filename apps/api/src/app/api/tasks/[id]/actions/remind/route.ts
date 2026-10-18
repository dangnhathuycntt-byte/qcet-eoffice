import { RemindInputSchema, taskDomainActionService } from "@/server/tasks/task-domain-actions";
import { taskActionRoute } from "../shared";

export const POST = taskActionRoute(RemindInputSchema, "task.remind", (session, taskId, body) =>
  taskDomainActionService.remind(session, taskId, body)
);
