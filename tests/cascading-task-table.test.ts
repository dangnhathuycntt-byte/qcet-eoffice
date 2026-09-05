import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getCategoryBadgeConfig,
  getStatusBadgeConfig,
  CATEGORY_TABS,
  filterTasksForTable,
} from "../src/components/dashboard/cascading-task-table";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";

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
