import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildContentDisposition } from "../src/lib/storage";

describe("Content-Disposition với tên file tiếng Việt", () => {
  it("không ném lỗi khi tên có ký tự ngoài Latin-1 (vd. ầ, ệ)", () => {
    const name = "Thành phần 3 · Kanban, việc con, hoạt động, người@2x.png";
    const value = buildContentDisposition("inline", name);
    // Headers.set ném TypeError nếu có ký tự > 255; phải đặt được vào Headers
    const headers = new Headers();
    assert.doesNotThrow(() => headers.set("Content-Disposition", value));
    assert.ok(value.startsWith("inline;"));
    assert.ok(value.includes("filename*=UTF-8''"));
    // Bản ASCII dự phòng không chứa ký tự ngoài ASCII
    const ascii = /filename="([^"]*)"/.exec(value)?.[1] ?? "";
    assert.match(ascii, /^[\x20-\x7e]*$/);
  });

  it("tên người dùng chọn được mã hóa đúng trong filename*", () => {
    const value = buildContentDisposition("attachment", "Báo cáo tuyển sinh.pdf");
    assert.ok(value.startsWith("attachment;"));
    const encoded = /filename\*=UTF-8''(.+)$/.exec(value)?.[1] ?? "";
    assert.equal(decodeURIComponent(encoded), "Báo cáo tuyển sinh.pdf");
  });
});
