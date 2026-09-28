import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectUploadMimeType } from "../src/lib/storage";
import { getFileObjectIdFromUrl } from "../src/lib/services/file-service";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("FileObject upload contract", () => {
  it("derives MIME type from allowed content signatures", () => {
    assert.equal(detectUploadMimeType("scan.pdf", Buffer.from("%PDF-1.7 body")), "application/pdf");
    assert.equal(
      detectUploadMimeType("photo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "image/png"
    );
    assert.equal(detectUploadMimeType("notes.txt", Buffer.from("nội dung hợp lệ", "utf8")), "text/plain; charset=utf-8");
  });

  it("rejects extension spoofing, executable types, empty data, and non-UTF8 text", () => {
    assert.throws(() => detectUploadMimeType("report.pdf", Buffer.from("<html>not a PDF</html>")), /không khớp/i);
    assert.throws(() => detectUploadMimeType("payload.svg", Buffer.from("<svg/>")), /không được phép/i);
    assert.throws(() => detectUploadMimeType("empty.txt", Buffer.alloc(0)), /rỗng/i);
    assert.throws(() => detectUploadMimeType("binary.txt", Buffer.from([0xff, 0xfe, 0x00])), /không khớp/i);
  });

  it("extracts only local canonical FileObject URLs", () => {
    assert.equal(getFileObjectIdFromUrl(`/api/file-objects/${UUID}`), UUID);
    assert.equal(getFileObjectIdFromUrl(`https://example.invalid/api/file-objects/${UUID}`), null);
    assert.equal(getFileObjectIdFromUrl(`/api/files/${UUID}.pdf`), null);
    assert.equal(getFileObjectIdFromUrl(`/api/file-objects/${UUID}?download=1`), null);
  });
});
