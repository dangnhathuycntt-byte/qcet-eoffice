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

  // Phase 9: không còn bảng legacy để backfill (task_assignees / departments /
  // dacum_delegations đã bị drop). Bước dưới đây kiểm tra các bất biến canonical
  // thay vì trả về "parity" rỗng.
  const assigneeReport = await backfillAssigneesToActors(prisma, { dryRun });

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
  console.log(`- Quan hệ ReBAC canonical đã rà soát: ${assigneeReport.totalLegacyAssignees}, Vi phạm: ${assigneeReport.mismatchedAssignees}, Parity: ${assigneeReport.paritySuccess ? "PASS" : "FAIL"}`);
  if (assigneeReport.integrity.violations.length > 0) {
    for (const violation of assigneeReport.integrity.violations) {
      console.log(
        `  - [${violation.kind}] ${violation.count} bản ghi (ví dụ task_id=${violation.sampleTaskId ?? "n/a"})`
      );
    }
  }
  console.log(`- TOÀN BỘ BẤT BIẾN CANONICAL: ${overallParitySuccess ? "PASS" : "FAILED"}`);
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
