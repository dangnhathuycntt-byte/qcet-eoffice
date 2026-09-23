import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import {
  TaskStatus,
  TaskActorRole,
  UserRole,
  TaskScope,
} from "@prisma/client";
import {
  taskStateMachine,
  buildActorContext,
  buildTaskContext,
  getStatusLabel,
} from "../src/domain/tasks/state-machine";
import { POST as updateStatusRoute } from "../src/app/api/tasks/[id]/actions/update-status/route";
import { POST as submitResultRoute } from "../src/app/api/tasks/[id]/actions/submit-result/route";
import { POST as startRoute } from "../src/app/api/tasks/[id]/actions/start/route";

describe("Task Status Transition Flow & Command Separation Test Suite", () => {
  let dept: any;
  let adminUser: any;
  let bghUser: any;
  let managerUser: any;
  let staffUser: any;
  let makerUser: any;

  let adminToken: string;
  let bghToken: string;
  let managerToken: string;
  let staffToken: string;
  let makerToken: string;

  const createdTaskIds: string[] = [];
  const createdUserIds: string[] = [];

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

    // 1. Get or create department
    dept = await prisma.organizationalUnit.findFirst();
    if (!dept) {
      dept = await prisma.organizationalUnit.create({
        data: {
          id: `dept_st_${timestamp}`,
          name: "Phòng Hành chính - Tổng hợp",
,
        },
      });
    }

    // 2. Create users
    adminUser = await prisma.user.create({
      data: {
        id: `u_admin_${timestamp}`,
        email: `admin_${timestamp}@qcet.edu.vn`,
        name: "Quản trị viên Hệ thống",
        role: UserRole.ADMIN,
        passwordHash: "hashed_password",

      },
    });
    createdUserIds.push(adminUser.id);
    adminToken = await signSessionToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,

    });

    bghUser = await prisma.user.create({
      data: {
        id: `u_bgh_${timestamp}`,
        email: `bgh_${timestamp}@qcet.edu.vn`,
        name: "Hiệu trưởng",
        role: UserRole.BAN_GIAM_HIEU,
        passwordHash: "hashed_password",
      },
    });
    createdUserIds.push(bghUser.id);
    bghToken = await signSessionToken({
      id: bghUser.id,
      email: bghUser.email,
      name: bghUser.name,
      role: bghUser.role,

    });

    managerUser = await prisma.user.create({
      data: {
        id: `u_mgr_${timestamp}`,
        email: `mgr_${timestamp}@qcet.edu.vn`,
        name: "Trưởng phòng HCTH",
        role: UserRole.TRUONG_PHONG,
        passwordHash: "hashed_password",

      },
    });
    createdUserIds.push(managerUser.id);
    managerToken = await signSessionToken({
      id: managerUser.id,
      email: managerUser.email,
      name: managerUser.name,
      role: managerUser.role,

    });

    staffUser = await prisma.user.create({
      data: {
        id: `u_staff_${timestamp}`,
        email: `staff_${timestamp}@qcet.edu.vn`,
        name: "Chuyên viên Nghiệp vụ",
        role: UserRole.CHUYEN_VIEN,
        passwordHash: "hashed_password",

      },
    });
    createdUserIds.push(staffUser.id);
    staffToken = await signSessionToken({
      id: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      role: staffUser.role,

    });

    makerUser = await prisma.user.create({
      data: {
        id: `u_maker_${timestamp}`,
        email: `maker_${timestamp}@qcet.edu.vn`,
        name: "Chuyên viên Thực hiện Chính (DRI)",
        role: UserRole.CHUYEN_VIEN,
        passwordHash: "hashed_password",

      },
    });
    createdUserIds.push(makerUser.id);
    makerToken = await signSessionToken({
      id: makerUser.id,
      email: makerUser.email,
      name: makerUser.name,
      role: makerUser.role,

    });
  });

  after(async () => {
    // Cleanup created test records
    if (createdTaskIds.length > 0) {
      await prisma.auditEvent.deleteMany({
        where: { entityId: { in: createdTaskIds } },
      });
      await prisma.outboxEvent.deleteMany({
        where: { aggregateId: { in: createdTaskIds } },
      });
      await prisma.taskActor.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.taskResult.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.taskDeliverable.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
    }

    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  // ==========================================================================
  // Section 1: Domain State Machine Unit Tests
  // ==========================================================================
  describe("1. Domain State Machine Transition Matrix", () => {
    const sampleTask = {
      id: "task_domain_test",
      scope: "DEPARTMENT",
      createdById: "u_mgr_1",

      primaryOwnerId: "u_maker_1",
      assigneeIds: ["u_maker_1"],
    };

    const staffActor = buildActorContext({ id: "u_staff_1", role: "STAFF", departmentId: "dept_1" });
    const managerActor = buildActorContext({ id: "u_mgr_1", role: "TRUONG_PHONG", departmentId: "dept_1" });
    const bghActor = buildActorContext({ id: "u_bgh_1", role: "BAN_GIAM_HIEU" });
    const makerActor = buildActorContext({ id: "u_maker_1", role: "STAFF", departmentId: "dept_1" });

    it("allows NOT_STARTED -> IN_PROGRESS", () => {
      const res = taskStateMachine.canTransition(staffActor, sampleTask, "NOT_STARTED", "IN_PROGRESS");
      assert.strictEqual(res.allowed, true);
    });

    it("rejects NOT_STARTED -> WAITING_APPROVAL with INVALID_TRANSITION", () => {
      const res = taskStateMachine.canTransition(staffActor, sampleTask, "NOT_STARTED", "WAITING_APPROVAL");
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, "INVALID_TRANSITION");
    });

    it("rejects NOT_STARTED -> COMPLETED with INVALID_TRANSITION", () => {
      const res = taskStateMachine.canTransition(managerActor, sampleTask, "NOT_STARTED", "COMPLETED");
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, "INVALID_TRANSITION");
    });

    it("allows IN_PROGRESS -> WAITING_APPROVAL", () => {
      const res = taskStateMachine.canTransition(staffActor, sampleTask, "IN_PROGRESS", "WAITING_APPROVAL");
      assert.strictEqual(res.allowed, true);
    });

    it("rejects IN_PROGRESS -> NOT_STARTED with INVALID_TRANSITION", () => {
      const res = taskStateMachine.canTransition(staffActor, sampleTask, "IN_PROGRESS", "NOT_STARTED");
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, "INVALID_TRANSITION");
    });

    it("rejects IN_PROGRESS -> COMPLETED directly without approval", () => {
      const res = taskStateMachine.canTransition(managerActor, sampleTask, "IN_PROGRESS", "COMPLETED");
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, "INVALID_TRANSITION");
    });

    it("allows WAITING_APPROVAL -> COMPLETED by Unit Manager (non-maker)", () => {
      const res = taskStateMachine.canTransition(managerActor, sampleTask, "WAITING_APPROVAL", "COMPLETED");
      assert.strictEqual(res.allowed, true);
    });

    it("rejects WAITING_APPROVAL -> COMPLETED by Maker (DRI) with MAKER_CANNOT_BE_CHECKER", () => {
      const res = taskStateMachine.canTransition(makerActor, sampleTask, "WAITING_APPROVAL", "COMPLETED");
      assert.strictEqual(res.allowed, false);
      assert.strictEqual(res.code, "MAKER_CANNOT_BE_CHECKER");
    });

    it("allows WAITING_APPROVAL -> IN_PROGRESS (rejection / rework request) by Manager", () => {
      const res = taskStateMachine.canTransition(managerActor, sampleTask, "WAITING_APPROVAL", "IN_PROGRESS");
      assert.strictEqual(res.allowed, true);
    });

    it("allows Executive to reopen COMPLETED -> IN_PROGRESS", () => {
      const res = taskStateMachine.canTransition(bghActor, sampleTask, "COMPLETED", "IN_PROGRESS");
      assert.strictEqual(res.allowed, true);
    });

    it("prohibits Staff / Manager from reopening COMPLETED -> IN_PROGRESS", () => {
      const staffRes = taskStateMachine.canTransition(staffActor, sampleTask, "COMPLETED", "IN_PROGRESS");
      assert.strictEqual(staffRes.allowed, false);
      assert.strictEqual(staffRes.code, "TERMINAL_STATE_LOCKED");

      const mgrRes = taskStateMachine.canTransition(managerActor, sampleTask, "COMPLETED", "IN_PROGRESS");
      assert.strictEqual(mgrRes.allowed, false);
      assert.strictEqual(mgrRes.code, "TERMINAL_STATE_LOCKED");
    });

    it("prohibits transition from COMPLETED to non-IN_PROGRESS status (e.g. WAITING_APPROVAL, NOT_STARTED)", () => {
      const res1 = taskStateMachine.canTransition(bghActor, sampleTask, "COMPLETED", "WAITING_APPROVAL");
      assert.strictEqual(res1.allowed, false);
      assert.strictEqual(res1.code, "TERMINAL_STATE_LOCKED");

      const res2 = taskStateMachine.canTransition(bghActor, sampleTask, "COMPLETED", "NOT_STARTED");
      assert.strictEqual(res2.allowed, false);
      assert.strictEqual(res2.code, "TERMINAL_STATE_LOCKED");
    });

    it("getAllowedTransitions returns accurate permissions map for all canonical statuses", () => {
      const allowed = taskStateMachine.getAllowedTransitions(staffActor, sampleTask, "NOT_STARTED");
      const inProgressOpt = allowed.find((a) => a.status === "IN_PROGRESS");
      const completedOpt = allowed.find((a) => a.status === "COMPLETED");

      assert.strictEqual(inProgressOpt?.allowed, true);
      assert.strictEqual(completedOpt?.allowed, false);
    });
  });

  // ==========================================================================
  // Section 2: Command Separation Tests (submitResult vs updateStatus)
  // ==========================================================================
  describe("2. Command Separation: submitResult vs updateStatus", () => {
    let completedTask: any;

    before(async () => {
      const ts = Date.now();
      completedTask = await prisma.task.create({
        data: {
          id: `task_completed_${ts}`,
          code: `TSK-COMP-${ts}`,
          title: "Nhiệm vụ đã hoàn thành",
          status: TaskStatus.COMPLETED,
          scope: TaskScope.DEPARTMENT,
          progressPercent: 100,
          createdById: managerUser.id,

          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
          version: 1,
        },
      });
      createdTaskIds.push(completedTask.id);
    });

    it("submitResult on COMPLETED task rejects with 'Không thể nộp kết quả cho nhiệm vụ đã hoàn thành'", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${completedTask.id}/actions/submit-result`,
        { summary: "Báo cáo nộp thêm", title: "Minh chứng" },
        staffToken
      );
      const res = await submitResultRoute(req, {
        params: Promise.resolve({ id: completedTask.id }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 409);
      assert.match(data.error, /Không thể nộp kết quả cho nhiệm vụ đã hoàn thành/);
    });

    it("updateStatus on COMPLETED task to WAITING_APPROVAL rejects with TERMINAL_STATE_LOCKED without mentioning submit-result", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${completedTask.id}/actions/update-status`,
        { status: "WAITING_APPROVAL", note: "Thử đổi sang Chờ duyệt" },
        adminToken
      );
      const res = await updateStatusRoute(req, {
        params: Promise.resolve({ id: completedTask.id }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 409);
      assert.strictEqual(data.code, "TERMINAL_STATE_LOCKED");
      assert.doesNotMatch(data.error, /nộp kết quả/);
    });

    it("Executive successfully reopens COMPLETED task -> IN_PROGRESS via updateStatus", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${completedTask.id}/actions/update-status`,
        { status: "IN_PROGRESS", note: "Ban Giám hiệu mở lại nhiệm vụ để bổ sung nội dung" },
        bghToken
      );
      const res = await updateStatusRoute(req, {
        params: Promise.resolve({ id: completedTask.id }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.status, TaskStatus.IN_PROGRESS);

      const dbTask = await prisma.task.findUnique({ where: { id: completedTask.id } });
      assert.strictEqual(dbTask?.status, TaskStatus.IN_PROGRESS);
      assert.strictEqual(dbTask?.completedAt, null);
    });
  });

  // ==========================================================================
  // Section 3: API Integration & Lifecycle Progression Tests
  // ==========================================================================
  describe("3. API Integration: Full Status Lifecycle Progression", () => {
    let lifecycleTask: any;

    before(async () => {
      const ts = Date.now();
      lifecycleTask = await prisma.task.create({
        data: {
          id: `task_life_${ts}`,
          code: `TSK-LIFE-${ts}`,
          title: "Nhiệm vụ chu trình vòng đời",
          status: TaskStatus.NOT_STARTED,
          scope: TaskScope.DEPARTMENT,
          progressPercent: 0,
          createdById: managerUser.id,

          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
          version: 1,
        },
      });
      createdTaskIds.push(lifecycleTask.id);

      await prisma.taskActor.create({
        data: {
          taskId: lifecycleTask.id,
          userId: makerUser.id,
          roleInTask: "PRIMARY_OWNER",
        },
      });
    });

    it("Step 1: Start task (NOT_STARTED -> IN_PROGRESS) via update-status", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${lifecycleTask.id}/actions/update-status`,
        { status: "IN_PROGRESS", note: "Bắt đầu thực hiện" },
        staffToken
      );
      const res = await updateStatusRoute(req, {
        params: Promise.resolve({ id: lifecycleTask.id }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.data.status, TaskStatus.IN_PROGRESS);

      // Verify DB and single audit event
      const dbTask = await prisma.task.findUnique({ where: { id: lifecycleTask.id } });
      assert.strictEqual(dbTask?.status, TaskStatus.IN_PROGRESS);

      const audits = await prisma.auditEvent.findMany({
        where: { entityId: lifecycleTask.id, action: "TASK_STATUS_CHANGED" },
      });
      assert.strictEqual(audits.length, 1);
      assert.match(String((audits[0].afterData as any)?.triggerReason), /Chuyển trạng thái từ "Mới" sang "Đang thực hiện"/);
    });

    it("Step 2: Submit for approval (IN_PROGRESS -> WAITING_APPROVAL) via update-status", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${lifecycleTask.id}/actions/update-status`,
        { status: "WAITING_APPROVAL", note: "Hoàn tất công việc, gửi duyệt" },
        makerToken
      );
      const res = await updateStatusRoute(req, {
        params: Promise.resolve({ id: lifecycleTask.id }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.data.status, TaskStatus.WAITING_APPROVAL);
      assert.strictEqual(data.data.progressPercent, 100);
    });

    it("Step 3: Maker (DRI) cannot self-approve WAITING_APPROVAL -> COMPLETED", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${lifecycleTask.id}/actions/update-status`,
        { status: "COMPLETED", note: "Tự phê duyệt" },
        makerToken
      );
      const res = await updateStatusRoute(req, {
        params: Promise.resolve({ id: lifecycleTask.id }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 409);
      assert.strictEqual(data.code, "MAKER_CANNOT_BE_CHECKER");
    });

    it("Step 4: Unit Head approves WAITING_APPROVAL -> COMPLETED", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${lifecycleTask.id}/actions/update-status`,
        { status: "COMPLETED", note: "Trưởng phòng nghiệm thu hoàn thành" },
        managerToken
      );
      const res = await updateStatusRoute(req, {
        params: Promise.resolve({ id: lifecycleTask.id }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.data.status, TaskStatus.COMPLETED);
      assert.strictEqual(data.data.progressPercent, 100);

      const dbTask = await prisma.task.findUnique({ where: { id: lifecycleTask.id } });
      assert.strictEqual(dbTask?.status, TaskStatus.COMPLETED);
      assert.notStrictEqual(dbTask?.completedAt, null);
    });

    it("Step 5: OCC Concurrency - Rejects update when expectedVersion does not match", async () => {
      const req = makeRequest(
        `http://localhost:3000/api/tasks/${lifecycleTask.id}/actions/update-status`,
        { status: "IN_PROGRESS", expectedVersion: 999 },
        bghToken
      );
      const res = await updateStatusRoute(req, {
        params: Promise.resolve({ id: lifecycleTask.id }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 412);
      assert.strictEqual(data.code, "PRECONDITION_FAILED");
    });
  });
});
