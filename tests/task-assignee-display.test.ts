import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { formatAssigneeNameWithTitle } from "../src/lib/format/personnel";

describe("Hiển thị người phụ trách", () => {
  it("giữ tên người phụ trách, không thay bằng chức danh trong danh bạ", () => {
    const directory = [{ name: "Đặng Nhật Huy", title: "Nhân viên công nghệ thông tin" }];
    assert.equal(formatAssigneeNameWithTitle("Đặng Nhật Huy", directory), "Nhân viên công nghệ thông tin");
    // Hiển thị tên: gọi không kèm danh bạ
    assert.equal(formatAssigneeNameWithTitle("Đặng Nhật Huy"), "Đặng Nhật Huy");
  });

  it("drawer việc con hiển thị tên người phụ trách", () => {
    const src = readFileSync("src/components/tasks/detail/subtask-detail-drawer.tsx", "utf8");
    assert.ok(
      src.includes("formatAssigneeNameWithTitle(subtask?.assigneeName);"),
      "assigneeDisplay phải dùng tên, không truyền danh bạ"
    );
  });

  it("identity block đọc cả hai nhóm trường người phụ trách", () => {
    const src = readFileSync("src/components/tasks/detail/task-identity-block.tsx", "utf8");
    assert.ok(
      src.includes("anyTask.leadAssigneeName || anyTask.assigneeName"),
      "nhiệm vụ đơn vị có subTasks không được rơi vào nhánh trường học"
    );
  });
});
