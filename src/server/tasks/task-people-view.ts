/**
 * Danh sách người tham gia nhiệm vụ cho giao diện thêm, bớt người (T-07).
 * Chỉ người phối hợp và người theo dõi quản lý được; các vai trò khác hiện để tham khảo.
 */
import { TaskActorRole, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/jwt-session";
import { authorizeOnTask, can } from "./authorize-on-task";

const LABEL: Partial<Record<TaskActorRole, string>> = {
  DRI: "Chủ trì",
  ASSIGNER: "Người giao",
  COLLABORATOR: "Phối hợp",
  FOLLOWER: "Theo dõi",
  REVIEWER: "Người thẩm tra",
  APPROVER: "Người duyệt",
  OBSERVER: "Quan sát",
};
const MANAGED: ReadonlySet<TaskActorRole> = new Set([TaskActorRole.COLLABORATOR, TaskActorRole.FOLLOWER]);

export async function getTaskPeople(session: SessionPayload, taskId: string) {
  const task = await authorizeOnTask(session, taskId, "task.read");
  const actors = await prisma.taskActor.findMany({
    where: { taskId, userId: { not: null }, role: { in: Object.keys(LABEL) as TaskActorRole[] } },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { appointedAt: "asc" },
  });
  const open = task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELLED && !task.archivedAt;
  const canManage = open && (await can(session, "task.assign", task)).allowed;
  return {
    version: task.version,
    canManage,
    people: actors.map((a) => ({
      userId: a.userId as string,
      name: a.user?.name ?? "—",
      role: a.role,
      roleLabel: LABEL[a.role] ?? a.role,
      removable: MANAGED.has(a.role),
    })),
  };
}
