import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { GET as getFileRoute } from "@/app/api/files/[...path]/route";
import { GET as downloadDocumentRoute } from "@/app/api/documents/download/route";
import {
  isAllowedFileExtension,
  sanitizeDownloadFilename,
  resolveSafeFilePath,
} from "@/lib/storage";

describe("File API Hardening & Secure Download (Task 13)", () => {
  const uploadsDir = path.resolve(process.env.UPLOADS_DIR || "./uploads");
  const testSandboxRel = "test_file_hardening_sandbox";
  const testSandboxAbs = path.join(uploadsDir, testSandboxRel);

  let adminUser: { id: string; email: string; name: string; role: string;};
  let deptAUser: { id: string; email: string; name: string; role: string;};
  let deptBUser: { id: string; email: string; name: string; role: string;};

  let adminToken: string;
  let deptAToken: string;
  let deptBToken: string;

  let deptAId: string;
  let deptBId: string;

  let testDocId: string;
  let testAttachmentId: string;
  let testTaskId: string;
  let testDeliverableId: string;

  const samplePdfContent = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\nQCET Secure Test PDF Content"
  );
  const sampleTxtContent = Buffer.from("QCET Secure Test Text File Content for Byte Range");

  function createRequest(
    url: string,
    options: {
      token?: string;
      headers?: Record<string, string>;
    } = {}
  ) {
    const headers = new Headers(options.headers);
    if (options.token) {
      headers.set("Cookie", `${SESSION_COOKIE_NAME}=${options.token}`);
    }
    return new NextRequest(url, { headers });
  }

  before(async () => {
    // 1. Prepare sandbox directory and files
    fs.mkdirSync(testSandboxAbs, { recursive: true });
    fs.writeFileSync(path.join(testSandboxAbs, "sample.pdf"), samplePdfContent);
    fs.writeFileSync(path.join(testSandboxAbs, "sample.txt"), sampleTxtContent);
    fs.writeFileSync(path.join(testSandboxAbs, "secret_doc.pdf"), samplePdfContent);

    // 2. Identify departments (non-BGH)
    const deptA = await prisma.organizationalUnit.findUnique({ where: { id: "P_TC" } }) || await prisma.organizationalUnit.findFirst({ where: { id: { not: "BGH" } } });
    const deptB = await prisma.organizationalUnit.findUnique({ where: { id: "K_CNTT" } }) || await prisma.organizationalUnit.findFirst({ where: { id: { notIn: ["BGH", deptA!.id] } } });
    assert.ok(deptA && deptB, "At least 2 non-BGH departments required for BOLA tests");
    deptAId = deptA.id;
    deptBId = deptB.id;

    // 3. Identify users
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    assert.ok(admin, "ADMIN user required");
    adminUser = { id: admin.id, email: admin.email, name: admin.name, role: admin.role};

    // Create explicit test staff users in Dept A and Dept B
    const userA = await prisma.user.create({
      data: {
        email: `test-staff-a-${Date.now()}@qcet.edu.vn`,
        name: "Test Staff Dept A",
        role: "CHUYEN_VIEN",

      },
    });
    deptAUser = { id: userA.id, email: userA.email, name: userA.name, role: userA.role};

    const userB = await prisma.user.create({
      data: {
        email: `test-staff-b-${Date.now()}@qcet.edu.vn`,
        name: "Test Staff Dept B",
        role: "CHUYEN_VIEN",

      },
    });
    deptBUser = { id: userB.id, email: userB.email, name: userB.name, role: userB.role};

    // 4. Generate tokens
    adminToken = signSessionToken({ id: adminUser.id, email: adminUser.email, name: adminUser.name, role: adminUser.role });
    deptAToken = signSessionToken({ id: deptAUser.id, email: deptAUser.email, name: deptAUser.name, role: deptAUser.role});
    deptBToken = signSessionToken({ id: deptBUser.id, email: deptBUser.email, name: deptBUser.name, role: deptBUser.role});

    // 5. Create private Document & DocumentAttachment restricted to Dept B
    const docYear = new Date().getFullYear();
    const testRegNum = Math.floor(Math.random() * 800000) + 100000;
    const doc = await prisma.document.create({
      data: {
        type: "VAN_BAN_DEN",
        documentYear: docYear,
        registrationNumber: testRegNum,
        originalNumber: `ORIG-${Date.now()}`,
        summary: "BOLA Protected Test Document",
        category: "Kế hoạch",
        issuingAuthority: "Dept B Authority",
        issuedDate: new Date(),
        leadDepartmentId: deptBId,
        registeredById: deptBUser.id,
      },
    });
    testDocId = doc.id;

    const attachment = await prisma.documentAttachment.create({
      data: {
        documentId: doc.id,
        fileName: "dept-b-private.pdf",
        fileUrl: `${testSandboxRel}/dept-b-private.pdf`,
        fileSize: samplePdfContent.length,
        mimeType: "application/pdf",
      },
    });
    testAttachmentId = attachment.id;
    fs.writeFileSync(path.join(testSandboxAbs, "dept-b-private.pdf"), samplePdfContent);

    // Register sample attachments for download tests (under Default Deny)
    await prisma.documentAttachment.create({
      data: {
        documentId: doc.id,
        fileName: "sample.pdf",
        fileUrl: `${testSandboxRel}/sample.pdf`,
        fileSize: samplePdfContent.length,
        mimeType: "application/pdf",
      },
    });
    await prisma.documentAttachment.create({
      data: {
        documentId: doc.id,
        fileName: "sample.txt",
        fileUrl: `${testSandboxRel}/sample.txt`,
        fileSize: sampleTxtContent.length,
        mimeType: "text/plain",
      },
    });

    // 6. Create Task & TaskDeliverable restricted to Dept B
    const task = await prisma.task.create({
      data: {
        title: "BOLA Protected Task Dept B",
        code: `TASK-${Date.now()}`,

        createdById: deptBUser.id,
        scope: "DEPARTMENT",
        status: "IN_PROGRESS",
        academicMonth: 9,
        academicYear: "2026-2027",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    testTaskId = task.id;

    const deliverable = await prisma.taskDeliverable.create({
      data: {
        taskId: task.id,
        title: "Confidential Deliverable Dept B",
        fileUrl: `${testSandboxRel}/dept-b-deliverable.pdf`,
        fileType: "application/pdf",
        fileSize: samplePdfContent.length,
        uploadedById: deptBUser.id,
      },
    });
    testDeliverableId = deliverable.id;
    fs.writeFileSync(path.join(testSandboxAbs, "dept-b-deliverable.pdf"), samplePdfContent);
  });

  after(async () => {
    // Clean up DB records
    try {
      if (testDeliverableId) {
        await prisma.taskDeliverable.delete({ where: { id: testDeliverableId } }).catch(() => {});
      }
      if (testTaskId) {
        await prisma.task.delete({ where: { id: testTaskId } }).catch(() => {});
      }
      if (testDocId) {
        await prisma.documentAttachment.deleteMany({ where: { documentId: testDocId } }).catch(() => {});
        await prisma.document.delete({ where: { id: testDocId } }).catch(() => {});
      }
      if (deptAUser?.id) {
        await prisma.user.delete({ where: { id: deptAUser.id } }).catch(() => {});
      }
      if (deptBUser?.id) {
        await prisma.user.delete({ where: { id: deptBUser.id } }).catch(() => {});
      }
    } catch {}

    // Clean up sandbox files
    try {
      if (fs.existsSync(testSandboxAbs)) {
        fs.rmSync(testSandboxAbs, { recursive: true, force: true });
      }
    } catch {}
  });

  describe("1. Storage Library Unit Invariants", () => {
    test("isAllowedFileExtension accepts only approved extensions", () => {
      const allowed = ["doc.pdf", "img.png", "photo.jpg", "p.jpeg", "anim.webp", "doc.docx", "data.xlsx", "notes.txt", "export.csv"];
      for (const f of allowed) {
        assert.equal(isAllowedFileExtension(f), true, `Expected ${f} to be allowed`);
      }

      const disallowed = ["script.sh", "app.exe", "vector.svg", "file.bat", "hack.php", ".env", "passwd"];
      for (const f of disallowed) {
        assert.equal(isAllowedFileExtension(f), false, `Expected ${f} to be rejected`);
      }
    });

    test("sanitizeDownloadFilename strips control chars, quotes, path characters and keeps safe names", () => {
      assert.equal(sanitizeDownloadFilename('evil"quote\r\n.pdf'), "evilquote.pdf");
      assert.equal(sanitizeDownloadFilename("../../etc/passwd.txt"), "passwd.txt");
      assert.equal(sanitizeDownloadFilename("file\x00name.docx"), "filename.docx");
      assert.equal(sanitizeDownloadFilename("Tài liệu 2026.pdf"), "Tài liệu 2026.pdf");
      assert.equal(sanitizeDownloadFilename(""), "download");
    });

    test("resolveSafeFilePath throws ForbiddenError on path traversal and disallowed extensions", () => {
      assert.throws(() => resolveSafeFilePath("../../etc/passwd"), /Access Denied/i);
      assert.throws(() => resolveSafeFilePath("%2e%2e/%2e%2e/etc/passwd"), /Access Denied/i);
      assert.throws(() => resolveSafeFilePath("test.sh"), /Disallowed file extension/i);
    });
  });

  describe("2. 401 Unauthenticated Access Rejections", () => {
    test("GET /api/files/[...path] rejects unauthenticated request with 401", async () => {
      const req = createRequest(`http://localhost:3000/api/files/${testSandboxRel}/sample.pdf`);
      const res = await getFileRoute(req, { params: Promise.resolve({ path: [testSandboxRel, "sample.pdf"] }) });

      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.code, "AUTH_REQUIRED");
      assert.equal(json.success, false);
    });

    test("GET /api/documents/download rejects unauthenticated request with 401", async () => {
      const req = createRequest(`http://localhost:3000/api/documents/download?file=${testSandboxRel}/sample.pdf`);
      const res = await downloadDocumentRoute(req);

      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.code, "AUTH_REQUIRED");
      assert.equal(json.success, false);
    });

    test("GET /api/documents/download with attachmentId rejects unauthenticated request with 401", async () => {
      const req = createRequest(`http://localhost:3000/api/documents/download?attachmentId=${testAttachmentId}`);
      const res = await downloadDocumentRoute(req);

      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.code, "AUTH_REQUIRED");
      assert.equal(json.success, false);
    });
  });

  describe("3. Path Traversal Rejections (OWASP A01 / A05)", () => {
    test("GET /api/files/[...path] rejects directory traversal with 403", async () => {
      const req = createRequest("http://localhost:3000/api/files/../../etc/passwd", { token: deptAToken });
      const res = await getFileRoute(req, { params: Promise.resolve({ path: ["..", "..", "etc", "passwd"] }) });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.code, "FORBIDDEN");
    });

    test("GET /api/files/[...path] rejects encoded traversal (%2e%2e) with 403", async () => {
      const req = createRequest("http://localhost:3000/api/files/%2e%2e/%2e%2e/etc/passwd", { token: deptAToken });
      const res = await getFileRoute(req, { params: Promise.resolve({ path: ["%2e%2e", "%2e%2e", "etc", "passwd"] }) });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.code, "FORBIDDEN");
    });

    test("GET /api/documents/download rejects file path traversal with 403", async () => {
      const req = createRequest("http://localhost:3000/api/documents/download?file=../../etc/passwd", { token: deptAToken });
      const res = await downloadDocumentRoute(req);

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.code, "FORBIDDEN");
    });

    test("GET /api/documents/download rejects encoded traversal parameter with 403", async () => {
      const req = createRequest("http://localhost:3000/api/documents/download?file=%2e%2e%2f%2e%2e%2fetc%2fpasswd", { token: deptAToken });
      const res = await downloadDocumentRoute(req);

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.code, "FORBIDDEN");
    });
  });

  describe("4. Disallowed File Extension Rejections", () => {
    test("GET /api/files/[...path] rejects .sh script with 403", async () => {
      const req = createRequest("http://localhost:3000/api/files/test.sh", { token: deptAToken });
      const res = await getFileRoute(req, { params: Promise.resolve({ path: ["test.sh"] }) });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.code, "FORBIDDEN");
    });

    test("GET /api/files/[...path] rejects .exe executable with 403", async () => {
      const req = createRequest("http://localhost:3000/api/files/payload.exe", { token: deptAToken });
      const res = await getFileRoute(req, { params: Promise.resolve({ path: ["payload.exe"] }) });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.code, "FORBIDDEN");
    });

    test("GET /api/files/[...path] rejects .svg vector file with 403", async () => {
      const req = createRequest("http://localhost:3000/api/files/graphic.svg", { token: deptAToken });
      const res = await getFileRoute(req, { params: Promise.resolve({ path: ["graphic.svg"] }) });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.code, "FORBIDDEN");
    });

    test("GET /api/documents/download rejects disallowed extensions (.sh, .exe, .svg) with 403", async () => {
      const extensions = ["exploit.sh", "trojan.exe", "xss.svg"];
      for (const ext of extensions) {
        const req = createRequest(`http://localhost:3000/api/documents/download?file=${ext}`, { token: deptAToken });
        const res = await downloadDocumentRoute(req);
        assert.equal(res.status, 403, `Expected 403 for ${ext}`);
        const json = await res.json();
        assert.equal(json.code, "FORBIDDEN");
      }
    });
  });

  describe("5. Object-Level Authorization (BOLA / IDOR Prevention)", () => {
    test("GET /api/files/[...path] rejects unauthorized cross-department user with 403 for private document attachment", async () => {
      // Dept A user trying to access Dept B private document attachment
      const req = createRequest(`http://localhost:3000/api/files/${testSandboxRel}/dept-b-private.pdf`, { token: deptAToken });
      const res = await getFileRoute(req, { params: Promise.resolve({ path: [testSandboxRel, "dept-b-private.pdf"] }) });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.code, "FORBIDDEN");
    });

    test("GET /api/files/[...path] allows Dept B user and ADMIN to access Dept B document attachment", async () => {
      // Dept B user access
      const reqB = createRequest(`http://localhost:3000/api/files/${testSandboxRel}/dept-b-private.pdf`, { token: deptBToken });
      const resB = await getFileRoute(reqB, { params: Promise.resolve({ path: [testSandboxRel, "dept-b-private.pdf"] }) });
      assert.equal(resB.status, 200);

      // Admin user access
      const reqAdmin = createRequest(`http://localhost:3000/api/files/${testSandboxRel}/dept-b-private.pdf`, { token: adminToken });
      const resAdmin = await getFileRoute(reqAdmin, { params: Promise.resolve({ path: [testSandboxRel, "dept-b-private.pdf"] }) });
      assert.equal(resAdmin.status, 200);
    });

    test("GET /api/documents/download with attachmentId rejects unauthorized cross-department user with 403", async () => {
      // Dept A user trying to download Dept B attachment
      const req = createRequest(`http://localhost:3000/api/documents/download?attachmentId=${testAttachmentId}`, { token: deptAToken });
      const res = await downloadDocumentRoute(req);

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.code, "FORBIDDEN");
    });

    test("GET /api/documents/download with attachmentId allows authorized Dept B user and ADMIN", async () => {
      // Dept B user download
      const reqB = createRequest(`http://localhost:3000/api/documents/download?attachmentId=${testAttachmentId}`, { token: deptBToken });
      const resB = await downloadDocumentRoute(reqB);
      assert.equal(resB.status, 200);

      // Admin download
      const reqAdmin = createRequest(`http://localhost:3000/api/documents/download?attachmentId=${testAttachmentId}`, { token: adminToken });
      const resAdmin = await downloadDocumentRoute(reqAdmin);
      assert.equal(resAdmin.status, 200);
    });

    test("GET /api/files/[...path] rejects unauthorized cross-department user with 403 for task deliverable", async () => {
      // Dept A user trying to access Dept B deliverable
      const req = createRequest(`http://localhost:3000/api/files/${testSandboxRel}/dept-b-deliverable.pdf`, { token: deptAToken });
      const res = await getFileRoute(req, { params: Promise.resolve({ path: [testSandboxRel, "dept-b-deliverable.pdf"] }) });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.code, "FORBIDDEN");
    });
  });

  describe("6. Security Headers & Filename Sanitization", () => {
    test("Both endpoints set X-Content-Type-Options: nosniff and X-Frame-Options: DENY", async () => {
      // GET /api/files
      const req1 = createRequest(`http://localhost:3000/api/files/${testSandboxRel}/sample.pdf`, { token: adminToken });
      const res1 = await getFileRoute(req1, { params: Promise.resolve({ path: [testSandboxRel, "sample.pdf"] }) });
      assert.equal(res1.status, 200);
      assert.equal(res1.headers.get("x-content-type-options"), "nosniff");
      assert.equal(res1.headers.get("x-frame-options"), "DENY");
      assert.equal(res1.headers.get("cache-control"), "private, no-cache, no-store, must-revalidate");

      // GET /api/documents/download
      const req2 = createRequest(`http://localhost:3000/api/documents/download?file=${testSandboxRel}/sample.pdf`, { token: adminToken });
      const res2 = await downloadDocumentRoute(req2);
      assert.equal(res2.status, 200);
      assert.equal(res2.headers.get("x-content-type-options"), "nosniff");
      assert.equal(res2.headers.get("x-frame-options"), "DENY");
    });

    test("GET /api/documents/download sets Content-Disposition attachment with sanitized filename", async () => {
      const maliciousName = 'test"injection\r\nHeader:attack.pdf';
      const req = createRequest(
        `http://localhost:3000/api/documents/download?file=${testSandboxRel}/sample.pdf&name=${encodeURIComponent(maliciousName)}`,
        { token: adminToken }
      );
      const res = await downloadDocumentRoute(req);
      assert.equal(res.status, 200);

      const disposition = res.headers.get("content-disposition");
      assert.ok(disposition, "Content-Disposition header must be present");
      assert.ok(disposition.startsWith("attachment; filename="));
      // Must not contain raw quotes, carriage returns or newlines inside filename value
      assert.ok(!disposition.includes("\r"));
      assert.ok(!disposition.includes("\n"));
      assert.ok(disposition.includes("testinjectionHeaderattack.pdf"));
    });
  });

  describe("7. Range Requests (HTTP 206 & HTTP 416)", () => {
    test("Returns 206 Partial Content when Range header is valid", async () => {
      const req = createRequest(`http://localhost:3000/api/files/${testSandboxRel}/sample.txt`, {
        token: adminToken,
        headers: { range: "bytes=0-10" },
      });
      const res = await getFileRoute(req, { params: Promise.resolve({ path: [testSandboxRel, "sample.txt"] }) });

      assert.equal(res.status, 206);
      assert.equal(res.headers.get("accept-ranges"), "bytes");
      assert.equal(res.headers.get("content-range"), `bytes 0-10/${sampleTxtContent.length}`);
      assert.equal(res.headers.get("content-length"), "11");
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    });

    test("Returns 416 Range Not Satisfiable when Range header is out of bounds", async () => {
      const req = createRequest(`http://localhost:3000/api/files/${testSandboxRel}/sample.txt`, {
        token: adminToken,
        headers: { range: "bytes=99999-999999" },
      });
      const res = await getFileRoute(req, { params: Promise.resolve({ path: [testSandboxRel, "sample.txt"] }) });

      assert.equal(res.status, 416);
      assert.equal(res.headers.get("content-range"), `bytes */${sampleTxtContent.length}`);
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    });

    test("GET /api/documents/download also supports byte range requests", async () => {
      const req = createRequest(`http://localhost:3000/api/documents/download?file=${testSandboxRel}/sample.txt`, {
        token: adminToken,
        headers: { range: "bytes=5-15" },
      });
      const res = await downloadDocumentRoute(req);

      assert.equal(res.status, 206);
      assert.equal(res.headers.get("accept-ranges"), "bytes");
      assert.equal(res.headers.get("content-range"), `bytes 5-15/${sampleTxtContent.length}`);
    });
  });
});
