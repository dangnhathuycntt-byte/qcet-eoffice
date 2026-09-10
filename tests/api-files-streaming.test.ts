import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/files/[...path]/route";

const TEST_UPLOADS_DIR = path.resolve("./test_uploads_sandbox");

describe("API Files Streaming & Security", () => {
  before(() => {
    process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;
    fs.mkdirSync(path.join(TEST_UPLOADS_DIR, "documents/2026"), { recursive: true });
    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, "documents/2026/sample.pdf"),
      "%PDF-1.4 Fake PDF Content for QCET Unit Test 1234567890"
    );
  });

  after(() => {
    fs.rmSync(TEST_UPLOADS_DIR, { recursive: true, force: true });
  });

  it("should serve existing PDF with 200 OK and correct headers", async () => {
    const req = new NextRequest("http://localhost:3000/api/files/documents/2026/sample.pdf");
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
      headers: { range: "bytes=0-9" },
    });
    const res = await GET(req, {
      params: Promise.resolve({ path: ["documents", "2026", "sample.pdf"] }),
    });

    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-length"), "10");
    assert.ok(res.headers.get("content-range")?.startsWith("bytes 0-9/"));
  });

  it("should block path traversal attempts with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/files/../etc/passwd");
    const res = await GET(req, {
      params: Promise.resolve({ path: ["..", "etc", "passwd"] }),
    });

    assert.equal(res.status, 403);
  });

  it("should return 404 for non-existent files", async () => {
    const req = new NextRequest("http://localhost:3000/api/files/documents/missing.pdf");
    const res = await GET(req, {
      params: Promise.resolve({ path: ["documents", "missing.pdf"] }),
    });

    assert.equal(res.status, 404);
  });
});
