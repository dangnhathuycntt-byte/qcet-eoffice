---
status: completed
domain: data
created: 2026-09-09
---

# System-Wide Monthly Partitioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a unified Operational Time Engine partitioning all core workspaces (Bàn làm việc / Desk, Lịch làm việc / Calendar, Quản lý nhiệm vụ / Tasks Hub, and Documents) by QCET Academic Month (25th to 24th cycle) with a Global Month Selector on Topbar, instant bucket switching, and zero overdue task leakage.

**Architecture:** Extend `src/lib/academic-calendar.ts` to compute zero-lag monthly task buckets and prior overdue backlogs; propagate the global month state through `use-url-params-sync.ts` and `use-task-filters.ts`; mount a `GlobalMonthSelector` in `app-topbar.tsx`; connect month scoping to `DashboardZone` (KPIs, Prior Overdue Banner, 11-department matrix), `CalendarZone` (synchronized monthly grid with cycle boundary highlighting), and `TasksZone` (interactive 12-month horizontal strip and table/kanban view).

**Tech Stack:** Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS v4 (Light-Only OKLCH), Lucide Icons, Node.js Test Runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-09-system-wide-monthly-partitioning-spec.md`

## Global Constraints

- Follow QCET Academic Month cycle strictly: Month $M$ starts on day 25 of month $M-1$ at `00:00:00.000` (UTC+7) and ends on day 24 of month $M$ at `23:59:59.999` (UTC+7).
- Academic Year month order: `[9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]`.
- Enforce Tailwind CSS v4 Light-Only standard (`@theme inline`, OKLCH palette). Never introduce `dark:` classes or ThemeProvider.
- Strictly adhere to zero-mockup rule: consume real data from Prisma backend/API.
- Zero Overdue Task Loss: Overdue tasks from prior months must remain visible under a designated "Tồn đọng kỳ trước" (Prior Overdue Backlog) section.
- Zero-leak subtask filtering: When viewing Month $M$, multi-month tasks qualify, but subtask statistics only count deliverables and subtasks due in Month $M$.
- Maintain strict TypeScript type checking (`npm run typecheck`) and pass 100% test suite (`npm test`).

---

### Task 1: Academic Month Partitioning & Backlog Engine

**Files:**
- Modify: `src/lib/academic-calendar.ts`
- Test: `tests/academic-calendar-monthly-partition.test.ts`

**Interfaces:**
- Consumes: `SchoolTask`, `SubTask` types from `@/types/dashboard`, existing `getAcademicMonthInfo`, `getAcademicYear` from `@/lib/academic-calendar`.
- Produces:
  - `filterTasksByAcademicMonthStrict(tasks: SchoolTask[], month: number | "ALL", academicYear?: string): SchoolTask[]`
  - `computePriorOverdueBacklog(tasks: SchoolTask[], month: number, academicYear: string, referenceDate?: string): SchoolTask[]`
  - `computeMonthPartitionBucket(tasks: SchoolTask[], month: number, academicYear: string, referenceDate?: string): MonthPartitionBucket`

- [ ] **Step 1: Write the failing test for monthly partitioning & backlog computation**

Create `tests/academic-calendar-monthly-partition.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  filterTasksByAcademicMonthStrict,
  computePriorOverdueBacklog,
  computeMonthPartitionBucket,
} from "../src/lib/academic-calendar";
import type { SchoolTask } from "../src/types/dashboard";

describe("Academic Calendar Monthly Partitioning & Backlog Engine", () => {
  const sampleTasks: SchoolTask[] = [
    {
      id: "task-sept-1",
      code: "NV-01",
      title: "Khai giảng năm học mới",
      description: "Tổ chức lễ khai giảng",
      category: "CHUYEN_MON",
      priority: "URGENT",
      status: "IN_PROGRESS",
      progressPercent: 70,
      dueDate: "2026-09-05T00:00:00.000Z",
      startDate: "2026-08-26T00:00:00.000Z",
      departmentId: "P_DTQLKH",
      departmentName: "Phòng Đào tạo",
      subTasks: [
        {
          id: "sub-1",
          taskId: "task-sept-1",
          title: "In ấn tài liệu",
          status: "COMPLETED",
          dueDate: "2026-09-02T00:00:00.000Z",
          assignedToDepartmentId: "P_DTQLKH",
          assignedToDepartmentName: "Phòng Đào tạo",
          createdAt: "2026-08-26T00:00:00.000Z",
          updatedAt: "2026-09-02T00:00:00.000Z",
        },
      ],
      deliverables: [],
      assignees: [],
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    },
    {
      id: "task-aug-overdue",
      code: "NV-02",
      title: "Tổng kết tuyển sinh đợt 1",
      description: "Nhiệm vụ trễ hạn từ tháng 8",
      category: "HANH_CHINH",
      priority: "HIGH",
      status: "IN_PROGRESS",
      progressPercent: 40,
      dueDate: "2026-08-20T00:00:00.000Z",
      startDate: "2026-08-01T00:00:00.000Z",
      departmentId: "P_DTQLKH",
      departmentName: "Phòng Đào tạo",
      subTasks: [],
      deliverables: [],
      assignees: [],
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
    },
    {
      id: "task-oct-1",
      code: "NV-03",
      title: "Hội nghị NCKH sinh viên",
      description: "Hội nghị tháng 10",
      category: "CHUYEN_MON",
      priority: "NORMAL",
      status: "TODO",
      progressPercent: 0,
      dueDate: "2026-10-15T00:00:00.000Z",
      startDate: "2026-09-28T00:00:00.000Z",
      departmentId: "K_CNTT",
      departmentName: "Khoa CNTT",
      subTasks: [],
      deliverables: [],
      assignees: [],
      createdAt: "2026-09-20T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z",
    },
  ];

  test("filterTasksByAcademicMonthStrict returns only tasks due or active in Month 9", () => {
    const septTasks = filterTasksByAcademicMonthStrict(sampleTasks, 9, "2026-2027");
    assert.equal(septTasks.length, 1);
    assert.equal(septTasks[0].id, "task-sept-1");
  });

  test("computePriorOverdueBacklog identifies unfinished tasks due before Month 9 window", () => {
    const backlog = computePriorOverdueBacklog(sampleTasks, 9, "2026-2027", "2026-09-04");
    assert.equal(backlog.length, 1);
    assert.equal(backlog[0].id, "task-aug-overdue");
  });

  test("computeMonthPartitionBucket produces structured bucket for Month 9", () => {
    const bucket = computeMonthPartitionBucket(sampleTasks, 9, "2026-2027", "2026-09-04");
    assert.equal(bucket.monthNumber, 9);
    assert.equal(bucket.tasks.length, 1);
    assert.equal(bucket.priorOverdueBacklog.length, 1);
    assert.equal(bucket.stats.totalTasks, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/academic-calendar-monthly-partition.test.ts`
Expected: FAIL (functions not exported from `src/lib/academic-calendar.ts`).

- [ ] **Step 3: Implement functions in `src/lib/academic-calendar.ts`**

Add exports in `src/lib/academic-calendar.ts`:
- Define interface `MonthPartitionBucket`:
  ```typescript
  export interface MonthPartitionBucket {
    monthNumber: number;
    academicYear: string;
    period: AcademicMonthPeriod;
    tasks: SchoolTask[];
    priorOverdueBacklog: SchoolTask[];
    stats: {
      totalTasks: number;
      completedTasks: number;
      inProgressTasks: number;
      overdueTasks: number;
      completionRate: number;
    };
  }
  ```
- Implement `filterTasksByAcademicMonthStrict(tasks, month, academicYear)`:
  - If `month === "ALL"`, return `tasks`.
  - Resolve academic month period `getAcademicMonthPeriod(month, academicYear)`.
  - Check if task `dueDate` is within period range, or if task `startDate <= period.endDate` and `dueDate >= period.startDate`.
  - Return filtered tasks with pruned subTasks for month-accurate stats.
- Implement `computePriorOverdueBacklog(tasks, month, academicYear, referenceDate)`:
  - Find all tasks where `status !== "COMPLETED"` and `dueDate < period.startDate`.
- Implement `computeMonthPartitionBucket(tasks, month, academicYear, referenceDate)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/academic-calendar-monthly-partition.test.ts`
Expected: PASS (all 3 tests pass).

- [ ] **Step 5: Commit changes**

```bash
git add src/lib/academic-calendar.ts tests/academic-calendar-monthly-partition.test.ts
git commit -m "feat(calendar-engine): add strict monthly task partitioning and prior overdue backlog calculation"
```

---

### Task 2: State Management & URL Sync Integration

**Files:**
- Modify: `src/hooks/use-url-params-sync.ts`
- Modify: `src/hooks/use-task-filters.ts`
- Test: `tests/monthly-task-filters-sync.test.ts`

**Interfaces:**
- Consumes: `useTaskFilters`, `useUrlParamsSync`, `filterTasksByAcademicMonthStrict`, `computePriorOverdueBacklog`.
- Produces:
  - `useTaskFilters` returns `selectedAcademicMonth`, `priorOverdueBacklog`, `monthlyScopedStats`, `monthlyDepartmentHealth`, and `monthlyExecutiveStats` synchronized with `selectedAcademicMonth`.

- [ ] **Step 1: Write test for URL sync and monthly scoped stats in `use-task-filters`**

Create `tests/monthly-task-filters-sync.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeDepartmentHealthMatrix } from "../src/lib/executive-matrix-aggregator";
import type { SchoolTask } from "../src/types/dashboard";

describe("Monthly Task Filters & Department Matrix Sync", () => {
  const tasks: SchoolTask[] = [
    {
      id: "task-1",
      code: "NV-01",
      title: "Việc tháng 9",
      category: "CHUYEN_MON",
      priority: "HIGH",
      status: "COMPLETED",
      progressPercent: 100,
      dueDate: "2026-09-10T00:00:00.000Z",
      departmentId: "P_DTQLKH",
      departmentName: "Phòng Đào tạo",
      subTasks: [],
      deliverables: [],
      assignees: [],
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
    },
    {
      id: "task-2",
      code: "NV-02",
      title: "Việc tháng 10",
      category: "CHUYEN_MON",
      priority: "NORMAL",
      status: "IN_PROGRESS",
      progressPercent: 30,
      dueDate: "2026-10-10T00:00:00.000Z",
      departmentId: "P_DTQLKH",
      departmentName: "Phòng Đào tạo",
      subTasks: [],
      deliverables: [],
      assignees: [],
      createdAt: "2026-09-25T00:00:00.000Z",
      updatedAt: "2026-09-25T00:00:00.000Z",
    },
  ];

  test("computeDepartmentHealthMatrix reflects filtered tasks for Month 9", () => {
    const septTasks = [tasks[0]];
    const matrix = computeDepartmentHealthMatrix(septTasks, "2026-09-04");
    const dtqlkh = matrix.find((d) => d.code === "P_DTQLKH");
    assert.ok(dtqlkh);
    assert.equal(dtqlkh?.totalTasks, 1);
    assert.equal(dtqlkh?.completedTasks, 1);
  });
});
```

- [ ] **Step 2: Run test to verify behavior**

Run: `npx tsx --test tests/monthly-task-filters-sync.test.ts`
Expected: PASS.

- [ ] **Step 3: Update `src/hooks/use-task-filters.ts` and `src/hooks/use-url-params-sync.ts`**

In `src/hooks/use-task-filters.ts`:
- Import `computePriorOverdueBacklog` and `filterTasksByAcademicMonthStrict` from `@/lib/academic-calendar`.
- Compute `monthScopedBaseTasks`:
  ```typescript
  const monthScopedBaseTasks = React.useMemo(() => {
    if (selectedAcademicMonth === "ALL") return scopedBaseTasks;
    return filterTasksByAcademicMonthStrict(scopedBaseTasks, selectedAcademicMonth, "2026-2027");
  }, [scopedBaseTasks, selectedAcademicMonth]);
  ```
- Compute `priorOverdueBacklog`:
  ```typescript
  const priorOverdueBacklog = React.useMemo(() => {
    if (selectedAcademicMonth === "ALL") return [];
    return computePriorOverdueBacklog(scopedBaseTasks, selectedAcademicMonth, "2026-2027", referenceDate);
  }, [scopedBaseTasks, selectedAcademicMonth, referenceDate]);
  ```
- Update `displayedStats`: use `monthScopedBaseTasks` instead of `scopedBaseTasks` so KPI tiles dynamically update when the user changes month.
- Update `departmentHealth` and `executiveStats`: pass `monthScopedBaseTasks` (or month-filtered executive tasks) so the 11-department matrix shows status for the selected month.
- Return `priorOverdueBacklog` in the hook return object.

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit changes**

```bash
git add src/hooks/use-task-filters.ts tests/monthly-task-filters-sync.test.ts
git commit -m "feat(task-filters): scope displayed stats, department health, and prior overdue backlog to selected academic month"
```

---

### Task 3: Global Month Selector on App Topbar

**Files:**
- Create: `src/components/layout/global-month-selector.tsx`
- Modify: `src/components/layout/app-topbar.tsx`
- Test: `tests/global-month-selector.test.ts`

**Interfaces:**
- Consumes: `useDashboardData`, `ACADEMIC_MONTH_ORDER`, `getAcademicMonthPeriod` from `@/lib/academic-calendar`.
- Produces: `GlobalMonthSelector` component rendered in `AppTopbar` allowing users to switch between Tháng 9 .. Tháng 8, "Tháng hiện tại", or "Cả năm" with immediate URL query update (`?month=...`).

- [ ] **Step 1: Write test for `global-month-selector.tsx` structure and rendering**

Create `tests/global-month-selector.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Global Month Selector Component Invariants", () => {
  const componentPath = path.resolve(process.cwd(), "src/components/layout/global-month-selector.tsx");

  test("component file exists and exports GlobalMonthSelector", () => {
    assert.ok(fs.existsSync(componentPath), "global-month-selector.tsx must exist");
    const content = fs.readFileSync(componentPath, "utf8");
    assert.match(content, /export function GlobalMonthSelector/);
    assert.match(content, /ACADEMIC_MONTH_ORDER/);
    assert.match(content, /Popover/);
  });

  test("app-topbar.tsx includes GlobalMonthSelector alongside ScopeSwitcher", () => {
    const topbarPath = path.resolve(process.cwd(), "src/components/layout/app-topbar.tsx");
    const content = fs.readFileSync(topbarPath, "utf8");
    assert.match(content, /GlobalMonthSelector/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/global-month-selector.test.ts`
Expected: FAIL (`global-month-selector.tsx` does not exist yet).

- [ ] **Step 3: Implement `GlobalMonthSelector`**

Create `src/components/layout/global-month-selector.tsx`:
- Render an accessible button trigger showing current month label: `📅 Tháng M (25/MM-1 - 24/MM)` on desktop, or `📅 TM` on mobile.
- Use Popover/Dropdown displaying:
  - Header with Academic Year `2026-2027` and shortcut buttons: `[Tháng hiện tại: T9]` and `[Xem cả năm]`.
  - 3 Semester Groups:
    - **Học kỳ I:** Tháng 9, Tháng 10, Tháng 11, Tháng 12.
    - **Học kỳ II:** Tháng 1, Tháng 2, Tháng 3, Tháng 4, Tháng 5.
    - **Học kỳ Hè:** Tháng 6, Tháng 7, Tháng 8.
  - Each month button displays its exact date span (e.g. `25/08 - 24/09`) and task count badge.
  - Clicking a month updates the URL search param `month` using `router.push(newUrl, { scroll: false })` or `updateFilter("selectedAcademicMonth", month)`.
- Mount `GlobalMonthSelector` into `src/components/layout/app-topbar.tsx` next to `<ScopeSwitcher />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/global-month-selector.test.ts`
Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit changes**

```bash
git add src/components/layout/global-month-selector.tsx src/components/layout/app-topbar.tsx tests/global-month-selector.test.ts
git commit -m "feat(topbar): introduce global academic month selector with semester grouping and URL sync"
```

---

### Task 4: Bàn làm việc (Desk / Dashboard Zone) Monthly Scoping & Backlog Banner

**Files:**
- Modify: `src/components/dashboard/zones/dashboard-zone.tsx`
- Modify: `src/components/dashboard/prior-overdue-backlog-banner.tsx` (Create if needed)
- Test: `tests/dashboard-zone-monthly.test.ts`

**Interfaces:**
- Consumes: `useDashboardData()` (`selectedAcademicMonth`, `priorOverdueBacklog`, `displayedStats`, `departmentHealth`).
- Produces: `DashboardZone` reflecting selected month in KPI cards, showing `PriorOverdueBacklogBanner` when there are carryover overdue tasks, and department progress matrix for the month.

- [ ] **Step 1: Write test for `DashboardZone` monthly integration**

Create `tests/dashboard-zone-monthly.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("DashboardZone Monthly Partitioning", () => {
  const zonePath = path.resolve(process.cwd(), "src/components/dashboard/zones/dashboard-zone.tsx");

  test("dashboard-zone.tsx renders monthly indicator and connects to priorOverdueBacklog", () => {
    const content = fs.readFileSync(zonePath, "utf8");
    assert.match(content, /selectedAcademicMonth/);
    assert.match(content, /priorOverdueBacklog/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/dashboard-zone-monthly.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement monthly indicator & Prior Overdue Banner in `dashboard-zone.tsx`**

1. Create `src/components/dashboard/prior-overdue-backlog-banner.tsx`:
   - Alert banner with warning styling (Amber/Rose OKLCH border and badge).
   - "⚠️ Có N nhiệm vụ tồn đọng/trễ hạn từ các kỳ trước cần xử lý [Xem danh sách]".
   - Collapsible panel showing overdue tasks from earlier months so leadership never loses visibility.
2. In `src/components/dashboard/zones/dashboard-zone.tsx`:
   - Read `selectedAcademicMonth` and `priorOverdueBacklog` from `useDashboardData()`.
   - Render header chip indicating the active operational month:
     `KỲ VẬN HÀNH THÁNG M (25/MM-1 - 24/MM/2026)`.
   - Render `<PriorOverdueBacklogBanner tasks={priorOverdueBacklog} />` above the matrix if `priorOverdueBacklog.length > 0`.
   - Pass monthly scoped data to `ExecutiveStatStrip` and `DepartmentProgressMatrix`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/dashboard-zone-monthly.test.ts`
Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit changes**

```bash
git add src/components/dashboard/prior-overdue-backlog-banner.tsx src/components/dashboard/zones/dashboard-zone.tsx tests/dashboard-zone-monthly.test.ts
git commit -m "feat(dashboard): add operational month banner and prior overdue backlog alert to desk view"
```

---

### Task 5: Lịch làm việc (Calendar Zone) Two-Way Month Sync

**Files:**
- Modify: `src/components/dashboard/zones/calendar-zone.tsx`
- Modify: `src/components/calendar/calendar-month-view.tsx`
- Test: `tests/calendar-zone-monthly-sync.test.ts`

**Interfaces:**
- Consumes: `selectedAcademicMonth` from `useDashboardData()`, `setSelectedAcademicMonth` / URL sync.
- Produces: Calendar view that automatically synchronizes with the globally selected month, provides previous/next month controls, and highlights dates within the QCET operational cycle (25th to 24th).

- [ ] **Step 1: Write test for calendar zone synchronization**

Create `tests/calendar-zone-monthly-sync.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Calendar Zone Monthly Synchronization", () => {
  const calendarZonePath = path.resolve(process.cwd(), "src/components/dashboard/zones/calendar-zone.tsx");

  test("calendar-zone.tsx syncs with selectedAcademicMonth and supports quick navigation", () => {
    const content = fs.readFileSync(calendarZonePath, "utf8");
    assert.match(content, /selectedAcademicMonth/);
    assert.match(content, /initialMonth/);
  });
});
```

- [ ] **Step 2: Run test to verify it passes or fails**

Run: `npx tsx --test tests/calendar-zone-monthly-sync.test.ts`

- [ ] **Step 3: Enhance `calendar-zone.tsx` and `calendar-month-view.tsx`**

- In `src/components/dashboard/zones/calendar-zone.tsx`:
  - When `selectedAcademicMonth` in `DashboardContext` updates (e.g. user selects Month 10 from Topbar), update calendar active month via `useEffect` or state synchronization.
  - Add Quick Month Navigation controls: `[◄ Tháng trước]`, `[Tháng M / YYYY]`, `[Tháng sau ►]`, and `[Về tháng hiện tại]`. Clicking these updates `selectedAcademicMonth` so the entire app stays in sync.
- In `src/components/calendar/calendar-month-view.tsx`:
  - Highlight the active QCET operational cycle days (25th of previous month to 24th of active month) with a subtle accent border/background.
  - Dim days that fall outside the active cycle.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/calendar-zone-monthly-sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit changes**

```bash
git add src/components/dashboard/zones/calendar-zone.tsx src/components/calendar/calendar-month-view.tsx tests/calendar-zone-monthly-sync.test.ts
git commit -m "feat(calendar): synchronize calendar month view two-way with global academic month state"
```

---

### Task 6: Quản lý Nhiệm vụ (Tasks Hub) 12-Month Interactive Strip

**Files:**
- Create: `src/components/tasks/month-strip-selector.tsx`
- Modify: `src/components/dashboard/zones/tasks-zone.tsx`
- Modify: `src/app/tasks/page.tsx`
- Test: `tests/tasks-zone-monthly.test.ts`

**Interfaces:**
- Consumes: `monthlyTaskCounts` from `useDashboardData()`, `selectedAcademicMonth`, `setSelectedAcademicMonth`.
- Produces: `MonthStripSelector` rendered at the top of the Tasks Hub, allowing one-click filtering between all 12 academic months with task counts.

- [ ] **Step 1: Write test for `MonthStripSelector` and `tasks-zone.tsx` integration**

Create `tests/tasks-zone-monthly.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Tasks Zone Monthly Strip Integration", () => {
  const stripPath = path.resolve(process.cwd(), "src/components/tasks/month-strip-selector.tsx");
  const tasksZonePath = path.resolve(process.cwd(), "src/components/dashboard/zones/tasks-zone.tsx");

  test("month-strip-selector.tsx exists and is mounted in tasks-zone.tsx", () => {
    assert.ok(fs.existsSync(stripPath), "month-strip-selector.tsx must exist");
    const stripContent = fs.readFileSync(stripPath, "utf8");
    assert.match(stripContent, /export function MonthStripSelector/);

    const zoneContent = fs.readFileSync(tasksZonePath, "utf8");
    assert.match(zoneContent, /MonthStripSelector/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/tasks-zone-monthly.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `MonthStripSelector` and integrate into `tasks-zone.tsx`**

1. Create `src/components/tasks/month-strip-selector.tsx`:
   - Render a horizontal scrollable pill bar:
     - `[Tất cả (Tổng việc)]`
     - Followed by 12 academic months in order: `[T9 (24)]`, `[T10 (18)]`, `[T11 (12)]`, `[T12 (31)]`, `[T1 (9)]`, ..., `[T8 (10)]`.
   - Active month has distinct primary brand styling (`bg-primary text-primary-foreground font-semibold shadow-xs`).
   - Shows a badge with task count for each month.
   - Hover tooltip displays exact period (e.g. `Tháng 9: 25/08 - 24/09/2026`).
   - Clicking a pill calls `setSelectedAcademicMonth(m)` and updates URL query param `month`.
2. Integrate into `src/components/dashboard/zones/tasks-zone.tsx` right above the table/kanban view.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/tasks-zone-monthly.test.ts`
Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit changes**

```bash
git add src/components/tasks/month-strip-selector.tsx src/components/dashboard/zones/tasks-zone.tsx tests/tasks-zone-monthly.test.ts
git commit -m "feat(tasks): introduce interactive 12-month strip selector with live task count badges"
```

---

### Task 7: Full System Regression & Verification Suite

**Files:**
- Test: `tests/system-wide-monthly-partitioning.test.ts`

**Interfaces:**
- Verifies: All 4 zones (`dashboard`, `calendar`, `tasks`, `documents`) correctly respect and partition data by academic month.

- [ ] **Step 1: Write full end-to-end integration test**

Create `tests/system-wide-monthly-partitioning.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getAcademicMonthInfo,
  filterTasksByAcademicMonthStrict,
  computePriorOverdueBacklog,
} from "../src/lib/academic-calendar";
import { CANONICAL_ROUTES } from "../src/lib/navigation/canonical-navigation-registry";

describe("System-Wide Monthly Partitioning Integration Suite", () => {
  test("Academic calendar cycle correctly identifies August 25 as start of Month 9", () => {
    const info = getAcademicMonthInfo("2026-08-25");
    assert.equal(info.monthNumber, 9);
    assert.equal(info.academicYear, "2026-2027");
  });

  test("Academic calendar cycle correctly identifies September 24 as end of Month 9", () => {
    const info = getAcademicMonthInfo("2026-09-24");
    assert.equal(info.monthNumber, 9);
  });

  test("Academic calendar cycle correctly identifies September 25 as start of Month 10", () => {
    const info = getAcademicMonthInfo("2026-09-25");
    assert.equal(info.monthNumber, 10);
  });

  test("Canonical routes include all core partitioned zones", () => {
    const zoneIds = CANONICAL_ROUTES.map((r) => r.id);
    assert.ok(zoneIds.includes("desk"));
    assert.ok(zoneIds.includes("calendar"));
    assert.ok(zoneIds.includes("tasks"));
    assert.ok(zoneIds.includes("documents"));
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx tsx --test tests/system-wide-monthly-partitioning.test.ts`
Expected: PASS.

- [ ] **Step 3: Run full project typecheck**

Run: `npm run typecheck`
Expected: `tsc --noEmit` exits with 0 errors.

- [ ] **Step 4: Run full project test suite**

Run: `npm test`
Expected: All tests pass (1500+ tests pass, 0 fail).

- [ ] **Step 5: Commit changes**

```bash
git add tests/system-wide-monthly-partitioning.test.ts
git commit -m "test(monthly-partitioning): add comprehensive regression suite verifying system-wide monthly engine"
```
