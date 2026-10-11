import { SubmitResultInputSchema, taskDomainActionService } from "@/lib/services/task-domain-actions";
import { taskActionRoute } from "../shared";

export const POST = taskActionRoute(SubmitResultInputSchema, "task.submit_result", (session, taskId, body) =>
  taskDomainActionService.submitResult(session, taskId, body)
);
