/**
 * Kiểm quyền trên một nhiệm vụ theo capability, dùng chung cho các dịch vụ con của
 * nhiệm vụ (bình luận, tiêu chí). Quyền đi qua authorize() (ADR-002); không kiểm role chuỗi.
 */
import { prisma } from "@qcet/db/prisma";
import type { SessionPayload } from "@/lib/jwt-session";
import { authorize } from "@/server/authorization/authorization-engine";
import { loadCachedAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { buildTaskResource } from "@/server/authorization/available-actions";
import type { CapabilityAction } from "@/server/authorization/capability";
import { ForbiddenError, NotFoundError } from "@/server/api/errors";
import { canReadTask, dbReadScope } from "./staff-read-scope";

export async function loadTaskWithActors(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { actors: true } });
  if (!task) throw new NotFoundError("Không tìm thấy nhiệm vụ");
  return task;
}

/**
 * Vai trò TaskActor có người dùng của một nhiệm vụ, để cổng route bổ sung REVIEWER/APPROVER
 * vào resource dựng từ DTO (DTO không mang TaskActor).
 */
export function loadTaskActorRoles(taskId: string) {
  return prisma.taskActor.findMany({
    where: { taskId, userId: { not: null } },
    select: { userId: true, role: true, isPrimaryDRI: true },
  });
}

export async function can(session: SessionPayload, action: CapabilityAction, task: Awaited<ReturnType<typeof loadTaskWithActors>>) {
  const context = await loadCachedAuthorizationContext(session.id);
  return authorize(context, action, buildTaskResource(task));
}

export async function authorizeOnTask(session: SessionPayload, taskId: string, action: CapabilityAction) {
  const task = await loadTaskWithActors(taskId);
  const context = await loadCachedAuthorizationContext(session.id);
  const decision = authorize(context, action, buildTaskResource(task));
  if (!decision.allowed) {
    throw new ForbiddenError(decision.reason || "Bạn không có quyền thực hiện thao tác này");
  }
  // D07: đọc phần con (bình luận, tiêu chí, người liên quan…) cùng phạm vi với GET /api/tasks/[id].
  if (action === "task.read" && !(await canReadTask(context, task, dbReadScope(context)))) {
    throw new ForbiddenError("Bạn chỉ xem được phần nhiệm vụ mình tham gia");
  }
  return task;
}
