/**
 * Phase 9: TaskAssignee table dropped — không còn gì để backfill.
 *
 * Module này từng là stub no-op trả `paritySuccess: true` mà không kiểm tra gì cả,
 * khiến `runAllDataMigrations()` báo "100% parity" một cách vô nghĩa. Nay nó thực
 * hiện **kiểm tra bất biến canonical còn hiệu lực** trên dữ liệu hiện có, để báo
 * cáo parity phản ánh đúng trạng thái hệ thống.
 */
import { PrismaClient } from "@prisma/client";

export interface AssigneesBackfillReport {
  /** Số quan hệ ReBAC canonical đã rà soát (thay cho số bản ghi legacy đã xoá). */
  totalLegacyAssignees: number;
  driCreatedOrUpdated: number;
  collaboratorsCreated: number;
  supervisorsCreated: number;
  assignersCreated: number;
  leadUnitsCreated: number;
  paritySuccess: boolean;
  mismatchedAssignees: number;
}

export interface CanonicalViolation {
  kind: string;
  count: number;
  sampleTaskId?: string;
}

export interface CanonicalIntegrityReport {
  totalTasks: number;
  totalActors: number;
  violations: CanonicalViolation[];
  isClean: boolean;
}

/**
 * Kiểm tra các bất biến canonical mà Phase 9 giả định là đã đúng trước khi drop
 * bảng legacy:
 * 1. Mỗi nhiệm vụ có tối đa MỘT DRI chính (`is_primary_dri = true`).
 * 2. Mọi nhiệm vụ có ít nhất một bản ghi DRI.
 * 3. Nhiệm vụ cấp đơn vị (`scope = 'DEPARTMENT'`) phải có `leadUnitId`.
 */
export async function auditCanonicalTaskIntegrity(
  client?: PrismaClient
): Promise<CanonicalIntegrityReport> {
  const prisma = client || new PrismaClient();

  const [totalTasks, totalActors] = await Promise.all([
    prisma.task.count(),
    prisma.taskActor.count(),
  ]);

  const violations: CanonicalViolation[] = [];

  const duplicatePrimary = await prisma.$queryRawUnsafe<
    Array<{ task_id: string; primary_count: bigint }>
  >(`
    SELECT "task_id", COUNT(*)::bigint AS primary_count
    FROM "task_actors"
    WHERE "role" = 'DRI' AND "is_primary_dri" = TRUE
    GROUP BY "task_id"
    HAVING COUNT(*) > 1
  `);
  if (duplicatePrimary.length > 0) {
    violations.push({
      kind: "MULTIPLE_PRIMARY_DRI",
      count: duplicatePrimary.length,
      sampleTaskId: duplicatePrimary[0].task_id,
    });
  }

  const tasksWithoutDri = await prisma.task.findMany({
    where: { actors: { none: { role: "DRI" } } },
    select: { id: true },
    take: 1,
  });
  const tasksWithoutDriCount = await prisma.task.count({
    where: { actors: { none: { role: "DRI" } } },
  });
  if (tasksWithoutDriCount > 0) {
    violations.push({
      kind: "TASK_WITHOUT_DRI",
      count: tasksWithoutDriCount,
      sampleTaskId: tasksWithoutDri[0]?.id,
    });
  }

  const departmentTasksWithoutUnit = await prisma.task.findMany({
    where: { scope: "DEPARTMENT", leadUnitId: null },
    select: { id: true },
    take: 1,
  });
  const departmentTasksWithoutUnitCount = await prisma.task.count({
    where: { scope: "DEPARTMENT", leadUnitId: null },
  });
  if (departmentTasksWithoutUnitCount > 0) {
    violations.push({
      kind: "DEPARTMENT_TASK_WITHOUT_LEAD_UNIT",
      count: departmentTasksWithoutUnitCount,
      sampleTaskId: departmentTasksWithoutUnit[0]?.id,
    });
  }

  return {
    totalTasks,
    totalActors,
    violations,
    isClean: violations.length === 0,
  };
}

/**
 * Phase 9: giữ tên hàm để `run-all.ts` không phải đổi call site, nhưng báo cáo
 * nay dựa trên kiểm tra bất biến thật.
 */
export async function backfillAssigneesToActors(
  client?: PrismaClient,
  _options: { dryRun?: boolean } = {}
): Promise<AssigneesBackfillReport & { integrity: CanonicalIntegrityReport }> {
  const integrity = await auditCanonicalTaskIntegrity(client);

  if (!integrity.isClean) {
    console.error(
      "[DataMigration:Assignees->Actors] Phát hiện vi phạm bất biến canonical:",
      integrity.violations
    );
  } else {
    console.log(
      `[DataMigration:Assignees->Actors] Bất biến canonical đạt trên ${integrity.totalTasks} nhiệm vụ / ${integrity.totalActors} quan hệ ReBAC.`
    );
  }

  const primaryDriCount = await (client || new PrismaClient()).taskActor.count({
    where: { role: "DRI", isPrimaryDRI: true },
  });

  return {
    totalLegacyAssignees: integrity.totalActors,
    driCreatedOrUpdated: primaryDriCount,
    collaboratorsCreated: 0,
    supervisorsCreated: 0,
    assignersCreated: 0,
    leadUnitsCreated: 0,
    paritySuccess: integrity.isClean,
    mismatchedAssignees: integrity.violations.reduce((sum, v) => sum + v.count, 0),
    integrity,
  };
}
