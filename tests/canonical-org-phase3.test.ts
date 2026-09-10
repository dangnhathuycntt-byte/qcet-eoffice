import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CANONICAL_SCHOOL_ROOT,
  CANONICAL_16_UNITS,
  CANONICAL_FUNCTIONAL_DEPARTMENTS,
  CANONICAL_CENTERS,
  CANONICAL_FACULTIES,
  CANONICAL_RESPONSIBILITY_AREAS,
  seedCanonicalOrg,
} from '../prisma/seeds/canonical-org-seed';
import { UnitType, ResponsibilityCategory } from '@prisma/client';

describe('Phase 3: Organization & Institutional Schema Verification', () => {
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  test('prisma/schema.prisma contains all 10 Phase 3 domain models', () => {
    const requiredModels = [
      'model OrganizationalUnit',
      'model UnitClosurePath',
      'model OrganizationalBody',
      'model BodyMembership',
      'model PositionDefinition',
      'model PositionAssignment',
      'model ResponsibilityArea',
      'model PortfolioAssignment',
      'model DelegationGrant',
      'model DelegationScopeRule',
    ];

    for (const modelDef of requiredModels) {
      assert.ok(
        schemaContent.includes(modelDef),
        `Schema must include model definition: ${modelDef}`
      );
    }
  });

  test('prisma/schema.prisma defines all required enums for Phase 3', () => {
    const requiredEnums = [
      'enum UnitType',
      'enum UnitStatus',
      'enum OrganizationalBodyType',
      'enum BodyStatus',
      'enum BodyMemberRole',
      'enum AssignmentType',
      'enum AssignmentStatus',
      'enum ResponsibilityCategory',
      'enum DelegationStatus',
    ];

    for (const enumDef of requiredEnums) {
      assert.ok(
        schemaContent.includes(enumDef),
        `Schema must include enum definition: ${enumDef}`
      );
    }
  });

  test('UnitType enum contains all canonical unit levels', () => {
    const unitTypeSection = schemaContent.match(/enum UnitType\s*\{([^}]+)\}/);
    assert.ok(unitTypeSection, 'enum UnitType must be present');
    const values = unitTypeSection[1].split(/\s+/).filter(Boolean);
    const expected = ['SCHOOL', 'FACULTY', 'DEPARTMENT', 'CENTER', 'SECTION', 'OTHER'];
    for (const exp of expected) {
      assert.ok(values.includes(exp), `UnitType must contain ${exp}`);
    }
  });

  test('PositionDefinition matches JobCatalogGroup and canonical fields', () => {
    const modelSection = schemaContent.match(/model PositionDefinition\s*\{([^}]+)\}/);
    assert.ok(modelSection, 'model PositionDefinition must be present');
    const fields = modelSection[1];
    assert.ok(fields.includes('group'), 'PositionDefinition must have group field');
    assert.ok(fields.includes('minLevel'), 'PositionDefinition must have minLevel field');
    assert.ok(fields.includes('isLeadership'), 'PositionDefinition must have isLeadership field');
    assert.ok(fields.includes('dacumJobCatalogId'), 'PositionDefinition must have dacumJobCatalogId field');
  });

  test('PositionAssignment defines required relations and status fields', () => {
    const modelSection = schemaContent.match(/model PositionAssignment\s*\{([^}]+)\}/);
    assert.ok(modelSection, 'model PositionAssignment must be present');
    const fields = modelSection[1];
    assert.ok(fields.includes('user'), 'PositionAssignment must link to user');
    assert.ok(fields.includes('positionDefinition'), 'PositionAssignment must link to positionDefinition');
    assert.ok(fields.includes('unit'), 'PositionAssignment must link to unit');
    assert.ok(fields.includes('sourceDecisionNumber'), 'PositionAssignment must have sourceDecisionNumber');
    assert.ok(fields.includes('AssignmentStatus'), 'PositionAssignment must use AssignmentStatus');
    assert.ok(fields.includes('AssignmentType'), 'PositionAssignment must use AssignmentType');
  });

  test('User and JobCatalogItem models maintain additive backward-compatible relations', () => {
    const userSection = schemaContent.match(/model User\s*\{([^}]+)\}/);
    assert.ok(userSection, 'model User must be present');
    assert.ok(
      userSection[1].includes('positionAssignments'),
      'User must have positionAssignments relation'
    );
    assert.ok(
      userSection[1].includes('bodyMemberships'),
      'User must have bodyMemberships relation'
    );

    const catalogSection = schemaContent.match(/model JobCatalogItem\s*\{([^}]+)\}/);
    assert.ok(catalogSection, 'model JobCatalogItem must be present');
    assert.ok(
      catalogSection[1].includes('positionDefinitions'),
      'JobCatalogItem must have positionDefinitions relation'
    );
  });
});

describe('Phase 3: Canonical QCET Organization Seed (QĐ 282 & QĐ 420)', () => {
  test('Canonical seed specifies School Root and exactly 16 constituent units', () => {
    assert.equal(CANONICAL_SCHOOL_ROOT.code, 'QCET');
    assert.equal(CANONICAL_SCHOOL_ROOT.type, UnitType.SCHOOL);

    assert.equal(CANONICAL_16_UNITS.length, 16, 'Must have exactly 16 constituent units per QĐ 282');
    assert.equal(CANONICAL_FUNCTIONAL_DEPARTMENTS.length, 5, 'Must have 05 functional departments');
    assert.equal(CANONICAL_CENTERS.length, 2, 'Must have 02 centers');
    assert.equal(CANONICAL_FACULTIES.length, 9, 'Must have 09 training faculties');
  });

  test('05 Phòng chức năng match QĐ 282 specification', () => {
    const codes = CANONICAL_FUNCTIONAL_DEPARTMENTS.map((d) => d.code);
    assert.deepEqual(codes, ['P_QLDT', 'P_CTHSSV', 'P_TCHC_QT', 'P_TCKT', 'P_KT_DBCL']);
    for (const dept of CANONICAL_FUNCTIONAL_DEPARTMENTS) {
      assert.equal(dept.type, UnitType.DEPARTMENT);
      assert.ok(dept.name.startsWith('Phòng'));
    }
  });

  test('02 Trung tâm match QĐ 282 specification', () => {
    const codes = CANONICAL_CENTERS.map((c) => c.code);
    assert.deepEqual(codes, ['TT_NN_TH', 'TT_TS_HTVL']);
    for (const center of CANONICAL_CENTERS) {
      assert.equal(center.type, UnitType.CENTER);
      assert.ok(center.name.startsWith('Trung tâm'));
    }
  });

  test('09 Khoa đào tạo match QĐ 282 specification', () => {
    const codes = CANONICAL_FACULTIES.map((f) => f.code);
    assert.deepEqual(codes, [
      'K_CNTT',
      'K_DIEN_DTV',
      'K_CK',
      'K_KT',
      'K_DL',
      'K_XD',
      'K_KHCB',
      'K_MAY_TT',
      'K_NL_TS',
    ]);
    for (const faculty of CANONICAL_FACULTIES) {
      assert.equal(faculty.type, UnitType.FACULTY);
      assert.ok(faculty.name.startsWith('Khoa'));
    }
  });

  test('All unit codes are globally unique', () => {
    const allCodes = [CANONICAL_SCHOOL_ROOT.code, ...CANONICAL_16_UNITS.map((u) => u.code)];
    const uniqueCodes = new Set(allCodes);
    assert.equal(uniqueCodes.size, allCodes.length, 'All unit codes must be unique');
  });

  test('Standard ResponsibilityArea records match QĐ 420 specification', () => {
    assert.equal(CANONICAL_RESPONSIBILITY_AREAS.length, 11, 'Must have 11 canonical responsibility areas');

    const expectedCodes = [
      'FINANCE',
      'HR',
      'QUALITY_ASSURANCE',
      'TRAINING',
      'STUDENT_AFFAIRS',
      'DIGITAL_TRANSFORMATION',
      'ADMINISTRATION',
      'FACILITIES',
      'ADMISSIONS',
      'INTERNATIONAL_RELATIONS',
      'RESEARCH',
    ];

    const actualCodes = CANONICAL_RESPONSIBILITY_AREAS.map((a) => a.code);
    assert.deepEqual(actualCodes, expectedCodes);

    // Categories test
    const financeArea = CANONICAL_RESPONSIBILITY_AREAS.find((a) => a.code === 'FINANCE');
    assert.equal(financeArea?.category, ResponsibilityCategory.EXECUTIVE);

    const trainingArea = CANONICAL_RESPONSIBILITY_AREAS.find((a) => a.code === 'TRAINING');
    assert.equal(trainingArea?.category, ResponsibilityCategory.ACADEMIC);

    const itArea = CANONICAL_RESPONSIBILITY_AREAS.find((a) => a.code === 'DIGITAL_TRANSFORMATION');
    assert.equal(itArea?.category, ResponsibilityCategory.OPERATIONAL);
  });

  test('seedCanonicalOrg executes upserts and generates unit closure paths', async () => {
    const mockOrgUnits = new Map<string, any>();
    const mockClosurePaths = new Map<string, any>();
    const mockRespAreas = new Map<string, any>();

    const mockPrisma: any = {
      organizationalUnit: {
        upsert: async ({ where, create, update }: any) => {
          const id = `id_${where.code}`;
          const record = { id, ...(create || update), code: where.code };
          mockOrgUnits.set(where.code, record);
          return record;
        },
      },
      unitClosurePath: {
        upsert: async ({ where, create, update }: any) => {
          const key = `${where.ancestorId_descendantId.ancestorId}_${where.ancestorId_descendantId.descendantId}`;
          const record = { ...(create || update), ...where.ancestorId_descendantId };
          mockClosurePaths.set(key, record);
          return record;
        },
      },
      responsibilityArea: {
        upsert: async ({ where, create, update }: any) => {
          const id = `id_area_${where.code}`;
          const record = { id, ...(create || update), code: where.code };
          mockRespAreas.set(where.code, record);
          return record;
        },
      },
    };

    const result = await seedCanonicalOrg(mockPrisma);

    assert.equal(result.unitsCount, 16);
    assert.equal(result.responsibilityAreasCount, 11);
    assert.equal(mockOrgUnits.size, 17); // 1 School + 16 Units
    assert.equal(mockRespAreas.size, 11);

    // Root closure path: 1 self-path
    // Each of the 16 units: 1 self-path (depth 0) + 1 parent path from school (depth 1)
    // Total closure paths = 1 + (16 * 2) = 33
    assert.equal(mockClosurePaths.size, 33, 'Must create 33 closure paths for school and 16 units');
  });
});
