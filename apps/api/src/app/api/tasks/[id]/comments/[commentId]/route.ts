import { NextRequest } from "next/server";
import { ValidationError } from "@/server/api/errors";
import { apiError, apiSuccess } from "@/server/api/response";
import {
  UpdateTaskCommentSchema,
  deleteTaskComment,
  updateTaskComment,
} from "@/server/tasks/task-comment-service";
import { CommentRouteContext, resolveCommentRequest } from "../route-context";

/** PATCH /api/tasks/{id}/comments/{commentId} — tác giả sửa bình luận (T-03). */
export async function PATCH(request: NextRequest, context: CommentRouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveCommentRequest(request, context, { mutate: true, schema: UpdateTaskCommentSchema });
    requestId = ctx.requestId;
    if (!ctx.commentId) throw new ValidationError("Mã bình luận không hợp lệ");
    const comment = await updateTaskComment(ctx.session, ctx.taskId, ctx.commentId, ctx.body);
    return apiSuccess({ comment }, { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}

/** DELETE /api/tasks/{id}/comments/{commentId} — tác giả xóa mềm bình luận (T-03). */
export async function DELETE(request: NextRequest, context: CommentRouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveCommentRequest(request, context, { mutate: true });
    requestId = ctx.requestId;
    if (!ctx.commentId) throw new ValidationError("Mã bình luận không hợp lệ");
    const result = await deleteTaskComment(ctx.session, ctx.taskId, ctx.commentId);
    return apiSuccess(result, { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
