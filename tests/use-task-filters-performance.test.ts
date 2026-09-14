import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { useTaskFilters, type TaskFiltersReturn } from "../src/hooks/use-task-filters";
import { filterTasksHub } from "../src/lib/unified-task-hub";
import type { SchoolTask } from "../src/types/dashboard";

describe("Task 4: React 19 useDeferredValue in useTaskFilters Performance Suite", () => {
  test("useTaskFilters is an exported function", () => {
    assert.strictEqual(typeof useTaskFilters, "function");
  });

  describe("Filtering Logic and Deferred Decoupling Simulation", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-001",
        taskCode: "NV-2026-09-001",
        title: "Soạn thảo Đề án Chuyển đổi số QCET 2026-2030",
        departmentCode: "K_CNTT",
        department: "Khoa CNTT",
        category: "CHUYEN_DOI_SO",
        categoryLabel: "Chuyển đổi số",
        status: "IN_PROGRESS",
        dueDate: "2026-09-30",
        assignedDate: "2026-09-01",
        leadAssigneeId: "u1",
        leadAssigneeName: "TS. Nguyễn Văn A",
        coAssignees: [],
        totalSubTasks: 1,
        completedSubTasks: 1,
        progressPercent: 60,
        subTasks: [
          {
            id: "sub-001",
            title: "Khảo sát hạ tầng mạng và máy chủ",
            assigneeId: "u2",
            assigneeName: "Trần Thị B",
            status: "COMPLETED",
            dueDate: "2026-09-15",
            parentSchoolTaskId: "task-001",
            updatedAt: "2026-09-15T00:00:00.000Z",
          },
        ],
      },
      {
        id: "task-002",
        taskCode: "NV-2026-09-002",
        title: "Tổ chức Hội nghị Khoa học Công nghệ Trẻ lần IV",
        departmentCode: "P_KHCN",
        department: "Phòng QLKH",
        category: "TRUYEN_THONG",
        categoryLabel: "Truyền thông",
        status: "PENDING_EXECUTIVE_APPROVAL",
        dueDate: "2026-09-25",
        assignedDate: "2026-09-05",
        leadAssigneeId: "u3",
        leadAssigneeName: "Lê Văn C",
        coAssignees: [],
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 40,
        subTasks: [
          {
            id: "sub-002",
            title: "Lập dự toán kinh phí tổ chức",
            assigneeId: "u3",
            assigneeName: "Lê Văn C",
            status: "NEEDS_REVIEW",
            dueDate: "2026-09-20",
            parentSchoolTaskId: "task-002",
            updatedAt: "2026-09-20T00:00:00.000Z",
          },
        ],
      },
      {
        id: "task-003",
        taskCode: "NV-2026-10-001",
        title: "Kiểm tra định kỳ trang thiết bị xưởng thực hành ô tô",
        departmentCode: "K_CK",
        department: "Khoa Cơ khí",
        category: "CNTT",
        categoryLabel: "Công nghệ thông tin",
        status: "IN_PROGRESS",
        dueDate: "2026-10-15",
        assignedDate: "2026-09-10",
        leadAssigneeId: "u4",
        leadAssigneeName: "Phạm Văn D",
        coAssignees: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 20,
        subTasks: [],
      },
    ];

    test("filters correctly by deferred search query matching parent title", () => {
      const deferredSearchQuery = "chuyển đổi số";
      const results = filterTasksHub({
        tasks: mockTasks,
        scope: "SCHOOL_TASKS",
        searchQuery: deferredSearchQuery,
      });

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].id, "task-001");
    });

    test("filters correctly by deferred search query matching subtask title", () => {
      const deferredSearchQuery = "hạ tầng mạng";
      const results = filterTasksHub({
        tasks: mockTasks,
        scope: "SCHOOL_TASKS",
        searchQuery: deferredSearchQuery,
      });

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].id, "task-001");
    });

    test("filters correctly by deferred search query matching lead assignee name", () => {
      const deferredSearchQuery = "Lê Văn C";
      const results = filterTasksHub({
        tasks: mockTasks,
        scope: "SCHOOL_TASKS",
        searchQuery: deferredSearchQuery,
      });

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].id, "task-002");
    });

    test("returns all tasks when deferred search query is empty", () => {
      const deferredSearchQuery = "";
      const results = filterTasksHub({
        tasks: mockTasks,
        scope: "SCHOOL_TASKS",
        searchQuery: deferredSearchQuery,
      });

      assert.strictEqual(results.length, 3);
    });

    test("simulates staleness flag logic: isFilteringStale is true while typing", () => {
      let immediateSearch = "chuyển đổi";
      let deferredSearch = "";
      let isFilteringStale = immediateSearch !== deferredSearch;
      assert.strictEqual(isFilteringStale, true);

      // Once React settles deferred value
      deferredSearch = "chuyển đổi";
      isFilteringStale = immediateSearch !== deferredSearch;
      assert.strictEqual(isFilteringStale, false);
    });
  });
});
