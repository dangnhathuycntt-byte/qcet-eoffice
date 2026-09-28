import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  CreateExecutiveResolutionSchema,
  ExecutiveResolutionQuerySchema,
} from '@/contracts/executive';

// ---------------------------------------------------------------------------
// CreateExecutiveResolutionSchema
// ---------------------------------------------------------------------------
describe('CreateExecutiveResolutionSchema', () => {
  const RESOLUTION_TYPES = [
    'EXTEND_DEADLINE',
    'REASSIGN_OWNER',
    'DIRECTIVE_NOTE',
    'DISMISS_BOTTLENECK',
    'REASSIGN',
    'DEMAND_EXPLANATION',
    'DIRECT_DIRECTIVE',
  ] as const;

  const STATUS_VALUES = [
    'NOT_STARTED',
    'IN_PROGRESS',
    'WAITING_APPROVAL',
    'COMPLETED',
    'OVERDUE',
    'CANCELLED',
  ] as const;

  const PRIORITY_VALUES = [
    'URGENT',
    'HIGH',
    'NORMAL',
    'MEDIUM',
    'LOW',
  ] as const;

  // --- Happy paths ---

  test('accepts valid input with taskId + resolutionType', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: 'task-001',
      resolutionType: 'EXTEND_DEADLINE',
    });
    assert.equal(result.success, true);
  });

  test('accepts with actionType instead of resolutionType', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: 'task-001',
      actionType: 'REASSIGN_OWNER',
    });
    assert.equal(result.success, true);
  });

  test('accepts with type instead of resolutionType', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: 'task-001',
      type: 'DIRECTIVE_NOTE',
    });
    assert.equal(result.success, true);
  });

  test('accepts all valid resolution type enum values', () => {
    for (const rt of RESOLUTION_TYPES) {
      const result = CreateExecutiveResolutionSchema.safeParse({
        taskId: 'task-001',
        resolutionType: rt,
      });
      assert.equal(result.success, true, `should accept resolutionType=${rt}`);
    }
  });

  test('accepts full input with all optional fields', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: 'task-full',
      resolutionType: 'EXTEND_DEADLINE',
      actionType: 'EXTEND_DEADLINE',
      type: 'EXTEND_DEADLINE',
      directiveNote: 'Gia hạn thêm 7 ngày',
      grantedDays: 7,
      extensionDays: 7,
      newOwnerId: 'user-002',
      status: 'IN_PROGRESS',
      taskStatus: 'IN_PROGRESS',
      priority: 'HIGH',
      taskPriority: 'HIGH',
      version: 1,
      expectedVersion: 0,
    });
    assert.equal(result.success, true);
  });

  // --- Rejection: taskId ---

  test('rejects missing taskId', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      resolutionType: 'EXTEND_DEADLINE',
    });
    assert.equal(result.success, false);
  });

  test('rejects taskId shorter than 1 char (empty after trim)', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: '   ',
      resolutionType: 'EXTEND_DEADLINE',
    });
    assert.equal(result.success, false);
  });

  test('rejects taskId exceeding 128 chars', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: 'x'.repeat(129),
      resolutionType: 'EXTEND_DEADLINE',
    });
    assert.equal(result.success, false);
  });

  // --- Rejection: resolutionType refine ---

  test('rejects missing ALL of resolutionType/actionType/type', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: 'task-001',
    });
    assert.equal(result.success, false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      assert.ok(
        paths.includes('resolutionType'),
        'error should be on resolutionType path'
      );
    }
  });

  test('rejects invalid resolutionType enum value', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: 'task-001',
      resolutionType: 'INVALID_TYPE',
    });
    assert.equal(result.success, false);
  });

  // --- Rejection: directiveNote ---

  test('rejects directiveNote exceeding 2000 chars', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: 'task-001',
      resolutionType: 'DIRECTIVE_NOTE',
      directiveNote: 'a'.repeat(2001),
    });
    assert.equal(result.success, false);
  });

  // --- Rejection: grantedDays ---

  test('rejects grantedDays exceeding 365', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: 'task-001',
      resolutionType: 'EXTEND_DEADLINE',
      grantedDays: 366,
    });
    assert.equal(result.success, false);
  });

  test('rejects grantedDays with zero (must be positive)', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: 'task-001',
      resolutionType: 'EXTEND_DEADLINE',
      grantedDays: 0,
    });
    assert.equal(result.success, false);
  });

  test('rejects negative grantedDays', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: 'task-001',
      resolutionType: 'EXTEND_DEADLINE',
      grantedDays: -5,
    });
    assert.equal(result.success, false);
  });

  test('accepts null grantedDays (nullable)', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: 'task-001',
      resolutionType: 'EXTEND_DEADLINE',
      grantedDays: null,
    });
    assert.equal(result.success, true);
  });

  // --- Status enum ---

  test('accepts all valid status enum values', () => {
    for (const s of STATUS_VALUES) {
      const result = CreateExecutiveResolutionSchema.safeParse({
        taskId: 'task-001',
        resolutionType: 'DIRECTIVE_NOTE',
        status: s,
      });
      assert.equal(result.success, true, `should accept status=${s}`);
    }
  });

  test('rejects invalid status enum value', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: 'task-001',
      resolutionType: 'DIRECTIVE_NOTE',
      status: 'INVALID_STATUS',
    });
    assert.equal(result.success, false);
  });

  // --- Priority enum ---

  test('accepts all valid priority enum values', () => {
    for (const p of PRIORITY_VALUES) {
      const result = CreateExecutiveResolutionSchema.safeParse({
        taskId: 'task-001',
        resolutionType: 'DIRECTIVE_NOTE',
        priority: p,
      });
      assert.equal(result.success, true, `should accept priority=${p}`);
    }
  });

  test('rejects invalid priority enum value', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: 'task-001',
      resolutionType: 'DIRECTIVE_NOTE',
      priority: 'INVALID_PRIORITY',
    });
    assert.equal(result.success, false);
  });

  // --- Not strict ---

  test('does NOT reject unknown extra fields (not strict)', () => {
    const result = CreateExecutiveResolutionSchema.safeParse({
      taskId: 'task-001',
      resolutionType: 'EXTEND_DEADLINE',
      unknownField: 'should be allowed',
      anotherExtra: 42,
    });
    assert.equal(result.success, true);
  });
});

// ---------------------------------------------------------------------------
// ExecutiveResolutionQuerySchema
// ---------------------------------------------------------------------------
describe('ExecutiveResolutionQuerySchema', () => {
  test('accepts empty query (all optional, limit defaults to 50)', () => {
    const result = ExecutiveResolutionQuerySchema.safeParse({});
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.limit, 50);
    }
  });

  test('accepts full query', () => {
    const result = ExecutiveResolutionQuerySchema.safeParse({
      taskId: 'task-001',
      resolutionType: 'EXTEND_DEADLINE',
      departmentId: 'dept-01',
      dept: 'phong-dao-tao',
      limit: 25,
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.limit, 25);
    }
  });

  test('rejects limit below 1', () => {
    const result = ExecutiveResolutionQuerySchema.safeParse({ limit: 0 });
    assert.equal(result.success, false);
  });

  test('rejects limit above 100', () => {
    const result = ExecutiveResolutionQuerySchema.safeParse({ limit: 101 });
    assert.equal(result.success, false);
  });

  test('default limit is 50', () => {
    const result = ExecutiveResolutionQuerySchema.safeParse({});
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.limit, 50);
    }
  });

  test('does NOT reject unknown extra fields (not strict)', () => {
    const result = ExecutiveResolutionQuerySchema.safeParse({
      unknownField: 'allowed',
      extraNumber: 999,
    });
    assert.equal(result.success, true);
  });
});
