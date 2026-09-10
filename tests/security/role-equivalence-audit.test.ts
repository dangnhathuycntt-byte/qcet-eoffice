import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  normalizeRole,
  requireRole,
  ROLE_EQUIVALENCE_MAP,
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
  const projectRoot = path.resolve(__dirname, '../../');
  const serverDir = path.join(projectRoot, 'src/server');
  const libDir = path.join(projectRoot, 'src/lib');
  const authDir = path.join(serverDir, 'authorization');

  function getFilesRecursively(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getFilesRecursively(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('verifies src/server/authorization/ contains ZERO imports or usages of normalizeRole or ROLE_EQUIVALENCE_MAP', () => {
    const authFiles = getFilesRecursively(authDir);
    assert.ok(authFiles.length > 0, 'src/server/authorization/ should contain files');

    const violations: { file: string; match: string }[] = [];
    const pattern = /\b(normalizeRole|requireRole|ROLE_EQUIVALENCE_MAP)\b/;

    for (const file of authFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const match = pattern.exec(content);
      if (match) {
        violations.push({
          file: path.relative(projectRoot, file),
          match: match[0],
        });
      }
    }

    assert.strictEqual(
      violations.length,
      0,
      `Found forbidden role equivalence references in src/server/authorization/: ${JSON.stringify(violations, null, 2)}`
    );
  });

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
      departmentId: 'CNTT',
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

  it('audits and inventories all occurrences in src/server and src/lib into approved non-business classifications', () => {
    const allFiles = [
      ...getFilesRecursively(serverDir),
      ...getFilesRecursively(libDir),
    ];

    const targetPattern = /\b(normalizeRole|requireRole|ROLE_EQUIVALENCE_MAP)\b/g;

    type OccurrenceClassification =
      | 'AUTHENTICATION_COMPATIBILITY'
      | 'UI_DISPLAY'
      | 'LEGACY_ADAPTER';

    const approvedInventory: Record<
      string,
      {
        classification: OccurrenceClassification;
        description: string;
      }
    > = {
      'src/server/api/request-context.ts': {
        classification: 'AUTHENTICATION_COMPATIBILITY',
        description: 'Session cookie and token role normalization with strict deprecation notices',
      },
      'src/server/api/auth.ts': {
        classification: 'LEGACY_ADAPTER',
        description: 'Re-exports requireAuthenticated and requireRole for backwards compatibility',
      },
      'src/server/policies/executive-policy.ts': {
        classification: 'LEGACY_ADAPTER',
        description: 'Legacy executive policy adapter',
      },
      'src/server/policies/user-policy.ts': {
        classification: 'LEGACY_ADAPTER',
        description: 'Legacy user policy adapter',
      },
      'src/server/policies/document-policy.ts': {
        classification: 'LEGACY_ADAPTER',
        description: 'Legacy document policy adapter (read query fallback only)',
      },
      'src/server/policies/task-policy.ts': {
        classification: 'LEGACY_ADAPTER',
        description: 'Legacy task policy adapter',
      },
      'src/server/tasks/task-policy.ts': {
        classification: 'LEGACY_ADAPTER',
        description: 'Legacy task query filter adapter',
      },
    };

    const foundOccurrences: { file: string; lines: number[]; symbols: string[] }[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (!targetPattern.test(content)) continue;

      targetPattern.lastIndex = 0; // reset regex state
      const relPath = path.relative(projectRoot, file);
      const lines = content.split('\n');
      const matchedLines: number[] = [];
      const symbols = new Set<string>();

      lines.forEach((line, idx) => {
        let match;
        const lineRegex = /\b(normalizeRole|requireRole|ROLE_EQUIVALENCE_MAP)\b/g;
        while ((match = lineRegex.exec(line)) !== null) {
          matchedLines.push(idx + 1);
          symbols.add(match[1]);
        }
      });

      foundOccurrences.push({
        file: relPath,
        lines: matchedLines,
        symbols: Array.from(symbols),
      });
    }

    // Assert that every occurrence is in the approved inventory
    for (const occurrence of foundOccurrences) {
      const registered = approvedInventory[occurrence.file];
      assert.ok(
        registered,
        `Unapproved occurrence of role equivalence found in file: ${occurrence.file}. Every occurrence must be inventoried and must NOT be used for business authorization!`
      );
      assert.notStrictEqual(
        (registered as any).classification,
        'BUSINESS_AUTHORIZATION',
        `File ${occurrence.file} is categorized as business authorization, which is strictly prohibited!`
      );
    }

    // Verify that src/lib has ZERO occurrences
    const libOccurrences = foundOccurrences.filter((o) => o.file.startsWith('src/lib'));
    assert.strictEqual(
      libOccurrences.length,
      0,
      `src/lib/ must contain zero occurrences of role equivalence, but found: ${JSON.stringify(libOccurrences)}`
    );
  });
});
