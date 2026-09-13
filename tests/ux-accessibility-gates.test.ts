/**
 * Task 7 (Phase 3E) — UX Accessibility & Visual Invariant Gates
 *
 * Structural, accessibility, and light-only invariants across:
 * Navigation, Task Workspace, Kanban, Dashboard, Calendar.
 *
 * Run: npx tsx --test tests/ux-accessibility-gates.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const src = (...parts: string[]) => path.join(ROOT, "src", ...parts);
const read = (p: string) => fs.readFileSync(p, "utf8");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return true if the file contains at least one match for pattern */
function has(content: string, pattern: RegExp | string): boolean {
  if (typeof pattern === "string") return content.includes(pattern);
  return pattern.test(content);
}

/** Count non-overlapping occurrences of a regex in a string */
function countMatches(content: string, pattern: RegExp): number {
  return (content.match(new RegExp(pattern.source, "g")) ?? []).length;
}

// ---------------------------------------------------------------------------
// File Paths
// ---------------------------------------------------------------------------

const TOPBAR = src("components/layout/app-topbar.tsx");
const SIDEBAR = src("components/layout/app-sidebar.tsx");
const MOBILE_NAV = src("components/navigation/mobile-bottom-nav.tsx");
const KANBAN = src("components/tasks/task-kanban-board.tsx");
const WORKSPACE = src("components/workspace/unified-adaptive-workspace.tsx");
const WORKSPACE_TOOLBAR = src("components/workspace/workspace-toolbar.tsx");
const ACTIVE_FILTER = src("components/workspace/components/active-filter-breadcrumb.tsx");
const SCOPE_HEADER = src("components/workspace/components/adaptive-scope-header.tsx");
const DASHBOARD_ZONE = src("components/dashboard/zones/dashboard-zone.tsx");
const CALENDAR_WS = src("components/calendar/calendar-workspace.tsx");

// ---------------------------------------------------------------------------
// 1. Light-Only Standard: zero dark: classes in client components
// ---------------------------------------------------------------------------

describe("1. Light-Only — zero dark: classes in client components", () => {
  const CLIENT_COMPONENT_DIRS = [
    src("components/layout"),
    src("components/tasks"),
    src("components/workspace"),
    src("components/dashboard"),
    src("components/calendar"),
  ];

  function collectTsx(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return collectTsx(full);
        if (e.isFile() && e.name.endsWith(".tsx")) return [full];
        return [];
      });
  }

  it("no tsx file under audited component dirs contains className dark: variants", () => {
    const violators: string[] = [];
    for (const dir of CLIENT_COMPONENT_DIRS) {
      for (const file of collectTsx(dir)) {
        const content = read(file);
        // Match 'dark:' appearing inside a className string (not in comments or console strings)
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Skip pure comment lines
          if (/^\s*(\/\/|\*|\*\/)/.test(line)) continue;
          // Flag 'dark:' that appears inside JSX className or cn() expressions
          if (/dark:[a-z]/.test(line)) {
            // Allowance: line is a JSDoc/comment annotation saying "zero dark:"
            if (/zero dark:/.test(line) || /no dark:/.test(line)) continue;
            violators.push(`${path.relative(ROOT, file)}:${i + 1} — ${line.trim()}`);
          }
        }
      }
    }
    assert.deepStrictEqual(
      violators,
      [],
      `Found dark: class usage in client components:\n${violators.join("\n")}`
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Zero Decorative Emojis in UI strings
// ---------------------------------------------------------------------------

describe("2. Zero decorative emojis in audited component directories", () => {
  const EMOJI_REGEX =
    /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FFFF}]/u;

  function collectTsx(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return collectTsx(full);
        if (e.isFile() && e.name.endsWith(".tsx")) return [full];
        return [];
      });
  }

  const DIRS = [
    src("components/layout"),
    src("components/tasks"),
    src("components/workspace"),
    src("components/dashboard"),
    src("components/calendar"),
  ];

  it("no tsx file in audited dirs contains decorative emoji characters", () => {
    const violators: string[] = [];
    for (const dir of DIRS) {
      for (const file of collectTsx(dir)) {
        const content = read(file);
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (EMOJI_REGEX.test(line)) {
            violators.push(`${path.relative(ROOT, file)}:${i + 1} — ${line.trim().slice(0, 80)}`);
          }
        }
      }
    }
    assert.deepStrictEqual(
      violators,
      [],
      `Decorative emojis found in component files:\n${violators.join("\n")}`
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Navigation — App Topbar accessibility
// ---------------------------------------------------------------------------

describe("3. Navigation — App Topbar", () => {
  const topbar = read(TOPBAR);

  it("topbar renders as <header> with data-slot=app-topbar", () => {
    assert.match(topbar, /data-slot="app-topbar"/);
    assert.match(topbar, /<header/);
  });

  it("topbar notification button has aria-label and aria-expanded", () => {
    assert.match(topbar, /aria-label="Thông báo điều hành"/);
    assert.match(topbar, /aria-expanded=\{isNotificationOpen\}/);
  });

  it("topbar profile button has aria-expanded", () => {
    assert.match(topbar, /aria-expanded=\{isProfileDropdownOpen\}/);
  });

  it("topbar mobile buttons enforce min-h-[44px] touch targets", () => {
    assert.match(topbar, /min-h-\[44px\]/);
    assert.match(topbar, /min-w-\[44px\]/);
  });

  it("topbar touch buttons have touch-manipulation class", () => {
    assert.match(topbar, /touch-manipulation/);
  });

  it("topbar sidebar toggle has an aria-label", () => {
    assert.match(topbar, /aria-label="Thu gọn \/ Mở rộng thanh bên"/);
  });
});

// ---------------------------------------------------------------------------
// 4. Navigation — Mobile Bottom Nav accessibility
// ---------------------------------------------------------------------------

describe("4. Navigation — Mobile Bottom Nav", () => {
  const nav = read(MOBILE_NAV);

  it("mobile-bottom-nav has role nav via aria-label and data-slot", () => {
    assert.match(nav, /data-slot="mobile-bottom-nav"/);
    assert.match(nav, /aria-label="Thanh điều hướng di động"/);
  });

  it("mobile-bottom-nav nav items have aria-labels", () => {
    assert.match(nav, /aria-label=\{item\.label\}/);
  });
});

// ---------------------------------------------------------------------------
// 5. Task Workspace — Smart-filter rail not rendered by default
// ---------------------------------------------------------------------------

describe("5. Task Workspace — Smart-filter rail hidden by default", () => {
  const filterBreadcrumb = read(ACTIVE_FILTER);

  it("active-filter-breadcrumb returns null when no filters are active (hasAnyFilter guard)", () => {
    assert.match(filterBreadcrumb, /hasAnyFilter/);
    assert.match(filterBreadcrumb, /if \(!hasAnyFilter\)/);
    assert.match(filterBreadcrumb, /return null/);
  });

  it("active-filter-breadcrumb has data-slot=active-filter-breadcrumb when rendered", () => {
    assert.match(filterBreadcrumb, /data-slot="active-filter-breadcrumb"/);
  });
});

// ---------------------------------------------------------------------------
// 6. Task Workspace — Scope header touch targets
// ---------------------------------------------------------------------------

describe("6. Task Workspace — Scope header & toolbar touch targets", () => {
  const scopeHeader = read(SCOPE_HEADER);
  const toolbar = read(WORKSPACE_TOOLBAR);

  it("adaptive-scope-header enforces min-h-[44px] on mobile tabs", () => {
    assert.match(scopeHeader, /min-h-\[44px\]/);
  });

  it("adaptive-scope-header has touch-manipulation", () => {
    assert.match(scopeHeader, /touch-manipulation/);
  });

  it("workspace-toolbar has focus-visible rings on interactive controls", () => {
    assert.match(toolbar, /focus-visible:ring-/);
  });

  it("workspace-toolbar has no dark: class variants", () => {
    const lines = toolbar.split("\n").filter((l) => !/^\s*(\/\/|\*|\*\/)/.test(l));
    const darkLines = lines.filter((l) => /dark:[a-z]/.test(l) && !/zero dark:|no dark:/.test(l));
    assert.deepStrictEqual(darkLines, []);
  });
});

// ---------------------------------------------------------------------------
// 7. Kanban — Cards have no permanent status Select component
// ---------------------------------------------------------------------------

describe("7. Kanban — Cards: no permanent status Select; menu-based transition only", () => {
  const kanban = read(KANBAN);

  it("kanban board contains no <Select> or SelectTrigger at card level", () => {
    assert.doesNotMatch(kanban, /<Select/);
    assert.doesNotMatch(kanban, /SelectTrigger/);
    assert.doesNotMatch(kanban, /SelectContent/);
  });

  it("kanban cards expose status transitions via action menu (data-slot=kanban-action-menu)", () => {
    assert.match(kanban, /data-slot="kanban-action-menu"/);
  });

  it("kanban action menu trigger has aria-label, aria-expanded, aria-haspopup", () => {
    assert.match(kanban, /aria-label="Thao tác"/);
    assert.match(kanban, /aria-expanded=\{menuOpen\}/);
    assert.match(kanban, /aria-haspopup="menu"/);
  });

  it("kanban action menu closes on Escape key", () => {
    assert.match(kanban, /e\.key === "Escape"/);
    assert.match(kanban, /setMenuOpen\(false\)/);
  });

  it("kanban action menu closes on outside mousedown", () => {
    assert.match(kanban, /mousedown/);
    assert.match(kanban, /menuRef\.current/);
  });

  it("kanban action menu items have role=menuitem", () => {
    assert.match(kanban, /role="menuitem"/);
  });

  it("kanban status submenu button has aria-expanded", () => {
    assert.match(kanban, /aria-expanded=\{statusSubmenuOpen\}/);
  });

  it("kanban action menu trigger has focus-visible ring", () => {
    assert.match(kanban, /focus-visible:ring-/);
  });

  it("kanban card action trigger enforces min-h-[44px] on mobile (min-h-[44px] sm:min-h-)", () => {
    assert.match(kanban, /min-h-\[44px\] sm:min-h-/);
  });

  it("kanban board is keyboard-navigable via column prev/next buttons with aria-labels", () => {
    // Template literal: aria-label={`Chuyển tới cột ${col.title}`}
    assert.match(kanban, /aria-label=\{`Chuyển tới cột \$\{col\.title\}`\}/);
  });

  it("kanban uses getNextStatus / getPrevStatus helpers for status transitions", () => {
    assert.match(kanban, /getNextStatus/);
    assert.match(kanban, /getPrevStatus/);
  });
});

// ---------------------------------------------------------------------------
// 8. Dashboard — Exactly one attention surface, correct section order
// ---------------------------------------------------------------------------

describe("8. Dashboard — Structure: one attention surface, action→situation→context order", () => {
  const zone = read(DASHBOARD_ZONE);

  it("dashboard zone has data-slot=zone-dashboard", () => {
    assert.match(zone, /data-slot="zone-dashboard"/);
  });

  it("dashboard has exactly one section-action slot", () => {
    const count = countMatches(zone, /data-slot="section-action"/);
    assert.strictEqual(count, 1, `Expected 1 section-action, found ${count}`);
  });

  it("dashboard has exactly one section-situation slot", () => {
    const count = countMatches(zone, /data-slot="section-situation"/);
    assert.strictEqual(count, 1, `Expected 1 section-situation, found ${count}`);
  });

  it("dashboard has exactly one section-context slot", () => {
    const count = countMatches(zone, /data-slot="section-context"/);
    assert.strictEqual(count, 1, `Expected 1 section-context, found ${count}`);
  });

  it("dashboard sections appear in order: action → situation → context", () => {
    const actionIdx = zone.indexOf('data-slot="section-action"');
    const situationIdx = zone.indexOf('data-slot="section-situation"');
    const contextIdx = zone.indexOf('data-slot="section-context"');
    assert.ok(
      actionIdx < situationIdx && situationIdx < contextIdx,
      `Expected action < situation < context order. Got action=${actionIdx}, situation=${situationIdx}, context=${contextIdx}`
    );
  });

  it("dashboard sections carry Vietnamese aria-labels", () => {
    assert.match(zone, /aria-label="CẦN XỬ LÝ"/);
    assert.match(zone, /aria-label="TÌNH HÌNH"/);
    assert.match(zone, /aria-label="ĐƠN VỊ CẦN CHÚ Ý"/);
  });
});

// ---------------------------------------------------------------------------
// 9. Calendar — One primary chrome row on desktop
// ---------------------------------------------------------------------------

describe("9. Calendar — One primary chrome/control row on desktop", () => {
  const cal = read(CALENDAR_WS);

  it("calendar workspace has data-slot=calendar-workspace", () => {
    assert.match(cal, /data-slot="calendar-workspace"/);
  });

  it("calendar has exactly one unified control bar (flex-col sm:flex-row container)", () => {
    // The unified control bar uses 'flex flex-col sm:flex-row' as the distinguishing desktop layout class
    const count = countMatches(cal, /flex flex-col sm:flex-row/);
    assert.strictEqual(
      count,
      1,
      `Expected exactly 1 unified control bar (flex-col sm:flex-row), found ${count}`
    );
  });

  it("calendar date nav buttons have aria-labels", () => {
    assert.match(cal, /aria-label="Kỳ trước"/);
    assert.match(cal, /aria-label="Kỳ sau"/);
  });
});

// ---------------------------------------------------------------------------
// 10. Workspace — Aria-label on action-queue trigger
// ---------------------------------------------------------------------------

describe("10. Workspace — Action queue trigger accessibility", () => {
  const ws = read(WORKSPACE);

  it("action queue trigger has data-slot=action-queue-trigger", () => {
    assert.match(ws, /data-slot="action-queue-trigger"/);
  });

  it("action queue trigger has aria-label", () => {
    assert.match(ws, /aria-label="Mở hàng đợi xử lý công việc"/);
  });

  it("workspace canvas buttons enforce min-h-[44px] on mobile", () => {
    assert.match(ws, /min-h-\[44px\]/);
  });
});
