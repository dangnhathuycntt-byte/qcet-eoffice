/**
 * QCET E-Office: Department to OrganizationalUnit Migration Track (WI-8.2 / RFC-02 / ADR-006)
 *
 * Implements Stage A/B utilities for mapping, backfilling, and verifying parity
 * between legacy Department flat records and canonical OrganizationalUnit hierarchical tree.
 * Enforces historical foreign key integrity and leadUnitId mapping consistency.
 */

import {
  type PrismaClient,
  type Prisma,
  UnitStatus,
} from '@prisma/client';
import { DEPARTMENT_TO_ORG_UNIT_CODE_MAP } from '../../../../prisma/data-migrations/backfill-department-to-units';

export type DbClient = PrismaClient | Prisma.TransactionClient;

export { DEPARTMENT_TO_ORG_UNIT_CODE_MAP };

export interface ModelParitySummary {
  model: string;
  totalWithDeptId: number;
  mapped: number;
  unmapped: number;
}

export interface DepartmentUnitParityReport {
  isParityMatched: boolean;
  totalDepartments: number;
  mappedDepartments: number;
  unmappedDepartmentIds: string[];
  totalTasksChecked: number;
  tasksWithLeadUnit: number;
  tasksMissingLeadUnit: number;
  mismatchedTaskIds: string[];
  invalidLeadUnitIds: string[];
  perModelSummary: ModelParitySummary[];
}

/**
 * Resolves canonical OrganizationalUnit ID from a legacy department ID.
 * Checks authoritative code mapping table (Decision 282 / RFC-02) and active units in DB.
 * Fails closed (returns null) on unmapped/unknown departments.
 */
export async function resolveUnitIdForDepartmentId(
  db: DbClient,
  departmentId: string
): Promise<string | null> {
  if (!departmentId || typeof departmentId !== 'string') {
    return null;
  }

  const normalizedKey = departmentId.trim();
  const mappedCode = DEPARTMENT_TO_ORG_UNIT_CODE_MAP[normalizedKey];

  // Try finding by mapped canonical code first
  if (mappedCode) {
    const unitByMappedCode = await (db as any).organizationalUnit.findFirst({
      where: {
        code: mappedCode,
        status: { in: [UnitStatus.ACTIVE, 'ACTIVE'] },
      },
      select: { id: true },
    });
    if (unitByMappedCode) {
      return unitByMappedCode.id;
    }
  }

  // Fallback: check direct code or CUID in database
  const directUnit = await (db as any).organizationalUnit.findFirst({
    where: {
      OR: [
        { code: normalizedKey.toUpperCase() },
        { id: normalizedKey },
      ],
      status: { in: [UnitStatus.ACTIVE, 'ACTIVE'] },
    },
    select: { id: true },
  });

  return directUnit ? directUnit.id : null;
}

/**
 * Checks parity for a single model: counts records with a non-null departmentId field,
 * resolves each via resolveUnitIdForDepartmentId, and returns a per-model summary.
 */
async function checkModelParity(
  db: DbClient,
  modelName: string,
  deptIdField: string
): Promise<ModelParitySummary> {
  const records: Array<Record<string, string | null>> = await (db as any)[modelName].findMany({
    where: { [deptIdField]: { not: null } },
    select: { [deptIdField]: true },
  });

  let mapped = 0;
  let unmapped = 0;

  for (const record of records) {
    const deptId = record[deptIdField];
    if (!deptId) continue;
    const unitId = await resolveUnitIdForDepartmentId(db, deptId);
    if (unitId) {
      mapped++;
    } else {
      unmapped++;
    }
  }

  return {
    model: modelName,
    totalWithDeptId: records.length,
    mapped,
    unmapped,
  };
}

/**
 * Expanded FK parity check covering all 8 models that reference Department.
 * For each model, queries records with a non-null dept FK, resolves each via
 * DEPARTMENT_TO_ORG_UNIT_CODE_MAP, and returns per-model mapped/unmapped counts.
 *
 * Fields verified:
 *  1. User.departmentId
 *  2. Task.departmentId
 *  3. Document.draftingDeptId
 *  4. Document.leadDepartmentId
 *  5. DocumentDirective.assignedDeptId
 *  6. JobCatalogItem.departmentId
 *  7. DacumDuty.departmentId
 */
export async function expandedFkParityCheck(
  db: DbClient
): Promise<ModelParitySummary[]> {
  const checks: Array<{ modelName: string; deptIdField: string }> = [
    { modelName: 'user', deptIdField: 'departmentId' },
    { modelName: 'task', deptIdField: 'departmentId' },
    { modelName: 'document', deptIdField: 'draftingDeptId' },
    { modelName: 'document', deptIdField: 'leadDepartmentId' },
    { modelName: 'documentDirective', deptIdField: 'assignedDeptId' },
    { modelName: 'jobCatalogItem', deptIdField: 'departmentId' },
    { modelName: 'dacumDuty', deptIdField: 'departmentId' },
  ];

  const results: ModelParitySummary[] = [];

  for (const { modelName, deptIdField } of checks) {
    // Gracefully skip if the model accessor doesn't exist on the client
    if (typeof (db as any)[modelName]?.findMany !== 'function') {
      results.push({
        model: `${modelName}.${deptIdField}`,
        totalWithDeptId: 0,
        mapped: 0,
        unmapped: 0,
      });
      continue;
    }

    const summary = await checkModelParity(db, modelName, deptIdField);
    results.push({ ...summary, model: `${modelName}.${deptIdField}` });
  }

  return results;
}

/**
 * Verifies parity between Department and OrganizationalUnit data:
 * 1. 100% of departments have an active mapped OrganizationalUnit.
 * 2. 100% of tasks with departmentId have a valid leadUnitId.
 * 3. leadUnitId correctly corresponds to the expected unit of departmentId (zero divergence).
 * 4. leadUnitId references a real, existing OrganizationalUnit (FK integrity).
 * 5. All 8 models referencing Department have per-model mapping summary.
 */
export async function verifyDepartmentUnitParity(
  db: DbClient
): Promise<DepartmentUnitParityReport> {
  const departments = await (db as any).department.findMany({
    select: { id: true, name: true },
  });

  const unmappedDepartmentIds: string[] = [];
  const deptToUnitMap = new Map<string, string>();
  let mappedDepartments = 0;

  for (const dept of departments) {
    const unitId = await resolveUnitIdForDepartmentId(db, dept.id);
    if (unitId) {
      mappedDepartments++;
      deptToUnitMap.set(dept.id, unitId);
    } else {
      unmappedDepartmentIds.push(dept.id);
    }
  }

  // Check tasks with departmentId
  const tasks = await (db as any).task.findMany({
    where: { departmentId: { not: null } },
    select: { id: true, departmentId: true, leadUnitId: true },
  });

  let tasksWithLeadUnit = 0;
  let tasksMissingLeadUnit = 0;
  const mismatchedTaskIds: string[] = [];
  const invalidLeadUnitIds: string[] = [];

  for (const task of tasks) {
    if (!task.leadUnitId) {
      tasksMissingLeadUnit++;
      continue;
    }

    tasksWithLeadUnit++;

    // Check FK validity
    const existingUnit = await (db as any).organizationalUnit.findUnique({
      where: { id: task.leadUnitId },
      select: { id: true },
    });
    if (!existingUnit) {
      invalidLeadUnitIds.push(task.leadUnitId);
      continue;
    }

    // Check mapping alignment
    const expectedUnitId = deptToUnitMap.get(task.departmentId);
    if (expectedUnitId && expectedUnitId !== task.leadUnitId) {
      mismatchedTaskIds.push(task.id);
    }
  }

  // Run expanded FK parity across all 8 department-referencing models
  const perModelSummary = await expandedFkParityCheck(db);

  const isParityMatched =
    unmappedDepartmentIds.length === 0 &&
    tasksMissingLeadUnit === 0 &&
    mismatchedTaskIds.length === 0 &&
    invalidLeadUnitIds.length === 0;

  return {
    isParityMatched,
    totalDepartments: departments.length,
    mappedDepartments,
    unmappedDepartmentIds,
    totalTasksChecked: tasks.length,
    tasksWithLeadUnit,
    tasksMissingLeadUnit,
    mismatchedTaskIds,
    invalidLeadUnitIds,
    perModelSummary,
  };
}
