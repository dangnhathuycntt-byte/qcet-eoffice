# QCET E-Office: RBAC & Role-Aware Task Viewpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Role-Based Access Control (RBAC) Matrix and Dynamic Viewpoint Filtering specified in Section 7 of `QCET-EOFFICE-SYSTEM-SPECIFICATION.md`, providing distinct, tailored operational views for BGH Leadership (`ADMIN`), Department Heads (`MANAGER`), and Staff Members (`STAFF`), with a 1-Click Role Switcher on the Topbar and a Twenty-style `/login` screen.

**Architecture:** Next.js 15 App Router with TypeScript and Tailwind CSS v4. A client-side `AuthContext` provides persistent role state (`ADMIN`, `MANAGER`, `STAFF`) with current user identity. A unified `filterTasksByRole` domain engine filters tasks across `/` (Dashboard), `/tasks` (Table & Kanban), and `/calendar`. `CreateTaskModal` dynamically adjusts allowed task delegation levels based on user permissions.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS v4, Lucide React (`lucide-react`), Node.js test runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/QCET-EOFFICE-SYSTEM-SPECIFICATION.md` (Section 7: Ma trận Phân quyền Người dùng)

## Global Constraints

- **Light Mode Priority:** Canvas background `#FBFBFB`, Cards/Sheets `#FFFFFF`, Text primary `#09090B`, Text secondary `#52525B`, Border `#E4E4E7` (1px hairline).
- **Solid Action Surface:** Pure charcoal/black `#18181B` with crisp white text is the only solid button fill.
- **Geometry:** `rounded-lg` (8px) for containers/cards/sheets; `rounded-md` (6px) for table rows, badges, inputs, and controls.
- **RBAC Matrix Rules (Section 7):**
  - **ADMIN (Ban Giám hiệu):** Full institutional access, creates School-level tasks (`TRUONG`), monitors all 11 departments.
  - **MANAGER (Trưởng Đơn vị, e.g. Khoa CNTT, Phòng Đào tạo):** Department-scoped visibility, creates Unit-level tasks (`DON_VI`) for personnel within their unit.
  - **STAFF (Viên chức, e.g. Trần Hùng, Nguyễn Ngọc Vinh):** Scoped to personal assigned tasks, updates statuses, adds execution notes.
- **All copy in Vietnamese (Tiếng Việt)** conforming to QCET vocational college governance terminology.

---

### Task 1: Auth Domain Types & Role-Filtering Engine

**Files:**
- Create: `src/types/auth.ts`
- Create: `src/lib/role-task-filter.ts`
- Test: `tests/role-task-filter.test.ts`

**Interfaces:**
- Consumes: `SchoolTask`, `StaffTask` from `src/types/dashboard.ts`.
- Produces: `UserRole`, `AuthUser`, `filterTasksByRole`, `canCreateSchoolTask`, `canAssignUnitTask` helpers.

- [ ] **Step 1: Write test for RBAC permissions and role filtering in `tests/role-task-filter.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  filterTasksByRole,
  canCreateSchoolTask,
  canAssignUnitTask,
  DEFAULT_DEMO_USERS,
} from "../src/lib/role-task-filter";
import type { SchoolTask } from "../src/types/dashboard";

describe("RBAC Task Filter Engine", () => {
  const sampleTasks: SchoolTask[] = [
    {
      id: "school-1",
      title: "An ninh mạng",
      category: "ATTT",
      categoryLabel: "An toàn thông tin",
      leadAssigneeName: "Trần Hùng",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-24",
      status: "IN_PROGRESS",
      subTasks: [
        {
          id: "sub-1",
          title: "Kiểm tra bản sao lưu",
          assigneeName: "Trần Hùng",
          status: "IN_PROGRESS",
          dueDate: "2026-09-24",
          parentSchoolTaskId: "school-1",
          updatedAt: "2026-09-01",
        },
        {
          id: "sub-2",
          title: "Báo cáo an ninh",
          assigneeName: "Nguyễn Ngọc Vinh",
          status: "COMPLETED",
          dueDate: "2026-09-24",
          parentSchoolTaskId: "school-1",
          updatedAt: "2026-09-01",
        },
      ],
      totalSubTasks: 2,
      completedSubTasks: 1,
      progressPercent: 50,
    },
    {
      id: "school-2",
      title: "Truyền thông tuyển sinh",
      category: "TRUYEN_THONG",
      categoryLabel: "Truyền thông",
      leadAssigneeName: "Mai Đinh Thị Xuân",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-20",
      status: "IN_PROGRESS",
      subTasks: [
        {
          id: "sub-3",
          title: "Viết bài MXH",
          assigneeName: "Mai Đinh Thị Xuân",
          status: "NEW",
          dueDate: "2026-09-20",
          parentSchoolTaskId: "school-2",
          updatedAt: "2026-09-01",
        },
      ],
      totalSubTasks: 1,
      completedSubTasks: 0,
      progressPercent: 0,
    },
  ];

  test("ADMIN sees all tasks across all departments", () => {
    const admin = DEFAULT_DEMO_USERS[0];
    const filtered = filterTasksByRole(sampleTasks, admin);
    assert.equal(filtered.length, 2);
    assert.equal(canCreateSchoolTask(admin.role), true);
  });

  test("MANAGER sees only tasks related to their department or lead", () => {
    const manager = DEFAULT_DEMO_USERS[1]; // Trưởng phòng Đào tạo & QLKH (Trần Hùng)
    const filtered = filterTasksByRole(sampleTasks, manager);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].leadAssigneeName, "Trần Hùng");
    assert.equal(canCreateSchoolTask(manager.role), false);
    assert.equal(canAssignUnitTask(manager.role), true);
  });

  test("STAFF sees only tasks they are assigned to", () => {
    const staff = DEFAULT_DEMO_USERS[2]; // Nguyễn Ngọc Vinh
    const filtered = filterTasksByRole(sampleTasks, staff);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].subTasks.length, 1);
    assert.equal(filtered[0].subTasks[0].assigneeName, "Nguyễn Ngọc Vinh");
    assert.equal(canCreateSchoolTask(staff.role), false);
    assert.equal(canAssignUnitTask(staff.role), false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/role-task-filter.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Create `src/types/auth.ts`**

Define `UserRole` (`'ADMIN' | 'MANAGER' | 'STAFF'`), `AuthUser` interface (id, name, email, role, roleLabel, department, departmentCode, avatar), and permission check signatures.

- [ ] **Step 4: Create `src/lib/role-task-filter.ts`**

Implement `DEFAULT_DEMO_USERS` (BGH, Trưởng Đơn vị, Chuyên viên), `canCreateSchoolTask`, `canAssignUnitTask`, and `filterTasksByRole`.

- [ ] **Step 5: Run test to verify pass**

Run: `npx tsx --test tests/role-task-filter.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/auth.ts src/lib/role-task-filter.ts tests/role-task-filter.test.ts
git commit -m "feat(auth): add RBAC types, permission helpers, and role task filtering engine"
```

---

### Task 2: Auth Context & Global Role Switcher Pill

**Files:**
- Create: `src/lib/auth-context.tsx`
- Create: `src/components/auth/role-switcher-pill.tsx`
- Modify: `src/components/navigation.tsx`
- Modify: `src/app/layout.tsx`
- Test: `tests/auth-context.test.ts`

**Interfaces:**
- Consumes: `AuthUser`, `UserRole`, `DEFAULT_DEMO_USERS`.
- Produces: `AuthProvider`, `useAuth` hook, and interactive `RoleSwitcherPill` on Topbar.

- [ ] **Step 1: Write test for AuthContext state transitions in `tests/auth-context.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";

describe("AuthContext Demo Credentials", () => {
  test("defines 3 distinct role viewpoints conforming to Section 7", () => {
    assert.equal(DEFAULT_DEMO_USERS.length, 3);
    const roles = DEFAULT_DEMO_USERS.map((u) => u.role);
    assert.ok(roles.includes("ADMIN"));
    assert.ok(roles.includes("MANAGER"));
    assert.ok(roles.includes("STAFF"));
  });
});
```

- [ ] **Step 2: Run test to verify initial state**

Run: `npx tsx --test tests/auth-context.test.ts`
Expected: PASS

- [ ] **Step 3: Implement `src/lib/auth-context.tsx`**

Build:
- React Context storing `user: AuthUser`, `switchRole(role: UserRole)`, `logout()`.
- Persists selected user to `localStorage` (`qcet_active_user`) with fallback to `DEFAULT_DEMO_USERS[0]` (BGH).

- [ ] **Step 4: Implement `src/components/auth/role-switcher-pill.tsx`**

Build:
- Compact dropdown pill in Twenty style (`h-8 border border-border/80 bg-secondary/50 rounded-md px-2 text-xs font-medium`).
- Displays active role icon and label:
  - 🏛️ `BGH (Toàn quyền)`
  - 🏢 `Trưởng đơn vị (Đào tạo/CNTT)`
  - 👤 `Viên chức (Cá nhân)`
- 1-Click switching with checkmark indicator on active selection.

- [ ] **Step 5: Modify `src/app/layout.tsx` and `src/components/navigation.tsx`**

Wrap layout children in `<AuthProvider>`. Embed `RoleSwitcherPill` on Topbar between the search trigger and notification bell.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth-context.tsx src/components/auth/role-switcher-pill.tsx src/components/navigation.tsx src/app/layout.tsx tests/auth-context.test.ts
git commit -m "feat(auth): implement AuthProvider and Topbar RoleSwitcherPill"
```

---

### Task 3: Role-Aware Task Creation & Permission Guards in Modal

**Files:**
- Modify: `src/components/dashboard/create-task-modal.tsx`
- Modify: `src/components/dashboard/cascading-task-table.tsx`
- Test: `tests/role-task-modal.test.ts`

**Interfaces:**
- Consumes: `useAuth`, `canCreateSchoolTask`, `canAssignUnitTask`.
- Produces: Permission-enforced `CreateTaskModal` where `STAFF` cannot create tasks, `MANAGER` is locked to `DON_VI` within their unit, and `ADMIN` can create either.

- [ ] **Step 1: Write test for role-based form constraints in `tests/role-task-modal.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getAllowedTaskLevelsForRole,
  getDefaultTaskLevelForRole,
} from "../src/components/dashboard/create-task-modal";

describe("Role-based Task Modal Helpers", () => {
  test("ADMIN can create both TRUONG and DON_VI tasks", () => {
    const levels = getAllowedTaskLevelsForRole("ADMIN");
    assert.deepEqual(levels, ["TRUONG", "DON_VI"]);
  });

  test("MANAGER can only create DON_VI tasks", () => {
    const levels = getAllowedTaskLevelsForRole("MANAGER");
    assert.deepEqual(levels, ["DON_VI"]);
    assert.equal(getDefaultTaskLevelForRole("MANAGER"), "DON_VI");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/role-task-modal.test.ts`
Expected: FAIL with functions not exported

- [ ] **Step 3: Modify `src/components/dashboard/create-task-modal.tsx`**

Implement:
- Export `getAllowedTaskLevelsForRole` and `getDefaultTaskLevelForRole`.
- Consume active role from `useAuth()`.
- If role is `MANAGER`: Hide `Nhiệm vụ cấp Trường` tab; lock level to `DON_VI`; prefill department.
- If role is `STAFF`: Disable or hide create task button.

- [ ] **Step 4: Run test to verify pass**

Run: `npx tsx --test tests/role-task-modal.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/create-task-modal.tsx src/components/dashboard/cascading-task-table.tsx tests/role-task-modal.test.ts
git commit -m "feat(tasks): enforce RBAC task delegation permissions in CreateTaskModal"
```

---

### Task 4: Dynamic Role Viewpoint Filtering across Pages (`/`, `/tasks`, `/calendar`)

**Files:**
- Modify: `src/app/page.tsx` (Dashboard view filtered by active role)
- Modify: `src/app/tasks/page.tsx` (Tasks management filtered by active role)
- Modify: `src/app/calendar/page.tsx` (Calendar schedule filtered by active role)
- Test: `tests/role-pages-integration.test.ts`

**Interfaces:**
- Consumes: `useAuth()`, `filterTasksByRole()`.
- Produces: Real-time UI reactivity when changing roles via `RoleSwitcherPill`.

- [ ] **Step 1: Write integration test in `tests/role-pages-integration.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { filterTasksByRole, DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";
import { getMockDashboardPayload } from "../src/lib/mock-dashboard-data";

describe("Role Pages Filtering Integration", () => {
  test("switching roles dynamically recomputes stats and task count", () => {
    const payload = getMockDashboardPayload();
    const adminTasks = filterTasksByRole(payload.tasks, DEFAULT_DEMO_USERS[0]);
    const staffTasks = filterTasksByRole(payload.tasks, DEFAULT_DEMO_USERS[2]);

    assert.ok(adminTasks.length > staffTasks.length);
  });
});
```

- [ ] **Step 2: Run test to verify initial assertion**

Run: `npx tsx --test tests/role-pages-integration.test.ts`
Expected: PASS

- [ ] **Step 3: Modify `src/app/page.tsx`**

Integrate `useAuth()`:
- Use `filterTasksByRole(rawTasks, currentUser)` to derive active tasks.
- Display a viewpoint indicator banner:
  - 🏛️ *"Góc nhìn Ban Giám hiệu: Giám sát toàn bộ 11 đơn vị"*
  - 🏢 *"Góc nhìn Lãnh đạo Đơn vị: [Tên Đơn vị] - [Tên Cán bộ]"*
  - 👤 *"Góc nhìn Cá nhân: Công việc được phân công cho [Tên Cán bộ]"*
- Recompute `ExecutiveStatStrip` metrics based on filtered viewpoint.

- [ ] **Step 4: Modify `src/app/tasks/page.tsx` and `src/app/calendar/page.tsx`**

Filter both the Table/Kanban items and Calendar monthly events by the active role perspective.

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/tasks/page.tsx src/app/calendar/page.tsx tests/role-pages-integration.test.ts
git commit -m "feat(pages): apply dynamic RBAC viewpoint filtering to Dashboard, Tasks, and Calendar"
```

---

### Task 5: Clean Twenty Login Page & End-to-End Build Verification

**Files:**
- Create: `src/app/login/page.tsx`
- Test: `tests/login-page.test.ts`
- Verify: Full test suite, TypeScript typecheck, Next.js production build.

**Interfaces:**
- Consumes: `AuthProvider`, `DEFAULT_DEMO_USERS`.
- Produces: Dedicated `/login` page with 1-click demo role launcher.

- [ ] **Step 1: Write test for login page demo account bindings in `tests/login-page.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";

describe("Login Page Demo Credentials", () => {
  test("provides credentials and shortcuts for BGH, HOD, and Staff", () => {
    assert.equal(DEFAULT_DEMO_USERS.length, 3);
    assert.equal(DEFAULT_DEMO_USERS[0].email, "bgh@cdktcnqn.edu.vn");
  });
});
```

- [ ] **Step 2: Run test to verify initial state**

Run: `npx tsx --test tests/login-page.test.ts`
Expected: PASS

- [ ] **Step 3: Implement `src/app/login/page.tsx`**

Build:
- Clean Twenty Light Mode login card on `#FBFBFB` background.
- Institutional header with QCET crest, title "Văn phòng Điều hành & Quản trị Công việc Điện tử".
- Standard Email / Password form fields.
- 1-Click Demo Quick Access cards:
  - 🏛️ **Ban Giám hiệu** (`Hiệu trưởng / bgh@cdktcnqn.edu.vn`)
  - 🏢 **Trưởng đơn vị** (`Trưởng phòng Đào tạo & QLKH / daotao@cdktcnqn.edu.vn`)
  - 👤 **Chuyên viên** (`Cán bộ CNTT - Nguyễn Ngọc Vinh / vinhnn@cdktcnqn.edu.vn`)
- On click: Sets active user and redirects to `/`.

- [ ] **Step 4: Run full test suite**

Run: `npm run test`
Expected: PASS (All test suites passing)

- [ ] **Step 5: Run TypeScript typecheck**

Run: `npm run typecheck`
Expected: Exit code 0 with 0 errors

- [ ] **Step 6: Run Next.js production build**

Run: `npm run build`
Expected: Build succeeds generating static and dynamic routes

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "chore: complete RBAC implementation and verify clean build"
```
