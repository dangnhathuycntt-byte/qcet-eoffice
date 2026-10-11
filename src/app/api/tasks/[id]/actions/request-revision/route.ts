import { RequestRevisionInputSchema, taskDomainActionService } from "@/lib/services/task-domain-actions";
import { taskActionRoute } from "../shared";

export const POST = taskActionRoute(RequestRevisionInputSchema, "task.review", (session, taskId, body) =>
  taskDomainActionService.requestRevision(session, taskId, body)
);
