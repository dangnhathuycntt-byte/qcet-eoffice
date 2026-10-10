import { NextRequest } from "next/server";
import type { ZodType } from "zod";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";

export type CommentRouteContext = TaskSubresourceContext;

export async function resolveCommentRequest<T = undefined>(
  request: NextRequest,
  context: CommentRouteContext,
  options: { mutate: boolean; schema?: ZodType<T> }
) {
  const { subId, ...rest } = await resolveTaskSubresourceRequest(request, context, { ...options, subIdKey: "commentId" });
  return { ...rest, commentId: subId };
}
