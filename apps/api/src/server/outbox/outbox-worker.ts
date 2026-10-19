/**
 * Outbox worker (H-1, spec task-document-gap-spec.md).
 *
 * Chạy trong tiến trình qcet-api như file-scan-worker, bật bằng OUTBOX_WORKER_ENABLED; mỗi OUTBOX_POLL_INTERVAL_MS
 * (mặc định 60 s) một vòng. Nhiều bản cùng chạy vẫn an toàn: processOutboxEvent nhận sự kiện bằng lệnh cập nhật
 * nguyên tử PENDING → PROCESSING (ghi lockedAt). Đầu mỗi vòng, sự kiện PROCESSING quá OUTBOX_LEASE_MS (mặc định
 * 10 phút, worker chết giữa chừng) được trả về PENDING. Sự kiện không có handler giữ PENDING.
 */
import {
  processOutboxBatch,
  recoverExpiredOutboxLeases,
  type DbClient,
  type ProcessOutboxBatchResult,
} from "@qcet/db/outbox";
import { prisma } from "@qcet/db/prisma";
import { registerShutdownHook } from "@/server/lifecycle/shutdown";
import { logger } from "@/server/observability/logger";
import { scanTaskReminders } from "@/server/tasks/task-reminder-scanner";
import { TASK_NOTIFICATION_HANDLERS } from "./task-notification-handlers";
import { DOCUMENT_NOTIFICATION_HANDLERS } from "./document-notification-handlers";
import { DOSSIER_NOTIFICATION_HANDLERS } from "./dossier-notification-handlers";
import { FILE_PURGE_HANDLERS } from "@/server/files/file-object-purge";
import { scanDossierReminders } from "@/server/dossiers/dossier-reminder-scanner";
import { runTaskRecurrences } from "@/server/tasks/task-recurrence-service";
import { AGENT_JOB_HANDLERS, agentJobTimeoutMs } from "./agent-jobs";

export const OUTBOX_HANDLERS = {
  ...TASK_NOTIFICATION_HANDLERS,
  ...DOCUMENT_NOTIFICATION_HANDLERS,
  ...DOSSIER_NOTIFICATION_HANDLERS,
  ...FILE_PURGE_HANDLERS,
  ...AGENT_JOB_HANDLERS,
};

const BATCH_LIMIT = 50;
const MAX_RETRIES = 5;

function positiveIntEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Cấu hình đọc từ env mỗi lần gọi: OUTBOX_POLL_INTERVAL_MS (60 s), OUTBOX_LEASE_MS (10 phút). */
export function outboxWorkerConfig() {
  return {
    pollIntervalMs: positiveIntEnv("OUTBOX_POLL_INTERVAL_MS", 60_000),
    leaseMs: positiveIntEnv("OUTBOX_LEASE_MS", 10 * 60_000),
  };
}

let timer: NodeJS.Timeout | null = null;
let currentCycle: Promise<unknown> | null = null;

/** Quét nhắc hạn nhiệm vụ thưa hơn vòng outbox: mỗi 10 phút là đủ vì có khóa chống gửi trùng. */
const REMINDER_SCAN_INTERVAL_MS = 10 * 60_000;
let lastReminderScanAt = 0;

export async function runOutboxCycle(
  client: DbClient = prisma,
  options: { now?: Date; ids?: string[] } = {}
): Promise<ProcessOutboxBatchResult & { recoveredLeases: number }> {
  const leases = await recoverExpiredOutboxLeases(client, {
    leaseMs: outboxWorkerConfig().leaseMs,
    maxRetries: MAX_RETRIES,
    now: options.now,
    ids: options.ids,
  });
  if (leases.requeued > 0 || leases.deadLettered > 0) {
    logger.warn("outbox.worker.lease_recovered", { metadata: { ...leases } });
  }
  const result = await processOutboxBatch(client, OUTBOX_HANDLERS, {
    limit: BATCH_LIMIT,
    maxRetries: MAX_RETRIES,
    now: options.now,
    ids: options.ids,
  });
  return { ...result, recoveredLeases: leases.requeued + leases.deadLettered };
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
    .then(async () => {
      if (Date.now() - lastReminderScanAt < REMINDER_SCAN_INTERVAL_MS) return;
      lastReminderScanAt = Date.now();
      const scan = await scanTaskReminders();
      await scanDossierReminders();
      const recurrences = await runTaskRecurrences();
      if (recurrences.created > 0 || recurrences.failed > 0) logger.info("task.recurrence.scan", { metadata: { ...recurrences } });
      const sent = Object.values(scan.sent).reduce((a, b) => a + b, 0);
      if (sent > 0) logger.info("task.reminder.scan", { metadata: { ...scan.sent, skippedDuplicate: scan.skippedDuplicate, skippedOptOut: scan.skippedOptOut } });
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

  const { pollIntervalMs, leaseMs } = outboxWorkerConfig();
  void cycle();
  timer = setInterval(() => void cycle(), pollIntervalMs);
  timer.unref();

  registerShutdownHook(
    async () => {
      if (timer) clearInterval(timer);
      timer = null;
      if (currentCycle) await currentCycle;
    },
    { name: "outbox-worker", priority: 10 }
  );

  const agentJobTimeout = agentJobTimeoutMs();
  if (leaseMs <= agentJobTimeout) {
    // Lease ngắn hơn việc agent dài nhất: việc đang chạy có thể bị coi là kẹt và chạy lặp
    logger.warn("outbox.worker.lease_shorter_than_agent_timeout", { metadata: { leaseMs, agentJobTimeoutMs: agentJobTimeout } });
  }
  logger.info("outbox.worker.started", {
    metadata: { intervalMs: pollIntervalMs, leaseMs, batchLimit: BATCH_LIMIT, handlers: Object.keys(OUTBOX_HANDLERS).length },
  });
}
