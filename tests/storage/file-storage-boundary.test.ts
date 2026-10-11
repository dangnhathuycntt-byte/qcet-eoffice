import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getPrivateStorageDir, resolveSafePrivatePath, validateMimeType, detectMimeType, ALLOWED_MIME_TYPES } from "../../src/storage/private-files";

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
  });
});
