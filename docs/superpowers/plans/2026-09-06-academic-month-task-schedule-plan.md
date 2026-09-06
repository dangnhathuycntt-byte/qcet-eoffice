# Academic Calendar Cycle & Monthly Task Partitioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement QCET's operational calendar cycle (month starts on day 25 and ends on day 24 of the next month; academic year starts on 25/08 and ends on 24/08) and partition tasks and calendar views accordingly.

**Architecture:** Pure function mathematical calendar engine (`src/lib/academic-calendar.ts`) provides deterministic academic month and year calculations. `CalendarMonthView` is adapted to display the 25th-to-24th operational cycle with clear date span indicators. `UnifiedTaskToolbar` and `src/app/page.tsx` gain a 12-month operational cycle filter (Tháng 9 -> Tháng 8) with real-time task count rollups.

**Tech Stack:** Next.js 15, TypeScript, React 19, Lucide React, Tailwind CSS v4, Node test runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-06-academic-month-task-schedule-design.md`

## Global Constraints
- Academic Month cycle: Day 25 of month M-1 to Day 24 of month M.
- Academic Year cycle: 25/08 (start of Month 9) to 24/08 (end of Month 8 of following year).
- Pure UTC/date math without external heavy libraries (no moment/dayjs, clean JS standard Date/string math).
- Anti-slop stroke width: 1.5px on all icons.
- Avoid running `next build` concurrently with `next dev`; use `npm run typecheck` and `npm test` for gate verification.

---

### Task 1: Pure Mathematical Calendar Engine (`src/lib/academic-calendar.ts`) & Unit Tests

**Files:**
- Create: `src/lib/academic-calendar.ts`
- Test: `tests/academic-calendar.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface AcademicMonthPeriod {
    monthNumber: number; // 1 to 12 (12 operational months: 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8)
    monthIndexInYear: number; // 0 for Month 9, 11 for Month 8
    academicYear: string; // e.g. "2026-2027"
    startDate: string; // YYYY-MM-25
    endDate: string; // YYYY-MM-24
    label: string; // "Tháng 9"
    fullLabel: string; // "Tháng 9 / 2026 (25/08 - 24/09)"
    shortDateSpan: string; // "25/08 - 24/09"
  }
  export function getAcademicMonthInfo(dateInput: string | Date): AcademicMonthPeriod;
  export function getAcademicYear(dateInput: string | Date): string;
  export function getAcademicMonthsForYear(academicYear: string): AcademicMonthPeriod[];
  export function isDateInAcademicMonth(dateInput: string | Date, monthNumber: number, academicYear?: string): boolean;
  export function getAdjacentAcademicMonth(period: AcademicMonthPeriod, delta: number): AcademicMonthPeriod;
  ```

- [ ] **Step 1: Write the failing unit tests for academic calendar logic**
- [ ] **Step 2: Run test to verify failure (`npm test -- tests/academic-calendar.test.ts`)**
- [ ] **Step 3: Implement `src/lib/academic-calendar.ts` with exact 25th-to-24th math**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit `feat(calendar): implement academic calendar month cycle logic`**

---

### Task 2: Re-architect Calendar Month View (`src/components/calendar/calendar-month-view.tsx`)

**Files:**
- Modify: `src/components/calendar/calendar-month-view.tsx`
- Test: `tests/calendar-month-view.test.ts`

**Interfaces:**
- Consumes: `AcademicMonthPeriod`, `getAcademicMonthInfo`, `getAdjacentAcademicMonth` from `src/lib/academic-calendar.ts`.
- Updates `generateMonthGrid` to render the active academic cycle (from 25th of prev month to 24th of current month as `isCurrentMonth: true`).
- Updates header navigation to switch between academic months (Tháng 9 -> Tháng 8).

- [ ] **Step 1: Write unit tests for calendar grid generation under academic cycle**
- [ ] **Step 2: Update `generateMonthGrid` and `CalendarMonthView` component header & state**
- [ ] **Step 3: Run test to verify passes**
- [ ] **Step 4: Commit `feat(calendar): update calendar month view to 25th-to-24th academic cycle`**

---

### Task 3: Monthly Task Selector & Filter in `UnifiedTaskToolbar`

**Files:**
- Modify: `src/components/dashboard/unified-task-toolbar.tsx`
- Modify: `src/lib/unified-task-hub.ts`
- Test: `tests/unified-task-toolbar.test.ts`

**Interfaces:**
- Consumes: `getAcademicMonthsForYear` from `src/lib/academic-calendar.ts`.
- Extends `UnifiedTaskToolbarProps` with:
  ```typescript
  selectedAcademicMonth: number | "ALL"; // 1-12 or "ALL"
  onAcademicMonthChange: (month: number | "ALL") => void;
  academicYear?: string;
  monthlyTaskCounts?: Record<number, number>;
  ```
- Renders scrollable 12-month pill tabs (`Tháng 9`, `Tháng 10`, ..., `Tháng 8`).

- [ ] **Step 1: Write test for toolbar monthly filter props and rendering**
- [ ] **Step 2: Implement 12-month pill filter in `src/components/dashboard/unified-task-toolbar.tsx`**
- [ ] **Step 3: Run test to verify passes**
- [ ] **Step 4: Commit `feat(tasks): add 12 academic month filter bar to unified task toolbar`**

---

### Task 4: Connect Academic Month Filtering in `src/app/page.tsx`

**Files:**
- Modify: `src/app/page.tsx`
- Test: `tests/executive-dashboard-integration.test.ts`

**Interfaces:**
- Adds `selectedAcademicMonth` state (defaulting to current academic month, e.g. `9` for September).
- Adds `monthlyTaskCounts` computation across `scopedBaseTasks`.
- Filters `filteredTasks` by `selectedAcademicMonth` using `isDateInAcademicMonth`.

- [ ] **Step 1: Update integration test to assert filtering tasks by academic month**
- [ ] **Step 2: Implement state & filter in `src/app/page.tsx`**
- [ ] **Step 3: Run integration test to verify passes**
- [ ] **Step 4: Commit `feat(dashboard): wire academic month task filtering across all views`**

---

### Task 5: Final Quality Verification (Typecheck, Test Suite & Browser Preview)

**Files:**
- All touched files

- [ ] **Step 1: Run `npm run typecheck` (`tsc --noEmit`) to verify 0 type errors**
- [ ] **Step 2: Run `npm test` to verify 100% tests pass**
- [ ] **Step 3: Verify dev preview using `preview_snapshot` and `preview_inspect` on `localhost:3001`**
- [ ] **Step 4: Commit `chore: verify academic month cycle integration`**
