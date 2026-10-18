import { UpdateStatusInputSchema, taskDomainActionService } from "@/server/tasks/task-domain-actions";
import { taskActionRoute } from "../shared";

export const POST = taskActionRoute(
  UpdateStatusInputSchema,
  "task.update_execution",
  (session, taskId, body) => taskDomainActionService.updateStatus(session, taskId, body),
  { rfc9457: true }
);
