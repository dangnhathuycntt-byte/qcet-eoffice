import { NextRequest, NextResponse } from "next/server";
import { taskDomainActionService } from "@/lib/services/task-domain-actions";
import { SubmitResultInputSchema } from "@/lib/services/task-domain-actions";
import {
  ActionRouteContext,
  handleActionError,
  resolveActionContext,
} from "../shared";

export async function POST(request: NextRequest, context: ActionRouteContext) {
  try {
    const { session, taskId, body } = await resolveActionContext(request, context, SubmitResultInputSchema, "task.submit_result");
    const result = await taskDomainActionService.submitResult(session, taskId, body);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleActionError(error);
  }
}
