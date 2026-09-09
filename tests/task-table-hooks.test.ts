import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseTaskUrlParams,
  serializeTaskUrlParams,
  buildTaskUrl,
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
      const url = buildTaskUrl(
        { tab: "review", q: "báo cáo" },
        initial,
        "/tasks"
      );

      assert.ok(url.startsWith("/tasks?"));
      const qs = url.split("?")[1];
      const params = new URLSearchParams(qs);
      assert.equal(params.get("foo"), "bar");
      assert.equal(params.get("theme"), "light");
      assert.equal(params.get("tab"), "review");
      assert.equal(params.get("q"), "báo cáo");
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
