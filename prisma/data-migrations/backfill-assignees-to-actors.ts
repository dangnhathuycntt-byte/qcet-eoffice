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
  /** Số bản ghi primary DRI hiện có trong hệ thống. */
  existingPrimaryDriCount: number;
  /** Số bản ghi DRI được tạo mới hoặc cập nhật trong lần chạy này (0 nếu dryRun). */
  driCreatedOrUpdated: number;
  collaboratorsCreated: number;
  supervisorsCreated: number;
  assignersCreated: number;
  leadUnitsCreated: number;
  paritySuccess: boolean;
  mismatchedAssignees: number;
  integrity?: CanonicalIntegrityReport;
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
 * Mặc định là dryRun (kiểm tra an toàn). Chỉ thực hiện ghi khi options.apply === true.
 */
export async function backfillAssigneesToActors(
  client?: PrismaClient,
  options: { dryRun?: boolean; apply?: boolean } = {}
): Promise<AssigneesBackfillReport & { integrity: CanonicalIntegrityReport }> {
  const prisma = client || new PrismaClient();
  const shouldApply = options.apply === true && options.dryRun !== true;

  let driCreatedOrUpdated = 0;
  let leadUnitsAssigned = 0;

  if (shouldApply) {
    // Ghi chú bảo vệ dữ liệu & toàn vẹn thẩm quyền (Phase 9):
    // 1. createdById hợp lệ về FK không chứng minh creator là DRI; không suy đoán gán creator làm DRI.
    // 2. Với DEPARTMENT task thiếu leadUnitId, đơn vị của creator (đặc biệt khi creator thuộc BGH hoặc giao việc liên đơn vị)
    //    không đồng nhất với đơn vị chủ trì. Không suy đoán gán creator's unit làm leadUnitId.
    // Mọi bản ghi thiếu thông tin bắt buộc đều được giữ nguyên trạng thái unresolved để audit và xử lý theo thẩm quyền nghiệp vụ.
  }

  const integrity = await auditCanonicalTaskIntegrity(prisma);

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

  const primaryDriCount = await prisma.taskActor.count({
    where: { role: "DRI", isPrimaryDRI: true },
  });

  return {
    totalLegacyAssignees: integrity.totalActors,
    existingPrimaryDriCount: primaryDriCount,
    driCreatedOrUpdated: shouldApply ? driCreatedOrUpdated : 0,
    collaboratorsCreated: 0,
    supervisorsCreated: 0,
    assignersCreated: 0,
    leadUnitsCreated: leadUnitsAssigned,
    paritySuccess: integrity.isClean,
    mismatchedAssignees: integrity.violations.reduce((sum, v) => sum + v.count, 0),
    integrity,
  };
}
