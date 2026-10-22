import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Trang cuộc họp: viền focus của ô nhập kín bề ngang không bị cột cuộn cắt", () => {
  it("cột nội dung có overflow-x-hidden thì lấn ra 4px mỗi bên (`-mx-1 px-1`) để viền focus 1px hiện đủ", () => {
    const src = fs.readFileSync(path.join(import.meta.dirname, "../src/components/meetings/meeting-detail-view.tsx"), "utf8");
    const column = /className="([^"]*lg:overflow-x-hidden[^"]*lg:pt-6[^"]*)"/.exec(src);
    assert.ok(column, "không thấy cột nội dung của trang chi tiết cuộc họp");
    assert.match(column[1], /lg:-mx-1/);
    assert.match(column[1], /lg:px-1/);
  });
});
