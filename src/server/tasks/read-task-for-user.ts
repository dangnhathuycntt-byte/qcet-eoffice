/**
 * Đọc chi tiết nhiệm vụ cho một người dùng, dùng chung cho GET /api/tasks/[id] và công cụ của Trợ lý.
 * Thứ tự kiểm quyền giữ nguyên như route: engine, rồi phạm vi D07, rồi lọc việc con.
 */
import { prisma } from "@/lib/prisma";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import { authorize } from "@/server/authorization/authorization-engine";
import { buildTaskResource, computeAvailableActions } from "@/server/authorization/available-actions";
import { ForbiddenError, NotFoundError } from "@/server/api/errors";
import { toTaskDetailDTO, type TaskDetailDTO } from "@/server/dto/task-dto";
import { taskQueryService } from "./task-query-service";
import { canReadTask, dbReadScope, readableTaskIds } from "./staff-read-scope";

export async function readTaskForUser(
  authContext: AuthorizationContext,
  taskId: string
): Promise<{
  task: TaskDetailDTO;
  rawTask: NonNullable<Awaited<ReturnType<typeof taskQueryService.getTaskEntityForInternalUse>>>;
  availableActions: ReturnType<typeof computeAvailableActions>;
}> {
  const rawTask = await taskQueryService.getTaskEntityForInternalUse(taskId);
  if (!rawTask) {
    throw new NotFoundError("Không tìm thấy nhiệm vụ");
  }

  const taskResource = buildTaskResource(rawTask);

  // Kiểm tra quyền theo đối tượng (chống BOLA)
  const readDecision = authorize(authContext, "task.read", taskResource);
  if (!readDecision.allowed) {
    throw new ForbiddenError(readDecision.reason || "Bạn không có quyền xem nhiệm vụ này");
  }
  // D07: người thường chỉ đọc phần mình tham gia, cùng điều kiện với danh sách.
  const readScope = dbReadScope(authContext);
  if (!(await canReadTask(authContext, rawTask as { id: string }, readScope))) {
    throw new ForbiddenError("Bạn chỉ xem được phần nhiệm vụ mình tham gia");
  }

  const task = toTaskDetailDTO(rawTask);
  if (!task) {
    throw new NotFoundError("Không tìm thấy nhiệm vụ");
  }

  // Chỉ trả việc con người xem đọc được, như trang chi tiết (không lộ việc con của người khác cùng đơn vị).
  const rawSubTasks = Array.isArray((rawTask as { subTasks?: unknown }).subTasks)
    ? (rawTask as { subTasks: Array<{ id: string }> }).subTasks
    : [];
  if (task.subTasks && rawSubTasks.length > 0) {
    const readable = await readableTaskIds(authContext, rawSubTasks, readScope);
    task.subTasks = task.subTasks.filter((st) => readable.has(st.id));
  }

  const availableActions = computeAvailableActions(authContext, taskResource);
  return { task, rawTask, availableActions };
}

/** Tìm id nhiệm vụ theo mã (Task.code là duy nhất). Mã không phân biệt hoa thường, bỏ khoảng trắng đầu cuối. */
export async function findTaskIdByCode(code: string): Promise<string | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const row = await prisma.task.findUnique({ where: { code: normalized }, select: { id: true } });
  return row?.id ?? null;
}
