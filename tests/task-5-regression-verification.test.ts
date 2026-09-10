import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  QCET_CANONICAL_UNITS,
  toCanonicalUnitCode,
  isCanonicalUnitCode,
  QCET_UNIT_CANONICAL_MAP,
  QCET_DEPARTMENT_GROUPS,
} from '../src/lib/departments';

describe('Task 5: Full Regression & QCET Alignment Verification Suite', () => {
  test('1. Departments module exports QCET_CANONICAL_UNITS, toCanonicalUnitCode, and isCanonicalUnitCode', () => {
    assert.ok(Array.isArray(QCET_CANONICAL_UNITS), 'QCET_CANONICAL_UNITS must be an array');
    assert.strictEqual(QCET_CANONICAL_UNITS.length, 17, 'Must have 17 canonical entries (16 canonical + TT_NNTH)');

    const expectedUnits = [
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
      'TT_NNTH',
    ];

    for (const u of expectedUnits) {
      assert.ok((QCET_CANONICAL_UNITS as readonly string[]).includes(u), `Must include unit ${u}`);
      assert.strictEqual(isCanonicalUnitCode(u), true, `${u} must be recognized as canonical unit`);
    }

    // Invalid unit
    assert.strictEqual(isCanonicalUnitCode('UNKNOWN_INVALID_XYZ'), false);
    assert.strictEqual(isCanonicalUnitCode(''), false);
  });

  test('2. toCanonicalUnitCode maps legacy identifiers to canonical codes', () => {
    const mappings: Record<string, string> = {
      'ban-giam-hieu': 'BGH',
      'phong-dao-tao': 'P_QLDT',
      'khoa-cntt': 'K_CNTT',
      'khoa-co-khi': 'K_CK',
      'khoa-dien': 'K_DIEN',
      'khoa-oto': 'K_CNOTO',
      'phong-cthssv': 'P_TSHTQT',
      'phong-qctb': 'P_HCQT',
      'phong-tckt': 'P_TC',
      'tt-laixe': 'TT_STT',
      'tt-tuyensinh': 'P_TSHTQT',
      'k-daicuong': 'K_DAICUONG',
      'K_VHTHPT': 'K_DAICUONG',
      'khoa-nongnghiep': 'K_KTNN',
      'dept-k-ktnn': 'K_KTNN',
    };

    for (const [legacy, expected] of Object.entries(mappings)) {
      assert.strictEqual(
        toCanonicalUnitCode(legacy),
        expected,
        `toCanonicalUnitCode("${legacy}") should resolve to "${expected}"`
      );
      assert.strictEqual(
        isCanonicalUnitCode(legacy),
        true,
        `isCanonicalUnitCode("${legacy}") should resolve to true through canonical mapping`
      );
    }
  });

  test('3. prisma/seed.ts is free of UTF-8 replacement characters and uses real QCET staff and domain', () => {
    const seedPath = path.resolve(process.cwd(), 'prisma/seed.ts');
    const content = fs.readFileSync(seedPath, 'utf8');

    // Check no Unicode replacement characters �
    assert.ok(!content.includes('�'), 'prisma/seed.ts must not contain UTF-8 replacement characters (\\uFFFD)');
    assert.ok(
      content.includes('Trung tâm Đào tạo Lái xe (Cũ)'),
      'Line 51 in prisma/seed.ts must have correct Vietnamese text "Trung tâm Đào tạo Lái xe (Cũ)"'
    );

    // Ensure 0 occurrences of old mock domain
    assert.ok(!content.includes('@qcet.edu.vn'), 'prisma/seed.ts must not contain @qcet.edu.vn');

    // Ensure official domain is used
    assert.ok(content.includes('@cdktcnqn.edu.vn'), 'prisma/seed.ts must use @cdktcnqn.edu.vn');

    // Ensure real leadership names are present
    assert.ok(content.includes('Phạm Văn Tường'), 'Seed must contain Principal Phạm Văn Tường');
    assert.ok(content.includes('Trần Trọng Kiệm'), 'Seed must contain Vice Principal Trần Trọng Kiệm');
    assert.ok(content.includes('Lê Xuân Nguyên'), 'Seed must contain Vice Principal Lê Xuân Nguyên');
  });

  test('4. Real QCET departments and leadership structures are strictly preserved', () => {
    assert.ok(QCET_DEPARTMENT_GROUPS.length >= 16, 'QCET_DEPARTMENT_GROUPS must have at least 16 canonical groups');

    for (const group of QCET_DEPARTMENT_GROUPS) {
      assert.ok(group.id, `Group must have id: ${group.name}`);
      assert.ok(group.code, `Group must have code: ${group.name}`);
      assert.ok(Array.isArray(group.personnel), `Group must have personnel array: ${group.name}`);
      assert.ok(group.personnel.length > 0, `Group must have personnel: ${group.name}`);

      for (const p of group.personnel) {
        assert.ok(p.name, `Personnel must have name in ${group.name}`);
        assert.ok(p.role, `Personnel must have role in ${group.name}`);
        assert.ok(
          p.email && p.email.endsWith('@cdktcnqn.edu.vn'),
          `Personnel ${p.name} in ${group.name} must have @cdktcnqn.edu.vn email, got: ${p.email}`
        );
      }
    }
  });

  test('5. Zero mockup demo switchers exist in login or navigation headers', () => {
    const loginPagePath = path.resolve(process.cwd(), 'src/app/login/page.tsx');
    const loginContent = fs.readFileSync(loginPagePath, 'utf8');
    assert.ok(
      !loginContent.includes('RoleSwitcherPill'),
      'Login page must not import or render RoleSwitcherPill'
    );
    assert.ok(
      !loginContent.includes('mockAccounts'),
      'Login page must not contain mockAccounts'
    );

    const execHeaderPath = path.resolve(process.cwd(), 'src/components/layout/executive-header.tsx');
    if (fs.existsSync(execHeaderPath)) {
      const execContent = fs.readFileSync(execHeaderPath, 'utf8');
      assert.ok(
        !execContent.includes('RoleSwitcherPill'),
        'executive-header.tsx must not import or render RoleSwitcherPill'
      );
      assert.ok(
        !execContent.includes('RoleViewpointBanner'),
        'executive-header.tsx must not render RoleViewpointBanner'
      );
    }
  });
});
