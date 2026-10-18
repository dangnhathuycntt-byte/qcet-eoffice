/**
 * Công cụ nhiệm vụ của Trợ lý (chỉ đọc): tìm, liệt kê và đọc chi tiết. Mọi truy vấn đi qua service đã kiểm quyền.
 */
import { z } from "zod";
import type { TaskActorRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AssistantSourceRef } from "@/contracts/assistant";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import { contentToPlainText } from "@/lib/tasks/plate-block-codec";
import { getStatusDisplay } from "@/domain/tasks/display-config";
import { assistantSourceHref } from "@/domain/assistant/assistant-sources";
import { taskQueryService } from "@/server/tasks/task-query-service";
import { findTaskIdByCode, readTaskForUser } from "@/server/tasks/read-task-for-user";
import { LABEL as PEOPLE_ROLE_LABEL } from "@/server/tasks/task-people-view";
import { toTaskListDTOArray, type TaskListDTO } from "@/server/dto/task-dto";
import { clip, ictDate, isAccessDenial, redactContact, ToolAccessDenied } from "./assistant-tool-shared";

/** Số nhiệm vụ tối đa trong một lần liệt kê. */
export const TASK_LIST_LIMIT = 20;
/** Số nhiệm vụ tối đa cho mỗi loại trong một lần tìm kiếm. */
export const TASK_SEARCH_LIMIT = 10;
const TASK_DESCRIPTION_MAX = 1500;

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
}

export function toTaskSummary(dto: TaskListDTO): TaskSummaryItem {
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
  };
}

export function taskSource(id: string, code: string | null, title: string): AssistantSourceRef {
  return { type: "task", id, code, title: redactContact(title), href: assistantSourceHref("task", id) };
}

export interface TaskSearchResult {
  total: number;
  dtos: TaskListDTO[];
}

/** Nhiệm vụ đọc được có chứa từ khóa (không kèm lọc view, để tìm rộng trong phạm vi được xem). */
export async function searchReadableTasks(authz: AuthorizationContext, query: string): Promise<TaskSearchResult> {
  const result = await taskQueryService.queryTasks(authz, { q: query, limit: TASK_SEARCH_LIMIT, page: 1 });
  return { total: result.total, dtos: toTaskListDTOArray(result.tasks) };
}

/** Nhiệm vụ đọc được theo bộ lọc; `today` làm mốc để tính trễ hạn. */
export async function listReadableTasks(
  authz: AuthorizationContext,
  input: ListTasksInput,
  today: string
): Promise<TaskSearchResult> {
  const result = await taskQueryService.queryTasks(authz, {
    view: input.view ?? "related",
    status: input.status,
    departmentId: input.departmentId,
    assignedTo: input.assigneeId,
    academicMonth: input.academicMonth,
    academicYear: input.academicYear,
    limit: input.limit ?? TASK_LIST_LIMIT,
    page: 1,
    referenceDate: today,
  });
  return { total: result.total, dtos: toTaskListDTOArray(result.tasks) };
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
  };
  // Không có việc cha thì là null; có việc cha nhưng không đọc được thì bỏ hẳn trường
  if (!parent || readableParent) {
    view.parentTask = readableParent ? { code: readableParent.code, title: redactContact(readableParent.title) } : null;
  }

  return { view, self, related };
}

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
