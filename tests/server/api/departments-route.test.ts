import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@qcet/db/prisma";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { GET as getDepartments } from "@/app/api/departments/route";

/**
 * Test đặc tả GET /api/departments (danh bạ đơn vị đang hoạt động).
 * Khóa: ranh giới xác thực (401 + code), shape danh sách, lọc status ACTIVE,
 * ánh xạ metadata, tham số includePersonnel (chỉ đúng chuỗi "true") và các quy tắc lọc nhân sự.
 */
describe("GET /api/departments", () => {
  const runId = `${Date.now()}${crypto.randomInt(1000, 9999)}`;
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const daysFromNow = (n: number) => new Date(now + n * DAY);

  const unitAId = `tdep-a-${runId}`;
  const unitBId = `tdep-b-${runId}`;
  const unitDissolvedId = `tdep-x-${runId}`;
  const unitIds = [unitAId, unitBId, unitDissolvedId];

  const pdStaffId = `tdep-pds-${runId}`;
  const pdLeadId = `tdep-pdl-${runId}`;
  const pdIds = [pdStaffId, pdLeadId];

  const userId = (k: string) => `tdep-u-${k}-${runId}`;
  const userKeys = ["viewer", "staff", "dual", "leadfirst", "concb", "inactive", "expired", "future", "terminated"] as const;
  const userIds = userKeys.map(userId);
  const assignmentIds: string[] = [];

  const tokenFor = (k: (typeof userKeys)[number], role = "CHUYEN_VIEN") =>
    signSessionToken({ id: userId(k), email: `${runId}.dep-${k}@qcet-test.edu.vn`, name: `Kiểm thử ${k}`, role });

  let reqSeq = 0;
  function makeRequest(query = "", opts: { bearer?: string; cookie?: string } = {}) {
    const requestId = `tdep-${runId}-${++reqSeq}`;
    const headers = new Headers({ "x-request-id": requestId });
    if (opts.bearer) headers.set("Authorization", `Bearer ${opts.bearer}`);
    if (opts.cookie) headers.set("Cookie", `${SESSION_COOKIE_NAME}=${opts.cookie}`);
    return { req: new NextRequest(`http://localhost:3000/api/departments${query}`, { headers }), requestId };
  }

  async function addAssignment(data: {
    key: (typeof userKeys)[number];
    unitId: string;
    pdId: string;
    type?: "PRIMARY" | "CONCURRENT" | "ACTING";
    status?: "ACTIVE" | "ON_LEAVE" | "TERMINATED" | "SUPERSEDED";
    effectiveFrom?: Date;
    effectiveTo?: Date | null;
    createdAt: Date;
  }) {
    const id = `tdep-pa-${assignmentIds.length}-${runId}`;
    assignmentIds.push(id);
    await prisma.positionAssignment.create({
      data: {
        id,
        userId: userId(data.key),
        unitId: data.unitId,
        positionDefinitionId: data.pdId,
        type: data.type ?? "PRIMARY",
        status: data.status ?? "ACTIVE",
        effectiveFrom: data.effectiveFrom ?? daysFromNow(-60),
        effectiveTo: data.effectiveTo ?? null,
        createdAt: data.createdAt,
      },
    });
  }

  before(async () => {
    await prisma.organizationalUnit.create({
      data: {
        id: unitAId,
        code: unitAId,
        name: `Đơn vị kiểm thử ${runId} A`,
        type: "DEPARTMENT",
        status: "ACTIVE",
        metadata: { shortName: "KT-A", description: "Mô tả đơn vị A", displayOrder: 7 },
      },
    });
    await prisma.organizationalUnit.create({
      data: {
        id: unitBId,
        code: unitBId,
        name: `Đơn vị kiểm thử ${runId} B`,
        type: "SECTION",
        status: "ACTIVE",
        parentId: unitAId,
        // Sai kiểu: route chỉ nhận shortName/description là string, displayOrder là number.
        metadata: { shortName: 123, description: ["x"], displayOrder: "3" },
      },
    });
    await prisma.organizationalUnit.create({
      data: {
        id: unitDissolvedId,
        code: unitDissolvedId,
        name: `Đơn vị kiểm thử ${runId} C giải thể`,
        type: "DEPARTMENT",
        status: "DISSOLVED",
      },
    });

    await prisma.positionDefinition.createMany({
      data: [
        { id: pdStaffId, code: `TDS${runId}`, title: "Chuyên viên kiểm thử", group: "VCDC", isLeadership: false },
        { id: pdLeadId, code: `TDL${runId}`, title: "Trưởng phòng kiểm thử", group: "LDPU", isLeadership: true },
      ],
    });

    await prisma.user.createMany({
      data: userKeys.map((k) => ({
        id: userId(k),
        email: `${runId}.dep-${k}@qcet-test.edu.vn`,
        name: `Kiểm thử ${k}`,
        role: "CHUYEN_VIEN" as const,
        title: k === "staff" ? "Chuyên viên tự ghi" : null,
        phone: k === "staff" ? "0900000001" : null,
        isActive: k !== "inactive",
      })),
    });

    // Đơn vị A: staff (-30 ngày), leadfirst (-25), dual (-20) theo thứ tự createdAt.
    await addAssignment({ key: "staff", unitId: unitAId, pdId: pdStaffId, createdAt: daysFromNow(-30) });
    await addAssignment({ key: "leadfirst", unitId: unitAId, pdId: pdLeadId, createdAt: daysFromNow(-25) });
    await addAssignment({ key: "dual", unitId: unitAId, pdId: pdStaffId, createdAt: daysFromNow(-20) });
    await addAssignment({ key: "dual", unitId: unitAId, pdId: pdLeadId, type: "CONCURRENT", createdAt: daysFromNow(-10) });
    await addAssignment({ key: "leadfirst", unitId: unitAId, pdId: pdStaffId, type: "CONCURRENT", createdAt: daysFromNow(-5) });
    // Bị loại khỏi personnel: tài khoản khóa, hết hiệu lực, chưa hiệu lực, đã chấm dứt.
    await addAssignment({ key: "inactive", unitId: unitAId, pdId: pdStaffId, createdAt: daysFromNow(-29) });
    await addAssignment({ key: "expired", unitId: unitAId, pdId: pdStaffId, effectiveTo: daysFromNow(-1), createdAt: daysFromNow(-28) });
    await addAssignment({ key: "future", unitId: unitAId, pdId: pdStaffId, effectiveFrom: daysFromNow(5), createdAt: daysFromNow(-27) });
    await addAssignment({ key: "terminated", unitId: unitAId, pdId: pdStaffId, status: "TERMINATED", createdAt: daysFromNow(-26) });
    // Đơn vị B: kiêm nhiệm còn hiệu lực đến tương lai.
    await addAssignment({
      key: "concb",
      unitId: unitBId,
      pdId: pdStaffId,
      type: "CONCURRENT",
      effectiveTo: daysFromNow(30),
      createdAt: daysFromNow(-15),
    });
  });

  after(async () => {
    await prisma.positionAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.positionDefinition.deleteMany({ where: { id: { in: pdIds } } });
    await prisma.organizationalUnit.deleteMany({ where: { id: { in: [unitBId, unitDissolvedId] } } });
    await prisma.organizationalUnit.deleteMany({ where: { id: unitAId } });
  });

  describe("ranh giới xác thực", () => {
    test("không có token: 401 AUTH_REQUIRED, no-store, không trả danh sách", async () => {
      const { req, requestId } = makeRequest();
      const res = await getDepartments(req);
      assert.equal(res.status, 401);
      assert.match(res.headers.get("content-type") ?? "", /application\/json/);
      assert.equal(res.headers.get("cache-control"), "private, no-store");
      assert.equal(res.headers.get("x-request-id"), requestId);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.code, "AUTH_REQUIRED");
      assert.equal(body.requestId, requestId);
      assert.equal("data" in body, false);
      assert.equal("departments" in body, false);
      assert.equal("total" in body, false);
    });

    test("Bearer token rác: 401 SESSION_INVALID, không trả danh sách", async () => {
      const { req } = makeRequest("", { bearer: "not-a-real-token" });
      const res = await getDepartments(req);
      assert.equal(res.status, 401);
      assert.equal(res.headers.get("cache-control"), "private, no-store");
      const body = await res.json();
      assert.equal(body.code, "SESSION_INVALID");
      assert.equal("data" in body, false);
    });

    test("token hợp lệ chữ ký nhưng user không tồn tại: 401 SESSION_INVALID", async () => {
      const ghost = signSessionToken({
        id: `tdep-ghost-${runId}`,
        email: `${runId}.dep-ghost@qcet-test.edu.vn`,
        name: "Không tồn tại",
        role: "ADMIN",
      });
      const { req } = makeRequest("", { bearer: ghost });
      const res = await getDepartments(req);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.code, "SESSION_INVALID");
      assert.equal("data" in body, false);
    });

    test("token của tài khoản bị khóa: 401 ACCOUNT_DISABLED, không trả danh sách", async () => {
      const { req } = makeRequest("?includePersonnel=true", { bearer: tokenFor("inactive") });
      const res = await getDepartments(req);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.code, "ACCOUNT_DISABLED");
      assert.equal("data" in body, false);
    });
  });

  describe("danh sách đơn vị (người dùng đã đăng nhập bất kỳ, không cần phân công)", () => {
    test("200: envelope legacy, cache private 60s, data === departments, total khớp", async () => {
      const { req, requestId } = makeRequest("", { bearer: tokenFor("viewer") });
      const res = await getDepartments(req);
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type") ?? "", /application\/json/);
      assert.equal(res.headers.get("cache-control"), "private, max-age=60");
      assert.equal(res.headers.get("x-request-id"), requestId);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.deepEqual(body.departments, body.data);
      assert.equal(body.total, body.data.length);
      assert.ok(body.total >= 2);
    });

    test("ánh xạ trường đơn vị và metadata; không có khóa personnel khi không yêu cầu", async () => {
      const { req } = makeRequest("", { bearer: tokenFor("viewer") });
      const body = await (await getDepartments(req)).json();
      const a = body.data.find((u: { id: string }) => u.id === unitAId);
      const b = body.data.find((u: { id: string }) => u.id === unitBId);
      assert.deepEqual(a, {
        id: unitAId,
        name: `Đơn vị kiểm thử ${runId} A`,
        code: unitAId,
        color: null,
        type: "DEPARTMENT",
        parentId: null,
        shortName: "KT-A",
        description: "Mô tả đơn vị A",
        displayOrder: 7,
      });
      // metadata sai kiểu → null, không ép kiểu
      assert.deepEqual(b, {
        id: unitBId,
        name: `Đơn vị kiểm thử ${runId} B`,
        code: unitBId,
        color: null,
        type: "SECTION",
        parentId: unitAId,
        shortName: null,
        description: null,
        displayOrder: null,
      });
    });

    test("chỉ trả đơn vị ACTIVE: đơn vị DISSOLVED không có trong danh sách", async () => {
      const { req } = makeRequest("?includePersonnel=true", { bearer: tokenFor("viewer") });
      const body = await (await getDepartments(req)).json();
      const ids = body.data.map((u: { id: string }) => u.id);
      assert.ok(ids.includes(unitAId));
      assert.equal(ids.includes(unitDissolvedId), false);
    });

    test("sắp xếp theo tên tăng dần", async () => {
      const { req } = makeRequest("", { bearer: tokenFor("viewer") });
      const body = await (await getDepartments(req)).json();
      const ids = body.data.map((u: { id: string }) => u.id);
      assert.ok(ids.indexOf(unitAId) >= 0 && ids.indexOf(unitAId) < ids.indexOf(unitBId));
    });

    test("xác thực bằng cookie phiên (GET không qua CSRF) cũng trả danh sách", async () => {
      const { req } = makeRequest("", { cookie: tokenFor("viewer") });
      const res = await getDepartments(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.data.some((u: { id: string }) => u.id === unitAId));
    });
  });

  describe("includePersonnel", () => {
    test("includePersonnel khác chuỗi \"true\" (vd. 1, TRUE) không kèm personnel", async () => {
      for (const value of ["1", "TRUE", "yes"]) {
        const { req } = makeRequest(`?includePersonnel=${value}`, { bearer: tokenFor("viewer") });
        const body = await (await getDepartments(req)).json();
        const a = body.data.find((u: { id: string }) => u.id === unitAId);
        assert.ok(a, `thiếu đơn vị fixture với includePersonnel=${value}`);
        assert.equal("personnel" in a, false, `includePersonnel=${value} không được kèm personnel`);
      }
    });

    test("nhân sự đơn vị: chỉ phân công ACTIVE, đang hiệu lực, tài khoản hoạt động; gộp một dòng/người, ưu tiên chức vụ lãnh đạo", async () => {
      const { req } = makeRequest("?includePersonnel=true", { bearer: tokenFor("viewer") });
      const res = await getDepartments(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      const a = body.data.find((u: { id: string }) => u.id === unitAId);
      assert.ok(Array.isArray(a.personnel));
      // Thứ tự theo createdAt của phân công đầu tiên mỗi người; loại inactive/expired/future/terminated.
      assert.deepEqual(
        a.personnel.map((p: { id: string }) => p.id),
        [userId("staff"), userId("leadfirst"), userId("dual")],
      );

      assert.deepEqual(a.personnel[0], {
        id: userId("staff"),
        name: "Kiểm thử staff",
        email: `${runId}.dep-staff@qcet-test.edu.vn`,
        role: "CHUYEN_VIEN",
        title: "Chuyên viên tự ghi",
        phone: "0900000001",
        avatarUrl: null,
        position: "Chuyên viên kiểm thử",
        positionCode: `TDS${runId}`,
        isLeadership: false,
        assignmentType: "PRIMARY",
      });

      // Lãnh đạo trước, kiêm nhiệm chuyên viên sau: giữ dòng lãnh đạo.
      const leadFirst = a.personnel[1];
      assert.equal(leadFirst.isLeadership, true);
      assert.equal(leadFirst.position, "Trưởng phòng kiểm thử");
      assert.equal(leadFirst.positionCode, `TDL${runId}`);
      assert.equal(leadFirst.assignmentType, "PRIMARY");

      // Chuyên viên trước, kiêm nhiệm lãnh đạo sau: thay bằng dòng lãnh đạo.
      const dual = a.personnel[2];
      assert.equal(dual.isLeadership, true);
      assert.equal(dual.position, "Trưởng phòng kiểm thử");
      assert.equal(dual.assignmentType, "CONCURRENT");
    });

    test("phân công kiêm nhiệm còn hiệu lực đến tương lai được tính cho đúng đơn vị", async () => {
      const { req } = makeRequest("?includePersonnel=true", { bearer: tokenFor("viewer") });
      const body = await (await getDepartments(req)).json();
      const b = body.data.find((u: { id: string }) => u.id === unitBId);
      assert.deepEqual(
        b.personnel.map((p: { id: string; assignmentType: string }) => [p.id, p.assignmentType]),
        [[userId("concb"), "CONCURRENT"]],
      );
      // Thông tin đơn vị vẫn giữ nguyên khi kèm personnel
      assert.equal(b.parentId, unitAId);
      assert.equal(b.type, "SECTION");
    });
  });
});
