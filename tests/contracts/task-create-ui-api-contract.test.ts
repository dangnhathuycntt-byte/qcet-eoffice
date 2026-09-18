import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CreateTaskInputSchema } from '@/contracts/tasks';
import type { TaskDetailDTO } from '@/server/dto/task-dto';
import {
  buildCreateTaskPayload,
  submitCreateTask,
  reconcileCreatedTask,
  buildPersonnelIndex,
  resolvePersonnelId,
  normalizePersonnelName,
  TASK_LEVEL_TO_SCOPE,
  CREATE_TASK_IDEMPOTENCY_HEADER,
  type CreateTaskDraft,
  type CreateTaskPersonnelRef,
} from '@/lib/adapters/create-task-mapper';

/**
 * Contract: UI create draft -> canonical adapter -> strict CreateTaskInput
 * -> POST /api/tasks -> server TaskDetailDTO -> reconciliation.
 *
 * Covers C1 / T05 (single canonical adapter), C14 (no system-derived fields),
 * T24 (identity by ID, never name) and T27 (unknown result is not proven failure).
 */

const PERSONNEL: CreateTaskPersonnelRef[] = [
  { id: 'usr_dri_001', name: 'Nguyễn Văn An', departmentId: 'dept_qldt' },
  { id: 'usr_col_002', name: 'Trần Thị Bình', departmentId: 'dept_qldt' },
  { id: 'usr_col_003', name: 'Lê Văn Cường', departmentId: 'dept_cntt' },
];

function makeDraft(overrides: Partial<CreateTaskDraft> = {}): CreateTaskDraft {
  return {
    level: 'DON_VI',
    category: 'CHUYEN_DOI_SO',
    title: 'Rà soát hồ sơ kiểm định chất lượng',
    leadAssigneeName: 'Nguyễn Văn An',
    coAssignees: ['Trần Thị Bình', 'Lê Văn Cường', 'Trần Thị Bình'],
    dueDate: '2026-09-30',
    internalDueDate: '2026-09-25',
    description: 'Soạn thảo báo cáo tự đánh giá theo chuẩn kiểm định 2026.',
    parentTaskId: 'task_parent_01',
    requiredDeliverables: 'Báo cáo PDF',
    vtvlRole: 'CHUYEN_VIEN',
    isBypassWarning: true,
    requiresReview: true,
    ...overrides,
  };
}

function makeServerTask(overrides: Partial<TaskDetailDTO> = {}): TaskDetailDTO {
  return {
    id: 'task_srv_123',
    code: 'NV-2026-0001',
    title: 'Rà soát hồ sơ kiểm định chất lượng',
    status: 'NOT_STARTED',
    priority: 'MEDIUM',
    dueDate: '2026-09-30T00:00:00.000Z',
    progress: 0,
    version: 1,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
    ...overrides,
  };
}

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

function createFetchMock(handler: (callIndex: number) => Promise<Response>) {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return handler(calls.length - 1);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function idempotencyKeyOf(call: FetchCall): string {
  const headers = (call.init?.headers ?? {}) as Record<string, string>;
  return headers[CREATE_TASK_IDEMPOTENCY_HEADER];
}

describe('Create Task UI -> API contract (C1/T05) — buildCreateTaskPayload', () => {
  it('maps a UI draft to a strict CreateTaskInput with resolved stable assignee IDs', () => {
    const payload = buildCreateTaskPayload(makeDraft(), { personnel: PERSONNEL });

    assert.strictEqual(CreateTaskInputSchema.safeParse(payload).success, true);
    assert.strictEqual(payload.title, 'Rà soát hồ sơ kiểm định chất lượng');
    assert.strictEqual(payload.assigneeId, 'usr_dri_001');
    assert.strictEqual(payload.collaboratorIds, undefined, 'collaboratorIds must not be forwarded on creation — derived from subtasks');
    assert.strictEqual(payload.priority, 'MEDIUM');
    assert.strictEqual(payload.scope, 'DEPARTMENT');
    assert.strictEqual(payload.departmentId, 'dept_qldt');
    assert.strictEqual(payload.dueDate, '2026-09-30');
    assert.strictEqual(payload.parentTaskId, 'task_parent_01');
  });

  it('emits zero unknown keys that the .strict() schema would reject', () => {
    const payload = buildCreateTaskPayload(makeDraft(), { personnel: PERSONNEL });
    const allowed = new Set(Object.keys(CreateTaskInputSchema.shape));

    for (const key of Object.keys(payload)) {
      assert.ok(allowed.has(key), `Unexpected key emitted by adapter: ${key}`);
    }

    // Strict round-trip: the payload survives re-validation unchanged.
    assert.deepStrictEqual(CreateTaskInputSchema.parse(payload), payload);
  });

  it('never forwards names or legacy UI fields to the API', () => {
    const payload = buildCreateTaskPayload(makeDraft(), { personnel: PERSONNEL });
    const serialized = JSON.stringify(payload);

    assert.ok(!serialized.includes('Nguyễn Văn An'), 'assignee name leaked into payload');
    assert.ok(!serialized.includes('Trần Thị Bình'), 'collaborator name leaked into payload');

    for (const legacyKey of [
      'leadAssigneeName',
      'coAssignees',
      'assigneeIds',
      'level',
      'category',
      'vtvlRole',
      'internalDueDate',
      'requiredDeliverables',
      'isBypassWarning',
      'requiresReview',
    ]) {
      assert.ok(!(legacyKey in payload), `Legacy key leaked into payload: ${legacyKey}`);
    }
  });

  it('never emits system-derived fields (C14)', () => {
    const payload = buildCreateTaskPayload(makeDraft(), { personnel: PERSONNEL }) as Record<
      string,
      unknown
    >;

    for (const systemKey of [
      'id',
      'status',
      'code',
      'creatorId',
      'createdById',
      'progress',
      'progressPercent',
      'version',
      'approvedAt',
    ]) {
      assert.ok(!(systemKey in payload), `System-derived field leaked into payload: ${systemKey}`);
    }
  });

  it('maps creation level to scope deliberately instead of passing level through', () => {
    assert.strictEqual(TASK_LEVEL_TO_SCOPE.TRUONG, 'SCHOOL');
    assert.strictEqual(TASK_LEVEL_TO_SCOPE.DON_VI, 'DEPARTMENT');
    assert.strictEqual(TASK_LEVEL_TO_SCOPE.STAFF, 'INDIVIDUAL');

    for (const [level, scope] of Object.entries(TASK_LEVEL_TO_SCOPE)) {
      const payload = buildCreateTaskPayload(
        makeDraft({ level: level as CreateTaskDraft['level'] }),
        { personnel: PERSONNEL }
      );
      assert.strictEqual(payload.scope, scope);
    }
  });

  it('drops unresolved names instead of inventing IDs (T24)', () => {
    const payload = buildCreateTaskPayload(
      makeDraft({
        leadAssigneeName: 'Người Không Tồn Tại',
        coAssignees: ['Cũng Không Tồn Tại'],
      }),
      { personnel: PERSONNEL }
    );

    assert.strictEqual(payload.assigneeId, undefined);
    assert.strictEqual(payload.collaboratorIds, undefined);
    const serialized = JSON.stringify(payload);
    assert.ok(!serialized.includes('Người Không Tồn Tại'));
    assert.ok(!serialized.includes('Cũng Không Tồn Tại'));
    assert.strictEqual(CreateTaskInputSchema.safeParse(payload).success, true);
  });

  it('requires a concrete dueDate', () => {
    assert.throws(
      () => buildCreateTaskPayload(makeDraft({ dueDate: '   ' }), { personnel: PERSONNEL }),
      /dueDate is required/
    );
  });

  it('does not emit collaboratorIds on creation — collaborators are strictly derived from active child tasks', () => {
    const payload = buildCreateTaskPayload(makeDraft(), {
      assigneeId: 'usr_dri_001',
      collaboratorIds: ['usr_col_002', 'usr_col_002', 'usr_dri_001'],
    });

    assert.strictEqual(payload.assigneeId, 'usr_dri_001');
    assert.strictEqual(payload.collaboratorIds, undefined);
  });

  it('exposes a pure, DB-free personnel resolver', () => {
    const index = buildPersonnelIndex(PERSONNEL);
    assert.strictEqual(normalizePersonnelName('  Nguyễn   Văn An '), 'nguyễn văn an');
    assert.strictEqual(resolvePersonnelId('Nguyễn Văn An', index), 'usr_dri_001');
    assert.strictEqual(resolvePersonnelId('Không Tồn Tại', index), undefined);
  });
});

describe('reconcileCreatedTask — server truth keyed by stable IDs', () => {
  it('reconciles the returned DTO and replaces the optimistic temp id', () => {
    const serverTask = makeServerTask();
    const tempId = `task-temp-${Date.now()}`;

    const result = reconcileCreatedTask(serverTask, tempId);

    assert.strictEqual(result.id, 'task_srv_123');
    assert.strictEqual(result.code, 'NV-2026-0001');
    assert.strictEqual(result.replacedTempId, tempId);
    assert.strictEqual(result.task, serverTask);
  });

  it('reports no replacement when no optimistic temp id is supplied', () => {
    const result = reconcileCreatedTask(makeServerTask());
    assert.strictEqual(result.replacedTempId, null);
  });

  it('throws when the server DTO lacks a stable id (cannot reconcile unnamed truth)', () => {
    assert.throws(
      () => reconcileCreatedTask(makeServerTask({ id: '' })),
      /missing a stable id/
    );
  });
});

describe('submitCreateTask — idempotency & reconciliation (T27)', () => {
  it('POSTs the mapped strict body and never the raw draft', async () => {
    const serverTask = makeServerTask();
    const draft = makeDraft();
    const { fetchImpl, calls } = createFetchMock(async () =>
      new Response(JSON.stringify({ success: true, task: serverTask, data: serverTask }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await submitCreateTask(draft, { personnel: PERSONNEL, fetchImpl });

    assert.ok(result.ok);
    assert.strictEqual(result.task.id, 'task_srv_123');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].input, '/api/tasks');

    const sentBody = JSON.parse(String(calls[0].init?.body));
    assert.strictEqual(CreateTaskInputSchema.safeParse(sentBody).success, true);
    assert.strictEqual(sentBody.assigneeId, 'usr_dri_001');
    assert.ok(!('leadAssigneeName' in sentBody));
    assert.ok(!('coAssignees' in sentBody));
    assert.ok(idempotencyKeyOf(calls[0]));
  });

  it('reconciles the optimistic temp id from the server DTO', async () => {
    const serverTask = makeServerTask();
    const { fetchImpl } = createFetchMock(async () =>
      new Response(JSON.stringify({ success: true, data: serverTask }), { status: 201 })
    );

    const result = await submitCreateTask(makeDraft(), {
      personnel: PERSONNEL,
      fetchImpl,
      optimisticTempId: 'task-temp-42',
    });

    assert.ok(result.ok);
    assert.strictEqual(result.replacedTempId, 'task-temp-42');
    assert.strictEqual(result.task.id, 'task_srv_123');
  });

  it('a rejected POST does not silently mutate the draft', async () => {
    const draft = makeDraft();
    const before = JSON.stringify(draft);
    const { fetchImpl } = createFetchMock(async () =>
      new Response(JSON.stringify({ error: 'Không có quyền tạo nhiệm vụ' }), { status: 403 })
    );

    const result = await submitCreateTask(draft, { personnel: PERSONNEL, fetchImpl });

    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.strictEqual(result.reason, 'rejected');
    assert.strictEqual(result.status, 403);
    assert.strictEqual(result.error, 'Không có quyền tạo nhiệm vụ');
    assert.strictEqual(JSON.stringify(draft), before);
  });

  it('does not retry a rejected (non-ok) response — no duplicate submission', async () => {
    const { fetchImpl, calls } = createFetchMock(async () =>
      new Response(JSON.stringify({ error: 'Conflict' }), { status: 409 })
    );

    const result = await submitCreateTask(makeDraft(), { personnel: PERSONNEL, fetchImpl });

    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.strictEqual(result.reason, 'rejected');
    assert.strictEqual(calls.length, 1);
  });

  it('retries a timeout with the SAME idempotency key (no double-submit)', async () => {
    const serverTask = makeServerTask();
    const { fetchImpl, calls } = createFetchMock(async (callIndex) => {
      if (callIndex === 0) throw new Error('The operation timed out');
      return new Response(JSON.stringify({ success: true, data: serverTask }), { status: 201 });
    });

    const result = await submitCreateTask(makeDraft(), { personnel: PERSONNEL, fetchImpl });

    assert.ok(result.ok);
    assert.strictEqual(result.attempts, 2);
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(idempotencyKeyOf(calls[0]), idempotencyKeyOf(calls[1]));
    assert.strictEqual(result.idempotencyKey, idempotencyKeyOf(calls[0]));
  });

  it('reports an unknown outcome with the original key when transport never succeeds', async () => {
    const { fetchImpl, calls } = createFetchMock(async () => {
      throw new Error('Network request failed');
    });

    const result = await submitCreateTask(makeDraft(), { personnel: PERSONNEL, fetchImpl });

    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.strictEqual(result.reason, 'unknown');
    assert.strictEqual(result.attempts, 2);
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(idempotencyKeyOf(calls[0]), idempotencyKeyOf(calls[1]));
    assert.strictEqual(result.idempotencyKey, idempotencyKeyOf(calls[0]));
  });

  it('returns a validation failure without issuing any network call', async () => {
    const { fetchImpl, calls } = createFetchMock(async () =>
      new Response(JSON.stringify({ success: true }), { status: 201 })
    );

    const result = await submitCreateTask(makeDraft({ title: 'AB' }), {
      personnel: PERSONNEL,
      fetchImpl,
    });

    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.strictEqual(result.reason, 'validation');
    assert.strictEqual(result.attempts, 0);
    assert.strictEqual(calls.length, 0);
  });
});
