import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canReadSensitivePersonalData,
  userDirectoryPolicy,
} from '@/server/policies/user-directory-policy';
import { toUserPublicDTO, toUserPublicDTOArray } from '@/server/dto/user-dto';

describe('RFC-08 User Directory Visibility & Personal Data Protection Policy', () => {
  const targetUserInDept1 = {
    id: 'user-001',
    name: 'Nguyễn Văn A',
    email: 'nva@qcet.edu.vn',
    role: 'STAFF',
    phone: '0912345678',
    departmentId: 'dept-cntt',
    department: {
      id: 'dept-cntt',
      name: 'Khoa Công nghệ Thông tin',
      shortName: 'CNTT',
    },
    // Tier 4 statutory HR fields in raw database entity
    citizenId: '052099001234',
    salary: 15000000,
    homeAddress: '123 Trần Hưng Đạo, Quy Nhơn, Bình Định',
    taxId: '8012345678',
    payrollData: { bankAccount: '190333444555', baseSalary: 5000000 },
  };

  const targetUserInDept2 = {
    id: 'user-002',
    name: 'Trần Thị B',
    email: 'ttb@qcet.edu.vn',
    role: 'STAFF',
    phone: '0987654321',
    departmentId: 'dept-daotao',
    department: {
      id: 'dept-daotao',
      name: 'Phòng Đào tạo',
      shortName: 'P.ĐT',
    },
    citizenId: '052099009999',
    salary: 18000000,
    homeAddress: '456 Lê Hồng Phong, Quy Nhơn, Bình Định',
  };

  // ==========================================================================
  // 1. SELF-ACCESS
  // ==========================================================================
  describe('Self-Access (Viewer === Target)', () => {
    it('allows user to read their own sensitive phone number', () => {
      const viewer = {
        id: 'user-001',
        role: 'STAFF',
        departmentId: 'dept-cntt',
      };

      const canRead = canReadSensitivePersonalData(viewer, targetUserInDept1);
      assert.strictEqual(canRead, true);

      const dto = toUserPublicDTO(targetUserInDept1, viewer);
      assert.ok(dto);
      assert.strictEqual(dto.phone, '0912345678');
    });

    it('works when viewer has userId field (AuthorizationContext format)', () => {
      const viewer = {
        userId: 'user-001',
        role: 'STAFF',
        departmentId: 'dept-cntt',
      };

      const canRead = canReadSensitivePersonalData(viewer, targetUserInDept1);
      assert.strictEqual(canRead, true);

      const dto = toUserPublicDTO(targetUserInDept1, viewer as any);
      assert.ok(dto);
      assert.strictEqual(dto.phone, '0912345678');
    });
  });

  // ==========================================================================
  // 2. REGULAR COLLEAGUE / GENERAL STAFF (TIER 3 DEFAULT HIDDEN)
  // ==========================================================================
  describe('Regular Colleague / General Staff', () => {
    it('hides phone number when viewed by same-unit colleague (Tier 3 default hidden)', () => {
      const colleagueSameUnit = {
        id: 'user-003',
        role: 'STAFF',
        departmentId: 'dept-cntt',
      };

      const canRead = canReadSensitivePersonalData(colleagueSameUnit, targetUserInDept1);
      assert.strictEqual(canRead, false);

      const dto = toUserPublicDTO(targetUserInDept1, colleagueSameUnit);
      assert.ok(dto);
      assert.strictEqual(dto.phone, null);
    });

    it('hides phone number when viewed by cross-unit colleague', () => {
      const colleagueCrossUnit = {
        id: 'user-002',
        role: 'STAFF',
        departmentId: 'dept-daotao',
      };

      const canRead = canReadSensitivePersonalData(colleagueCrossUnit, targetUserInDept1);
      assert.strictEqual(canRead, false);

      const dto = toUserPublicDTO(targetUserInDept1, colleagueCrossUnit);
      assert.ok(dto);
      assert.strictEqual(dto.phone, null);
    });
  });

  // ==========================================================================
  // 3. UNIT LEADERSHIP (TRUONG_PHONG, TRUONG_KHOA, GIAM_DOC_TRUNG_TAM, MANAGER)
  // ==========================================================================
  describe('Unit Leadership Scope', () => {
    const unitLeaderRoles = [
      'TRUONG_PHONG',
      'TRUONG_KHOA',
      'GIAM_DOC_TRUNG_TAM',
      'MANAGER',
      'PHO_TRUONG_PHONG',
      'PHO_TRUONG_KHOA',
    ];

    for (const role of unitLeaderRoles) {
      it(`allows unit leader with role ${role} to see phone of same-unit member`, () => {
        const unitLeader = {
          id: 'leader-dept1',
          role,
          departmentId: 'dept-cntt',
        };

        const canRead = canReadSensitivePersonalData(unitLeader, targetUserInDept1);
        assert.strictEqual(canRead, true);

        const dto = toUserPublicDTO(targetUserInDept1, unitLeader);
        assert.ok(dto);
        assert.strictEqual(dto.phone, '0912345678');
      });

      it(`hides phone from unit leader with role ${role} for cross-unit member`, () => {
        const unitLeader = {
          id: 'leader-dept1',
          role,
          departmentId: 'dept-cntt',
        };

        const canRead = canReadSensitivePersonalData(unitLeader, targetUserInDept2);
        assert.strictEqual(canRead, false);

        const dto = toUserPublicDTO(targetUserInDept2, unitLeader);
        assert.ok(dto);
        assert.strictEqual(dto.phone, null);
      });
    }

    it('supports position-based unit management (PositionAssignment.unitId)', () => {
      const positionLeader = {
        id: 'pos-leader-01',
        role: 'STAFF',
        positions: [
          {
            positionCode: 'TRUONG_KHOA',
            unitId: 'dept-cntt',
            isLeadership: true,
          },
        ],
      };

      // Same unit via position -> can read
      assert.strictEqual(canReadSensitivePersonalData(positionLeader, targetUserInDept1), true);
      const dto1 = toUserPublicDTO(targetUserInDept1, positionLeader as any);
      assert.strictEqual(dto1?.phone, '0912345678');

      // Cross unit -> cannot read
      assert.strictEqual(canReadSensitivePersonalData(positionLeader, targetUserInDept2), false);
      const dto2 = toUserPublicDTO(targetUserInDept2, positionLeader as any);
      assert.strictEqual(dto2?.phone, null);
    });
  });

  // ==========================================================================
  // 4. INSTITUTIONAL LEADERSHIP (RECTORATE / BGH)
  // ==========================================================================
  describe('Institutional Leadership (Rectorate / BGH)', () => {
    const institutionalRoles = [
      'BAN_GIAM_HIEU',
      'BGH',
      'HIEU_TRUONG',
      'PHO_HIEU_TRUONG',
    ];

    for (const role of institutionalRoles) {
      it(`allows institutional leader with role ${role} to see phone for all users across units`, () => {
        const execLeader = {
          id: 'exec-leader-01',
          role,
          departmentId: 'dept-bgh',
        };

        // Dept 1
        assert.strictEqual(canReadSensitivePersonalData(execLeader, targetUserInDept1), true);
        const dto1 = toUserPublicDTO(targetUserInDept1, execLeader);
        assert.strictEqual(dto1?.phone, '0912345678');

        // Dept 2
        assert.strictEqual(canReadSensitivePersonalData(execLeader, targetUserInDept2), true);
        const dto2 = toUserPublicDTO(targetUserInDept2, execLeader);
        assert.strictEqual(dto2?.phone, '0987654321');
      });
    }

    it('recognizes institutional leadership positions via positions array', () => {
      const leaderWithPosition = {
        id: 'rector-01',
        role: 'STAFF',
        positions: [
          {
            positionCode: 'HIEU_TRUONG',
            unitId: 'unit-root',
            isLeadership: true,
          },
        ],
      };

      assert.strictEqual(canReadSensitivePersonalData(leaderWithPosition, targetUserInDept1), true);
      assert.strictEqual(canReadSensitivePersonalData(leaderWithPosition, targetUserInDept2), true);
    });
  });

  // ==========================================================================
  // 5. TECHNICAL ADMIN (SYSTEM_ADMIN) - SEPARATION OF POWERS
  // ==========================================================================
  describe('Technical Administrator (SYSTEM_ADMIN) - Separation of Powers', () => {
    it('strictly denies SYSTEM_ADMIN from viewing sensitive personal phone of others', () => {
      const sysAdmin = {
        id: 'admin-001',
        role: 'SYSTEM_ADMIN',
        departmentId: 'dept-cntt', // Even if assigned to same department!
        isSystemAdmin: true,
      };

      // Technical privilege must not become business authority to view personal data
      const canRead = canReadSensitivePersonalData(sysAdmin, targetUserInDept1);
      assert.strictEqual(canRead, false);

      const dto = toUserPublicDTO(targetUserInDept1, sysAdmin);
      assert.ok(dto);
      assert.strictEqual(dto.phone, null);

      // Cross-unit user
      const canRead2 = canReadSensitivePersonalData(sysAdmin, targetUserInDept2);
      assert.strictEqual(canRead2, false);
      const dto2 = toUserPublicDTO(targetUserInDept2, sysAdmin);
      assert.strictEqual(dto2?.phone, null);
    });

    it('allows SYSTEM_ADMIN to view their own phone (Self-Access override)', () => {
      const sysAdmin = {
        id: 'admin-001',
        name: 'Quản trị Kỹ thuật',
        email: 'sysadmin@qcet.edu.vn',
        role: 'SYSTEM_ADMIN',
        phone: '0900000000',
        departmentId: 'dept-cntt',
        isSystemAdmin: true,
      };

      const canReadSelf = canReadSensitivePersonalData(sysAdmin, sysAdmin);
      assert.strictEqual(canReadSelf, true);

      const dtoSelf = toUserPublicDTO(sysAdmin, sysAdmin);
      assert.ok(dtoSelf);
      assert.strictEqual(dtoSelf.phone, '0900000000');
    });
  });

  // ==========================================================================
  // 6. TIER 4 STATUTORY HR DATA SANITIZATION (ZERO LEAKAGE)
  // ==========================================================================
  describe('Tier 4 Statutory HR Data Sanitization', () => {
    it('never exposes citizenId, salary, homeAddress, or payrollData in DTO for any viewer', () => {
      const viewers = [
        { id: 'user-001', role: 'STAFF' }, // Self
        { id: 'leader-dept1', role: 'TRUONG_KHOA', departmentId: 'dept-cntt' }, // Unit Leader
        { id: 'rector-01', role: 'HIEU_TRUONG' }, // Institutional Leader
        { id: 'admin-001', role: 'SYSTEM_ADMIN', isSystemAdmin: true }, // Sysadmin
        undefined, // Unspecified viewer (backward compatibility)
      ];

      for (const viewer of viewers) {
        const dto = toUserPublicDTO(targetUserInDept1, viewer as any);
        assert.ok(dto);

        // Strict invariant: Tier 4 attributes must never exist on DTO
        assert.strictEqual((dto as any).citizenId, undefined);
        assert.strictEqual((dto as any).salary, undefined);
        assert.strictEqual((dto as any).homeAddress, undefined);
        assert.strictEqual((dto as any).taxId, undefined);
        assert.strictEqual((dto as any).payrollData, undefined);

        // Verify that keys only contain Tier 1 + allowed phone
        const keys = Object.keys(dto);
        for (const forbidden of ['citizenId', 'salary', 'homeAddress', 'taxId', 'payrollData']) {
          assert.ok(!keys.includes(forbidden), `Forbidden Tier 4 key '${forbidden}' found in DTO`);
        }
      }
    });
  });

  // ==========================================================================
  // 7. ARRAY MAPPER & BACKWARD COMPATIBILITY
  // ==========================================================================
  describe('toUserPublicDTOArray & Backward Compatibility', () => {
    it('passes viewer context to all elements in toUserPublicDTOArray', () => {
      const viewer = {
        id: 'leader-dept1',
        role: 'TRUONG_KHOA',
        departmentId: 'dept-cntt',
      };

      const users = [targetUserInDept1, targetUserInDept2];
      const dtos = toUserPublicDTOArray(users, viewer);

      assert.strictEqual(dtos.length, 2);
      // Dept 1 member -> seen by Dept 1 leader
      assert.strictEqual(dtos[0].phone, '0912345678');
      // Dept 2 member -> redacted for Dept 1 leader
      assert.strictEqual(dtos[1].phone, null);
    });

    it('preserves phone when viewer is omitted (backward compatibility)', () => {
      const dto = toUserPublicDTO(targetUserInDept1);
      assert.ok(dto);
      assert.strictEqual(dto.phone, '0912345678');

      const dtos = toUserPublicDTOArray([targetUserInDept1, targetUserInDept2]);
      assert.strictEqual(dtos[0].phone, '0912345678');
      assert.strictEqual(dtos[1].phone, '0987654321');
    });
  });
});
