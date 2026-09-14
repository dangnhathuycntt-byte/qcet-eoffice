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
  getStatusBadgeConfig,
  getCategoryBadgeConfig,
} from "../src/components/tasks/table/constants";
import { getSlaBadgeStatus } from "../src/components/tasks/table/utils/table-date-helpers";
import { getPageNumbers } from "../src/components/tasks/table/components/task-pagination-bar";
import {
  areTaskRowPropsEqual,
  parseLeadAssignee,
} from "../src/components/tasks/table/components/task-row";
import {
  parseTaskUrlParams,
  serializeTaskUrlParams,
  buildTaskUrl,
  resolveTaskDetailHistoryMode,
  DEFAULT_TASK_URL_STATE,
} from "../src/components/tasks/table/hooks/use-task-url-sync";
import {
  keyboardNavReducer,
  handleKeyboardNavigation,
  isInputElement,
  type KeyboardNavState,
} from "../src/components/tasks/table/hooks/use-task-keyboard-nav";
import {
  calculateSelectionState,
  toggleSetItem,
  getNextSortDirection,
} from "../src/components/tasks/table/hooks/use-task-table-state";
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
        coAssignees: [],
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
        coAssignees: [],
        dacumTaskDef: {
          id: "dacum-01",
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

// ---------------------------------------------------------------------------
// Merged from task-table-hooks.test.ts — URL sync, keyboard nav & state engine
// ---------------------------------------------------------------------------
describe("Task Table Hooks - URL Sync, Keyboard Nav & State Engine", () => {
  describe("use-task-url-sync: URL Parameter Parsing & Serialization", () => {
    it("parses empty or missing parameters to default state", () => {
      const parsed = parseTaskUrlParams(null);
      assert.deepEqual(parsed, DEFAULT_TASK_URL_STATE);

      const parsedEmptyString = parseTaskUrlParams("");
      assert.deepEqual(parsedEmptyString, DEFAULT_TASK_URL_STATE);

      const parsedEmptyParams = parseTaskUrlParams(new URLSearchParams());
      assert.deepEqual(parsedEmptyParams, DEFAULT_TASK_URL_STATE);
    });

    it("parses all valid query parameters from a query string", () => {
      const qs =
        "view=kanban&tab=overdue&dept=CNTT&category=CHUYEN_DOI_SO&q=nhiem+vu&page=3&density=compact&taskId=task-101";
      const parsed = parseTaskUrlParams(qs);

      assert.equal(parsed.view, "kanban");
      assert.equal(parsed.tab, "overdue");
      assert.equal(parsed.dept, "CNTT");
      assert.equal(parsed.category, "CHUYEN_DOI_SO");
      assert.equal(parsed.q, "nhiem vu");
      assert.equal(parsed.page, 3);
      assert.equal(parsed.density, "compact");
      assert.equal(parsed.taskId, "task-101");
    });

    it("safely falls back to defaults when encountering invalid parameter values", () => {
      const invalidQs =
        "view=INVALID_VIEW&tab=UNKNOWN_TAB&category=NOT_A_CATEGORY&page=-5&density=SUPER_LARGE";
      const parsed = parseTaskUrlParams(invalidQs);

      assert.equal(parsed.view, "table");
      assert.equal(parsed.tab, "all");
      assert.equal(parsed.category, "ALL");
      assert.equal(parsed.page, 1);
      assert.equal(parsed.density, "comfortable");
    });

    it("maps 'OTHER' category alias to 'KHAC'", () => {
      const parsed = parseTaskUrlParams("category=OTHER");
      assert.equal(parsed.category, "KHAC");
    });

    it("omits default values during serialization for clean canonical URLs", () => {
      const serialized = serializeTaskUrlParams({
        view: "table",
        tab: "all",
        dept: "ALL",
        category: "ALL",
        q: "",
        page: 1,
        density: "comfortable",
        taskId: null,
      });

      assert.equal(serialized, "");
    });

    it("serializes non-default values correctly", () => {
      const serialized = serializeTaskUrlParams({
        view: "kanban",
        tab: "today",
        dept: "BGH",
        category: "TRUYEN_THONG",
        q: "hội thảo",
        page: 2,
        density: "compact",
        taskId: "task-999",
      });

      const params = new URLSearchParams(serialized);
      assert.equal(params.get("view"), "kanban");
      assert.equal(params.get("tab"), "today");
      assert.equal(params.get("dept"), "BGH");
      assert.equal(params.get("category"), "TRUYEN_THONG");
      assert.equal(params.get("q"), "hội thảo");
      assert.equal(params.get("page"), "2");
      assert.equal(params.get("density"), "compact");
      assert.equal(params.get("taskId"), "task-999");
    });

    it("preserves unrelated query parameters and prepends pathname with buildTaskUrl", () => {
      const initial = "foo=bar&theme=light&tab=all";
      const url = buildTaskUrl({ tab: "review", q: "báo cáo" }, initial, "/tasks");

      assert.ok(url.startsWith("/tasks?"));
      const qs = url.split("?")[1];
      const params = new URLSearchParams(qs);
      assert.equal(params.get("foo"), "bar");
      assert.equal(params.get("theme"), "light");
      assert.equal(params.get("tab"), "review");
      assert.equal(params.get("q"), "báo cáo");
    });

    it("T19: resolves historyMode correctly for open, switch, and close", () => {
      // Opening from list: null -> id => PUSH (so browser Back returns to list)
      assert.equal(resolveTaskDetailHistoryMode(null, "task-1"), "push");
      assert.equal(resolveTaskDetailHistoryMode(undefined, "task-1"), "push");
      assert.equal(resolveTaskDetailHistoryMode("", "task-1"), "push");

      // Switching between tasks: idA -> idB => REPLACE (prevents bloated Back stack)
      assert.equal(resolveTaskDetailHistoryMode("task-1", "task-2"), "replace");

      // Closing task detail: id -> null => REPLACE
      assert.equal(resolveTaskDetailHistoryMode("task-1", null), "replace");
      assert.equal(resolveTaskDetailHistoryMode("task-1", undefined), "replace");
      assert.equal(resolveTaskDetailHistoryMode("task-1", ""), "replace");

      // No-op: null -> null => REPLACE
      assert.equal(resolveTaskDetailHistoryMode(null, null), "replace");
    });
  });

  describe("use-task-keyboard-nav: Keyboard Navigation Reducer & Handler", () => {
    const mockIdList = ["task-1", "task-2", "task-3", "task-4"];
    const itemCount = mockIdList.length;

    it("reducer MOVE_DOWN moves from inactive (-1) to index 0", () => {
      const initial = { activeIndex: -1, activeId: null };
      const next = keyboardNavReducer(initial, {
        type: "MOVE_DOWN",
        itemCount,
        idList: mockIdList,
      });
      assert.equal(next.activeIndex, 0);
      assert.equal(next.activeId, "task-1");
    });

    it("reducer MOVE_DOWN increments index and clamps at itemCount - 1", () => {
      let state: KeyboardNavState = { activeIndex: 0, activeId: "task-1" };
      state = keyboardNavReducer(state, {
        type: "MOVE_DOWN",
        itemCount,
        idList: mockIdList,
      });
      assert.equal(state.activeIndex, 1);
      assert.equal(state.activeId, "task-2");

      state = keyboardNavReducer(state, {
        type: "MOVE_DOWN",
        itemCount,
        idList: mockIdList,
      });
      assert.equal(state.activeIndex, 2);

      state = keyboardNavReducer(state, {
        type: "MOVE_DOWN",
        itemCount,
        idList: mockIdList,
      });
      assert.equal(state.activeIndex, 3);
      assert.equal(state.activeId, "task-4");

      // Further MOVE_DOWN clamps at index 3
      state = keyboardNavReducer(state, {
        type: "MOVE_DOWN",
        itemCount,
        idList: mockIdList,
      });
      assert.equal(state.activeIndex, 3);
      assert.equal(state.activeId, "task-4");
    });

    it("reducer MOVE_UP decrements index and clamps at 0", () => {
      let state: KeyboardNavState = { activeIndex: 2, activeId: "task-3" };
      state = keyboardNavReducer(state, {
        type: "MOVE_UP",
        itemCount,
        idList: mockIdList,
      });
      assert.equal(state.activeIndex, 1);
      assert.equal(state.activeId, "task-2");

      state = keyboardNavReducer(state, {
        type: "MOVE_UP",
        itemCount,
        idList: mockIdList,
      });
      assert.equal(state.activeIndex, 0);
      assert.equal(state.activeId, "task-1");

      // Further MOVE_UP clamps at 0
      state = keyboardNavReducer(state, {
        type: "MOVE_UP",
        itemCount,
        idList: mockIdList,
      });
      assert.equal(state.activeIndex, 0);
      assert.equal(state.activeId, "task-1");
    });

    it("reducer SET_INDEX and SET_ID work correctly", () => {
      let state: KeyboardNavState = keyboardNavReducer(
        { activeIndex: -1, activeId: null },
        { type: "SET_INDEX", index: 2, itemCount, idList: mockIdList }
      );
      assert.equal(state.activeIndex, 2);
      assert.equal(state.activeId, "task-3");

      state = keyboardNavReducer(state, {
        type: "SET_ID",
        id: "task-4",
        idList: mockIdList,
      });
      assert.equal(state.activeIndex, 3);
      assert.equal(state.activeId, "task-4");

      state = keyboardNavReducer(state, { type: "RESET" });
      assert.equal(state.activeIndex, -1);
      assert.equal(state.activeId, null);
    });

    it("isInputElement correctly identifies input, textarea, and contenteditable elements", () => {
      assert.equal(isInputElement({ tagName: "INPUT" }), true);
      assert.equal(isInputElement({ tagName: "input" }), true);
      assert.equal(isInputElement({ tagName: "TEXTAREA" }), true);
      assert.equal(isInputElement({ tagName: "SELECT" }), true);
      assert.equal(isInputElement({ isContentEditable: true }), true);
      assert.equal(
        isInputElement({
          hasAttribute: (attr: string) => attr === "contenteditable",
        }),
        true
      );

      assert.equal(isInputElement({ tagName: "DIV" }), false);
      assert.equal(isInputElement({ tagName: "TR" }), false);
      assert.equal(isInputElement(null), false);
      assert.equal(isInputElement(undefined), false);
    });

    it("handleKeyboardNavigation ignores inputs and modifier keys", () => {
      let moved = false;
      const handledInput = handleKeyboardNavigation({
        event: {
          key: "j",
          target: { tagName: "INPUT" },
          preventDefault: () => {},
        },
        activeIndex: 0,
        itemCount,
        onMoveActive: () => {
          moved = true;
        },
      });
      assert.equal(handledInput, false);
      assert.equal(moved, false);

      const handledModifier = handleKeyboardNavigation({
        event: {
          key: "j",
          metaKey: true,
          preventDefault: () => {},
        },
        activeIndex: 0,
        itemCount,
        onMoveActive: () => {
          moved = true;
        },
      });
      assert.equal(handledModifier, false);
      assert.equal(moved, false);
    });

    it("handleKeyboardNavigation handles j/k and ArrowDown/ArrowUp", () => {
      let nextIndex = -1;
      let nextId = null;

      const handledJ = handleKeyboardNavigation({
        event: { key: "j", preventDefault: () => {} },
        activeIndex: 0,
        itemCount,
        idList: mockIdList,
        onMoveActive: (idx, id) => {
          nextIndex = idx;
          nextId = id;
        },
      });
      assert.equal(handledJ, true);
      assert.equal(nextIndex, 1);
      assert.equal(nextId, "task-2");

      const handledK = handleKeyboardNavigation({
        event: { key: "k", preventDefault: () => {} },
        activeIndex: 2,
        itemCount,
        idList: mockIdList,
        onMoveActive: (idx, id) => {
          nextIndex = idx;
          nextId = id;
        },
      });
      assert.equal(handledK, true);
      assert.equal(nextIndex, 1);
      assert.equal(nextId, "task-2");
    });

    it("handleKeyboardNavigation handles selection toggle on x and Space", () => {
      let toggledId = null;
      let preventedDefault = false;

      const handledX = handleKeyboardNavigation({
        event: {
          key: "x",
          preventDefault: () => {
            preventedDefault = true;
          },
        },
        activeIndex: 1,
        itemCount,
        idList: mockIdList,
        onToggleSelect: (id) => {
          toggledId = id;
        },
      });

      assert.equal(handledX, true);
      assert.equal(preventedDefault, true);
      assert.equal(toggledId, "task-2");

      preventedDefault = false;
      toggledId = null;
      const handledSpace = handleKeyboardNavigation({
        event: {
          key: " ",
          preventDefault: () => {
            preventedDefault = true;
          },
        },
        activeIndex: 2,
        itemCount,
        idList: mockIdList,
        onToggleSelect: (id) => {
          toggledId = id;
        },
      });

      assert.equal(handledSpace, true);
      assert.equal(preventedDefault, true);
      assert.equal(toggledId, "task-3");
    });

    it("handleKeyboardNavigation handles subtask expansion toggle on ArrowRight/ArrowLeft", () => {
      let expandedTarget = null;
      let expandMode = null;

      // ArrowRight when collapsed
      const handledRight = handleKeyboardNavigation({
        event: { key: "ArrowRight", preventDefault: () => {} },
        activeIndex: 0,
        itemCount,
        idList: mockIdList,
        isExpanded: () => false,
        onToggleExpand: (id, expand) => {
          expandedTarget = id;
          expandMode = expand;
        },
      });
      assert.equal(handledRight, true);
      assert.equal(expandedTarget, "task-1");
      assert.equal(expandMode, true);

      // ArrowLeft when expanded
      expandedTarget = null;
      expandMode = null;
      const handledLeft = handleKeyboardNavigation({
        event: { key: "ArrowLeft", preventDefault: () => {} },
        activeIndex: 0,
        itemCount,
        idList: mockIdList,
        isExpanded: () => true,
        onToggleExpand: (id, expand) => {
          expandedTarget = id;
          expandMode = expand;
        },
      });
      assert.equal(handledLeft, true);
      assert.equal(expandedTarget, "task-1");
      assert.equal(expandMode, false);
    });

    it("handleKeyboardNavigation respects hasSubtasks: false and does not toggle expansion", () => {
      let toggled = false;

      // ArrowRight when hasSubtasks returns false
      const handledRight = handleKeyboardNavigation({
        event: { key: "ArrowRight", preventDefault: () => {} },
        activeIndex: 0,
        itemCount,
        idList: mockIdList,
        hasSubtasks: () => false,
        isExpanded: () => false,
        onToggleExpand: () => {
          toggled = true;
        },
      });
      assert.equal(handledRight, false);
      assert.equal(toggled, false);

      // ArrowLeft when hasSubtasks returns false
      const handledLeft = handleKeyboardNavigation({
        event: { key: "ArrowLeft", preventDefault: () => {} },
        activeIndex: 0,
        itemCount,
        idList: mockIdList,
        hasSubtasks: () => false,
        isExpanded: () => true,
        onToggleExpand: () => {
          toggled = true;
        },
      });
      assert.equal(handledLeft, false);
      assert.equal(toggled, false);
    });

    it("handleKeyboardNavigation handles Enter to view details and Escape to clear selection", () => {
      let selectedDetailId = null;
      const handledEnter = handleKeyboardNavigation({
        event: { key: "Enter", preventDefault: () => {} },
        activeIndex: 2,
        itemCount,
        idList: mockIdList,
        onSelectTask: (id) => {
          selectedDetailId = id;
        },
      });
      assert.equal(handledEnter, true);
      assert.equal(selectedDetailId, "task-3");

      let cleared = false;
      let resetIdx = 0;
      const handledEsc = handleKeyboardNavigation({
        event: { key: "Escape", preventDefault: () => {} },
        activeIndex: 2,
        itemCount,
        idList: mockIdList,
        onClearSelection: () => {
          cleared = true;
        },
        onMoveActive: (idx) => {
          resetIdx = idx;
        },
      });
      assert.equal(handledEsc, true);
      assert.equal(cleared, true);
      assert.equal(resetIdx, -1);
    });
  });

  describe("use-task-table-state: Selection, Expansion & Sorting Helpers", () => {
    const visibleIds = ["task-1", "task-2", "task-3"];

    it("toggleSetItem adds absent item and removes present item immutably", () => {
      const set0 = new Set<string>();
      const set1 = toggleSetItem(set0, "a");
      assert.ok(set1.has("a"));
      assert.equal(set1.size, 1);
      assert.equal(set0.size, 0); // immutable

      const set2 = toggleSetItem(set1, "a");
      assert.ok(!set2.has("a"));
      assert.equal(set2.size, 0);
    });

    it("calculateSelectionState computes none selected correctly", () => {
      const res = calculateSelectionState(new Set(), visibleIds);
      assert.equal(res.allVisibleSelected, false);
      assert.equal(res.someVisibleSelected, false);
      assert.equal(res.totalSelected, 0);
    });

    it("calculateSelectionState computes indeterminate / some visible selected correctly", () => {
      const res = calculateSelectionState(new Set(["task-1"]), visibleIds);
      assert.equal(res.allVisibleSelected, false);
      assert.equal(res.someVisibleSelected, true);
      assert.equal(res.totalSelected, 1);
    });

    it("calculateSelectionState computes all visible selected correctly", () => {
      const res = calculateSelectionState(
        new Set(["task-1", "task-2", "task-3"]),
        visibleIds
      );
      assert.equal(res.allVisibleSelected, true);
      assert.equal(res.someVisibleSelected, false);
      assert.equal(res.totalSelected, 3);
    });

    it("calculateSelectionState handles empty visibleIds gracefully", () => {
      const res = calculateSelectionState(new Set(["other-task"]), []);
      assert.equal(res.allVisibleSelected, false);
      assert.equal(res.someVisibleSelected, false);
      assert.equal(res.totalSelected, 1);
    });

    it("getNextSortDirection follows asc -> desc -> reset transition cycle", () => {
      // 1. Initial click on new field -> asc
      const step1 = getNextSortDirection(undefined, "dueDate", "asc");
      assert.equal(step1.field, "dueDate");
      assert.equal(step1.direction, "asc");

      // 2. Click same field currently asc -> desc
      const step2 = getNextSortDirection("dueDate", "dueDate", "asc");
      assert.equal(step2.field, "dueDate");
      assert.equal(step2.direction, "desc");

      // 3. Click same field currently desc -> reset (undefined)
      const step3 = getNextSortDirection("dueDate", "dueDate", "desc");
      assert.equal(step3.field, undefined);
      assert.equal(step3.direction, "asc");

      // 4. Click different field while on desc -> new field asc
      const step4 = getNextSortDirection("dueDate", "priority", "desc");
      assert.equal(step4.field, "priority");
      assert.equal(step4.direction, "asc");
    });
  });
});

// ---------------------------------------------------------------------------
// Merged from task-table-presentation.test.ts — pagination, memo, DRI, badges
// ---------------------------------------------------------------------------
describe("Task Table Presentation Components - Unit & Behavior Suite", () => {
  describe("TaskPaginationBar - getPageNumbers Pagination Engine", () => {
    it("returns direct sequential page numbers when totalPages <= 5", () => {
      assert.deepEqual(getPageNumbers(1, 1), [1]);
      assert.deepEqual(getPageNumbers(1, 3), [1, 2, 3]);
      assert.deepEqual(getPageNumbers(3, 5), [1, 2, 3, 4, 5]);
    });

    it("inserts right ellipsis when on early pages (page 1-3 of 10)", () => {
      const p1 = getPageNumbers(1, 10);
      assert.equal(p1[0], 1);
      assert.equal(p1[p1.length - 1], 10);
      assert.ok(p1.includes("..."));
      assert.deepEqual(p1, [1, 2, "...", 10]);

      const p3 = getPageNumbers(3, 10);
      assert.deepEqual(p3, [1, 2, 3, 4, "...", 10]);
    });

    it("inserts both left and right ellipses when in the middle (page 5 of 10)", () => {
      const p5 = getPageNumbers(5, 10);
      assert.deepEqual(p5, [1, "...", 4, 5, 6, "...", 10]);
    });

    it("inserts left ellipsis when on late pages (page 8-10 of 10)", () => {
      const p8 = getPageNumbers(8, 10);
      assert.deepEqual(p8, [1, "...", 7, 8, 9, 10]);

      const p10 = getPageNumbers(10, 10);
      assert.deepEqual(p10, [1, "...", 9, 10]);
    });
  });

  describe("TaskRow - areTaskRowPropsEqual Custom Memoization Guard", () => {
    const baseTask: SchoolTask = {
      id: "st-001",
      taskCode: "NV-001",
      title: "Triển khai hệ thống E-Office",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: "2026-09-30",
      assignedDate: "2026-09-01",
      department: "Khoa CNTT",
      leadAssigneeName: "Nguyễn Văn A",
      leadAssigneeId: "user-1",
      leadAssigneeAvatar: "/avatar1.png",
      progressPercent: 45,
      totalSubTasks: 3,
      completedSubTasks: 1,
      coAssignees: [],
      subTasks: [
        {
          id: "sub-1",
          title: "Thiết kế CSDL",
          assigneeName: "Trần B",
          status: "COMPLETED",
          dueDate: "2026-09-15",
          updatedAt: "2026-09-01",
        } as StaffTask,
      ],
      createdAt: "2026-09-01",
      updatedAt: "2026-09-05",
    };

    const baseProps = {
      task: baseTask,
      isSelected: false,
      isExpanded: false,
      isActive: false,
      density: "comfortable" as const,
      showSelection: true,
      canAssign: false,
      selectedAcademicMonth: 9,
      referenceDate: "2026-09-09",
    };

    it("returns true when props and task properties are identical", () => {
      const nextProps = { ...baseProps, task: { ...baseTask } };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), true);
    });

    it("returns false when selection state changes", () => {
      const nextProps = { ...baseProps, isSelected: true };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when expansion state changes", () => {
      const nextProps = { ...baseProps, isExpanded: true };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when active focus highlight state changes", () => {
      const nextProps = { ...baseProps, isActive: true };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when density changes between comfortable and compact", () => {
      const nextProps = { ...baseProps, density: "compact" as const };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when task progressPercent changes", () => {
      const nextProps = {
        ...baseProps,
        task: { ...baseTask, progressPercent: 60 },
      };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when task status changes", () => {
      const nextProps = {
        ...baseProps,
        task: { ...baseTask, status: "COMPLETED" as const },
      };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when subtasks count changes", () => {
      const nextProps = {
        ...baseProps,
        task: {
          ...baseTask,
          subTasks: [
            ...baseTask.subTasks!,
            {
              id: "sub-2",
              title: "Tích hợp API",
              assigneeName: "Lê C",
              status: "NEW",
              dueDate: "2026-09-20",
              updatedAt: "2026-09-02",
            } as StaffTask,
          ],
        },
      };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when leadAssigneeName or leadAssigneeId changes", () => {
      const nextProps = {
        ...baseProps,
        task: { ...baseTask, leadAssigneeName: "Phạm D" },
      };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when activeCategory or suppressCategory changes", () => {
      const nextCatProps = {
        ...baseProps,
        activeCategory: "CHUYEN_DOI_SO",
      };
      assert.equal(areTaskRowPropsEqual(baseProps, nextCatProps), false);

      const nextSuppressProps = {
        ...baseProps,
        suppressCategory: true,
      };
      assert.equal(areTaskRowPropsEqual(baseProps, nextSuppressProps), false);
    });
  });

  describe("DRI Lead Assignee Parser - parseLeadAssignee", () => {
    it("extracts academic title and clean name from formatted DRI string", () => {
      const result = parseLeadAssignee("TT ThS. Nguyễn Tiến Phong", "P.TC-ĐBCL");
      assert.equal(result.primaryName, "Nguyễn Tiến Phong");
      assert.equal(result.subtext, "TT ThS. · P.TC-ĐBCL");
    });

    it("handles parenthetical title notes cleanly", () => {
      const result = parseLeadAssignee(
        "ThS. Nguyễn Tiến Phong (Trưởng phòng TC-ĐBCL)",
        "P.TC-ĐBCL"
      );
      assert.equal(result.primaryName, "Nguyễn Tiến Phong");
      assert.equal(result.subtext, "ThS. · Trưởng phòng TC-ĐBCL");
    });

    it("handles plain names without title prefix by attaching department subtext", () => {
      const result = parseLeadAssignee("Nguyễn Văn A", "Khoa CNTT");
      assert.equal(result.primaryName, "Nguyễn Văn A");
      assert.equal(result.subtext, "Khoa CNTT");
    });

    it("handles fallback gracefully when name is empty or undefined", () => {
      const result = parseLeadAssignee(undefined, "P.QLĐT");
      assert.equal(result.primaryName, "QCET");
      assert.equal(result.subtext, "P.QLĐT");
    });
  });

  describe("Subtask and SLA Badge Integrations", () => {
    it("evaluates overdue SLA status correctly for past due dates", () => {
      const sla = getSlaBadgeStatus("2026-09-01", "IN_PROGRESS", "2026-09-09");
      assert.equal(sla.isOverdue, true);
      assert.equal(sla.isToday, false);
      assert.ok(sla.label?.includes("Quá hạn"));
    });

    it("evaluates due today SLA status accurately", () => {
      const sla = getSlaBadgeStatus("2026-09-09", "IN_PROGRESS", "2026-09-09");
      assert.equal(sla.isOverdue, false);
      assert.equal(sla.isToday, true);
      assert.equal(sla.label, "Hôm nay");
    });

    it("evaluates completed tasks as non-overdue regardless of date", () => {
      const sla = getSlaBadgeStatus("2026-09-01", "COMPLETED", "2026-09-09");
      assert.equal(sla.isOverdue, false);
      assert.equal(sla.label, "Đã hoàn thành");
    });

    it("formats table dates cleanly to DD/MM/YYYY", () => {
      assert.equal(formatTableDate("2026-09-30"), "30/09/2026");
      assert.equal(formatTableDate(null), "—");
      assert.equal(formatTableDate(""), "—");
    });
  });

  describe("Badge Configuration Mappings", () => {
    it("maps standard task statuses to appropriate badge styles", () => {
      assert.equal(getStatusBadgeConfig("COMPLETED").label, "Hoàn thành");
      assert.equal(getStatusBadgeConfig("IN_PROGRESS").label, "Đang thực hiện");
      assert.equal(getStatusBadgeConfig("NEW").label, "Mới");
      assert.equal(getStatusBadgeConfig("OVERDUE").label, "Quá hạn");
      assert.equal(getStatusBadgeConfig("CANCELLED").label, "Đã hủy");
    });

    it("maps DACUM categories to clean labels", () => {
      assert.equal(getCategoryBadgeConfig("CHUYEN_DOI_SO").label, "Chuyển đổi số");
      assert.equal(getCategoryBadgeConfig("TRUYEN_THONG").label, "Truyền thông");
      assert.equal(getCategoryBadgeConfig("ATTT").label, "An toàn thông tin");
    });
  });

  describe("Badge Configuration Mappings - NOT_STARTED and Unknown Status Regression", () => {
    it("maps NOT_STARTED to Vietnamese label without leaking raw enum", () => {
      const config = getStatusBadgeConfig("NOT_STARTED");
      assert.equal(config.label, "Chưa bắt đầu");
      assert.ok(!config.label.includes("NOT_STARTED"));
    });

    it("maps unknown future status to fallback label without leaking raw input", () => {
      const raw = "SOME_FUTURE_STATUS_XYZ";
      const config = getStatusBadgeConfig(raw);
      assert.equal(config.label, "Chưa xác định");
      assert.notEqual(config.label, raw);
      assert.ok(!config.label.includes("SOME_FUTURE"));
      assert.ok(!config.label.includes(raw));
    });
  });

  describe("SLA Single-Value Contract", () => {
    it("returns null label for far-future due date (single-value, no redundant badge)", () => {
      const sla = getSlaBadgeStatus("2026-09-30", "IN_PROGRESS", "2026-09-09");
      assert.equal(sla.label, null);
      assert.equal(sla.isOverdue, false);
      assert.equal(sla.isToday, false);
    });

    it("returns null label when due date is missing", () => {
      const sla = getSlaBadgeStatus(null, "IN_PROGRESS", "2026-09-09");
      assert.equal(sla.label, null);
      assert.equal(sla.isOverdue, false);
      assert.equal(sla.isToday, false);
    });
  });
});
