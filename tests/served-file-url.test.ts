import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { toServedFileUrl } from "../src/lib/url-utils";

describe("toServedFileUrl", () => {
  test("đường dẫn trần đi qua route tệp có kiểm tra quyền", () => {
    assert.equal(toServedFileUrl("/documents/2026/a.pdf"), "/api/files/documents/2026/a.pdf");
    assert.equal(toServedFileUrl("uploads/15/a.pdf"), "/api/files/15/a.pdf");
    assert.equal(toServedFileUrl("/uploads/15/a.pdf"), "/api/files/15/a.pdf");
  });

  test("giữ nguyên URL đã phục vụ được", () => {
    assert.equal(toServedFileUrl("/api/file-objects/abc"), "/api/file-objects/abc");
    assert.equal(toServedFileUrl("/api/files/x.pdf"), "/api/files/x.pdf");
    assert.equal(toServedFileUrl("https://example.com/a.pdf"), "https://example.com/a.pdf");
    assert.equal(toServedFileUrl("blob:http://localhost/1"), "blob:http://localhost/1");
  });

  test("rỗng -> null", () => {
    assert.equal(toServedFileUrl(""), null);
    assert.equal(toServedFileUrl(null), null);
  });
});
