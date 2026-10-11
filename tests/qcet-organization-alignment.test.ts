import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { QCET_UNIT_CANONICAL_MAP, QCET_CANONICAL_UNITS, toCanonicalUnitCode } from '../src/lib/departments';
import { QCET_ORG_UNITS } from '../src/lib/org/org-structure';
import { DEFAULT_DEMO_USERS } from '../src/lib/role-task-filter';

describe('QCET Real Organization & Seed Alignment Suite', () => {
  const CANONICAL_15_CODES = [
    'BGH',
    'P_QLDT',
    'P_TC',
    'P_TCDBCL',
    'P_HCQT',
    'P_TSHTQT',
    'TT_SO_TT',
    'K_CNTT',
    'K_CK',
    'K_DIEN',
    'K_CNOTO',
    'K_DULICH',
    'K_KTQT',
    'K_KTNN',
    'K_VHNT',
    'K_DAICUONG',
  ];

  test('3. QCET_ORG_UNITS has 15+ units and 100% @cdktcnqn.edu.vn emails', () => {
    assert.ok(QCET_ORG_UNITS.length >= 15);
    const codes = QCET_ORG_UNITS.map((d) => d.code);

    // Verify key units exist
    assert.ok(codes.includes('BGH'), 'BGH must exist in organization tree');
    assert.ok(codes.includes('P_QLDT'), 'P_QLDT must exist in organization tree');
    assert.ok(codes.includes('P_TC'), 'P_TC must exist in organization tree');
    assert.ok(codes.includes('P_TCDBCL'), 'P_TCDBCL must exist in organization tree');
    assert.ok(codes.includes('P_HCQT'), 'P_HCQT must exist in organization tree');
    assert.ok(codes.includes('P_TSHTQT'), 'P_TSHTQT must exist in organization tree');
    assert.ok(codes.includes('TT_STT'), 'TT_STT must exist in organization tree');
    assert.ok(codes.includes('K_CNTT'), 'K_CNTT must exist in organization tree');
    assert.ok(codes.includes('K_CK'), 'K_CK must exist in organization tree');
    assert.ok(codes.includes('K_DIEN'), 'K_DIEN must exist in organization tree');
    assert.ok(codes.includes('K_CNOTO'), 'K_CNOTO must exist in organization tree');
    assert.ok(codes.includes('K_DULICH'), 'K_DULICH must exist in organization tree');
    assert.ok(codes.includes('K_KTQT'), 'K_KTQT must exist in organization tree');
    assert.ok(codes.includes('K_KTNN'), 'K_KTNN must exist in organization tree');
    assert.ok(codes.includes('K_VHNT'), 'K_VHNT must exist in organization tree');
    assert.ok(codes.includes('K_DAICUONG'), 'K_DAICUONG must exist in organization tree');

    // All department emails must use @cdktcnqn.edu.vn and none use @qcet.edu.vn
    for (const unit of QCET_ORG_UNITS) {
      assert.ok(
        unit.email.endsWith('@cdktcnqn.edu.vn'),
        `Department email ${unit.email} must end with @cdktcnqn.edu.vn`
      );
      assert.strictEqual(
        unit.email.includes('@qcet.edu.vn'),
        false,
        `Department email ${unit.email} must not use @qcet.edu.vn`
      );
    }
  });

  test('4. DEFAULT_DEMO_USERS in role-task-filter.ts uses real QCET identities', () => {
    assert.strictEqual(DEFAULT_DEMO_USERS.length, 4);
    const admin = DEFAULT_DEMO_USERS.find((u) => u.role === 'ADMIN')!;
    const manager = DEFAULT_DEMO_USERS.find((u) => u.role === 'MANAGER')!;
    const staffHuy = DEFAULT_DEMO_USERS.find((u) => u.id === 'user-staff-huy')!;
    const staffVinh = DEFAULT_DEMO_USERS.find((u) => u.id === 'user-staff-vinh')!;

    assert.ok(admin, 'Admin must exist in DEFAULT_DEMO_USERS');
    assert.ok(manager, 'Manager must exist in DEFAULT_DEMO_USERS');
    assert.ok(staffHuy, 'Staff Huy must exist in DEFAULT_DEMO_USERS');
    assert.ok(staffVinh, 'Staff Vinh must exist in DEFAULT_DEMO_USERS');

    // ADMIN: ThS. Phạm Văn Tường (BGH - Hiệu trưởng)
    assert.strictEqual(admin.role, 'ADMIN');
    assert.ok(
      admin.name.includes('Phạm Văn Tường'),
      `Admin name must be Phạm Văn Tường, got ${admin.name}`
    );
    assert.ok(
      admin.email.endsWith('@cdktcnqn.edu.vn'),
      `Admin email must end with @cdktcnqn.edu.vn, got ${admin.email}`
    );

    // MANAGER: ThS. Lê Văn Thí (P_QLDT)
    assert.strictEqual(manager.role, 'MANAGER');
    assert.ok(
      manager.name.includes('Lê Văn Thí'),
      `Manager name must be Lê Văn Thí, got ${manager.name}`
    );
    assert.ok(
      manager.email.endsWith('@cdktcnqn.edu.vn'),
      `Manager email must end with @cdktcnqn.edu.vn, got ${manager.email}`
    );

    // STAFF: ThS. Đặng Nhật Huy
    assert.strictEqual(staffHuy.role, 'STAFF');
    assert.ok(
      staffHuy.name.includes('Đặng Nhật Huy'),
      `Staff Huy name must be Đặng Nhật Huy, got ${staffHuy.name}`
    );
    assert.ok(
      staffHuy.email.endsWith('@cdktcnqn.edu.vn'),
      `Staff Huy email must end with @cdktcnqn.edu.vn, got ${staffHuy.email}`
    );

    // STAFF: KS. Nguyễn Ngọc Vinh
    assert.strictEqual(staffVinh.role, 'STAFF');
    assert.ok(
      staffVinh.name.includes('Nguyễn Ngọc Vinh'),
      `Staff Vinh name must be Nguyễn Ngọc Vinh, got ${staffVinh.name}`
    );
    assert.ok(
      staffVinh.email.endsWith('@cdktcnqn.edu.vn'),
      `Staff Vinh email must end with @cdktcnqn.edu.vn, got ${staffVinh.email}`
    );
  });
});
