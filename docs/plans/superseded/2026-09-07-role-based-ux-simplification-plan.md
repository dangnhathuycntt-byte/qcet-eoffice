---
status: superseded
domain: ux
created: 2026-09-07
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Role-Based UX Simplification & Progressive Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the overwhelming QCET E-Office dashboard into a clean, role-tailored workspace where Staff/Lecturers see "My Focus" (tasks for today + 1-click submit), Executives see strategic approvals and red-flags, and complex filters are tucked away behind progressive disclosure.

**Architecture:** 
- Introduce `StaffFocusView` (`src/components/dashboard/roles/staff-focus-view.tsx`) as the default focused view for `STAFF` users.
- Introduce `SimplifiedTaskFilterBar` (`src/components/dashboard/simplified-task-filter-bar.tsx`) offering 1-layer search + 3 status pills + popover for advanced filters.
- Integrate role-adaptive landing in `src/app/page.tsx` with a quick toggle for power users to view the expanded multi-department canvas.
- Streamline sidebar navigation into 4 unified core destinations (`sidebar-context.tsx` & `app-sidebar.tsx`).

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, Lucide React (`strokeWidth={1.5}`), Node.js `node:test` + `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-07-role-based-ux-simplification-spec.md`

## Global Constraints

- **Tailwind CSS v4:** Keep styling purely in `globals.css` / utility classes; do NOT create a `tailwind.config.js`. Use theme tokens and OKLCH color variables.
- **Anti-Slop & Zero Emojis:** 0% emojis in source code, buttons, badge text, and labels. Use Lucide icons with `strokeWidth={1.5}`.
- **No Cache Poisoning:** Do NOT run `next build` while dev server is running. Verify correctness with `npm run typecheck` and `npm test`.
- **Typographic Discipline:** Numbers, dates, codes, and counts must use `font-mono tabular-nums`. Text headings use `font-heading font-bold tracking-tight`.

---

### Task 1: Staff Focus Workspace Component (`StaffFocusView`)

**Files:**
- Create: `src/components/dashboard/roles/staff-focus-view.tsx`
- Test: `tests/staff-focus-view.test.ts`

**Interfaces:**
- Consumes:
  - `tasks: SchoolTask[]` from `@/types/dashboard`
  - `user: AuthUser` from `@/types/auth`
  - `onSelectTask: (task: SchoolTask | StaffTask) => void`
  - `onStatusChange: (taskId: string, newStatus: TaskStatus, note?: string) => void`
  - `onOpenSubmitModal?: (task: StaffTask) => void`
- Produces:
  - Export `StaffFocusView` component rendering:
    1. Daily Hero Card ("Chào [Tên cán bộ], hôm nay bạn có [X] việc cần hoàn thành") with urgent/waiting/done pills.
    2. 3-tier task list: Urgent/Today (red highlight), This Week, Submitted / Awaiting Approval.
    3. Action-centric task card with 1-click "Nộp minh chứng" or "Cập nhật tiến độ".
    4. Positive empty state when 0 tasks are overdue.

- [ ] **Step 1: Write the failing test**

Create `tests/staff-focus-view.test.ts` testing:
- Filter logic: derives staff's own subtasks from school tasks.
- Grouping logic: categorizes into urgent/today, this week, and awaiting review.
- Renders empty state properly with positive messaging.
- Anti-slop verification: 0% emojis in source code.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/staff-focus-view.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/components/dashboard/roles/staff-focus-view.tsx`**

Build the responsive, clean, high-contrast component with Tailwind v4 OKLCH tokens, zero emojis, Lucide icons, and tabular figures.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/staff-focus-view.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/roles/staff-focus-view.tsx tests/staff-focus-view.test.ts
git commit -m "feat(ux): implement StaffFocusView for streamlined lecturer and specialist task management"
```

---

### Task 2: Progressive Disclosure Filter Bar (`SimplifiedTaskFilterBar`)

**Files:**
- Create: `src/components/dashboard/simplified-task-filter-bar.tsx`
- Test: `tests/simplified-filter-bar.test.ts`

**Interfaces:**
- Consumes:
  - `searchQuery: string`, `onSearchChange: (q: string) => void`
  - `activeStatus: "ALL" | "ACTION_REQUIRED" | "IN_PROGRESS" | "COMPLETED"`
  - `onStatusChange: (status: "ALL" | "ACTION_REQUIRED" | "IN_PROGRESS" | "COMPLETED") => void`
  - `selectedDepartment: string`, `onDepartmentChange: (dept: string) => void`
  - `selectedAcademicMonth: number | "ALL"`, `onAcademicMonthChange: (month: number | "ALL") => void`
  - `selectedPriority: string`, `onPriorityChange: (p: string) => void`
  - `totalCount: number`
- Produces:
  - Export `SimplifiedTaskFilterBar` with:
    1. Clean Search Input with search icon & clear button.
    2. 3 core status filter pills: Tất cả, Cần làm ngay, Hoàn thành.
    3. Popover toggle button "Bộ lọc nâng cao" with badge count of active filters.
    4. Popover dropdown containing Department, Academic Month, and Priority filters.

- [ ] **Step 1: Write the failing test**

Create `tests/simplified-filter-bar.test.ts` verifying:
- Active filter counter calculation.
- Status switching triggers `onStatusChange`.
- Reset filters capability.
- Anti-slop 0% emojis.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/simplified-filter-bar.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/components/dashboard/simplified-task-filter-bar.tsx`**

Implement the component with clean state management, click-outside dismissal for popover, accessible keyboard navigation, and responsive mobile layout.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/simplified-filter-bar.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/simplified-task-filter-bar.tsx tests/simplified-filter-bar.test.ts
git commit -m "feat(ux): implement SimplifiedTaskFilterBar with progressive disclosure popover"
```

---

### Task 3: Role-Adaptive Landing & Integration in `src/app/page.tsx`

**Files:**
- Modify: `src/app/page.tsx`
- Test: `tests/role-landing-integration.test.ts`

**Interfaces:**
- Consumes:
  - `StaffFocusView` from `@/components/dashboard/roles/staff-focus-view`
  - `SimplifiedTaskFilterBar` from `@/components/dashboard/simplified-task-filter-bar`
  - `user.role` from `useAuth()`
- Produces:
  - In `zone=tasks`:
    - If `user.role === 'STAFF'` and user has not toggled "Chế độ xem mở rộng toàn trường", default to `StaffFocusView`.
    - Provide a secondary toggle button "Chế độ xem toàn trường (Nâng cao)" allowing Staff to inspect the full cascading table when needed.
    - If `user.role === 'ADMIN'` or `MANAGER`, display the simplified filter bar with direct access to approvals and high-level views.

- [ ] **Step 1: Write integration tests in `tests/role-landing-integration.test.ts`**

Verify:
- Staff user role resolves default focus view.
- Admin user role resolves executive cockpit.
- Toggle between focused and advanced mode works predictably.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/role-landing-integration.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `src/app/page.tsx`**

Integrate `StaffFocusView` and mode toggle smoothly while preserving all existing modal sheets, status updates, and deep query parameter support (`?zone=tasks&view=table`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/role-landing-integration.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite & typecheck**

Run: `npm test && npm run typecheck`
Expected: All 447+ tests pass, 0 TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx tests/role-landing-integration.test.ts
git commit -m "feat(ux): integrate role-adaptive landing in UnifiedTaskHub"
```

---

### Task 4: Streamline Sidebar Navigation & Breadcrumbs

**Files:**
- Modify: `src/components/layout/sidebar-context.tsx`
- Modify: `src/components/layout/app-sidebar.tsx`
- Test: `tests/app-layout.test.ts`

**Interfaces:**
- Consumes: `NAVIGATION_ITEMS`, `SIDEBAR_ZONE_ITEMS`
- Produces:
  - 4 unified primary destinations in the sidebar:
    1. Trang chính (Trang làm việc thích ứng: My Focus / Hub / Cockpit)
    2. Bảng công việc (Tra cứu chi tiết mọi nhiệm vụ)
    3. Lịch công tác
    4. Cơ cấu & Danh bạ
  - Consistent badge counters and active indicator states.

- [ ] **Step 1: Update navigation tests in `tests/app-layout.test.ts`**

Update or add assertions for the 4 core navigation entries.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/app-layout.test.ts`
Expected: FAIL or regression detection.

- [ ] **Step 3: Update `sidebar-context.tsx` and `app-sidebar.tsx`**

Clean up duplicated entries and streamline the label & zone mapping.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/app-layout.test.ts && npm test && npm run typecheck`
Expected: PASS across entire test suite.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/sidebar-context.tsx src/components/layout/app-sidebar.tsx tests/app-layout.test.ts
git commit -m "refactor(nav): streamline sidebar navigation into 4 unified core destinations"
```
