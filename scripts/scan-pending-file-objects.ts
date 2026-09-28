import { loadEnvConfig } from "@next/env";
import { FileScanStatus, PrismaClient } from "@prisma/client";
import { scanPendingFileObject } from "../src/lib/services/file-service";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const limitArg = process.argv.find((argument) => argument.startsWith("--limit="));
const requestedLimit = Number.parseInt(limitArg?.split("=")[1] || "100", 10);
const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 1000) : 100;

async function main() {
  if (!process.env.CLAMAV_HOST?.trim()) {
    throw new Error("CLAMAV_HOST is required; pending files remain quarantined");
  }
  const pending = await prisma.fileObject.findMany({
    where: { scanStatus: FileScanStatus.PENDING, isArchived: false },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const totals = { selected: pending.length, clean: 0, infected: 0, failed: 0, stillPending: 0, errors: 0 };
  for (const file of pending) {
    try {
      const result = await scanPendingFileObject(file.id);
      switch (result.scanStatus) {
        case FileScanStatus.CLEAN:
          totals.clean += 1;
          break;
        case FileScanStatus.INFECTED:
          totals.infected += 1;
          break;
        case FileScanStatus.FAILED:
          totals.failed += 1;
          break;
        default:
          totals.stillPending += 1;
      }
    } catch {
      totals.errors += 1;
    }
  }
  console.log(JSON.stringify({ mode: "scan-pending", limit, ...totals }, null, 2));
  if (totals.errors > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("[scan-pending-file-objects] FAILED:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
