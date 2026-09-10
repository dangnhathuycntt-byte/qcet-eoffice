import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  setTaskDRI,
  addTaskCollaborator,
  addTaskObserver,
  getTaskActors,
  validateSingleDRI,
  submitTaskResult,
  verifyTaskResult,
  initiateApprovalProcess,
  executeApprovalStep,
} from "../src/lib/services/task-actor-service";
import { migrateTaskRelations } from "../prisma/seeds/migrate-task-relations";
import {
  TaskActorRole,
  TaskStatus,
  ApprovalProcessStatus,
  ApprovalStepStatus,
  UserRole,
} from "@prisma/client";

describe("Phase 5.2 & 5.3: Task Actor Service & ReBAC Authorization Engine", () => {
  let executiveUser: any;
  let departmentHeadUser: any;
  let creatorUser: any;
  let initialDriUser: any;
  let newDriUser: any;
  let collaboratorUser: any;
  let independentReviewerUser: any;
  let orgUnit: any;
  let testTask: any;

  before(async () => {
    // 1. Create or retrieve test organizational unit
    orgUnit = await prisma.organizationalUnit.findFirst({
      where: { code: "P_QLDT" },
    });
    if (!orgUnit) {
      orgUnit = await prisma.organizationalUnit.create({
        data: {
          code: "P_QLDT_TEST",
          name: "Phòng Quản lý Đào tạo (Test)",
          type: "DEPARTMENT",
        },
      });
    }

    // 2. Create test users with different roles
    const timestamp = Date.now();
    executiveUser = await prisma.user.create({
      data: {
        name: "Ban Giám Hiệu Test",
        email: `exec_${timestamp}@qcet.edu.vn`,
        role: UserRole.BAN_GIAM_HIEU,
      },
    });

    departmentHeadUser = await prisma.user.create({
      data: {
        name: "Trưởng phòng QLĐT Test",
        email: `depthead_${timestamp}@qcet.edu.vn`,
        role: UserRole.TRUONG_PHONG,
      },
    });

    creatorUser = await prisma.user.create({
      data: {
        name: "Người giao việc Test",
        email: `creator_${timestamp}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,
      },
    });

    initialDriUser = await prisma.user.create({
      data: {
        name: "Cán bộ chủ trì 1",
        email: `dri1_${timestamp}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,
      },
    });

    newDriUser = await prisma.user.create({
      data: {
        name: "Cán bộ chủ trì 2",
        email: `dri2_${timestamp}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,
      },
    });

    collaboratorUser = await prisma.user.create({
      data: {
        name: "Cán bộ phối hợp Test",
        email: `collab_${timestamp}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,
      },
    });

    independentReviewerUser = await prisma.user.create({
      data: {
        name: "Cán bộ kiểm thử độc lập",
        email: `reviewer_${timestamp}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,
      },
    });

    // Create a position assignment for departmentHeadUser to make them head of orgUnit
    const posDef = await prisma.positionDefinition.create({
      data: {
        code: `HEAD_${timestamp}`,
        title: "Trưởng đơn vị Test",
        group: "LDPU",
        isLeadership: true,
      },
    });

    await prisma.positionAssignment.create({
      data: {
        userId: departmentHeadUser.id,
        positionDefinitionId: posDef.id,
        unitId: orgUnit.id,
        status: "ACTIVE",
      },
    });

    // 3. Create test task
    testTask = await prisma.task.create({
      data: {
        code: `TEST-TASK-${timestamp}`,
        title: "Nhiệm vụ kiểm thử ReBAC Actor Service",
        createdById: creatorUser.id,
        leadUnitId: orgUnit.id,
        academicMonth: 9,
        academicYear: "2026-2027",
        dueDate: new Date(Date.now() + 86400000),
      },
    });

    // Set initial ASSIGNER actor
    await prisma.taskActor.create({
      data: {
        taskId: testTask.id,
        userId: creatorUser.id,
        role: TaskActorRole.ASSIGNER,
        isPrimaryDRI: false,
      },
    });

    // Set initial LEAD_UNIT actor
    await prisma.taskActor.create({
      data: {
        taskId: testTask.id,
        unitId: orgUnit.id,
        role: TaskActorRole.LEAD_UNIT,
        isPrimaryDRI: false,
      },
    });
  });

  after(async () => {
    // Cleanup created test records
    if (testTask) {
      await prisma.taskResult.deleteMany({ where: { taskId: testTask.id } });
      await prisma.taskApprovalStep.deleteMany({
        where: { process: { taskId: testTask.id } },
      });
      await prisma.taskApprovalProcess.deleteMany({
        where: { taskId: testTask.id },
      });
      await prisma.taskActor.deleteMany({ where: { taskId: testTask.id } });
      await prisma.task.delete({ where: { id: testTask.id } });
    }

    const testUsers = [
      executiveUser,
      departmentHeadUser,
      creatorUser,
      initialDriUser,
      newDriUser,
      collaboratorUser,
      independentReviewerUser,
    ].filter(Boolean);

    for (const u of testUsers) {
      await prisma.positionAssignment.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
  });

  test("1. Single DRI Invariant & Initial Appointment by Assigner", async () => {
    // Assigner appoints initial DRI
    const driActor = await setTaskDRI(
      testTask.id,
      initialDriUser.id,
      { requestedById: creatorUser.id },
      orgUnit.id
    );

    assert.equal(driActor.role, TaskActorRole.DRI);
    assert.equal(driActor.isPrimaryDRI, true);
    assert.equal(driActor.userId, initialDriUser.id);

    const isValid = await validateSingleDRI(testTask.id);
    assert.equal(isValid, true, "Task must have exactly 1 primary DRI");
  });

  test("2. Collaborator cannot reassign DRI (Forbidden 403)", async () => {
    // Add collaborator first
    await addTaskCollaborator(testTask.id, collaboratorUser.id, {
      requestedById: creatorUser.id,
    });

    // Attempt reassign by collaborator should be rejected
    await assert.rejects(
      async () => {
        await setTaskDRI(
          testTask.id,
          newDriUser.id,
          { requestedById: collaboratorUser.id },
          orgUnit.id
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes("Collaborators cannot reassign DRI") ||
            err.message.includes("không có quyền"),
          `Expected authorization rejection, got: ${err.message}`
        );
        return true;
      }
    );
  });

  test("3. Single DRI Invariant: Reassigning DRI demotes old DRI to Collaborator", async () => {
    // Department Head reassigns DRI to newDriUser
    const newDriActor = await setTaskDRI(
      testTask.id,
      newDriUser.id,
      { requestedById: departmentHeadUser.id },
      orgUnit.id
    );

    assert.equal(newDriActor.userId, newDriUser.id);
    assert.equal(newDriActor.isPrimaryDRI, true);

    // Old DRI should now be COLLABORATOR and not primary
    const oldDriActor = await prisma.taskActor.findFirst({
      where: {
        taskId: testTask.id,
        userId: initialDriUser.id,
      },
    });

    assert.ok(oldDriActor);
    assert.equal(oldDriActor.role, TaskActorRole.COLLABORATOR);
    assert.equal(oldDriActor.isPrimaryDRI, false);

    const isValid = await validateSingleDRI(testTask.id);
    assert.equal(isValid, true, "Single DRI invariant must hold after reassignment");
  });

  test("4. getTaskActors retrieves structured actors", async () => {
    await addTaskObserver(testTask.id, independentReviewerUser.id, {
      requestedById: creatorUser.id,
    });

    const actors = await getTaskActors(testTask.id);
    assert.ok(actors.assigner, "Must have assigner");
    assert.equal(actors.assigner.userId, creatorUser.id);

    assert.ok(actors.leadUnit, "Must have leadUnit");
    assert.equal(actors.leadUnit.unitId, orgUnit.id);

    assert.ok(actors.dri, "Must have primary DRI");
    assert.equal(actors.dri.userId, newDriUser.id);

    assert.ok(actors.collaborators.length >= 1, "Must have collaborator");
    assert.ok(actors.observers.length >= 1, "Must have observer");
  });

  test("5. Maker-Checker Invariant on Task Results: Verifier != Submitter", async () => {
    const result = await submitTaskResult(testTask.id, newDriUser.id, {
      summary: "Đã hoàn thành dự thảo chương trình đào tạo",
      reportUrl: "https://qcet.edu.vn/reports/draft-curriculum.pdf",
    });

    assert.equal(result.submittedByUserId, newDriUser.id);
    assert.equal(result.verifiedByUserId, null);

    // Attempt self-verification by submitter must be rejected
    await assert.rejects(
      async () => {
        await verifyTaskResult(result.id, newDriUser.id);
      },
      (err: any) => {
        assert.ok(
          err.message.includes("Maker-Checker violation") ||
            err.message.includes("Người nộp và người duyệt"),
          `Expected Maker-Checker rejection, got: ${err.message}`
        );
        return true;
      }
    );

    // Independent reviewer can verify
    const verified = await verifyTaskResult(
      result.id,
      independentReviewerUser.id
    );
    assert.equal(verified.verifiedByUserId, independentReviewerUser.id);
    assert.ok(verified.verifiedAt);
  });

  test("6. Approval Process & SoD: Task Creator and DRI cannot approve own task", async () => {
    // Initiate approval process
    const process = await initiateApprovalProcess(testTask.id, [
      {
        title: "Trưởng đơn vị phê duyệt",
        reviewerUserId: departmentHeadUser.id,
      },
      {
        title: "Ban Giám Hiệu phê duyệt cuối cùng",
        reviewerUserId: executiveUser.id,
      },
    ]);

    assert.equal(process.totalSteps, 2);
    assert.equal(process.status, ApprovalProcessStatus.IN_REVIEW);

    const step1 = process.steps[0];

    // SoD check: Task DRI (newDriUser) attempts to approve step 1 -> REJECT
    await assert.rejects(
      async () => {
        await executeApprovalStep(
          step1.id,
          newDriUser.id,
          "APPROVED",
          "Tự duyệt bởi DRI"
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes("Segregation of Duties (SoD) violation") ||
            err.message.includes("không được phép tự duyệt"),
          `Expected SoD rejection, got: ${err.message}`
        );
        return true;
      }
    );

    // SoD check: Task Creator (creatorUser) attempts to approve step 1 -> REJECT
    await assert.rejects(
      async () => {
        await executeApprovalStep(
          step1.id,
          creatorUser.id,
          "APPROVED",
          "Tự duyệt bởi Creator"
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes("Segregation of Duties (SoD) violation") ||
            err.message.includes("không được phép tự duyệt"),
          `Expected SoD rejection, got: ${err.message}`
        );
        return true;
      }
    );

    // Step 1: Authorized department head approves
    const approvedStep1 = await executeApprovalStep(
      step1.id,
      departmentHeadUser.id,
      "APPROVED",
      "Đồng ý thông qua cấp Khoa/Phòng"
    );
    assert.equal(approvedStep1.status, ApprovalStepStatus.APPROVED);

    // Step 2: Final approval by Executive
    const step2 = process.steps[1];
    const approvedStep2 = await executeApprovalStep(
      step2.id,
      executiveUser.id,
      "APPROVED",
      "Ban Giám Hiệu phê chuẩn nghiệm thu"
    );
    assert.equal(approvedStep2.status, ApprovalStepStatus.APPROVED);

    // Verify task is marked completed
    const completedTask = await prisma.task.findUnique({
      where: { id: testTask.id },
    });
    assert.equal(completedTask?.status, TaskStatus.COMPLETED);
    assert.equal(completedTask?.progressPercent, 100);
  });

  test("7. migrateTaskRelations backfill is idempotent", async () => {
    const summary1 = await migrateTaskRelations(prisma);
    assert.ok(summary1.totalTasks > 0, "Must have processed tasks");

    // Second run should result in 0 new creations
    const summary2 = await migrateTaskRelations(prisma);
    assert.equal(summary2.driCreatedOrUpdated, 0, "Idempotent: 0 DRI created on second run");
    assert.equal(summary2.assignerCreated, 0, "Idempotent: 0 ASSIGNER created on second run");
    assert.equal(summary2.leadUnitCreated, 0, "Idempotent: 0 LEAD_UNIT created on second run");
  });
});
