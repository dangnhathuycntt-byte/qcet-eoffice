import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getSidebarNavItems,
  getMobileBottomBarItems,
  CANONICAL_ROUTES,
} from "@/lib/navigation/canonical-navigation-registry";
import { isRouteActive } from "@/lib/navigation/active-matcher";
import {
  isEditableTarget,
  handleSidebarShortcut,
} from "@/components/layout/app-sidebar";

describe("Desktop Sidebar & Shortcut Guard Test Suite (sidebar-navigation-sync)", () => {

  describe("Canonical Navigation Registry Synchronization", () => {
    test("canonical registry produces 6 items matching canonical routes with no duplicates", () => {
      const items = getSidebarNavItems();
      assert.equal(items.length, 6, "getSidebarNavItems must return 6 canonical items");

      const ids = items.map((i) => i.id);
      const uniqueIds = new Set(ids);
      assert.equal(uniqueIds.size, 6, "All route IDs must be unique");

      const hrefs = items.map((i) => i.href);
      const uniqueHrefs = new Set(hrefs);
      assert.equal(uniqueHrefs.size, 6, "All route hrefs must be unique");

      // Bỏ Tổng quan 19/10/2026: Hộp thư lên đầu
      assert.deepEqual(
        ids,
        ["inbox", "tasks", "meetings", "documents", "org", "settings"],
        "Items must follow canonical order"
      );
    });

    test("canonical items cover all 2 navigation sections without omission", () => {
      const items = getSidebarNavItems();
      const workItems = items.filter((i) => i.section === "work");
      const orgItems = items.filter((i) => i.section === "org");

      assert.equal(workItems.length, 4, "Work section has Inbox, Tasks, Meetings, Documents");
      assert.equal(orgItems.length, 2, "Org section has Org, Settings");
    });
  });

  describe("Keyboard Shortcut Helper & Editable Target Guard", () => {
    test("isEditableTarget correctly identifies form and contenteditable elements", () => {
      // Form elements
      assert.equal(isEditableTarget({ tagName: "INPUT" }), true);
      assert.equal(isEditableTarget({ tagName: "input" }), true);
      assert.equal(isEditableTarget({ tagName: "TEXTAREA" }), true);
      assert.equal(isEditableTarget({ tagName: "SELECT" }), true);

      // Contenteditable elements
      assert.equal(isEditableTarget({ tagName: "DIV", isContentEditable: true }), true);
      assert.equal(isEditableTarget({ tagName: "SPAN", isContentEditable: "true" }), true);
      assert.equal(
        isEditableTarget({
          tagName: "DIV",
          getAttribute: (attr: string) => (attr === "contenteditable" ? "true" : null),
        }),
        true
      );

      // Non-editable elements
      assert.equal(isEditableTarget({ tagName: "DIV" }), false);
      assert.equal(isEditableTarget({ tagName: "BUTTON" }), false);
      assert.equal(isEditableTarget({ tagName: "A" }), false);
      assert.equal(isEditableTarget({ tagName: "BODY" }), false);
      assert.equal(isEditableTarget(null), false);
      assert.equal(isEditableTarget(undefined), false);
    });

    test("typing 'c' or '1'-'6' or 'Ctrl+B' in an editable target never triggers shortcut actions", () => {
      let toggled = false;
      let navigatedTo: string | null = null;
      let defaultPrevented = false;

      const mockOptions = {
        toggleCollapse: () => {
          toggled = true;
        },
        onNavigate: (href: string) => {
          navigatedTo = href;
        },
      };

      const editableInput = { tagName: "INPUT" };
      const editableTextarea = { tagName: "TEXTAREA" };
      const editableDiv = { tagName: "DIV", isContentEditable: true };

      // Test 'c' key in input
      defaultPrevented = false;
      let handled = handleSidebarShortcut(
        {
          key: "c",
          target: editableInput,
          preventDefault: () => {
            defaultPrevented = true;
          },
        },
        mockOptions
      );
      assert.equal(handled, false);
      assert.equal(defaultPrevented, false);
      assert.equal(navigatedTo, null);

      // Test numeric keys '1' through '6' in textarea
      for (const num of ["1", "2", "3", "4", "5", "6"]) {
        handled = handleSidebarShortcut(
          {
            key: num,
            target: editableTextarea,
            preventDefault: () => {
              defaultPrevented = true;
            },
          },
          mockOptions
        );
        assert.equal(handled, false);
        assert.equal(navigatedTo, null, `Typing ${num} in textarea must not navigate`);
      }

      // Test Ctrl+B / Cmd+B in contenteditable div
      handled = handleSidebarShortcut(
        {
          key: "b",
          ctrlKey: true,
          target: editableDiv,
          preventDefault: () => {
            defaultPrevented = true;
          },
        },
        mockOptions
      );
      assert.equal(handled, false);
      assert.equal(toggled, false, "Ctrl+B inside contenteditable must not toggle sidebar");
    });

    test("shortcuts execute properly when target is not editable", () => {
      let toggled = false;
      let navigatedTo: string | null = null;
      let defaultPrevented = false;

      const mockOptions = {
        toggleCollapse: () => {
          toggled = true;
        },
        onNavigate: (href: string) => {
          navigatedTo = href;
        },
      };

      const buttonTarget = { tagName: "BUTTON" };

      // Ctrl+B on button
      defaultPrevented = false;
      toggled = false;
      let handled = handleSidebarShortcut(
        {
          key: "b",
          ctrlKey: true,
          target: buttonTarget,
          preventDefault: () => {
            defaultPrevented = true;
          },
        },
        mockOptions
      );
      assert.equal(handled, true);
      assert.equal(toggled, true);
      assert.equal(defaultPrevented, true);

      // Meta+B (Cmd+B) on body
      defaultPrevented = false;
      toggled = false;
      handled = handleSidebarShortcut(
        {
          key: "B",
          metaKey: true,
          target: { tagName: "BODY" },
          preventDefault: () => {
            defaultPrevented = true;
          },
        },
        mockOptions
      );
      assert.equal(handled, true);
      assert.equal(toggled, true);
      assert.equal(defaultPrevented, true);

      // Number shortcut '2' should navigate to /tasks (2nd canonical item excluding settings: 1 Hộp thư, 2 Nhiệm vụ, 3 Cuộc họp, 4 Văn bản, 5 Cơ cấu)
      defaultPrevented = false;
      navigatedTo = null;
      handled = handleSidebarShortcut(
        {
          key: "2",
          target: buttonTarget,
          preventDefault: () => {
            defaultPrevented = true;
          },
        },
        mockOptions
      );
      assert.equal(handled, true);
      assert.equal(navigatedTo, "/tasks");
      assert.equal(defaultPrevented, true);

      // Number shortcut '3' should navigate to /meetings
      defaultPrevented = false;
      navigatedTo = null;
      handled = handleSidebarShortcut(
        {
          key: "3",
          target: buttonTarget,
          preventDefault: () => {
            defaultPrevented = true;
          },
        },
        mockOptions
      );
      assert.equal(handled, true);
      assert.equal(navigatedTo, "/meetings");
      assert.equal(defaultPrevented, true);

      // Number shortcut '4' navigates to /documents like the other modules
      defaultPrevented = false;
      navigatedTo = null;
      handled = handleSidebarShortcut(
        {
          key: "4",
          target: buttonTarget,
          preventDefault: () => {
            defaultPrevented = true;
          },
        },
        mockOptions
      );
      assert.equal(handled, true);
      assert.equal(navigatedTo, "/documents");
      assert.equal(defaultPrevented, true);

      // Number shortcut '5' navigates to /org
      defaultPrevented = false;
      navigatedTo = null;
      handled = handleSidebarShortcut(
        {
          key: "5",
          target: buttonTarget,
          preventDefault: () => {
            defaultPrevented = true;
          },
        },
        mockOptions
      );
      assert.equal(handled, true);
      assert.equal(navigatedTo, "/org");
      assert.equal(defaultPrevented, true);

      // '6' has no module (settings is excluded), so the key is left alone
      defaultPrevented = false;
      navigatedTo = null;
      handled = handleSidebarShortcut(
        {
          key: "6",
          target: buttonTarget,
          preventDefault: () => {
            defaultPrevented = true;
          },
        },
        mockOptions
      );
      assert.equal(handled, false);
      assert.equal(navigatedTo, null);
      assert.equal(defaultPrevented, false);
    });
  });

  describe("Active Route Class Assignment with isRouteActive", () => {
    test("isRouteActive correctly matches exact paths and zone queries", () => {
      // Root / without zone
      assert.equal(isRouteActive("/", "/"), true);
      assert.equal(isRouteActive("/tasks", "/"), false);
      assert.equal(isRouteActive("/meetings", "/"), false);

      // Root / with ?zone=tasks activates /tasks and deactivates /
      const taskParams = new URLSearchParams("zone=tasks");
      assert.equal(isRouteActive("/", "/", taskParams), false);
      assert.equal(isRouteActive("/tasks", "/", taskParams), true);
      assert.equal(isRouteActive("/meetings", "/", taskParams), false);

      // Root / with ?zone=calendar activates /meetings and deactivates /
      const calParams = new URLSearchParams("zone=calendar");
      assert.equal(isRouteActive("/", "/", calParams), false);
      assert.equal(isRouteActive("/meetings", "/", calParams), true);

      // Subroute /tasks/task-001 activates /tasks
      assert.equal(isRouteActive("/tasks", "/tasks/task-001"), true);

      // Boundary safety: /tasks-archive must not activate /tasks
      assert.equal(isRouteActive("/tasks", "/tasks-archive"), false);
    });
  });

  describe("Plan 10.3: Canonical Order, Visual Groups & Footer Discipline", () => {
    test("canonical order: tasks immediately follows inbox (no Tổng quan since 19/10/2026)", () => {
      const items = getSidebarNavItems();
      const ids = items.map((i) => i.id);
      assert.equal(ids[0], "inbox", "First canonical item must be inbox");
      assert.equal(ids[1], "tasks", "Second canonical item must be tasks, immediately after inbox");
      assert.equal(ids.includes("desk"), false, "Tổng quan (desk) was removed");
    });

    test("mục thanh dưới của registry là tập con của registry chuẩn", () => {
      const items = getMobileBottomBarItems();
      const registryIds = new Set(CANONICAL_ROUTES.map((r) => r.id));
      for (const item of items) {
        assert.ok(
          registryIds.has(item.id),
          `Mobile bottom item ${item.id} must be a canonical registry subset`
        );
      }
    });
  });
});
