import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import {
  TaskStatus,
  TaskActorRole,
  UserRole,
  TaskScope,
  TaskPriority,
  UnitType,
  JobCatalogGroup,
} from "@prisma/client";

// Import Route Handlers
import { PATCH as taskPatchRoute } from "../src/app/api/tasks/[id]/route";
import { POST as startRoute } from "../src/app/api/tasks/[id]/actions/start/route";
import { POST as updateProgressRoute } from "../src/app/api/tasks/[id]/actions/update-progress/route";
import { POST as submitResultRoute } from "../src/app/api/tasks/[id]/actions/submit-result/route";
import { POST as requestRevisionRoute } from "../src/app/api/tasks/[id]/actions/request-revision/route";
import { POST as approveRoute } from "../src/app/api/tasks/[id]/actions/approve/route";
import { POST as reassignRoute } from "../src/app/api/tasks/[id]/actions/reassign/route";
import { POST as cancelRoute } from "../src/app/api/tasks/[id]/actions/cancel/route";

describe("Sprint 4: Canonical Task V2 Commands & Single Primary DRI Cutover", () => {
  let dept: any;
  let orgUnit: any;
  let creatorUser: any;
  let driUser: any;
  let secondUser: any;
  let rectorUser: any;

  let creatorToken: string;
  let driToken: string;
  let secondUserToken: string;
  let rectorToken: string;

  const createdTaskIds: string[] = [];
  const createdUserIds: string[] = [];

  function makeRequest(
    method: "POST" | "PATCH",
    url: string,
    body: Record<string, any>,
    token?: string
  ): NextRequest {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      origin: "http://localhost",
      host: "localhost",
    };
    if (token) {
      headers["cookie"] = `${SESSION_COOKIE_NAME}=${token}`;
    }
    return new NextRequest(url, {
      method,
      headers,
      body: JSON.stringify(body),
    });
  }

  before(async () => {
    const timestamp = Date.now();

    // 1. Department and OrgUnit
    dept = await prisma.department.findFirst();
    if (!dept) {
      dept = await prisma.department.create({
        data: {
          id: `dept_v2_${timestamp}`,
          name: "Phòng Quản trị V2",
          shortName: "QTV2",
        },
      });
    }

    orgUnit = await prisma.organizationalUnit.findFirst();
    if (!orgUnit) {
      orgUnit = await prisma.organizationalUnit.create({
        data: {
          id: `org_v2_${timestamp}`,
          name: "Phòng Quản trị V2",
          code: `OU_V2_${timestamp}`,
          type: UnitType.DEPARTMENT,
        },
      });
    }

    // 2. Position Definition
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

    // 3. Users
    creatorUser = await prisma.user.create({
      data: {
        name: "Lãnh đạo Tạo Nhiệm Vụ",
        email: `creator_${timestamp}@qcet.edu.vn`,
        role: UserRole.TRUONG_PHONG,
        departmentId: dept.id,
      },
    });
    createdUserIds.push(creatorUser.id);

    await prisma.positionAssignment.create({
      data: {
        userId: creatorUser.id,
        positionDefinitionId: posDeptHeadDef.id,
        unitId: orgUnit.id,
        status: "ACTIVE",
      },
    });

    driUser = await prisma.user.create({
      data: {
        name: "Người Chịu Trách Nhiệm DRI",
        email: `dri_${timestamp}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,
        departmentId: dept.id,
      },
    });
    createdUserIds.push(driUser.id);

    secondUser = await prisma.user.create({
      data: {
        name: "Người Thay Thế DRI",
        email: `sec_${timestamp}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,
        departmentId: dept.id,
      },
    });
    createdUserIds.push(secondUser.id);

    let posRectorDef = await prisma.positionDefinition.findUnique({
      where: { code: "HIEU_TRUONG" },
    });
    if (!posRectorDef) {
      posRectorDef = await prisma.positionDefinition.create({
        data: {
          code: "HIEU_TRUONG",
          title: "Hiệu trưởng",
          group: JobCatalogGroup.LDPU,
          isLeadership: true,
        },
      });
    }

    rectorUser = await prisma.user.create({
      data: {
        name: "Hiệu Trưởng Nhà Trường",
        email: `rector_${timestamp}@qcet.edu.vn`,
        role: UserRole.BAN_GIAM_HIEU,
        departmentId: dept.id,
      },
    });
    createdUserIds.push(rectorUser.id);

    await prisma.positionAssignment.create({
      data: {
        userId: rectorUser.id,
        positionDefinitionId: posRectorDef.id,
        unitId: orgUnit.id,
        status: "ACTIVE",
      },
    });

    creatorToken = signSessionToken({
      id: creatorUser.id,
      email: creatorUser.email,
      name: creatorUser.name,
      role: creatorUser.role,
      departmentId: creatorUser.departmentId,
    });

    driToken = signSessionToken({
      id: driUser.id,
      email: driUser.email,
      name: driUser.name,
      role: driUser.role,
      departmentId: driUser.departmentId,
    });

    secondUserToken = signSessionToken({
      id: secondUser.id,
      email: secondUser.email,
      name: secondUser.name,
      role: secondUser.role,
      departmentId: secondUser.departmentId,
    });

    rectorToken = signSessionToken({
      id: rectorUser.id,
      email: rectorUser.email,
      name: rectorUser.name,
      role: rectorUser.role,
      departmentId: rectorUser.departmentId,
    });
  });

  after(async () => {
    if (createdTaskIds.length > 0) {
      await prisma.auditEvent.deleteMany({
        where: { entityId: { in: createdTaskIds } },
      });
      await prisma.taskActor.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.taskAssignee.deleteMany({
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
      await prisma.positionAssignment.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  async function createFixtureTask(status: TaskStatus = TaskStatus.NOT_STARTED) {
    const timestamp = Date.now();
    const rand = crypto.randomUUID().slice(0, 8);
    const task = await prisma.task.create({
      data: {
        id: `task_test_${timestamp}_${rand}`,
        code: `NV-2026-09-${rand}`,
        title: `Nhiệm vụ kiểm thử V2 ${timestamp}`,
        description: "Mô tả ban đầu cho kiểm thử V2",
        status,
        scope: TaskScope.DEPARTMENT,
        priority: TaskPriority.NORMAL,
        dueDate: new Date(Date.now() + 86400000 * 7),
        academicMonth: 9,
        academicYear: "2026-2027",
        departmentId: dept.id,
        createdById: creatorUser.id,
        assignees: {
          create: {
            userId: driUser.id,
          },
        },
        actors: {
          create: {
            userId: driUser.id,
            role: TaskActorRole.DRI,
            isPrimaryDRI: true,
            unitId: orgUnit.id,
            assignedById: creatorUser.id,
          },
        },
      },
    });
    createdTaskIds.push(task.id);
    return task;
  }

  describe("1. Generic PATCH /api/tasks/[id] Hardening", () => {
    test("rejects PATCH status mutation with 400 and CANONICAL_COMMAND_REQUIRED", async () => {
      const task = await createFixtureTask(TaskStatus.NOT_STARTED);
      const req = makeRequest(
        "PATCH",
        `http://localhost/api/tasks/${task.id}`,
        { status: "IN_PROGRESS" },
        creatorToken
      );

      const res = await taskPatchRoute(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 400);

      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, "CANONICAL_COMMAND_REQUIRED");
      assert.match(json.error, /Cấm cập nhật trực tiếp trạng thái.*canonical domain action/);
    });

    test("rejects PATCH approved or resolution manipulation with 400", async () => {
      const task = await createFixtureTask(TaskStatus.NOT_STARTED);
      const req = makeRequest(
        "PATCH",
        `http://localhost/api/tasks/${task.id}`,
        { approved: true, resolution: "COMPLETED" },
        creatorToken
      );

      const res = await taskPatchRoute(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 400);

      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, "CANONICAL_COMMAND_REQUIRED");
    });

    test("allows safe metadata update (title, description, priority, dueDate)", async () => {
      const task = await createFixtureTask(TaskStatus.NOT_STARTED);
      const newDueDate = new Date(Date.now() + 86400000 * 14).toISOString();

      const req = makeRequest(
        "PATCH",
        `http://localhost/api/tasks/${task.id}`,
        {
          title: "Tiêu đề đã cập nhật an toàn qua PATCH",
          description: "Mô tả mới an toàn",
          priority: "HIGH",
          dueDate: newDueDate,
        },
        creatorToken
      );

      const res = await taskPatchRoute(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.title, "Tiêu đề đã cập nhật an toàn qua PATCH");
      assert.strictEqual(json.data.description, "Mô tả mới an toàn");
      assert.strictEqual(json.data.priority, "HIGH");

      // Verify in DB
      const updated = await prisma.task.findUnique({ where: { id: task.id } });
      assert.strictEqual(updated?.title, "Tiêu đề đã cập nhật an toàn qua PATCH");
      assert.strictEqual(updated?.priority, "HIGH");
    });
  });

  describe("2. Canonical Domain Commands", () => {
    test("POST /api/tasks/[id]/actions/start transitions task to IN_PROGRESS", async () => {
      const task = await createFixtureTask(TaskStatus.NOT_STARTED);
      const req = makeRequest(
        "POST",
        `http://localhost/api/tasks/${task.id}/actions/start`,
        { note: "Bắt đầu triển khai nhiệm vụ" },
        driToken
      );

      const res = await startRoute(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.status, TaskStatus.IN_PROGRESS);

      const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.strictEqual(dbTask?.status, TaskStatus.IN_PROGRESS);
    });

    test("POST /api/tasks/[id]/actions/update-progress updates progress percent and note", async () => {
      const task = await createFixtureTask(TaskStatus.IN_PROGRESS);
      const req = makeRequest(
        "POST",
        `http://localhost/api/tasks/${task.id}/actions/update-progress`,
        { progressPercent: 65, note: "Đã hoàn thành 65% khối lượng công việc" },
        driToken
      );

      const res = await updateProgressRoute(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.progressPercent, 65);

      const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.strictEqual(dbTask?.progressPercent, 65);
    });

    test("POST /api/tasks/[id]/actions/submit-result submits deliverable and waits approval", async () => {
      const task = await createFixtureTask(TaskStatus.IN_PROGRESS);
      const req = makeRequest(
        "POST",
        `http://localhost/api/tasks/${task.id}/actions/submit-result`,
        {
          title: "Báo cáo tổng kết đợt 1",
          content: "Chi tiết các hạng mục đã hoàn thành đầy đủ",
          completionRate: 100,
        },
        driToken
      );

      const res = await submitResultRoute(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);

      const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.strictEqual(
        dbTask?.status,
        TaskStatus.WAITING_APPROVAL,
        `Expected status WAITING_APPROVAL, got ${dbTask?.status}`
      );
    });

    test("POST /api/tasks/[id]/actions/request-revision transitions task to IN_PROGRESS / REVISION", async () => {
      const task = await createFixtureTask(TaskStatus.WAITING_APPROVAL);
      // Create deliverable
      await prisma.taskDeliverable.create({
        data: {
          taskId: task.id,
          title: "Sản phẩm chờ duyệt",
          uploadedById: driUser.id,
          reviewStatus: "PENDING",
          fileUrl: "https://example.com/file1.pdf",
        },
      });

      const req = makeRequest(
        "POST",
        `http://localhost/api/tasks/${task.id}/actions/request-revision`,
        {
          reason: "Cần bổ sung số liệu phụ lục 2",
        },
        creatorToken
      );

      const res = await requestRevisionRoute(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);

      const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.strictEqual(dbTask?.status, TaskStatus.IN_PROGRESS);
    });

    test("POST /api/tasks/[id]/actions/approve completes the task", async () => {
      const task = await createFixtureTask(TaskStatus.WAITING_APPROVAL);
      await prisma.taskDeliverable.create({
        data: {
          taskId: task.id,
          title: "Sản phẩm chuẩn bị nghiệm thu",
          uploadedById: driUser.id,
          reviewStatus: "PENDING",
          fileUrl: "https://example.com/file2.pdf",
        },
      });

      const req = makeRequest(
        "POST",
        `http://localhost/api/tasks/${task.id}/actions/approve`,
        { note: "Nghiệm thu đạt yêu cầu" },
        rectorToken
      );

      const res = await approveRoute(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);

      const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.strictEqual(dbTask?.status, TaskStatus.COMPLETED);
    });

    test("POST /api/tasks/[id]/actions/cancel cancels the task", async () => {
      const task = await createFixtureTask(TaskStatus.NOT_STARTED);
      const req = makeRequest(
        "POST",
        `http://localhost/api/tasks/${task.id}/actions/cancel`,
        { reason: "Kế hoạch thay đổi theo chỉ đạo mới" },
        creatorToken
      );

      const res = await cancelRoute(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);

      const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.strictEqual(dbTask?.status, TaskStatus.CANCELLED);
    });
  });

  describe("3. Single Primary DRI Invariant", () => {
    test("reassign enforces Single Primary DRI in TaskActor and TaskAssignee", async () => {
      const task = await createFixtureTask(TaskStatus.NOT_STARTED);

      // Initially driUser is primary DRI
      const initialActors = await prisma.taskActor.findMany({ where: { taskId: task.id } });
      assert.strictEqual(initialActors.length, 1);
      assert.strictEqual(initialActors[0].userId, driUser.id);
      assert.strictEqual(initialActors[0].isPrimaryDRI, true);

      // Reassign to secondUser
      const req = makeRequest(
        "POST",
        `http://localhost/api/tasks/${task.id}/actions/reassign`,
        {
          newAssigneeId: secondUser.id,
          reason: "Bàn giao nhiệm vụ cho cán bộ phụ trách mới",
        },
        creatorToken
      );

      const res = await reassignRoute(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);

      // Verify exactly one isPrimaryDRI = true in TaskActor
      const actorsAfter = await prisma.taskActor.findMany({ where: { taskId: task.id } });
      const primaryDris = actorsAfter.filter((a) => a.isPrimaryDRI);
      assert.strictEqual(primaryDris.length, 1, "Must have exactly one primary DRI");
      assert.strictEqual(primaryDris[0].userId, secondUser.id);

      // Previous DRI is demoted to COLLABORATOR or removed from primary
      const oldDri = actorsAfter.find((a) => a.userId === driUser.id);
      if (oldDri) {
        assert.strictEqual(oldDri.isPrimaryDRI, false);
      }
    });

    test("collaborator cannot submit result if not DRI (Maker-Checker / DRI ownership)", async () => {
      const task = await createFixtureTask(TaskStatus.IN_PROGRESS);

      // Attempt to submit result using secondUserToken (who is NOT the DRI)
      const req = makeRequest(
        "POST",
        `http://localhost/api/tasks/${task.id}/actions/submit-result`,
        {
          title: "Cố tình nộp thay DRI",
          completionRate: 100,
        },
        secondUserToken
      );

      const res = await submitResultRoute(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 403);

      const json = await res.json();
      assert.strictEqual(json.success, false);
    });
  });
});
