import { RemindInputSchema, taskDomainActionService } from "@/lib/services/task-domain-actions";
import { taskActionRoute } from "../shared";

export const POST = taskActionRoute(RemindInputSchema, "task.remind", (session, taskId, body) =>
  taskDomainActionService.remind(session, taskId, body)
);
