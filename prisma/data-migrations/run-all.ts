import { PrismaClient } from "@prisma/client";
import { backfillDepartmentToUnits, DepartmentBackfillReport } from "./backfill-department-to-units";
import { backfillAssigneesToActors, AssigneesBackfillReport } from "./backfill-assignees-to-actors";
import { backfillDacumToDelegationGrants, DacumBackfillReport } from "./backfill-dacum-to-delegation-grants";

export interface MasterCutoverParityReport {
  timestamp: string;
  isDryRun: boolean;
  departmentMigration: DepartmentBackfillReport;
  assigneeMigration: AssigneesBackfillReport;
  dacumMigration: DacumBackfillReport;
  overallParitySuccess: boolean;
  totalLegacyRecordsAudited: number;
}

export async function runAllDataMigrations(
  client?: PrismaClient,
  options: { dryRun?: boolean } = {}
): Promise<MasterCutoverParityReport> {
  const prisma = client || new PrismaClient();
  const dryRun = !!options.dryRun;

  console.log("================================================================================");
  console.log(`[SPRINT 7 DATA CUTOVER] Chạy toàn bộ Data Migrations (${dryRun ? "DRY-RUN" : "EXECUTE"})`);
  console.log("================================================================================");

  // 1. Department -> OrganizationalUnit
  const deptReport = await backfillDepartmentToUnits(prisma, { dryRun });

  // 2. TaskAssignee -> TaskActor
  const assigneeReport = await backfillAssigneesToActors(prisma, { dryRun });

  // 3. DacumDelegation -> DelegationGrant
  const dacumReport = await backfillDacumToDelegationGrants(prisma, { dryRun });

  const overallParitySuccess =
    deptReport.paritySuccess &&
    assigneeReport.paritySuccess &&
    dacumReport.paritySuccess;

  const totalLegacyRecordsAudited =
    deptReport.totalLegacyDepartments +
    assigneeReport.totalLegacyAssignees +
    dacumReport.totalLegacyDacumDelegations;

  const masterReport: MasterCutoverParityReport = {
    timestamp: new Date().toISOString(),
    isDryRun: dryRun,
    departmentMigration: deptReport,
    assigneeMigration: assigneeReport,
    dacumMigration: dacumReport,
    overallParitySuccess,
    totalLegacyRecordsAudited,
  };

  console.log("================================================================================");
  console.log("[SPRINT 7 DATA CUTOVER] BÁO CÁO TỔNG KẾT DATA PARITY:");
  console.log(`- Tổng số bản ghi legacy đã rà soát: ${totalLegacyRecordsAudited}`);
  console.log(`- Department -> Unit: ${deptReport.mappedToCanonicalUnits} mapped, ${deptReport.newUnitsCreated} created, Parity: ${deptReport.paritySuccess ? "PASS (100%)" : "FAIL"}`);
  console.log(`- TaskAssignee -> TaskActor: ${assigneeReport.totalLegacyAssignees} legacy rows, Mismatch: ${assigneeReport.mismatchedAssignees}, Parity: ${assigneeReport.paritySuccess ? "PASS (100%)" : "FAIL"}`);
  console.log(`- DacumDelegation -> DelegationGrant: ${dacumReport.totalLegacyDacumDelegations} legacy rows, Mismatch: ${dacumReport.mismatchCount}, Parity: ${dacumReport.paritySuccess ? "PASS (100%)" : "FAIL"}`);
  console.log(`- TOÀN BỘ DATA CUTOVER PARITY: ${overallParitySuccess ? "SUCCESS (100% ZERO DATA LOSS)" : "FAILED"}`);
  console.log("================================================================================");

  return masterReport;
}

if (process.argv[1]?.includes("run-all")) {
  const isDryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();
  runAllDataMigrations(prisma, { dryRun: isDryRun })
    .then((report) => {
      if (!report.overallParitySuccess) {
        process.exit(1);
      }
      return prisma.$disconnect();
    })
    .catch((err) => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}
