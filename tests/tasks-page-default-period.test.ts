import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("Trang /tasks: không tự lọc theo tháng hiện tại", () => {
  const src = readFileSync("src/app/tasks/tasks-page-client.tsx", "utf8");

  it("không truyền defaultMonth cho useWorkspaceQuery (mặc định hiển thị tất cả thời gian)", () => {
    assert.ok(!src.includes("defaultMonth"));
    assert.ok(!src.includes("getCurrentAcademicPeriod"));
  });

  it("vẫn giữ phạm vi mặc định theo vai trò; không còn kiểu xem Kanban", () => {
    assert.ok(src.includes("defaultScope"));
    assert.ok(!/kanban/i.test(src), "trang /tasks chỉ còn dạng bảng");
  });
});
