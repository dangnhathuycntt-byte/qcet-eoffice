import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import {
  CreateTaskCommentSchema,
  createTaskComment,
  listTaskComments,
} from "@/server/tasks/task-comment-service";
import { CommentRouteContext, resolveCommentRequest } from "./route-context";

export const dynamic = "force-dynamic";

/** GET /api/tasks/{id}/comments — danh sách bình luận (T-03). */
export async function GET(request: NextRequest, context: CommentRouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveCommentRequest(request, context, { mutate: false });
    requestId = ctx.requestId;
    const result = await listTaskComments(ctx.session, ctx.taskId);
    return apiSuccess(
      result,
      { requestId, headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}

/** POST /api/tasks/{id}/comments — thêm bình luận (T-03). */
export async function POST(request: NextRequest, context: CommentRouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveCommentRequest(request, context, { mutate: true, schema: CreateTaskCommentSchema });
    requestId = ctx.requestId;
    const comment = await createTaskComment(ctx.session, ctx.taskId, ctx.body);
    return apiSuccess({ comment }, { requestId, status: 201 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
