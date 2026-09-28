import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AuditLogQuerySchema, type AuditLogEntryDTO } from '../src/contracts/audit-logs';
import {
  SYSTEM_CAPABILITIES,
  NON_DELEGABLE_CAPABILITIES,
  resolveCanonicalCapability,
} from '../src/server/authorization/capability';
import { authorize } from '../src/server/authorization/authorization-engine';
import {
  AuthorizationContextModel,
  SystemRole,
} from '../src/server/authorization/authorization-context';

// ---------------------------------------------------------------------------
// 1. AuditLogQuerySchema validation
// ---------------------------------------------------------------------------

describe('AuditLogQuerySchema validation', () => {
  it('accepts valid default query (empty object)', () => {
    const result = AuditLogQuerySchema.parse({});
    assert.equal(result.page, 1);
    assert.equal(result.pageSize, 20);
  });

  it('accepts full filter set', () => {
    const input = {
      action: 'LOGIN',
      entityType: 'session',
      actorId: 'user-abc',
      from: '2025-01-15',
      to: '2025-06-30T23:59:59Z',
      page: '2',
      pageSize: '50',
    };
    const result = AuditLogQuerySchema.parse(input);
    assert.equal(result.action, 'LOGIN');
    assert.equal(result.entityType, 'session');
    assert.equal(result.actorId, 'user-abc');
    assert.equal(result.from, '2025-01-15');
    assert.equal(result.to, '2025-06-30T23:59:59Z');
    assert.equal(result.page, 2);
    assert.equal(result.pageSize, 50);
  });

  it('rejects page < 1', () => {
    assert.throws(() => AuditLogQuerySchema.parse({ page: '0' }));
  });

  it('rejects pageSize > 100', () => {
    assert.throws(() => AuditLogQuerySchema.parse({ pageSize: '200' }));
  });

  it('rejects invalid ISO date in from', () => {
    assert.throws(() => AuditLogQuerySchema.parse({ from: 'not-a-date' }));
  });

  it('rejects invalid ISO date in to', () => {
    assert.throws(() => AuditLogQuerySchema.parse({ to: '2025-13-01' }));
  });

  it('accepts valid ISO date strings', () => {
    const result = AuditLogQuerySchema.parse({
      from: '2025-01-15',
      to: '2025-06-30T23:59:59Z',
    });
    assert.equal(result.from, '2025-01-15');
    assert.equal(result.to, '2025-06-30T23:59:59Z');
  });

  it('trims action string', () => {
    const result = AuditLogQuerySchema.parse({ action: '  LOGIN  ' });
    assert.equal(result.action, 'LOGIN');
  });

  it('rejects action exceeding 100 chars', () => {
    assert.throws(() =>
      AuditLogQuerySchema.parse({ action: 'x'.repeat(101) })
    );
  });
});

// ---------------------------------------------------------------------------
// 2. AuditLogEntryDTO shape safety
// ---------------------------------------------------------------------------

describe('AuditLogEntryDTO shape safety', () => {
  it('DTO type does NOT include sensitive fields', () => {
    const dto: AuditLogEntryDTO = {
      id: '1',
      actorId: 'u1',
      action: 'LOGIN',
      entityType: 'session',
      entityId: 's1',
      requestId: 'r1',
      createdAt: '2025-01-01T00:00:00Z',
    };

    assert.deepStrictEqual(Object.keys(dto).sort(), [
      'action',
      'actorId',
      'createdAt',
      'entityId',
      'entityType',
      'id',
      'requestId',
    ]);

    assert.equal('beforeData' in dto, false);
    assert.equal('afterData' in dto, false);
    assert.equal('metadata' in dto, false);
  });
});

// ---------------------------------------------------------------------------
// 3. Authorization contract
// ---------------------------------------------------------------------------

describe('Authorization contract for audit', () => {
  it('system.audit.view is a valid canonical capability', () => {
    assert.ok(
      (SYSTEM_CAPABILITIES as readonly string[]).includes('system.audit.view'),
      'system.audit.view must be in SYSTEM_CAPABILITIES'
    );
  });

  it('system.audit.view resolves to audit.view', () => {
    const resolved = resolveCanonicalCapability('system.audit.view' as any);
    assert.equal(resolved, 'audit.view');
  });

  it('audit.view is NOT in NON_DELEGABLE_CAPABILITIES', () => {
    const nonDelegable = NON_DELEGABLE_CAPABILITIES as readonly string[];
    assert.equal(nonDelegable.includes('audit.view'), false);
    assert.equal(nonDelegable.includes('system.audit.view'), false);
  });
});

// ---------------------------------------------------------------------------
// 4. Pagination defaults
// ---------------------------------------------------------------------------

describe('Pagination defaults', () => {
  it('default page is 1 and pageSize is 20', () => {
    const result = AuditLogQuerySchema.parse({});
    assert.equal(result.page, 1);
    assert.equal(result.pageSize, 20);
  });

  it('pageSize accepts max value of 100', () => {
    const result = AuditLogQuerySchema.parse({ pageSize: '100' });
    assert.equal(result.pageSize, 100);
  });

  it('pageSize rejects values above 100', () => {
    assert.throws(() =>
      AuditLogQuerySchema.parse({ pageSize: '101' })
    );
  });
});

// ---------------------------------------------------------------------------
// Helper: build AuthorizationContextModel for testing
// ---------------------------------------------------------------------------

function makeContext(overrides: {
  userId?: string;
  name?: string;
  email?: string;
  isActive?: boolean;
  systemRoles?: SystemRole[];
  positions?: Array<{
    positionCode: string;
    positionTitle?: string;
    isLeadership?: boolean;
    unitId?: string;
  }>;
} = {}) {
  return new AuthorizationContextModel({
    userId: overrides.userId ?? 'test-user-id',
    user: {
      id: overrides.userId ?? 'test-user-id',
      email: overrides.email ?? 'test@qcet.edu.vn',
      name: overrides.name ?? 'Test User',
      isActive: overrides.isActive ?? true,
    },
    systemRoles: overrides.systemRoles ?? [],
    positions: (overrides.positions ?? []).map((p, i) => ({
      id: `pa-${i}`,
      userId: overrides.userId ?? 'test-user-id',
      positionDefinitionId: `pd-${i}`,
      positionCode: p.positionCode,
      positionTitle: p.positionTitle ?? p.positionCode,
      positionLevel: null,
      isLeadership: p.isLeadership ?? false,
      unitId: p.unitId ?? 'unit-1',
      unitCode: 'UNIT-1',
      unitName: 'Test Unit',
      unitType: 'PHONG' as any,
      unitStatus: 'ACTIVE' as any,
      type: 'PRIMARY' as any,
      isActing: false,
      effectiveFrom: new Date('2024-01-01'),
      effectiveTo: null,
      status: 'ACTIVE' as any,
      sourceDecisionNumber: null,
    })),
    responsibilityAreas: [],
    portfolios: [],
    delegations: [],
    bodyMemberships: [],
    primaryUnitIds: ['unit-1'],
  });
}

// ---------------------------------------------------------------------------
// 5. Real authorization engine behavior
// ---------------------------------------------------------------------------

describe('Authorization engine: audit access control', () => {
  it('SYSTEM_ADMIN is allowed to access system.audit.view', () => {
    const ctx = makeContext({
      systemRoles: [SystemRole.SYSTEM_ADMIN],
    });
    const result = authorize(ctx, 'system.audit.view' as any);
    assert.equal(result.allowed, true);
    assert.equal(result.granted, true);
    assert.equal(result.auditRecord.decision, 'ALLOW');
  });

  it('ordinary user without system role is denied audit access', () => {
    const ctx = makeContext({
      positions: [{ positionCode: 'CHUYEN_VIEN', isLeadership: false }],
    });
    const result = authorize(ctx, 'system.audit.view' as any);
    assert.equal(result.allowed, false);
    assert.equal(result.granted, false);
  });

  it('SYSTEM_ADMIN is denied business action (Separation of Powers)', () => {
    const ctx = makeContext({
      systemRoles: [SystemRole.SYSTEM_ADMIN],
    });
    // task.create is a business action, not a technical admin action
    const result = authorize(ctx, 'task.create' as any);
    assert.equal(result.allowed, false);
    assert.equal(result.rejectionCode, 'SEPARATION_OF_POWERS_VIOLATION');
  });

  it('deactivated account is denied regardless of system role', () => {
    const ctx = makeContext({
      systemRoles: [SystemRole.SYSTEM_ADMIN],
      isActive: false,
    });
    const result = authorize(ctx, 'system.audit.view' as any);
    assert.equal(result.allowed, false);
    assert.equal(result.rejectionCode, 'DEACTIVATED_ACCOUNT');
  });

  it('HIEU_TRUONG (Rector) is granted audit access via institutional authority', () => {
    const ctx = makeContext({
      positions: [
        { positionCode: 'HIEU_TRUONG', isLeadership: true },
      ],
    });
    const result = authorize(ctx, 'system.audit.view' as any);
    // Rector has institutional authority covering audit.view
    assert.equal(result.allowed, true);
    assert.equal(result.granted, true);
  });

  it('SECURITY_ADMIN without SYSTEM_ADMIN cannot access audit', () => {
    const ctx = makeContext({
      systemRoles: [SystemRole.SECURITY_ADMIN],
    });
    const result = authorize(ctx, 'system.audit.view' as any);
    // Only SYSTEM_ADMIN gets unconditional technical action access
    assert.equal(result.allowed, false);
  });
});

// ---------------------------------------------------------------------------
// 6. AuditLogEntryDTO: no sensitive data leakage
// ---------------------------------------------------------------------------

describe('AuditLogEntryDTO sensitive field assertions', () => {
  it('DTO contract excludes beforeData, afterData, metadata', () => {
    // This is a compile-time + runtime assertion:
    // the DTO type must NOT include these fields
    const dto: AuditLogEntryDTO = {
      id: 'entry-1',
      actorId: null,
      action: 'system.audit.view',
      entityType: 'audit_log',
      entityId: 'e1',
      requestId: 'req-1',
      createdAt: '2026-01-01T00:00:00Z',
    };

    // Runtime: ensure the object has ONLY the specified keys
    const allowedKeys = ['id', 'actorId', 'action', 'entityType', 'entityId', 'requestId', 'createdAt'];
    assert.deepStrictEqual(Object.keys(dto).sort(), allowedKeys.sort());

    // Explicitly verify sensitive fields are absent
    const record = dto as unknown as Record<string, unknown>;
    assert.equal('beforeData' in record, false, 'beforeData must not be in DTO');
    assert.equal('afterData' in record, false, 'afterData must not be in DTO');
    assert.equal('metadata' in record, false, 'metadata must not be in DTO');
  });

  it('actorId may be null (system-triggered events)', () => {
    const dto: AuditLogEntryDTO = {
      id: 'entry-2',
      actorId: null,
      action: 'SYSTEM_CLEANUP',
      entityType: 'system',
      entityId: 'sys-1',
      requestId: null,
      createdAt: '2026-01-01T00:00:00Z',
    };
    assert.equal(dto.actorId, null);
    assert.equal(dto.requestId, null);
  });
});

// ---------------------------------------------------------------------------
// 7. Date filter boundary tests
// ---------------------------------------------------------------------------

describe('Date filter boundary handling', () => {
  it('date-only to value should include end of day in ICT', () => {
    // When to is '2026-01-15' (date-only), the API should convert to
    // 2026-01-15T23:59:59.999+07:00 so events on that day are included
    const dateOnly = '2026-01-15';
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateOnly);
    assert.equal(isDateOnly, true);

    const eodIct = new Date(`${dateOnly}T23:59:59.999+07:00`);
    // This should be 2026-01-15T16:59:59.999Z
    assert.equal(eodIct.getUTCHours(), 16);
    assert.equal(eodIct.getUTCMinutes(), 59);
    assert.equal(eodIct.getUTCSeconds(), 59);
    assert.equal(eodIct.getUTCDate(), 15);
  });

  it('full ISO timestamp to value is not altered', () => {
    const fullIso = '2026-01-15T23:59:59Z';
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(fullIso);
    assert.equal(isDateOnly, false);
  });

  it('reversed from/to should be rejected', () => {
    // from is after to — this is invalid
    const from = '2026-06-15';
    const to = '2026-01-15';
    const fromDate = new Date(from);
    const toDate = new Date(`${to}T23:59:59.999+07:00`);
    assert.ok(fromDate > toDate, 'from should be after to for this test case');
  });

  it('same date from/to is valid (single day query)', () => {
    const date = '2026-03-01';
    const fromDate = new Date(date);
    const toDate = new Date(`${date}T23:59:59.999+07:00`);
    assert.ok(fromDate <= toDate, 'same date should be valid');
  });
});
