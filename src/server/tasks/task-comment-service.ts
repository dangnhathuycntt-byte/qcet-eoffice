/**
 * Bình luận nhiệm vụ (T-03, spec task-document-gap-spec.md).
 *
 * - Đọc cần task.read; ghi cần task.comment (người giao, chủ trì, phối hợp, theo dõi,
 *   người duyệt được chỉ định, trưởng đơn vị trong phạm vi). Người quan sát chỉ đọc.
 * - Nội dung là văn bản thuần, tối đa 2000 ký tự. Giao diện không render HTML.
 * - Sửa, xóa: chỉ tác giả. Xóa là xóa mềm; nội dung không còn trả về nhưng bản ghi
 *   và dòng Hoạt động được giữ.
 * - Nhắc tên giới hạn trong những người có vai trò trên nhiệm vụ, gửi qua outbox.
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import { publishOutboxEvent, OutboxEventType, OutboxAggregateType } from "@/lib/db/outbox";
import type { SessionPayload } from "@/lib/jwt-session";
import { authorize } from "@/server/authorization/authorization-engine";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { buildTaskResource } from "@/server/authorization/available-actions";
import type { CapabilityAction } from "@/server/authorization/capability";
import { ForbiddenError, InvalidTransitionError, NotFoundError } from "@/server/api/errors";

const COMMENT_BODY = z
  .string()
  .trim()
  .min(1, "Nội dung bình luận không được để trống")
  .max(2000, "Bình luận tối đa 2000 ký tự")
  .refine((value) => !value.includes("\u0000"), "Nội dung chứa ký tự không hợp lệ");

export const CreateTaskCommentSchema = z
  .object({
    body: COMMENT_BODY,
    mentionUserIds: z.array(z.string().trim().min(1)).max(10).optional(),
  })
  .strict();

export const UpdateTaskCommentSchema = z.object({ body: COMMENT_BODY }).strict();

export type CreateTaskCommentInput = z.infer<typeof CreateTaskCommentSchema>;
export type UpdateTaskCommentInput = z.infer<typeof UpdateTaskCommentSchema>;

export interface TaskCommentDTO {
  id: string;
  taskId: string;
  author: { id: string; name: string };
  body: string | null;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
  canEdit: boolean;
}

type CommentRow = {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  author: { id: string; name: string };
};

function toDTO(row: CommentRow, viewerId: string): TaskCommentDTO {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    taskId: row.taskId,
    author: { id: row.author.id, name: row.author.name },
    body: deleted ? null : row.body,
    deleted,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    canEdit: !deleted && row.authorId === viewerId,
  };
}

async function authorizeOnTask(session: SessionPayload, taskId: string, action: CapabilityAction) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { actors: true } });
  if (!task) throw new NotFoundError("Không tìm thấy nhiệm vụ");
  const context = await loadAuthorizationContext(session.id, new Date(), { useCache: true, ttlMs: 10_000 });
  const decision = authorize(context, action, buildTaskResource(task));
  if (!decision.allowed) {
    throw new ForbiddenError(decision.reason || "Bạn không có quyền thực hiện thao tác này");
  }
  return task;
}

const AUTHOR_SELECT = { select: { id: true, name: true } } as const;

export interface TaskCommentList {
  comments: TaskCommentDTO[];
  /** Những người có thể được nhắc tên: người giao và người có vai trò trên nhiệm vụ. */
  participants: Array<{ id: string; name: string }>;
}

async function listParticipants(task: { createdById: string; actors: Array<{ userId: string | null }> }, excludeId: string) {
  const ids = [...new Set([task.createdById, ...task.actors.map((a) => a.userId).filter((id): id is string => Boolean(id))])].filter(
    (id) => id !== excludeId
  );
  if (ids.length === 0) return [];
  return prisma.user.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listTaskComments(session: SessionPayload, taskId: string): Promise<TaskCommentList> {
  const task = await authorizeOnTask(session, taskId, "task.read");
  const rows = await prisma.taskComment.findMany({
    where: { taskId },
    include: { author: AUTHOR_SELECT },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return { comments: rows.map((row) => toDTO(row, session.id)), participants: await listParticipants(task, session.id) };
}

export async function createTaskComment(
  session: SessionPayload,
  taskId: string,
  input: CreateTaskCommentInput
): Promise<TaskCommentDTO> {
  const validated = CreateTaskCommentSchema.parse(input);
  const task = await authorizeOnTask(session, taskId, "task.comment");
  if (task.archivedAt) throw new InvalidTransitionError("Nhiệm vụ đã lưu trữ nên không bình luận thêm");

  // Chỉ nhắc được người có vai trò trên nhiệm vụ, và không nhắc chính mình.
  const participantIds = new Set<string>([task.createdById, ...task.actors.map((a) => a.userId).filter((id): id is string => Boolean(id))]);
  const requested = [...new Set(validated.mentionUserIds ?? [])].filter((id) => id !== session.id && participantIds.has(id));
  const mentionable = requested.length
    ? (await prisma.user.findMany({ where: { id: { in: requested }, isActive: true }, select: { id: true } })).map((u) => u.id)
    : [];

  return prisma.$transaction(async (tx) => {
    const row = await tx.taskComment.create({
      data: { taskId, authorId: session.id, body: validated.body },
      include: { author: AUTHOR_SELECT },
    });

    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.TASK_COMMENT_ADDED,
      entityType: AuditEntityType.TASK,
      entityId: taskId,
      beforeData: null,
      // Không lưu nội dung vào nhật ký bất biến để xóa mềm có hiệu lực.
      afterData: { commentId: row.id, mentions: mentionable.length },
    });

    if (mentionable.length > 0) {
      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.TASK_COMMENT_MENTION_NOTIFICATION,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId: taskId,
        payload: { taskId, commentId: row.id, authorId: session.id, mentionedUserIds: mentionable },
      });
    }

    return toDTO(row, session.id);
  });
}

async function loadOwnComment(session: SessionPayload, taskId: string, commentId: string) {
  const row = await prisma.taskComment.findFirst({ where: { id: commentId, taskId }, include: { author: AUTHOR_SELECT } });
  if (!row) throw new NotFoundError("Không tìm thấy bình luận");
  if (row.authorId !== session.id) throw new ForbiddenError("Chỉ tác giả được sửa hoặc xóa bình luận");
  if (row.deletedAt) throw new NotFoundError("Bình luận đã bị xóa");
  return row;
}

export async function updateTaskComment(
  session: SessionPayload,
  taskId: string,
  commentId: string,
  input: UpdateTaskCommentInput
): Promise<TaskCommentDTO> {
  const validated = UpdateTaskCommentSchema.parse(input);
  await authorizeOnTask(session, taskId, "task.comment");
  const existing = await loadOwnComment(session, taskId, commentId);

  return prisma.$transaction(async (tx) => {
    const row = await tx.taskComment.update({
      where: { id: existing.id },
      data: { body: validated.body, editedAt: new Date() },
      include: { author: AUTHOR_SELECT },
    });
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.TASK_COMMENT_EDITED,
      entityType: AuditEntityType.TASK,
      entityId: taskId,
      beforeData: null,
      afterData: { commentId: row.id },
    });
    return toDTO(row, session.id);
  });
}

export async function deleteTaskComment(
  session: SessionPayload,
  taskId: string,
  commentId: string
): Promise<{ id: string; deleted: true }> {
  await authorizeOnTask(session, taskId, "task.comment");
  const existing = await loadOwnComment(session, taskId, commentId);

  await prisma.$transaction(async (tx) => {
    await tx.taskComment.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.TASK_COMMENT_DELETED,
      entityType: AuditEntityType.TASK,
      entityId: taskId,
      beforeData: null,
      afterData: { commentId: existing.id },
    });
  });
  return { id: existing.id, deleted: true };
}
