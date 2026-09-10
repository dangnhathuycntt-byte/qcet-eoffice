---
status: completed
domain: architecture
created: 2026-09-04
---

# QCET E-Office Sprint 2 Implementation Plan: Tasks Kanban, Create Task Modal, Calendar & Org Hierarchy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Sprint 2 of QCET E-Office: a Create Task Modal (`CreateTaskModal`), a dedicated Tasks Management Page (`/tasks`) with Table and Kanban Board views, an interactive Calendar Page (`/calendar`), and an Organization Hierarchy & Staff Directory Page (`/org`), all adopting Twenty CRM's Clean Slate Light-Mode aesthetic.

**Architecture:** Next.js 15 App Router with TypeScript and Tailwind CSS v4. Reusable domain data providers and aggregators shared across routes (`/`, `/tasks`, `/calendar`, `/org`). Client components utilize optimistic state updates and Twenty-style UI primitives (hairline borders, micro-elevation, pastel status badges, and solid charcoal action buttons).

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS v4, Lucide React (`lucide-react`), Node.js test runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-04-eoffice-sprint2-spec.md`

## Global Constraints

- **Light Mode Priority:** Canvas background `#FBFBFB`, Cards/Sheets `#FFFFFF`, Text primary `#09090B`, Text secondary `#52525B`, Border `#E4E4E7` (1px hairline).
- **Solid Action Surface:** Pure charcoal/black `#18181B` with crisp white text is the only solid button fill.
- **Geometry:** `rounded-lg` (8px) for containers/cards/sheets; `rounded-md` (6px) for table rows, badges, inputs, and controls.
- **Two-Tier Model:** School Tasks (`SchoolTask`) ➔ Unit Sub-Tasks (`StaffTask`). Progress is computed via rollup `(completedSubTasks / totalSubTasks) * 100`.
- **All copy in Vietnamese (Tiếng Việt)** conforming to QCET vocational college governance terminology.

---

### Task 1: Create & Delegate Task Modal (`CreateTaskModal`)

**Files:**
- Create: `src/components/dashboard/create-task-modal.tsx`
- Test: `tests/create-task-modal.test.ts`

**Interfaces:**
- Consumes: `TaskCategory`, `TaskStatus`, `SchoolTask`, `StaffTask` from `src/types/dashboard.ts`.
- Produces: `CreateTaskModal` component and `CreateTaskFormData` interface.

- [ ] **Step 1: Write test for create task modal form validation and default values in `tests/create-task-modal.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateTaskForm,
  getInitialTaskFormData,
  type CreateTaskFormData,
} from "../src/components/dashboard/create-task-modal";

describe("CreateTaskModal Helpers", () => {
  test("getInitialTaskFormData returns clean initial state", () => {
    const data = getInitialTaskFormData();
    assert.equal(data.level, "TRUONG");
    assert.equal(data.category, "CHUYEN_DOI_SO");
    assert.equal(data.title, "");
    assert.equal(data.leadAssigneeName, "");
  });

  test("validateTaskForm validates required fields", () => {
    const invalidData: CreateTaskFormData = {
      level: "TRUONG",
      category: "CHUYEN_DOI_SO",
      title: "   ",
      leadAssigneeName: "",
      dueDate: "",
      description: "",
      coAssignees: [],
    };
    const errors = validateTaskForm(invalidData);
    assert.ok(errors.title);
    assert.ok(errors.leadAssigneeName);
    assert.ok(errors.dueDate);

    const validData: CreateTaskFormData = {
      level: "TRUONG",
      category: "ATTT",
      title: "Kiểm tra an ninh mạng",
      leadAssigneeName: "Trần Hùng",
      dueDate: "2026-09-30",
      description: "Mô tả chi tiết",
      coAssignees: ["Vinh"],
    };
    const noErrors = validateTaskForm(validData);
    assert.equal(Object.keys(noErrors).length, 0);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/create-task-modal.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement `src/components/dashboard/create-task-modal.tsx`**

Build:
- Modal Dialog with backdrop blur and escape/click-outside dismiss.
- Level selector toggle: `Nhiệm vụ cấp Trường (BGH giao)` vs `Công việc cấp Đơn vị (Giao nhân viên)`.
- Input fields: Title, Category dropdown, Lead Assignee input/selector, Co-assignees tags, Due Date picker, Description textarea.
- Form validation: title, lead, due date required.
- Action buttons: "Hủy" (ghost/outline) and "Tạo nhiệm vụ" (`bg-[#18181B] text-white`).
- Export `validateTaskForm`, `getInitialTaskFormData`, `CreateTaskFormData`, and `CreateTaskModal`.

- [ ] **Step 4: Run test to verify pass**

Run: `npx tsx --test tests/create-task-modal.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/create-task-modal.tsx tests/create-task-modal.test.ts
git commit -m "feat(tasks): implement CreateTaskModal dialog for task delegation"
```

---

### Task 2: Task Kanban Board & Tasks Management Page (`/tasks`)

**Files:**
- Create: `src/components/tasks/task-kanban-board.tsx`
- Create: `src/app/tasks/page.tsx`
- Test: `tests/task-kanban.test.ts`

**Interfaces:**
- Consumes: `SchoolTask`, `StaffTask`, `TaskStatus`, `CascadingTaskTable`, `CreateTaskModal`, `TaskDetailSideSheet`.
- Produces: `TaskKanbanBoard` component and `/tasks` page route.

- [ ] **Step 1: Write test for Kanban column categorization and card helpers in `tests/task-kanban.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  groupTasksByStatus,
  KANBAN_COLUMNS,
} from "../src/components/tasks/task-kanban-board";
import type { SchoolTask } from "../src/types/dashboard";

describe("TaskKanbanBoard Helpers", () => {
  test("KANBAN_COLUMNS defines 4 status columns", () => {
    assert.equal(KANBAN_COLUMNS.length, 4);
    assert.equal(KANBAN_COLUMNS[0].id, "NEW");
    assert.equal(KANBAN_COLUMNS[1].id, "IN_PROGRESS");
    assert.equal(KANBAN_COLUMNS[2].id, "NEEDS_REVIEW");
    assert.equal(KANBAN_COLUMNS[3].id, "COMPLETED");
  });

  test("groupTasksByStatus correctly partitions tasks", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "t1",
        title: "Task 1",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadAssigneeName: "Hùng",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-20",
        status: "IN_PROGRESS",
        subTasks: [
          {
            id: "sub-1",
            title: "Sub 1",
            assigneeName: "Hùng",
            status: "NEW",
            dueDate: "2026-09-20",
            parentSchoolTaskId: "t1",
            updatedAt: "2026-09-01",
          },
        ],
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 0,
      },
    ];

    const grouped = groupTasksByStatus(mockTasks);
    assert.equal(grouped.IN_PROGRESS.length, 1);
    assert.equal(grouped.NEW.length, 1); // subtask placed in NEW
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/task-kanban.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement `src/components/tasks/task-kanban-board.tsx`**

Build:
- 4-column layout (`NEW`, `IN_PROGRESS`, `NEEDS_REVIEW`, `COMPLETED`) with column headers showing title, emoji, and count badge.
- Kanban cards showing category badge, task level indicator, title, assignee avatar/initials, due date, progress bar (for school tasks), and quick status move buttons (◀ / ▶).
- Export `groupTasksByStatus`, `KANBAN_COLUMNS`, and `TaskKanbanBoard`.

- [ ] **Step 4: Implement `src/app/tasks/page.tsx`**

Build:
- View Mode Switcher: `[Bảng phân cấp / Table]` ⇄ `[Bảng Kanban / Board]`.
- Category tabs and search filter.
- Render `CascadingTaskTable` when in Table mode, `TaskKanbanBoard` when in Kanban mode.
- Render `CreateTaskModal` on `+ Giao việc` click.
- Render `TaskDetailSideSheet` on task card/row click.

- [ ] **Step 5: Run test to verify pass**

Run: `npx tsx --test tests/task-kanban.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/tasks/task-kanban-board.tsx src/app/tasks/page.tsx tests/task-kanban.test.ts
git commit -m "feat(tasks): add Kanban Board view and /tasks dedicated management page"
```

---

### Task 3: Calendar & Work Schedule Page (`/calendar`)

**Files:**
- Create: `src/components/calendar/calendar-month-view.tsx`
- Create: `src/app/calendar/page.tsx`
- Test: `tests/calendar-view.test.ts`

**Interfaces:**
- Consumes: `SchoolTask`, `StaffTask`, `UpcomingItem` from dashboard data.
- Produces: `CalendarMonthView` component and `/calendar` page route.

- [ ] **Step 1: Write test for calendar grid generation and event mapping in `tests/calendar-view.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  generateMonthGrid,
  getTasksForDate,
} from "../src/components/calendar/calendar-month-view";
import type { SchoolTask } from "../src/types/dashboard";

describe("CalendarMonthView Helpers", () => {
  test("generateMonthGrid generates 35 or 42 calendar day cells for a month", () => {
    const grid = generateMonthGrid(2026, 8); // September 2026 (0-indexed month 8)
    assert.ok(grid.length >= 35);
    const septFirst = grid.find((d) => d.dateString === "2026-09-01");
    assert.ok(septFirst);
    assert.equal(septFirst?.isCurrentMonth, true);
  });

  test("getTasksForDate maps tasks to matching due dates", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "t1",
        title: "Báo cáo tháng 9",
        category: "BAO_CAO",
        categoryLabel: "Báo cáo",
        leadAssigneeName: "Vinh",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-24",
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 0,
      },
    ];

    const tasksOn24th = getTasksForDate(mockTasks, "2026-09-24");
    assert.equal(tasksOn24th.length, 1);
    assert.equal(tasksOn24th[0].title, "Báo cáo tháng 9");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/calendar-view.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement `src/components/calendar/calendar-month-view.tsx`**

Build:
- Month navigation header: "Tháng 09 / 2026", Previous Month, Next Month, Today button.
- 7-column calendar grid (T2, T3, T4, T5, T6, T7, CN).
- Day cell: Date number, today highlight pill, event chips with category color dots and task titles (max 3 per cell with "+N more").
- Selected Day Panel (side panel or bottom sheet): displays all tasks and events due on the selected date with quick detail view trigger.
- Export `generateMonthGrid`, `getTasksForDate`, and `CalendarMonthView`.

- [ ] **Step 4: Implement `src/app/calendar/page.tsx`**

Build:
- Page layout with breadcrumbs ("Văn phòng Điều hành / Lịch công tác & Hạn chót toàn trường").
- Integrates `CalendarMonthView` with live/mock task payload.
- Wires `TaskDetailSideSheet` on event chip click.

- [ ] **Step 5: Run test to verify pass**

Run: `npx tsx --test tests/calendar-view.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/calendar/calendar-month-view.tsx src/app/calendar/page.tsx tests/calendar-view.test.ts
git commit -m "feat(calendar): implement monthly schedule grid and /calendar page"
```

---

### Task 4: Organization Hierarchy & Staff Directory Page (`/org`)

**Files:**
- Create: `src/components/org/organization-tree.tsx`
- Create: `src/app/org/page.tsx`
- Test: `tests/organization-tree.test.ts`

**Interfaces:**
- Consumes: Department & Staff models.
- Produces: `OrganizationTree` component, department directory, and `/org` page route.

- [ ] **Step 1: Write test for organization department tree and search filtering in `tests/organization-tree.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  QCET_DEPARTMENTS,
  filterStaffMembers,
  type DepartmentNode,
} from "../src/components/org/organization-tree";

describe("OrganizationTree Helpers", () => {
  test("QCET_DEPARTMENTS contains BGH, Functional Rooms, Faculties, and Centers", () => {
    assert.ok(QCET_DEPARTMENTS.length >= 4);
    const bgh = QCET_DEPARTMENTS.find((d) => d.code === "BGH");
    assert.ok(bgh);
    assert.ok(bgh?.members.length > 0);
  });

  test("filterStaffMembers searches by name, email, and department", () => {
    const results = filterStaffMembers(QCET_DEPARTMENTS, "Trần Hùng");
    assert.ok(results.length >= 1);
    assert.equal(results[0].name, "Trần Hùng");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/organization-tree.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement `src/components/org/organization-tree.tsx`**

Build:
- QCET Organizational structure data:
  - **Ban Giám hiệu:** Hiệu trưởng, các Phó Hiệu trưởng.
  - **Phòng chức năng:** Phòng Đào tạo & QLKH, Phòng Hành chính - Quản trị, Phòng Kế hoạch - Tài chính, Phòng Khảo thí & ĐBCL, Phòng CTHSSV.
  - **Khoa chuyên môn:** Khoa Công nghệ thông tin, Khoa Kinh tế - Quản trị, Khoa Kỹ thuật - Công nghệ.
  - **Trung tâm:** Trung tâm Truyền thông & Số hóa (DCC), Trung tâm Ngoại ngữ - Tin học.
- Two-column view:
  - Left: Department Tree / List with member count badges and active selection indicator.
  - Right: Department details & Staff cards grid (Avatar, Full Name, Title/Role, Email, Phone, Active Task Count).
- Search bar filtering staff across all units.
- Export `QCET_DEPARTMENTS`, `filterStaffMembers`, and `OrganizationTree`.

- [ ] **Step 4: Implement `src/app/org/page.tsx`**

Build:
- Page layout with breadcrumbs ("Văn phòng Điều hành / Cơ cấu Tổ chức & Danh bạ Cán bộ").
- Renders `OrganizationTree`.

- [ ] **Step 5: Run test to verify pass**

Run: `npx tsx --test tests/organization-tree.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/org/organization-tree.tsx src/app/org/page.tsx tests/organization-tree.test.ts
git commit -m "feat(org): implement organization hierarchy tree and /org directory page"
```

---

### Task 5: Integration, Global Navigation Routing & End-to-End Build Verification

**Files:**
- Modify: `src/components/navigation.tsx` (ensure active routes match `/`, `/tasks`, `/calendar`, `/org`, `/settings`)
- Modify: `src/app/page.tsx` (wire `CreateTaskModal` on `+ Giao việc` action)
- Test: `tests/sprint2-integration.test.ts`

**Interfaces:**
- Consumes: All routes and components created in Tasks 1-4.
- Produces: Complete, seamlessly linked QCET E-Office application.

- [ ] **Step 1: Write integration test in `tests/sprint2-integration.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS } from "../src/lib/tokens";

describe("Sprint 2 Integration & Navigation", () => {
  test("NAV_ITEMS routes match all implemented pages", () => {
    const paths = NAV_ITEMS.map((item) => item.href);
    assert.ok(paths.includes("/"));
    assert.ok(paths.includes("/tasks"));
    assert.ok(paths.includes("/calendar"));
    assert.ok(paths.includes("/org"));
  });
});
```

- [ ] **Step 2: Run test to verify initial state**

Run: `npx tsx --test tests/sprint2-integration.test.ts`
Expected: PASS

- [ ] **Step 3: Wire `CreateTaskModal` on Dashboard (`src/app/page.tsx`) and Topbar (`src/components/navigation.tsx`)**

- [ ] **Step 4: Run complete test suite**

Run: `npm run test`
Expected: PASS (All test suites passing)

- [ ] **Step 5: Run TypeScript typecheck**

Run: `npm run typecheck`
Expected: Exit code 0 with 0 errors

- [ ] **Step 6: Run Next.js production build**

Run: `npm run build`
Expected: Build succeeds with static/dynamic route generation for `/`, `/tasks`, `/calendar`, `/org`

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "chore: verify clean build and complete navigation integration for Sprint 2"
```
