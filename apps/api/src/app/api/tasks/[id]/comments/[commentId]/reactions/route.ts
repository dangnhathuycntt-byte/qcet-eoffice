import { NextRequest } from "next/server";
import { ValidationError } from "@/server/api/errors";
import { apiError, apiSuccess } from "@/server/api/response";
import { SetCommentReactionSchema, setTaskCommentReaction } from "@/server/tasks/task-comment-service";
import { CommentRouteContext, resolveCommentRequest } from "../../route-context";

/** PUT /api/tasks/{id}/comments/{commentId}/reactions — thả (`active: true`) hoặc gỡ emoji của người đang xem. */
export async function PUT(request: NextRequest, context: CommentRouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveCommentRequest(request, context, { mutate: true, schema: SetCommentReactionSchema });
    requestId = ctx.requestId;
    if (!ctx.commentId) throw new ValidationError("Mã bình luận không hợp lệ");
    const result = await setTaskCommentReaction(ctx.session, ctx.taskId, ctx.commentId, ctx.body);
    return apiSuccess(result, { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
