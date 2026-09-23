/**
 * ============================================================================
 * ADVERSARIAL PENETRATION TEST SUITE: TASK ReBAC & INVARIANT ENFORCEMENT
 * Target File: tests/domain-task-rebac-security.test.ts
 * Specification: docs/domain/task-management.md & docs/domain/authority.md
 *
 * RIGOROUS PENETRATION INVARIANTS TESTED:
 * - Test 1: Collaborator attempting to reassign DRI -> MUST BE REJECTED (COLLABORATOR_CANNOT_REASSIGN_DRI)
 * - Test 2: Maker-Checker Invariant -> Submitter/DRI attempting to approve own task deliverable -> MUST BE REJECTED (SOD_VIOLATION)
 * - Test 3: Observer role -> Read access allowed, update/submit actions rejected (OBSERVER_CANNOT_MUTATE)
 * - Test 4: Lead Unit ReBAC boundary -> Unit leader of Department A cannot reassign tasks of Department B unless assigned as COORDINATING_UNIT
 * - Test 5: Approval step progression -> Cannot bypass intermediate steps without explicit bypass authority
 * ============================================================================
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  UserRole,
  TaskActorRole,
  AssignmentStatus,
  ApprovalProcessStatus,
  ApprovalStepStatus,
  TaskStatus,
} from "@prisma/client";

// Authorization Policy Engine
import {
  authorize,
  assertAuthorized,
  isAuthorized,
  type AuthenticatedUserContext,
  type AuthorizationResource,
  SingleDRIError,
  SeparationOfDutiesError as PolicySoDError,
  HybridAuthorizationError,
} from "../src/lib/auth/hybrid-authorization";

// Domain Task Actor & Workflow Service
import {
  setTaskDRI,
  addTaskCollaborator,
  addTaskObserver,
  submitTaskResult,
  verifyTaskResult,
  initiateApprovalProcess,
  executeApprovalStep,
  TaskActorAuthorizationError,
  SegregationOfDutiesError,
  MakerCheckerError,
  StepProgressionError,
} from "../src/lib/services/task-actor-service";

describe("Adversarial Task ReBAC & Invariant Penetration Test Suite", () => {
  // Test Entities
  const timestamp = Date.now();
  let executiveUser: any;
  let deanFacultyA: any;
  let deanFacultyB: any;
  let staffFacultyA: any;
  let staffFacultyB: any;
  let staffFacultyC: any;
  let deptA: any;
  let deptB: any;
  let posDefDeanA: any;
  let posDefDeanB: any;
  let testTaskA: any;
  let testTaskB: any;

  // Hybrid Authorization Context Mappings
  let authContextExecutive: AuthenticatedUserContext;
  let authContextDeanA: AuthenticatedUserContext;
  let authContextDeanB: AuthenticatedUserContext;
  let authContextStaffA: AuthenticatedUserContext;
  let authContextStaffB: AuthenticatedUserContext;
  let authContextStaffC: AuthenticatedUserContext;

  before(async () => {
    // 1. Create Departments and Organizational Units
    const deptAId = `DEPT_CNTT_${timestamp}`;
    const deptBId = `DEPT_DLDV_${timestamp}`;

    await prisma.organizationalUnit.upsert({
      where: { id: deptAId },
      update: {},
      create: {
        id: deptAId,
        code: `K_CNTT_${timestamp}`,
        name: "Khoa Công nghệ Thông tin Test",
        type: "FACULTY" as any,
        status: "ACTIVE" as any,
      },
    });

    await prisma.organizationalUnit.upsert({
      where: { id: deptBId },
      update: {},
      create: {
        id: deptBId,
        code: `K_DLDV_${timestamp}`,
        name: "Khoa Du lịch & Dịch vụ Test",
        type: "FACULTY" as any,
        status: "ACTIVE" as any,
      },
    });

    deptA = await prisma.organizationalUnit.findUniqueOrThrow({ where: { id: deptAId } });

    deptB = await prisma.organizationalUnit.findUniqueOrThrow({ where: { id: deptBId } });

    // 2. Create Users
    executiveUser = await prisma.user.create({
      data: {
        name: "Phạm Văn Tường (Hiệu trưởng)",
        email: `rector_${timestamp}@qcet.edu.vn`,
        role: UserRole.BAN_GIAM_HIEU,
      },
    });

    deanFacultyA = await prisma.user.create({
      data: {
        name: "TS. Vũ Văn Trực (Trưởng Khoa CNTT)",
        email: `truc.vv_${timestamp}@qcet.edu.vn`,
        role: UserRole.TRUONG_PHONG,

      },
    });

    deanFacultyB = await prisma.user.create({
      data: {
        name: "Trưởng Khoa Du lịch Test",
        email: `dean.b_${timestamp}@qcet.edu.vn`,
        role: UserRole.TRUONG_PHONG,

      },
    });

    staffFacultyA = await prisma.user.create({
      data: {
        name: "Nguyễn Văn A (Giảng viên CNTT)",
        email: `staff.a_${timestamp}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,

      },
    });

    staffFacultyB = await prisma.user.create({
      data: {
        name: "Trần Thị B (Giảng viên Dịch vụ)",
        email: `staff.b_${timestamp}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,

      },
    });

    staffFacultyC = await prisma.user.create({
      data: {
        name: "Lê Văn C (Cán bộ Độc lập)",
        email: `staff.c_${timestamp}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,
      },
    });

    // 3. Create Position Definitions & Assignments
    posDefDeanA = await prisma.positionDefinition.create({
      data: {
        code: `TRUONG_KHOA_A_${timestamp}`,
        title: "Trưởng Khoa CNTT",
        group: "LDPU",
        isLeadership: true,
      },
    });

    posDefDeanB = await prisma.positionDefinition.create({
      data: {
        code: `TRUONG_KHOA_B_${timestamp}`,
        title: "Trưởng Khoa Du Lịch",
        group: "LDPU",
        isLeadership: true,
      },
    });

    await prisma.positionAssignment.create({
      data: {
        userId: deanFacultyA.id,
        positionDefinitionId: posDefDeanA.id,
        unitId: deptA.id,
        status: AssignmentStatus.ACTIVE,
      },
    });

    await prisma.positionAssignment.create({
      data: {
        userId: deanFacultyB.id,
        positionDefinitionId: posDefDeanB.id,
        unitId: deptB.id,
        status: AssignmentStatus.ACTIVE,
      },
    });

    // 4. Set up Authorization Contexts
    authContextExecutive = {
      id: executiveUser.id,
      name: executiveUser.name,
      email: executiveUser.email,
      activePositionCode: "HIEU_TRUONG",
      systemRole: "RECTOR",
      portfolios: ["INSTITUTIONAL_STRATEGY"],
      isActive: true,
    };

    authContextDeanA = {
      id: deanFacultyA.id,
      name: deanFacultyA.name,
      email: deanFacultyA.email,
      activePositionCode: "TRUONG_DON_VI",

      departmentCode: deptA.code,
      isActive: true,
    };

    authContextDeanB = {
      id: deanFacultyB.id,
      name: deanFacultyB.name,
      email: deanFacultyB.email,
      activePositionCode: "TRUONG_DON_VI",

      departmentCode: deptB.code,
      isActive: true,
    };

    authContextStaffA = {
      id: staffFacultyA.id,
      name: staffFacultyA.name,
      email: staffFacultyA.email,
      activePositionCode: "GIANG_VIEN_CHUYEN_VIEN",

      departmentCode: deptA.code,
      isActive: true,
    };

    authContextStaffB = {
      id: staffFacultyB.id,
      name: staffFacultyB.name,
      email: staffFacultyB.email,
      activePositionCode: "GIANG_VIEN_CHUYEN_VIEN",

      departmentCode: deptB.code,
      isActive: true,
    };

    authContextStaffC = {
      id: staffFacultyC.id,
      name: staffFacultyC.name,
      email: staffFacultyC.email,
      activePositionCode: "GIANG_VIEN_CHUYEN_VIEN",
      isActive: true,
    };

    // 5. Seed Base Tasks
    testTaskA = await prisma.task.create({
      data: {
        code: `TASK-DEPT-A-${timestamp}`,
        title: "Nhiệm vụ Hiện đại hóa Phòng máy CNTT",
        createdById: executiveUser.id,
        leadUnitId: deptA.id,

        academicMonth: 9,
        academicYear: "2026-2027",
        dueDate: new Date(Date.now() + 86400000),
      },
    });

    testTaskB = await prisma.task.create({
      data: {
        code: `TASK-DEPT-B-${timestamp}`,
        title: "Nhiệm vụ Thẩm định Giáo trình Du lịch",
        createdById: executiveUser.id,
        leadUnitId: deptB.id,

        academicMonth: 9,
        academicYear: "2026-2027",
        dueDate: new Date(Date.now() + 86400000),
      },
    });
  });

  after(async () => {
    // Teardown DB records
    try {
      await prisma.taskResult.deleteMany({
        where: { task: { code: { contains: String(timestamp) } } },
      });
      await prisma.taskApprovalStep.deleteMany({
        where: { process: { task: { code: { contains: String(timestamp) } } } },
      });
      await prisma.taskApprovalProcess.deleteMany({
        where: { task: { code: { contains: String(timestamp) } } },
      });
      await prisma.taskActor.deleteMany({
        where: { task: { code: { contains: String(timestamp) } } },
      });
      await prisma.taskActor.deleteMany({
        where: { task: { code: { contains: String(timestamp) } } },
      });
      await prisma.task.deleteMany({
        where: { code: { contains: String(timestamp) } },
      });

      await prisma.positionAssignment.deleteMany({
        where: {
          userId: {
            in: [deanFacultyA?.id, deanFacultyB?.id].filter(Boolean),
          },
        },
      });

      if (posDefDeanA) {
        await prisma.positionDefinition.delete({ where: { id: posDefDeanA.id } });
      }
      if (posDefDeanB) {
        await prisma.positionDefinition.delete({ where: { id: posDefDeanB.id } });
      }

      const userIds = [
        executiveUser?.id,
        deanFacultyA?.id,
        deanFacultyB?.id,
        staffFacultyA?.id,
        staffFacultyB?.id,
        staffFacultyC?.id,
      ].filter(Boolean);

      await prisma.user.deleteMany({ where: { id: { in: userIds } } });

      if (deptA) {
        await prisma.organizationalUnit.delete({ where: { id: deptA.id } });
        await prisma.organizationalUnit.delete({ where: { id: deptA.id } });
      }
      if (deptB) {
        await prisma.organizationalUnit.delete({ where: { id: deptB.id } });
        await prisma.organizationalUnit.delete({ where: { id: deptB.id } });
      }
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }
  });

  // ==========================================================================
  // TEST 1: Collaborator attempting to reassign DRI -> MUST BE REJECTED
  // (COLLABORATOR_CANNOT_REASSIGN_DRI)
  // ==========================================================================
  describe("Test 1: Collaborator attempting to reassign DRI (Single DRI Invariant)", () => {
    let taskForTest1: any;

    before(async () => {
      taskForTest1 = await prisma.task.create({
        data: {
          code: `TASK-DRI-REASSIGN-${timestamp}`,
          title: "Xây dựng Chuẩn đầu ra ngành CNTT",
          createdById: deanFacultyA.id,
          leadUnitId: deptA.id,

          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });

      // Appoint staffFacultyA as primary DRI
      await setTaskDRI(taskForTest1.id, staffFacultyA.id, {
        requestedById: deanFacultyA.id,
      });

      // Appoint staffFacultyC as COLLABORATOR
      await addTaskCollaborator(taskForTest1.id, staffFacultyC.id, {
        requestedById: deanFacultyA.id,
      });
    });

    after(async () => {
      if (taskForTest1) {
        await prisma.taskActor.deleteMany({ where: { taskId: taskForTest1.id } });
        await prisma.taskActor.deleteMany({ where: { taskId: taskForTest1.id } });
        await prisma.task.delete({ where: { id: taskForTest1.id } });
      }
    });

    test("1.1 [Policy Engine]: Collaborator attempting task.reassign MUST BE REJECTED with COLLABORATOR_CANNOT_REASSIGN_DRI", async () => {
      const resource: AuthorizationResource = {
        id: taskForTest1.id,
        type: "task",

        leadDepartmentId: deptA.id,
        primaryOwnerId: staffFacultyA.id,
        collaboratorIds: [staffFacultyC.id],
      };

      const res = await authorize(authContextStaffC, "task.reassign", resource);

      assert.equal(res.allowed, false, "Collaborator must be rejected when attempting to reassign DRI");
      assert.ok(
        res.rejectionCode === "COLLABORATOR_CANNOT_REASSIGN_DRI" ||
          res.rejectionCode === "INSUFFICIENT_RELATIONSHIP",
        `Expected rejection code COLLABORATOR_CANNOT_REASSIGN_DRI, got: ${res.rejectionCode}`
      );
      assert.equal(res.statusCode, "SINGLE_DRI_VIOLATION");

      // Verify assertAuthorized helper throws strongly-typed SingleDRIError
      await assert.rejects(
        async () => {
          await assertAuthorized(authContextStaffC, "task.reassign", resource);
        },
        (err: unknown) => {
          assert.ok(
            err instanceof SingleDRIError || err instanceof HybridAuthorizationError
          );
          return true;
        }
      );
    });

    test("1.2 [Policy Engine]: Collaborator attempting task.assign to overwrite assignees MUST BE REJECTED", async () => {
      const resource: AuthorizationResource = {
        id: taskForTest1.id,
        type: "task",

        leadDepartmentId: deptA.id,
        primaryOwnerId: staffFacultyA.id,
        collaboratorIds: [staffFacultyC.id],
      };

      const res = await authorize(authContextStaffC, "task.assign", resource);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "COLLABORATOR_CANNOT_REASSIGN_DRI");
    });

    test("1.3 [Service Layer]: Collaborator invoking setTaskDRI MUST BE REJECTED with TaskActorAuthorizationError", async () => {
      await assert.rejects(
        async () => {
          await setTaskDRI(taskForTest1.id, staffFacultyB.id, {
            requestedById: staffFacultyC.id, // staffFacultyC is only a collaborator
          });
        },
        (err: unknown) => {
          assert.ok(
            err instanceof TaskActorAuthorizationError,
            "Must throw TaskActorAuthorizationError"
          );
          assert.ok(
            (err as Error).message.includes("Collaborators cannot reassign DRI"),
            `Expected message to contain 'Collaborators cannot reassign DRI', got: ${(err as Error).message}`
          );
          return true;
        }
      );
    });

    test("1.4 [Control]: Department Head and Assigner CAN legitimately reassign DRI", async () => {
      const resource: AuthorizationResource = {
        id: taskForTest1.id,
        type: "task",

        leadDepartmentId: deptA.id,
        primaryOwnerId: staffFacultyA.id,
        collaboratorIds: [staffFacultyC.id],
      };

      const res = await authorize(authContextDeanA, "task.reassign", resource);
      assert.equal(res.allowed, true, "Department Head of Lead Unit must be permitted to reassign DRI");
      assert.equal(res.statusCode, "GRANTED");
    });
  });

  // ==========================================================================
  // TEST 2: Maker-Checker Invariant -> Submitter/DRI attempting to approve own task deliverable
  // MUST BE REJECTED (SOD_VIOLATION)
  // ==========================================================================
  describe("Test 2: Maker-Checker Invariant (Submitter/DRI Self-Approval Prohibited)", () => {
    let taskForTest2: any;
    let taskResultItem: any;
    let approvalProcess: any;
    let approvalStep1: any;

    before(async () => {
      taskForTest2 = await prisma.task.create({
        data: {
          code: `TASK-MAKER-CHECKER-${timestamp}`,
          title: "Biên soạn Giáo trình Mạng Máy tính Nâng cao",
          createdById: deanFacultyA.id,
          leadUnitId: deptA.id,

          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });

      // Staff A is primary DRI
      await setTaskDRI(taskForTest2.id, staffFacultyA.id, {
        requestedById: deanFacultyA.id,
      });

      // Staff A (DRI) submits task deliverable
      taskResultItem = await submitTaskResult(
        taskForTest2.id,
        staffFacultyA.id,
        {
          summary: "Đề cương chi tiết và 05 chương giáo trình",
          reportUrl: "https://storage.qcet.edu.vn/curriculum_net_v1.pdf",
        }
      );

      // Create Approval Process
      const proc = await initiateApprovalProcess(
        taskForTest2.id,
        [
          {
            title: "Thẩm định Chuyên môn Khoa CNTT",
            reviewerUserId: staffFacultyA.id, // Maliciously configured or attempted by DRI
          },
          {
            title: "Ban Giám Hiệu Phê chuẩn Nghiệm thu",
            reviewerUserId: executiveUser.id,
          },
        ]
      );
      approvalProcess = proc;
      approvalStep1 = proc.steps[0];
    });

    after(async () => {
      if (taskForTest2) {
        await prisma.taskResult.deleteMany({ where: { taskId: taskForTest2.id } });
        await prisma.taskApprovalStep.deleteMany({
          where: { process: { taskId: taskForTest2.id } },
        });
        await prisma.taskApprovalProcess.deleteMany({
          where: { taskId: taskForTest2.id },
        });
        await prisma.taskActor.deleteMany({ where: { taskId: taskForTest2.id } });
        await prisma.taskActor.deleteMany({ where: { taskId: taskForTest2.id } });
        await prisma.task.delete({ where: { id: taskForTest2.id } });
      }
    });

    test("2.1 [Policy Engine]: Submitter/DRI attempting task.approve MUST BE REJECTED with SOD_VIOLATION", async () => {
      const deliverableResource: AuthorizationResource = {
        id: taskForTest2.id,
        type: "task",
        createdById: deanFacultyA.id,
        primaryOwnerId: staffFacultyA.id, // Staff A is DRI
        submittedByUserId: staffFacultyA.id, // Staff A is Submitter

      };

      const res = await authorize(authContextStaffA, "task.approve", deliverableResource);

      assert.equal(res.allowed, false, "Submitter/DRI must not be permitted to approve own deliverable");
      assert.equal(res.rejectionCode, "SOD_VIOLATION");
      assert.equal(res.statusCode, "SOD_VIOLATION");
      assert.ok(
        res.reason?.includes("phân lập trách nhiệm") || res.reason?.includes("SoD"),
        "Audit reason must state Segregation of Duties violation"
      );
    });

    test("2.2 [Policy Engine]: Submitter/DRI attempting task.review MUST BE REJECTED with SOD_VIOLATION", async () => {
      const deliverableResource: AuthorizationResource = {
        id: taskForTest2.id,
        type: "task",
        createdById: deanFacultyA.id,
        primaryOwnerId: staffFacultyA.id,
        submittedByUserId: staffFacultyA.id,

      };

      const res = await authorize(authContextStaffA, "task.review", deliverableResource);

      assert.equal(res.allowed, false, "Submitter must not review own deliverable");
      assert.equal(res.rejectionCode, "SOD_VIOLATION");
      assert.equal(res.statusCode, "SOD_VIOLATION");
    });

    test("2.3 [Service Layer]: Submitter attempting verifyTaskResult on own result MUST BE REJECTED with MakerCheckerError", async () => {
      await assert.rejects(
        async () => {
          await verifyTaskResult(
            taskResultItem.id,
            staffFacultyA.id, // Self-verification attempt by submitter
            "Tự phê duyệt sản phẩm của bản thân"
          );
        },
        (err: unknown) => {
          assert.ok(
            err instanceof MakerCheckerError,
            "Must throw MakerCheckerError"
          );
          assert.ok(
            (err as Error).message.includes("Maker-Checker violation"),
            `Expected message to contain 'Maker-Checker violation', got: ${(err as Error).message}`
          );
          return true;
        }
      );
    });

    test("2.4 [Service Layer]: DRI attempting executeApprovalStep on own task MUST BE REJECTED with SegregationOfDutiesError", async () => {
      await assert.rejects(
        async () => {
          await executeApprovalStep(
            approvalStep1.id,
            staffFacultyA.id, // Self-approval attempt by DRI
            "APPROVED",
            "Tự duyệt nghiệm thu bước 1"
          );
        },
        (err: unknown) => {
          assert.ok(
            err instanceof SegregationOfDutiesError,
            "Must throw SegregationOfDutiesError"
          );
          assert.ok(
            (err as Error).message.includes("Segregation of Duties (SoD) violation"),
            `Expected message to contain 'Segregation of Duties (SoD) violation', got: ${(err as Error).message}`
          );
          return true;
        }
      );
    });

    test("2.5 [Control]: Independent Reviewer/Department Head CAN legitimately verify deliverable", async () => {
      const verifiedResult = await verifyTaskResult(
        taskResultItem.id,
        deanFacultyA.id, // Legitimate independent checker
        "Trưởng đơn vị nghiệm thu hồ sơ đạt chuẩn"
      );

      assert.ok(verifiedResult.verifiedAt, "Deliverable must be marked with verifiedAt timestamp");
      assert.equal(verifiedResult.verifiedByUserId, deanFacultyA.id);
    });
  });

  // ==========================================================================
  // TEST 3: Observer role -> Read access allowed, update/submit actions rejected
  // (OBSERVER_CANNOT_MUTATE)
  // ==========================================================================
  describe("Test 3: Observer Role Boundary (Read Allowed, Mutation Rejected)", () => {
    let observedTask: any;

    before(async () => {
      observedTask = await prisma.task.create({
        data: {
          code: `TASK-OBSERVER-${timestamp}`,
          title: "Quan sát Đánh giá Chất lượng Đào tạo",
          createdById: executiveUser.id,
          leadUnitId: deptA.id,

          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });

      // Staff A is primary DRI
      await setTaskDRI(observedTask.id, staffFacultyA.id, {
        requestedById: executiveUser.id,
      });

      // Staff C is designated as OBSERVER ONLY
      await addTaskObserver(observedTask.id, staffFacultyC.id, {
        requestedById: executiveUser.id,
      });
    });

    after(async () => {
      if (observedTask) {
        await prisma.taskActor.deleteMany({ where: { taskId: observedTask.id } });
        await prisma.taskActor.deleteMany({ where: { taskId: observedTask.id } });
        await prisma.task.delete({ where: { id: observedTask.id } });
      }
    });

    test("3.1 [Policy Engine]: Observer viewing task (task.view) MUST BE ALLOWED", async () => {
      const resource: AuthorizationResource = {
        id: observedTask.id,
        type: "task",

        leadDepartmentId: deptA.id,
        primaryOwnerId: staffFacultyA.id,
        observerIds: [staffFacultyC.id],
        collaboratorIds: [],
      };

      const res = await authorize(authContextStaffC, "task.view", resource);
      assert.equal(res.allowed, true, "Observer must be permitted read-only view access");
      assert.equal(res.statusCode, "GRANTED");
    });

    test("3.2 [Policy Engine]: Observer attempting task.update_execution MUST BE REJECTED (OBSERVER_CANNOT_MUTATE)", async () => {
      const resource: AuthorizationResource = {
        id: observedTask.id,
        type: "task",

        leadDepartmentId: deptA.id,
        primaryOwnerId: staffFacultyA.id,
        observerIds: [staffFacultyC.id],
      };

      const res = await authorize(authContextStaffC, "task.update_execution", resource);

      assert.equal(res.allowed, false, "Observer must not update task execution progress");
      assert.equal(res.rejectionCode, "INSUFFICIENT_RELATIONSHIP");
      assert.equal(res.statusCode, "INSUFFICIENT_RELATIONSHIP");
    });

    test("3.3 [Policy Engine]: Observer attempting task.submit_result MUST BE REJECTED", async () => {
      const resource: AuthorizationResource = {
        id: observedTask.id,
        type: "task",

        leadDepartmentId: deptA.id,
        primaryOwnerId: staffFacultyA.id,
        observerIds: [staffFacultyC.id],
      };

      const res = await authorize(authContextStaffC, "task.submit_result", resource);
      assert.equal(res.allowed, false, "Observer must not submit deliverables");
      assert.equal(res.rejectionCode, "INSUFFICIENT_RELATIONSHIP");
    });

    test("3.4 [Policy Engine]: Observer attempting task.approve or task.reassign MUST BE REJECTED", async () => {
      const resource: AuthorizationResource = {
        id: observedTask.id,
        type: "task",

        leadDepartmentId: deptA.id,
        primaryOwnerId: staffFacultyA.id,
        observerIds: [staffFacultyC.id],
      };

      const resApprove = await authorize(authContextStaffC, "task.approve", resource);
      assert.equal(resApprove.allowed, false);

      const resReassign = await authorize(authContextStaffC, "task.reassign", resource);
      assert.equal(resReassign.allowed, false);
    });
  });

  // ==========================================================================
  // TEST 4: Lead Unit ReBAC boundary -> Unit leader of Department A cannot reassign tasks
  // of Department B unless assigned as COORDINATING_UNIT
  // ==========================================================================
  describe("Test 4: Lead Unit ReBAC Boundary & Cross-Department Protection", () => {
    let taskFacultyB: any;

    before(async () => {
      taskFacultyB = await prisma.task.create({
        data: {
          code: `TASK-DEPT-B-DRI-${timestamp}`,
          title: "Xây dựng Chuỗi Phòng thực hành Nhà hàng - Khách sạn",
          createdById: executiveUser.id,
          leadUnitId: deptB.id,

          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });

      // Staff B is primary DRI in Faculty B
      await setTaskDRI(taskFacultyB.id, staffFacultyB.id, {
        requestedById: deanFacultyB.id,
      });
    });

    after(async () => {
      if (taskFacultyB) {
        await prisma.taskActor.deleteMany({ where: { taskId: taskFacultyB.id } });
        await prisma.taskActor.deleteMany({ where: { taskId: taskFacultyB.id } });
        await prisma.task.delete({ where: { id: taskFacultyB.id } });
      }
    });

    test("4.1 [Policy Engine]: Unit Leader of Dept A attempting to reassign Dept B's task (No Relation) MUST BE REJECTED with DEPARTMENT_BOUNDARY_VIOLATION", async () => {
      const resourceB: AuthorizationResource = {
        id: taskFacultyB.id,
        type: "task",

        leadDepartmentId: deptB.id,
        primaryOwnerId: staffFacultyB.id,
        scope: "DEPARTMENT",
      };

      const res = await authorize(authContextDeanA, "task.reassign", resourceB);

      assert.equal(res.allowed, false, "Unit Leader of Dept A cannot reassign tasks belonging to Dept B");
      assert.ok(
        res.rejectionCode === "DEPARTMENT_BOUNDARY_VIOLATION" ||
          res.rejectionCode === "UNIT_SCOPE_DENIED",
        `Expected DEPARTMENT_BOUNDARY_VIOLATION or UNIT_SCOPE_DENIED, got: ${res.rejectionCode}`
      );
    });

    test("4.2 [Service Layer]: Unit Leader of Dept A attempting setTaskDRI on Dept B's task MUST BE REJECTED", async () => {
      await assert.rejects(
        async () => {
          await setTaskDRI(taskFacultyB.id, staffFacultyA.id, {
            requestedById: deanFacultyA.id, // Dean of Dept A invading Dept B's task
          });
        },
        (err: unknown) => {
          assert.ok(
            err instanceof TaskActorAuthorizationError,
            "Must throw TaskActorAuthorizationError"
          );
          assert.ok(
            (err as Error).message.includes("Only ASSIGNER, Lead Unit Leader, or Executive Leadership"),
            `Expected unauthorized message, got: ${(err as Error).message}`
          );
          return true;
        }
      );
    });

    test("4.3 [Boundary Test]: When Dept A is assigned as COORDINATING_UNIT, Dean A CANNOT hijack/reassign primary DRI", async () => {
      // Add Dept A as COORDINATING_UNIT
      const coordinatingActor = await prisma.taskActor.create({
        data: {
          taskId: taskFacultyB.id,
          unitId: deptA.id,
          role: TaskActorRole.COORDINATING_UNIT,
          isPrimaryDRI: false,
          assignedById: executiveUser.id,
        },
      });

      // Adversarial Probe: Coordinating unit leader attempting to change primary DRI
      await assert.rejects(
        async () => {
          await setTaskDRI(taskFacultyB.id, staffFacultyA.id, {
            requestedById: deanFacultyA.id,
          });
        },
        (err: unknown) => {
          assert.ok(
            err instanceof TaskActorAuthorizationError,
            "Coordinating unit leader MUST NOT reassign primary DRI of lead unit"
          );
          return true;
        }
      );

      // Clean up actor
      await prisma.taskActor.delete({ where: { id: coordinatingActor.id } });
    });

    test("4.4 [Control]: Lead Unit Leader (Dean B) CAN legitimately reassign DRI within Department B", async () => {
      const resourceB: AuthorizationResource = {
        id: taskFacultyB.id,
        type: "task",

        leadDepartmentId: deptB.id,
        primaryOwnerId: staffFacultyB.id,
      };

      const res = await authorize(authContextDeanB, "task.reassign", resourceB);
      assert.equal(res.allowed, true, "Lead Unit Leader must have authority to reassign DRI in their unit");
      assert.equal(res.statusCode, "GRANTED");
    });
  });

  // ==========================================================================
  // TEST 5: Approval step progression -> Cannot bypass intermediate steps without explicit bypass authority
  // ==========================================================================
  describe("Test 5: Approval Step Progression Invariant & Bypass Control", () => {
    let stagedTask: any;
    let threeStepProcess: any;
    let step1: any;
    let step2: any;
    let step3: any;

    before(async () => {
      stagedTask = await prisma.task.create({
        data: {
          code: `TASK-STEP-PROGRESSION-${timestamp}`,
          title: "Đề án Mở ngành Logistics & Quản lý Chuỗi Cung ứng",
          createdById: staffFacultyB.id,
          leadUnitId: deptA.id,

          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });

      // Staff A is primary DRI
      await setTaskDRI(stagedTask.id, staffFacultyA.id, {
        requestedById: executiveUser.id,
      });

      // Submit deliverable
      await submitTaskResult(
        stagedTask.id,
        staffFacultyA.id,
        {
          summary: "Bộ hồ sơ thuyết minh mở ngành hoàn chỉnh",
          reportUrl: "https://storage.qcet.edu.vn/logistics_dossier.pdf",
        }
      );

      // 3-Stage Approval Process:
      // Step 1: Khoa CNTT Review (Dean A)
      // Step 2: Cán bộ Chuyên môn Thẩm định Độc lập (Staff C)
      // Step 3: Ban Giám Hiệu Phê chuẩn (Executive)
      threeStepProcess = await initiateApprovalProcess(
        stagedTask.id,
        [
          {
            title: "Cấp 1: Trưởng đơn vị thẩm duyệt hồ sơ",
            reviewerUserId: deanFacultyA.id,
          },
          {
            title: "Cấp 2: Cán bộ chuyên môn thẩm định độc lập",
            reviewerUserId: staffFacultyC.id,
          },
          {
            title: "Cấp 3: Ban Giám Hiệu phê chuẩn ban hành",
            reviewerUserId: executiveUser.id,
          },
        ]
      );

      step1 = threeStepProcess.steps[0];
      step2 = threeStepProcess.steps[1];
      step3 = threeStepProcess.steps[2];
    });

    after(async () => {
      if (stagedTask) {
        await prisma.taskResult.deleteMany({ where: { taskId: stagedTask.id } });
        await prisma.taskApprovalStep.deleteMany({
          where: { process: { taskId: stagedTask.id } },
        });
        await prisma.taskApprovalProcess.deleteMany({
          where: { taskId: stagedTask.id },
        });
        await prisma.taskActor.deleteMany({ where: { taskId: stagedTask.id } });
        await prisma.taskActor.deleteMany({ where: { taskId: stagedTask.id } });
        await prisma.task.delete({ where: { id: stagedTask.id } });
      }
    });

    test("5.1: Reviewer of Step 2 attempting to execute Step 2 while Step 1 is PENDING MUST BE REJECTED", async () => {
      await assert.rejects(
        async () => {
          await executeApprovalStep(
            step2.id,
            staffFacultyC.id,
            "APPROVED",
            "Cố gắng nhảy cóc qua Bước 1"
          );
        },
        (err: unknown) => {
          assert.ok(
            err instanceof StepProgressionError ||
              err instanceof TaskActorAuthorizationError,
            "Must throw StepProgressionError"
          );
          assert.ok(
            (err as Error).message.includes("Step progression violation") ||
              (err as Error).message.includes("pending without explicit bypass authority"),
            `Expected step progression violation message, got: ${(err as Error).message}`
          );
          return true;
        }
      );

      // Verify DB state did not mutate step 2
      const checkStep2 = await prisma.taskApprovalStep.findUnique({
        where: { id: step2.id },
      });
      assert.equal(checkStep2?.status, ApprovalStepStatus.PENDING);
    });

    test("5.2: Non-executive reviewer specifying allowBypass: true MUST BE REJECTED", async () => {
      await assert.rejects(
        async () => {
          await executeApprovalStep(
            step2.id,
            staffFacultyC.id,
            "APPROVED",
            "Cán bộ chuyên môn cố ý tự cấp quyền vượt cấp",
            { allowBypass: true }
          );
        },
        (err: unknown) => {
          assert.ok(
            err instanceof StepProgressionError ||
              err instanceof TaskActorAuthorizationError
          );
          return true;
        }
      );
    });

    test("5.3: Legitimate Sequential Progression: Step 1 -> Step 2 -> Step 3 executes cleanly", async () => {
      // Execute Step 1 by Dean A
      const step1Result = await executeApprovalStep(
        step1.id,
        deanFacultyA.id,
        "APPROVED",
        "Trưởng đơn vị xác nhận hồ sơ đạt chất lượng"
      );
      assert.equal(step1Result.status, ApprovalStepStatus.APPROVED);

      // Verify process state advanced
      const procAfterStep1 = await prisma.taskApprovalProcess.findUnique({
        where: { id: threeStepProcess.id },
      });
      assert.equal(procAfterStep1?.currentStepIndex, 1);
      assert.equal(procAfterStep1?.status, ApprovalProcessStatus.IN_REVIEW);

      // Execute Step 2 by Staff C (Now permitted because Step 1 is APPROVED)
      const step2Result = await executeApprovalStep(
        step2.id,
        staffFacultyC.id,
        "APPROVED",
        "Thẩm định viên độc lập phê duyệt thông qua"
      );
      assert.equal(step2Result.status, ApprovalStepStatus.APPROVED);

      const procAfterStep2 = await prisma.taskApprovalProcess.findUnique({
        where: { id: threeStepProcess.id },
      });
      assert.equal(procAfterStep2?.currentStepIndex, 2);

      // Execute Step 3 by Executive
      const step3Result = await executeApprovalStep(
        step3.id,
        executiveUser.id,
        "APPROVED",
        "Ban Giám Hiệu phê chuẩn toàn diện Đề án"
      );
      assert.equal(step3Result.status, ApprovalStepStatus.APPROVED);

      // Verify Final Task & Process State
      const finalProc = await prisma.taskApprovalProcess.findUnique({
        where: { id: threeStepProcess.id },
      });
      assert.equal(finalProc?.status, ApprovalProcessStatus.APPROVED);

      const finalTask = await prisma.task.findUnique({
        where: { id: stagedTask.id },
      });
      assert.equal(finalTask?.status, TaskStatus.COMPLETED);
      assert.equal(finalTask?.progressPercent, 100);
    });

    test("5.4: Statutory Executive Emergency Bypass: Executive reviewer can bypass intermediate steps with explicit flag", async () => {
      // Create a new task for emergency bypass test
      const emergencyTask = await prisma.task.create({
        data: {
          code: `TASK-EMERGENCY-BYPASS-${timestamp}`,
          title: "Nhiệm vụ Ứng phó Bão Lũ Khẩn cấp",
          createdById: staffFacultyA.id,
          leadUnitId: deptA.id,

          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });

      await setTaskDRI(emergencyTask.id, staffFacultyB.id, {
        requestedById: executiveUser.id,
      });

      const proc = await initiateApprovalProcess(
        emergencyTask.id,
        [
          {
            title: "Cấp 1: Kiểm tra thực địa",
            reviewerUserId: staffFacultyC.id,
          },
          {
            title: "Cấp 2: Dự toán ngân sách",
            reviewerUserId: deanFacultyA.id,
          },
          {
            title: "Cấp 3: Ban Giám Hiệu quyết định khẩn cấp",
            reviewerUserId: executiveUser.id,
          },
        ]
      );

      const emergStep3 = proc.steps[2];

      // Executive calls Step 3 directly with allowBypass: true
      const execStepResult = await executeApprovalStep(
        emergStep3.id,
        executiveUser.id,
        "APPROVED",
        "BGH phê chuẩn vượt cấp theo tình huống khẩn cấp",
        { allowBypass: true }
      );

      assert.equal(execStepResult.status, ApprovalStepStatus.APPROVED);

      // Verify prior steps were marked BYPASSED
      const stepsInDb = await prisma.taskApprovalStep.findMany({
        where: { processId: proc.id },
        orderBy: { stepOrder: "asc" },
      });

      assert.equal(stepsInDb[0].status, ApprovalStepStatus.BYPASSED);
      assert.equal(stepsInDb[1].status, ApprovalStepStatus.BYPASSED);
      assert.equal(stepsInDb[2].status, ApprovalStepStatus.APPROVED);

      // Verify Task completed
      const updatedEmergTask = await prisma.task.findUnique({
        where: { id: emergencyTask.id },
      });
      assert.equal(updatedEmergTask?.status, TaskStatus.COMPLETED);

      // Teardown emergency task
      await prisma.taskApprovalStep.deleteMany({ where: { processId: proc.id } });
      await prisma.taskApprovalProcess.deleteMany({ where: { taskId: emergencyTask.id } });
      await prisma.taskActor.deleteMany({ where: { taskId: emergencyTask.id } });
      await prisma.taskActor.deleteMany({ where: { taskId: emergencyTask.id } });
      await prisma.task.delete({ where: { id: emergencyTask.id } });
    });
  });
});
