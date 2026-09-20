/**
 * AuthZ Security Regression Tests — Issue #23
 *
 * Covers:
 * 1. Orphan file default-deny trên /api/documents/download
 * 2. SYSTEM_ADMIN không thấy operational tasks qua /api/search
 * 3. BGH thấy school-wide tasks qua /api/search
 * 4. CHUYEN_VIEN không mở rộng qua scope=school query param
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET as downloadDoc } from "../src/app/api/documents/download/route";
import { GET as searchGet } from "../src/app/api/search/route";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import { prisma } from "../src/lib/prisma";

void SESSION_COOKIE_NAME;

const TEST_UPLOADS_DIR = path.resolve("./test_authz_sandbox");

// ---------------------------------------------------------------------------
// Test 1: Orphan file default-deny
// ---------------------------------------------------------------------------
describe("P0-1: Orphan file default-deny on /api/documents/download", () => {
  let testUserId = "";
  let sessionToken = "";

  before(async () => {
    process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;
    fs.mkdirSync(path.join(TEST_UPLOADS_DIR, "docs"), { recursive: true });
    // Tạo file vật lý hợp lệ extension — KHÔNG tạo DB record (orphan)
    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, "docs/orphan-test.pdf"),
      "%PDF-1.4 orphan content"
    );

    const user = await prisma.user.create({
      data: {
        email: `authz_orphan_test_${Date.now()}@qcet.edu.vn`,
        name: "Test Orphan User",
        role: "CHUYEN_VIEN",
        isActive: true,
      },
    });
    testUserId = user.id;
    sessionToken = signSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  });

  after(async () => {
    fs.rmSync(TEST_UPLOADS_DIR, { recursive: true, force: true });
    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
  });

  it("GET /api/documents/download?file=<orphan> returns 404 for authenticated user", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/documents/download?file=docs/orphan-test.pdf",
      {
        headers: { Authorization: `Bearer ${sessionToken}` },
      }
    );
    const res = await downloadDoc(req);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  it("Heuristic cũ (tên chứa 'secret') không còn được phép bypass cho admin", async () => {
    // File tên nhạy cảm nhưng vẫn orphan — phải 404 chứ không 200
    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, "docs/supersecret.pdf"),
      "%PDF-1.4 secret content"
    );

    const adminUser = await prisma.user.create({
      data: {
        email: `authz_admin_test_${Date.now()}@qcet.edu.vn`,
        name: "Test Admin User",
        role: "ADMIN",
        isActive: true,
      },
    });
    const adminToken = signSessionToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
    });

    const req = new NextRequest(
      "http://localhost:3000/api/documents/download?file=docs/supersecret.pdf",
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    const res = await downloadDoc(req);
    // Orphan file phải bị từ chối bất kể tên
    assert.equal(res.status, 404);

    await prisma.user.deleteMany({ where: { id: adminUser.id } });
  });
});

// ---------------------------------------------------------------------------
// Test 2–4: /api/search canonical task authorization
// ---------------------------------------------------------------------------
describe("P0-2: /api/search canonical Task authorization", () => {
  // Test data IDs — prefix unique để tránh xung đột với các test khác
  const IDS = {
    deptA: "dept-authz-sec-a",
    deptB: "dept-authz-sec-b",
    unitBgh: "unit-authz-bgh-sec",
    unitDeptA: "unit-authz-dept-a",
    userAdmin: "user-authz-admin-sec",
    userBgh: "user-authz-bgh-sec",
    userStaffA: "user-authz-staff-a-sec",
    userStaffB: "user-authz-staff-b-sec",
    posDefBgh: "BGH_AUTHZ_SEC_TEST",
    posAssignBgh: "pos-authz-bgh-assign-sec",
    taskSchool: "task-authz-school-sec",
    taskDeptA: "task-authz-dept-a-sec",
    taskDeptB: "task-authz-dept-b-sec",
  };

  let tokenAdmin = "";
  let tokenBgh = "";
  let tokenStaffA = "";
  let tokenStaffB = "";

  before(async () => {
    // Departments
    await prisma.department.upsert({
      where: { id: IDS.deptA },
      update: {},
      create: { id: IDS.deptA, name: "Phòng A (AuthZ Test)" },
    });
    await prisma.department.upsert({
      where: { id: IDS.deptB },
      update: {},
      create: { id: IDS.deptB, name: "Phòng B (AuthZ Test)" },
    });

    // OrganizationalUnits
    await prisma.organizationalUnit.upsert({
      where: { id: IDS.unitBgh },
      update: { status: "ACTIVE" },
      create: {
        id: IDS.unitBgh,
        code: "BGH_AUTHZ_SEC",
        name: "Ban Giám Hiệu (AuthZ Test)",
        type: "SCHOOL",
        status: "ACTIVE",
      },
    });
    await prisma.organizationalUnit.upsert({
      where: { id: IDS.unitDeptA },
      update: { status: "ACTIVE" },
      create: {
        id: IDS.unitDeptA,
        code: "DEPT_A_AUTHZ_SEC",
        name: "Đơn vị A (AuthZ Test)",
        type: "FACULTY",
        status: "ACTIVE",
      },
    });

    // Users
    await prisma.user.upsert({
      where: { id: IDS.userAdmin },
      update: {},
      create: {
        id: IDS.userAdmin,
        email: `admin_authz_${Date.now()}@qcet.edu.vn`,
        name: "Admin AuthZ Test",
        role: "ADMIN",
        isActive: true,
      },
    });
    await prisma.user.upsert({
      where: { id: IDS.userBgh },
      update: {},
      create: {
        id: IDS.userBgh,
        email: `bgh_authz_${Date.now()}@qcet.edu.vn`,
        name: "BGH AuthZ Test",
        role: "BAN_GIAM_HIEU",
        isActive: true,
      },
    });
    await prisma.user.upsert({
      where: { id: IDS.userStaffA },
      update: {},
      create: {
        id: IDS.userStaffA,
        email: `staff_a_authz_${Date.now()}@qcet.edu.vn`,
        name: "Staff A AuthZ Test",
        role: "CHUYEN_VIEN",
        departmentId: IDS.deptA,
        isActive: true,
      },
    });
    await prisma.user.upsert({
      where: { id: IDS.userStaffB },
      update: {},
      create: {
        id: IDS.userStaffB,
        email: `staff_b_authz_${Date.now()}@qcet.edu.vn`,
        name: "Staff B AuthZ Test",
        role: "CHUYEN_VIEN",
        departmentId: IDS.deptB,
        isActive: true,
      },
    });

    // PositionDefinition for BGH
    const posDefBgh = await prisma.positionDefinition.upsert({
      where: { code: IDS.posDefBgh },
      update: { isLeadership: true },
      create: {
        code: IDS.posDefBgh,
        title: "Ban Giám Hiệu (AuthZ Test)",
        group: "LDPU",
        isLeadership: true,
      },
    });

    // PositionAssignment for BGH user
    await prisma.positionAssignment.upsert({
      where: { id: IDS.posAssignBgh },
      update: { status: "ACTIVE" },
      create: {
        id: IDS.posAssignBgh,
        userId: IDS.userBgh,
        positionDefinitionId: posDefBgh.id,
        unitId: IDS.unitBgh,
        type: "PRIMARY",
        status: "ACTIVE",
        effectiveFrom: new Date("2020-01-01"),
      },
    });

    // Tasks
    await prisma.task.upsert({
      where: { id: IDS.taskSchool },
      update: {},
      create: {
        id: IDS.taskSchool,
        code: "TASK-AUTHZ-SCHOOL-SEC",
        title: "Nhiệm vụ toàn trường AuthZ Test",
        status: "IN_PROGRESS",
        priority: "NORMAL",
        scope: "SCHOOL",
        createdById: IDS.userAdmin,
        dueDate: new Date("2027-01-01"),
        academicMonth: 1,
        academicYear: "2026-2027",
      },
    });
    await prisma.task.upsert({
      where: { id: IDS.taskDeptA },
      update: {},
      create: {
        id: IDS.taskDeptA,
        code: "TASK-AUTHZ-DEPT-A-SEC",
        title: "Nhiệm vụ phòng A AuthZ Test",
        status: "IN_PROGRESS",
        priority: "NORMAL",
        scope: "DEPARTMENT",
        departmentId: IDS.deptA,
        createdById: IDS.userAdmin,
        dueDate: new Date("2027-01-01"),
        academicMonth: 1,
        academicYear: "2026-2027",
      },
    });
    await prisma.task.upsert({
      where: { id: IDS.taskDeptB },
      update: {},
      create: {
        id: IDS.taskDeptB,
        code: "TASK-AUTHZ-DEPT-B-SEC",
        title: "Nhiệm vụ phòng B AuthZ Test",
        status: "IN_PROGRESS",
        priority: "NORMAL",
        scope: "DEPARTMENT",
        departmentId: IDS.deptB,
        createdById: IDS.userAdmin,
        dueDate: new Date("2027-01-01"),
        academicMonth: 1,
        academicYear: "2026-2027",
      },
    });

    // Build session tokens
    const [adminUser, bghUser, staffAUser, staffBUser] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: IDS.userAdmin } }),
      prisma.user.findUniqueOrThrow({ where: { id: IDS.userBgh } }),
      prisma.user.findUniqueOrThrow({ where: { id: IDS.userStaffA } }),
      prisma.user.findUniqueOrThrow({ where: { id: IDS.userStaffB } }),
    ]);

    tokenAdmin = signSessionToken({ id: adminUser.id, email: adminUser.email, name: adminUser.name, role: adminUser.role });
    tokenBgh = signSessionToken({ id: bghUser.id, email: bghUser.email, name: bghUser.name, role: bghUser.role });
    tokenStaffA = signSessionToken({ id: staffAUser.id, email: staffAUser.email, name: staffAUser.name, role: staffAUser.role });
    tokenStaffB = signSessionToken({ id: staffBUser.id, email: staffBUser.email, name: staffBUser.name, role: staffBUser.role });
  });

  after(async () => {
    // Cleanup theo thứ tự dependency
    await prisma.taskAssignee.deleteMany({
      where: { taskId: { in: [IDS.taskSchool, IDS.taskDeptA, IDS.taskDeptB] } },
    });
    await prisma.task.deleteMany({
      where: { id: { in: [IDS.taskSchool, IDS.taskDeptA, IDS.taskDeptB] } },
    });
    await prisma.positionAssignment.deleteMany({
      where: { id: IDS.posAssignBgh },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [IDS.userAdmin, IDS.userBgh, IDS.userStaffA, IDS.userStaffB] } },
    });
    await prisma.organizationalUnit.deleteMany({
      where: { id: { in: [IDS.unitBgh, IDS.unitDeptA] } },
    });
    await prisma.department.deleteMany({
      where: { id: { in: [IDS.deptA, IDS.deptB] } },
    });
    await prisma.positionDefinition.deleteMany({
      where: { code: IDS.posDefBgh },
    });
  });

  function makeSearchReq(token: string, query: string, extraParams = "") {
    return new NextRequest(
      `http://localhost:3000/api/search?q=${encodeURIComponent(query)}&limit=50${extraParams}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  }

  it("Test 2: SYSTEM_ADMIN (role=ADMIN) không thấy operational tasks", async () => {
    const req = makeSearchReq(tokenAdmin, "AuthZ Test", "&scope=school");
    const res = await searchGet(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    const taskIds = body.data.results.tasks.map((t: any) => t.id);
    // SYSTEM_ADMIN bị deny bởi buildTaskReadWhere → không thấy bất kỳ task nào
    assert.ok(
      !taskIds.includes(IDS.taskSchool) && !taskIds.includes(IDS.taskDeptA),
      `SYSTEM_ADMIN không được thấy operational tasks, nhưng thấy: ${taskIds.join(", ")}`
    );
  });

  it("Test 3: BGH với canonical position thấy school-wide tasks", async () => {
    const req = makeSearchReq(tokenBgh, "AuthZ Test");
    const res = await searchGet(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    const taskIds = body.data.results.tasks.map((t: any) => t.id);
    // BGH có active leadership position → buildTaskReadWhere trả {} → thấy mọi task
    assert.ok(
      taskIds.includes(IDS.taskSchool),
      `BGH phải thấy task toàn trường (${IDS.taskSchool}), tasks hiện thấy: ${taskIds.join(", ")}`
    );
  });

  it("Test 4: CHUYEN_VIEN dept A không thấy task dept B dù scope=school", async () => {
    // scope=school bị IGNORE — authorization vẫn dựa theo canonical position
    const req = makeSearchReq(tokenStaffA, "AuthZ Test", "&scope=school");
    const res = await searchGet(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    const taskIds = body.data.results.tasks.map((t: any) => t.id);
    assert.ok(
      !taskIds.includes(IDS.taskDeptB),
      `CHUYEN_VIEN dept A không được thấy task dept B (${IDS.taskDeptB}) dù truyền scope=school`
    );
  });

  it("Test 4b: CHUYEN_VIEN dept B không thấy task dept A dù scope=school", async () => {
    const req = makeSearchReq(tokenStaffB, "AuthZ Test", "&scope=school");
    const res = await searchGet(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    const taskIds = body.data.results.tasks.map((t: any) => t.id);
    assert.ok(
      !taskIds.includes(IDS.taskDeptA),
      `CHUYEN_VIEN dept B không được thấy task dept A (${IDS.taskDeptA}) dù truyền scope=school`
    );
  });
});
