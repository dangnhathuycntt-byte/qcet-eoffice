import { PrismaClient } from "@prisma/client";
import { backfillAssigneesToActors, AssigneesBackfillReport } from "./backfill-assignees-to-actors";

export interface MasterCutoverParityReport {
  timestamp: string;
  isDryRun: boolean;
  assigneeMigration: AssigneesBackfillReport;
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

  // 1. TaskAssignee -> TaskActor
  const assigneeReport = await backfillAssigneesToActors(prisma, { dryRun });

  // Phase 9 WI-9.2: Department table dropped — department backfill removed.
  // Phase 9 WI-9.3: DacumDelegation table dropped — dacum backfill removed.

  const overallParitySuccess = assigneeReport.paritySuccess;
  const totalLegacyRecordsAudited = assigneeReport.totalLegacyAssignees;

  const masterReport: MasterCutoverParityReport = {
    timestamp: new Date().toISOString(),
    isDryRun: dryRun,
    assigneeMigration: assigneeReport,
    overallParitySuccess,
    totalLegacyRecordsAudited,
  };

  console.log("================================================================================");
  console.log("[SPRINT 7 DATA CUTOVER] BÁO CÁO TỔNG KẾT DATA PARITY:");
  console.log(`- Tổng số bản ghi legacy đã rà soát: ${totalLegacyRecordsAudited}`);
  console.log(`- TaskAssignee -> TaskActor: ${assigneeReport.totalLegacyAssignees} legacy rows, Mismatch: ${assigneeReport.mismatchedAssignees}, Parity: ${assigneeReport.paritySuccess ? "PASS (100%)" : "FAIL"}`);
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
