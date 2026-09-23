import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import {
  TaskStatus,
  TaskActorRole,
  UserRole,
  DeliverableReviewStatus,
} from "@prisma/client";

// Import route handlers
import { PATCH as taskPatchRoute } from "../src/app/api/tasks/[id]/route";
import { POST as startRoute } from "../src/app/api/tasks/[id]/actions/start/route";
import { POST as updateProgressRoute } from "../src/app/api/tasks/[id]/actions/update-progress/route";
import { POST as submitResultRoute } from "../src/app/api/tasks/[id]/actions/submit-result/route";
import { POST as reviewRoute } from "../src/app/api/tasks/[id]/actions/review/route";
import { POST as requestRevisionRoute } from "../src/app/api/tasks/[id]/actions/request-revision/route";
import { POST as approveRoute } from "../src/app/api/tasks/[id]/actions/approve/route";
import { POST as reassignRoute } from "../src/app/api/tasks/[id]/actions/reassign/route";
import { POST as remindRoute } from "../src/app/api/tasks/[id]/actions/remind/route";
import { POST as cancelRoute } from "../src/app/api/tasks/[id]/actions/cancel/route";

describe("Phase 4B: Task Domain Commands & State Separation APIs", () => {
  let dept: any;
  let orgUnit: any;
  let creatorUser: any;
  let driUser: any;
  let newDriUser: any;
  let collaboratorUser: any;
  let unitHeadUser: any;
  let executiveUser: any;

  let creatorToken: string;
  let driToken: string;
  let newDriToken: string;
  let collaboratorToken: string;
  let unitHeadToken: string;
  let executiveToken: string;

  let testTask: any;
  const createdTaskIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAssignmentIds: string[] = [];

  function makeRequest(
    url: string,
    body: Record<string, any>,
    token?: string
  ): NextRequest {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    };
    if (token) {
      headers["cookie"] = `${SESSION_COOKIE_NAME}=${token}`;
    }
    return new NextRequest(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  before(async () => {
    const timestamp = Date.now();

    // 1. Get or create department and organizational unit
    dept = await prisma.organizationalUnit.findFirst();
    if (!dept) {
      dept = await prisma.organizationalUnit.create({
        data: {
          id: `dept_${timestamp}`,
          name: "Phòng Quản lý Đào tạo",
          shortName: "QLDT",
        },
      });
    }

    orgUnit = await prisma.organizationalUnit.findFirst({
      where: { code: "P_QLDT" },
    });
    if (!orgUnit) {
      orgUnit = await prisma.organizationalUnit.create({
        data: {
          code: `UNIT_${timestamp}`,
          name: "Phòng Quản lý Đào tạo (Test)",
          type: "DEPARTMENT",
        },
      });
    }

    // 2. Position definitions (ensure canonical code)
    let posDeptHeadDef = await prisma.positionDefinition.findUnique({
      where: { code: "TRUONG_PHONG" },
    });
    if (!posDeptHeadDef) {
      posDeptHeadDef = await prisma.positionDefinition.create({
        data: {
          code: "TRUONG_PHONG",
          title: "Trưởng phòng",
          group: "LDPU",
          isLeadership: true,
        },
      });
    }

    let posHeadDef = await prisma.positionDefinition.findUnique({
      where: { code: "TRUONG_DON_VI" },
    });
    if (!posHeadDef) {
      posHeadDef = await prisma.positionDefinition.create({
        data: {
          code: "TRUONG_DON_VI",
          title: "Trưởng đơn vị",
          group: "LDPU",
          isLeadership: true,
        },
      });
    }

    let posExecDef = await prisma.positionDefinition.findUnique({
      where: { code: "HIEU_TRUONG" },
    });
    if (!posExecDef) {
      posExecDef = await prisma.positionDefinition.create({
        data: {
          code: "HIEU_TRUONG",
          title: "Hiệu trưởng",
          group: "LDPU",
          isLeadership: true,
        },
      });
    }

    // 3. Create users
    creatorUser = await prisma.user.create({
      data: {
        name: "Người Giao Việc (Trưởng phòng) Test",
        email: `creator_${timestamp}@qcet.edu.vn`,
        role: UserRole.TRUONG_PHONG,
        departmentId: dept.id,
      },
    });
    createdUserIds.push(creatorUser.id);

    const assignCreator = await prisma.positionAssignment.create({
      data: {
        userId: creatorUser.id,
        positionDefinitionId: posDeptHeadDef.id,
        unitId: orgUnit.id,
        status: "ACTIVE",
      },
    });
    createdAssignmentIds.push(assignCreator.id);

    driUser = await prisma.user.create({
      data: {
        name: "Cán Bộ Chủ Trì (DRI) Test",
        email: `dri_${timestamp}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,
        departmentId: dept.id,
      },
    });
    createdUserIds.push(driUser.id);

    newDriUser = await prisma.user.create({
      data: {
        name: "Cán Bộ Chủ Trì Mới Test",
        email: `newdri_${timestamp}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,
        departmentId: dept.id,
      },
    });
    createdUserIds.push(newDriUser.id);

    collaboratorUser = await prisma.user.create({
      data: {
        name: "Cán Bộ Phối Hợp Test",
        email: `collab_${timestamp}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,
        departmentId: dept.id,
      },
    });
    createdUserIds.push(collaboratorUser.id);

    unitHeadUser = await prisma.user.create({
      data: {
        name: "Trưởng Đơn Vị Test",
        email: `unithead_${timestamp}@qcet.edu.vn`,
        role: UserRole.TRUONG_PHONG,
        departmentId: dept.id,
      },
    });
    createdUserIds.push(unitHeadUser.id);

    const assignHead = await prisma.positionAssignment.create({
      data: {
        userId: unitHeadUser.id,
        positionDefinitionId: posHeadDef.id,
        unitId: orgUnit.id,
        status: "ACTIVE",
      },
    });
    createdAssignmentIds.push(assignHead.id);

    executiveUser = await prisma.user.create({
      data: {
        name: "Ban Giám Hiệu Test",
        email: `exec_${timestamp}@qcet.edu.vn`,
        role: UserRole.BAN_GIAM_HIEU,
      },
    });
    createdUserIds.push(executiveUser.id);

    const assignExec = await prisma.positionAssignment.create({
      data: {
        userId: executiveUser.id,
        positionDefinitionId: posExecDef.id,
        unitId: orgUnit.id,
        status: "ACTIVE",
      },
    });
    createdAssignmentIds.push(assignExec.id);

    // Generate JWT tokens
    creatorToken = signSessionToken({
      id: creatorUser.id,
      email: creatorUser.email,
      name: creatorUser.name,
      role: creatorUser.role,
      departmentId: creatorUser.departmentId,
      title: "TRUONG_PHONG",
    });

    driToken = signSessionToken({
      id: driUser.id,
      email: driUser.email,
      name: driUser.name,
      role: driUser.role,
      departmentId: driUser.departmentId,
    });

    newDriToken = signSessionToken({
      id: newDriUser.id,
      email: newDriUser.email,
      name: newDriUser.name,
      role: newDriUser.role,
      departmentId: newDriUser.departmentId,
    });

    collaboratorToken = signSessionToken({
      id: collaboratorUser.id,
      email: collaboratorUser.email,
      name: collaboratorUser.name,
      role: collaboratorUser.role,
      departmentId: collaboratorUser.departmentId,
    });

    unitHeadToken = signSessionToken({
      id: unitHeadUser.id,
      email: unitHeadUser.email,
      name: unitHeadUser.name,
      role: unitHeadUser.role,
      departmentId: unitHeadUser.departmentId,
      title: "TRUONG_DON_VI",
    });

    executiveToken = signSessionToken({
      id: executiveUser.id,
      email: executiveUser.email,
      name: executiveUser.name,
      role: executiveUser.role,
      title: "HIEU_TRUONG",
    });

    // 4. Create test task
    testTask = await prisma.task.create({
      data: {
        code: `TASK-CMD-${timestamp}`,
        title: "Nhiệm vụ kiểm thử Task Domain Commands",
        createdById: creatorUser.id,
        leadUnitId: orgUnit.id,
        departmentId: dept.id,
        academicMonth: 9,
        academicYear: "2026-2027",
        dueDate: new Date(Date.now() + 86400000),
        status: TaskStatus.IN_PROGRESS,
      },
    });
    createdTaskIds.push(testTask.id);

    // Setup actors: Assigner, DRI, Collaborator
    await prisma.taskActor.create({
      data: {
        taskId: testTask.id,
        userId: creatorUser.id,
        role: TaskActorRole.ASSIGNER,
        isPrimaryDRI: false,
      },
    });

    await prisma.taskActor.create({
      data: {
        taskId: testTask.id,
        userId: driUser.id,
        role: TaskActorRole.DRI,
        isPrimaryDRI: true,
      },
    });

    await prisma.taskActor.create({
      data: {
        taskId: testTask.id,
        userId: collaboratorUser.id,
        role: TaskActorRole.COLLABORATOR,
        isPrimaryDRI: false,
      },
    });
  });

  after(async () => {
    // Cleanup tasks and relations
    if (createdTaskIds.length > 0) {
      await prisma.taskResult.deleteMany({ where: { taskId: { in: createdTaskIds } } });
      await prisma.taskDeliverable.deleteMany({ where: { taskId: { in: createdTaskIds } } });
      await prisma.taskActor.deleteMany({ where: { taskId: { in: createdTaskIds } } });
      // taskAssignee table dropped in Phase 9 — actors handle this now
      await prisma.taskApprovalStep.deleteMany({
        where: { process: { taskId: { in: createdTaskIds } } },
      });
      await prisma.taskApprovalProcess.deleteMany({ where: { taskId: { in: createdTaskIds } } });
      await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
    }

    if (createdAssignmentIds.length > 0) {
      await prisma.positionAssignment.deleteMany({ where: { id: { in: createdAssignmentIds } } });
    }

    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  // ==========================================================================
  // Command 1: submit-result
  // ==========================================================================
  describe("1. Command: submit-result", () => {
    test("rejects unauthenticated request with 401", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/submit-result`,
        { summary: "Báo cáo hoàn thành" }
      );
      const res = await submitResultRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    test("rejects invalid payload (empty summary and title) with 400", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/submit-result`,
        { summary: "" },
        driToken
      );
      const res = await submitResultRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.code, "VALIDATION_ERROR");
    });

    test("DRI submits result -> creates TaskResult, deliverable, and transitions status to WAITING_APPROVAL", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/submit-result`,
        {
          summary: "Đã hoàn thành dự thảo chương trình đào tạo",
          reportUrl: "https://example.com/bao-cao.pdf",
          title: "Dự thảo chương trình",
          fileUrl: "https://example.com/bao-cao.pdf",
          fileType: "PDF",
        },
        driToken
      );
      const res = await submitResultRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.taskStatus, TaskStatus.WAITING_APPROVAL);
      assert.ok(body.data.taskResult.id);
      assert.ok(body.data.deliverable.id);

      // Verify DB state
      const updatedTask = await prisma.task.findUnique({
        where: { id: testTask.id },
      });
      assert.equal(updatedTask?.status, TaskStatus.WAITING_APPROVAL);

      // Verify Outbox Event created
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: testTask.id,
          eventType: "DELIVERABLE_SUBMITTED_NOTIFICATION",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(outbox, "Outbox event for deliverable submission must exist");
    });

    test("rejects submission on COMPLETED task with 409 Conflict", async () => {
      // Temporarily mark task COMPLETED
      await prisma.task.update({
        where: { id: testTask.id },
        data: { status: TaskStatus.COMPLETED },
      });

      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/submit-result`,
        {
          summary: "Cố tình nộp khi đã hoàn thành",
        },
        driToken
      );
      const res = await submitResultRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 409);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.code, "INVALID_TRANSITION");

      // Restore task status
      await prisma.task.update({
        where: { id: testTask.id },
        data: { status: TaskStatus.WAITING_APPROVAL },
      });
    });
  });

  // ==========================================================================
  // Command 2: review & Maker-Checker Invariant
  // ==========================================================================
  describe("2. Command: review & Maker-Checker / SoD Invariants", () => {
    test("Maker-Checker: Submitter/DRI cannot review own submission (403 Forbidden)", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/review`,
        {
          decision: "APPROVED",
          reviewStatus: "APPROVED",
          note: "Tôi tự duyệt bài của tôi",
        },
        driToken // Submitter attempts self-review
      );
      const res = await reviewRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.code, "SOD_VIOLATION");
    });

    test("Creator / Assigner can review deliverable and approve", async () => {
      const deliverable = await prisma.taskDeliverable.findFirst({
        where: { taskId: testTask.id },
      });
      assert.ok(deliverable);

      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/review`,
        {
          deliverableId: deliverable.id,
          reviewStatus: "APPROVED",
          decision: "APPROVED",
          note: "Minh chứng đạt yêu cầu chuyên môn",
        },
        creatorToken
      );
      const res = await reviewRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.reviewStatus, "APPROVED");

      // Verify deliverable status in DB
      const updatedDeliverable = await prisma.taskDeliverable.findUnique({
        where: { id: deliverable.id },
      });
      assert.equal(updatedDeliverable?.reviewStatus, DeliverableReviewStatus.APPROVED);
    });
  });

  // ==========================================================================
  // Command 3: request-revision
  // ==========================================================================
  describe("3. Command: request-revision", () => {
    test("requires reason in payload (400 if missing)", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/request-revision`,
        { reason: "" },
        creatorToken
      );
      const res = await requestRevisionRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.code, "VALIDATION_ERROR");
    });

    test("DRI cannot request revision from self (403 SoD)", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/request-revision`,
        { reason: "Tự thấy chưa được" },
        driToken
      );
      const res = await requestRevisionRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.code, "SOD_VIOLATION");
    });

    test("Assigner requests revision -> task reverts to IN_PROGRESS", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/request-revision`,
        {
          reason: "Cần bổ sung ma trận kỹ năng chi tiết theo chuẩn DACUM",
        },
        creatorToken
      );
      const res = await requestRevisionRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.status, TaskStatus.IN_PROGRESS);

      // Verify task in DB is back to IN_PROGRESS
      const updated = await prisma.task.findUnique({ where: { id: testTask.id } });
      assert.equal(updated?.status, TaskStatus.IN_PROGRESS);

      // Verify outbox notification emitted
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: testTask.id,
          eventType: "TASK_REJECTED_NOTIFICATION",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(outbox);

      // Verify approval processes are marked REJECTED
      const rejectedProcesses = await prisma.taskApprovalProcess.findMany({
        where: { taskId: testTask.id },
      });
      for (const proc of rejectedProcesses) {
        assert.equal(proc.status, "REJECTED");
      }
    });
  });

  // ==========================================================================
  // Command 4: approve & SoD Invariants
  // ==========================================================================
  describe("4. Command: approve & SoD Invariants", () => {
    test("Creator cannot approve own task (Rule 4.1 Creator != Approver) -> 403", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/approve`,
        { note: "Tôi tự duyệt nhiệm vụ tôi tạo" },
        creatorToken
      );
      const res = await approveRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.code, "SOD_VIOLATION");
    });

    test("DRI cannot approve own task (Rule 4.1 DRI != Approver) -> 403", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/approve`,
        { note: "Tôi là DRI và tôi tự duyệt" },
        driToken
      );
      const res = await approveRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.code, "SOD_VIOLATION");
    });

    test("Unit Head approves task -> status COMPLETED, progress 100%", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/approve`,
        { note: "Đồng ý phê duyệt hoàn thành nhiệm vụ theo báo cáo thẩm định." },
        unitHeadToken
      );
      const res = await approveRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.status, TaskStatus.COMPLETED);
      assert.equal(data.data.progressPercent, 100);

      // Verify DB state
      const taskInDb = await prisma.task.findUnique({ where: { id: testTask.id } });
      assert.equal(taskInDb?.status, TaskStatus.COMPLETED);
      assert.equal(taskInDb?.progressPercent, 100);
      assert.ok(taskInDb?.completedAt);

      // Verify Outbox Event created
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: testTask.id,
          eventType: "TASK_APPROVED_NOTIFICATION",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(outbox);
    });
  });

  // ==========================================================================
  // Command 5: reassign & Single DRI Invariant
  // ==========================================================================
  describe("5. Command: reassign & Single DRI Invariant", () => {
    test("Collaborator cannot reassign DRI (Single DRI Rule) -> 403 Forbidden", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/reassign`,
        {
          newAssigneeId: newDriUser.id,
          role: "DRI",
        },
        collaboratorToken // Collaborator tries to reassign
      );
      const res = await reassignRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.code, "COLLABORATOR_CANNOT_REASSIGN_DRI");
    });

    test("Assigner/Manager reassigns DRI -> old DRI demoted, new DRI appointed", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/reassign`,
        {
          newAssigneeId: newDriUser.id,
          role: "DRI",
          note: "Điều chuyển trách nhiệm chủ trì sang cán bộ mới",
        },
        creatorToken
      );
      const res = await reassignRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.newAssigneeId, newDriUser.id);

      // Verify old DRI was demoted to COLLABORATOR
      const oldDriActor = await prisma.taskActor.findFirst({
        where: { taskId: testTask.id, userId: driUser.id },
      });
      assert.equal(oldDriActor?.role, TaskActorRole.COLLABORATOR);
      assert.equal(oldDriActor?.isPrimaryDRI, false);

      // Verify new DRI is appointed
      const newDriActor = await prisma.taskActor.findFirst({
        where: { taskId: testTask.id, userId: newDriUser.id },
      });
      assert.equal(newDriActor?.role, TaskActorRole.DRI);
      assert.equal(newDriActor?.isPrimaryDRI, true);

      // Verify Outbox Event created
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: testTask.id,
          eventType: "TASK_ASSIGNED_NOTIFICATION",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(outbox);
    });

    test("rejects invalid role with 400 Validation Error", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/reassign`,
        {
          newAssigneeId: newDriUser.id,
          role: "COLLABORATOR",
        },
        creatorToken
      );
      const res = await reassignRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.code, "VALIDATION_ERROR");
    });
  });

  // ==========================================================================
  // Command 6: remind
  // ==========================================================================
  describe("6. Command: remind", () => {
    test("Assigner / participant dispatches reminder to task members", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}/actions/remind`,
        {
          message: "Đề nghị khẩn trương rà soát tài liệu trước hạn 17h00",
          urgency: "URGENT",
        },
        creatorToken
      );
      const res = await remindRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.urgency, "URGENT");
      assert.ok(data.data.recipientCount > 0);
      assert.ok(
        !data.data.recipientIds.includes(creatorUser.id),
        "Remind recipient list must not include the caller"
      );

      // Verify Outbox reminder event
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: testTask.id,
          eventType: "TASK_REMINDER_NOTIFICATION",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(outbox);
      assert.equal((outbox.payload as any).urgency, "URGENT");
    });
  });

  // ==========================================================================
  // Merged from task-v2-commands.test.ts: PATCH Hardening, start, update-progress, cancel
  // ==========================================================================
  describe("7. Generic PATCH Hardening & Additional Canonical Actions", () => {
    test("rejects PATCH status mutation with 400 and CANONICAL_COMMAND_REQUIRED", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}`,
        { status: "IN_PROGRESS" },
        creatorToken
      );

      const res = await taskPatchRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.strictEqual(res.status, 400);

      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, "CANONICAL_COMMAND_REQUIRED");
      assert.match(json.error, /Cấm cập nhật trực tiếp trạng thái.*canonical domain action/);
    });

    test("rejects PATCH approved or resolution manipulation with 400", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}`,
        { approved: true, resolution: "COMPLETED" },
        creatorToken
      );

      const res = await taskPatchRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.strictEqual(res.status, 400);

      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, "CANONICAL_COMMAND_REQUIRED");
    });

    test("allows safe metadata update (title, description, priority, dueDate)", async () => {
      const newDueDate = new Date(Date.now() + 86400000 * 14).toISOString();

      const req = makeRequest(
        `http://localhost:3000/api/tasks/${testTask.id}`,
        {
          title: "Tiêu đề đã cập nhật an toàn qua PATCH",
          description: "Mô tả mới an toàn",
          priority: "HIGH",
          dueDate: newDueDate,
        },
        creatorToken
      );

      const res = await taskPatchRoute(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test("POST /api/tasks/[id]/actions/start transitions task to IN_PROGRESS", async () => {
      // Create a fresh fixture task in NOT_STARTED
      const startTask = await prisma.task.create({
        data: {
          code: `NV-START-${Date.now()}`,
          title: "Nhiệm vụ kiểm thử action start",
          status: TaskStatus.NOT_STARTED,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000 * 5),
          departmentId: dept.id,
          createdById: creatorUser.id,
          actors: {
            create: {
              userId: driUser.id,
              role: TaskActorRole.DRI,
              isPrimaryDRI: true,
              assignedById: creatorUser.id,
            },
          },
        },
      });
      createdTaskIds.push(startTask.id);

      const req = makeRequest(
        `http://localhost:3000/api/tasks/${startTask.id}/actions/start`,
        { note: "Bắt đầu triển khai nhiệm vụ" },
        driToken
      );

      const res = await startRoute(req, { params: Promise.resolve({ id: startTask.id }) });
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);

      const dbTask = await prisma.task.findUnique({ where: { id: startTask.id } });
      assert.strictEqual(dbTask?.status, TaskStatus.IN_PROGRESS);
    });

    test("POST /api/tasks/[id]/actions/update-progress updates progress percent", async () => {
      const progressTask = await prisma.task.create({
        data: {
          code: `NV-PROG-${Date.now()}`,
          title: "Nhiệm vụ kiểm thử update progress",
          status: TaskStatus.IN_PROGRESS,
          progressPercent: 10,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000 * 5),
          departmentId: dept.id,
          createdById: creatorUser.id,
          actors: {
            create: {
              userId: driUser.id,
              role: TaskActorRole.DRI,
              isPrimaryDRI: true,
              assignedById: creatorUser.id,
            },
          },
        },
      });
      createdTaskIds.push(progressTask.id);

      const req = makeRequest(
        `http://localhost:3000/api/tasks/${progressTask.id}/actions/update-progress`,
        {
          progressPercent: 55,
          note: "Đã hoàn thành phân tích yêu cầu",
        },
        driToken
      );

      const res = await updateProgressRoute(req, { params: Promise.resolve({ id: progressTask.id }) });
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);

      const dbTask = await prisma.task.findUnique({ where: { id: progressTask.id } });
      assert.strictEqual(dbTask?.progressPercent, 55);
    });

    test("POST /api/tasks/[id]/actions/cancel cancels the task", async () => {
      const cancelTask = await prisma.task.create({
        data: {
          code: `NV-CANCEL-${Date.now()}`,
          title: "Nhiệm vụ kiểm thử action cancel",
          status: TaskStatus.NOT_STARTED,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000 * 5),
          departmentId: dept.id,
          createdById: creatorUser.id,
          actors: {
            create: {
              userId: driUser.id,
              role: TaskActorRole.DRI,
              isPrimaryDRI: true,
              assignedById: creatorUser.id,
            },
          },
        },
      });
      createdTaskIds.push(cancelTask.id);

      const req = makeRequest(
        `http://localhost:3000/api/tasks/${cancelTask.id}/actions/cancel`,
        { reason: "Kế hoạch thay đổi theo chỉ đạo mới" },
        creatorToken
      );

      const res = await cancelRoute(req, { params: Promise.resolve({ id: cancelTask.id }) });
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);

      const dbTask = await prisma.task.findUnique({ where: { id: cancelTask.id } });
      assert.strictEqual(dbTask?.status, TaskStatus.CANCELLED);
    });
  });
});
