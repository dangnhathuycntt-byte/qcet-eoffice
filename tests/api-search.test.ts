import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/search/route";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import { prisma } from "../src/lib/prisma";

let validToken = "";

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
});
