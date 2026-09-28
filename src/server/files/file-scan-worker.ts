import { FileScanStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scanPendingFileObject } from "@/lib/services/file-service";
import { logger } from "@/server/observability/logger";

const BATCH_SIZE = 3;
const POLL_INTERVAL_MS = 15_000;
let timer: NodeJS.Timeout | null = null;
let cycleRunning = false;

async function scanCycle() {
  if (cycleRunning) return;
  cycleRunning = true;
  try {
    const pending = await prisma.fileObject.findMany({
      where: { scanStatus: FileScanStatus.PENDING, isArchived: false },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
    });
    for (const file of pending) {
      try {
        await scanPendingFileObject(file.id);
      } catch (error) {
        // Scanner availability errors leave the file quarantined as PENDING.
        logger.error("file.scan.retryable_error", {
          metadata: { fileObjectId: file.id },
        }, error);
      }
    }
  } catch (error) {
    logger.error("file.scan.worker_cycle_error", undefined, error);
  } finally {
    cycleRunning = false;
  }
}

export function startFileScanWorker() {
  if (timer || process.env.NODE_ENV !== "production" || process.env.FILE_SCAN_WORKER_ENABLED !== "true") {
    return;
  }
  if (!process.env.CLAMAV_HOST?.trim()) {
    logger.error("file.scan.worker_not_started", {
      metadata: { reason: "CLAMAV_HOST is not configured" },
    });
    return;
  }

  void scanCycle();
  timer = setInterval(() => void scanCycle(), POLL_INTERVAL_MS);
  timer.unref();
  logger.info("file.scan.worker_started", {
    metadata: { batchSize: BATCH_SIZE, intervalMs: POLL_INTERVAL_MS },
  });
}
