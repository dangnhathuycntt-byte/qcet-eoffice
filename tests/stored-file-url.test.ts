import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAllowedStoredFileUrl } from "@/lib/url-utils";
import { SubmitDeliverableSchema } from "@/contracts/tasks";

describe("isAllowedStoredFileUrl — URL tệp/liên kết do client gửi", () => {
  it("chấp nhận đường dẫn nội bộ và URL http(s)", () => {
    for (const url of [
      "/api/file-objects/0d6c4a2e-1f1f-4c1c-9a1a-2b2b2b2b2b2b",
      "/api/files/documents/2026/a.pdf",
      "uploads/a.pdf",
      "https://drive.google.com/file/d/abc/view",
      "http://intranet.local/bao-cao.docx",
    ]) {
      assert.equal(isAllowedStoredFileUrl(url), true, url);
    }
  });

  it("chặn javascript:, data:, protocol-relative, backslash và ký tự điều khiển", () => {
    for (const url of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox",
      "//evil.example/x.pdf",
      "/api/files/..\\..\\etc",
      "/api/files/a.pdf\r\nSet-Cookie: x=y",
      "",
      "   ",
      null,
      undefined,
    ]) {
      assert.equal(isAllowedStoredFileUrl(url), false, String(url));
    }
  });

  it("SubmitDeliverableSchema từ chối fileUrl nguy hiểm", () => {
    const base = { title: "Minh chứng", fileName: "a.pdf" };
    assert.equal(SubmitDeliverableSchema.safeParse({ ...base, fileUrl: "javascript:alert(1)" }).success, false);
    assert.equal(SubmitDeliverableSchema.safeParse({ ...base, fileUrl: "//evil.example/a.pdf" }).success, false);
    assert.equal(SubmitDeliverableSchema.safeParse({ ...base, fileUrl: "https://drive.google.com/x" }).success, true);
    assert.equal(SubmitDeliverableSchema.safeParse({ ...base, fileUrl: "/api/file-objects/abc" }).success, true);
  });
});
