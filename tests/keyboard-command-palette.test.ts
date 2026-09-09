import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  handleKeyboardNavigation,
  keyboardNavReducer,
  isInputElement,
  isInsideModal,
  type KeyboardNavState,
} from "../src/hooks/use-keyboard-navigation";

describe("Command Palette & Keyboard Ergonomics (Task 11)", () => {
  const modalPath = path.resolve(
    process.cwd(),
    "src/components/layout/command-search-modal.tsx"
  );
  const tablePath = path.resolve(
    process.cwd(),
    "src/components/tasks/table/modular-cascading-task-table.tsx"
  );
  const hookPath = path.resolve(
    process.cwd(),
    "src/hooks/use-keyboard-navigation.ts"
  );
  const toolbarPath = path.resolve(
    process.cwd(),
    "src/components/tasks/table/components/task-table-toolbar.tsx"
  );

  describe("1. keyboardNavReducer", () => {
    const idList = ["task-1", "task-2", "task-3"];

    test("MOVE_DOWN moves cursor from -1 to 0 on first press", () => {
      const state = keyboardNavReducer(
        { activeIndex: -1, activeId: null },
        { type: "MOVE_DOWN", itemCount: 3, idList }
      );
      assert.equal(state.activeIndex, 0);
      assert.equal(state.activeId, "task-1");
    });

    test("MOVE_DOWN advances cursor and stops at last item", () => {
      let state: KeyboardNavState = { activeIndex: 0, activeId: "task-1" };
      state = keyboardNavReducer(state, { type: "MOVE_DOWN", itemCount: 3, idList });
      assert.equal(state.activeIndex, 1);
      assert.equal(state.activeId, "task-2");

      state = keyboardNavReducer(state, { type: "MOVE_DOWN", itemCount: 3, idList });
      assert.equal(state.activeIndex, 2);
      assert.equal(state.activeId, "task-3");

      // Clamps at boundary
      state = keyboardNavReducer(state, { type: "MOVE_DOWN", itemCount: 3, idList });
      assert.equal(state.activeIndex, 2);
      assert.equal(state.activeId, "task-3");
    });

    test("MOVE_UP decrements cursor and clamps at 0", () => {
      let state: KeyboardNavState = { activeIndex: 2, activeId: "task-3" };
      state = keyboardNavReducer(state, { type: "MOVE_UP", itemCount: 3, idList });
      assert.equal(state.activeIndex, 1);
      assert.equal(state.activeId, "task-2");

      state = keyboardNavReducer(state, { type: "MOVE_UP", itemCount: 3, idList });
      assert.equal(state.activeIndex, 0);
      assert.equal(state.activeId, "task-1");

      // Clamps at boundary
      state = keyboardNavReducer(state, { type: "MOVE_UP", itemCount: 3, idList });
      assert.equal(state.activeIndex, 0);
      assert.equal(state.activeId, "task-1");
    });

    test("RESET returns cursor to -1 and activeId to null", () => {
      const state = keyboardNavReducer(
        { activeIndex: 2, activeId: "task-3" },
        { type: "RESET" }
      );
      assert.equal(state.activeIndex, -1);
      assert.equal(state.activeId, null);
    });

    test("SET_INDEX sets specific valid index", () => {
      const state = keyboardNavReducer(
        { activeIndex: 0, activeId: "task-1" },
        { type: "SET_INDEX", index: 2, itemCount: 3, idList }
      );
      assert.equal(state.activeIndex, 2);
      assert.equal(state.activeId, "task-3");
    });
  });

  describe("2. isInputElement & isInsideModal guards", () => {
    test("detects native input elements", () => {
      assert.equal(isInputElement({ tagName: "INPUT" }), true);
      assert.equal(isInputElement({ tagName: "TEXTAREA" }), true);
      assert.equal(isInputElement({ tagName: "SELECT" }), true);
      assert.equal(isInputElement({ tagName: "DIV", isContentEditable: true }), true);
      assert.equal(
        isInputElement({
          tagName: "DIV",
          hasAttribute: (attr: string) => attr === "contenteditable",
        }),
        true
      );
    });

    test("returns false for regular elements", () => {
      assert.equal(isInputElement({ tagName: "DIV" }), false);
      assert.equal(isInputElement({ tagName: "SPAN" }), false);
      assert.equal(isInputElement({ tagName: "BUTTON" }), false);
      assert.equal(isInputElement(null), false);
    });

    test("detects modal dialog containment", () => {
      const targetInDialog = {
        closest: (selector: string) => {
          if (selector.includes('role="dialog"')) return {} as Element;
          return null;
        },
      };
      assert.equal(isInsideModal(targetInDialog), true);

      const targetOutsideDialog = {
        closest: () => null,
      };
      assert.equal(isInsideModal(targetOutsideDialog), false);
    });
  });

  describe("3. handleKeyboardNavigation shortcut handling", () => {
    const idList = ["task-101", "task-102", "task-103"];

    test("Pressing '/' triggers onFocusSearch when outside input", () => {
      let searchFocused = false;
      let prevented = false;

      const handled = handleKeyboardNavigation({
        event: {
          key: "/",
          target: { tagName: "DIV" },
          preventDefault: () => { prevented = true; },
        },
        activeIndex: 0,
        itemCount: 3,
        idList,
        onFocusSearch: () => { searchFocused = true; },
      });

      assert.equal(handled, true);
      assert.equal(searchFocused, true);
      assert.equal(prevented, true);
    });

    test("Pressing '/' inside an input does NOT intercept typing", () => {
      let searchFocused = false;

      const handled = handleKeyboardNavigation({
        event: {
          key: "/",
          target: { tagName: "INPUT" },
        },
        activeIndex: 0,
        itemCount: 3,
        idList,
        onFocusSearch: () => { searchFocused = true; },
      });

      assert.equal(handled, false);
      assert.equal(searchFocused, false);
    });

    test("Pressing 'j' or 'ArrowDown' moves active row down", () => {
      let movedIndex = -1;
      let movedId: string | null = null;

      const handled = handleKeyboardNavigation({
        event: {
          key: "j",
          target: { tagName: "DIV" },
          preventDefault: () => {},
        },
        activeIndex: 0,
        itemCount: 3,
        idList,
        onMoveActive: (index, id) => {
          movedIndex = index;
          movedId = id;
        },
      });

      assert.equal(handled, true);
      assert.equal(movedIndex, 1);
      assert.equal(movedId, "task-102");
    });

    test("Pressing 'k' or 'ArrowUp' moves active row up", () => {
      let movedIndex = -1;
      let movedId: string | null = null;

      const handled = handleKeyboardNavigation({
        event: {
          key: "k",
          target: { tagName: "DIV" },
          preventDefault: () => {},
        },
        activeIndex: 2,
        itemCount: 3,
        idList,
        onMoveActive: (index, id) => {
          movedIndex = index;
          movedId = id;
        },
      });

      assert.equal(handled, true);
      assert.equal(movedIndex, 1);
      assert.equal(movedId, "task-102");
    });

    test("Pressing 'Enter' triggers onSelectTask with focused task ID", () => {
      let selectedId = "";
      let prevented = false;

      const handled = handleKeyboardNavigation({
        event: {
          key: "Enter",
          target: { tagName: "DIV" },
          preventDefault: () => { prevented = true; },
        },
        activeIndex: 1,
        itemCount: 3,
        idList,
        onSelectTask: (id) => { selectedId = id; },
      });

      assert.equal(handled, true);
      assert.equal(selectedId, "task-102");
      assert.equal(prevented, true);
    });

    test("Pressing 'x' or 'X' toggles checkbox selection of focused row", () => {
      let toggledId = "";

      const handled = handleKeyboardNavigation({
        event: {
          key: "x",
          target: { tagName: "DIV" },
          preventDefault: () => {},
        },
        activeIndex: 2,
        itemCount: 3,
        idList,
        onToggleSelect: (id) => { toggledId = id; },
      });

      assert.equal(handled, true);
      assert.equal(toggledId, "task-103");
    });

    test("Pressing 'Escape' invokes onEscape handler", () => {
      let escaped = false;

      const handled = handleKeyboardNavigation({
        event: {
          key: "Escape",
          target: { tagName: "INPUT" },
          preventDefault: () => {},
        },
        activeIndex: 1,
        itemCount: 3,
        idList,
        onEscape: () => { escaped = true; },
      });

      assert.equal(handled, true);
      assert.equal(escaped, true);
    });

    test("Ignores key events when target is inside a modal dialog", () => {
      let moved = false;

      const handled = handleKeyboardNavigation({
        event: {
          key: "j",
          target: {
            closest: (selector: string) => (selector.includes("dialog") ? {} as Element : null),
          },
        },
        activeIndex: 0,
        itemCount: 3,
        idList,
        onMoveActive: () => { moved = true; },
      });

      assert.equal(handled, false);
      assert.equal(moved, false);
    });

    test("Ignores key events when default was already prevented", () => {
      let moved = false;

      const handled = handleKeyboardNavigation({
        event: {
          key: "j",
          defaultPrevented: true,
          target: { tagName: "DIV" },
        },
        activeIndex: 0,
        itemCount: 3,
        idList,
        onMoveActive: () => { moved = true; },
      });

      assert.equal(handled, false);
      assert.equal(moved, false);
    });
  });

  describe("4. CommandSearchModal Command Palette Integration", () => {
    test("modal file exists and includes required quick actions", () => {
      assert.ok(fs.existsSync(modalPath), "CommandSearchModal file must exist");
      const content = fs.readFileSync(modalPath, "utf-8");

      // Required quick actions in brief
      assert.ok(content.includes("create-task"), "Must support 'Tạo nhiệm vụ' action");
      assert.ok(content.includes("action-review-tasks"), "Must support 'Xem việc chờ duyệt' action");
      assert.ok(content.includes("action-my-tasks"), "Must support 'Đổi sang Của tôi' action");
      assert.ok(content.includes("nav-documents"), "Must support 'Đi tới Văn bản' action");
      assert.ok(content.includes("nav-calendar"), "Must support 'Đi tới Lịch' action");
    });

    test("modal supports Cmd+K / Ctrl+K and escape", () => {
      const content = fs.readFileSync(modalPath, "utf-8");

      assert.ok(
        content.includes("e.metaKey || e.ctrlKey"),
        "Must check metaKey or ctrlKey for Cmd/Ctrl+K"
      );
      assert.ok(
        content.includes("isKeyK"),
        "Must verify 'k' or 'KeyK' with IME resilience"
      );
      assert.ok(
        content.includes('e.key === "Escape"'),
        "Must handle Escape to close"
      );
      assert.ok(
        content.includes('data-slot="command-palette"'),
        "Must declare data-slot='command-palette'"
      );
    });

    test("strictly conforms to Light-Only standard (no dark: classes)", () => {
      const content = fs.readFileSync(modalPath, "utf-8");
      assert.ok(!content.includes("dark:"), "No dark: Tailwind classes permitted");
    });
  });

  describe("5. ModularCascadingTaskTable Ergonomics & Discoverability", () => {
    test("table wires keyboard navigation and shortcut hint bar", () => {
      assert.ok(fs.existsSync(tablePath), "Task table component must exist");
      const content = fs.readFileSync(tablePath, "utf-8");

      // Hook integration
      assert.ok(
        content.includes("useTaskKeyboardNav"),
        "Must invoke useTaskKeyboardNav hook"
      );
      assert.ok(
        content.includes("qcet:focus-task-search"),
        "Must dispatch qcet:focus-task-search on '/' focus"
      );
      assert.ok(
        content.includes("onEscape:"),
        "Must define ergonomic onEscape cascade"
      );

      // Keyboard Shortcut Hints Bar
      assert.ok(
        content.includes("Phím tắt nhanh:"),
        "Must display keyboard shortcut hint header"
      );
      assert.ok(content.includes("Di chuyển dòng"), "Must display J/K row navigation hint");
      assert.ok(content.includes("Xem chi tiết"), "Must display Enter task detail hint");
      assert.ok(content.includes("Chọn dòng"), "Must display X selection hint");
      assert.ok(content.includes("Đóng / Hủy chọn"), "Must display Esc cancel hint");
      assert.ok(content.includes("Menu lệnh toàn cục"), "Must display ⌘K palette hint");
    });

    test("Toolbar supports '/' shortcut and focuses search input", () => {
      assert.ok(fs.existsSync(toolbarPath), "Task table toolbar must exist");
      const content = fs.readFileSync(toolbarPath, "utf-8");

      assert.ok(
        content.includes("qcet:focus-task-search"),
        "Toolbar must listen to qcet:focus-task-search"
      );
      assert.ok(
        content.includes("<kbd"),
        "Toolbar must display subtle kbd badge for search shortcut"
      );
    });

    test("Table strictly conforms to Light-Only standard (no dark: classes)", () => {
      const content = fs.readFileSync(tablePath, "utf-8");
      assert.ok(!content.includes("dark:"), "No dark: Tailwind classes permitted in task table");
    });
  });
});
