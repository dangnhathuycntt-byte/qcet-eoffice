/**
 * Test Suite: Department to OrganizationalUnit Migration Track (WI-8.2 / RFC-02 / ADR-006)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPARTMENT_TO_ORG_UNIT_CODE_MAP,
  resolveUnitIdForDepartmentId,
  verifyDepartmentUnitParity,
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
  });
});
