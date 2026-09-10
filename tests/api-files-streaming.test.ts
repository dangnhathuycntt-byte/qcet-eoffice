import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/files/[...path]/route";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import { prisma } from "../src/lib/prisma";

const TEST_UPLOADS_DIR = path.resolve("./test_uploads_sandbox");

describe("API Files Streaming & Security", () => {
  let token: string;
  let unauthorizedToken: string;
  let unauthorizedUserId: string;
  let testDocId: string;
  let testDossierId: string;
  let testMeetingId: string;

  before(async () => {
    process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;
    fs.mkdirSync(path.join(TEST_UPLOADS_DIR, "documents/2026"), { recursive: true });
    fs.mkdirSync(path.join(TEST_UPLOADS_DIR, "dossier/2026"), { recursive: true });
    fs.mkdirSync(path.join(TEST_UPLOADS_DIR, "meetings/2026"), { recursive: true });

    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, "documents/2026/sample.pdf"),
      "%PDF-1.4 Fake PDF Content for QCET Unit Test 1234567890"
    );
    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, "dossier/2026/dossier-sample.pdf"),
      "%PDF-1.4 Fake Dossier Content for QCET Unit Test 1234567890"
    );
    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, "meetings/2026/meeting-sample.pdf"),
      "%PDF-1.4 Fake Meeting Content for QCET Unit Test 1234567890"
    );

    const user = await prisma.user.findFirst() || await prisma.user.create({
      data: {
        email: `stream-test-${Date.now()}@qcet.edu.vn`,
        name: "Stream Test User",
        role: "ADMIN",
      },
    });

    const unauthorizedUser = await prisma.user.create({
      data: {
        email: `unauth-stream-${Date.now()}@qcet.edu.vn`,
        name: "Unauthorized Staff",
        role: "CHUYEN_VIEN",
      },
    });
    unauthorizedUserId = unauthorizedUser.id;

    token = await signSessionToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    unauthorizedToken = await signSessionToken({
      id: unauthorizedUser.id,
      email: unauthorizedUser.email,
      role: unauthorizedUser.role,
      name: unauthorizedUser.name,
    });

    const doc = await prisma.document.create({
      data: {
        type: "VAN_BAN_DEN",
        documentYear: new Date().getFullYear(),
        registrationNumber: Math.floor(Math.random() * 900000) + 100000,
        originalNumber: `ORIG-STREAM-${Date.now()}`,
        summary: "Sample Streaming Test Document",
        category: "Kế hoạch",
        issuingAuthority: "Ban Giám hiệu",
        issuedDate: new Date(),
        registeredById: user.id,
      },
    });
    testDocId = doc.id;

    await prisma.documentAttachment.create({
      data: {
        documentId: doc.id,
        fileName: "sample.pdf",
        fileUrl: "documents/2026/sample.pdf",
        fileSize: 55,
        mimeType: "application/pdf",
      },
    });

    // Create WorkDossier and DossierItem
    const unit = await prisma.organizationalUnit.findFirst();
    const dossier = await prisma.workDossier.create({
      data: {
        title: "Dossier Streaming Test",
        code: `DOS-STREAM-${Date.now()}`,
        owningUnitId: unit?.id || "unit-test-default",
        responsiblePersonId: user.id,
        status: "OPEN",
      },
    });
    testDossierId = dossier.id;

    await prisma.dossierItem.create({
      data: {
        dossierId: dossier.id,
        itemType: "ATTACHMENT",
        title: "Dossier Attached File",
        itemId: "dossier/2026/dossier-sample.pdf",
        addedById: user.id,
        sequence: 1,
      },
    });

    // Create Meeting
    const meeting = await prisma.meeting.create({
      data: {
        title: "Meeting Streaming Test",
        organizerId: user.id,
        startTime: new Date(),
        materialsUrl: "meetings/2026/meeting-sample.pdf",
      },
    });
    testMeetingId = meeting.id;
  });

  after(async () => {
    fs.rmSync(TEST_UPLOADS_DIR, { recursive: true, force: true });
    if (testDocId) {
      await prisma.documentAttachment.deleteMany({ where: { documentId: testDocId } });
      await prisma.document.delete({ where: { id: testDocId } });
    }
    if (testDossierId) {
      await prisma.dossierItem.deleteMany({ where: { dossierId: testDossierId } });
      await prisma.workDossier.delete({ where: { id: testDossierId } });
    }
    if (testMeetingId) {
      await prisma.meeting.delete({ where: { id: testMeetingId } });
    }
    if (unauthorizedUserId) {
      await prisma.user.delete({ where: { id: unauthorizedUserId } });
    }
  });

  it("should serve existing PDF with 200 OK and correct headers", async () => {
    const req = new NextRequest("http://localhost:3000/api/files/documents/2026/sample.pdf", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    const res = await GET(req, {
      params: Promise.resolve({ path: ["documents", "2026", "sample.pdf"] }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/pdf");
    assert.equal(res.headers.get("accept-ranges"), "bytes");
    assert.ok(res.headers.get("content-length"));
  });

  it("should support HTTP 206 Byte-Range streaming for PDF inspection", async () => {
    const req = new NextRequest("http://localhost:3000/api/files/documents/2026/sample.pdf", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
        range: "bytes=0-9",
      },
    });
    const res = await GET(req, {
      params: Promise.resolve({ path: ["documents", "2026", "sample.pdf"] }),
    });

    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-length"), "10");
    assert.ok(res.headers.get("content-range")?.startsWith("bytes 0-9/"));
  });

  it("should block path traversal attempts with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/files/../etc/passwd", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    const res = await GET(req, {
      params: Promise.resolve({ path: ["..", "etc", "passwd"] }),
    });

    assert.equal(res.status, 403);
  });

  it("should return 404 for non-existent files", async () => {
    const req = new NextRequest("http://localhost:3000/api/files/documents/missing.pdf", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    const res = await GET(req, {
      params: Promise.resolve({ path: ["documents", "missing.pdf"] }),
    });

    assert.equal(res.status, 404);
  });

  it("should serve dossier item attachment for authorized user and return 403 for unauthorized user", async () => {
    // Authorized user (admin/owner)
    const authReq = new NextRequest("http://localhost:3000/api/files/dossier/2026/dossier-sample.pdf", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    const authRes = await GET(authReq, {
      params: Promise.resolve({ path: ["dossier", "2026", "dossier-sample.pdf"] }),
    });
    assert.equal(authRes.status, 200);

    // Unauthorized staff user
    const unauthReq = new NextRequest("http://localhost:3000/api/files/dossier/2026/dossier-sample.pdf", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${unauthorizedToken}` },
    });
    const unauthRes = await GET(unauthReq, {
      params: Promise.resolve({ path: ["dossier", "2026", "dossier-sample.pdf"] }),
    });
    assert.equal(unauthRes.status, 403);
  });

  it("should serve meeting materials for authorized participant/organizer and return 403 for unauthorized user", async () => {
    // Authorized user (organizer)
    const authReq = new NextRequest("http://localhost:3000/api/files/meetings/2026/meeting-sample.pdf", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    const authRes = await GET(authReq, {
      params: Promise.resolve({ path: ["meetings", "2026", "meeting-sample.pdf"] }),
    });
    assert.equal(authRes.status, 200);

    // Unauthorized staff user (not in meeting, not organizer, not admin)
    const unauthReq = new NextRequest("http://localhost:3000/api/files/meetings/2026/meeting-sample.pdf", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${unauthorizedToken}` },
    });
    const unauthRes = await GET(unauthReq, {
      params: Promise.resolve({ path: ["meetings", "2026", "meeting-sample.pdf"] }),
    });
    assert.equal(unauthRes.status, 403);
  });
});
