import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  QCET_DEPARTMENT_GROUPS,
  QCET_UNIT_CANONICAL_MAP,
  QCET_CANONICAL_UNITS,
  toCanonicalUnitCode,
  isCanonicalUnitCode,
  getDepartmentByCode,
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

  test('2. QCET_DEPARTMENT_GROUPS contains real canonical units and leaders', () => {
    assert.ok(Array.isArray(QCET_DEPARTMENT_GROUPS));
    assert.ok(QCET_DEPARTMENT_GROUPS.length >= 15);

    const bghGroup = QCET_DEPARTMENT_GROUPS.find(
      (g) => g.code === 'BGH' || g.id === 'bgh'
    );
    assert.ok(bghGroup, 'BGH group must exist in QCET_DEPARTMENT_GROUPS');

    // Real Ban Giám hiệu names
    const bghNames = bghGroup.personnel.map((p) => p.name);
    assert.ok(
      bghNames.some((n) => n.includes('Phạm Văn Tường')),
      'BGH must contain Hiệu trưởng Phạm Văn Tường'
    );
    assert.ok(
      bghNames.some((n) => n.includes('Trần Trọng Kiệm')),
      'BGH must contain Phó Hiệu trưởng Trần Trọng Kiệm'
    );
    assert.ok(
      bghNames.some((n) => n.includes('Lê Xuân Nguyên')),
      'BGH must contain Phó Hiệu trưởng Lê Xuân Nguyên'
    );

    // Check key functional departments exist with correct codes
    const qldt = getDepartmentByCode('P_QLDT');
    assert.ok(qldt, 'Phòng QLĐT must resolve by code P_QLDT');
    assert.ok(
      qldt.personnel.some((p) => p.name.includes('Lê Văn Thí')),
      'Phòng QLĐT must have Trưởng phòng Lê Văn Thí'
    );

    const tc = getDepartmentByCode('P_TC');
    assert.ok(tc, 'Phòng Tài chính must resolve by code P_TC');
    assert.ok(
      tc.personnel.some((p) => p.name.includes('Lê Phương Thúy Oanh')),
      'Phòng Tài chính must have Trưởng phòng Lê Phương Thúy Oanh'
    );

    const stt = getDepartmentByCode('TT_STT');
    assert.ok(stt, 'TT Số - Truyền thông must resolve by code TT_STT');
    assert.ok(
      stt.personnel.some((p) => p.name.includes('Nguyễn Ngọc Vinh')),
      'TT Số - Truyền thông must have Nguyễn Ngọc Vinh'
    );
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

  test('4. prisma/seed.ts contains zero @qcet.edu.vn emails and uses real QCET staff', () => {
    const seedPath = path.resolve(__dirname, '../prisma/seed.ts');
    const content = fs.readFileSync(seedPath, 'utf-8');

    // Zero @qcet.edu.vn
    const hasLegacyDomain = content.includes('@qcet.edu.vn');
    assert.strictEqual(
      hasLegacyDomain,
      false,
      'prisma/seed.ts must contain 0 occurrences of @qcet.edu.vn'
    );

    // Real BGH emails and names
    assert.ok(content.includes('tuongpv@cdktcnqn.edu.vn'), 'Seed must include tuongpv@cdktcnqn.edu.vn');
    assert.ok(content.includes('kiemtt@cdktcnqn.edu.vn'), 'Seed must include kiemtt@cdktcnqn.edu.vn');
    assert.ok(content.includes('nguyenlx@cdktcnqn.edu.vn'), 'Seed must include nguyenlx@cdktcnqn.edu.vn');
    assert.ok(content.includes('Phạm Văn Tường'), 'Seed must include ThS. Phạm Văn Tường');
    assert.ok(content.includes('Trần Trọng Kiệm'), 'Seed must include ThS. Trần Trọng Kiệm');
    assert.ok(content.includes('Lê Xuân Nguyên'), 'Seed must include ThS. Lê Xuân Nguyên');

    // Key unit heads
    assert.ok(content.includes('levanthi@cdktcnqn.edu.vn'), 'Seed must include levanthi@cdktcnqn.edu.vn');
    assert.ok(content.includes('Lê Văn Thí'), 'Seed must include ThS. Lê Văn Thí');
    assert.ok(content.includes('lephuongthuyoanh@cdktcnqn.edu.vn'), 'Seed must include lephuongthuyoanh@cdktcnqn.edu.vn');
    assert.ok(content.includes('Lê Phương Thúy Oanh'), 'Seed must include ThS. Lê Phương Thúy Oanh');
    assert.ok(content.includes('vinhnn@cdktcnqn.edu.vn'), 'Seed must include vinhnn@cdktcnqn.edu.vn');
    assert.ok(content.includes('Nguyễn Ngọc Vinh'), 'Seed must include KS. Nguyễn Ngọc Vinh');

    // 15 canonical unit codes in seed
    for (const code of CANONICAL_15_CODES) {
      assert.ok(content.includes(code), `Seed must include canonical unit code ${code}`);
    }
  });

  test('5. DEFAULT_DEMO_USERS in role-task-filter.ts uses real QCET identities', () => {
    assert.strictEqual(DEFAULT_DEMO_USERS.length, 3);
    const [admin, manager, staff] = DEFAULT_DEMO_USERS;

    // ADMIN: ThS. Phạm Văn Tường (BGH)
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
