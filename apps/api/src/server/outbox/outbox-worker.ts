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
  type OutboxHandlerMap,
  type ProcessOutboxBatchResult,
} from "@qcet/db/outbox";
import { prisma } from "@qcet/db/prisma";
import { registerShutdownHook } from "@/server/lifecycle/shutdown";
import { logger } from "@/server/observability/logger";
import { scanTaskReminders } from "@/server/tasks/task-reminder-scanner";
import { sendAssistantBriefings } from "@/server/assistant/assistant-briefing";
import { TASK_NOTIFICATION_HANDLERS, acknowledge } from "./task-notification-handlers";
import { DOCUMENT_NOTIFICATION_HANDLERS } from "./document-notification-handlers";
import { OUTGOING_NOTIFICATION_HANDLERS } from "./outgoing-notification-handlers";
import { DOSSIER_NOTIFICATION_HANDLERS } from "./dossier-notification-handlers";
import { FILE_PURGE_HANDLERS } from "@/server/files/file-object-purge";
import { scanDossierReminders } from "@/server/dossiers/dossier-reminder-scanner";
import { runTaskRecurrences } from "@/server/tasks/task-recurrence-service";
import { AGENT_JOB_HANDLERS, agentJobTimeoutMs } from "./agent-jobs";
import { MEETING_RECORDING_JOB_HANDLERS } from "@/server/meetings/recording-job";

/**
 * Sự kiện văn bản và hồ sơ được phát ra nhưng cố ý không báo ai: không ai cần biết thêm, hoặc chưa quyết định cách báo.
 * Sự kiện không có handler thì `processOutboxBatch` bỏ qua và nằm PENDING mãi, nên mỗi mục ở đây được đăng ký một handler
 * chỉ xác nhận để sự kiện hoàn tất. Mọi `DOCUMENT_*`/`DOSSIER_*` được phát ra phải có handler thật hoặc có mặt ở đây kèm
 * lý do (test `outbox-event-handlers`).
 */
export const SILENT_OUTBOX_EVENTS: Readonly<Record<string, string>> = {
  DOCUMENT_DRAFT_CREATED: "Người soạn tự tạo dự thảo; người duyệt được báo khi trình.",
  DOCUMENT_NUMBERED: "Văn thư cấp số cũng là người đóng dấu bước kế; hàng đợi của họ đã đủ.",
  DOCUMENT_ORGANIZATION_SIGNED: "Văn thư đóng dấu cũng là người phát hành bước kế; hàng đợi của họ đã đủ.",
  DOCUMENT_REVISION_CREATED: "Bản sửa đổi do người soạn tự tạo, quay lại luồng duyệt từ đầu.",
  DOCUMENT_RESOLVED_NOTIFICATION: "Luồng văn bản đến cũ (ADR-015, D9): chưa quyết định giữ hay bỏ.",
  DOCUMENT_FILED_NOTIFICATION: "Luồng văn bản đến cũ (ADR-015, D9): chưa quyết định giữ hay bỏ.",
  DOCUMENT_PRESENTED_NOTIFICATION: "Luồng văn bản đến cũ (ADR-015, D9): chưa quyết định giữ hay bỏ.",
  DOCUMENT_DIRECTIVE_NOTIFICATION: "Luồng văn bản đến cũ (ADR-015, D9): chưa quyết định giữ hay bỏ.",
  DOCUMENT_ASSIGNED_NOTIFICATION: "Luồng văn bản đến cũ (ADR-015, D9): chưa quyết định giữ hay bỏ.",
  DOSSIER_CREATED_NOTIFICATION: "Đợt B5 (Hồ sơ) làm cùng bước tạo và nộp lưu trữ (spec H3).",
  DOSSIER_CLOSED_NOTIFICATION: "Đợt B5 (Hồ sơ) làm cùng bước tạo và nộp lưu trữ (spec H3).",
  DOSSIER_SUBMITTED_ARCHIVE_NOTIFICATION: "Đợt B5 (Hồ sơ) làm cùng bước tạo và nộp lưu trữ (spec H3).",
  DOSSIER_ACCEPTED_ARCHIVE_NOTIFICATION: "Đợt B5 (Hồ sơ) làm cùng bước tạo và nộp lưu trữ (spec H3).",
};

const SILENT_OUTBOX_HANDLERS: OutboxHandlerMap = Object.fromEntries(
  Object.keys(SILENT_OUTBOX_EVENTS).map((eventType) => [eventType, acknowledge])
);

export const OUTBOX_HANDLERS = {
  ...SILENT_OUTBOX_HANDLERS,
  ...TASK_NOTIFICATION_HANDLERS,
  ...DOCUMENT_NOTIFICATION_HANDLERS,
  ...OUTGOING_NOTIFICATION_HANDLERS,
  ...DOSSIER_NOTIFICATION_HANDLERS,
  ...FILE_PURGE_HANDLERS,
  ...AGENT_JOB_HANDLERS,
  ...MEETING_RECORDING_JOB_HANDLERS,
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
      const briefings = await sendAssistantBriefings();
      if (briefings.sent > 0 || briefings.failed > 0) logger.info("assistant.briefing.scan", { metadata: { ...briefings } });
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
