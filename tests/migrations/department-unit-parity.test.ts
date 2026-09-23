/**
 * Test Suite: Department to OrganizationalUnit Migration Track (WI-8.2 / RFC-02 / ADR-006)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPARTMENT_TO_ORG_UNIT_CODE_MAP,
  resolveUnitIdForDepartmentId,
  verifyDepartmentUnitParity,
  expandedFkParityCheck,
} from '@/domain/organization/migration';

describe('WI-8.2: Department to OrganizationalUnit Migration Track', () => {
  describe('1. Canonical Code Mapping Table', () => {
    it('covers training and academic units', () => {
      assert.strictEqual(DEPARTMENT_TO_ORG_UNIT_CODE_MAP['P_QLDT'], 'P_QLDT');
      assert.strictEqual(DEPARTMENT_TO_ORG_UNIT_CODE_MAP['phong-dao-tao'], 'P_QLDT');
      assert.strictEqual(DEPARTMENT_TO_ORG_UNIT_CODE_MAP['DT_QLKH'], 'P_QLDT');
    });

    it('covers finance, testing, and administration departments', () => {
      assert.strictEqual(DEPARTMENT_TO_ORG_UNIT_CODE_MAP['P_TCKT'], 'P_TCKT');
      assert.strictEqual(DEPARTMENT_TO_ORG_UNIT_CODE_MAP['P_KT_DBCL'], 'P_KT_DBCL');
      assert.strictEqual(DEPARTMENT_TO_ORG_UNIT_CODE_MAP['P_TCHC_QT'], 'P_TCHC_QT');
    });

    it('covers technical and academic faculties', () => {
      assert.strictEqual(DEPARTMENT_TO_ORG_UNIT_CODE_MAP['K_CNTT'], 'K_CNTT');
      assert.strictEqual(DEPARTMENT_TO_ORG_UNIT_CODE_MAP['khoa-cntt'], 'K_CNTT');
      assert.strictEqual(DEPARTMENT_TO_ORG_UNIT_CODE_MAP['K_CK'], 'K_CK');
      assert.strictEqual(DEPARTMENT_TO_ORG_UNIT_CODE_MAP['K_DIEN_DTV'], 'K_DIEN_DTV');
    });

    it('maps school root and executive leadership', () => {
      assert.strictEqual(DEPARTMENT_TO_ORG_UNIT_CODE_MAP['QCET'], 'QCET');
      assert.strictEqual(DEPARTMENT_TO_ORG_UNIT_CODE_MAP['BGH'], 'QCET');
      assert.strictEqual(DEPARTMENT_TO_ORG_UNIT_CODE_MAP['ban-giam-hieu'], 'QCET');
    });
  });

  describe('2. Unit ID Resolution (resolveUnitIdForDepartmentId)', () => {
    it('resolves unit id by mapped canonical code for active unit', async () => {
      const mockDb: any = {
        organizationalUnit: {
          findFirst: async ({ where }: any) => {
            if (where.code === 'P_QLDT') {
              return { id: 'unit_qldt_uuid' };
            }
            return null;
          },
        },
      };

      const unitId = await resolveUnitIdForDepartmentId(mockDb, 'phong-dao-tao');
      assert.strictEqual(unitId, 'unit_qldt_uuid');
    });

    it('fails closed and returns null on unknown/non-existent department', async () => {
      const mockDb: any = {
        organizationalUnit: {
          findFirst: async () => null,
        },
      };

      const unitId = await resolveUnitIdForDepartmentId(mockDb, 'UNKNOWN_DEPT_XYZ');
      assert.strictEqual(unitId, null);
    });

    it('returns null for unmapped department code not in DEPARTMENT_TO_ORG_UNIT_CODE_MAP', async () => {
      const mockDb: any = {
        organizationalUnit: {
          findFirst: async () => null,
        },
      };

      // A key that definitely doesn't exist in the map
      const unitId = await resolveUnitIdForDepartmentId(mockDb, 'PHONG_KHONG_TON_TAI');
      assert.strictEqual(unitId, null);
    });

    it('returns null for invalid departmentId type (non-string)', async () => {
      const mockDb: any = {
        organizationalUnit: {
          findFirst: async () => ({ id: 'should-not-be-reached' }),
        },
      };

      // Pass null (cast to string to satisfy TS; runtime guard should short-circuit)
      const unitId = await resolveUnitIdForDepartmentId(mockDb, null as unknown as string);
      assert.strictEqual(unitId, null);
    });

    it('returns null for empty string departmentId', async () => {
      const mockDb: any = {
        organizationalUnit: {
          findFirst: async () => ({ id: 'should-not-be-reached' }),
        },
      };

      const unitId = await resolveUnitIdForDepartmentId(mockDb, '');
      assert.strictEqual(unitId, null);
    });
  });

  describe('3. Parity Verification (verifyDepartmentUnitParity)', () => {
    it('confirms 100% parity when all departments, FKs, and tasks match', async () => {
      const mockDepartments = [
        { id: 'P_QLDT', name: 'Phòng Quản lý Đào tạo' },
        { id: 'K_CNTT', name: 'Khoa Công nghệ Thông tin' },
      ];

      const mockTasks = [
        { id: 'task-1', departmentId: 'P_QLDT', leadUnitId: 'unit-qldt' },
        { id: 'task-2', departmentId: 'K_CNTT', leadUnitId: 'unit-cntt' },
      ];

      const mockDb: any = {
        department: {
          findMany: async () => mockDepartments,
        },
        task: {
          findMany: async () => mockTasks,
        },
        user: { findMany: async () => [] },
        dacumDelegation: { findMany: async () => [] },
        document: { findMany: async () => [] },
        documentDirective: { findMany: async () => [] },
        jobCatalogItem: { findMany: async () => [] },
        dacumDuty: { findMany: async () => [] },
        organizationalUnit: {
          findFirst: async ({ where }: any) => {
            if (where.code === 'P_QLDT') return { id: 'unit-qldt' };
            if (where.code === 'K_CNTT') return { id: 'unit-cntt' };
            return null;
          },
          findUnique: async ({ where }: any) => ({ id: where.id }),
        },
      };

      const report = await verifyDepartmentUnitParity(mockDb);
      assert.strictEqual(report.isParityMatched, true);
      assert.strictEqual(report.totalDepartments, 2);
      assert.strictEqual(report.mappedDepartments, 2);
      assert.strictEqual(report.unmappedDepartmentIds.length, 0);
      assert.strictEqual(report.tasksWithLeadUnit, 2);
      assert.strictEqual(report.tasksMissingLeadUnit, 0);
      assert.strictEqual(report.mismatchedTaskIds.length, 0);
      assert.strictEqual(report.invalidLeadUnitIds.length, 0);
    });

    it('detects mismatched leadUnitId against department mapping', async () => {
      const mockDepartments = [
        { id: 'P_QLDT', name: 'Phòng Quản lý Đào tạo' },
      ];

      const mockTasks = [
        // Task has department P_QLDT (maps to unit-qldt) but leadUnitId points to unit-cntt
        { id: 'task-wrong-mapping', departmentId: 'P_QLDT', leadUnitId: 'unit-cntt' },
      ];

      const mockDb: any = {
        department: {
          findMany: async () => mockDepartments,
        },
        task: {
          findMany: async () => mockTasks,
        },
        user: { findMany: async () => [] },
        dacumDelegation: { findMany: async () => [] },
        document: { findMany: async () => [] },
        documentDirective: { findMany: async () => [] },
        jobCatalogItem: { findMany: async () => [] },
        dacumDuty: { findMany: async () => [] },
        organizationalUnit: {
          findFirst: async ({ where }: any) => {
            if (where.code === 'P_QLDT') return { id: 'unit-qldt' };
            return null;
          },
          findUnique: async ({ where }: any) => ({ id: where.id }),
        },
      };

      const report = await verifyDepartmentUnitParity(mockDb);
      assert.strictEqual(report.isParityMatched, false);
      assert.deepStrictEqual(report.mismatchedTaskIds, ['task-wrong-mapping']);
    });

    it('report includes perModelSummary array', async () => {
      const mockDb: any = {
        department: { findMany: async () => [] },
        task: { findMany: async () => [] },
        user: { findMany: async () => [] },
        dacumDelegation: { findMany: async () => [] },
        document: { findMany: async () => [] },
        documentDirective: { findMany: async () => [] },
        jobCatalogItem: { findMany: async () => [] },
        dacumDuty: { findMany: async () => [] },
        organizationalUnit: {
          findFirst: async () => null,
          findUnique: async () => null,
        },
      };

      const report = await verifyDepartmentUnitParity(mockDb);
      assert.ok(Array.isArray(report.perModelSummary), 'perModelSummary should be an array');
      assert.ok(report.perModelSummary.length > 0, 'perModelSummary should have entries');

      // Each entry has the right shape
      for (const entry of report.perModelSummary) {
        assert.ok(typeof entry.model === 'string');
        assert.ok(typeof entry.totalWithDeptId === 'number');
        assert.ok(typeof entry.mapped === 'number');
        assert.ok(typeof entry.unmapped === 'number');
      }
    });
  });

  describe('4. Expanded FK Parity (expandedFkParityCheck)', () => {
    it('returns per-model summary for all 8 department-referencing fields', async () => {
      const mockDb: any = {
        user: {
          findMany: async () => [{ departmentId: 'P_QLDT' }, { departmentId: 'UNKNOWN_XYZ' }],
        },
        task: {
          findMany: async () => [{ departmentId: 'K_CNTT' }],
        },
        dacumDelegation: {
          findMany: async () => [],
        },
        document: {
          findMany: async () => [],
        },
        documentDirective: {
          findMany: async () => [],
        },
        jobCatalogItem: {
          findMany: async () => [],
        },
        dacumDuty: {
          findMany: async () => [],
        },
        organizationalUnit: {
          findFirst: async ({ where }: any) => {
            if (where.code === 'P_QLDT') return { id: 'unit-qldt' };
            if (where.code === 'K_CNTT') return { id: 'unit-cntt' };
            return null;
          },
        },
      };

      const summary = await expandedFkParityCheck(mockDb);
      assert.ok(Array.isArray(summary));
      // Should have 8 entries (one per model.field combination)
      assert.strictEqual(summary.length, 8);

      const userEntry = summary.find((s) => s.model === 'user.departmentId');
      assert.ok(userEntry, 'should have user.departmentId entry');
      assert.strictEqual(userEntry!.totalWithDeptId, 2);
      assert.strictEqual(userEntry!.mapped, 1);    // P_QLDT maps OK
      assert.strictEqual(userEntry!.unmapped, 1);  // UNKNOWN_XYZ has no mapping

      const taskEntry = summary.find((s) => s.model === 'task.departmentId');
      assert.ok(taskEntry, 'should have task.departmentId entry');
      assert.strictEqual(taskEntry!.totalWithDeptId, 1);
      assert.strictEqual(taskEntry!.mapped, 1);
      assert.strictEqual(taskEntry!.unmapped, 0);
    });

    it('gracefully handles model with no records', async () => {
      const mockDb: any = {
        user: { findMany: async () => [] },
        task: { findMany: async () => [] },
        dacumDelegation: { findMany: async () => [] },
        document: { findMany: async () => [] },
        documentDirective: { findMany: async () => [] },
        jobCatalogItem: { findMany: async () => [] },
        dacumDuty: { findMany: async () => [] },
        organizationalUnit: {
          findFirst: async () => null,
        },
      };

      const summary = await expandedFkParityCheck(mockDb);
      for (const entry of summary) {
        assert.strictEqual(entry.totalWithDeptId, 0);
        assert.strictEqual(entry.mapped, 0);
        assert.strictEqual(entry.unmapped, 0);
      }
    });

    it('counts unmapped department codes correctly', async () => {
      const mockDb: any = {
        user: { findMany: async () => [] },
        task: { findMany: async () => [] },
        dacumDelegation: {
          findMany: async () => [
            { departmentId: 'PHONG_KHONG_CO_TRONG_MAP' },
            { departmentId: 'PHONG_KHONG_CO_TRONG_MAP_2' },
          ],
        },
        document: { findMany: async () => [] },
        documentDirective: { findMany: async () => [] },
        jobCatalogItem: { findMany: async () => [] },
        dacumDuty: { findMany: async () => [] },
        organizationalUnit: {
          findFirst: async () => null,
        },
      };

      const summary = await expandedFkParityCheck(mockDb);
      const delegEntry = summary.find((s) => s.model === 'dacumDelegation.departmentId');
      assert.ok(delegEntry);
      assert.strictEqual(delegEntry!.totalWithDeptId, 2);
      assert.strictEqual(delegEntry!.mapped, 0);
      assert.strictEqual(delegEntry!.unmapped, 2);
    });
  });
});
