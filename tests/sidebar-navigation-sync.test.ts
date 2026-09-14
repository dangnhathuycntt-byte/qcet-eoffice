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
    test("canonical registry produces 7 items matching canonical routes with no duplicates", () => {
      const items = getSidebarNavItems();
      assert.equal(items.length, 7, "getSidebarNavItems must return 7 canonical items");

      const ids = items.map((i) => i.id);
      const uniqueIds = new Set(ids);
      assert.equal(uniqueIds.size, 7, "All route IDs must be unique");

      const hrefs = items.map((i) => i.href);
      const uniqueHrefs = new Set(hrefs);
      assert.equal(uniqueHrefs.size, 7, "All route hrefs must be unique");

      // Verify canonical order
      assert.deepEqual(
        ids,
        ["desk", "tasks", "calendar", "notifications", "documents", "org", "settings"],
        "Items must follow canonical order"
      );
    });

    test("canonical items cover all 2 navigation sections without omission", () => {
      const items = getSidebarNavItems();
      const workItems = items.filter((i) => i.section === "work");
      const orgItems = items.filter((i) => i.section === "org");

      assert.equal(workItems.length, 5, "Work section has Desk, Tasks, Calendar, Notifications, Documents");
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

      // Number shortcut '2' should navigate to /tasks (2nd canonical item excluding settings)
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

      // Number shortcut '3' should navigate to /calendar
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
      assert.equal(navigatedTo, "/calendar");
      assert.equal(defaultPrevented, true);

      // Number shortcut '5' (documents under development) must prevent default and NOT navigate
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
      assert.equal(navigatedTo, null, "Shortcut 5 for documents must not trigger navigation");
      assert.equal(defaultPrevented, true);
    });
  });

  describe("Active Route Class Assignment with isRouteActive", () => {
    test("isRouteActive correctly matches exact paths and zone queries", () => {
      // Root / without zone
      assert.equal(isRouteActive("/", "/"), true);
      assert.equal(isRouteActive("/tasks", "/"), false);
      assert.equal(isRouteActive("/calendar", "/"), false);

      // Root / with ?zone=tasks activates /tasks and deactivates /
      const taskParams = new URLSearchParams("zone=tasks");
      assert.equal(isRouteActive("/", "/", taskParams), false);
      assert.equal(isRouteActive("/tasks", "/", taskParams), true);
      assert.equal(isRouteActive("/calendar", "/", taskParams), false);

      // Root / with ?zone=calendar activates /calendar and deactivates /
      const calParams = new URLSearchParams("zone=calendar");
      assert.equal(isRouteActive("/", "/", calParams), false);
      assert.equal(isRouteActive("/calendar", "/", calParams), true);

      // Subroute /tasks/task-001 activates /tasks
      assert.equal(isRouteActive("/tasks", "/tasks/task-001"), true);

      // Boundary safety: /tasks-archive must not activate /tasks
      assert.equal(isRouteActive("/tasks", "/tasks-archive"), false);
    });
  });

  describe("Plan 10.3: Canonical Order, Visual Groups & Footer Discipline", () => {
    test("canonical order: tasks immediately follows workbench (desk)", () => {
      const items = getSidebarNavItems();
      const ids = items.map((i) => i.id);
      assert.equal(ids[0], "desk", "First canonical item must be desk (workbench)");
      assert.equal(ids[1], "tasks", "Second canonical item must be tasks, immediately after desk");
    });

    test("canonical registry drives MobileBottomNav destinations", () => {
      const mobileNavPath = path.resolve(
        process.cwd(),
        "src/components/navigation/mobile-bottom-nav.tsx"
      );
      assert.ok(fs.existsSync(mobileNavPath), "mobile-bottom-nav.tsx must exist");
      const content = fs.readFileSync(mobileNavPath, "utf-8");
      assert.ok(
        content.includes("getMobileBottomBarItems"),
        "MobileBottomNav must be driven by getMobileBottomBarItems"
      );
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
