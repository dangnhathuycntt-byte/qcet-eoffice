import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRole,
  requireRole,
  type ApiRequestContext,
  type AuthenticatedUser,
} from '@/server/api/request-context';
import { AuthorizationError } from '@/server/api/errors';
import {
  authorize,
  isExecutivePosition,
} from '@/server/authorization/authorization-engine';
import {
  SystemRole,
  AuthorizationContextModel,
} from '@/server/authorization/authorization-context';

describe('Security Audit: Role Equivalence Elimination from Business Authority (Task 8)', () => {

  it('verifies SYSTEM_ADMIN is distinct from institutional positions (HIEU_TRUONG, PHO_HIEU_TRUONG)', () => {
    // 1. SystemRole enum distinction
    assert.strictEqual(SystemRole.SYSTEM_ADMIN, 'SYSTEM_ADMIN');
    assert.notStrictEqual(SystemRole.SYSTEM_ADMIN, 'HIEU_TRUONG');
    assert.notStrictEqual(SystemRole.SYSTEM_ADMIN, 'PHO_HIEU_TRUONG');
    assert.notStrictEqual(SystemRole.SYSTEM_ADMIN, 'ADMIN');

    // 2. Position code evaluation in authorization engine
    assert.strictEqual(isExecutivePosition('HIEU_TRUONG'), true);
    assert.strictEqual(isExecutivePosition('PHO_HIEU_TRUONG'), true);
    assert.strictEqual(isExecutivePosition('SYSTEM_ADMIN'), false);
    assert.strictEqual(isExecutivePosition('ADMIN'), false);

    // 3. Separation of Powers enforcement in canonical authorization engine
    const sysAdminContext = new AuthorizationContextModel({
      userId: 'usr-sysadmin-1',
      user: {
        id: 'usr-sysadmin-1',
        email: 'sysadmin@qncet.edu.vn',
        name: 'System Administrator',
        isActive: true,
      },
      systemRoles: [SystemRole.SYSTEM_ADMIN],
      positions: [],
      responsibilityAreas: [],
      portfolios: [],
      delegations: [],
      bodyMemberships: [],
      primaryUnitIds: ['CNTT'],
    });

    // Attempting statutory leadership action (document.direct / bút phê) as SYSTEM_ADMIN
    const directResult = authorize(sysAdminContext, 'document.direct', {
      type: 'document',
      id: 'doc-123',
    });

    assert.strictEqual(directResult.allowed, false);
    assert.strictEqual(directResult.rejectionCode, 'SEPARATION_OF_POWERS_VIOLATION');
    assert.match(
      directResult.reason || '',
      /Quản trị viên kỹ thuật \(SYSTEM_ADMIN\) bị nghiêm cấm/
    );

    // Attempting statutory document signing as SYSTEM_ADMIN
    const signResult = authorize(sysAdminContext, 'document.sign', {
      type: 'document',
      id: 'doc-123',
    });

    assert.strictEqual(signResult.allowed, false);
    assert.strictEqual(signResult.rejectionCode, 'SEPARATION_OF_POWERS_VIOLATION');

    // Attempting task approval as SYSTEM_ADMIN
    const approveResult = authorize(sysAdminContext, 'task.approve', {
      type: 'task',
      id: 'task-123',
    });

    assert.strictEqual(approveResult.allowed, false);
    assert.strictEqual(approveResult.rejectionCode, 'SEPARATION_OF_POWERS_VIOLATION');
  });

  it('verifies normalizeRole("ADMIN") does NOT equal "HIEU_TRUONG", "BAN_GIAM_HIEU", or grant institutional positions', () => {
    const normAdmin = normalizeRole('ADMIN');
    assert.strictEqual(normAdmin, 'ADMIN');
    assert.notStrictEqual(normAdmin, 'HIEU_TRUONG');
    assert.notStrictEqual(normAdmin, 'PHO_HIEU_TRUONG');
    assert.notStrictEqual(normAdmin, 'BAN_GIAM_HIEU');
    assert.notStrictEqual(normAdmin, 'BGH');

    // Ensure requireRole cannot be used to assert statutory institutional authority
    const adminUser: AuthenticatedUser = {
      id: 'admin-usr-1',
      email: 'admin@qncet.edu.vn',
      name: 'System Admin',
      role: 'ADMIN',

    };

    const ctx: ApiRequestContext = {
      requestId: 'req-test-statutory',
      user: adminUser,
    };

    assert.throws(
      () => requireRole(ctx, 'HIEU_TRUONG'),
      (err: unknown) => {
        assert.ok(err instanceof AuthorizationError);
        assert.strictEqual(err.code, 'STATUTORY_AUTHORITY_PROHIBITED');
        assert.match(err.message, /Statutory institutional authority/);
        return true;
      }
    );

    assert.throws(
      () => requireRole(ctx, 'PHO_HIEU_TRUONG'),
      (err: unknown) => {
        assert.ok(err instanceof AuthorizationError);
        assert.strictEqual(err.code, 'STATUTORY_AUTHORITY_PROHIBITED');
        assert.match(err.message, /Statutory institutional authority/);
        return true;
      }
    );
  });
});
