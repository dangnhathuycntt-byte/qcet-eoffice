import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  getPrivateStorageDir,
  resolveSafePrivatePath,
  validateMimeType,
  detectMimeType,
  savePrivateFile,
  getPrivateFileMetadata,
  readPrivateFile,
  existsPrivateFile,
  deletePrivateFile,
  openPrivateFileStream,
  checkFileAuthorization,
  ALLOWED_MIME_TYPES,
} from "../../src/storage/private-files";
import {
  getTempStorageDir,
  createTemporaryFile,
  getTemporaryFile,
  readTemporaryFile,
  deleteTemporaryFile,
  isTemporaryFileExpired,
  cleanupExpiredTemporaryFiles,
} from "../../src/storage/temporary-files";

const TEST_STORAGE_ROOT = path.resolve("./test_storage_boundary_sandbox");
const TEST_PRIVATE_DIR = path.join(TEST_STORAGE_ROOT, "private");
const TEST_TEMP_DIR = path.join(TEST_STORAGE_ROOT, "temp");

describe("Private / Public File Storage Boundary Tests", () => {
  before(() => {
    process.env.PRIVATE_STORAGE_DIR = TEST_PRIVATE_DIR;
    process.env.TEMP_STORAGE_DIR = TEST_TEMP_DIR;
    fs.mkdirSync(TEST_PRIVATE_DIR, { recursive: true });
    fs.mkdirSync(TEST_TEMP_DIR, { recursive: true });
  });

  after(() => {
    delete process.env.PRIVATE_STORAGE_DIR;
    delete process.env.TEMP_STORAGE_DIR;
    fs.rmSync(TEST_STORAGE_ROOT, { recursive: true, force: true });
  });

  describe("1. Audit public/ Directory Boundary (Zero Confidential Files)", () => {
    it("should ensure public/documents directory does not exist", () => {
      const publicDocsPath = path.resolve(process.cwd(), "public/documents");
      assert.equal(
        fs.existsSync(publicDocsPath),
        false,
        "public/documents must not exist! Internal documents must never be served statically from public/"
      );
    });

    it("should ensure zero confidential or operational files (.doc, .docx, .xls, .xlsx, .pdf) in public/", () => {
      const publicRoot = path.resolve(process.cwd(), "public");
      const forbiddenExts = new Set([".doc", ".docx", ".xls", ".xlsx", ".pdf", ".env", ".key"]);

      function scanDir(dir: string): string[] {
        const findings: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            findings.push(...scanDir(fullPath));
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (forbiddenExts.has(ext)) {
              findings.push(fullPath);
            }
          }
        }
        return findings;
      }

      const violations = scanDir(publicRoot);
      assert.deepEqual(
        violations,
        [],
        `Confidential operational files found in public directory: ${violations.join(", ")}`
      );
    });

    it("should verify KeHoach_CongTac_Thang9_2026.doc is safely housed in private storage", () => {
      const privateDocPath = path.resolve(
        process.cwd(),
        "storage/private/documents/2026/KeHoach_CongTac_Thang9_2026.doc"
      );
      assert.ok(
        fs.existsSync(privateDocPath),
        `KeHoach_CongTac_Thang9_2026.doc must exist in secure private storage at ${privateDocPath}`
      );
      const stat = fs.statSync(privateDocPath);
      assert.ok(stat.size > 100000, "File size in private storage must be > 100KB");
    });
  });

  describe("2. Private Files Storage Operations & Security (src/storage/private-files.ts)", () => {
    it("should resolve valid paths strictly inside private storage directory", () => {
      const resolved = resolveSafePrivatePath("reports/2026/report.pdf");
      assert.equal(resolved, path.join(TEST_PRIVATE_DIR, "reports/2026/report.pdf"));
    });

    it("should reject path traversal attempts (../, ..\\, URL encoded, absolute paths)", () => {
      const traversalAttacks = [
        "../../etc/passwd",
        "..\\..\\windows\\win.ini",
        "docs/../../../shadow",
        "/etc/passwd",
        "C:\\Windows\\System32\\cmd.exe",
        "reports/%2e%2e/secret.key",
        "reports/%2fetc/passwd",
        "reports/..%5cpasswd",
        "documents/\0evil.pdf",
        "documents/%00evil.pdf",
      ];

      for (const attack of traversalAttacks) {
        assert.throws(
          () => resolveSafePrivatePath(attack),
          /Path traversal/i,
          `Failed to reject attack pattern: ${attack}`
        );
      }
    });

    it("should validate MIME types and check magic byte headers", () => {
      // Valid MIME checks
      assert.equal(validateMimeType("document.pdf").valid, true);
      assert.equal(validateMimeType("sheet.xlsx").valid, true);
      assert.equal(validateMimeType("photo.png").valid, true);

      // Banned executable types
      assert.equal(validateMimeType("malware.exe").valid, false);
      assert.equal(validateMimeType("script.sh").valid, false);
      assert.equal(validateMimeType("batch.bat").valid, false);

      // Magic numbers detection
      const fakePdfBuffer = Buffer.from("%PDF-1.7 header content here");
      assert.equal(detectMimeType("unknown.dat", fakePdfBuffer), "application/pdf");

      const fakePngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      assert.equal(detectMimeType("image.dat", fakePngBuffer), "image/png");

      const fakeJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      assert.equal(detectMimeType("pic.dat", fakeJpegBuffer), "image/jpeg");

      // Allowed whitelist checking
      const pdfOnly = ["application/pdf"];
      assert.equal(validateMimeType("doc.pdf", pdfOnly).valid, true);
      assert.equal(validateMimeType("doc.docx", pdfOnly).valid, false);
    });

    it("should execute full lifecycle: save, getMetadata, read, stream, exists, and delete", async () => {
      const relativePath = "academic/2026/dacum-matrix.pdf";
      const samplePdfContent = "%PDF-1.4 QCET DACUM Competency Matrix 2026-2027";

      // 1. Save file
      const saved = await savePrivateFile({
        relativePath,
        content: samplePdfContent,
        ownerId: "user-academic-01",
        departmentId: "phong-dao-tao",
        classification: "CONFIDENTIAL",
      });

      assert.equal(saved.relativePath, relativePath);
      assert.equal(saved.size, Buffer.byteLength(samplePdfContent));
      assert.equal(saved.mimeType, "application/pdf");
      assert.ok(saved.checksum);
      assert.equal(saved.classification, "CONFIDENTIAL");

      // 2. Exists check
      assert.equal(existsPrivateFile(relativePath), true);
      assert.equal(existsPrivateFile("non-existent.pdf"), false);

      // 3. Get Metadata
      const meta = await getPrivateFileMetadata(relativePath);
      assert.equal(meta.size, Buffer.byteLength(samplePdfContent));
      assert.equal(meta.mimeType, "application/pdf");

      // 4. Read content
      const buffer = await readPrivateFile(relativePath);
      assert.equal(buffer.toString("utf-8"), samplePdfContent);

      // 5. Open stream (HTTP 200)
      const streamRes = await openPrivateFileStream(relativePath);
      assert.equal(streamRes.status, 200);
      assert.equal(streamRes.headers["Content-Length"], Buffer.byteLength(samplePdfContent).toString());
      assert.ok(streamRes.stream);

      // 6. Open stream with Byte Range (HTTP 206)
      const rangeRes = await openPrivateFileStream(relativePath, "bytes=0-9");
      assert.equal(rangeRes.status, 206);
      assert.equal(rangeRes.headers["Content-Length"], "10");
      assert.ok(rangeRes.headers["Content-Range"]?.startsWith("bytes 0-9/"));

      // 7. Delete file
      const deleted = await deletePrivateFile(relativePath);
      assert.equal(deleted, true);
      assert.equal(existsPrivateFile(relativePath), false);
    });

    it("should prevent overwriting existing files unless overwrite is true", async () => {
      const filePath = "secure/policy.pdf";
      await savePrivateFile({
        relativePath: filePath,
        content: "%PDF-1.4 Initial Policy Version 1.0",
      });

      // Attempt overwrite without flag
      await assert.rejects(
        () =>
          savePrivateFile({
            relativePath: filePath,
            content: "%PDF-1.4 Policy Version 2.0",
            overwrite: false,
          }),
        /File already exists/
      );

      // Successful overwrite with flag
      const updated = await savePrivateFile({
        relativePath: filePath,
        content: "%PDF-1.4 Policy Version 2.0 Overwritten",
        overwrite: true,
      });
      assert.equal(updated.size, Buffer.byteLength("%PDF-1.4 Policy Version 2.0 Overwritten"));

      await deletePrivateFile(filePath);
    });

    it("should enforce checkFileAuthorization correctly across RBAC roles", () => {
      const confidentialDoc = {
        ownerId: "user-pdt-101",
        departmentId: "phong-dao-tao",
        classification: "CONFIDENTIAL" as const,
      };

      // 1. BGH / Admin should have access unconditionally
      const bghUser = { id: "user-bgh-1", role: "BGH", departmentId: "bgh" };
      const adminUser = { id: "user-admin-1", role: "ADMIN", departmentId: "phong-cntt" };
      assert.equal(checkFileAuthorization(bghUser, confidentialDoc), true);
      assert.equal(checkFileAuthorization(adminUser, confidentialDoc), true);

      // 2. Unauthenticated user denied
      assert.equal(checkFileAuthorization(null, confidentialDoc), false);

      // 3. Document owner has access
      const ownerUser = { id: "user-pdt-101", role: "GIANG_VIEN", departmentId: "khoa-cntt" };
      assert.equal(checkFileAuthorization(ownerUser, confidentialDoc), true);

      // 4. Same department user has access
      const colleagueUser = { id: "user-pdt-102", role: "CHUYEN_VIEN", departmentId: "phong-dao-tao" };
      assert.equal(checkFileAuthorization(colleagueUser, confidentialDoc), true);

      // 5. Different department non-elevated user denied
      const otherUser = { id: "user-kt-201", role: "CHUYEN_VIEN", departmentId: "phong-tai-chinh" };
      assert.equal(checkFileAuthorization(otherUser, confidentialDoc), false);

      // 6. Public classification allowed for authenticated staff
      const publicDoc = {
        ownerId: "user-pdt-101",
        departmentId: "phong-dao-tao",
        classification: "PUBLIC" as const,
      };
      assert.equal(checkFileAuthorization(otherUser, publicDoc), true);
    });
  });

  describe("3. Temporary Files Lifecycle & Cleanup (src/storage/temporary-files.ts)", () => {
    it("should create temporary file and retrieve active record", async () => {
      const record = await createTemporaryFile({
        fileName: "BaoCao_TienDo_Thang9.xlsx",
        content: "Fake Excel Binary Content for QCET",
        ownerId: "user-pdt-101",
        ttlMs: 10000, // 10 seconds
        metadata: { reportType: "monthly_export", academicMonth: 9 },
      });

      assert.ok(record.id);
      assert.equal(record.fileName, "BaoCao_TienDo_Thang9.xlsx");
      assert.equal(record.ownerId, "user-pdt-101");
      assert.equal(record.status, "active");
      assert.equal(record.metadata?.academicMonth, 9);
      assert.equal(isTemporaryFileExpired(record), false);

      // Retrieve record
      const fetched = await getTemporaryFile(record.id);
      assert.ok(fetched);
      assert.equal(fetched.id, record.id);
      assert.equal(fetched.status, "active");

      // Read content
      const content = await readTemporaryFile(record.id);
      assert.equal(content.toString("utf-8"), "Fake Excel Binary Content for QCET");
    });

    it("should detect expired temporary files and deny read", async () => {
      const record = await createTemporaryFile({
        fileName: "expired_preview.pdf",
        content: "%PDF-1.4 Expired Preview PDF",
        ownerId: "user-gv-02",
        ttlMs: 50, // 50ms TTL
      });

      // Advance time by passing simulated date in future
      const futureDate = new Date(Date.now() + 1000);
      assert.equal(isTemporaryFileExpired(record, futureDate), true);

      const fetchedExpired = await getTemporaryFile(record.id, futureDate);
      assert.ok(fetchedExpired);
      assert.equal(fetchedExpired.status, "expired");

      // Reading expired file must throw error
      await assert.rejects(
        () => readTemporaryFile(record.id, futureDate),
        /expired/i
      );
    });

    it("should clean up expired temporary files while keeping active ones", async () => {
      // Create 2 expired files and 1 active file
      const exp1 = await createTemporaryFile({
        fileName: "temp1.csv",
        content: "col1,col2\nval1,val2",
        ownerId: "u1",
        ttlMs: 10,
      });

      const exp2 = await createTemporaryFile({
        fileName: "temp2.csv",
        content: "colA,colB\nvalA,valB",
        ownerId: "u2",
        ttlMs: 10,
      });

      const active = await createTemporaryFile({
        fileName: "active_report.pdf",
        content: "%PDF-1.4 Long Lived Report",
        ownerId: "u3",
        ttlMs: 3600000, // 1 hour
      });

      // Advance time by 500ms to ensure exp1 & exp2 are expired
      const cleanupTime = new Date(Date.now() + 500);

      const summary = await cleanupExpiredTemporaryFiles({ now: cleanupTime });
      assert.ok(summary.cleanedCount >= 2, `Cleaned count was: ${summary.cleanedCount}`);
      assert.ok(summary.freedBytes > 0, `Freed bytes was: ${summary.freedBytes}`);
      assert.equal(summary.errors.length, 0);

      // exp1 and exp2 should be deleted
      assert.equal(await getTemporaryFile(exp1.id), null);
      assert.equal(await getTemporaryFile(exp2.id), null);

      // active should still exist
      const remainingActive = await getTemporaryFile(active.id);
      assert.ok(remainingActive);
      assert.equal(remainingActive.id, active.id);

      // Clean up active file explicitly
      await deleteTemporaryFile(active.id);
      assert.equal(await getTemporaryFile(active.id), null);
    });
  });
});
