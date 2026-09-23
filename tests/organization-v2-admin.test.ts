import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  PositionAssignmentService,
} from "../src/server/services/position-assignment-service";
import {
  ResponsibilityPortfolioService,
} from "../src/server/services/responsibility-portfolio-service";
import {
  DelegationGrantService,
} from "../src/server/services/delegation-grant-service";
import {
  UnitType,
  UnitStatus,
  AssignmentType,
  AssignmentStatus,
  DelegationStatus,
  UserRole,
  JobCatalogGroup,
} from "@prisma/client";
import { ValidationError, ConflictError, NotFoundError } from "../src/server/api/errors";

describe("Sprint 6: Organization Administration & Effective-Dated Authority (Cơ cấu tổ chức & Bổ nhiệm)", () => {
  const testRunId = `org_test_${Date.now()}`;

  // Test admin user (System Admin / Tổ chức Cán bộ)
  const adminActor = {
    id: `admin_user_${testRunId}`,
    email: `admin_${testRunId}@cdktcnqn.edu.vn`,
    name: "Admin Tổ chức Cán bộ",
    role: "ADMIN",
    userRole: UserRole.ADMIN,
    systemRole: "SYSTEM_ADMIN",
    activePositionCode: "QUAN_TRI_HE_THONG",

  };

  // Test target staff 1
  const staff1 = {
    id: `staff1_${testRunId}`,
    email: `staff1_${testRunId}@cdktcnqn.edu.vn`,
    name: "Cán bộ Giảng viên 1",
    role: "GIANG_VIEN",
    userRole: UserRole.CHUYEN_VIEN,
  };

  // Test target staff 2
  const staff2 = {
    id: `staff2_${testRunId}`,
    email: `staff2_${testRunId}@cdktcnqn.edu.vn`,
    name: "Cán bộ Quản lý 2",
    role: "TRUONG_PHONG",
    userRole: UserRole.CHUYEN_VIEN,
  };

  // Test inactive staff
  const inactiveStaff = {
    id: `inactive_${testRunId}`,
    email: `inactive_${testRunId}@cdktcnqn.edu.vn`,
    name: "Cán bộ Đã nghỉ việc",
    role: "CHUYEN_VIEN",
    userRole: UserRole.CHUYEN_VIEN,
    isActive: false,
  };

  // Test leader staff
  const leaderStaff = {
    id: `leader_${testRunId}`,
    email: `leader_${testRunId}@cdktcnqn.edu.vn`,
    name: "Phó Hiệu trưởng Phụ trách",
    role: "PHO_HIEU_TRUONG",
    userRole: UserRole.ADMIN,
  };

  let rootUnitId: string;
  let facultyUnitId: string;
  let departmentUnitId: string;

  let posPrincipalId: string;
  let posDeanId: string;
  let posLecturerId: string;

  let responsibilityAreaDaoTaoId: string;
  let responsibilityAreaTaiChinhId: string;
  let leadershipAssignmentId: string;

  before(async () => {
    // 1. Create test users
    await prisma.user.createMany({
      data: [
        {
          id: adminActor.id,
          email: adminActor.email,
          name: adminActor.name,
          role: UserRole.ADMIN,
          isActive: true,
        },
        {
          id: staff1.id,
          email: staff1.email,
          name: staff1.name,
          role: UserRole.CHUYEN_VIEN,
          isActive: true,
        },
        {
          id: staff2.id,
          email: staff2.email,
          name: staff2.name,
          role: UserRole.CHUYEN_VIEN,
          isActive: true,
        },
        {
          id: inactiveStaff.id,
          email: inactiveStaff.email,
          name: inactiveStaff.name,
          role: UserRole.CHUYEN_VIEN,
          isActive: false,
        },
        {
          id: leaderStaff.id,
          email: leaderStaff.email,
          name: leaderStaff.name,
          role: UserRole.ADMIN,
          isActive: true,
        },
      ],
    });

    // 2. Create organizational units
    const root = await prisma.organizationalUnit.create({
      data: {
        code: `ROOT_${testRunId}`,
        name: `Trường CĐ KT-CN Quy Nhơn (${testRunId})`,
        type: UnitType.SCHOOL,
        status: UnitStatus.ACTIVE,
      },
    });
    rootUnitId = root.id;

    const faculty = await prisma.organizationalUnit.create({
      data: {
        code: `K_CNTT_${testRunId}`,
        name: `Khoa Công nghệ thông tin (${testRunId})`,
        type: UnitType.FACULTY,
        status: UnitStatus.ACTIVE,
        parentId: rootUnitId,
      },
    });
    facultyUnitId = faculty.id;

    const dept = await prisma.organizationalUnit.create({
      data: {
        code: `P_DAO_TAO_${testRunId}`,
        name: `Phòng Đào tạo (${testRunId})`,
        type: UnitType.DEPARTMENT,
        status: UnitStatus.ACTIVE,
        parentId: rootUnitId,
      },
    });
    departmentUnitId = dept.id;

    // Unit Closure Paths
    await prisma.unitClosurePath.createMany({
      data: [
        { ancestorId: rootUnitId, descendantId: rootUnitId, depth: 0 },
        { ancestorId: facultyUnitId, descendantId: facultyUnitId, depth: 0 },
        { ancestorId: departmentUnitId, descendantId: departmentUnitId, depth: 0 },
        { ancestorId: rootUnitId, descendantId: facultyUnitId, depth: 1 },
        { ancestorId: rootUnitId, descendantId: departmentUnitId, depth: 1 },
      ],
    });

    // 3. Create Position Definitions
    const posPrincipal = await prisma.positionDefinition.create({
      data: {
        code: `HT_${testRunId}`,
        title: "Hiệu trưởng",
        group: JobCatalogGroup.LDPU,
        minLevel: 1,
        isLeadership: true,
      },
    });
    posPrincipalId = posPrincipal.id;

    const posDean = await prisma.positionDefinition.create({
      data: {
        code: `TK_${testRunId}`,
        title: "Trưởng khoa CNTT",
        group: JobCatalogGroup.LDPU,
        minLevel: 2,
        isLeadership: true,
      },
    });
    posDeanId = posDean.id;

    const posLecturer = await prisma.positionDefinition.create({
      data: {
        code: `GV_${testRunId}`,
        title: "Giảng viên",
        group: JobCatalogGroup.VCMN,
        minLevel: 3,
        isLeadership: false,
      },
    });
    posLecturerId = posLecturer.id;

    // 4. Create Responsibility Areas (QĐ 420)
    const areaDaoTao = await prisma.responsibilityArea.create({
      data: {
        code: `DAO_TAO_${testRunId}`,
        name: "Công tác Đào tạo & Quản lý Học sinh Sinh viên",
        category: "ACADEMIC",
        description: "Theo QĐ 420/QĐ-CĐKTCNQN",
      },
    });
    responsibilityAreaDaoTaoId = areaDaoTao.id;

    const areaTaiChinh = await prisma.responsibilityArea.create({
      data: {
        code: `TAI_CHINH_${testRunId}`,
        name: "Công tác Tài chính & Cơ sở vật chất",
        category: "OPERATIONAL",
        description: "Theo QĐ 420/QĐ-CĐKTCNQN",
      },
    });
    responsibilityAreaTaiChinhId = areaTaiChinh.id;
  });

  after(async () => {
    try {
      // Clean up in reverse dependency order
      await prisma.delegationScopeRule.deleteMany({
        where: { delegationGrant: { grantorAssignment: { userId: { in: [staff1.id, staff2.id, leaderStaff.id] } } } },
      });
      await prisma.delegationGrant.deleteMany({
        where: {
          OR: [
            { grantorAssignment: { userId: { in: [staff1.id, staff2.id, leaderStaff.id] } } },
            { granteeAssignment: { userId: { in: [staff1.id, staff2.id, leaderStaff.id] } } },
          ],
        },
      });
      await prisma.portfolioAssignment.deleteMany({
        where: { positionAssignment: { userId: { in: [staff1.id, staff2.id, leaderStaff.id] } } },
      });
      await prisma.positionAssignment.deleteMany({
        where: { userId: { in: [staff1.id, staff2.id, inactiveStaff.id, leaderStaff.id] } },
      });
      const respIds = [responsibilityAreaDaoTaoId, responsibilityAreaTaiChinhId].filter(Boolean);
      if (respIds.length > 0) {
        await prisma.responsibilityArea.deleteMany({
          where: { id: { in: respIds } },
        });
      }
      const posIds = [posPrincipalId, posDeanId, posLecturerId].filter(Boolean);
      if (posIds.length > 0) {
        await prisma.positionDefinition.deleteMany({
          where: { id: { in: posIds } },
        });
      }
      const unitIds = [rootUnitId, facultyUnitId, departmentUnitId].filter(Boolean);
      if (unitIds.length > 0) {
        await prisma.unitClosurePath.deleteMany({
          where: {
            OR: [
              { ancestorId: { in: unitIds } },
              { descendantId: { in: unitIds } },
            ],
          },
        });
        await prisma.organizationalUnit.deleteMany({
          where: { id: { in: unitIds } },
        });
      }
      await prisma.user.deleteMany({
        where: { id: { in: [adminActor.id, staff1.id, staff2.id, inactiveStaff.id, leaderStaff.id] } },
      });
    } catch (error) {
      console.error("Cleanup error in organization-v2-admin.test.ts:", error);
    }
  });

  // =========================================================================
  // 1. POSITION ASSIGNMENT & EFFECTIVE-DATING (Bổ nhiệm & Hiệu lực theo thời gian)
  // =========================================================================
  describe("1. Position Assignment & Effective-Dating", () => {
    let activePrimaryAssignmentId: string;

    test("Successfully creates an effective-dated PRIMARY position assignment", async () => {
      const effectiveFrom = new Date("2026-01-01T00:00:00Z");
      const effectiveTo = new Date("2031-01-01T00:00:00Z");

      const assignment = await PositionAssignmentService.createAssignment(adminActor, {
        userId: staff1.id,
        positionDefinitionId: posLecturerId,
        unitId: facultyUnitId,
        type: AssignmentType.PRIMARY,
        effectiveFrom,
        effectiveTo,
        sourceDecisionNumber: "101/QĐ-CĐKTCNQN",
      });

      assert.ok(assignment.id);
      assert.equal(assignment.userId, staff1.id);
      assert.equal(assignment.type, AssignmentType.PRIMARY);
      assert.equal(assignment.status, AssignmentStatus.ACTIVE);
      assert.equal(assignment.sourceDecisionNumber, "101/QĐ-CĐKTCNQN");
      assert.equal(new Date(assignment.effectiveFrom).toISOString(), effectiveFrom.toISOString());

      activePrimaryAssignmentId = assignment.id;
    });

    test("Rejects appointment for inactive staff member", async () => {
      await assert.rejects(
        async () => {
          await PositionAssignmentService.createAssignment(adminActor, {
            userId: inactiveStaff.id,
            positionDefinitionId: posLecturerId,
            unitId: facultyUnitId,
            type: AssignmentType.PRIMARY,
            effectiveFrom: new Date(),
            sourceDecisionNumber: "100/QĐ-TEST",
          });
        },
        (err: any) => {
          assert.ok(err instanceof ValidationError);
          assert.match(err.message, /bị vô hiệu hóa/);
          return true;
        }
      );
    });

    test("Enforces single active PRIMARY assignment invariant (ConflictError)", async () => {
      // staff1 already has an active PRIMARY assignment from the first test
      await assert.rejects(
        async () => {
          await PositionAssignmentService.createAssignment(adminActor, {
            userId: staff1.id,
            positionDefinitionId: posDeanId,
            unitId: facultyUnitId,
            type: AssignmentType.PRIMARY,
            effectiveFrom: new Date(),
            sourceDecisionNumber: "101/QĐ-TEST",
          });
        },
        (err: any) => {
          assert.ok(err instanceof ConflictError);
          assert.match(err.message, /đã có chức vụ chính \(PRIMARY\)/);
          return true;
        }
      );
    });

    test("Allows creating a SECONDARY / CONCURRENT assignment concurrently", async () => {
      const concurrentAssignment = await PositionAssignmentService.createAssignment(adminActor, {
        userId: staff1.id,
        positionDefinitionId: posDeanId,
        unitId: facultyUnitId,
        type: AssignmentType.CONCURRENT,
        effectiveFrom: new Date("2026-03-01T00:00:00Z"),
        sourceDecisionNumber: "105/QĐ-CĐKTCNQN",
      });

      assert.ok(concurrentAssignment.id);
      assert.equal(concurrentAssignment.type, AssignmentType.CONCURRENT);
      assert.equal(concurrentAssignment.status, AssignmentStatus.ACTIVE);
    });

    test("Atomically transfers assignment (Điều động công tác) from old unit to new unit", async () => {
      // Transfer staff1 from faculty to department as PRIMARY
      const transferResult = await PositionAssignmentService.transferAssignment(adminActor, {
        currentAssignmentId: activePrimaryAssignmentId,
        newUnitId: departmentUnitId,
        newPositionDefinitionId: posLecturerId,
        transferDate: new Date("2026-06-01T00:00:00Z"),
        decisionNumber: "200/QĐ-ĐĐ-CĐKTCNQN",
        notes: "Điều động biệt phái sang Phòng Đào tạo",
      });

      assert.ok(transferResult.newAssignment.id);
      assert.equal(transferResult.newAssignment.unitId, departmentUnitId);
      assert.equal(transferResult.newAssignment.status, AssignmentStatus.ACTIVE);
      assert.equal(transferResult.newAssignment.type, AssignmentType.PRIMARY);

      // Verify old assignment is marked SUPERSEDED
      assert.equal(transferResult.oldAssignment.status, AssignmentStatus.SUPERSEDED);
      assert.ok(transferResult.oldAssignment.effectiveTo);
      assert.equal(
        new Date(transferResult.oldAssignment.effectiveTo).toISOString(),
        new Date("2026-06-01T00:00:00Z").toISOString()
      );
    });

    test("Ends / terminates assignment (Miễn nhiệm) with effective date", async () => {
      // Appoint staff2 to posDeanId
      const staff2Assignment = await PositionAssignmentService.createAssignment(adminActor, {
        userId: staff2.id,
        positionDefinitionId: posDeanId,
        unitId: facultyUnitId,
        type: AssignmentType.PRIMARY,
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        sourceDecisionNumber: "110/QĐ-CĐKTCNQN",
      });

      // End staff2 assignment
      const ended = await PositionAssignmentService.endAssignment(adminActor, {
        assignmentId: staff2Assignment.id,
        endDate: new Date("2026-08-01T00:00:00Z"),
        reason: "Miễn nhiệm theo nguyện vọng cá nhân",
        decisionNumber: "300/QĐ-MN-CĐKTCNQN",
      });

      assert.equal(ended.status, AssignmentStatus.TERMINATED);
      assert.equal(
        new Date(ended.effectiveTo!).toISOString(),
        new Date("2026-08-01T00:00:00Z").toISOString()
      );
    });

    test("Queries active assignments at a specific temporal point in time", async () => {
      // At 2026-04-01: staff2 was active
      const activeAtApril = await PositionAssignmentService.getActiveAssignmentsAt(
        new Date("2026-04-01T00:00:00Z"),
        { userId: staff2.id }
      );
      assert.equal(activeAtApril.length, 1);

      // At 2026-09-01: staff2 was revoked/ended
      const activeAtSeptember = await PositionAssignmentService.getActiveAssignmentsAt(
        new Date("2026-09-01T00:00:00Z"),
        { userId: staff2.id }
      );
      assert.equal(activeAtSeptember.length, 0);
    });
  });

  // =========================================================================
  // 2. RESPONSIBILITY AREAS & PORTFOLIO ASSIGNMENT (11 mảng theo QĐ 420)
  // =========================================================================
  describe("2. Responsibility Area & Portfolio Assignment (QĐ 420)", () => {
    let portfolioId: string;

    before(async () => {
      // Assign leaderStaff as Leadership at School level
      const leaderAssignment = await PositionAssignmentService.createAssignment(adminActor, {
        userId: leaderStaff.id,
        positionDefinitionId: posPrincipalId,
        unitId: rootUnitId,
        type: AssignmentType.PRIMARY,
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        sourceDecisionNumber: "400/QĐ-BGH",
      });
      leadershipAssignmentId = leaderAssignment.id;
    });

    test("Retrieves canonical responsibility areas", async () => {
      const areas = await ResponsibilityPortfolioService.listResponsibilityAreas();
      assert.ok(areas.length >= 2);
      const daoTao = areas.find((a) => a.id === responsibilityAreaDaoTaoId);
      assert.ok(daoTao);
      assert.equal(daoTao.category, "ACADEMIC");
    });

    test("Assigns responsibility portfolio to leadership assignment with effective date", async () => {
      const effectiveFrom = new Date("2026-01-15T00:00:00Z");
      const effectiveTo = new Date("2031-01-15T00:00:00Z");

      const portfolio = await ResponsibilityPortfolioService.assignPortfolio(adminActor, {
        positionAssignmentId: leadershipAssignmentId,
        responsibilityAreaId: responsibilityAreaDaoTaoId,
        effectiveFrom,
        effectiveTo,
        decisionNumber: "420/QĐ-CĐKTCNQN",
        notes: "Phụ trách mảng đào tạo đại học và tuyển sinh",
      });

      assert.ok(portfolio.id);
      assert.equal(portfolio.positionAssignmentId, leadershipAssignmentId);
      assert.equal(portfolio.responsibilityAreaId, responsibilityAreaDaoTaoId);
      portfolioId = portfolio.id;
    });

    test("Prevents duplicate active portfolio assignment for the same area", async () => {
      await assert.rejects(
        async () => {
          await ResponsibilityPortfolioService.assignPortfolio(adminActor, {
            positionAssignmentId: leadershipAssignmentId,
            responsibilityAreaId: responsibilityAreaDaoTaoId,
            isPrimary: true,
            effectiveFrom: new Date("2026-02-01T00:00:00Z"),
          });
        },
        (err: any) => {
          assert.ok(err instanceof ConflictError);
          assert.match(err.message, /đã được phân công/);
          return true;
        }
      );
    });

    test("Terminates portfolio assignment with end date", async () => {
      const endDate = new Date("2026-10-01T00:00:00Z");
      const ended = await ResponsibilityPortfolioService.endPortfolioAssignment(adminActor, {
        portfolioAssignmentId: portfolioId,
        endDate,
        notes: "Bàn giao mảng đào tạo cho Phó Hiệu trưởng mới",
      });

      assert.equal(new Date(ended.effectiveTo!).toISOString(), endDate.toISOString());
    });
  });

  // =========================================================================
  // 3. DELEGATION GRANTS & CONFLICT DETECTION (Ủy quyền & Kiểm tra xung đột)
  // =========================================================================
  describe("3. Delegation Grant Lifecycle & Conflict Management", () => {
    let grantorAssignmentId: string;
    let granteeAssignmentId: string;
    let createdDelegationId: string;

    before(async () => {
      // Find active assignment for staff1
      const staff1Active = await prisma.positionAssignment.findFirst({
        where: { userId: staff1.id, status: AssignmentStatus.ACTIVE },
      });

      grantorAssignmentId = leadershipAssignmentId;
      granteeAssignmentId = staff1Active!.id;
    });

    test("Successfully creates a valid delegation grant with date bounds and scope rules", async () => {
      const validFrom = new Date("2026-07-01T00:00:00Z");
      const validUntil = new Date("2026-07-31T23:59:59Z");

      const delegation = await DelegationGrantService.createDelegation(
        { id: leaderStaff.id, name: leaderStaff.name, role: "BAN_GIAM_HIEU" },
        {
          grantorAssignmentId,
          granteeAssignmentId,
          action: "APPROVE_TASK",
          validFrom,
          validUntil,
          sourceDocumentNumber: "50/GUQ-BGH",
          notes: "Ủy quyền duyệt kế hoạch khoa học trong thời gian đi công tác",
          scopeRules: [
            {
              entityType: "ORGANIZATIONAL_UNIT",
              entityId: facultyUnitId,
              constraintType: "INCLUDE",
            },
          ],
        }
      );

      assert.ok(delegation.id);
      assert.equal(delegation.grantorAssignmentId, grantorAssignmentId);
      assert.equal(delegation.granteeAssignmentId, granteeAssignmentId);
      assert.equal(delegation.status, DelegationStatus.ACTIVE);
      assert.equal(delegation.action, "APPROVE_TASK");
      assert.equal(delegation.sourceDocumentNumber, "50/GUQ-BGH");
      assert.equal(delegation.scopeRules?.length, 1);

      createdDelegationId = delegation.id;
    });

    test("Prevents circular delegation (A delegates to B while B delegates to A)", async () => {
      // staff1 (grantee) attempts to delegate back to staff2 (grantor) for the same period
      await assert.rejects(
        async () => {
          await DelegationGrantService.createDelegation(
            { id: staff1.id, name: staff1.name, role: "GIANG_VIEN" },
            {
              grantorAssignmentId: granteeAssignmentId, // staff1
              granteeAssignmentId: grantorAssignmentId, // staff2
              action: "APPROVE_TASK",
              validFrom: new Date("2026-07-10T00:00:00Z"),
              validUntil: new Date("2026-07-20T23:59:59Z"),
              sourceDocumentNumber: "51/GUQ-CIRCULAR",
            }
          );
        },
        (err: any) => {
          assert.ok(err instanceof ConflictError);
          assert.match(err.message, /ủy quyền vòng tròn/);
          return true;
        }
      );
    });

    test("Detects overlapping delegation conflict for identical action and period", async () => {
      await assert.rejects(
        async () => {
          await DelegationGrantService.createDelegation(
            { id: leaderStaff.id, name: leaderStaff.name, role: "BAN_GIAM_HIEU" },
            {
              grantorAssignmentId,
              granteeAssignmentId,
              action: "APPROVE_TASK",
              validFrom: new Date("2026-07-15T00:00:00Z"),
              validUntil: new Date("2026-07-25T23:59:59Z"),
              sourceDocumentNumber: "52/GUQ-OVERLAP",
            }
          );
        },
        (err: any) => {
          assert.ok(err instanceof ConflictError);
          assert.match(err.message, /Đã tồn tại giấy ủy quyền có hiệu lực trùng lặp/);
          return true;
        }
      );
    });

    test("Successfully revokes delegation before expiration date", async () => {
      const revoked = await DelegationGrantService.revokeDelegation(
        { id: leaderStaff.id, name: leaderStaff.name, role: "BAN_GIAM_HIEU" },
        {
          delegationId: createdDelegationId,
          reason: "Hoàn thành công tác sớm hơn dự kiến, kết thúc ủy quyền",
        }
      );

      assert.equal(revoked.status, DelegationStatus.REVOKED);
      assert.ok(revoked.revokedAt);
      assert.equal(revoked.revokedReason, "Hoàn thành công tác sớm hơn dự kiến, kết thúc ủy quyền");
    });

    test("Querying active delegations returns 0 after revocation", async () => {
      const active = await DelegationGrantService.getActiveDelegationsAt(
        new Date("2026-07-15T00:00:00Z"),
        { granteeUserId: staff1.id }
      );
      assert.equal(active.length, 0);
    });
  });
});
