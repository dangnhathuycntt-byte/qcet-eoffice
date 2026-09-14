import { test, describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskPaginationBar } from "../src/components/tasks/table/components/task-pagination-bar";
import {
  getCategoryBadgeConfig,
  getStatusBadgeConfig,
  CATEGORY_TABS,
  filterTasksForTable,
} from "../src/components/dashboard/cascading-task-table";
import { flattenPersonalTasks } from "../src/components/tasks/cascading-task-table";
import type { SchoolTask } from "../src/types/dashboard";

describe("CascadingTaskTable Helpers", () => {
  test("provides distinct subtle badge styling for categories", () => {
    const attt = getCategoryBadgeConfig("ATTT");
    assert.equal(attt.label, "An toàn thông tin");
    assert.ok(attt.className.includes("text-"));

    const cds = getCategoryBadgeConfig("CHUYEN_DOI_SO");
    assert.equal(cds.label, "Chuyển đổi số");
    assert.ok(cds.className.includes("text-"));

    const cntt = getCategoryBadgeConfig("CNTT");
    assert.equal(cntt.label, "CNTT");

    const tt = getCategoryBadgeConfig("TRUYEN_THONG");
    assert.equal(tt.label, "Truyền thông");

    const tv = getCategoryBadgeConfig("THU_VIEN");
    assert.equal(tv.label, "Thư viện");

    const bc = getCategoryBadgeConfig("BAO_CAO");
    assert.equal(bc.label, "Báo cáo");

    const khac = getCategoryBadgeConfig("KHAC");
    assert.equal(khac.label, "Khác");
  });

  test("provides status badge config with Vietnamese labels", () => {
    const sNew = getStatusBadgeConfig("NEW");
    assert.equal(sNew.label, "Mới");
    assert.ok(
      sNew.className.includes("text-red-") || sNew.className.includes("text-rose-")
    );

    const sInProgress = getStatusBadgeConfig("IN_PROGRESS");
    assert.equal(sInProgress.label, "Đang thực hiện");
    assert.ok(sInProgress.className.includes("text-blue-700"));

    const sReview = getStatusBadgeConfig("NEEDS_REVIEW");
    assert.equal(sReview.label, "Cần chỉnh sửa");
    assert.ok(sReview.className.includes("text-amber-700"));

    const sDone = getStatusBadgeConfig("COMPLETED");
    assert.equal(sDone.label, "Hoàn thành");
    assert.ok(sDone.className.includes("text-emerald-700"));

    const sOverdue = getStatusBadgeConfig("OVERDUE");
    assert.equal(sOverdue.label, "Quá hạn");
    assert.ok(sOverdue.className.includes("text-rose-700"));
  });

  test("CATEGORY_TABS labels contain zero emojis", () => {
    CATEGORY_TABS.forEach((tab) => {
      assert.match(
        tab.label,
        /^[\p{L}\p{N}\s\-\/]+$/u,
        `Tab ${tab.label} must not contain emojis`
      );
    });
  });

  test("CATEGORY_TABS defines all required category filters in proper order", () => {
    const labels = CATEGORY_TABS.map((t) => t.label);
    assert.deepEqual(labels, [
      "Tất cả",
      "Chuyển đổi số",
      "Truyền thông",
      "CNTT",
      "An toàn thông tin",
      "Thư viện",
      "Báo cáo",
    ]);
  });

  test("filterTasksForTable filters by category and search keyword across parent and subtasks", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-1",
        title: "Triển khai SSO tập trung",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadAssigneeName: "Trần Hùng",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-15",
        status: "IN_PROGRESS",
        subTasks: [
          {
            id: "sub-1",
            title: "Cấu hình SAML 2.0",
            assigneeName: "Nguyễn Ngọc Vinh",
            status: "IN_PROGRESS",
            dueDate: "2026-09-10",
            parentSchoolTaskId: "task-1",
            updatedAt: "2026-09-02",
          },
        ],
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 0,
      },
      {
        id: "task-2",
        title: "Báo cáo an toàn thông tin tháng 8",
        category: "ATTT",
        categoryLabel: "An toàn thông tin",
        leadAssigneeName: "Mai Đinh Thị Xuân",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-05",
        status: "COMPLETED",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 100,
      },
    ];

    // Filter by category
    const atttOnly = filterTasksForTable(mockTasks, "ATTT", "");
    assert.equal(atttOnly.length, 1);
    assert.equal(atttOnly[0].id, "task-2");

    // All categories
    const all = filterTasksForTable(mockTasks, "ALL", "");
    assert.equal(all.length, 2);

    // Search by parent title
    const searchSSO = filterTasksForTable(mockTasks, "ALL", "SSO");
    assert.equal(searchSSO.length, 1);
    assert.equal(searchSSO[0].id, "task-1");

    // Search by subtask title
    const searchSAML = filterTasksForTable(mockTasks, "ALL", "SAML");
    assert.equal(searchSAML.length, 1);
    assert.equal(searchSAML[0].id, "task-1");

    // Search by assignee
    const searchVinh = filterTasksForTable(mockTasks, "ALL", "Vinh");
    assert.equal(searchVinh.length, 1);
    assert.equal(searchVinh[0].id, "task-1");

    // Empty search match
    const searchNone = filterTasksForTable(mockTasks, "ALL", "non-existent-xyz");
    assert.equal(searchNone.length, 0);
  });
});

describe("Task 6: Cascading Task Table Single Source of Truth", () => {
  it("filters tasks by relational departmentId and resolveDepartmentId without name heuristics", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-rel-1",
        title: "Nâng cấp hạ tầng mạng Core",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadAssigneeName: "Nguyễn Văn A",
        departmentId: "CNTT",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-20",
        status: "IN_PROGRESS",
        subTasks: [
          {
            id: "sub-rel-1",
            title: "Cấu hình Switch L3",
            assigneeName: "Kỹ thuật viên 1",
            departmentId: "CNTT",
            status: "IN_PROGRESS",
            dueDate: "2026-09-15",
            parentSchoolTaskId: "task-rel-1",
            updatedAt: "2026-09-02",
          },
        ],
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 50,
      },
      {
        id: "task-rel-2",
        title: "Báo cáo tuyển sinh năm 2026",
        category: "BAO_CAO",
        categoryLabel: "Báo cáo",
        leadAssigneeName: "Trần Thị B",
        departmentId: "DAO_TAO",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-10",
        status: "COMPLETED",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 100,
      },
    ];

    // Filter by departmentId CNTT
    const cnttTasks = filterTasksForTable(mockTasks, "ALL", "", "CNTT");
    assert.equal(cnttTasks.length, 1);
    assert.equal(cnttTasks[0].id, "task-rel-1");

    // Filter by departmentId DAO_TAO
    const daoTaoTasks = filterTasksForTable(mockTasks, "ALL", "", "DAO_TAO");
    assert.equal(daoTaoTasks.length, 1);
    assert.equal(daoTaoTasks[0].id, "task-rel-2");
  });
});

describe("Personal Scope Subtask First-Class UX Suite (MY_TASKS)", () => {
  it("flattens subtask into first-class row when staff is only assigned to the subtask", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "school-task-99",
        taskCode: "NV-TRUONG-99",
        title: "Kế hoạch nâng cấp mạng hạ tầng cơ sở 2026",
        category: "CNTT",
        categoryLabel: "Công nghệ thông tin",
        progressPercent: 50,
        totalSubTasks: 2,
        completedSubTasks: 0,
        coAssignees: [],
        leadAssigneeName: "Trưởng phòng Đào tạo",
        leadAssigneeId: "manager-01",
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        subTasks: [
          {
            id: "subtask-c1",
            code: "NV-TRUONG-99.01",
            title: "Cấu hình phân đoạn VLAN tầng 2",
            assigneeName: "Nguyễn Văn Chuyên Viên",
            assigneeId: "staff-cv-01",
            status: "IN_PROGRESS",
            dueDate: "2026-09-15",
            department: "Khoa CNTT",
            departmentId: "CNTT",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
          {
            id: "subtask-c2",
            code: "NV-TRUONG-99.02",
            title: "Kiểm thử thông tuyến cáp quang",
            assigneeName: "Cán bộ khác",
            assigneeId: "other-staff",
            status: "NEW",
            dueDate: "2026-09-20",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
        ],
      },
    ];

    // When viewed by "Nguyễn Văn Chuyên Viên"
    const flattened = flattenPersonalTasks(
      mockTasks,
      "Nguyễn Văn Chuyên Viên",
      "staff-cv-01"
    );

    // Should contain 1 first-class item (the subtask)
    assert.equal(flattened.length, 1);
    const item = flattened[0];
    assert.equal(item.id, "subtask-c1");
    assert.equal(item.title, "Cấu hình phân đoạn VLAN tầng 2");
    assert.equal(item.isSubtask, true);
    assert.equal(item.parentSchoolTaskId, "school-task-99");
    assert.equal(item.parentSchoolTaskCode, "NV-TRUONG-99");
    assert.equal(
      item.parentSchoolTaskTitle,
      "Kế hoạch nâng cấp mạng hạ tầng cơ sở 2026"
    );
  });
});

describe("Plan 10.8/10.9: shortcut strip removal, lightweight help trigger, compact pagination copy", () => {
  // NOTE on placement: neither src/components/tasks/cascading-task-table.tsx
  // (facade delegating to ModularCascadingTaskTable) nor
  // src/components/dashboard/cascading-task-table.tsx (re-export facade)
  // renders its own pagination footer markup — the footer lives in
  // src/components/tasks/table/components/task-pagination-bar.tsx and is
  // composed by ModularCascadingTaskTable. Pagination copy is therefore
  // asserted via source-string on task-pagination-bar.tsx plus a direct
  // render of TaskPaginationBar below, not via the facade components.

  it("persistent shortcut strip is absent: footer markup lacks 'Phím tắt nhanh'", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskPaginationBar, {
        currentPage: 1,
        pageSize: 10,
        totalItems: 95,
        onPageChange: () => {},
        onPageSizeChange: () => {},
      })
    );

    assert.ok(
      html.includes('aria-label="Phân trang bảng công việc"'),
      "footer must render so the absence assertion is not vacuous"
    );
    assert.ok(
      !html.includes("Phím tắt nhanh"),
      "collapsed footer must not persistently show the shortcut strip"
    );
  });

  it("pagination footer uses compact copy ('–' range + '/ N nhiệm vụ', '/ trang')", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskPaginationBar, {
        currentPage: 1,
        pageSize: 10,
        totalItems: 95,
        onPageChange: () => {},
        onPageSizeChange: () => {},
      })
    );
    assert.ok(html.includes("–"), "rendered footer must show the compact range");
    assert.ok(html.includes("95"), "rendered footer must show the total count");
    assert.ok(html.includes("nhiệm vụ"), "rendered footer must count in 'nhiệm vụ'");
    assert.ok(html.includes("/ trang"), "rendered page-size options must use '/ trang'");
    assert.ok(
      !html.includes("Hiển thị"),
      "rendered footer must not use verbose 'Hiển thị' copy"
    );
    assert.ok(
      !html.includes("trên tổng số"),
      "rendered footer must not use verbose 'trên tổng số' copy"
    );
  });
});

