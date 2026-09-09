// @ts-nocheck
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getTaskTableReferenceDate,
  isTableTaskPastDue,
  isTableTaskDueToday,
  formatTableDate,
  getDaysDifference,
} from "../src/components/tasks/table/utils/table-date-helpers";
import {
  calculateWeightedProgress,
  calculateSimpleRollup,
  getDerivedTaskStatus,
} from "../src/components/tasks/table/utils/progress-rollup-calc";
import {
  filterTasks,
  sortTasks,
  paginateTasks,
  flattenPersonalTasks,
} from "../src/components/tasks/table/utils/table-filter-engine";
import {
  TABLE_DENSITY_CONFIG,
  STATUS_CONFIG,
  DEFAULT_PAGE_SIZES,
  CATEGORY_LABELS,
  SMART_FILTER_TABS,
} from "../src/components/tasks/table/constants";
import type { SchoolTask, StaffTask } from "@/types/dashboard";

describe("Task Table Engine - Foundations & Utilities", () => {
  describe("Constants & Configuration", () => {
    it("exports valid density configurations with positive row heights", () => {
      assert.ok(TABLE_DENSITY_CONFIG.compact.rowHeight > 0);
      assert.ok(TABLE_DENSITY_CONFIG.standard.rowHeight > TABLE_DENSITY_CONFIG.compact.rowHeight);
      assert.ok(TABLE_DENSITY_CONFIG.comfortable.rowHeight > TABLE_DENSITY_CONFIG.standard.rowHeight);
    });

    it("defines valid status badge configurations without dark: classes (Light-Only Standard)", () => {
      const statuses = ["IN_PROGRESS", "COMPLETED", "WAITING_APPROVAL", "CANCELLED", "BLOCKED"] as const;
      for (const st of statuses) {
        const config = STATUS_CONFIG[st];
        assert.ok(config, `Config for status ${st} must exist`);
        assert.ok(!config.badgeClass.includes("dark:"), `badgeClass must not contain dark: in ${st}`);
        assert.ok(!config.borderClass.includes("dark:"), `borderClass must not contain dark: in ${st}`);
      }
    });

    it("provides default page sizes including 10, 20, 50", () => {
      assert.deepEqual(DEFAULT_PAGE_SIZES, [10, 20, 50, 100]);
    });

    it("has 7 smart filter tabs with valid labels", () => {
      assert.equal(SMART_FILTER_TABS.length, 7);
      const tabIds = SMART_FILTER_TABS.map((t) => t.id);
      assert.ok(tabIds.includes("all"));
      assert.ok(tabIds.includes("my_tasks"));
      assert.ok(tabIds.includes("overdue"));
      assert.ok(tabIds.includes("review"));
      assert.ok(tabIds.includes("today"));
    });
  });

  describe("table-date-helpers", () => {
    const mockRefDate = new Date("2026-09-09T08:00:00.000Z");

    it("getTaskTableReferenceDate returns a valid Date instance", () => {
      const ref = getTaskTableReferenceDate();
      assert.ok(ref instanceof Date);
      assert.ok(!isNaN(ref.getTime()));
    });

    it("isTableTaskPastDue correctly identifies overdue tasks with UTC-safe date", () => {
      // Due yesterday
      const overdueTask = {
        dueDate: "2026-09-08",
        status: "IN_PROGRESS" as const,
      };
      assert.equal(isTableTaskPastDue(overdueTask, mockRefDate), true);

      // Due tomorrow
      const futureTask = {
        dueDate: "2026-09-10",
        status: "IN_PROGRESS" as const,
      };
      assert.equal(isTableTaskPastDue(futureTask, mockRefDate), false);

      // Completed tasks are never past due
      const completedOverdueTask = {
        dueDate: "2026-09-05",
        status: "COMPLETED" as const,
      };
      assert.equal(isTableTaskPastDue(completedOverdueTask, mockRefDate), false);
    });

    it("isTableTaskDueToday identifies tasks due on the reference date", () => {
      const todayTask = {
        dueDate: "2026-09-09",
      };
      const tomorrowTask = {
        dueDate: "2026-09-10",
      };
      assert.equal(isTableTaskDueToday(todayTask, mockRefDate), true);
      assert.equal(isTableTaskDueToday(tomorrowTask, mockRefDate), false);
    });

    it("formatTableDate formats ISO date strings in Vietnamese locale", () => {
      const formatted = formatTableDate("2026-09-09");
      assert.ok(formatted.includes("09") || formatted.includes("9"));
      assert.ok(formatted.includes("2026"));
      assert.equal(formatTableDate("invalid-date"), "—");
    });

    it("getDaysDifference calculates days remaining or overdue correctly", () => {
      // Due in 3 days
      assert.equal(getDaysDifference("2026-09-12", mockRefDate), 3);
      // Due 2 days ago
      assert.equal(getDaysDifference("2026-09-07", mockRefDate), -2);
      // Due today
      assert.equal(getDaysDifference("2026-09-09", mockRefDate), 0);
    });
  });

  describe("progress-rollup-calc", () => {
    it("calculates weighted progress using Sigma(P_i * W_i) / Sigma(W_i)", () => {
      const subtasks = [
        { progressPercent: 100, weight: 1 },
        { progressPercent: 50, weight: 3 },
      ];
      // (100*1 + 50*3) / (1 + 3) = (100 + 150) / 4 = 250 / 4 = 62.5 => rounds to 63
      const result = calculateWeightedProgress(subtasks);
      assert.equal(result, 63);
    });

    it("calculates equal weighted average when weight is not specified", () => {
      const subtasks = [
        { progressPercent: 100 },
        { progressPercent: 50 },
        { progressPercent: 0 },
      ];
      // (100 + 50 + 0) / 3 = 50
      assert.equal(calculateWeightedProgress(subtasks), 50);
    });

    it("handles zero or empty subtasks by returning parent fallback", () => {
      assert.equal(calculateWeightedProgress([], 45), 45);
      assert.equal(calculateWeightedProgress([], undefined), 0);
    });

    it("clamps progress between 0 and 100", () => {
      assert.equal(calculateWeightedProgress([{ progressPercent: 150, weight: 1 }]), 100);
      assert.equal(calculateWeightedProgress([{ progressPercent: -20, weight: 1 }]), 0);
    });

    it("calculateSimpleRollup returns correct subtask counts and average percent", () => {
      const subtasks: StaffTask[] = [
        {
          id: "sub-1",
          title: "Sub 1",
          status: "COMPLETED",
          dueDate: "2026-09-10",
          assigneeName: "Nguyễn Văn A",
          parentSchoolTaskId: "parent-1",
          updatedAt: "2026-09-01",
          progressPercent: 100,
        },
        {
          id: "sub-2",
          title: "Sub 2",
          status: "IN_PROGRESS",
          dueDate: "2026-09-15",
          assigneeName: "Trần Thị B",
          parentSchoolTaskId: "parent-1",
          updatedAt: "2026-09-01",
          progressPercent: 40,
        },
      ];

      const rollup = calculateSimpleRollup(subtasks);
      assert.equal(rollup.totalSubTasks, 2);
      assert.equal(rollup.completedSubTasks, 1);
      assert.equal(rollup.progressPercent, 70); // (100 + 40) / 2 = 70
    });

    it("getDerivedTaskStatus updates status based on progress and current status", () => {
      assert.equal(getDerivedTaskStatus(100, "IN_PROGRESS"), "COMPLETED");
      assert.equal(getDerivedTaskStatus(90, "COMPLETED"), "IN_PROGRESS");
      assert.equal(getDerivedTaskStatus(50, "WAITING_APPROVAL"), "WAITING_APPROVAL");
      assert.equal(getDerivedTaskStatus(0, "IN_PROGRESS"), "IN_PROGRESS");
    });
  });

  describe("table-filter-engine", () => {
    const mockRefDate = new Date("2026-09-09T08:00:00.000Z");

    const sampleTasks: SchoolTask[] = [
      {
        id: "task-1",
        code: "NV-001",
        taskCode: "NV-001",
        title: "Xây dựng hệ thống quản lý đào tạo E-Office",
        category: "CHUYEN_DOI_SO",
        categoryLabel: CATEGORY_LABELS.CHUYEN_DOI_SO,
        status: "IN_PROGRESS",
        priority: "HIGH",
        dueDate: "2026-09-05", // Overdue
        assignedDate: "2026-09-01",
        progressPercent: 60,
        totalSubTasks: 2,
        completedSubTasks: 1,
        leadAssigneeName: "Nguyễn Ngọc Vinh",
        leadAssigneeId: "user-vinh",
        leadDepartment: "Phòng CNTT",
        leadDepartmentCode: "CNTT",
        leadDepartmentId: "dept-cntt",
        subTasks: [
          {
            id: "sub-1-1",
            title: "Cấu hình server cơ sở dữ liệu",
            status: "COMPLETED",
            dueDate: "2026-09-04",
            assigneeName: "Nguyễn Ngọc Vinh",
            assigneeId: "user-vinh",
            parentSchoolTaskId: "task-1",
            updatedAt: "2026-09-04",
            progressPercent: 100,
          },
          {
            id: "sub-1-2",
            title: "Tối ưu truy vấn SQL",
            status: "IN_PROGRESS",
            dueDate: "2026-09-05",
            assigneeName: "Trần Văn Bình",
            assigneeId: "user-binh",
            parentSchoolTaskId: "task-1",
            updatedAt: "2026-09-05",
            progressPercent: 20,
          },
        ],
      },
      {
        id: "task-2",
        code: "NV-002",
        taskCode: "NV-002",
        title: "Tổ chức Hội thảo Đổi mới Phương pháp Giảng dạy DACUM",
        category: "KHAC",
        categoryLabel: "Khác",
        status: "WAITING_APPROVAL",
        priority: "URGENT",
        dueDate: "2026-09-09", // Today
        assignedDate: "2026-09-01",
        progressPercent: 95,
        totalSubTasks: 1,
        completedSubTasks: 1,
        leadAssigneeName: "Lê Văn Thí",
        leadAssigneeId: "user-thi",
        leadDepartment: "Phòng Đào tạo",
        leadDepartmentCode: "PĐT",
        leadDepartmentId: "dept-pdt",
        dacumTaskDef: {
          code: "DACUM-01",
          title: "Phân tích công việc đào tạo",
        },
        subTasks: [
          {
            id: "sub-2-1",
            title: "Biên tập tài liệu hội thảo",
            status: "WAITING_APPROVAL",
            dueDate: "2026-09-09",
            assigneeName: "Nguyễn Ngọc Vinh",
            assigneeId: "user-vinh",
            parentSchoolTaskId: "task-2",
            updatedAt: "2026-09-09",
            progressPercent: 95,
          },
        ],
      },
      {
        id: "task-3",
        code: "NV-003",
        taskCode: "NV-003",
        title: "Báo cáo thường niên công tác khảo thí",
        category: "BAO_CAO",
        categoryLabel: CATEGORY_LABELS.BAO_CAO,
        status: "COMPLETED",
        priority: "NORMAL",
        dueDate: "2026-09-20", // Future
        assignedDate: "2026-09-01",
        progressPercent: 100,
        totalSubTasks: 0,
        completedSubTasks: 0,
        leadAssigneeName: "Phạm Văn Tường",
        leadAssigneeId: "user-tuong",
        leadDepartment: "Phòng Khảo thí",
        leadDepartmentCode: "PKT",
        leadDepartmentId: "dept-pkt",
        coAssignees: ["Nguyễn Ngọc Vinh"],
        subTasks: [],
      },
    ];

    it("filters by smartTab 'all' returns all tasks", () => {
      const filtered = filterTasks(sampleTasks, { smartTab: "all", referenceDate: mockRefDate });
      assert.equal(filtered.length, 3);
    });

    it("filters by smartTab 'my_tasks' includes tasks where user is lead, collaborator, or subtask assignee", () => {
      const filtered = filterTasks(sampleTasks, {
        smartTab: "my_tasks",
        currentUserId: "user-vinh",
        currentUserName: "Nguyễn Ngọc Vinh",
        referenceDate: mockRefDate,
      });
      // task-1: lead assignee
      // task-2: subtask sub-2-1 assignee
      // task-3: coAssignee
      assert.equal(filtered.length, 3);

      const filteredThi = filterTasks(sampleTasks, {
        smartTab: "my_tasks",
        currentUserId: "user-thi",
        currentUserName: "Lê Văn Thí",
        referenceDate: mockRefDate,
      });
      assert.equal(filteredThi.length, 1);
      assert.equal(filteredThi[0].id, "task-2");
    });

    it("filters by smartTab 'overdue' returns incomplete tasks past due", () => {
      const filtered = filterTasks(sampleTasks, { smartTab: "overdue", referenceDate: mockRefDate });
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].id, "task-1");
    });

    it("filters by smartTab 'review' returns tasks in review or waiting approval", () => {
      const filtered = filterTasks(sampleTasks, { smartTab: "review", referenceDate: mockRefDate });
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].id, "task-2");
    });

    it("filters by smartTab 'today' returns tasks due on reference date", () => {
      const filtered = filterTasks(sampleTasks, { smartTab: "today", referenceDate: mockRefDate });
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].id, "task-2");
    });

    it("filters by department correctly", () => {
      const filtered = filterTasks(sampleTasks, { departmentId: "dept-cntt" });
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].id, "task-1");
    });

    it("filters by category correctly", () => {
      const filtered = filterTasks(sampleTasks, { category: "BAO_CAO" });
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].id, "task-3");
    });

    it("searches across titles, codes, DACUM info, assignees, and subtasks", () => {
      // Title match
      let res = filterTasks(sampleTasks, { searchQuery: "E-Office" });
      assert.equal(res.length, 1);
      assert.equal(res[0].id, "task-1");

      // Task Code match
      res = filterTasks(sampleTasks, { searchQuery: "NV-002" });
      assert.equal(res.length, 1);
      assert.equal(res[0].id, "task-2");

      // DACUM code match
      res = filterTasks(sampleTasks, { searchQuery: "DACUM-01" });
      assert.equal(res.length, 1);
      assert.equal(res[0].id, "task-2");

      // Subtask title match
      res = filterTasks(sampleTasks, { searchQuery: "truy vấn SQL" });
      assert.equal(res.length, 1);
      assert.equal(res[0].id, "task-1");
    });

    it("sorts tasks by dueDate asc/desc", () => {
      const asc = sortTasks(sampleTasks, { column: "dueDate", direction: "asc" });
      assert.equal(asc[0].id, "task-1"); // 2026-09-05
      assert.equal(asc[2].id, "task-3"); // 2026-09-20

      const desc = sortTasks(sampleTasks, { column: "dueDate", direction: "desc" });
      assert.equal(desc[0].id, "task-3"); // 2026-09-20
      assert.equal(desc[2].id, "task-1"); // 2026-09-05
    });

    it("sorts tasks by priority with custom priority order", () => {
      const sorted = sortTasks(sampleTasks, { column: "priority", direction: "desc" });
      assert.equal(sorted[0].priority, "URGENT");
      assert.equal(sorted[1].priority, "HIGH");
      assert.equal(sorted[2].priority, "NORMAL");
    });

    it("paginates task array cleanly", () => {
      const page1 = paginateTasks(sampleTasks, 1, 2);
      assert.equal(page1.items.length, 2);
      assert.equal(page1.totalPages, 2);
      assert.equal(page1.hasNext, true);
      assert.equal(page1.hasPrev, false);

      const page2 = paginateTasks(sampleTasks, 2, 2);
      assert.equal(page2.items.length, 1);
      assert.equal(page2.hasNext, false);
      assert.equal(page2.hasPrev, true);
    });

    it("flattenPersonalTasks extracts subtasks with parent breadcrumbs for personal workbox", () => {
      const flattened = flattenPersonalTasks(sampleTasks, "Nguyễn Ngọc Vinh", "user-vinh");

      // Vinh is lead of task-1 -> included as parent task
      const p1 = flattened.find((t) => t.id === "task-1");
      assert.ok(p1, "task-1 must be present because Vinh is lead");

      // Vinh is subtask assignee of sub-1-1
      const sub11 = flattened.find((t) => t.id === "sub-1-1");
      assert.ok(sub11, "sub-1-1 must be present");
      assert.equal(sub11.parentSchoolTaskId, "task-1");
      assert.equal(sub11.parentSchoolTaskCode, "NV-001");

      // Vinh is NOT lead of task-2, but is assignee of sub-2-1
      const p2 = flattened.find((t) => t.id === "task-2");
      assert.equal(p2, undefined, "task-2 must NOT be present as parent because Thí is lead");

      const sub21 = flattened.find((t) => t.id === "sub-2-1");
      assert.ok(sub21, "sub-2-1 must be present as a first-class row");
      assert.equal(sub21.parentSchoolTaskId, "task-2");
      assert.equal(sub21.parentSchoolTaskTitle, "Tổ chức Hội thảo Đổi mới Phương pháp Giảng dạy DACUM");
    });
  });
});
