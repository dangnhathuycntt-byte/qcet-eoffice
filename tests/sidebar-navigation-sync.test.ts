import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getSidebarNavItems,
  CANONICAL_ROUTES,
} from "@/lib/navigation/canonical-navigation-registry";
import { isRouteActive } from "@/lib/navigation/active-matcher";
import {
  isEditableTarget,
  handleSidebarShortcut,
} from "@/components/layout/app-sidebar";

describe("Desktop Sidebar & Shortcut Guard Test Suite (sidebar-navigation-sync)", () => {
  const sidebarPath = path.resolve(process.cwd(), "src/components/layout/app-sidebar.tsx");

  describe("Canonical Navigation Registry Synchronization", () => {
    test("app-sidebar.tsx imports and uses getSidebarNavItems from canonical-navigation-registry", () => {
      assert.ok(fs.existsSync(sidebarPath), "app-sidebar.tsx must exist");
      const content = fs.readFileSync(sidebarPath, "utf-8");

      assert.ok(
        content.includes('from "@/lib/navigation/canonical-navigation-registry"'),
        "Must import from canonical-navigation-registry"
      );
      assert.ok(
        content.includes("getSidebarNavItems"),
        "Must import and call getSidebarNavItems"
      );
    });

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
        ["desk", "calendar", "tasks", "documents", "org", "notifications", "settings"],
        "Items must follow canonical order"
      );
    });

    test("canonical items cover all 3 navigation sections without omission", () => {
      const items = getSidebarNavItems();
      const personalItems = items.filter((i) => i.section === "personal");
      const workspaceItems = items.filter((i) => i.section === "workspace");
      const operationsItems = items.filter((i) => i.section === "operations");

      assert.equal(personalItems.length, 3, "Personal section has Desk, Calendar, Notifications");
      assert.equal(workspaceItems.length, 2, "Workspace section has Tasks, Documents");
      assert.equal(operationsItems.length, 2, "Operations section has Org, Settings");
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

      // Number shortcut '3' should navigate to /tasks (3rd canonical item excluding settings)
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
      assert.equal(navigatedTo, "/tasks");
      assert.equal(defaultPrevented, true);

      // Number shortcut '4' (documents under development) must prevent default and NOT navigate
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
      assert.equal(navigatedTo, null, "Shortcut 4 for documents must not trigger navigation");
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

    test("app-sidebar.tsx contains active route indicator styling", () => {
      const content = fs.readFileSync(sidebarPath, "utf-8");
      assert.ok(
        content.includes("isRouteActive"),
        "app-sidebar.tsx must use canonical isRouteActive"
      );
      assert.ok(
        content.includes("bg-primary/10 text-primary font-semibold"),
        "Must apply subtle active color tint"
      );
      assert.ok(
        content.includes("w-[3px] bg-primary rounded-r-full"),
        "Must render active indicator bar"
      );
    });
  });
});
