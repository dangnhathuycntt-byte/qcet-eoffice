/**
 * Bình luận nhiệm vụ (T-03, spec task-document-gap-spec.md).
 *
 * - Đọc cần task.read; ghi cần task.comment (người giao, chủ trì, phối hợp, theo dõi,
 *   người duyệt được chỉ định, trưởng đơn vị trong phạm vi). Người quan sát chỉ đọc.
 * - Nội dung là văn bản thuần, tối đa 2000 ký tự. Giao diện không render HTML.
 * - Sửa, xóa: chỉ tác giả. Xóa là xóa mềm; nội dung không còn trả về nhưng bản ghi
 *   và dòng Hoạt động được giữ.
 * - Nhắc tên: người có vai trò trên nhiệm vụ và người cùng đơn vị (phân công còn hiệu lực) với người viết,
 *   gửi qua outbox. Người cùng đơn vị chưa có vai trò được tự thêm làm người theo dõi để mở được nhiệm vụ
 *   (người dùng chốt 13/10/2026), có ghi nhật ký TASK_PERSON_ADDED.
 * - Thả emoji: cần task.comment, chỉ bộ emoji cố định, không vào bình luận đã xóa.
 *   Không ghi nhật ký và không gửi thông báo (thao tác nhẹ, bật tắt liên tục).
 */
import { z } from "zod";
import { AssignmentStatus, TaskActorRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import { publishOutboxEvent, OutboxEventType, OutboxAggregateType } from "@/lib/db/outbox";
import type { SessionPayload } from "@/lib/jwt-session";
import { ForbiddenError, InvalidTransitionError, NotFoundError } from "@/server/api/errors";
import { authorizeOnTask, can } from "./authorize-on-task";
import {
  isCommentReactionEmoji,
  summarizeCommentReactions,
  type CommentReactionSummary,
} from "@/domain/tasks/comment-reactions";

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
  author: { id: string; name: string; avatarUrl: string | null };
  body: string | null;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
  canEdit: boolean;
  reactions: CommentReactionSummary[];
}

type CommentRow = {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  author: { id: string; name: string; avatarUrl: string | null };
  reactions?: Array<{ emoji: string; userId: string; createdAt: Date; user: { name: string } }>;
};

function toDTO(row: CommentRow, viewerId: string): TaskCommentDTO {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    taskId: row.taskId,
    author: { id: row.author.id, name: row.author.name, avatarUrl: row.author.avatarUrl },
    body: deleted ? null : row.body,
    deleted,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    canEdit: !deleted && row.authorId === viewerId,
    reactions: deleted
      ? []
      : summarizeCommentReactions(
          (row.reactions ?? []).map((r) => ({ emoji: r.emoji, userId: r.userId, userName: r.user.name, createdAt: r.createdAt })),
          viewerId
        ),
  };
}

const AUTHOR_SELECT = { select: { id: true, name: true, avatarUrl: true } } as const;
const REACTIONS_INCLUDE = { select: { emoji: true, userId: true, createdAt: true, user: { select: { name: true } } } } as const;

export interface MentionCandidateDTO {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** false: người cùng đơn vị chưa có vai trò, nhắc tên sẽ thêm làm người theo dõi. */
  inTask: boolean;
}

export interface TaskCommentList {
  comments: TaskCommentDTO[];
  /** Những người có thể được nhắc tên: người có vai trò trên nhiệm vụ, rồi người cùng đơn vị với người xem. */
  participants: MentionCandidateDTO[];
  /** Người đang xem (avatar cạnh ô viết) và quyền bình luận, để ẩn ô viết khi không có quyền. */
  viewer: { id: string; name: string; avatarUrl: string | null } | null;
  canComment: boolean;
}

function taskParticipantIds(task: { createdById: string; actors: Array<{ userId: string | null }> }): Set<string> {
  return new Set([task.createdById, ...task.actors.map((a) => a.userId).filter((id): id is string => Boolean(id))]);
}

/** Điều kiện phân công còn hiệu lực tại thời điểm `now`. */
function activeAssignmentWhere(now: Date) {
  return { status: AssignmentStatus.ACTIVE, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] };
}

/** Người cùng đơn vị (phân công còn hiệu lực) với `userId`, không gồm chính họ. */
async function sameUnitPeople(userId: string) {
  const now = new Date();
  const units = await prisma.positionAssignment.findMany({ where: { userId, ...activeAssignmentWhere(now) }, select: { unitId: true } });
  if (units.length === 0) return [];
  return prisma.user.findMany({
    where: {
      id: { not: userId },
      isActive: true,
      positionAssignments: { some: { unitId: { in: [...new Set(units.map((u) => u.unitId))] }, ...activeAssignmentWhere(now) } },
    },
    select: { id: true, name: true, avatarUrl: true },
    orderBy: { name: "asc" },
    take: 300,
  });
}

/** Danh sách nhắc tên: người có vai trò trên nhiệm vụ trước, rồi người cùng đơn vị chưa có vai trò. */
async function listMentionCandidates(task: { createdById: string; actors: Array<{ userId: string | null }> }, viewerId: string): Promise<MentionCandidateDTO[]> {
  const inTaskIds = [...taskParticipantIds(task)].filter((id) => id !== viewerId);
  const [inTask, colleagues] = await Promise.all([
    inTaskIds.length
      ? prisma.user.findMany({ where: { id: { in: inTaskIds }, isActive: true }, select: { id: true, name: true, avatarUrl: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    sameUnitPeople(viewerId),
  ]);
  const seen = new Set(inTask.map((u) => u.id));
  return [
    ...inTask.map((u) => ({ ...u, inTask: true })),
    ...colleagues.filter((u) => !seen.has(u.id)).map((u) => ({ ...u, inTask: false })),
  ];
}

export async function listTaskComments(session: SessionPayload, taskId: string): Promise<TaskCommentList> {
  const task = await authorizeOnTask(session, taskId, "task.read");
  const rows = await prisma.taskComment.findMany({
    where: { taskId },
    include: { author: AUTHOR_SELECT, reactions: REACTIONS_INCLUDE },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const [participants, viewer, commentCheck] = await Promise.all([
    listMentionCandidates(task, session.id),
    prisma.user.findUnique({ where: { id: session.id }, ...AUTHOR_SELECT }),
    can(session, "task.comment", task),
  ]);
  return { comments: rows.map((row) => toDTO(row, session.id)), participants, viewer, canComment: commentCheck.allowed };
}

export async function createTaskComment(
  session: SessionPayload,
  taskId: string,
  input: CreateTaskCommentInput
): Promise<TaskCommentDTO> {
  const validated = CreateTaskCommentSchema.parse(input);
  const task = await authorizeOnTask(session, taskId, "task.comment");
  if (task.archivedAt) throw new InvalidTransitionError("Nhiệm vụ đã lưu trữ nên không bình luận thêm");

  // Nhắc được người có vai trò trên nhiệm vụ và người cùng đơn vị với người viết; không nhắc chính mình.
  const participantIds = taskParticipantIds(task);
  const requested = [...new Set(validated.mentionUserIds ?? [])].filter((id) => id !== session.id);
  const outsiders = requested.filter((id) => !participantIds.has(id));
  const colleagueIds = outsiders.length ? new Set((await sameUnitPeople(session.id)).map((u) => u.id)) : new Set<string>();
  const allowed = requested.filter((id) => participantIds.has(id) || colleagueIds.has(id));
  const mentionable = allowed.length
    ? (await prisma.user.findMany({ where: { id: { in: allowed }, isActive: true }, select: { id: true } })).map((u) => u.id)
    : [];
  const newFollowers = mentionable.filter((id) => !participantIds.has(id));

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

    // Người cùng đơn vị được nhắc mà chưa có vai trò: thêm làm người theo dõi để mở được nhiệm vụ từ thông báo.
    // Không tăng version nhiệm vụ: chỉ thêm người xem, không đổi dữ liệu đang sửa, tránh làm form khác báo xung đột.
    for (const userId of newFollowers) {
      await tx.taskActor.create({
        data: { taskId, userId, role: TaskActorRole.FOLLOWER, isPrimaryDRI: false, assignedById: session.id, appointedAt: new Date() },
      });
      await auditService.logEvent(tx, {
        actorId: session.id,
        action: AuditAction.TASK_PERSON_ADDED,
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        beforeData: { userId, role: null },
        afterData: { userId, role: TaskActorRole.FOLLOWER, via: "mention", commentId: row.id },
      });
    }

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
      // Giữ emoji đã thả trong kết quả sửa để giao diện không làm mất chúng
      include: { author: AUTHOR_SELECT, reactions: REACTIONS_INCLUDE },
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

export const SetCommentReactionSchema = z.object({
  emoji: z.string().refine(isCommentReactionEmoji, "Emoji không được hỗ trợ"),
  /** true: thả emoji; false: gỡ. Gửi lại cùng giá trị không đổi gì (idempotent). */
  active: z.boolean(),
});
export type SetCommentReactionInput = z.infer<typeof SetCommentReactionSchema>;

/** Thả hoặc gỡ một emoji của người đang xem trên bình luận; trả về danh sách emoji mới của bình luận đó. */
export async function setTaskCommentReaction(
  session: SessionPayload,
  taskId: string,
  commentId: string,
  input: SetCommentReactionInput
): Promise<{ commentId: string; reactions: CommentReactionSummary[] }> {
  const validated = SetCommentReactionSchema.parse(input);
  await authorizeOnTask(session, taskId, "task.comment");
  const comment = await prisma.taskComment.findFirst({ where: { id: commentId, taskId }, select: { id: true, deletedAt: true } });
  if (!comment || comment.deletedAt) throw new NotFoundError("Không tìm thấy bình luận");

  const key = { commentId_userId_emoji: { commentId, userId: session.id, emoji: validated.emoji } };
  if (validated.active) {
    await prisma.taskCommentReaction.upsert({ where: key, create: { commentId, userId: session.id, emoji: validated.emoji }, update: {} });
  } else {
    await prisma.taskCommentReaction.deleteMany({ where: { commentId, userId: session.id, emoji: validated.emoji } });
  }

  const rows = await prisma.taskCommentReaction.findMany({ where: { commentId }, ...REACTIONS_INCLUDE });
  return {
    commentId,
    reactions: summarizeCommentReactions(
      rows.map((r) => ({ emoji: r.emoji, userId: r.userId, userName: r.user.name, createdAt: r.createdAt })),
      session.id
    ),
  };
}
