/**
 * Ghi chú cá nhân: mọi truy vấn lọc theo `userId` của người gọi, không có đường đọc/sửa/xóa ghi chú của người khác (kể cả
 * lãnh đạo). Ghi chú không vào tìm kiếm chung, không gửi cho Trợ lý và không ghi audit (nội dung riêng tư).
 * Ghi chú không tồn tại hoặc của người khác đều trả 404 để không lộ sự tồn tại.
 */
import type { PersonalNote as PersonalNoteRow, Prisma } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import {
  PERSONAL_NOTES_PER_USER_MAX,
  type CreatePersonalNoteInput,
  type ListPersonalNotesQuery,
  type PersonalNote,
  type PersonalNoteEntityType,
  type PersonalNoteSummary,
  type UpdatePersonalNoteInput,
} from "@qcet/contracts/personal-notes";
import { toNotePreview } from "@qcet/shared/domain/notes/note-preview";
import { NotFoundError, ValidationError } from "@/server/api/errors";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { findReadableTaskId } from "@/server/tasks/task-query-service";
import { buildMeetingReadWhere } from "@/server/services/meeting-service";

const EXCERPT_LENGTH = 160;

function toExcerpt(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, EXCERPT_LENGTH);
}

function entityTypeOf(row: PersonalNoteRow): PersonalNoteEntityType | null {
  return row.entityType === "meeting" || row.entityType === "task" ? row.entityType : null;
}

function toSummary(row: PersonalNoteRow): PersonalNoteSummary {
  return {
    id: row.id,
    title: row.title,
    excerpt: toExcerpt(row.content),
    preview: toNotePreview(row.content),
    pinned: row.pinned,
    entityType: entityTypeOf(row),
    entityId: row.entityId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toNote(row: PersonalNoteRow): PersonalNote {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    pinned: row.pinned,
    entityType: entityTypeOf(row),
    entityId: row.entityId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Chỉ gắn vào đối tượng người dùng đọc được: không dò sự tồn tại của cuộc họp hay nhiệm vụ không có quyền. */
async function assertEntityReadable(userId: string, entityType: PersonalNoteEntityType, entityId: string): Promise<void> {
  const context = await loadAuthorizationContext(userId, new Date(), { useCache: true });
  const readable =
    entityType === "meeting"
      ? await prisma.meeting.findFirst({ where: { id: entityId, ...buildMeetingReadWhere(context) }, select: { id: true } })
      : await findReadableTaskId(context, entityId);
  if (!readable) throw new ValidationError("Không gắn được: đối tượng không tồn tại hoặc Thầy/Cô không có quyền xem.");
}

export async function listPersonalNotes(
  userId: string,
  query: ListPersonalNotesQuery
): Promise<{ notes: PersonalNoteSummary[]; hasMore: boolean }> {
  const where: Prisma.PersonalNoteWhereInput = { userId };
  if (query.entityType && query.entityId) {
    where.entityType = query.entityType;
    where.entityId = query.entityId;
  }
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { content: { contains: query.q, mode: "insensitive" } },
    ];
  }
  const rows = await prisma.personalNote.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: query.limit + 1,
  });
  return { notes: rows.slice(0, query.limit).map(toSummary), hasMore: rows.length > query.limit };
}

async function findOwned(userId: string, id: string): Promise<PersonalNoteRow> {
  const row = await prisma.personalNote.findFirst({ where: { id, userId } });
  if (!row) throw new NotFoundError("Ghi chú không tồn tại");
  return row;
}

export async function getPersonalNote(userId: string, id: string): Promise<PersonalNote> {
  return toNote(await findOwned(userId, id));
}

export async function createPersonalNote(userId: string, input: CreatePersonalNoteInput): Promise<PersonalNote> {
  if ((await prisma.personalNote.count({ where: { userId } })) >= PERSONAL_NOTES_PER_USER_MAX) {
    throw new ValidationError(`Đã đủ ${PERSONAL_NOTES_PER_USER_MAX} ghi chú. Xóa bớt ghi chú cũ trước khi tạo mới.`);
  }
  if (input.entityType && input.entityId) await assertEntityReadable(userId, input.entityType, input.entityId);
  const row = await prisma.personalNote.create({
    data: {
      userId,
      title: input.title,
      content: input.content,
      pinned: input.pinned,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    },
  });
  return toNote(row);
}

export async function updatePersonalNote(userId: string, id: string, input: UpdatePersonalNoteInput): Promise<PersonalNote> {
  await findOwned(userId, id);
  if (input.entityType && input.entityId) await assertEntityReadable(userId, input.entityType, input.entityId);
  const data: Prisma.PersonalNoteUpdateManyMutationInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.content !== undefined) data.content = input.content;
  if (input.pinned !== undefined) data.pinned = input.pinned;
  if (input.entityType !== undefined) {
    data.entityType = input.entityType ?? null;
    data.entityId = input.entityId ?? null;
  }
  // Điều kiện userId nằm trong chính lệnh ghi: không có khoảng hở giữa kiểm quyền và ghi
  const { count } = await prisma.personalNote.updateMany({ where: { id, userId }, data });
  if (count === 0) throw new NotFoundError("Ghi chú không tồn tại");
  return toNote(await findOwned(userId, id));
}

export async function deletePersonalNote(userId: string, id: string): Promise<{ id: string }> {
  const { count } = await prisma.personalNote.deleteMany({ where: { id, userId } });
  if (count === 0) throw new NotFoundError("Ghi chú không tồn tại");
  return { id };
}
