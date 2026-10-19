/**
 * Làn việc nền của agent trên outbox (D9, ADR-011).
 *
 * Việc được ghi vào outbox_events trong cùng transaction với thao tác sinh ra nó (enqueueAgentJob), worker outbox
 * chạy handler với AbortSignal hết hạn sau AGENT_JOB_TIMEOUT_MS (mặc định 5 phút) và ghi một AuditEvent tóm tắt mỗi
 * lần chạy (không ghi nội dung payload). Thử lại, dead letter và lease theo outbox: OUTBOX_LEASE_MS phải dài hơn
 * timeout. Loại việc chưa có handler giữ PENDING như mọi sự kiện outbox khác.
 */
import { createHash } from "node:crypto";
import { OutboxStatus, type OutboxEvent, type Prisma } from "@prisma/client";
import { AuditAction, AuditEntityType, logAuditEvent } from "@qcet/db/audit";
import { OutboxAggregateType, type DbClient, type OutboxHandlerContext, type OutboxHandlerMap } from "@qcet/db/outbox";
import { prisma } from "@qcet/db/prisma";
import { logger } from "@/server/observability/logger";

/** eventType của việc agent: `AGENT_JOB_<loại>`. */
export const AGENT_JOB_EVENT_PREFIX = "AGENT_JOB_";
const AGENT_JOB_TYPE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const IDEMPOTENCY_KEY_MAX = 200;
const DEFAULT_TIMEOUT_MS = 5 * 60_000;

export interface EnqueueAgentJobInput {
  /** Loại việc, chữ hoa và gạch dưới (VD `SUMMARIZE_DOCUMENT`). */
  type: string;
  payload: Prisma.InputJsonValue;
  /** Cùng loại và cùng khóa thì chỉ có một việc; lần ghi sau không đổi payload đã lưu. */
  idempotencyKey: string;
  /** Người yêu cầu (null khi hệ thống tự sinh). */
  actorId: string | null;
}

export interface AgentJobContext {
  id: string;
  type: string;
  payload: unknown;
  actorId: string | null;
  idempotencyKey: string;
  attempt: number;
  /** Hủy khi hết AGENT_JOB_TIMEOUT_MS; handler truyền xuống fetch/gateway để dừng thật. */
  signal: AbortSignal;
  client: DbClient;
}

export type AgentJobHandler = (job: AgentJobContext) => Promise<unknown> | unknown;

export class AgentJobTimeoutError extends Error {
  constructor(type: string, timeoutMs: number) {
    super(`Việc agent ${type} quá thời gian ${timeoutMs} ms`);
    this.name = "AgentJobTimeoutError";
  }
}

interface StoredAgentJob {
  type: string;
  actorId: string | null;
  idempotencyKey: string;
  payload: unknown;
}

/** Id tất định theo loại + khóa: ghi trùng va vào khóa chính và bị bỏ qua (ON CONFLICT DO NOTHING). */
export function agentJobId(type: string, idempotencyKey: string): string {
  return `ajob_${createHash("sha256").update(`${type}\n${idempotencyKey}`).digest("hex").slice(0, 40)}`;
}

/**
 * Ghi một việc agent vào outbox trong transaction `tx` của thao tác gây ra nó. Transaction hủy thì việc cũng không còn.
 * Ghi trùng khóa không ném lỗi (không làm hỏng transaction): trả `created: false`.
 */
export async function enqueueAgentJob(
  tx: DbClient,
  input: EnqueueAgentJobInput
): Promise<{ id: string; created: boolean }> {
  if (!AGENT_JOB_TYPE_PATTERN.test(input.type)) {
    throw new Error(`Loại việc agent không hợp lệ: "${input.type}"`);
  }
  const idempotencyKey = input.idempotencyKey?.trim();
  if (!idempotencyKey || idempotencyKey.length > IDEMPOTENCY_KEY_MAX) {
    throw new Error(`Khóa idempotency của việc agent phải có 1–${IDEMPOTENCY_KEY_MAX} ký tự`);
  }
  const id = agentJobId(input.type, idempotencyKey);
  const stored: StoredAgentJob = {
    type: input.type,
    actorId: input.actorId,
    idempotencyKey,
    payload: JSON.parse(JSON.stringify(input.payload ?? null)),
  };
  const { count } = await tx.outboxEvent.createMany({
    data: [
      {
        id,
        eventType: `${AGENT_JOB_EVENT_PREFIX}${input.type}`,
        aggregateType: OutboxAggregateType.AGENT_JOB,
        aggregateId: idempotencyKey,
        payload: stored as unknown as Prisma.InputJsonValue,
        status: OutboxStatus.PENDING,
        attempts: 0,
        availableAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });
  return { id, created: count === 1 };
}

/** AGENT_JOB_TIMEOUT_MS (ms), mặc định 5 phút. */
export function agentJobTimeoutMs(): number {
  const value = Number.parseInt(process.env.AGENT_JOB_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

/** Bọc handler theo loại thành handler outbox (khóa `AGENT_JOB_<loại>`) có timeout và AuditEvent tóm tắt. */
export function defineAgentJobHandlers(
  handlers: Record<string, AgentJobHandler>,
  options: { timeoutMs?: number } = {}
): OutboxHandlerMap {
  const map: OutboxHandlerMap = {};
  for (const [type, handler] of Object.entries(handlers)) {
    if (!AGENT_JOB_TYPE_PATTERN.test(type)) throw new Error(`Loại việc agent không hợp lệ: "${type}"`);
    map[`${AGENT_JOB_EVENT_PREFIX}${type}`] = (event, context) =>
      runAgentJob(event, context, type, handler, options.timeoutMs ?? agentJobTimeoutMs());
  }
  return map;
}

async function runAgentJob(
  event: OutboxEvent,
  context: OutboxHandlerContext | undefined,
  type: string,
  handler: AgentJobHandler,
  timeoutMs: number
): Promise<void> {
  const client = context?.client ?? prisma;
  const stored = (event.payload ?? {}) as Partial<StoredAgentJob>;
  const attempt = context?.attempt ?? event.attempts + 1;
  const controller = new AbortController();
  const startedAt = Date.now();
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new AgentJobTimeoutError(type, timeoutMs);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });

  const summary = (outcome: "completed" | "error" | "timeout", error?: unknown) =>
    recordAgentJobAudit(client, event, {
      actorId: stored.actorId ?? null,
      jobType: type,
      idempotencyKey: stored.idempotencyKey ?? event.aggregateId,
      attempt,
      durationMs: Date.now() - startedAt,
      outcome,
      ...(error ? { error: (error instanceof Error ? error.message : String(error)).slice(0, 500) } : {}),
    });

  try {
    await Promise.race([
      Promise.resolve().then(() =>
        handler({
          id: event.id,
          type,
          payload: stored.payload ?? null,
          actorId: stored.actorId ?? null,
          idempotencyKey: stored.idempotencyKey ?? event.aggregateId,
          attempt,
          signal: controller.signal,
          client,
        })
      ),
      timedOut,
    ]);
    await summary("completed");
  } catch (error) {
    await summary(error instanceof AgentJobTimeoutError ? "timeout" : "error", error);
    // Outbox quyết định thử lại (lùi lịch) hay dead letter theo số lần thử
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function recordAgentJobAudit(
  client: DbClient,
  event: OutboxEvent,
  metadata: { actorId: string | null; outcome: "completed" | "error" | "timeout" } & Record<string, unknown>
): Promise<void> {
  const { actorId, ...rest } = metadata;
  try {
    await logAuditEvent(client, {
      actorId,
      action: metadata.outcome === "completed" ? AuditAction.AGENT_JOB_COMPLETED : AuditAction.AGENT_JOB_FAILED,
      entityType: AuditEntityType.AGENT_JOB,
      entityId: event.id,
      metadata: rest,
    });
  } catch (error) {
    // Audit lỗi không đổi kết quả việc đã chạy
    logger.error("agent_job.audit_failed", { metadata: { jobId: event.id, jobType: metadata.jobType } }, error);
  }
}

/** Handler theo loại việc của agent; module agent đăng ký tại đây. Chưa có loại nào (nền cho module agent). */
export const AGENT_JOB_HANDLERS: OutboxHandlerMap = defineAgentJobHandlers({});
