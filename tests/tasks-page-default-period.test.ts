import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("Trang /tasks: không tự lọc theo tháng hiện tại", () => {
  const src = readFileSync("src/app/tasks/tasks-page-client.tsx", "utf8");

  it("không truyền defaultMonth cho useWorkspaceQuery (mặc định hiển thị tất cả thời gian)", () => {
    assert.ok(!src.includes("defaultMonth"));
    assert.ok(!src.includes("getCurrentAcademicPeriod"));
  });

  it("vẫn giữ các mặc định theo vai trò (phạm vi, kiểu xem)", () => {
    assert.ok(src.includes("defaultScope") && src.includes("defaultView"));
  });
});
