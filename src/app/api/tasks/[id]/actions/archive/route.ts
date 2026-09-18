import { NextRequest, NextResponse } from "next/server";
import { ArchiveTaskSchema } from "@/contracts/tasks";
import { taskCommandService } from "@/server/tasks";
import {
  ActionRouteContext,
  handleActionError,
  resolveActionContext,
} from "../shared";

export async function POST(request: NextRequest, context: ActionRouteContext) {
  try {
    const { session, taskId, body } = await resolveActionContext(
      request,
      context,
      ArchiveTaskSchema,
      "task.archive"
    );
    const result = await taskCommandService.archiveTask({ user: session as any }, taskId, body);
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    return handleActionError(error);
  }
}
