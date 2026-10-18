import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { OutboxStatus, type Prisma } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { processOutboxBatch } from '@qcet/db/outbox';
import {
  AGENT_JOB_HANDLERS,
  AgentJobTimeoutError,
  agentJobId,
  agentJobTimeoutMs,
  defineAgentJobHandlers,
  enqueueAgentJob,
  type AgentJobContext,
} from '../src/server/outbox/agent-jobs';
import { OUTBOX_HANDLERS, outboxWorkerConfig, runOutboxCycle } from '../src/server/outbox/outbox-worker';

// Làn việc nền của agent (D9): ghi việc trong transaction, idempotency theo khóa, timeout bằng AbortSignal, AuditEvent tóm tắt.
describe('agent jobs trên outbox', () => {
  const runId = `ajob_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const actorId = `actor_${runId}`;
  const jobIds: string[] = [];
  const key = (name: string) => `${runId}:${name}`;

  after(async () => {
    await prisma.auditEvent.deleteMany({ where: { entityType: 'AgentJob', entityId: { in: jobIds } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { startsWith: runId } } });
  });

  async function enqueue(name: string, type = 'ECHO', payload: Prisma.InputJsonObject = { name }) {
    const result = await prisma.$transaction((tx) => enqueueAgentJob(tx, { type, payload, idempotencyKey: key(name), actorId }));
    jobIds.push(result.id);
    return result;
  }

  test('ghi việc PENDING trong transaction với id tất định theo loại + khóa', async () => {
    const { id, created } = await enqueue('basic', 'ECHO', { documentId: 'doc_1' });

    assert.equal(created, true);
    assert.equal(id, agentJobId('ECHO', key('basic')));
    const row = await prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
    assert.equal(row.eventType, 'AGENT_JOB_ECHO');
    assert.equal(row.aggregateType, 'AgentJob');
    assert.equal(row.aggregateId, key('basic'));
    assert.equal(row.status, OutboxStatus.PENDING);
    assert.equal(row.lockedAt, null);
    assert.deepEqual(row.payload, { type: 'ECHO', actorId, idempotencyKey: key('basic'), payload: { documentId: 'doc_1' } });
  });

  test('ghi trùng khóa không tạo việc mới, giữ payload đầu và không làm hỏng transaction đang mở', async () => {
    const first = await enqueue('dup', 'ECHO', { version: 1 });
    const second = await prisma.$transaction(async (tx) => {
      const again = await enqueueAgentJob(tx, { type: 'ECHO', payload: { version: 2 }, idempotencyKey: key('dup'), actorId });
      // transaction vẫn dùng được sau lần ghi trùng (ON CONFLICT DO NOTHING, không ném lỗi)
      const sameTx = await enqueueAgentJob(tx, { type: 'ECHO', payload: {}, idempotencyKey: key('dup_after'), actorId });
      jobIds.push(sameTx.id);
      return { again, sameTx };
    });

    assert.deepEqual(second.again, { id: first.id, created: false });
    assert.equal(second.sameTx.created, true);
    assert.equal(await prisma.outboxEvent.count({ where: { aggregateId: key('dup') } }), 1);
    const row = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: first.id } });
    assert.deepEqual((row.payload as { payload: unknown }).payload, { version: 1 });
  });

  test('transaction hủy thì không còn việc', async () => {
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        await enqueueAgentJob(tx, { type: 'ECHO', payload: {}, idempotencyKey: key('rollback'), actorId });
        throw new Error('thao tác chính thất bại');
      }),
      /thao tác chính thất bại/
    );
    assert.equal(await prisma.outboxEvent.count({ where: { aggregateId: key('rollback') } }), 0);
  });

  test('từ chối loại việc và khóa không hợp lệ', async () => {
    await assert.rejects(enqueueAgentJob(prisma, { type: 'echo', payload: {}, idempotencyKey: key('x'), actorId }), /Loại việc agent không hợp lệ/);
    await assert.rejects(enqueueAgentJob(prisma, { type: 'ECHO', payload: {}, idempotencyKey: '  ', actorId }), /Khóa idempotency/);
    await assert.rejects(enqueueAgentJob(prisma, { type: 'ECHO', payload: {}, idempotencyKey: 'k'.repeat(201), actorId }), /Khóa idempotency/);
    assert.throws(() => defineAgentJobHandlers({ 'bad-type': () => {} }), /Loại việc agent không hợp lệ/);
  });

  test('handler nhận payload, người yêu cầu, lượt thử và signal; xong thì COMPLETED + AuditEvent tóm tắt không chứa payload', async () => {
    const { id } = await enqueue('run_ok', 'ECHO', { secretNote: 'không ghi vào audit' });
    let seen: Omit<AgentJobContext, 'client' | 'signal'> & { aborted: boolean } | null = null;
    const handlers = defineAgentJobHandlers({
      ECHO: (job) => {
        seen = { id: job.id, type: job.type, payload: job.payload, actorId: job.actorId, idempotencyKey: job.idempotencyKey, attempt: job.attempt, aborted: job.signal.aborted };
      },
    });

    const result = await processOutboxBatch(prisma, handlers, { ids: [id], maxRetries: 3 });

    assert.equal(result.succeeded, 1);
    assert.deepEqual(seen, { id, type: 'ECHO', payload: { secretNote: 'không ghi vào audit' }, actorId, idempotencyKey: key('run_ok'), attempt: 1, aborted: false });
    const row = await prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
    assert.equal(row.status, OutboxStatus.COMPLETED);
    assert.equal(row.lockedAt, null);
    const audits = await prisma.auditEvent.findMany({ where: { entityType: 'AgentJob', entityId: id } });
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, 'AGENT_JOB_COMPLETED');
    assert.equal(audits[0].actorId, actorId);
    const metadata = audits[0].metadata as Record<string, unknown>;
    assert.equal(metadata.jobType, 'ECHO');
    assert.equal(metadata.outcome, 'completed');
    assert.equal(metadata.attempt, 1);
    assert.equal(typeof metadata.durationMs, 'number');
    assert.doesNotMatch(JSON.stringify(audits[0]), /không ghi vào audit/);
  });

  test('quá thời gian: hủy signal, việc trở lại PENDING để thử lại, AuditEvent ghi timeout', async () => {
    const { id } = await enqueue('run_timeout');
    let signal: AbortSignal | null = null;
    const handlers = defineAgentJobHandlers(
      {
        ECHO: (job) =>
          new Promise((resolve) => {
            signal = job.signal;
            job.signal.addEventListener('abort', () => resolve(undefined));
          }),
      },
      { timeoutMs: 50 }
    );

    const result = await processOutboxBatch(prisma, handlers, { ids: [id], maxRetries: 3 });

    assert.equal(result.retried, 1);
    assert.equal(signal!.aborted, true);
    assert.ok(signal!.reason instanceof AgentJobTimeoutError);
    const row = await prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
    assert.equal(row.status, OutboxStatus.PENDING);
    assert.equal(row.attempts, 1);
    assert.equal(row.lockedAt, null);
    assert.match(row.lastError ?? '', /quá thời gian 50 ms/);
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityType: 'AgentJob', entityId: id } });
    assert.equal(audit.action, 'AGENT_JOB_FAILED');
    assert.equal((audit.metadata as Record<string, unknown>).outcome, 'timeout');
  });

  test('handler lỗi hết lượt thử thì FAILED, mỗi lần chạy một AuditEvent', async () => {
    const { id } = await enqueue('run_error');
    const handlers = defineAgentJobHandlers({ ECHO: () => { throw new Error('gateway lỗi'); } });

    await processOutboxBatch(prisma, handlers, { ids: [id], maxRetries: 2 });
    await prisma.outboxEvent.update({ where: { id }, data: { availableAt: new Date(Date.now() - 1000) } });
    await processOutboxBatch(prisma, handlers, { ids: [id], maxRetries: 2 });

    const row = await prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
    assert.equal(row.status, OutboxStatus.FAILED);
    assert.equal(row.attempts, 2);
    const audits = await prisma.auditEvent.findMany({ where: { entityType: 'AgentJob', entityId: id }, orderBy: { createdAt: 'asc' } });
    assert.deepEqual(audits.map((a) => [a.action, (a.metadata as Record<string, unknown>).outcome, (a.metadata as Record<string, unknown>).attempt]), [
      ['AGENT_JOB_FAILED', 'error', 1],
      ['AGENT_JOB_FAILED', 'error', 2],
    ]);
  });

  test('OUTBOX_HANDLERS gộp AGENT_JOB_HANDLERS; vòng worker thu hồi lease quá hạn trước khi xử lý', async () => {
    for (const handlerKey of Object.keys(AGENT_JOB_HANDLERS)) assert.ok(handlerKey in OUTBOX_HANDLERS);
    const { id } = await enqueue('stuck', 'NOT_REGISTERED_YET');
    await prisma.outboxEvent.update({
      where: { id },
      data: { status: OutboxStatus.PROCESSING, lockedAt: new Date(Date.now() - 60 * 60_000), availableAt: new Date(Date.now() - 61 * 60_000) },
    });

    const result = await runOutboxCycle(prisma, { ids: [id] });

    // Thu hồi (lần thử 1) rồi chính vòng đó nhận lại sự kiện (lần thử 2; chạy theo id nên không lọc theo handler)
    assert.equal(result.recoveredLeases, 1);
    assert.equal(result.totalProcessed, 1);
    const row = await prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
    assert.notEqual(row.status, OutboxStatus.PROCESSING);
    assert.equal(row.lockedAt, null);
    assert.equal(row.attempts, 2);
  });

  test('cấu hình từ env: mặc định 60 s / 10 phút / 5 phút, giá trị không hợp lệ dùng mặc định', () => {
    const saved = { poll: process.env.OUTBOX_POLL_INTERVAL_MS, lease: process.env.OUTBOX_LEASE_MS, timeout: process.env.AGENT_JOB_TIMEOUT_MS };
    try {
      delete process.env.OUTBOX_POLL_INTERVAL_MS;
      delete process.env.OUTBOX_LEASE_MS;
      delete process.env.AGENT_JOB_TIMEOUT_MS;
      assert.deepEqual(outboxWorkerConfig(), { pollIntervalMs: 60_000, leaseMs: 600_000 });
      assert.equal(agentJobTimeoutMs(), 300_000);
      process.env.OUTBOX_POLL_INTERVAL_MS = '15000';
      process.env.OUTBOX_LEASE_MS = 'abc';
      process.env.AGENT_JOB_TIMEOUT_MS = '-5';
      assert.deepEqual(outboxWorkerConfig(), { pollIntervalMs: 15_000, leaseMs: 600_000 });
      assert.equal(agentJobTimeoutMs(), 300_000);
    } finally {
      for (const [name, value] of [['OUTBOX_POLL_INTERVAL_MS', saved.poll], ['OUTBOX_LEASE_MS', saved.lease], ['AGENT_JOB_TIMEOUT_MS', saved.timeout]] as const) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
});
