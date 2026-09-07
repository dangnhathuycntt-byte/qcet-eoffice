import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import {
  resolveSafeFilePath,
  getMimeType,
  openByteRangeStream,
} from "../src/lib/storage";
import { GET } from "../src/app/api/documents/download/route";

const TEST_UPLOADS_DIR = path.resolve("./test_storage_sandbox");

describe("File Storage & Streaming Security Unit Tests", () => {
  before(() => {
    process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;
    fs.mkdirSync(path.join(TEST_UPLOADS_DIR, "docs/subfolder"), { recursive: true });
    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, "docs/sample.txt"),
      "0123456789" // 10 bytes
    );
    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, "docs/report.pdf"),
      "%PDF-1.4 sample content"
    );
  });

  after(() => {
    fs.rmSync(TEST_UPLOADS_DIR, { recursive: true, force: true });
  });

  describe("resolveSafeFilePath", () => {
    it("should resolve valid relative paths within UPLOADS_DIR", () => {
      const resolved = resolveSafeFilePath("docs/sample.txt");
      assert.equal(resolved, path.join(TEST_UPLOADS_DIR, "docs/sample.txt"));
    });

    it("should throw error on path traversal attempt with ../", () => {
      assert.throws(() => {
        resolveSafeFilePath("../../../etc/passwd");
      }, /Path traversal|Forbidden|Access Denied/i);
    });

    it("should throw error on absolute path traversal or escaping", () => {
      assert.throws(() => {
        resolveSafeFilePath("/etc/shadow");
      }, /Path traversal|Forbidden|Access Denied/i);
    });
  });

  describe("getMimeType", () => {
    it("should return correct mime types for common file extensions", () => {
      assert.equal(getMimeType("test.pdf"), "application/pdf");
      assert.equal(getMimeType("image.png"), "image/png");
      assert.equal(getMimeType("photo.jpg"), "image/jpeg");
      assert.equal(getMimeType("photo.jpeg"), "image/jpeg");
      assert.equal(getMimeType("graphic.webp"), "image/webp");
      assert.equal(getMimeType("doc.docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      assert.equal(getMimeType("sheet.xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      assert.equal(getMimeType("unknown.xyz"), "application/octet-stream");
    });
  });

  describe("openByteRangeStream", () => {
    it("should return status 200 with full stream when no range header provided", async () => {
      const filePath = path.join(TEST_UPLOADS_DIR, "docs/sample.txt");
      const result = await openByteRangeStream(filePath);
      assert.equal(result.status, 200);
      assert.equal(result.headers["Accept-Ranges"], "bytes");
      assert.equal(result.headers["Content-Length"], "10");
      assert.ok(result.stream);
    });

    it("should return status 206 with partial stream when valid range header provided", async () => {
      const filePath = path.join(TEST_UPLOADS_DIR, "docs/sample.txt");
      const result = await openByteRangeStream(filePath, "bytes=0-4");
      assert.equal(result.status, 206);
      assert.equal(result.headers["Content-Length"], "5");
      assert.equal(result.headers["Content-Range"], "bytes 0-4/10");
      assert.ok(result.stream);
    });

    it("should return status 416 when range is unsatisfiable", async () => {
      const filePath = path.join(TEST_UPLOADS_DIR, "docs/sample.txt");
      const result = await openByteRangeStream(filePath, "bytes=20-30");
      assert.equal(result.status, 416);
      assert.equal(result.headers["Content-Range"], "bytes */10");
    });
  });

  describe("GET /api/documents/download", () => {
    it("should serve requested file with download disposition", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents/download?file=docs/report.pdf&name=Report_Final.pdf");
      const res = await GET(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get("content-type"), "application/pdf");
      assert.equal(res.headers.get("accept-ranges"), "bytes");
      assert.ok(res.headers.get("content-disposition")?.includes("Report_Final.pdf"));
    });

    it("should return 403 when file query contains path traversal", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents/download?file=../../etc/passwd");
      const res = await GET(req);

      assert.equal(res.status, 403);
    });

    it("should return 404 when file does not exist", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents/download?file=docs/missing.pdf");
      const res = await GET(req);

      assert.equal(res.status, 404);
    });

    it("should return 400 when ?file parameter is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents/download");
      const res = await GET(req);

      assert.equal(res.status, 400);
    });

    it("should support byte-range requests for download route", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents/download?file=docs/sample.txt", {
        headers: { range: "bytes=2-6" },
      });
      const res = await GET(req);

      assert.equal(res.status, 206);
      assert.equal(res.headers.get("content-length"), "5");
      assert.equal(res.headers.get("content-range"), "bytes 2-6/10");
    });
  });
});
