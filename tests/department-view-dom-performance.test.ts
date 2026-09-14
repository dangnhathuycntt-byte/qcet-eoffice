import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DepartmentGroupedTaskView,
  DEFAULT_PAGE_SIZE,
} from "../src/components/dashboard/department-grouped-task-view";
import type { SchoolTask } from "../src/types/dashboard";

function createDummySchoolTasks(count: number, deptCode: string = "K_CNTT"): SchoolTask[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `TASK-DUMMY-${i + 1}`,
    taskCode: `NV-DM-${String(i + 1).padStart(3, "0")}`,
    title: `Nhiệm vụ kiểm thử hiệu năng số ${i + 1}`,
    department: "Khoa Công nghệ Thông tin",
    departmentCode: deptCode,
    leadDepartment: "Khoa Công nghệ Thông tin",
    leadDepartmentCode: deptCode,
    leadAssigneeName: `Giảng viên ${i + 1}`,
    coAssignees: [],
    assignedDate: "2026-09-01",
    status: "IN_PROGRESS",
    category: "CNTT",
    categoryLabel: "Công nghệ thông tin",
    assignedTo: `Giảng viên ${i + 1}`,
    dueDate: "2026-09-30",
    progressPercent: 50,
    subTasks: [],
    totalSubTasks: 0,
    completedSubTasks: 0,
  }));
}

describe("Department View DOM Performance & Progressive Local Pagination (Task 11)", () => {
  test("Render với 60 nhiệm vụ: chỉ hiển thị tối đa 25 items ban đầu và nút Xem thêm", () => {
    const dummyTasks = createDummySchoolTasks(60, "K_CNTT");
    const html = renderToStaticMarkup(
      React.createElement(DepartmentGroupedTaskView, {
        tasks: dummyTasks,
        onSelectTask: () => {},
        selectedDepartmentFilter: "K_CNTT",
      })
    );

    // Verify container has content-auto
    assert.ok(
      html.includes("content-auto"),
      "Rendered markup must have content-auto class on container"
    );

    // Count rendered task rows
    // Each row has text like 'Nhiệm vụ kiểm thử hiệu năng số X'
    const renderedTaskMatches = html.match(/Nhiệm vụ kiểm thử hiệu năng số \d+/g) || [];
    assert.equal(
      renderedTaskMatches.length,
      25,
      `Expected exactly 25 tasks rendered initially, but found ${renderedTaskMatches.length}`
    );

    // Verify 'Xem thêm' button exists and shows remaining 35 tasks
    assert.ok(
      html.includes("Xem thêm 25 công việc (còn 35)"),
      "Must display 'Xem thêm 25 công việc (còn 35)' button"
    );
    assert.ok(
      html.includes("Đang hiển thị 25 / 60"),
      "Must display current visible counter 'Đang hiển thị 25 / 60'"
    );
  });

  test("Render với initialVisibleCounts = 50: hiển thị 50 items và còn lại 10", () => {
    const dummyTasks = createDummySchoolTasks(60, "K_CNTT");
    const html = renderToStaticMarkup(
      React.createElement(DepartmentGroupedTaskView, {
        tasks: dummyTasks,
        onSelectTask: () => {},
        selectedDepartmentFilter: "K_CNTT",
        initialVisibleCounts: { K_CNTT: 50 },
      })
    );

    const renderedTaskMatches = html.match(/Nhiệm vụ kiểm thử hiệu năng số \d+/g) || [];
    assert.equal(
      renderedTaskMatches.length,
      50,
      `Expected 50 tasks rendered when initialVisibleCounts is 50, but found ${renderedTaskMatches.length}`
    );

    // Button should now offer to load remaining 10
    assert.ok(
      html.includes("Xem thêm 10 công việc (còn 10)"),
      "Must display 'Xem thêm 10 công việc (còn 10)' button"
    );
    assert.ok(
      html.includes("Đang hiển thị 50 / 60"),
      "Must display current visible counter 'Đang hiển thị 50 / 60'"
    );
  });

  test("Render với initialVisibleCounts = 60: hiển thị toàn bộ 60 items và ẩn nút Xem thêm", () => {
    const dummyTasks = createDummySchoolTasks(60, "K_CNTT");
    const html = renderToStaticMarkup(
      React.createElement(DepartmentGroupedTaskView, {
        tasks: dummyTasks,
        onSelectTask: () => {},
        selectedDepartmentFilter: "K_CNTT",
        initialVisibleCounts: { K_CNTT: 60 },
      })
    );

    const renderedTaskMatches = html.match(/Nhiệm vụ kiểm thử hiệu năng số \d+/g) || [];
    assert.equal(
      renderedTaskMatches.length,
      60,
      `Expected all 60 tasks rendered, found ${renderedTaskMatches.length}`
    );

    // 'Xem thêm' button must not be present when all tasks are shown
    assert.ok(
      !html.includes("Xem thêm"),
      "Load more button must be absent when all tasks are visible"
    );
  });

  test("Phòng ban có ít hơn hoặc bằng 25 nhiệm vụ không hiển thị nút Xem thêm", () => {
    const dummyTasks = createDummySchoolTasks(20, "K_CNTT");
    const html = renderToStaticMarkup(
      React.createElement(DepartmentGroupedTaskView, {
        tasks: dummyTasks,
        onSelectTask: () => {},
        selectedDepartmentFilter: "K_CNTT",
      })
    );

    const renderedTaskMatches = html.match(/Nhiệm vụ kiểm thử hiệu năng số \d+/g) || [];
    assert.equal(renderedTaskMatches.length, 20);
    assert.ok(
      !html.includes("Xem thêm"),
      "Must not display 'Xem thêm' when task count <= DEFAULT_PAGE_SIZE"
    );
  });

  test("Mô phỏng chu trình tăng số lượng hiển thị (progressive increment logic)", () => {
    let currentCount = DEFAULT_PAGE_SIZE;
    const totalCount = 60;

    // First load more: 25 -> 50
    currentCount = Math.min(currentCount + DEFAULT_PAGE_SIZE, totalCount);
    assert.equal(currentCount, 50);

    // Second load more: 50 -> 60 (clamped at totalCount)
    currentCount = Math.min(currentCount + DEFAULT_PAGE_SIZE, totalCount);
    assert.equal(currentCount, 60);

    // No remaining
    const remaining = totalCount - currentCount;
    assert.equal(remaining, 0);
  });
});
