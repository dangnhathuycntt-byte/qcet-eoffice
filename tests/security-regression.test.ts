import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as getDocs, POST as postDocs } from "../src/app/api/documents/route";
import { GET as getDocById, PATCH as patchDocById } from "../src/app/api/documents/[id]/route";
import { GET as exportExcel } from "../src/app/api/documents/export-excel/route";
import { GET as downloadDoc } from "../src/app/api/documents/download/route";
import { PATCH as patchTask, DELETE as deleteTask } from "../src/app/api/tasks/[id]/route";
import { POST as postDirective } from "../src/app/api/documents/[id]/directives/route";
import { GET as getNetworkInfo } from "../src/app/api/system/network-info/route";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import { prisma } from "../src/lib/prisma";

function createTestToken(payload: { id: string; role: string; departmentId?: string; name?: string; email?: string }) {
  return signSessionToken({
    id: payload.id,
    role: payload.role,
    departmentId: payload.departmentId,
    name: payload.name || "Test User",
    email: payload.email || `${payload.id}@qcet.edu.vn`,
  });
}

describe("Task 1: Security & Session Binding on Document Endpoints", () => {
  it("GET /api/documents returns 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3001/api/documents");
    const res = await getDocs(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /Unauthorized|Đăng nhập/i);
  });

  it("POST /api/documents returns 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3001/api/documents", {
      method: "POST",
      body: JSON.stringify({ title: "Test Doc", type: "VAN_BAN_DEN" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postDocs(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /Unauthorized|Đăng nhập/i);
  });

  it("GET /api/documents/[id] returns 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3001/api/documents/doc-123");
    const res = await getDocById(req, { params: Promise.resolve({ id: "doc-123" }) });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /Unauthorized|Đăng nhập/i);
  });

  it("PATCH /api/documents/[id] returns 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3001/api/documents/doc-123", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated Title" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await patchDocById(req, { params: Promise.resolve({ id: "doc-123" }) });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /Unauthorized|Đăng nhập/i);
  });

  it("GET /api/documents/export-excel returns 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3001/api/documents/export-excel?type=VAN_BAN_DEN");
    const res = await exportExcel(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /Unauthorized|Đăng nhập/i);
  });

  it("GET /api/documents/download returns 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3001/api/documents/download?file=docs/report.pdf");
    const res = await downloadDoc(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /Unauthorized|Đăng nhập/i);
  });

  it("POST /api/documents overwrites registeredById with session.id (anti-spoofing)", async () => {
    // Find or fallback to a real user in db
    const user = await prisma.user.findFirst();
    assert.ok(user, "User should exist in db");

    const token = signSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const fakeAttackerId = "spoofed-attacker-user-id";
    const req = new NextRequest("http://localhost:3001/api/documents", {
      method: "POST",
      body: JSON.stringify({
        type: "VAN_BAN_DEN",
        originalNumber: "SEC-TEST-001",
        issuedDate: new Date().toISOString(),
        issuingAuthority: "Bộ GD&ĐT",
        category: "Quyết định",
        summary: "Văn bản thử nghiệm chống mạo danh registeredById",
        urgency: "THUONG",
        securityLevel: "THUONG",
        registeredById: fakeAttackerId, // Attempted spoof
      }),
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3001",
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await postDocs(req);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.registeredById, user.id);
    assert.notEqual(body.data.registeredById, fakeAttackerId);

    // Cleanup
    if (body.data?.id) {
      await prisma.document.delete({ where: { id: body.data.id } });
    }
  });

  it("GET /api/documents succeeds when authenticated", async () => {
    const user = await prisma.user.findFirst();
    assert.ok(user, "User should exist in db");

    const token = signSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const req = new NextRequest("http://localhost:3001/api/documents?limit=5", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const res = await getDocs(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
  });
});

describe("Task 2: Task BOLA/IDOR & Directive Role Enforcement", () => {
  before(async () => {
    // Setup test departments
    await prisma.department.upsert({
      where: { id: "dept-daotao" },
      update: {},
      create: { id: "dept-daotao", name: "Phòng Đào tạo (Test)" },
    });
    await prisma.department.upsert({
      where: { id: "dept-cntt" },
      update: {},
      create: { id: "dept-cntt", name: "Khoa CNTT (Test)" },
    });

    // Setup test users
    await prisma.user.upsert({
      where: { id: "user-creator-1" },
      update: {},
      create: {
        id: "user-creator-1",
        email: "creator1@test.com",
        name: "Creator User",
        role: "TRUONG_PHONG",
        departmentId: "dept-daotao",
      },
    });
    await prisma.user.upsert({
      where: { id: "user-assignee" },
      update: {},
      create: {
        id: "user-assignee",
        email: "assignee@test.com",
        name: "Assignee User",
        role: "CHUYEN_VIEN",
        departmentId: "dept-cntt",
      },
    });
    await prisma.user.upsert({
      where: { id: "user-cntt" },
      update: {},
      create: {
        id: "user-cntt",
        email: "user-cntt@test.com",
        name: "CNTT User",
        role: "CHUYEN_VIEN",
        departmentId: "dept-cntt",
      },
    });
    await prisma.user.upsert({
      where: { id: "user-lead-cntt" },
      update: {},
      create: {
        id: "user-lead-cntt",
        email: "lead-cntt@test.com",
        name: "CNTT Lead",
        role: "TRUONG_PHONG",
        departmentId: "dept-cntt",
      },
    });
    await prisma.user.upsert({
      where: { id: "user-bgh" },
      update: {},
      create: {
        id: "user-bgh",
        email: "bgh@test.com",
        name: "BGH User",
        role: "BAN_GIAM_HIEU",
      },
    });

    // Setup test tasks
    await prisma.task.upsert({
      where: { id: "task-daotao-1" },
      update: {},
      create: {
        id: "task-daotao-1",
        code: "TASK-DAOTAO-TEST-1",
        title: "Nhiệm vụ đào tạo",
        status: "IN_PROGRESS",
        priority: "NORMAL",
        departmentId: "dept-daotao",
        createdById: "user-creator-1",
        dueDate: new Date("2026-10-01"),
        academicMonth: 9,
        academicYear: "2026-2027",
      },
    });

    await prisma.task.upsert({
      where: { id: "task-cntt-1" },
      update: {},
      create: {
        id: "task-cntt-1",
        code: "TASK-CNTT-TEST-1",
        title: "Nhiệm vụ CNTT",
        status: "IN_PROGRESS",
        priority: "NORMAL",
        departmentId: "dept-cntt",
        createdById: "user-creator-1",
        dueDate: new Date("2026-10-01"),
        academicMonth: 9,
        academicYear: "2026-2027",
        assignees: {
          create: {
            userId: "user-assignee",
            roleInTask: "PRIMARY_OWNER",
          },
        },
      },
    });
  });

  after(async () => {
    const ephemeralUserIds = ["user-creator-1", "user-assignee", "user-cntt", "user-lead-cntt", "user-bgh"];
    await prisma.taskAssignee.deleteMany({
      where: {
        OR: [
          { taskId: { in: ["task-daotao-1", "task-cntt-1", "task-temp-delete-creator", "task-temp-delete-bgh"] } },
          { task: { createdById: { in: ephemeralUserIds } } },
          { userId: { in: ephemeralUserIds } },
        ],
      },
    });
    await prisma.task.deleteMany({
      where: {
        OR: [
          { id: { in: ["task-daotao-1", "task-cntt-1", "task-temp-delete-creator", "task-temp-delete-bgh"] } },
          { createdById: { in: ephemeralUserIds } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: ephemeralUserIds } },
    });
    await prisma.department.deleteMany({
      where: { id: { in: ["dept-daotao", "dept-cntt"] } },
    });
  });

  it("PATCH /api/tasks/[id] returns 403 when user belongs to different department and is not assigned", async () => {
    // Giả lập token của GIANG_VIEN thuộc Khoa CNTT
    const token = createTestToken({ id: "user-cntt", role: "GIANG_VIEN", departmentId: "dept-cntt" });
    const req = new NextRequest("http://localhost:3001/api/tasks/task-daotao-1", {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Hacked Task Title" }),
    });
    // Task thuộc Phòng Đào tạo, user-cntt không tham gia
    const res = await patchTask(req, { params: Promise.resolve({ id: "task-daotao-1" }) });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /không có quyền|Forbidden/i);
  });

  it("PATCH /api/tasks/[id] allows task creator to update task", async () => {
    const token = createTestToken({ id: "user-creator-1", role: "TRUONG_PHONG", departmentId: "dept-daotao" });
    const req = new NextRequest("http://localhost:3001/api/tasks/task-daotao-1", {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Updated by creator" }),
    });
    const res = await patchTask(req, { params: Promise.resolve({ id: "task-daotao-1" }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.title, "Updated by creator");
  });

  it("PATCH /api/tasks/[id] allows assigned user to update task", async () => {
    const token = createTestToken({ id: "user-assignee", role: "CHUYEN_VIEN", departmentId: "dept-cntt" });
    const req = new NextRequest("http://localhost:3001/api/tasks/task-cntt-1", {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description: "Updated description by assignee" }),
    });
    const res = await patchTask(req, { params: Promise.resolve({ id: "task-cntt-1" }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.description, "Updated description by assignee");
  });

  it("PATCH /api/tasks/[id] allows department leader (TRUONG_PHONG with matching departmentId) to update task", async () => {
    const token = createTestToken({ id: "user-lead-cntt", role: "TRUONG_PHONG", departmentId: "dept-cntt" });
    const req = new NextRequest("http://localhost:3001/api/tasks/task-cntt-1", {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Updated by dept lead" }),
    });
    const res = await patchTask(req, { params: Promise.resolve({ id: "task-cntt-1" }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.title, "Updated by dept lead");
  });

  it("PATCH /api/tasks/[id] allows BGH/ADMIN to update task", async () => {
    const token = createTestToken({ id: "user-bgh", role: "BAN_GIAM_HIEU" });
    const req = new NextRequest("http://localhost:3001/api/tasks/task-daotao-1", {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Updated by BGH" }),
    });
    const res = await patchTask(req, { params: Promise.resolve({ id: "task-daotao-1" }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.title, "Updated by BGH");
  });

  it("DELETE /api/tasks/[id] returns 403 when user is regular assignee (not creator or BGH/ADMIN)", async () => {
    const token = createTestToken({ id: "user-assignee", role: "GIANG_VIEN", departmentId: "dept-cntt" });
    const req = new NextRequest("http://localhost:3001/api/tasks/task-cntt-1", {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
    const res = await deleteTask(req, { params: Promise.resolve({ id: "task-cntt-1" }) });
    assert.equal(res.status, 403);
  });

  it("DELETE /api/tasks/[id] allows task creator to delete task", async () => {
    // Create dedicated task for creator deletion test
    const tempTask = await prisma.task.create({
      data: {
        id: "task-temp-delete-creator",
        code: "TASK-TEMP-DEL-1",
        title: "Nhiệm vụ xóa bởi creator",
        status: "NOT_STARTED",
        departmentId: "dept-daotao",
        createdById: "user-creator-1",
        dueDate: new Date("2026-10-01"),
        academicMonth: 9,
        academicYear: "2026-2027",
      },
    });

    const token = createTestToken({ id: "user-creator-1", role: "TRUONG_PHONG", departmentId: "dept-daotao" });
    const req = new NextRequest(`http://localhost:3001/api/tasks/${tempTask.id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
    const res = await deleteTask(req, { params: Promise.resolve({ id: tempTask.id }) });
    assert.equal(res.status, 200);
    const check = await prisma.task.findUnique({ where: { id: tempTask.id } });
    assert.equal(check, null);
  });

  it("DELETE /api/tasks/[id] allows BGH/ADMIN to delete task", async () => {
    // Create dedicated task for BGH deletion test
    const tempTask = await prisma.task.create({
      data: {
        id: "task-temp-delete-bgh",
        code: "TASK-TEMP-DEL-2",
        title: "Nhiệm vụ xóa bởi BGH",
        status: "NOT_STARTED",
        departmentId: "dept-daotao",
        createdById: "user-creator-1",
        dueDate: new Date("2026-10-01"),
        academicMonth: 9,
        academicYear: "2026-2027",
      },
    });

    const token = createTestToken({ id: "user-bgh", role: "BAN_GIAM_HIEU" });
    const req = new NextRequest(`http://localhost:3001/api/tasks/${tempTask.id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
    const res = await deleteTask(req, { params: Promise.resolve({ id: tempTask.id }) });
    assert.equal(res.status, 200);
    const check = await prisma.task.findUnique({ where: { id: tempTask.id } });
    assert.equal(check, null);
  });

  it("POST /api/documents/[id]/directives returns 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3001/api/documents/doc-1/directives", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ assignedDeptId: "dept-cntt", instruction: "Chỉ đạo mẫu" }),
    });
    const res = await postDirective(req, { params: Promise.resolve({ id: "doc-1" }) });
    assert.equal(res.status, 401);
  });

  it("POST /api/documents/[id]/directives returns 403 if role is not BAN_GIAM_HIEU or ADMIN", async () => {
    const token = createTestToken({ id: "user-cntt", role: "CHUYEN_VIEN", departmentId: "dept-cntt" });
    const req = new NextRequest("http://localhost:3001/api/documents/doc-1/directives", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ assignedDeptId: "dept-cntt", content: "Chỉ đạo mẫu" }),
    });
    const res = await postDirective(req, { params: Promise.resolve({ id: "doc-1" }) });
    assert.equal(res.status, 403);
  });

  it("GET /api/system/network-info returns 404 or 403 in production environment", async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";
    try {
      const req = new NextRequest("http://localhost:3000/api/system/network-info");
      const res = await getNetworkInfo(req);
      assert.ok([403, 404].includes(res.status));
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }
  });
});
