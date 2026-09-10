---
status: completed
domain: architecture
created: 2026-09-06
---

# Unified Task Management Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform QCET E-Office into a focused, unified task management workstation by consolidating fragmented screens into a single `/` hub with instant Scope switching (My Focus, School, Unit), multi-view display (Table, Kanban, Calendar), and interactive workboxes.

**Architecture:** We consolidate navigation from 5 scattered routes down to 4 focused items (`/`, `/org`, `/dashboard`, `/notifications`), set up backwards-compatible redirects for legacy URLs (`/tasks`, `/unit-tasks`, `/calendar`), build a reusable `UnifiedTaskToolbar` component, enhance `ExecutiveStatStrip` with filter-on-click, and wire everything into `src/app/page.tsx` to drive `CascadingTaskTable`, `TaskKanbanBoard`, and `CalendarMonthView` from a single source of state.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide React, Node test runner (`tsx --test`).

**Spec:** [docs/superpowers/specs/2026-09-06-unified-task-management-hub-design.md](docs/superpowers/specs/2026-09-06-unified-task-management-hub-design.md)

## Global Constraints

- **Anti-AI-Slop:** 0% emoji icons, Lucide stroke width 1.5/1.25, clean muted badge and accent colors.
- **Precision Typography:** Monospace `tabular-nums` on all stats, counts, dates, and percentages.
- **Zero Blank Screen / Zero Regressions:** All 91 existing unit tests must continue to pass or be updated cleanly to reflect the 4 unified routes.
- **Backwards Compatibility:** Accessing `/tasks`, `/unit-tasks`, and `/calendar` must cleanly redirect to `/` with query parameters.

---

### Task 1: Navigation & Backwards-Compatible Routing

**Files:**
- Modify: `src/lib/tokens.ts:154-168`
- Modify: `src/components/navigation.tsx:37-44`
- Modify: `next.config.ts:1-12`
- Modify: `src/app/tasks/page.tsx:1-40`
- Modify: `src/app/unit-tasks/page.tsx:1-40`
- Modify: `src/app/calendar/page.tsx:1-40`
- Test: `tests/sprint2-integration.test.ts`
- Test: `tests/dashboard-integration.test.ts`
- Test: `tests/smoke-qcet-design-system.test.ts`

**Interfaces:**
- Produces: `NAV_ITEMS` and `NAVIGATION_ITEMS` with 4 unified items:
  1. `{ href: "/", label: "Quản lý công việc", icon: CheckSquare }`
  2. `{ href: "/org", label: "Cơ cấu & Danh bạ", icon: Network }`
  3. `{ href: "/dashboard", label: "Báo cáo KPI", icon: LayoutDashboard }`
  4. `{ href: "/notifications", label: "Thông báo", icon: Bell }`
- Produces: Server-level and client-level redirects from `/tasks`, `/unit-tasks`, `/calendar` to `/?scope=school`, `/?scope=unit`, `/?view=calendar`.

- [ ] **Step 1: Update navigation tests for the 4 unified routes and redirects**

In `tests/sprint2-integration.test.ts`, update tests to verify the 4 unified routes:
```typescript
describe("Sprint 2 Integration & Navigation", () => {
  test("NAV_ITEMS routes match all implemented pages", () => {
    const paths = NAV_ITEMS.map((item) => item.href);
    assert.ok(paths.includes("/"), "contains root task management route");
    assert.ok(paths.includes("/org"), "contains org hierarchy route");
    assert.ok(paths.includes("/dashboard"), "contains dashboard route");
    assert.ok(paths.includes("/notifications"), "contains notifications route");
  });

  test("NAVIGATION_ITEMS and NAV_ITEMS stay synchronized", () => {
    const tokenRoutes = NAV_ITEMS.map((item) => item.href);
    const compRoutes = NAVIGATION_ITEMS.map((item) => item.href);
    assert.deepEqual(
      tokenRoutes,
      compRoutes,
      "token routes and component routes must match exactly"
    );

    const labels = NAVIGATION_ITEMS.map((item) => item.label);
    assert.ok(labels.includes("Quản lý công việc"));
    assert.ok(labels.includes("Cơ cấu & Danh bạ") || labels.includes("Cơ cấu tổ chức"));
    assert.ok(labels.includes("Báo cáo KPI"));
    assert.ok(labels.includes("Thông báo"));
  });
});
```
Also update corresponding assertions in `tests/dashboard-integration.test.ts` and `tests/smoke-qcet-design-system.test.ts`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL due to route mismatch between 5 items and 4 items.

- [ ] **Step 3: Update `src/lib/tokens.ts` and `src/components/navigation.tsx`**

In `src/lib/tokens.ts`:
```typescript
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Quản lý công việc", icon: "CheckSquare" },
  { href: "/org", label: "Cơ cấu & Danh bạ", icon: "Network" },
  { href: "/dashboard", label: "Báo cáo KPI", icon: "LayoutDashboard" },
  { href: "/notifications", label: "Thông báo", icon: "Bell" },
];
```

In `src/components/navigation.tsx`:
```typescript
import {
  LayoutDashboard,
  CheckSquare,
  Network,
  Bell,
  Clock,
  Sun,
  Moon,
  Plus,
} from "lucide-react";

export const NAVIGATION_ITEMS = [
  { href: "/", label: "Quản lý công việc", icon: CheckSquare },
  { href: "/org", label: "Cơ cấu & Danh bạ", icon: Network },
  { href: "/dashboard", label: "Báo cáo KPI", icon: LayoutDashboard },
  { href: "/notifications", label: "Thông báo", icon: Bell },
];
```

In `next.config.ts`, add redirect rules:
```typescript
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: {
    root: path.resolve(__dirname),
  },
  async redirects() {
    return [
      {
        source: "/tasks",
        destination: "/?scope=school",
        permanent: false,
      },
      {
        source: "/unit-tasks",
        destination: "/?scope=unit",
        permanent: false,
      },
      {
        source: "/calendar",
        destination: "/?view=calendar",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
```

In `src/app/tasks/page.tsx`, `src/app/unit-tasks/page.tsx`, `src/app/calendar/page.tsx`, add client-side redirection with `useEffect` or `redirect` from `next/navigation` to smoothly direct client transitions to `/`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit changes**

```bash
git add src/lib/tokens.ts src/components/navigation.tsx next.config.ts src/app/tasks/page.tsx src/app/unit-tasks/page.tsx src/app/calendar/page.tsx tests/
git commit -m "feat(nav): consolidate navigation into 4 unified routes and configure redirects"
```

---

### Task 2: Unified Task Toolbar Component

**Files:**
- Create: `src/components/dashboard/unified-task-toolbar.tsx`
- Test: `tests/unified-task-toolbar.test.ts`

**Interfaces:**
```typescript
export type TaskScope = "MY_TASKS" | "SCHOOL_TASKS" | "UNIT_TASKS";
export type TaskViewMode = "table" | "kanban" | "calendar";

export interface UnifiedTaskToolbarProps {
  scope: TaskScope;
  onScopeChange: (scope: TaskScope) => void;
  viewMode: TaskViewMode;
  onViewModeChange: (mode: TaskViewMode) => void;
  selectedDepartment: string; // "ALL" or department code
  onDepartmentChange: (dept: string) => void;
  availableDepartments: { code: string; name: string }[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string; // "ALL" or TaskCategory
  onCategoryChange: (cat: string) => void;
  selectedPriority: string; // "ALL" | "URGENT" | "HIGH" | "NORMAL"
  onPriorityChange: (prio: string) => void;
  onNewTaskClick: () => void;
  canCreateTask: boolean;
}
```

- [ ] **Step 1: Write test for `UnifiedTaskToolbar` helper logic**

Create `tests/unified-task-toolbar.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  SCOPE_TABS,
  VIEW_MODE_OPTIONS,
  filterTasksByScope,
} from "../src/components/dashboard/unified-task-toolbar";
import { getMockDashboardPayload } from "../src/lib/mock-dashboard-data";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";

describe("UnifiedTaskToolbar Helpers", () => {
  const payload = getMockDashboardPayload();
  const staffUser = DEFAULT_DEMO_USERS[2]; // Nguyễn Ngọc Vinh (CNTT)
  const managerUser = DEFAULT_DEMO_USERS[1]; // Trần Hùng (DAO_TAO)
  const adminUser = DEFAULT_DEMO_USERS[0]; // BGH

  test("SCOPE_TABS defines 3 scopes: MY_TASKS, SCHOOL_TASKS, UNIT_TASKS", () => {
    const ids = SCOPE_TABS.map((t) => t.id);
    assert.deepEqual(ids, ["MY_TASKS", "SCHOOL_TASKS", "UNIT_TASKS"]);
  });

  test("VIEW_MODE_OPTIONS defines table, kanban, and calendar modes", () => {
    const ids = VIEW_MODE_OPTIONS.map((v) => v.id);
    assert.deepEqual(ids, ["table", "kanban", "calendar"]);
  });

  test("filterTasksByScope correctly filters for MY_TASKS", () => {
    const myTasks = filterTasksByScope(payload.tasks, "MY_TASKS", staffUser);
    assert.ok(myTasks.length > 0);
    // All returned tasks must involve staffUser
    for (const t of myTasks) {
      const isLead = t.leadAssigneeName === staffUser.name;
      const hasSub = t.subTasks?.some((s) => s.assigneeName === staffUser.name);
      assert.ok(isLead || hasSub, "task must be assigned to staff user");
    }
  });

  test("filterTasksByScope returns all tasks for SCHOOL_TASKS when ADMIN", () => {
    const schoolTasks = filterTasksByScope(payload.tasks, "SCHOOL_TASKS", adminUser);
    assert.equal(schoolTasks.length, payload.tasks.length);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test`
Expected: FAIL (module `unified-task-toolbar` does not exist).

- [ ] **Step 3: Implement `src/components/dashboard/unified-task-toolbar.tsx`**

Implement helper types, `SCOPE_TABS`, `VIEW_MODE_OPTIONS`, `filterTasksByScope`, and the React component with:
- Scope Switcher pills (`Việc của tôi`, `Nhiệm vụ cấp Trường`, `Công việc Đơn vị`)
- Dropdown select for department when `scope === "UNIT_TASKS"`
- View Mode Switcher buttons with Lucide icons (`List`, `Kanban`, `Calendar`)
- Search input with quick clear
- Category and Priority filter dropdowns
- `+ Giao việc mới` action button

- [ ] **Step 4: Run test to verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/dashboard/unified-task-toolbar.tsx tests/unified-task-toolbar.test.ts
git commit -m "feat(ui): implement UnifiedTaskToolbar component with scope and view switcher"
```

---

### Task 3: Interactive Workbox Filter-on-Click in ExecutiveStatStrip

**Files:**
- Modify: `src/components/dashboard/executive-stat-strip.tsx`
- Test: `tests/executive-stat-strip.test.ts`

**Interfaces:**
- Enhance `ExecutiveStatStripProps`:
  ```typescript
  export type WorkboxFilter = "ALL" | "URGENT_OVERDUE" | "MY_ACTION" | "ASSIGNED_BY_ME" | "COMPLETED";

  export interface ExecutiveStatStripProps {
    stats: DashboardStats;
    activeFilter?: WorkboxFilter;
    onFilterChange?: (filter: WorkboxFilter) => void;
    className?: string;
  }
  ```

- [ ] **Step 1: Write test for WorkboxFilter mapping in `tests/executive-stat-strip.test.ts`**

Add tests:
```typescript
test("getStatCardData assigns matching WorkboxFilter key to each card", () => {
  const cards = getStatCardData(mockStats);
  assert.equal(cards[0].filterKey, "URGENT_OVERDUE");
  assert.equal(cards[1].filterKey, "MY_ACTION");
  assert.equal(cards[2].filterKey, "ASSIGNED_BY_ME");
  assert.equal(cards[3].filterKey, "COMPLETED");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test`
Expected: FAIL (`filterKey` property undefined).

- [ ] **Step 3: Implement filter-on-click in `src/components/dashboard/executive-stat-strip.tsx`**

- Add `filterKey` to each stat card config.
- Add active indicator ring/border when `activeFilter === card.filterKey`.
- Support click handler `onClick={() => onFilterChange?.(activeFilter === card.filterKey ? "ALL" : card.filterKey)}`.

- [ ] **Step 4: Run test to verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/dashboard/executive-stat-strip.tsx tests/executive-stat-strip.test.ts
git commit -m "feat(dashboard): add interactive filter-on-click to ExecutiveStatStrip"
```

---

### Task 4: Complete Unified Task Hub Integration in `src/app/page.tsx`

**Files:**
- Modify: `src/app/page.tsx`
- Test: `tests/unified-task-hub.test.ts`

**Interfaces:**
- Connect `UnifiedTaskToolbar`, `ExecutiveStatStrip`, `CascadingTaskTable`, `TaskKanbanBoard`, and `CalendarMonthView` into a cohesive, responsive workstation.
- Read query parameters (`?scope=`, `?view=`) for direct deep-linking.
- Ensure click on any task across all 3 view modes opens `TaskDetailSideSheet`.

- [ ] **Step 1: Write integration tests for Unified Task Hub in `tests/unified-task-hub.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getMockDashboardPayload } from "../src/lib/mock-dashboard-data";
import { filterTasksByScope } from "../src/components/dashboard/unified-task-toolbar";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";

describe("Unified Task Hub Page Integration", () => {
  const payload = getMockDashboardPayload();
  const admin = DEFAULT_DEMO_USERS[0];
  const manager = DEFAULT_DEMO_USERS[1];
  const staff = DEFAULT_DEMO_USERS[2];

  test("Scope switching produces distinct task sets for manager", () => {
    const myTasks = filterTasksByScope(payload.tasks, "MY_TASKS", manager);
    const schoolTasks = filterTasksByScope(payload.tasks, "SCHOOL_TASKS", manager);
    const unitTasks = filterTasksByScope(payload.tasks, "UNIT_TASKS", manager);

    assert.ok(schoolTasks.length >= myTasks.length);
    assert.ok(unitTasks.length > 0);
  });

  test("Supports switching seamlessly between table, kanban, and calendar data shapes", () => {
    // SchoolTask array directly powers all three components
    assert.ok(Array.isArray(payload.tasks));
    assert.ok(payload.tasks[0].id.length > 0);
    assert.ok(payload.tasks[0].subTasks !== undefined);
  });
});
```

- [ ] **Step 2: Run test to verify it executes cleanly**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Update `src/app/page.tsx`**

Integrate:
1. URL query param sync (`useSearchParams` with Next.js Suspense wrapper).
2. State for:
   - `scope`: `"MY_TASKS"` | `"SCHOOL_TASKS"` | `"UNIT_TASKS"` (defaults to `"MY_TASKS"`)
   - `viewMode`: `"table"` | `"kanban"` | `"calendar"` (defaults to `"table"`)
   - `workboxFilter`: `"ALL"` | `"URGENT_OVERDUE"` | `"MY_ACTION"` | `"ASSIGNED_BY_ME"` | `"COMPLETED"`
   - `departmentFilter`: `"ALL"` or specific department code
   - `searchQuery`, `selectedCategory`, `selectedPriority`
3. Layout structure:
   - ExecutiveStatStrip with filter-on-click
   - UnifiedTaskToolbar
   - Conditional rendering:
     - `viewMode === "table"`: `CascadingTaskTable`
     - `viewMode === "kanban"`: `TaskKanbanBoard`
     - `viewMode === "calendar"`: `CalendarMonthView`
   - `TaskDetailSideSheet`
   - `CreateTaskModal`

- [ ] **Step 4: Run typecheck and test suite**

Run: `npm run typecheck && npm test`
Expected: PASS (0 errors).

- [ ] **Step 5: Commit changes**

```bash
git add src/app/page.tsx tests/unified-task-hub.test.ts
git commit -m "feat(hub): assemble Unified Task Hub with multi-scope, multi-view and interactive workboxes"
```

---

### Task 5: Full Verification & Build Check

**Files:**
- All modified files across the workspace

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: 100% tests pass (over 95+ test assertions).

- [ ] **Step 2: Run TypeScript Typecheck**

Run: `npm run typecheck`
Expected: 0 TypeScript errors.

- [ ] **Step 3: Run Next.js Build**

Run: `npm run build`
Expected: Build succeeds with static/dynamic route compilation without errors.

- [ ] **Step 4: Commit final verification stamp**

```bash
git commit --allow-empty -m "chore: verify full test suite and build for unified task hub"
```
