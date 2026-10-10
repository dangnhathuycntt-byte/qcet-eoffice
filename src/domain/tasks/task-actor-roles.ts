/**
 * Phân loại TaskActor theo vai trò để dựng tài nguyên phân quyền.
 *
 * Người theo dõi, người quan sát và người duyệt được chỉ định không phải người
 * thực hiện: không được vào assigneeIds, nếu không họ nhận quyền cập nhật tiến độ
 * và bị bước SoD coi là người làm (ADR-001).
 */

export interface TaskActorLike {
  role: string;
  userId?: string | null;
}

export interface TaskActorUserIdSets {
  assigneeIds: string[];
  collaboratorIds: string[];
  followerIds: string[];
  observerIds: string[];
  reviewerIds: string[];
  approverIds: string[];
}

const NON_EXECUTION_ROLES = new Set(['FOLLOWER', 'OBSERVER', 'REVIEWER', 'APPROVER']);

export function partitionTaskActorUserIds(
  actors: readonly TaskActorLike[] | null | undefined
): TaskActorUserIdSets {
  const assignee = new Set<string>();
  const byRole: Record<'COLLABORATOR' | 'FOLLOWER' | 'OBSERVER' | 'REVIEWER' | 'APPROVER', Set<string>> = {
    COLLABORATOR: new Set(),
    FOLLOWER: new Set(),
    OBSERVER: new Set(),
    REVIEWER: new Set(),
    APPROVER: new Set(),
  };

  for (const actor of actors ?? []) {
    const userId = actor.userId;
    if (!userId) continue;
    const role = String(actor.role).toUpperCase();
    if (role in byRole) byRole[role as keyof typeof byRole].add(userId);
    if (!NON_EXECUTION_ROLES.has(role)) assignee.add(userId);
  }

  return {
    assigneeIds: [...assignee],
    collaboratorIds: [...byRole.COLLABORATOR],
    followerIds: [...byRole.FOLLOWER],
    observerIds: [...byRole.OBSERVER],
    reviewerIds: [...byRole.REVIEWER],
    approverIds: [...byRole.APPROVER],
  };
}
