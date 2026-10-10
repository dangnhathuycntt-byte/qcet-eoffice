/**
 * Chi tiết nhiệm vụ: khối tùy chọn trống thu thành chip (progressive disclosure), không chiếm cả hàng với nhãn và nút rời.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import * as fs from "fs";
import * as path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskAddChip } from "../src/components/tasks/detail/task-add-chip";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

describe("TaskAddChip", () => {
  test("chip cao 28px, chữ 12px, dồn về cuối hàng; có hoặc không có dấu +", () => {
    const withIcon = renderToStaticMarkup(React.createElement(TaskAddChip, { onClick: () => {} }, "Xin gia hạn"));
    assert.ok(withIcon.includes('data-slot="task-add-chip"'));
    assert.ok(withIcon.includes("order-last") && withIcon.includes("h-7") && withIcon.includes("text-xs"));
    assert.ok(withIcon.includes("<svg"), "mặc định có dấu +");
    const noIcon = renderToStaticMarkup(React.createElement(TaskAddChip, { onClick: () => {}, icon: false }, "Từ chối nhận việc"));
    assert.ok(!noIcon.includes("<svg"), "thao tác không phải thêm thì không có dấu +");
  });

  test("mọi khối tùy chọn dùng chip khi trống và nằm trong vùng task-optional-sections", () => {
    for (const file of ["task-extension", "task-people", "task-backup-reviewer", "task-unit-requests", "task-criteria", "task-approval-process", "task-decline"]) {
      assert.ok(read(`src/components/tasks/detail/${file}.tsx`).includes("<TaskAddChip"), file);
    }
    const page = read("src/components/tasks/task-detail-page.tsx");
    const start = page.indexOf('data-slot="task-optional-sections"');
    assert.ok(start > 0);
    const region = page.slice(start, page.indexOf("</div>", page.indexOf("<TaskDecline", start)));
    for (const name of ["<TaskExtension", "<TaskPeople", "<TaskApprovalProcess", "<TaskBackupReviewer", "<TaskUnitRequests", "<TaskCriteria", "<TaskDecline"]) {
      assert.ok(region.includes(name), name);
    }
  });
});
