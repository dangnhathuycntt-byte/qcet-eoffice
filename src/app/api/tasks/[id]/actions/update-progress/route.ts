import { UpdateProgressInputSchema, taskDomainActionService } from "@/lib/services/task-domain-actions";
import { taskActionRoute } from "../shared";

export const POST = taskActionRoute(UpdateProgressInputSchema, "task.update_execution", (session, taskId, body) =>
  taskDomainActionService.updateProgress(session, taskId, body)
);
