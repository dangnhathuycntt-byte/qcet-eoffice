import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatTableDate } from "../src/components/tasks/table/utils/table-date-helpers";
import {
  filterTasks,
  sortTasks,
  paginateTasks,
  flattenPersonalTasks,
} from "../src/components/tasks/table/utils/table-filter-engine";
import { STATUS_CONFIG, DEFAULT_PAGE_SIZES, SMART_FILTER_TABS, getStatusBadgeConfig, getCategoryBadgeConfig } from "../src/components/tasks/table/constants";
import { getSlaBadgeStatus } from "../src/components/tasks/table/utils/table-date-helpers";
import { getPageNumbers } from "../src/components/tasks/table/components/task-pagination-bar";
import { parseLeadAssignee } from "../src/components/tasks/table/components/task-row";
import { parseTaskUrlParams, serializeTaskUrlParams, resolveTaskDetailHistoryMode, DEFAULT_TASK_URL_STATE } from "../src/components/tasks/table/hooks/use-task-url-sync";
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
import type { SchoolTask, StaffTask } from "@qcet/contracts/types/dashboard";

describe("Task Table Engine - Foundations & Utilities", () => {
  describe("Constants & Configuration", () => {

    it("defines valid status badge configurations without dark: classes (Light-Only Standard)", () => {
      const statuses = ["IN_PROGRESS", "COMPLETED", "WAITING_APPROVAL", "CANCELLED", "BLOCKED"] as const;
      for (const st of statuses) {
        const config = STATUS_CONFIG[st];
        assert.ok(config, `Config for status ${st} must exist`);
        assert.ok(!config.badgeClass.includes("dark:"), `badgeClass must not contain dark: in ${st}`);
        assert.ok(!config.borderClass.includes("dark:"), `borderClass must not contain dark: in ${st}`);
      }
    });

    it("provides default page sizes including 20, 50, 100", () => {
      assert.deepEqual(DEFAULT_PAGE_SIZES, [20, 50, 100]);
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

    it("formatTableDate formats ISO date strings in Vietnamese locale", () => {
      const formatted = formatTableDate("2026-09-09");
      assert.ok(formatted.includes("09") || formatted.includes("9"));
      assert.ok(formatted.includes("2026"));
      assert.equal(formatTableDate("invalid-date"), "-");
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
    it("returns direct sequential page numbers when totalPages <= 7", () => {
      assert.deepEqual(getPageNumbers(1, 1), [1]);
      assert.deepEqual(getPageNumbers(1, 3), [1, 2, 3]);
      assert.deepEqual(getPageNumbers(7, 7), [1, 2, 3, 4, 5, 6, 7]);
    });

    it("keeps a constant 7 slots so the bar width does not shift (pages 1-4 of 10)", () => {
      for (const page of [1, 2, 3, 4]) {
        assert.deepEqual(getPageNumbers(page, 10), [1, 2, 3, 4, 5, "...", 10]);
      }
    });

    it("inserts both ellipses around current ± 1 in the middle (page 5 of 10)", () => {
      assert.deepEqual(getPageNumbers(5, 10), [1, "...", 4, 5, 6, "...", 10]);
    });

    it("anchors the last five pages near the end (pages 7-10 of 10)", () => {
      for (const page of [7, 8, 9, 10]) {
        assert.deepEqual(getPageNumbers(page, 10), [1, "...", 6, 7, 8, 9, 10]);
      }
    });

    it("never exceeds 7 slots on large page counts", () => {
      for (const page of [1, 50, 99, 100]) {
        const slots = getPageNumbers(page, 100);
        assert.equal(slots.length, 7);
        assert.ok(slots.includes(page));
      }
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
      assert.ok(sla.label?.includes("Trễ hạn"));
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
      assert.equal(formatTableDate(null), "-");
      assert.equal(formatTableDate(""), "-");
    });
  });

  describe("Badge Configuration Mappings", () => {
    it("maps standard task statuses to appropriate badge styles", () => {
      assert.equal(getStatusBadgeConfig("COMPLETED").label, "Hoàn thành");
      assert.equal(getStatusBadgeConfig("IN_PROGRESS").label, "Đang thực hiện");
      assert.equal(getStatusBadgeConfig("NEW").label, "Mới");
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
