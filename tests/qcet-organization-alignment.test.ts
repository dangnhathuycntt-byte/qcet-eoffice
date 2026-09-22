import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  QCET_UNIT_CANONICAL_MAP,
  QCET_CANONICAL_UNITS,
  toCanonicalUnitCode,
  isCanonicalUnitCode,
} from '../src/lib/departments';
import { QCET_DEPARTMENTS } from '../src/components/org/organization-tree';
import { DEFAULT_DEMO_USERS } from '../src/lib/role-task-filter';

describe('QCET Real Organization & Seed Alignment Suite', () => {
  const CANONICAL_15_CODES = [
    'BGH',
    'P_QLDT',
    'P_TC',
    'P_TCDBCL',
    'P_HCQT',
    'P_TSHTQT',
    'TT_STT',
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

  test('1. Canonical 15 units exist in departments metadata and canonical mapping', () => {
    // Check canonical map covers all 15 canonical units
    for (const code of CANONICAL_15_CODES) {
      assert.ok(
        QCET_UNIT_CANONICAL_MAP[code] === code ||
          QCET_UNIT_CANONICAL_MAP[code.toLowerCase()] === code,
        `Canonical code ${code} should map to itself in QCET_UNIT_CANONICAL_MAP`
      );
    }

    // Check legacy aliases map correctly to canonical codes
    const legacyExpectations: Record<string, string> = {
      bgh: 'BGH',
      BAN_GIAM_HIEU: 'BGH',
      'ban-giam-hieu': 'BGH',
      'dept-bgh': 'BGH',
      P_DTQLKH: 'P_QLDT',
      DT_QLKH: 'P_QLDT',
      DAO_TAO: 'P_QLDT',
      dao_tao: 'P_QLDT',
      'phong-dao-tao': 'P_QLDT',
      'dept-p-qldt': 'P_QLDT',
      P_KTDBCL: 'P_TCDBCL',
      TC_DBCL: 'P_TCDBCL',
      KHAO_THI: 'P_TCDBCL',
      'dept-p-tcdbcl': 'P_TCDBCL',
      P_CTHSSV: 'P_TSHTQT',
      TS_HTQT: 'P_TSHTQT',
      CTHSSV: 'P_TSHTQT',
      'phong-cthssv': 'P_TSHTQT',
      'dept-p-tshtqt': 'P_TSHTQT',
      P_KHTC: 'P_TC',
      KHTC: 'P_TC',
      TAI_CHINH: 'P_TC',
      'phong-tckt': 'P_TC',
      'dept-p-tc': 'P_TC',
      TT_DCC: 'TT_STT',
      QTM_CNTT: 'TT_STT',
      TRUYEN_THONG: 'TT_STT',
      'dept-tt-stt': 'TT_STT',
      K_DTTH: 'K_CNTT',
      CNTT: 'K_CNTT',
      'khoa-cntt': 'K_CNTT',
      'dept-k-dtth': 'K_CNTT',
      K_COKHI: 'K_CK',
      'khoa-co-khi': 'K_CK',
      'dept-k-ck': 'K_CK',
      K_KTCN: 'K_CNOTO',
      'khoa-oto': 'K_CNOTO',
      'dept-k-cnoto': 'K_CNOTO',
      'khoa-dien': 'K_DIEN',
      'dept-k-dien': 'K_DIEN',
      K_DL: 'K_DULICH',
      'khoa-dulich': 'K_DULICH',
      'dept-k-dulich': 'K_DULICH',
      K_KTTH: 'K_KTQT',
      KINH_TE: 'K_KTQT',
      'dept-k-ktth': 'K_KTQT',
      'khoa-vhnt': 'K_VHNT',
      'dept-k-vhnt': 'K_VHNT',
      K_VHTHPT: 'K_DAICUONG',
      K_COBAN: 'K_DAICUONG',
      'dept-k-daicuong': 'K_DAICUONG',
      'khoa-nongnghiep': 'K_KTNN',
      'dept-k-ktnn': 'K_KTNN',
    };

    for (const [legacy, canonical] of Object.entries(legacyExpectations)) {
      assert.strictEqual(
        QCET_UNIT_CANONICAL_MAP[legacy],
        canonical,
        `Legacy code ${legacy} must resolve to canonical ${canonical}`
      );
      assert.strictEqual(
        toCanonicalUnitCode(legacy),
        canonical,
        `toCanonicalUnitCode(${legacy}) must return canonical ${canonical}`
      );
      assert.strictEqual(
        isCanonicalUnitCode(legacy),
        true,
        `isCanonicalUnitCode(${legacy}) must return true for mapped legacy alias`
      );
    }

    // Verify QCET_CANONICAL_UNITS contains all 15 core units
    for (const code of CANONICAL_15_CODES) {
      assert.ok(
        (QCET_CANONICAL_UNITS as readonly string[]).includes(code),
        `QCET_CANONICAL_UNITS must include ${code}`
      );
      assert.strictEqual(
        isCanonicalUnitCode(code),
        true,
        `isCanonicalUnitCode(${code}) must be true`
      );
    }
    assert.strictEqual(isCanonicalUnitCode('INVALID_NON_EXISTENT_UNIT'), false);
  });

  test('3. QCET_DEPARTMENTS in organization-tree has 15+ units and 100% @cdktcnqn.edu.vn emails', () => {
    assert.ok(QCET_DEPARTMENTS.length >= 15);
    const codes = QCET_DEPARTMENTS.map((d) => d.code);

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
    for (const dept of QCET_DEPARTMENTS) {
      assert.ok(
        dept.email.endsWith('@cdktcnqn.edu.vn'),
        `Department email ${dept.email} must end with @cdktcnqn.edu.vn`
      );
      assert.strictEqual(
        dept.email.includes('@qcet.edu.vn'),
        false,
        `Department email ${dept.email} must not use @qcet.edu.vn`
      );

      for (const member of dept.members) {
        assert.ok(
          member.email.endsWith('@cdktcnqn.edu.vn'),
          `Member email ${member.email} must end with @cdktcnqn.edu.vn`
        );
        assert.strictEqual(
          member.email.includes('@qcet.edu.vn'),
          false,
          `Member email ${member.email} must not use @qcet.edu.vn`
        );
      }
    }
  });

  test('4. DEFAULT_DEMO_USERS in role-task-filter.ts uses real QCET identities', () => {
    assert.strictEqual(DEFAULT_DEMO_USERS.length, 3);
    const [admin, manager, staff] = DEFAULT_DEMO_USERS;

    // ADMIN: ThS. Đặng Nhật Huy (BGH - Hiệu trưởng)
    assert.strictEqual(admin.role, 'ADMIN');
    assert.ok(
      admin.name.includes('Đặng Nhật Huy'),
      `Admin name must be Đặng Nhật Huy, got ${admin.name}`
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

    // STAFF: KS. Nguyễn Ngọc Vinh
    assert.strictEqual(staff.role, 'STAFF');
    assert.ok(
      staff.name.includes('Nguyễn Ngọc Vinh'),
      `Staff name must be Nguyễn Ngọc Vinh, got ${staff.name}`
    );
    assert.ok(
      staff.email.endsWith('@cdktcnqn.edu.vn'),
      `Staff email must end with @cdktcnqn.edu.vn, got ${staff.email}`
    );
  });
});
