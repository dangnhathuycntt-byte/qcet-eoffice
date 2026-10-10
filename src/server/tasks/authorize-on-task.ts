/**
 * Kiểm quyền trên một nhiệm vụ theo capability, dùng chung cho các dịch vụ con của
 * nhiệm vụ (bình luận, tiêu chí). Quyền đi qua authorize() (ADR-002); không kiểm role chuỗi.
 */
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/jwt-session";
import { authorize } from "@/server/authorization/authorization-engine";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { buildTaskResource } from "@/server/authorization/available-actions";
import type { CapabilityAction } from "@/server/authorization/capability";
import { ForbiddenError, NotFoundError } from "@/server/api/errors";

export async function loadTaskWithActors(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { actors: true } });
  if (!task) throw new NotFoundError("Không tìm thấy nhiệm vụ");
  return task;
}

export async function can(session: SessionPayload, action: CapabilityAction, task: Awaited<ReturnType<typeof loadTaskWithActors>>) {
  const context = await loadAuthorizationContext(session.id, new Date(), { useCache: true, ttlMs: 10_000 });
  return authorize(context, action, buildTaskResource(task));
}

export async function authorizeOnTask(session: SessionPayload, taskId: string, action: CapabilityAction) {
  const task = await loadTaskWithActors(taskId);
  const decision = await can(session, action, task);
  if (!decision.allowed) {
    throw new ForbiddenError(decision.reason || "Bạn không có quyền thực hiện thao tác này");
  }
  return task;
}
