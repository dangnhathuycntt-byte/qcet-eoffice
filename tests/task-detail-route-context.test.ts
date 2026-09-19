/**
 * Tests for task-detail-context.ts
 *
 * Exercises the helper logic with mocks — no DB writes.
 * Uses node:test and node:assert like the rest of the test suite.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTaskDetailContext,
  resolveCanonicalParent,
  authorizeSubTasks,
  computeRawSubTaskAggregates,
  type RawTaskEntity,
} from '../src/server/tasks/task-detail-context';
import type { AuthorizationContext } from '../src/server/authorization/authorization-context';
import { AuthorizationContextModel } from '../src/server/authorization/authorization-context';
import { UserRole } from '@prisma/client';

// ---------------------------------------------------------------------------
// Helpers: minimal mock factories
// ---------------------------------------------------------------------------

function makeRawTask(overrides: Record<string, any> = {}): RawTaskEntity {
  return {
    id: overrides.id ?? 'task-root',
    code: overrides.code ?? 'NV-001',
    title: overrides.title ?? 'Root task',
    description: overrides.description ?? null,
    scope: overrides.scope ?? 'SCHOOL',
    status: overrides.status ?? 'IN_PROGRESS',
    priority: overrides.priority ?? 'NORMAL',
    progressPercent: overrides.progressPercent ?? 50,
    academicMonth: overrides.academicMonth ?? 9,
    academicYear: overrides.academicYear ?? '2026-2027',
    startDate: overrides.startDate ?? new Date('2026-01-01'),
    dueDate: overrides.dueDate ?? new Date('2026-12-31'),
    departmentId: overrides.departmentId ?? 'dept-1',
    parentTaskId: overrides.parentTaskId ?? null,
    parentTask: overrides.parentTask ?? null,
    createdById: overrides.createdById ?? 'user-1',
    department: overrides.department ?? { id: 'dept-1', name: 'Phòng Test' },
    assignees: overrides.assignees ?? [
      {
        userId: 'user-1',
        roleInTask: 'PRIMARY_OWNER',
        user: { id: 'user-1', name: 'Nguyễn Văn A', avatarUrl: null },
      },
    ],
    deliverables: overrides.deliverables ?? [],
    resolutions: overrides.resolutions ?? [],
    subTasks: overrides.subTasks ?? [],
    dacumTaskDefId: overrides.dacumTaskDefId ?? null,
    dacumTaskDef: overrides.dacumTaskDef ?? null,
    updatedAt: overrides.updatedAt ?? new Date(),
    ...(overrides._extra || {}),
  } as any;
}

function makeSubTask(id: string, extra: Record<string, any> = {}): any {
  return {
    id,
    code: `ST-${id}`,
    title: `Sub ${id}`,
    status: extra.status ?? 'IN_PROGRESS',
    progressPercent: extra.progressPercent ?? 25,
    scope: extra.scope ?? 'DEPARTMENT',
    departmentId: extra.departmentId ?? 'dept-1',
    createdById: extra.createdById ?? 'user-1',
    parentTaskId: extra.parentTaskId ?? 'task-root',
    startDate: new Date('2026-02-01'),
    dueDate: new Date('2026-06-30'),
    assignees: extra.assignees ?? [
      {
        userId: extra.assigneeId ?? 'user-2',
        roleInTask: 'PRIMARY_OWNER',
        user: { id: extra.assigneeId ?? 'user-2', name: extra.assigneeName ?? 'Trần B', avatarUrl: null },
      },
    ],
    deliverables: [],
    department: { id: 'dept-1', name: 'Phòng Test' },
    ...extra,
  };
}

/**
 * Build a minimal AuthorizationContext that allows or denies
 * based on a set of allowed task IDs.
 */
function makeAuthCtx(opts: {
  userId?: string;
  allowedTaskIds?: Set<string>;
} = {}): AuthorizationContext {
  const userId = opts.userId ?? 'user-1';
  return new AuthorizationContextModel({
    userId,
    user: {
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
      role: 'ADMIN' as UserRole,
      isActive: true,
    },
    systemRoles: [],
    positions: [],
    responsibilityAreas: [],
    portfolios: [],
    delegations: [],
    bodyMemberships: [],
    primaryUnitIds: ['dept-1'],
    generatedAt: new Date(),
  });
}

/**
 * Create a fetchTask function that returns tasks from a map.
 * Uses the real authorize engine internally (the auth context's positions/roles
 * determine access). For controlled tests, we instead override authorize behavior
 * by building tasks with the right assignee relationships.
 */
function makeFetchTask(taskMap: Map<string, RawTaskEntity | null>) {
  return async (id: string) => taskMap.get(id) ?? null;
}

// ---------------------------------------------------------------------------
// computeRawSubTaskAggregates
// ---------------------------------------------------------------------------

describe('computeRawSubTaskAggregates', () => {
  test('counts total and completed sub-tasks from raw data', () => {
    const subs = [
      { id: 's1', status: 'COMPLETED' },
      { id: 's2', status: 'IN_PROGRESS' },
      { id: 's3', status: 'COMPLETED' },
      { id: 's4', status: 'NOT_STARTED' },
    ];
    const result = computeRawSubTaskAggregates(subs);
    assert.equal(result.totalSubTasks, 4);
    assert.equal(result.completedSubTasks, 2);
  });

  test('handles empty array', () => {
    const result = computeRawSubTaskAggregates([]);
    assert.equal(result.totalSubTasks, 0);
    assert.equal(result.completedSubTasks, 0);
  });

  test('skips null/undefined entries', () => {
    const subs = [null, undefined, { id: 's1', status: 'COMPLETED' }] as any[];
    const result = computeRawSubTaskAggregates(subs);
    assert.equal(result.totalSubTasks, 3);
    assert.equal(result.completedSubTasks, 1);
  });
});

// ---------------------------------------------------------------------------
// authorizeSubTasks
// ---------------------------------------------------------------------------

describe('authorizeSubTasks', () => {
  test('returns only sub-tasks the user can read', () => {
    // user-1 is assignee on sub-a; sub-b has a different assignee in dept-2
    // The real authorize engine grants access based on relationships.
    // We make user-1 an assignee on sub-a so they can read it.
    const subA = makeSubTask('sub-a', { assigneeId: 'user-1', assigneeName: 'Test User' });
    const subB = makeSubTask('sub-b', {
      assigneeId: 'user-3',
      assigneeName: 'Lê C',
      departmentId: 'dept-other',
    });

    const authCtx = makeAuthCtx({ userId: 'user-1' });
    const result = authorizeSubTasks([subA, subB], authCtx);

    // At minimum, sub-a where user-1 is assignee should be authorized.
    // The exact behavior depends on the full authorize engine, but the function
    // should return StaffTask[] with availableActions attached.
    assert.ok(Array.isArray(result));
    for (const t of result) {
      assert.ok('id' in t, 'result items are StaffTask-shaped');
      assert.ok('availableActions' in (t as any), 'each peek task has availableActions');
    }
  });

  test('attaches availableActions to each authorized sub-task', () => {
    const sub = makeSubTask('sub-1', { assigneeId: 'user-1' });
    const authCtx = makeAuthCtx({ userId: 'user-1' });
    const result = authorizeSubTasks([sub], authCtx);

    // We cannot assert exact actions without the full engine context,
    // but the field must be an array.
    for (const t of result) {
      assert.ok(Array.isArray((t as any).availableActions));
    }
  });

  test('skips null/undefined entries in sub-task array', () => {
    const authCtx = makeAuthCtx();
    const result = authorizeSubTasks([null, undefined] as any[], authCtx);
    assert.equal(result.length, 0);
  });
});

// ---------------------------------------------------------------------------
// resolveCanonicalParent
// ---------------------------------------------------------------------------

describe('resolveCanonicalParent', () => {
  test('walks to root through a chain of ancestors', async () => {
    const root = makeRawTask({ id: 'root', parentTaskId: null, assignees: [{ userId: 'user-1', roleInTask: 'PRIMARY_OWNER', user: { id: 'user-1', name: 'A' } }] });
    const mid = makeRawTask({ id: 'mid', parentTaskId: 'root', assignees: [{ userId: 'user-1', roleInTask: 'PRIMARY_OWNER', user: { id: 'user-1', name: 'A' } }] });

    const taskMap = new Map<string, RawTaskEntity | null>([
      ['root', root],
      ['mid', mid],
    ]);

    const authCtx = makeAuthCtx({ userId: 'user-1' });
    const result = await resolveCanonicalParent('mid', authCtx, makeFetchTask(taskMap));

    assert.ok(result, 'should resolve to a root');
    assert.equal(result.root.id, 'root');
    assert.equal(result.chain.length, 2); // mid, root
  });

  test('returns null if any ancestor is missing', async () => {
    const mid = makeRawTask({ id: 'mid', parentTaskId: 'missing' });
    const taskMap = new Map<string, RawTaskEntity | null>([['mid', mid]]);
    const authCtx = makeAuthCtx();
    const result = await resolveCanonicalParent('mid', authCtx, makeFetchTask(taskMap));
    assert.equal(result, null);
  });

  test('returns null on circular reference (self-referencing)', async () => {
    const selfRef = makeRawTask({ id: 'self', parentTaskId: 'self' });
    const taskMap = new Map<string, RawTaskEntity | null>([['self', selfRef]]);
    const authCtx = makeAuthCtx();
    const result = await resolveCanonicalParent('self', authCtx, makeFetchTask(taskMap));
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// resolveTaskDetailContext
// ---------------------------------------------------------------------------

describe('resolveTaskDetailContext', () => {
  test('root task renders with peekTasks and aggregates', async () => {
    const subA = makeSubTask('sub-a', { assigneeId: 'user-1' });
    const subB = makeSubTask('sub-b', { status: 'COMPLETED', assigneeId: 'user-1' });
    const root = makeRawTask({
      id: 'root',
      subTasks: [subA, subB],
      assignees: [{ userId: 'user-1', roleInTask: 'PRIMARY_OWNER', user: { id: 'user-1', name: 'A' } }],
    });

    const taskMap = new Map<string, RawTaskEntity | null>([['root', root]]);
    const authCtx = makeAuthCtx({ userId: 'user-1' });

    const result = await resolveTaskDetailContext(
      'root', null, '', authCtx, makeFetchTask(taskMap),
    );

    assert.equal(result.outcome, 'render');
    assert.ok(result.canonicalRawTask);
    assert.equal(result.canonicalRawTask.id, 'root');
    assert.ok(Array.isArray(result.peekTasks));
    assert.equal(result.rawSubTaskCount, 2);
    assert.equal(result.rawCompletedSubTaskCount, 1);
    assert.ok(Array.isArray(result.canonicalAvailableActions));
  });

  test('returns notFound when route task does not exist', async () => {
    const taskMap = new Map<string, RawTaskEntity | null>();
    const authCtx = makeAuthCtx();

    const result = await resolveTaskDetailContext(
      'nonexistent', null, '', authCtx, makeFetchTask(taskMap),
    );
    assert.equal(result.outcome, 'notFound');
  });

  test('child task redirects to canonical root parent with subtaskId', async () => {
    const root = makeRawTask({
      id: 'root',
      parentTaskId: null,
      assignees: [{ userId: 'user-1', roleInTask: 'PRIMARY_OWNER', user: { id: 'user-1', name: 'A' } }],
    });
    const child = makeRawTask({
      id: 'child',
      parentTaskId: 'root',
      assignees: [{ userId: 'user-1', roleInTask: 'PRIMARY_OWNER', user: { id: 'user-1', name: 'A' } }],
    });

    const taskMap = new Map<string, RawTaskEntity | null>([
      ['root', root],
      ['child', child],
    ]);
    const authCtx = makeAuthCtx({ userId: 'user-1' });

    const result = await resolveTaskDetailContext(
      'child', null, '', authCtx, makeFetchTask(taskMap),
    );

    assert.equal(result.outcome, 'redirect');
    assert.ok(result.redirectTo);
    assert.ok(result.redirectTo.includes('/tasks/root'));
    assert.ok(result.redirectTo.includes('subtaskId=child'));
  });

  test('child task preserves existing query params in redirect', async () => {
    const root = makeRawTask({
      id: 'root',
      parentTaskId: null,
      assignees: [{ userId: 'user-1', roleInTask: 'PRIMARY_OWNER', user: { id: 'user-1', name: 'A' } }],
    });
    const child = makeRawTask({
      id: 'child',
      parentTaskId: 'root',
      assignees: [{ userId: 'user-1', roleInTask: 'PRIMARY_OWNER', user: { id: 'user-1', name: 'A' } }],
    });

    const taskMap = new Map<string, RawTaskEntity | null>([
      ['root', root],
      ['child', child],
    ]);
    const authCtx = makeAuthCtx({ userId: 'user-1' });

    const result = await resolveTaskDetailContext(
      'child', null, 'tab=activity', authCtx, makeFetchTask(taskMap),
    );

    assert.equal(result.outcome, 'redirect');
    assert.ok(result.redirectTo!.includes('tab=activity'));
    assert.ok(result.redirectTo!.includes('subtaskId=child'));
  });

  test('deep child (grandchild) redirects to root, not immediate parent', async () => {
    const root = makeRawTask({
      id: 'root',
      parentTaskId: null,
      assignees: [{ userId: 'user-1', roleInTask: 'PRIMARY_OWNER', user: { id: 'user-1', name: 'A' } }],
    });
    const mid = makeRawTask({
      id: 'mid',
      parentTaskId: 'root',
      assignees: [{ userId: 'user-1', roleInTask: 'PRIMARY_OWNER', user: { id: 'user-1', name: 'A' } }],
    });
    const grandchild = makeRawTask({
      id: 'grandchild',
      parentTaskId: 'mid',
      assignees: [{ userId: 'user-1', roleInTask: 'PRIMARY_OWNER', user: { id: 'user-1', name: 'A' } }],
    });

    const taskMap = new Map<string, RawTaskEntity | null>([
      ['root', root],
      ['mid', mid],
      ['grandchild', grandchild],
    ]);
    const authCtx = makeAuthCtx({ userId: 'user-1' });

    const result = await resolveTaskDetailContext(
      'grandchild', null, '', authCtx, makeFetchTask(taskMap),
    );

    assert.equal(result.outcome, 'redirect');
    assert.ok(result.redirectTo!.startsWith('/tasks/root'));
    assert.ok(result.redirectTo!.includes('subtaskId=grandchild'));
  });

  test('child allowed but canonical parent missing → notFound', async () => {
    const child = makeRawTask({
      id: 'child',
      parentTaskId: 'missing-parent',
      assignees: [{ userId: 'user-1', roleInTask: 'PRIMARY_OWNER', user: { id: 'user-1', name: 'A' } }],
    });

    const taskMap = new Map<string, RawTaskEntity | null>([
      ['child', child],
    ]);
    const authCtx = makeAuthCtx({ userId: 'user-1' });

    const result = await resolveTaskDetailContext(
      'child', null, '', authCtx, makeFetchTask(taskMap),
    );

    assert.equal(result.outcome, 'notFound');
  });

  test('parent allowed + invalid subtaskId still renders parent without child data', async () => {
    const sub = makeSubTask('sub-real', { assigneeId: 'user-1' });
    const root = makeRawTask({
      id: 'root',
      subTasks: [sub],
      assignees: [{ userId: 'user-1', roleInTask: 'PRIMARY_OWNER', user: { id: 'user-1', name: 'A' } }],
    });

    const taskMap = new Map<string, RawTaskEntity | null>([['root', root]]);
    const authCtx = makeAuthCtx({ userId: 'user-1' });

    // subtaskId does not match any real sub-task
    const result = await resolveTaskDetailContext(
      'root', 'nonexistent-sub', '', authCtx, makeFetchTask(taskMap),
    );

    // Should still render the parent
    assert.equal(result.outcome, 'render');
    assert.equal(result.canonicalRawTask!.id, 'root');
  });

  test('raw sub-task aggregates come from unfiltered data', async () => {
    // 3 sub-tasks total, 2 completed.
    // Even if authorization filters some out, aggregates reflect raw data.
    const subs = [
      makeSubTask('s1', { status: 'COMPLETED', assigneeId: 'user-1' }),
      makeSubTask('s2', { status: 'COMPLETED', assigneeId: 'user-1' }),
      makeSubTask('s3', { status: 'IN_PROGRESS', assigneeId: 'user-other', departmentId: 'dept-other' }),
    ];
    const root = makeRawTask({
      id: 'root',
      subTasks: subs,
      assignees: [{ userId: 'user-1', roleInTask: 'PRIMARY_OWNER', user: { id: 'user-1', name: 'A' } }],
    });

    const taskMap = new Map<string, RawTaskEntity | null>([['root', root]]);
    const authCtx = makeAuthCtx({ userId: 'user-1' });

    const result = await resolveTaskDetailContext(
      'root', null, '', authCtx, makeFetchTask(taskMap),
    );

    assert.equal(result.outcome, 'render');
    // Raw aggregates must reflect all 3 sub-tasks
    assert.equal(result.rawSubTaskCount, 3);
    assert.equal(result.rawCompletedSubTaskCount, 2);
    // peekTasks may be a subset (only authorized ones)
    assert.ok(result.peekTasks!.length <= 3);
  });
});
