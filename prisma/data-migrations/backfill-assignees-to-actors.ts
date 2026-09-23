import { PrismaClient, TaskActorRole } from "@prisma/client";

// Local fallback: AssigneeRole was removed from @prisma/client in Phase 9
const AssigneeRole = {
  PRIMARY_OWNER: 'PRIMARY_OWNER',
  COLLABORATOR: 'COLLABORATOR',
  SUPERVISOR: 'SUPERVISOR',
} as const;
type AssigneeRole = keyof typeof AssigneeRole;

export interface AssigneesBackfillReport {
  totalLegacyAssignees: number;
  driCreatedOrUpdated: number;
  collaboratorsCreated: number;
  supervisorsCreated: number;
  assignersCreated: number;
  leadUnitsCreated: number;
  paritySuccess: boolean;
  mismatchedAssignees: number;
}

export async function backfillAssigneesToActors(
  client?: PrismaClient,
  options: { dryRun?: boolean } = {}
): Promise<AssigneesBackfillReport> {
  const prisma = client || new PrismaClient();
  const dryRun = !!options.dryRun;

  console.log(`[DataMigration:Assignees->Actors] Bắt đầu backfill (${dryRun ? "DRY-RUN" : "EXECUTE"})...`);

  // 1. Tải toàn bộ tasks cùng assignees và actors hiện tại
  const tasks = await prisma.task.findMany({
    include: {
      assignees: true,
      actors: true,
    },
  });

  console.log(`[DataMigration:Assignees->Actors] Đang xử lý ${tasks.length} tasks...`);

  let driCreatedOrUpdated = 0;
  let collaboratorsCreated = 0;
  let supervisorsCreated = 0;
  let assignersCreated = 0;
  let leadUnitsCreated = 0;
  let totalLegacyAssignees = 0;

  for (const task of tasks) {
    totalLegacyAssignees += task.assignees.length;

    // 1.1 Xử lý Assigner từ createdById
    if (task.createdById) {
      const existingAssigner = task.actors.find(
        (a) => a.role === TaskActorRole.ASSIGNER && a.userId === task.createdById
      );
      if (!existingAssigner) {
        if (!dryRun) {
          await prisma.taskActor.create({
            data: {
              taskId: task.id,
              userId: task.createdById,
              role: TaskActorRole.ASSIGNER,
              isPrimaryDRI: false,
              appointedAt: task.createdAt,
            },
          });
        }
        assignersCreated++;
      }
    }

    // 1.2 Xử lý Lead Unit từ leadUnitId
    if (task.leadUnitId) {
      const existingLeadUnit = task.actors.find(
        (a) => a.role === TaskActorRole.LEAD_UNIT && a.unitId === task.leadUnitId
      );
      if (!existingLeadUnit) {
        if (!dryRun) {
          await prisma.taskActor.create({
            data: {
              taskId: task.id,
              unitId: task.leadUnitId,
              role: TaskActorRole.LEAD_UNIT,
              isPrimaryDRI: false,
              appointedAt: task.createdAt,
            },
          });
        }
        leadUnitsCreated++;
      }
    }

    // 1.3 Xử lý các TaskAssignee records
    for (const assignee of task.assignees) {
      if (assignee.roleInTask === AssigneeRole.PRIMARY_OWNER) {
        const existingDri = task.actors.find(
          (a) => a.role === TaskActorRole.DRI && a.userId === assignee.userId
        );

        if (!existingDri) {
          if (!dryRun) {
            await prisma.taskActor.create({
              data: {
                taskId: task.id,
                userId: assignee.userId,
                role: TaskActorRole.DRI,
                isPrimaryDRI: true,
                assignedById: task.createdById,
                appointedAt: assignee.assignedAt ?? task.createdAt,
                notes: null,
              },
            });
          }
          driCreatedOrUpdated++;
        } else if (!existingDri.isPrimaryDRI) {
          if (!dryRun) {
            await prisma.taskActor.update({
              where: { id: existingDri.id },
              data: { isPrimaryDRI: true },
            });
          }
          driCreatedOrUpdated++;
        }
      } else if (assignee.roleInTask === AssigneeRole.COLLABORATOR) {
        const existingCollab = task.actors.find(
          (a) => a.role === TaskActorRole.COLLABORATOR && a.userId === assignee.userId
        );
        if (!existingCollab) {
          if (!dryRun) {
            await prisma.taskActor.create({
              data: {
                taskId: task.id,
                userId: assignee.userId,
                role: TaskActorRole.COLLABORATOR,
                isPrimaryDRI: false,
                assignedById: task.createdById,
                appointedAt: assignee.assignedAt ?? task.createdAt,
                notes: null,
              },
            });
          }
          collaboratorsCreated++;
        }
      } else if (assignee.roleInTask === AssigneeRole.SUPERVISOR) {
        const existingSupervisor = task.actors.find(
          (a) => a.role === TaskActorRole.APPROVER && a.userId === assignee.userId
        );
        if (!existingSupervisor) {
          if (!dryRun) {
            await prisma.taskActor.create({
              data: {
                taskId: task.id,
                userId: assignee.userId,
                role: TaskActorRole.APPROVER,
                isPrimaryDRI: false,
                assignedById: task.createdById,
                appointedAt: assignee.assignedAt ?? task.createdAt,
                notes: null,
              },
            });
          }
          supervisorsCreated++;
        }
      }
    }

    // 1.4 Fallback: nếu task có assigneeId ở top-level mà chưa có DRI
    const taskAny = task as any;
    if (taskAny.assigneeId) {
      const hasDri = task.actors.some((a) => a.role === TaskActorRole.DRI && a.userId === taskAny.assigneeId);
      if (!hasDri) {
        if (!dryRun) {
          await prisma.taskActor.create({
            data: {
              taskId: task.id,
              userId: taskAny.assigneeId,
              role: TaskActorRole.DRI,
              isPrimaryDRI: true,
              assignedById: task.createdById,
              appointedAt: task.createdAt,
            },
          });
        }
        driCreatedOrUpdated++;
      }
    }
  }

  // 2. Parity Verification Check
  let mismatchedAssignees = 0;
  if (!dryRun) {
    const allAssignees = await prisma.taskAssignee.findMany();
    const allActors = await prisma.taskActor.findMany();

    for (const legacy of allAssignees) {
      const expectedRole =
        legacy.roleInTask === AssigneeRole.PRIMARY_OWNER
          ? TaskActorRole.DRI
          : legacy.roleInTask === AssigneeRole.COLLABORATOR
          ? TaskActorRole.COLLABORATOR
          : TaskActorRole.APPROVER;

      const matched = allActors.some(
        (actor) =>
          actor.taskId === legacy.taskId &&
          actor.userId === legacy.userId &&
          actor.role === expectedRole
      );

      if (!matched) {
        mismatchedAssignees++;
        console.error(
          `[ParityError] TaskAssignee không có TaskActor tương ứng: task=${legacy.taskId}, user=${legacy.userId}, role=${legacy.roleInTask}`
        );
      }
    }
  }

  const report: AssigneesBackfillReport = {
    totalLegacyAssignees,
    driCreatedOrUpdated,
    collaboratorsCreated,
    supervisorsCreated,
    assignersCreated,
    leadUnitsCreated,
    paritySuccess: mismatchedAssignees === 0,
    mismatchedAssignees,
  };

  console.log("[DataMigration:Assignees->Actors] Báo cáo kết quả:", JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1]?.includes("backfill-assignees-to-actors")) {
  const isDryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();
  backfillAssigneesToActors(prisma, { dryRun: isDryRun })
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}
