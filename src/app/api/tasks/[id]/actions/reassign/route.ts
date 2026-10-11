import { ReassignInputSchema, taskDomainActionService } from "@/lib/services/task-domain-actions";
import { taskActionRoute } from "../shared";

export const POST = taskActionRoute(ReassignInputSchema, "task.reassign", (session, taskId, body) =>
  taskDomainActionService.reassign(session, taskId, body)
);
