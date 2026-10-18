import { ReviewInputSchema, taskDomainActionService } from "@/server/tasks/task-domain-actions";
import { taskActionRoute } from "../shared";

export const POST = taskActionRoute(ReviewInputSchema, "task.review", (session, taskId, body) =>
  taskDomainActionService.review(session, taskId, body)
);
