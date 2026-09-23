export interface ExecutiveResolutionDTO {
  id: string;
  taskId: string;
  actorId: string;
  resolutionType: string;
  directiveNote: string | null;
  grantedDays: number | null;
  previousDueDate: string | null;
  newDueDate: string | null;
  previousOwnerId: string | null;
  newOwnerId: string | null;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    role: string;
    avatarUrl: string | null;
  } | null;
  task?: {
    id: string;
    code: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string;
    departmentId: string;
  } | null;
}

export function toExecutiveResolutionDTO(entity: any): ExecutiveResolutionDTO {
  return {
    id: entity.id,
    taskId: entity.taskId,
    actorId: entity.actorId,
    resolutionType: entity.resolutionType,
    directiveNote: entity.directiveNote ?? null,
    grantedDays: entity.grantedDays ?? null,
    previousDueDate: entity.previousDueDate
      ? new Date(entity.previousDueDate).toISOString()
      : null,
    newDueDate: entity.newDueDate
      ? new Date(entity.newDueDate).toISOString()
      : null,
    previousOwnerId: entity.previousOwnerId ?? null,
    newOwnerId: entity.newOwnerId ?? null,
    createdAt: new Date(entity.createdAt).toISOString(),
    actor: entity.actor
      ? {
          id: entity.actor.id,
          name: entity.actor.name,
          role: entity.actor.role,
          avatarUrl: entity.actor.avatarUrl ?? null,
        }
      : null,
    task: entity.task
      ? {
          id: entity.task.id,
          code: entity.task.code,
          title: entity.task.title,
          status: entity.task.status,
          priority: entity.task.priority,
          dueDate: new Date(entity.task.dueDate).toISOString(),
          departmentId: entity.task.leadUnitId ?? null,
        }
      : null,
  };
}

export function toExecutiveResolutionDTOArray(
  entities: any[]
): ExecutiveResolutionDTO[] {
  return entities.map(toExecutiveResolutionDTO);
}
