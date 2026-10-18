import { UpdateProgressInputSchema, taskDomainActionService } from "@/server/tasks/task-domain-actions";
import { taskActionRoute } from "../shared";

export const POST = taskActionRoute(UpdateProgressInputSchema, "task.update_execution", (session, taskId, body) =>
  taskDomainActionService.updateProgress(session, taskId, body)
);
