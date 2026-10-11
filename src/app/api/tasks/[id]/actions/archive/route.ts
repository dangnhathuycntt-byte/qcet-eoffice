import { ArchiveTaskSchema } from "@/contracts/tasks";
import { taskCommandService } from "@/server/tasks";
import { taskActionRoute } from "../shared";

export const POST = taskActionRoute(ArchiveTaskSchema, "task.archive", (session, taskId, body) =>
  taskCommandService.archiveTask({ user: session }, taskId, body)
);
