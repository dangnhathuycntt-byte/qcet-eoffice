/**
 * Công cụ nhiệm vụ của Trợ lý (chỉ đọc): tìm, liệt kê và đọc chi tiết. Mọi truy vấn đi qua service đã kiểm quyền.
 */
import { z } from "zod";
import type { TaskActorRole } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import type { AssistantSourceRef } from "@qcet/contracts/assistant";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import { contentToPlainText } from "@qcet/shared/lib/tasks/plate-block-codec";
import { getStatusDisplay } from "@qcet/shared/domain/tasks/display-config";
import { assistantSourceHref } from "@qcet/shared/domain/assistant/assistant-sources";
import { taskQueryService } from "@/server/tasks/task-query-service";
import { findTaskIdByCode, readTaskForUser } from "@/server/tasks/read-task-for-user";
import { LABEL as PEOPLE_ROLE_LABEL } from "@/server/tasks/task-people-view";
import { toTaskListDTOArray, type TaskListDTO } from "@/server/dto/task-dto";
import { clip, ictDate, ictDateTime, isAccessDenial, redactContact, ToolAccessDenied, ToolFailure } from "./assistant-tool-shared";

/** Số nhiệm vụ tối đa trong một lần liệt kê. */
export const TASK_LIST_LIMIT = 20;
/** Số nhiệm vụ tối đa cho mỗi loại trong một lần tìm kiếm. */
export const TASK_SEARCH_LIMIT = 10;
const TASK_DESCRIPTION_MAX = 1500;
/** Bình luận gần nhất đưa kèm chi tiết nhiệm vụ (mới nhất trước) và độ dài tối đa mỗi bình luận. */
const TASK_COMMENTS_IN_DETAIL = 5;
const TASK_COMMENT_MAX = 300;
const TASK_DELIVERABLES_IN_DETAIL = 5;
/** Số người hoặc đơn vị khớp tên tối đa nêu lại cho mô hình khi tên chưa đủ rõ. */
const NAME_MATCH_LIMIT = 5;

const IdText = z.string().trim().min(1).max(64);

export const SearchArgs = z
  .object({
    query: z.string().trim().min(2).max(100),
    types: z.array(z.enum(["task", "document"])).min(1).max(2).optional(),
  })
  .strict();

export const ListTasksArgs = z
  .object({
    view: z.enum(["related", "unit", "all"]).optional(),
    status: z.enum(["not_started", "in_progress", "waiting_approval", "completed", "cancelled", "overdue"]).optional(),
    departmentId: IdText.optional(),
    assigneeId: IdText.optional(),
    /** Tên người tham gia (chủ trì, phối hợp…): máy chủ tự tìm ra người, không cần mã. */
    assignee: z.string().trim().min(2).max(80).optional(),
    /** Tên hoặc mã đơn vị chủ trì: máy chủ tự tìm ra đơn vị. */
    unit: z.string().trim().min(2).max(120).optional(),
    academicMonth: z.number().int().min(1).max(12).optional(),
    academicYear: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{4}$/)
      .optional(),
    limit: z.number().int().min(1).max(TASK_LIST_LIMIT).optional(),
  })
  .strict();
export type ListTasksInput = z.infer<typeof ListTasksArgs>;

export const GetTaskArgs = z
  .object({
    id: IdText.optional(),
    code: z.string().trim().min(1).max(64).optional(),
  })
  .strict()
  .refine((value) => (value.id === undefined) !== (value.code === undefined), {
    message: "Cần đúng một trong id hoặc code.",
  });
export type GetTaskInput = z.infer<typeof GetTaskArgs>;

export interface TaskSummaryItem {
  id: string;
  code: string;
  title: string;
  status: string;
  statusLabel: string;
  priority: string;
  dueDate: string | null;
  isOverdue: boolean;
  progress: number;
  lead: string | null;
  unit: string | null;
  /** Việc con của nhiệm vụ (đã xong/tổng), như cột "0/4" ở trang Nhiệm vụ; không có việc con thì bỏ. */
  subtasks?: { completed: number; total: number };
}

export function toTaskSummary(dto: TaskListItem): TaskSummaryItem {
  return {
    id: dto.id,
    code: dto.code,
    title: redactContact(dto.title),
    status: dto.status,
    statusLabel: getStatusDisplay(dto.status).label,
    priority: dto.priority,
    dueDate: ictDate(dto.dueDate),
    isOverdue: dto.isOverdue === true,
    progress: dto.progress,
    lead: dto.leadAssignee?.name ?? null,
    unit: dto.department?.name ?? null,
    ...(dto.subtasks && dto.subtasks.total > 0 ? { subtasks: dto.subtasks } : {}),
  };
}

export function taskSource(id: string, code: string | null, title: string): AssistantSourceRef {
  return { type: "task", id, code, title: redactContact(title), href: assistantSourceHref("task", id) };
}

/** Nhiệm vụ trong danh sách, kèm số việc con nếu truy vấn có lấy. */
export type TaskListItem = TaskListDTO & { subtasks?: { completed: number; total: number } };

export interface TaskSearchResult {
  total: number;
  dtos: TaskListItem[];
}

/** Đã xong/tổng việc con chưa lưu trữ của từng nhiệm vụ trong kết quả truy vấn, như cột "0/4" ở trang Nhiệm vụ. */
function withSubtaskCounts(rawTasks: unknown[]): TaskListItem[] {
  const counts = new Map<string, { completed: number; total: number }>();
  for (const raw of rawTasks as Array<{ id?: unknown; subTasks?: Array<{ status?: unknown }> }>) {
    const subTasks = Array.isArray(raw?.subTasks) ? raw.subTasks : [];
    counts.set(String(raw?.id ?? ""), {
      completed: subTasks.filter((sub) => sub.status === "COMPLETED").length,
      total: subTasks.length,
    });
  }
  return toTaskListDTOArray(rawTasks).map((dto) => ({ ...dto, subtasks: counts.get(dto.id) }));
}

/** Nhiệm vụ đọc được có chứa từ khóa (không kèm lọc view, để tìm rộng trong phạm vi được xem). */
export async function searchReadableTasks(authz: AuthorizationContext, query: string): Promise<TaskSearchResult> {
  const result = await taskQueryService.queryTasks(authz, { q: query, limit: TASK_SEARCH_LIMIT, page: 1 });
  return { total: result.total, dtos: toTaskListDTOArray(result.tasks) };
}

/**
 * Nhiệm vụ đọc được theo bộ lọc, đếm như trang Nhiệm vụ: danh sách và `total` là nhiệm vụ chính (không có việc cha),
 * `subtaskTotal` là số việc con khớp cùng bộ lọc. `today` làm mốc để tính trễ hạn.
 */
export async function listReadableTasks(
  authz: AuthorizationContext,
  input: ListTasksInput,
  today: string
): Promise<TaskSearchResult & { subtaskTotal: number; matched: { assignee?: string; unit?: string } }> {
  // Lọc theo tên: tìm ra đúng một người/đơn vị, không thì báo các tên khớp để hỏi lại (mô hình không có mã người)
  const person = input.assignee && !input.assigneeId ? await resolvePersonByName(input.assignee) : null;
  const unit = input.unit && !input.departmentId ? await resolveUnitByName(input.unit) : null;
  // Lọc theo người hay đơn vị cụ thể thì xét mọi việc Thầy/Cô được xem, không chỉ việc mình tham gia
  const narrowed = Boolean(person || unit || input.assigneeId || input.departmentId);
  const filters = {
    view: input.view ?? (narrowed ? "all" : "related"),
    status: input.status,
    departmentId: unit?.id ?? input.departmentId,
    assignedTo: person?.id ?? input.assigneeId,
    academicMonth: input.academicMonth,
    academicYear: input.academicYear,
    page: 1,
    referenceDate: today,
  };
  const [roots, all] = await Promise.all([
    taskQueryService.queryTasks(authz, { ...filters, parentTaskId: "root", limit: input.limit ?? TASK_LIST_LIMIT }),
    // Chỉ cần tổng của cả nhiệm vụ chính lẫn việc con
    taskQueryService.queryTasks(authz, { ...filters, limit: 1 }),
  ]);
  return {
    total: roots.total,
    subtaskTotal: Math.max(0, all.total - roots.total),
    dtos: withSubtaskCounts(roots.tasks),
    matched: { ...(person ? { assignee: person.name } : {}), ...(unit ? { unit: unit.name } : {}) },
  };
}

/** Bỏ dấu và chữ hoa để so tên tiếng Việt ("Tuấn" khớp "tuan"). */
function foldName(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Một người dùng đang hoạt động có tên khớp; nhiều người khớp thì ưu tiên người trùng tên đầy đủ, vẫn nhiều thì báo danh
 * sách tên để mô hình hỏi lại. Chỉ trả tên (như danh bạ), không trả email hay số điện thoại.
 */
export async function resolvePersonByName(name: string): Promise<{ id: string; name: string }> {
  const rows = await prisma.user.findMany({
    where: { isActive: true, name: { contains: name.trim(), mode: "insensitive" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 20,
  });
  // Gõ không dấu ("tuan") thì so bằng tên đã bỏ dấu
  const candidates = rows.length > 0 ? rows : await findUsersByFoldedName(name);
  return pickOne(candidates, name, "người", "người dùng");
}

async function findUsersByFoldedName(name: string): Promise<Array<{ id: string; name: string }>> {
  const folded = foldName(name);
  const rows = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, take: 2000 });
  return rows.filter((row) => foldName(row.name).includes(folded));
}

/** Một đơn vị có tên hoặc mã khớp; nhiều đơn vị khớp thì như với người. */
export async function resolveUnitByName(name: string): Promise<{ id: string; name: string }> {
  const rows = await prisma.organizationalUnit.findMany({
    where: { OR: [{ name: { contains: name.trim(), mode: "insensitive" } }, { code: { equals: name.trim(), mode: "insensitive" } }] },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 20,
  });
  const candidates =
    rows.length > 0
      ? rows
      : (await prisma.organizationalUnit.findMany({ select: { id: true, name: true }, take: 500 })).filter((row) =>
          foldName(row.name).includes(foldName(name))
        );
  return pickOne(candidates, name, "đơn vị", "đơn vị");
}

function pickOne<T extends { id: string; name: string }>(rows: T[], query: string, noun: string, listNoun: string): T {
  if (rows.length === 0) throw new ToolFailure(`Không tìm thấy ${noun} nào tên "${clip(query, 80)}". Hỏi lại Thầy/Cô tên đầy đủ.`);
  if (rows.length === 1) return rows[0];
  const exact = rows.filter((row) => foldName(row.name) === foldName(query));
  if (exact.length === 1) return exact[0];
  const names = rows.slice(0, NAME_MATCH_LIMIT).map((row) => row.name).join("; ");
  throw new ToolFailure(
    `Có ${rows.length} ${listNoun} khớp "${clip(query, 80)}": ${names}${rows.length > NAME_MATCH_LIMIT ? "; …" : ""}. Hỏi lại Thầy/Cô muốn ${noun} nào, rồi gọi lại với tên đầy đủ.`
  );
}

export interface TaskDetailRead {
  view: Record<string, unknown>;
  self: AssistantSourceRef;
  related: AssistantSourceRef[];
}

/**
 * Chi tiết nhiệm vụ đã qua kiểm quyền (readTaskForUser), kèm người tham gia và các nguồn liên quan.
 * Ném ToolAccessDenied/ApiError 403-404 khi không được xem.
 */
export async function readTaskDetail(authz: AuthorizationContext, taskId: string): Promise<TaskDetailRead> {
  const { task } = await readTaskForUser(authz, taskId);

  const actors = await prisma.taskActor.findMany({
    where: { taskId, userId: { not: null } },
    select: { role: true, isPrimaryDRI: true, user: { select: { name: true } } },
    orderBy: { appointedAt: "asc" },
  });
  const participants = actors.map((actor) => ({
    name: actor.user?.name ?? "—",
    roleLabel: PEOPLE_ROLE_LABEL[actor.role as TaskActorRole] ?? String(actor.role),
    isPrimaryDRI: actor.isPrimaryDRI === true,
  }));

  // Sau khi đã kiểm quyền đọc nhiệm vụ (như người tham gia ở trên): bình luận gần nhất, minh chứng, yêu cầu gia hạn đang chờ.
  // Bình luận là chữ do người dùng viết: che liên hệ, cắt ngắn, và lời nhắc coi đó là dữ liệu, không phải chỉ dẫn.
  const [comments, commentCount, deliverables, deliverableCount, extension] = await Promise.all([
    prisma.taskComment.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: TASK_COMMENTS_IN_DETAIL,
      select: { body: true, createdAt: true, author: { select: { name: true } } },
    }),
    prisma.taskComment.count({ where: { taskId, deletedAt: null } }),
    prisma.taskDeliverable.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
      take: TASK_DELIVERABLES_IN_DETAIL,
      select: { title: true, reviewStatus: true, createdAt: true },
    }),
    prisma.taskDeliverable.count({ where: { taskId } }),
    prisma.taskExtensionRequest.findFirst({
      where: { taskId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { requestedDueDate: true, reason: true, requestedBy: { select: { name: true } } },
    }),
  ]);

  const subTasks = task.subTasks ?? [];
  const parent = task.parentTask ?? null;
  // Việc cha chỉ hiện khi người hỏi đọc được; không đọc được thì bỏ hẳn trường và nguồn
  const readableParent = parent && (await canReadParentTask(authz, parent.id)) ? parent : null;
  const self = taskSource(task.id, task.code, task.title);
  const related: AssistantSourceRef[] = [
    ...subTasks.map((sub) => taskSource(sub.id, sub.code, sub.title)),
    ...(readableParent ? [taskSource(readableParent.id, readableParent.code, readableParent.title)] : []),
  ];

  const view: Record<string, unknown> = {
    id: task.id,
    code: task.code,
    title: redactContact(task.title),
    status: task.status,
    statusLabel: getStatusDisplay(task.status).label,
    priority: task.priority,
    startDate: ictDate(task.startDate),
    dueDate: ictDate(task.dueDate),
    isOverdue: task.isOverdue === true,
    progress: task.progress,
    lead: task.leadAssignee?.name ?? null,
    unit: task.department?.name ?? null,
    description: clip(contentToPlainText(task.description), TASK_DESCRIPTION_MAX),
    participants,
    subTasks: subTasks.map((sub) => ({
      id: sub.id,
      code: sub.code,
      title: redactContact(sub.title),
      statusLabel: getStatusDisplay(sub.status).label,
      dueDate: ictDate(sub.dueDate),
    })),
    commentCount,
    recentComments: comments.map((comment) => ({
      author: comment.author?.name ?? "—",
      at: ictDateTime(comment.createdAt),
      text: redactContact(clip(comment.body, TASK_COMMENT_MAX)),
    })),
    deliverableCount,
    deliverables: deliverables.map((item) => ({
      title: redactContact(clip(item.title, 160)),
      reviewStatus: DELIVERABLE_REVIEW_LABEL[item.reviewStatus] ?? String(item.reviewStatus),
      submittedAt: ictDate(item.createdAt),
    })),
    pendingExtension: extension
      ? {
          requestedBy: extension.requestedBy?.name ?? "—",
          requestedDueDate: ictDate(extension.requestedDueDate),
          reason: redactContact(clip(extension.reason, TASK_COMMENT_MAX)),
        }
      : null,
  };
  // Không có việc cha thì là null; có việc cha nhưng không đọc được thì bỏ hẳn trường
  if (!parent || readableParent) {
    view.parentTask = readableParent ? { code: readableParent.code, title: redactContact(readableParent.title) } : null;
  }

  return { view, self, related };
}

const DELIVERABLE_REVIEW_LABEL: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REVISION_REQUIRED: "Yêu cầu sửa",
};

/** Việc cha đọc được theo cùng quy tắc GET /api/tasks/[id]; chỉ lỗi từ chối/không tìm thấy mới thành "không đọc được". */
async function canReadParentTask(authz: AuthorizationContext, parentId: string): Promise<boolean> {
  try {
    await readTaskForUser(authz, parentId);
    return true;
  } catch (error) {
    if (isAccessDenial(error)) return false;
    throw error;
  }
}

/** Mã nhiệm vụ đã chuẩn hóa để đọc chi tiết, hoặc ném ToolAccessDenied khi không có mã khớp. */
export async function resolveTaskId(input: GetTaskInput): Promise<string> {
  if (input.id !== undefined) return input.id;
  const taskId = input.code ? await findTaskIdByCode(input.code) : null;
  if (!taskId) throw new ToolAccessDenied();
  return taskId;
}
