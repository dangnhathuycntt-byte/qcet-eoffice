/**
 * Outbox worker (H-1, spec task-document-gap-spec.md).
 *
 * Chạy trong tiến trình app như file-scan-worker, bật bằng OUTBOX_WORKER_ENABLED.
 * Nhiều bản app cùng chạy vẫn an toàn: processOutboxEvent nhận sự kiện bằng lệnh
 * cập nhật nguyên tử PENDING → PROCESSING. Sự kiện không có handler giữ PENDING.
 */
import { processOutboxBatch, type DbClient, type ProcessOutboxBatchResult } from "@/lib/db/outbox";
import { prisma } from "@/lib/prisma";
import { registerShutdownHook } from "@/server/lifecycle/shutdown";
import { logger } from "@/server/observability/logger";
import { TASK_NOTIFICATION_HANDLERS } from "./task-notification-handlers";

export const OUTBOX_HANDLERS = { ...TASK_NOTIFICATION_HANDLERS };

const POLL_INTERVAL_MS = 60_000;
const BATCH_LIMIT = 50;
const MAX_RETRIES = 5;

let timer: NodeJS.Timeout | null = null;
let currentCycle: Promise<unknown> | null = null;

export async function runOutboxCycle(
  client: DbClient = prisma,
  options: { now?: Date; ids?: string[] } = {}
): Promise<ProcessOutboxBatchResult> {
  return processOutboxBatch(client, OUTBOX_HANDLERS, {
    limit: BATCH_LIMIT,
    maxRetries: MAX_RETRIES,
    now: options.now,
    ids: options.ids,
  });
}

async function cycle() {
  if (currentCycle) return;
  currentCycle = runOutboxCycle()
    .then((result) => {
      if (result.totalProcessed > 0) {
        logger.info("outbox.worker.cycle", {
          metadata: {
            processed: result.totalProcessed,
            succeeded: result.succeeded,
            retried: result.retried,
            deadLettered: result.deadLettered,
          },
        });
      }
    })
    .catch((error) => logger.error("outbox.worker.cycle_error", undefined, error))
    .finally(() => {
      currentCycle = null;
    });
  await currentCycle;
}

export function startOutboxWorker() {
  if (timer || process.env.NODE_ENV !== "production" || process.env.OUTBOX_WORKER_ENABLED !== "true") {
    return;
  }

  void cycle();
  timer = setInterval(() => void cycle(), POLL_INTERVAL_MS);
  timer.unref();

  registerShutdownHook(
    async () => {
      if (timer) clearInterval(timer);
      timer = null;
      if (currentCycle) await currentCycle;
    },
    { name: "outbox-worker", priority: 10 }
  );

  logger.info("outbox.worker.started", {
    metadata: { intervalMs: POLL_INTERVAL_MS, batchLimit: BATCH_LIMIT, handlers: Object.keys(OUTBOX_HANDLERS).length },
  });
}
