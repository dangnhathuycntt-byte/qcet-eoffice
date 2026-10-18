import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/search/route";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import { prisma } from "@qcet/db/prisma";
import { getCurrentAcademicPeriod } from "@qcet/shared/lib/academic-calendar";
import type {
  GlobalSearchPayload,
  SearchDocumentResult,
  SearchTaskResult,
  SearchUserResult,
} from "@qcet/contracts/search";

// Tập khóa lấy từ contract: thiếu hay thừa khóa so với contract là lỗi typecheck.
const keysOf = <T,>(shape: Record<keyof T, true>) => Object.keys(shape).sort();
const PAYLOAD_KEYS = keysOf<GlobalSearchPayload & { success: boolean }>({ success: true, query: true, results: true, count: true });
const TASK_KEYS = keysOf<SearchTaskResult>({
  id: true, code: true, title: true, scope: true, status: true, priority: true, progressPercent: true,
  dueDate: true, academicMonth: true, academicYear: true, leadUnit: true, actors: true,
});
const ACTOR_KEYS = keysOf<SearchTaskResult["actors"][number]>({ role: true, isPrimaryDRI: true, user: true });
const DOCUMENT_KEYS = keysOf<SearchDocumentResult>({
  id: true, originalNumber: true, registrationNumber: true, type: true, summary: true, category: true,
  issuingAuthority: true, issuedDate: true, status: true, urgency: true,
});
const USER_KEYS = keysOf<SearchUserResult>({ id: true, name: true, email: true, role: true, title: true, phone: true, avatarUrl: true });

let validToken = "";
let leaderUserId = "";

function createAuthRequest(url: string) {
  return new NextRequest(url, {
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
    },
  });
}

describe("Search API Endpoint (GET /api/search)", () => {
  before(async () => {
    // Seed/upsert test leadership user (HIEU_TRUONG / BAN_GIAM_HIEU) so resolveCurrentSession finds active DB user
    // and canonical task authorization grants school-wide task read access.
    const leaderUser = await prisma.user.upsert({
      where: { email: "bgh.search.test@qcet.edu.vn" },
      update: { isActive: true, role: "BAN_GIAM_HIEU" },
      create: {
        id: "test-bgh-search-id",
        email: "bgh.search.test@qcet.edu.vn",
        name: "Ban Giám Hiệu Search Test",
        role: "BAN_GIAM_HIEU",
        isActive: true,
      },
    });

    leaderUserId = leaderUser.id;

    // Ensure leadership position definition and active assignment exist
    const posDef = await prisma.positionDefinition.upsert({
      where: { code: "POS-BGH-SEARCH-TEST" },
      update: { isLeadership: true },
      create: {
        code: "POS-BGH-SEARCH-TEST",
        title: "Hiệu trưởng (Search Test)",
        group: "LDPU",
        isLeadership: true,
      },
    });

    const anyUnit = await prisma.organizationalUnit.findFirst({ select: { id: true } });
    if (anyUnit) {
      await prisma.positionAssignment.upsert({
        where: { id: "pos-assign-bgh-search-test" },
        update: { status: "ACTIVE", unitId: anyUnit.id },
        create: {
          id: "pos-assign-bgh-search-test",
          userId: leaderUser.id,
          positionDefinitionId: posDef.id,
          unitId: anyUnit.id,
          type: "PRIMARY",
          status: "ACTIVE",
          effectiveFrom: new Date("2020-01-01"),
        },
      });
    }

    // Ensure at least one task with NV-2026 prefix exists
    await prisma.task.upsert({
      where: { code: "NV-2026-SEARCH-TEST" },
      update: {},
      create: {
        code: "NV-2026-SEARCH-TEST",
        title: "Nhiệm vụ kiểm thử tìm kiếm mã NV-2026",
        status: "IN_PROGRESS",
        priority: "NORMAL",
        scope: "SCHOOL",
        createdById: leaderUser.id,
        dueDate: new Date("2027-01-01"),
        academicMonth: 9,
        academicYear: "2026-2027",
      },
    });

    validToken = signSessionToken({
      id: leaderUser.id,
      email: leaderUser.email,
      name: leaderUser.name,
      role: leaderUser.role,
    });
  });

  test("returns 401 when no session cookie is provided", async () => {
    const req = new NextRequest("http://localhost:3001/api/search");
    const res = await GET(req);
    assert.equal(res.status, 401);
  });

  test("returns empty query result with recent tasks and active users", async () => {
    const req = createAuthRequest("http://localhost:3001/api/search");

    const res = await GET(req);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.results.tasks));
    assert.ok(Array.isArray(data.results.users));
    assert.ok(typeof data.count.tasks === "number");
    assert.ok(typeof data.count.users === "number");
  });

  test("filters tasks and users by Vietnamese unaccented query", async () => {
    const req = createAuthRequest("http://localhost:3001/api/search?q=dao+tao");
    const res = await GET(req);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.equal(data.query, "dao tao");
    assert.ok(Array.isArray(data.results.tasks));
  });

  test("filters by department acronym (cntt, bgh, dbclgd)", async () => {
    const req = createAuthRequest("http://localhost:3001/api/search?q=cntt");
    const res = await GET(req);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.equal(data.query, "cntt");
  });

  test("filters by task code prefix (NV-2026)", async () => {
    const req = createAuthRequest("http://localhost:3001/api/search?q=NV-2026");
    const res = await GET(req);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.ok(data.results.tasks.length > 0);
    const hasMatch = data.results.tasks.some((t: any) =>
      t.code.toLowerCase().includes("nv-2026")
    );
    assert.ok(hasMatch, "At least one task should match code prefix NV-2026");
  });

  describe("payload khớp contract `@/contracts/search`", () => {
    const runId = `srchshape${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const ids = { unit: "", task: "", document: "", user: "" };

    before(async () => {
      const unit = await prisma.organizationalUnit.create({
        data: { code: runId.slice(0, 50), name: `Đơn vị ${runId}`, type: "DEPARTMENT" },
      });
      ids.unit = unit.id;
      const { month, academicYear } = getCurrentAcademicPeriod();
      const task = await prisma.task.create({
        data: {
          code: `NV-${runId}`.slice(0, 50),
          title: `Nhiệm vụ kiểm thử ${runId}`,
          status: "IN_PROGRESS",
          priority: "NORMAL",
          scope: "DEPARTMENT",
          leadUnitId: unit.id,
          createdById: leaderUserId,
          dueDate: new Date(Date.now() + 30 * 86_400_000),
          academicMonth: month,
          academicYear,
          // Tác nhân đơn vị không có user: `actors[].user` là null.
          actors: { create: [{ unitId: unit.id, role: "LEAD_UNIT" }] },
        },
      });
      ids.task = task.id;
      const seq = 900_000_000 + Math.floor(Math.random() * 90_000_000);
      const document = await prisma.document.create({
        data: {
          type: "VAN_BAN_DEN",
          registrationNumber: seq,
          documentYear: new Date().getFullYear(),
          originalNumber: `${runId}/${seq}`,
          issuedDate: new Date(Date.now() - 86_400_000),
          issuingAuthority: "Sở Giáo dục và Đào tạo",
          category: "Công văn",
          summary: `Văn bản kiểm thử ${runId}`,
          registeredById: leaderUserId,
        },
      });
      ids.document = document.id;
      const user = await prisma.user.create({
        data: { email: `${runId}@qcet.edu.vn`, name: `Cán bộ ${runId}`, role: "CHUYEN_VIEN", isActive: true },
      });
      ids.user = user.id;
    });

    after(async () => {
      if (ids.document) await prisma.document.deleteMany({ where: { id: ids.document } });
      if (ids.task) await prisma.task.deleteMany({ where: { id: ids.task } });
      if (ids.user) await prisma.user.deleteMany({ where: { id: ids.user } });
      if (ids.unit) await prisma.organizationalUnit.deleteMany({ where: { id: ids.unit } });
    });

    test("nhiệm vụ, văn bản, người dùng có đúng tập khóa của contract", async () => {
      const res = await GET(createAuthRequest(`http://localhost:3001/api/search?q=${runId}`));
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.deepEqual(Object.keys(data).sort(), PAYLOAD_KEYS);

      const task = data.results.tasks.find((t: any) => t.id === ids.task);
      assert.ok(task, "phải tìm thấy nhiệm vụ fixture");
      assert.deepEqual(Object.keys(task).sort(), TASK_KEYS);
      assert.deepEqual(task.leadUnit, { id: ids.unit, name: `Đơn vị ${runId}`, code: runId.slice(0, 50) });
      assert.equal(task.actors.length, 1);
      assert.deepEqual(Object.keys(task.actors[0]).sort(), ACTOR_KEYS);
      assert.equal(task.actors[0].user, null);
      assert.ok(!Number.isNaN(Date.parse(task.dueDate)));

      const document = data.results.documents.find((d: any) => d.id === ids.document);
      assert.ok(document, "phải tìm thấy văn bản fixture");
      assert.deepEqual(Object.keys(document).sort(), DOCUMENT_KEYS);
      assert.ok(!Number.isNaN(Date.parse(document.issuedDate)));

      const user = data.results.users.find((u: any) => u.id === ids.user);
      assert.ok(user, "phải tìm thấy người dùng fixture");
      assert.deepEqual(Object.keys(user).sort(), USER_KEYS);
    });
  });
});
