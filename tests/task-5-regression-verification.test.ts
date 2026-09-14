import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
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
});
