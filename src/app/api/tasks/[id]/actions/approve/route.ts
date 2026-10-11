import { ApproveInputSchema, taskDomainActionService } from "@/lib/services/task-domain-actions";
import { taskActionRoute } from "../shared";

export const POST = taskActionRoute(
  ApproveInputSchema,
  "task.approve",
  (session, taskId, body) => taskDomainActionService.approve(session, taskId, body),
  { rfc9457: true }
);
