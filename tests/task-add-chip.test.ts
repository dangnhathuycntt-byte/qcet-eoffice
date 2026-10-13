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
    const withIcon = renderToStaticMarkup(React.createElement(TaskAddChip, { onClick: () => {}, children: "Xin gia hạn" }));
    assert.ok(withIcon.includes('data-slot="task-add-chip"'));
    assert.ok(withIcon.includes("order-last") && withIcon.includes("h-7") && withIcon.includes("text-xs"));
    assert.ok(withIcon.includes("<svg"), "mặc định có dấu +");
    const noIcon = renderToStaticMarkup(React.createElement(TaskAddChip, { onClick: () => {}, icon: false, children: "Từ chối nhận việc" }));
    assert.ok(!noIcon.includes("<svg"), "thao tác không phải thêm thì không có dấu +");
  });

  test("khối tùy chọn trống là mục của menu \"+ Thêm\" (TaskAddPanel); từ chối nhận việc là chip riêng", () => {
    for (const file of ["task-extension", "task-people", "task-backup-reviewer", "task-unit-requests", "task-criteria", "task-approval-process"]) {
      const src = read(`src/components/tasks/detail/${file}.tsx`);
      assert.ok(src.includes("<TaskAddPanel"), file);
      assert.ok(!src.includes("<TaskAddChip"), file);
    }
    assert.ok(read("src/components/tasks/detail/task-decline.tsx").includes("<TaskAddChip"));

    const page = read("src/components/tasks/task-detail-page.tsx");
    const region = page.slice(page.indexOf("<TaskOptionalSections>"), page.indexOf("</TaskOptionalSections>"));
    for (const name of ["<TaskExtension", "<TaskPeople", "<TaskApprovalProcess", "<TaskBackupReviewer", "<TaskUnitRequests", "<TaskCriteria"]) {
      assert.ok(region.includes(name), name);
    }
  });

  test("\"+ Thêm\" và \"Từ chối nhận việc\" nằm ở cột Thuộc tính; cột đó ẩn thì về dưới trình soạn thảo", () => {
    const page = read("src/components/tasks/task-detail-page.tsx");
    const row = page.slice(page.indexOf("const taskActionRow"), page.indexOf("const inspectorNode"));
    assert.ok(row.includes("<TaskOptionalMenu />") && row.includes("<TaskDecline"));
    assert.ok(page.includes("actions={inspectorVisible ? taskActionRow : null}"));
    const region = page.slice(page.indexOf("<TaskOptionalSections>"), page.indexOf("</TaskOptionalSections>"));
    assert.ok(region.includes("{!inspectorVisible && taskActionRow}"));
    // Provider bọc cả cột thuộc tính để nút trong cột đó thấy các khối đã đăng ký
    assert.ok(page.indexOf("<TaskOptionalMenuProvider>") < page.indexOf("<TaskDetailSplitLayout"));
  });

  test("menu \"+ Thêm\" tạm chỉ còn Phối hợp liên đơn vị; Xin gia hạn mở từ ô Hạn hoàn thành; tạm ẩn từ chối nhận việc", () => {
    const chip = read("src/components/tasks/detail/task-add-chip.tsx");
    assert.match(chip, /const ENTRY_ORDER: TaskOptionalKey\[\] = \["unit-request"\];/);
    const sidebar = read("src/components/tasks/detail/task-properties-sidebar.tsx");
    assert.ok(sidebar.includes('useTaskOptionalEntry("extension")') && sidebar.includes("extensionEntry.open(e.currentTarget)"));
    assert.match(read("src/components/tasks/detail/task-decline.tsx"), /const DECLINE_ENTRY_ENABLED = false;/);
  });

  test("văn bản gốc chỉ hiện một lần: cột Thuộc tính, hoặc dưới tiêu đề khi cột đó ẩn", () => {
    assert.ok(!read("src/components/tasks/task-detail-page.tsx").includes("<TaskSourceDocumentBadge"));
    const identity = read("src/components/tasks/detail/task-identity-block.tsx");
    assert.ok(/showInlineProperties && isSchoolTask\(task\) && task\.sourceDocument/.test(identity));
  });
});
