import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as getDocs, POST as postDocs } from "../src/app/api/documents/route";
import { GET as getDocById, PATCH as patchDocById } from "../src/app/api/documents/[id]/route";
import { GET as exportExcel } from "../src/app/api/documents/export-excel/route";
import { GET as downloadDoc } from "../src/app/api/documents/download/route";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import { prisma } from "../src/lib/prisma";

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
