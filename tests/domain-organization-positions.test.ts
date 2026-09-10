import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import {
  UnitType,
  UnitStatus,
  JobCatalogGroup,
  AssignmentType,
  AssignmentStatus,
  ResponsibilityCategory,
  DelegationStatus,
  UserRole,
} from '@prisma/client';
import {
  CANONICAL_SCHOOL_ROOT,
  CANONICAL_16_UNITS,
  CANONICAL_FUNCTIONAL_DEPARTMENTS,
  CANONICAL_CENTERS,
  CANONICAL_FACULTIES,
  CANONICAL_RESPONSIBILITY_AREAS,
  seedCanonicalOrg,
} from '../prisma/seeds/canonical-org-seed';
import { getSystemReferenceDate } from '../src/lib/academic-calendar';

describe('Domain Models: Organization & Position Verification Suite', () => {
  const TEST_PREFIX = 'QA_ORG_TEST_';
  const SYSTEM_REF_DATE = new Date(`${getSystemReferenceDate()}T23:59:59.999Z`);

  let testUserId: string;
  let testPosDefId: string;
  let testConcurrentPosDefId: string;
  let schoolRootId: string;
  let facultyCnttId: string;

  before(async () => {
    // 1. Ensure canonical seed is present in database
    await seedCanonicalOrg(prisma);

    // 2. Fetch School Root & Faculty CNTT IDs for test relations
    const root = await prisma.organizationalUnit.findUnique({
      where: { code: CANONICAL_SCHOOL_ROOT.code },
    });
    assert.ok(root, 'School root must exist after seed');
    schoolRootId = root.id;

    const cntt = await prisma.organizationalUnit.findUnique({
      where: { code: 'K_CNTT' },
    });
    assert.ok(cntt, 'Faculty CNTT must exist after seed');
    facultyCnttId = cntt.id;

    // 3. Clean up any previous test artifacts
    await cleanupTestData();

    // 4. Create base test user
    const testUser = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX.toLowerCase()}leader@qcet.edu.vn`,
        name: 'TS. Nguyễn Văn QA - Cán bộ Kiểm thử',
        role: UserRole.TRUONG_PHONG,
        departmentId: 'K_CNTT',
      },
    });
    testUserId = testUser.id;

    // 5. Create test PositionDefinitions
    const posDef = await prisma.positionDefinition.create({
      data: {
        code: `${TEST_PREFIX}POS_LEADER`,
        title: 'Trưởng bộ môn / Giảng viên chính',
        group: JobCatalogGroup.LDPU,
        minLevel: 2,
        isLeadership: true,
      },
    });
    testPosDefId = posDef.id;

    const concurrentPosDef = await prisma.positionDefinition.create({
      data: {
        code: `${TEST_PREFIX}POS_RESEARCHER`,
        title: 'Nghiên cứu viên kiêm nhiệm',
        group: JobCatalogGroup.VCMN,
        minLevel: 1,
        isLeadership: false,
      },
    });
    testConcurrentPosDefId = concurrentPosDef.id;
  });

  after(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  async function cleanupTestData() {
    // Delete test assignments, definitions, units, and users created with TEST_PREFIX
    await prisma.portfolioAssignment.deleteMany({
      where: {
        positionAssignment: {
          user: {
            email: { startsWith: TEST_PREFIX.toLowerCase() },
          },
        },
      },
    });

    await prisma.positionAssignment.deleteMany({
      where: {
        OR: [
          { user: { email: { startsWith: TEST_PREFIX.toLowerCase() } } },
          { positionDefinition: { code: { startsWith: TEST_PREFIX } } },
        ],
      },
    });

    await prisma.positionDefinition.deleteMany({
      where: { code: { startsWith: TEST_PREFIX } },
    });

    // Clean up any test closure paths for test units
    const testUnits = await prisma.organizationalUnit.findMany({
      where: { code: { startsWith: TEST_PREFIX } },
      select: { id: true },
    });
    const testUnitIds = testUnits.map((u) => u.id);

    if (testUnitIds.length > 0) {
      await prisma.unitClosurePath.deleteMany({
        where: {
          OR: [
            { ancestorId: { in: testUnitIds } },
            { descendantId: { in: testUnitIds } },
          ],
        },
      });

      await prisma.organizationalUnit.deleteMany({
        where: { id: { in: testUnitIds } },
      });
    }

    await prisma.user.deleteMany({
      where: { email: { startsWith: TEST_PREFIX.toLowerCase() } },
    });
  }

  // =========================================================================
  // SUITE 1: Schema Validity, Model Integrity & Relational Constraints
  // =========================================================================
  describe('1. Schema Validity, Model Integrity & Relational Constraints', () => {
    test('1.1 Prisma Client exposes all core organization & position models and enums', () => {
      // Model delegates
      assert.ok(prisma.organizationalUnit, 'prisma.organizationalUnit must be defined');
      assert.ok(prisma.unitClosurePath, 'prisma.unitClosurePath must be defined');
      assert.ok(prisma.positionDefinition, 'prisma.positionDefinition must be defined');
      assert.ok(prisma.positionAssignment, 'prisma.positionAssignment must be defined');
      assert.ok(prisma.responsibilityArea, 'prisma.responsibilityArea must be defined');
      assert.ok(prisma.portfolioAssignment, 'prisma.portfolioAssignment must be defined');
      assert.ok(prisma.organizationalBody, 'prisma.organizationalBody must be defined');
      assert.ok(prisma.bodyMembership, 'prisma.bodyMembership must be defined');
      assert.ok(prisma.delegationGrant, 'prisma.delegationGrant must be defined');

      // Enums
      assert.deepEqual(
        Object.values(UnitType).sort(),
        ['CENTER', 'DEPARTMENT', 'FACULTY', 'OTHER', 'SCHOOL', 'SECTION'].sort()
      );
      assert.deepEqual(
        Object.values(UnitStatus).sort(),
        ['ACTIVE', 'DISSOLVED', 'MERGED', 'REORGANIZING', 'SUSPENDED'].sort()
      );
      assert.deepEqual(
        Object.values(JobCatalogGroup).sort(),
        ['HTPV', 'LDPU', 'VCDC', 'VCMN'].sort()
      );
      assert.deepEqual(
        Object.values(AssignmentType).sort(),
        ['ACTING', 'CONCURRENT', 'PRIMARY'].sort()
      );
      assert.deepEqual(
        Object.values(AssignmentStatus).sort(),
        ['ACTIVE', 'ON_LEAVE', 'SUPERSEDED', 'TERMINATED'].sort()
      );
      assert.deepEqual(
        Object.values(ResponsibilityCategory).sort(),
        ['ACADEMIC', 'EXECUTIVE', 'OPERATIONAL'].sort()
      );
      assert.deepEqual(
        Object.values(DelegationStatus).sort(),
        ['ACTIVE', 'EXPIRED', 'PENDING', 'REVOKED'].sort()
      );
    });

    test('1.2 Creates and queries PositionAssignment with full relational graph', async () => {
      const respArea = await prisma.responsibilityArea.findUnique({
        where: { code: 'TRAINING' },
      });
      assert.ok(respArea, 'ResponsibilityArea TRAINING must exist');

      // Create PositionAssignment linking User + PositionDefinition + Unit
      const assignment = await prisma.positionAssignment.create({
        data: {
          userId: testUserId,
          positionDefinitionId: testPosDefId,
          unitId: facultyCnttId,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          sourceDecisionNumber: 'QD-TEST-001/QCET',
          portfolios: {
            create: {
              responsibilityAreaId: respArea.id,
              effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
              sourceDecisionNumber: 'QD-TEST-001/QCET-PORTFOLIO',
            },
          },
        },
        include: {
          user: true,
          positionDefinition: true,
          unit: true,
          portfolios: {
            include: {
              responsibilityArea: true,
            },
          },
        },
      });

      assert.ok(assignment.id, 'Assignment ID must be generated');
      assert.equal(assignment.userId, testUserId);
      assert.equal(assignment.user.name, 'TS. Nguyễn Văn QA - Cán bộ Kiểm thử');
      assert.equal(assignment.positionDefinition.code, `${TEST_PREFIX}POS_LEADER`);
      assert.equal(assignment.positionDefinition.isLeadership, true);
      assert.equal(assignment.unit.code, 'K_CNTT');
      assert.equal(assignment.portfolios.length, 1);
      assert.equal(assignment.portfolios[0].responsibilityArea.code, 'TRAINING');
      assert.equal(
        assignment.portfolios[0].responsibilityArea.category,
        ResponsibilityCategory.ACADEMIC
      );

      // Clean up assignment
      await prisma.portfolioAssignment.deleteMany({
        where: { positionAssignmentId: assignment.id },
      });
      await prisma.positionAssignment.delete({ where: { id: assignment.id } });
    });

    test('1.3 Enforces Restrict constraint on PositionDefinition deletion when assignments exist', async () => {
      const assignment = await prisma.positionAssignment.create({
        data: {
          userId: testUserId,
          positionDefinitionId: testPosDefId,
          unitId: facultyCnttId,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
        },
      });

      // Attempting to delete positionDefinition should throw foreign key constraint violation
      await assert.rejects(
        async () => {
          await prisma.positionDefinition.delete({
            where: { id: testPosDefId },
          });
        },
        (err: any) => {
          assert.ok(
            err.message.includes('Foreign key constraint failed') ||
            err.code === 'P2003',
            `Expected P2003 foreign key violation, got: ${err.message}`
          );
          return true;
        }
      );

      // Teardown assignment
      await prisma.positionAssignment.delete({ where: { id: assignment.id } });
    });

    test('1.4 Enforces Restrict constraint on OrganizationalUnit deletion when assignments exist', async () => {
      const assignment = await prisma.positionAssignment.create({
        data: {
          userId: testUserId,
          positionDefinitionId: testPosDefId,
          unitId: facultyCnttId,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
        },
      });

      // Attempting to delete unit should fail with foreign key violation
      await assert.rejects(
        async () => {
          await prisma.organizationalUnit.delete({
            where: { id: facultyCnttId },
          });
        },
        (err: any) => {
          assert.ok(
            err.message.includes('Foreign key constraint failed') ||
            err.code === 'P2003',
            `Expected P2003 foreign key violation on unit deletion, got: ${err.message}`
          );
          return true;
        }
      );

      await prisma.positionAssignment.delete({ where: { id: assignment.id } });
    });

    test('1.5 Enforces Unique constraint on PortfolioAssignment [positionAssignmentId, responsibilityAreaId]', async () => {
      const respArea = await prisma.responsibilityArea.findUnique({
        where: { code: 'DIGITAL_TRANSFORMATION' },
      });
      assert.ok(respArea);

      const assignment = await prisma.positionAssignment.create({
        data: {
          userId: testUserId,
          positionDefinitionId: testPosDefId,
          unitId: facultyCnttId,
        },
      });

      // First portfolio creation succeeds
      await prisma.portfolioAssignment.create({
        data: {
          positionAssignmentId: assignment.id,
          responsibilityAreaId: respArea.id,
        },
      });

      // Duplicate portfolio creation with same assignment + responsibility area must fail
      await assert.rejects(
        async () => {
          await prisma.portfolioAssignment.create({
            data: {
              positionAssignmentId: assignment.id,
              responsibilityAreaId: respArea.id,
            },
          });
        },
        (err: any) => {
          assert.ok(
            err.code === 'P2002' ||
            err.message.includes('Unique constraint failed'),
            `Expected P2002 unique constraint violation, got: ${err.message}`
          );
          return true;
        }
      );

      // Cascade check: Deleting assignment cascades to delete its portfolio assignments
      await prisma.positionAssignment.delete({ where: { id: assignment.id } });
      const orphanPortfolios = await prisma.portfolioAssignment.findMany({
        where: { positionAssignmentId: assignment.id },
      });
      assert.equal(orphanPortfolios.length, 0, 'PortfolioAssignment must cascade delete with PositionAssignment');
    });

    test('1.6 User deletion cascades to PositionAssignment and PortfolioAssignment', async () => {
      const tempUser = await prisma.user.create({
        data: {
          email: `${TEST_PREFIX.toLowerCase()}temp_cascade@qcet.edu.vn`,
          name: 'Cascade Test User',
          role: UserRole.CHUYEN_VIEN,
        },
      });

      const respArea = await prisma.responsibilityArea.findUnique({
        where: { code: 'HR' },
      });
      assert.ok(respArea);

      const assignment = await prisma.positionAssignment.create({
        data: {
          userId: tempUser.id,
          positionDefinitionId: testPosDefId,
          unitId: schoolRootId,
          portfolios: {
            create: {
              responsibilityAreaId: respArea.id,
            },
          },
        },
      });

      // Delete the user
      await prisma.user.delete({ where: { id: tempUser.id } });

      // Verify assignment was deleted
      const checkAssignment = await prisma.positionAssignment.findUnique({
        where: { id: assignment.id },
      });
      assert.equal(checkAssignment, null, 'PositionAssignment must be cascade-deleted when User is deleted');

      // Verify portfolio was deleted
      const checkPortfolio = await prisma.portfolioAssignment.findMany({
        where: { positionAssignmentId: assignment.id },
      });
      assert.equal(checkPortfolio.length, 0, 'PortfolioAssignment must be cascade-deleted');

      // Verify PositionDefinition and Unit still exist
      const checkPosDef = await prisma.positionDefinition.findUnique({
        where: { id: testPosDefId },
      });
      assert.ok(checkPosDef, 'PositionDefinition must NOT be deleted');
    });
  });

  // =========================================================================
  // SUITE 2: UnitClosurePath Tree Querying and Hierarchy Depth
  // =========================================================================
  describe('2. UnitClosurePath Tree Querying and Hierarchy Depth', () => {
    let testSectionUnitId: string;
    const SECTION_CODE = `${TEST_PREFIX}BM_CNPM`;

    before(async () => {
      // Create a 3rd tier unit: Bộ môn Công nghệ Phần mềm under Khoa CNTT
      const section = await prisma.organizationalUnit.create({
        data: {
          code: SECTION_CODE,
          name: 'Bộ môn Công nghệ Phần mềm',
          type: UnitType.SECTION,
          parentId: facultyCnttId,
          status: UnitStatus.ACTIVE,
          metadata: {
            level: 2,
            faculty: 'K_CNTT',
          },
        },
      });
      testSectionUnitId = section.id;

      // Seed 3-tier closure paths:
      // Depth 0: Self path
      await prisma.unitClosurePath.create({
        data: {
          ancestorId: testSectionUnitId,
          descendantId: testSectionUnitId,
          depth: 0,
        },
      });
      // Depth 1: Faculty -> Section
      await prisma.unitClosurePath.create({
        data: {
          ancestorId: facultyCnttId,
          descendantId: testSectionUnitId,
          depth: 1,
        },
      });
      // Depth 2: School Root -> Section
      await prisma.unitClosurePath.create({
        data: {
          ancestorId: schoolRootId,
          descendantId: testSectionUnitId,
          depth: 2,
        },
      });
    });

    after(async () => {
      if (testSectionUnitId) {
        await prisma.unitClosurePath.deleteMany({
          where: {
            OR: [
              { ancestorId: testSectionUnitId },
              { descendantId: testSectionUnitId },
            ],
          },
        });
        await prisma.organizationalUnit.deleteMany({
          where: { id: testSectionUnitId },
        });
      }
    });

    test('2.1 Subtree querying: finds all descendants under School Root at any depth', async () => {
      // Find all descendant units under QCET root with depth > 0
      const descendants = await prisma.unitClosurePath.findMany({
        where: {
          ancestorId: schoolRootId,
          depth: { gt: 0 },
        },
        include: {
          descendant: true,
        },
        orderBy: {
          depth: 'asc',
        },
      });

      // 16 canonical units at depth 1 + 1 test section at depth 2 = 17 descendants
      assert.equal(descendants.length, 17);

      const depth1Units = descendants.filter((d) => d.depth === 1);
      const depth2Units = descendants.filter((d) => d.depth === 2);

      assert.equal(depth1Units.length, 16, 'Must have 16 depth-1 constituent units');
      assert.equal(depth2Units.length, 1, 'Must have 1 depth-2 section unit');
      assert.equal(depth2Units[0].descendant.code, SECTION_CODE);
      assert.equal(depth2Units[0].descendant.type, UnitType.SECTION);
    });

    test('2.2 Immediate child querying: finds direct children with depth = 1', async () => {
      const directChildren = await prisma.unitClosurePath.findMany({
        where: {
          ancestorId: schoolRootId,
          depth: 1,
        },
        include: {
          descendant: true,
        },
      });

      assert.equal(directChildren.length, 16, 'Root must have exactly 16 direct children');
      const codes = directChildren.map((c) => c.descendant.code);
      assert.ok(codes.includes('K_CNTT'));
      assert.ok(codes.includes('P_QLDT'));
      assert.ok(codes.includes('TT_NN_TH'));
      assert.ok(!codes.includes(SECTION_CODE), 'Section at depth 2 must not appear as direct child of Root');
    });

    test('2.3 Ancestor chain querying: walks up tree from Section to School Root in order', async () => {
      const ancestorChain = await prisma.unitClosurePath.findMany({
        where: {
          descendantId: testSectionUnitId,
        },
        include: {
          ancestor: true,
        },
        orderBy: {
          depth: 'asc',
        },
      });

      assert.equal(ancestorChain.length, 3, 'Section must have 3 ancestor paths: self, faculty, school');

      // Depth 0: Self
      assert.equal(ancestorChain[0].depth, 0);
      assert.equal(ancestorChain[0].ancestor.code, SECTION_CODE);

      // Depth 1: Faculty K_CNTT
      assert.equal(ancestorChain[1].depth, 1);
      assert.equal(ancestorChain[1].ancestor.code, 'K_CNTT');
      assert.equal(ancestorChain[1].ancestor.type, UnitType.FACULTY);

      // Depth 2: School QCET Root
      assert.equal(ancestorChain[2].depth, 2);
      assert.equal(ancestorChain[2].ancestor.code, 'QCET');
      assert.equal(ancestorChain[2].ancestor.type, UnitType.SCHOOL);
    });

    test('2.4 Intermediate subtree querying: Faculty subtree contains only its child Section', async () => {
      const facultySubtree = await prisma.unitClosurePath.findMany({
        where: {
          ancestorId: facultyCnttId,
          depth: { gt: 0 },
        },
        include: {
          descendant: true,
        },
      });

      assert.equal(facultySubtree.length, 1);
      assert.equal(facultySubtree[0].depth, 1);
      assert.equal(facultySubtree[0].descendant.code, SECTION_CODE);
      assert.equal(facultySubtree[0].descendant.parentId, facultyCnttId);
    });

    test('2.5 Leaf unit querying: detects units that have no descendants with depth > 0', async () => {
      // Find whether Section is a leaf unit
      const sectionDescendants = await prisma.unitClosurePath.findMany({
        where: {
          ancestorId: testSectionUnitId,
          depth: { gt: 0 },
        },
      });
      assert.equal(sectionDescendants.length, 0, 'Section must have no descendants (leaf node)');

      // Verify School Root is NOT a leaf node
      const rootDescendants = await prisma.unitClosurePath.count({
        where: {
          ancestorId: schoolRootId,
          depth: { gt: 0 },
        },
      });
      assert.ok(rootDescendants > 0, 'Root must have descendants');
    });

    test('2.6 Cascade delete on OrganizationalUnit removes related UnitClosurePaths', async () => {
      const tempUnit = await prisma.organizationalUnit.create({
        data: {
          code: `${TEST_PREFIX}TEMP_UNIT_CASCADE`,
          name: 'Đơn vị tạm kiểm thử cascade',
          type: UnitType.SECTION,
          parentId: schoolRootId,
        },
      });

      await prisma.unitClosurePath.create({
        data: {
          ancestorId: tempUnit.id,
          descendantId: tempUnit.id,
          depth: 0,
        },
      });
      await prisma.unitClosurePath.create({
        data: {
          ancestorId: schoolRootId,
          descendantId: tempUnit.id,
          depth: 1,
        },
      });

      // Delete temp unit
      await prisma.organizationalUnit.delete({ where: { id: tempUnit.id } });

      // Verify closure paths are completely cleaned up by database cascade
      const remainingPaths = await prisma.unitClosurePath.findMany({
        where: {
          OR: [
            { ancestorId: tempUnit.id },
            { descendantId: tempUnit.id },
          ],
        },
      });
      assert.equal(remainingPaths.length, 0, 'UnitClosurePath must cascade delete when OrganizationalUnit is deleted');
    });
  });

  // =========================================================================
  // SUITE 3: Canonical Seed Validity (QĐ 282/QĐ-CĐKTCNQN & QĐ 420/QĐ-CĐKTCNQN)
  // =========================================================================
  describe('3. Canonical Seed Validity (16 Units QCET & 11 Responsibility Areas)', () => {
    test('3.1 Live Database contains exactly 1 Root School and 16 Constituent Units', async () => {
      const rootUnit = await prisma.organizationalUnit.findUnique({
        where: { code: 'QCET' },
      });
      assert.ok(rootUnit, 'Root unit QCET must exist in database');
      assert.equal(rootUnit.type, UnitType.SCHOOL);
      assert.equal(rootUnit.status, UnitStatus.ACTIVE);
      assert.equal(rootUnit.parentId, null);

      const constituentUnits = await prisma.organizationalUnit.findMany({
        where: { parentId: rootUnit.id },
        orderBy: { code: 'asc' },
      });
      assert.equal(
        constituentUnits.length,
        16,
        'Live database must contain exactly 16 constituent units under QCET root'
      );
    });

    test('3.2 05 Functional Departments conform to QĐ 282 specification', async () => {
      const expectedCodes = ['P_QLDT', 'P_CTHSSV', 'P_TCHC_QT', 'P_TCKT', 'P_KT_DBCL'];
      const depts = await prisma.organizationalUnit.findMany({
        where: {
          code: { in: expectedCodes },
          type: UnitType.DEPARTMENT,
        },
      });

      assert.equal(depts.length, 5, 'Must find all 5 functional departments');
      for (const dept of depts) {
        assert.equal(dept.type, UnitType.DEPARTMENT);
        assert.equal(dept.status, UnitStatus.ACTIVE);
        assert.ok(dept.name.startsWith('Phòng '));
        const meta = dept.metadata as Record<string, any>;
        assert.ok(meta, 'Department metadata must exist');
        assert.equal(meta.legalDocumentRef, '282/QĐ-CĐKTCNQN');
        assert.equal(meta.level, 1);
        assert.ok(typeof meta.displayOrder === 'number');
      }
    });

    test('3.3 02 Centers conform to QĐ 282 specification', async () => {
      const expectedCodes = ['TT_NN_TH', 'TT_TS_HTVL'];
      const centers = await prisma.organizationalUnit.findMany({
        where: {
          code: { in: expectedCodes },
          type: UnitType.CENTER,
        },
      });

      assert.equal(centers.length, 2, 'Must find all 2 centers');
      for (const center of centers) {
        assert.equal(center.type, UnitType.CENTER);
        assert.equal(center.status, UnitStatus.ACTIVE);
        assert.ok(center.name.startsWith('Trung tâm '));
        const meta = center.metadata as Record<string, any>;
        assert.ok(meta, 'Center metadata must exist');
        assert.equal(meta.legalDocumentRef, '282/QĐ-CĐKTCNQN');
        assert.equal(meta.level, 1);
      }
    });

    test('3.4 09 Faculties conform to QĐ 282 specification', async () => {
      const expectedCodes = [
        'K_CNTT',
        'K_DIEN_DTV',
        'K_CK',
        'K_KT',
        'K_DL',
        'K_XD',
        'K_KHCB',
        'K_MAY_TT',
        'K_NL_TS',
      ];
      const faculties = await prisma.organizationalUnit.findMany({
        where: {
          code: { in: expectedCodes },
          type: UnitType.FACULTY,
        },
      });

      assert.equal(faculties.length, 9, 'Must find all 9 faculties');
      for (const faculty of faculties) {
        assert.equal(faculty.type, UnitType.FACULTY);
        assert.equal(faculty.status, UnitStatus.ACTIVE);
        assert.ok(faculty.name.startsWith('Khoa '));
        const meta = faculty.metadata as Record<string, any>;
        assert.ok(meta, 'Faculty metadata must exist');
        assert.equal(meta.legalDocumentRef, '282/QĐ-CĐKTCNQN');
        assert.equal(meta.level, 1);
      }
    });

    test('3.5 11 Canonical Responsibility Areas exist and match QĐ 420 categorisation', async () => {
      const areas = await prisma.responsibilityArea.findMany({
        orderBy: { code: 'asc' },
      });

      assert.equal(areas.length, 11, 'Must have exactly 11 canonical responsibility areas');

      const expectedMap: Record<string, ResponsibilityCategory> = {
        FINANCE: ResponsibilityCategory.EXECUTIVE,
        HR: ResponsibilityCategory.EXECUTIVE,
        QUALITY_ASSURANCE: ResponsibilityCategory.ACADEMIC,
        TRAINING: ResponsibilityCategory.ACADEMIC,
        RESEARCH: ResponsibilityCategory.ACADEMIC,
        STUDENT_AFFAIRS: ResponsibilityCategory.OPERATIONAL,
        DIGITAL_TRANSFORMATION: ResponsibilityCategory.OPERATIONAL,
        ADMINISTRATION: ResponsibilityCategory.OPERATIONAL,
        FACILITIES: ResponsibilityCategory.OPERATIONAL,
        ADMISSIONS: ResponsibilityCategory.OPERATIONAL,
        INTERNATIONAL_RELATIONS: ResponsibilityCategory.OPERATIONAL,
      };

      for (const area of areas) {
        assert.ok(expectedMap[area.code], `Unknown responsibility area code: ${area.code}`);
        assert.equal(
          area.category,
          expectedMap[area.code],
          `Category mismatch for ${area.code}: expected ${expectedMap[area.code]}, got ${area.category}`
        );
        assert.ok(area.description?.includes('QĐ 420/QĐ-CĐKTCNQN'), 'Description must cite legal authority QĐ 420');
      }

      // Group counts: 2 Executive, 3 Academic, 6 Operational
      const executiveCount = areas.filter((a) => a.category === ResponsibilityCategory.EXECUTIVE).length;
      const academicCount = areas.filter((a) => a.category === ResponsibilityCategory.ACADEMIC).length;
      const operationalCount = areas.filter((a) => a.category === ResponsibilityCategory.OPERATIONAL).length;

      assert.equal(executiveCount, 2, 'Must have 2 Executive areas (FINANCE, HR)');
      assert.equal(academicCount, 3, 'Must have 3 Academic areas (QUALITY_ASSURANCE, TRAINING, RESEARCH)');
      assert.equal(operationalCount, 6, 'Must have 6 Operational areas');
    });

    test('3.6 Canonical UnitClosurePaths total exactly 33 paths in seed', async () => {
      const root = await prisma.organizationalUnit.findUnique({
        where: { code: 'QCET' },
      });
      assert.ok(root);

      const canonicalCodes = [CANONICAL_SCHOOL_ROOT.code, ...CANONICAL_16_UNITS.map((u) => u.code)];
      const canonicalUnits = await prisma.organizationalUnit.findMany({
        where: { code: { in: canonicalCodes } },
        select: { id: true },
      });
      const canonicalIds = canonicalUnits.map((u) => u.id);

      const canonicalPaths = await prisma.unitClosurePath.findMany({
        where: {
          ancestorId: { in: canonicalIds },
          descendantId: { in: canonicalIds },
        },
      });

      // 1 root self-path (depth 0)
      // 16 units self-paths (depth 0)
      // 16 units child-paths from root (depth 1)
      // Total = 1 + 16 + 16 = 33
      assert.equal(canonicalPaths.length, 33, 'Canonical seed must yield exactly 33 closure paths');

      const depth0Count = canonicalPaths.filter((p) => p.depth === 0).length;
      const depth1Count = canonicalPaths.filter((p) => p.depth === 1).length;

      assert.equal(depth0Count, 17, '17 self-paths (1 School + 16 Units)');
      assert.equal(depth1Count, 16, '16 direct child paths from School Root');
    });
  });

  // =========================================================================
  // SUITE 4: Temporal Validity Checks (effectiveFrom, effectiveTo, status)
  // =========================================================================
  describe('4. Temporal Validity Checks (effectiveFrom, effectiveTo, status)', () => {
    test('4.1 OrganizationalUnit status & temporal validity filters active vs historical units', async () => {
      // Historical unit (dissolved in past)
      const historicalUnit = await prisma.organizationalUnit.create({
        data: {
          code: `${TEST_PREFIX}UNIT_HISTORICAL`,
          name: 'Phòng Thí nghiệm liên trường cũ',
          type: UnitType.SECTION,
          parentId: schoolRootId,
          status: UnitStatus.DISSOLVED,
          effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
          effectiveTo: new Date('2024-12-31T23:59:59.000Z'),
        },
      });

      // Future unit (planned for next academic year)
      const futureUnit = await prisma.organizationalUnit.create({
        data: {
          code: `${TEST_PREFIX}UNIT_FUTURE`,
          name: 'Viện Nghiên cứu Đổi mới Sáng tạo Mới',
          type: UnitType.CENTER,
          parentId: schoolRootId,
          status: UnitStatus.ACTIVE,
          effectiveFrom: new Date('2027-01-01T00:00:00.000Z'),
          effectiveTo: null,
        },
      });

      // Query active units at current system reference date (2026-09-09)
      const activeUnitsAtRef = await prisma.organizationalUnit.findMany({
        where: {
          code: { in: [historicalUnit.code, futureUnit.code, 'K_CNTT'] },
          status: UnitStatus.ACTIVE,
          effectiveFrom: { lte: SYSTEM_REF_DATE },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: SYSTEM_REF_DATE } },
          ],
        },
      });

      const activeCodes = activeUnitsAtRef.map((u) => u.code);
      assert.ok(activeCodes.includes('K_CNTT'), 'K_CNTT must be active at reference date');
      assert.ok(!activeCodes.includes(historicalUnit.code), 'Historical dissolved unit must not be active');
      assert.ok(!activeCodes.includes(futureUnit.code), 'Future unit must not be active before effectiveFrom');

      // Query historical evaluation at 2022-06-01: historicalUnit was active then
      const eval2022 = new Date('2022-06-01T00:00:00.000Z');
      const activeIn2022 = await prisma.organizationalUnit.findMany({
        where: {
          code: { in: [historicalUnit.code, futureUnit.code] },
          effectiveFrom: { lte: eval2022 },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: eval2022 } },
          ],
        },
      });
      assert.equal(activeIn2022.length, 1);
      assert.equal(activeIn2022[0].code, historicalUnit.code);

      // Clean up
      await prisma.organizationalUnit.deleteMany({
        where: { id: { in: [historicalUnit.id, futureUnit.id] } },
      });
    });

    test('4.2 PositionAssignment sequential career progression & temporal superseded transition', async () => {
      // Model career progression for a teacher:
      // Period 1: Giảng viên (2024-01-01 -> 2025-08-31), SUPERSEDED
      const assignment1 = await prisma.positionAssignment.create({
        data: {
          userId: testUserId,
          positionDefinitionId: testPosDefId,
          unitId: facultyCnttId,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.SUPERSEDED,
          effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
          effectiveTo: new Date('2025-08-31T23:59:59.000Z'),
          sourceDecisionNumber: 'QD-2024-01-BO-NHIEM',
        },
      });

      // Period 2: Phó Trưởng khoa (2025-09-01 -> 2026-08-31), SUPERSEDED
      const assignment2 = await prisma.positionAssignment.create({
        data: {
          userId: testUserId,
          positionDefinitionId: testPosDefId,
          unitId: facultyCnttId,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.SUPERSEDED,
          effectiveFrom: new Date('2025-09-01T00:00:00.000Z'),
          effectiveTo: new Date('2026-08-31T23:59:59.000Z'),
          sourceDecisionNumber: 'QD-2025-09-PHO-KHOA',
        },
      });

      // Period 3: Trưởng khoa (2026-09-01 -> Present), ACTIVE
      const assignment3 = await prisma.positionAssignment.create({
        data: {
          userId: testUserId,
          positionDefinitionId: testPosDefId,
          unitId: facultyCnttId,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
          effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
          effectiveTo: null,
          sourceDecisionNumber: 'QD-2026-09-TRUONG-KHOA',
        },
      });

      // Helper function to resolve active assignment at any point in time
      async function getActiveAssignmentAt(userId: string, date: Date) {
        return prisma.positionAssignment.findFirst({
          where: {
            userId,
            type: AssignmentType.PRIMARY,
            effectiveFrom: { lte: date },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: date } },
            ],
          },
          orderBy: { effectiveFrom: 'desc' },
        });
      }

      // 1. Evaluate at 2024-06-15: Must return Period 1 (Giảng viên)
      const res2024 = await getActiveAssignmentAt(testUserId, new Date('2024-06-15T00:00:00.000Z'));
      assert.ok(res2024);
      assert.equal(res2024.id, assignment1.id);
      assert.equal(res2024.sourceDecisionNumber, 'QD-2024-01-BO-NHIEM');

      // 2. Evaluate at 2026-02-01: Must return Period 2 (Phó Trưởng khoa)
      const res2026Early = await getActiveAssignmentAt(testUserId, new Date('2026-02-01T00:00:00.000Z'));
      assert.ok(res2026Early);
      assert.equal(res2026Early.id, assignment2.id);
      assert.equal(res2026Early.sourceDecisionNumber, 'QD-2025-09-PHO-KHOA');

      // 3. Evaluate at System Reference Date (2026-09-09): Must return Period 3 (Trưởng khoa)
      const resCurrent = await getActiveAssignmentAt(testUserId, SYSTEM_REF_DATE);
      assert.ok(resCurrent);
      assert.equal(resCurrent.id, assignment3.id);
      assert.equal(resCurrent.status, AssignmentStatus.ACTIVE);
      assert.equal(resCurrent.effectiveTo, null);
      assert.equal(resCurrent.sourceDecisionNumber, 'QD-2026-09-TRUONG-KHOA');

      // Clean up
      await prisma.positionAssignment.deleteMany({
        where: { id: { in: [assignment1.id, assignment2.id, assignment3.id] } },
      });
    });

    test('4.3 Concurrent vs Primary assignments with status boundaries', async () => {
      // Primary leadership assignment (ACTIVE)
      const primaryAssignment = await prisma.positionAssignment.create({
        data: {
          userId: testUserId,
          positionDefinitionId: testPosDefId,
          unitId: facultyCnttId,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        },
      });

      // Concurrent research assignment (ACTIVE)
      const concurrentAssignment = await prisma.positionAssignment.create({
        data: {
          userId: testUserId,
          positionDefinitionId: testConcurrentPosDefId,
          unitId: schoolRootId,
          type: AssignmentType.CONCURRENT,
          status: AssignmentStatus.ACTIVE,
          effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
        },
      });

      // On-leave / suspended assignment (ON_LEAVE)
      const onLeaveAssignment = await prisma.positionAssignment.create({
        data: {
          userId: testUserId,
          positionDefinitionId: testConcurrentPosDefId,
          unitId: facultyCnttId,
          type: AssignmentType.CONCURRENT,
          status: AssignmentStatus.ON_LEAVE,
          effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
          effectiveTo: new Date('2026-12-31T00:00:00.000Z'),
        },
      });

      // Query all ACTIVE assignments for user
      const activeAssignments = await prisma.positionAssignment.findMany({
        where: {
          userId: testUserId,
          status: AssignmentStatus.ACTIVE,
        },
      });
      assert.equal(activeAssignments.length, 2, 'User must have exactly 2 active assignments (1 primary, 1 concurrent)');

      // Primary check
      const primary = activeAssignments.find((a) => a.type === AssignmentType.PRIMARY);
      assert.ok(primary);
      assert.equal(primary.id, primaryAssignment.id);

      // Concurrent check
      const concurrent = activeAssignments.find((a) => a.type === AssignmentType.CONCURRENT);
      assert.ok(concurrent);
      assert.equal(concurrent.id, concurrentAssignment.id);

      // On-leave check
      const onLeave = await prisma.positionAssignment.findUnique({
        where: { id: onLeaveAssignment.id },
      });
      assert.equal(onLeave?.status, AssignmentStatus.ON_LEAVE);

      // Clean up
      await prisma.positionAssignment.deleteMany({
        where: {
          id: {
            in: [
              primaryAssignment.id,
              concurrentAssignment.id,
              onLeaveAssignment.id,
            ],
          },
        },
      });
    });

    test('4.4 PortfolioAssignment temporal transitions for leadership responsibility areas', async () => {
      const respTraining = await prisma.responsibilityArea.findUnique({
        where: { code: 'TRAINING' },
      });
      const respResearch = await prisma.responsibilityArea.findUnique({
        where: { code: 'RESEARCH' },
      });
      assert.ok(respTraining && respResearch);

      const assignment = await prisma.positionAssignment.create({
        data: {
          userId: testUserId,
          positionDefinitionId: testPosDefId,
          unitId: schoolRootId,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
          effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
        },
      });

      // Portfolio 1: Đào tạo & Học vụ (Managed until 2026-06-30)
      const portfolioOld = await prisma.portfolioAssignment.create({
        data: {
          positionAssignmentId: assignment.id,
          responsibilityAreaId: respTraining.id,
          effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
          effectiveTo: new Date('2026-06-30T23:59:59.000Z'),
          sourceDecisionNumber: 'QD-2025-PORTFOLIO-TRAINING',
        },
      });

      // Portfolio 2: Nghiên cứu khoa học (Managed starting 2026-07-01 onwards)
      const portfolioCurrent = await prisma.portfolioAssignment.create({
        data: {
          positionAssignmentId: assignment.id,
          responsibilityAreaId: respResearch.id,
          effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
          effectiveTo: null,
          sourceDecisionNumber: 'QD-2026-PORTFOLIO-RESEARCH',
        },
      });

      // Query active portfolios at System Reference Date (2026-09-09)
      const currentPortfolios = await prisma.portfolioAssignment.findMany({
        where: {
          positionAssignmentId: assignment.id,
          effectiveFrom: { lte: SYSTEM_REF_DATE },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: SYSTEM_REF_DATE } },
          ],
        },
        include: {
          responsibilityArea: true,
        },
      });

      assert.equal(currentPortfolios.length, 1, 'Only 1 portfolio should be active at reference date');
      assert.equal(currentPortfolios[0].responsibilityArea.code, 'RESEARCH');
      assert.equal(currentPortfolios[0].responsibilityArea.category, ResponsibilityCategory.ACADEMIC);

      // Query active portfolios on 2025-10-01 (during previous academic period)
      const date2025 = new Date('2025-10-01T00:00:00.000Z');
      const portfolios2025 = await prisma.portfolioAssignment.findMany({
        where: {
          positionAssignmentId: assignment.id,
          effectiveFrom: { lte: date2025 },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: date2025 } },
          ],
        },
        include: {
          responsibilityArea: true,
        },
      });

      assert.equal(portfolios2025.length, 1);
      assert.equal(portfolios2025[0].responsibilityArea.code, 'TRAINING');

      // Clean up
      await prisma.portfolioAssignment.deleteMany({
        where: { id: { in: [portfolioOld.id, portfolioCurrent.id] } },
      });
      await prisma.positionAssignment.delete({ where: { id: assignment.id } });
    });
  });
});
