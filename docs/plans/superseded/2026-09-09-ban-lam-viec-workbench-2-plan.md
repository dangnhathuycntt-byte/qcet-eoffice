---
status: superseded
domain: ux
created: 2026-09-09
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Bàn Làm Việc 2.0 (QCET Workbench 2.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp toàn diện Bàn làm việc (route `/`, `zone: "dashboard"`) thành Executive Split-Cockpit Workspace 2.0: thống nhất kiến trúc state, chuẩn hóa engine thời gian, tích hợp Universal Action Queue, bổ sung Compact Table View cho ma trận phòng ban, và thêm thanh Active Filter Breadcrumbs.

**Architecture:** Hợp nhất `DashboardZone` với `UniversalActionQueue`, xóa bỏ hàm lọc phân kỳ `filterDashboardReactiveTasks`, đồng bộ hóa 100% dữ liệu qua `filterTasksHub`. Tái cấu trúc layout theo dạng Split-Cockpit Grid (45% trái: Action Queue - 55% phải: Department Health Matrix & Smart Agenda). Chuẩn hóa mốc thời gian tham chiếu qua `getSystemReferenceDate()`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript strict, Tailwind CSS v4 (Light-only, OKLCH color space), Lucide React, Node.js test runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-09-ban-lam-viec-workbench-2-design.md`

## Global Constraints

- Tuân thủ nghiêm ngặt chuẩn **Light-Only** (OKLCH color space, không thêm class `dark:`, không thêm ThemeProvider).
- Không chạy `next build` đè lên `.next/` khi dev server đang chạy (chỉ dùng `npm run typecheck` và `npm test`).
- Toàn bộ mốc thời gian kiểm tra quá hạn phải gọi qua `getSystemReferenceDate()` và `isTaskPastDue()`.
- Tuyệt đối không lạm dụng ép kiểu `(t as any)`. Sử dụng interface chuẩn `SchoolTask`, `StaffTask`, `AuthUser`.
- End git commit messages with:
  Co-Authored-By: Claude Code <noreply@anthropic.com>

---

### Task 1: Chuẩn Hóa Engine Thời Gian Tham Chiếu Hệ Thống

**Files:**
- Modify: `src/lib/unified-task-hub.ts`
- Modify: `src/hooks/use-dashboard-state.ts:40-60`
- Modify: `src/hooks/use-task-mutations.ts:205-225,315-330`
- Test: `tests/system-reference-date-unification.test.ts`

**Interfaces:**
- Consumes: `getSystemReferenceDate(): Date`, `isTaskPastDue(dueDate: string, refDate?: Date): boolean` từ `src/lib/unified-task-hub.ts`.
- Produces: Chuỗi `getSystemReferenceDateStr(): string` trả về ISO date `YYYY-MM-DD` từ reference date tập trung.

- [ ] **Step 1: Viết failing test kiểm tra tính nhất quán của reference date**

Tạo `tests/system-reference-date-unification.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { getSystemReferenceDate, getSystemReferenceDateStr, isTaskPastDue } from "../src/lib/unified-task-hub";

test("getSystemReferenceDate returns consistent reference date", () => {
  const refDate = getSystemReferenceDate();
  assert.ok(refDate instanceof Date, "Must be a Date instance");
  
  const refStr = getSystemReferenceDateStr();
  assert.match(refStr, /^\d{4}-\d{2}-\d{2}$/, "Must be formatted as YYYY-MM-DD");
  assert.equal(refStr, "2026-09-06", "Default system reference date must match 2026-09-06");
});

test("isTaskPastDue correctly flags overdue based on system reference date", () => {
  assert.equal(isTaskPastDue("2026-09-05"), true, "2026-09-05 must be past due on 2026-09-06");
  assert.equal(isTaskPastDue("2026-09-06"), false, "Today due date is not past due");
  assert.equal(isTaskPastDue("2026-09-10"), false, "Future due date is not past due");
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/system-reference-date-unification.test.ts`
Expected: FAIL (do `getSystemReferenceDateStr` chưa được định nghĩa và export).

- [ ] **Step 3: Cập nhật `src/lib/unified-task-hub.ts` và loại bỏ hardcode trong các hook**

Trong `src/lib/unified-task-hub.ts`:
Thêm helper `getSystemReferenceDateStr`:
```typescript
export function getSystemReferenceDateStr(): string {
  const d = getSystemReferenceDate();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

Trong `src/hooks/use-dashboard-state.ts`:
Thay thế:
```typescript
const refDateStr = getSystemReferenceDateStr();
const systemRefDate = getSystemReferenceDate();
const urgentTasks = mutations.dashboardData.tasks.filter(
  (t) =>
    (t.status === "PENDING_EXECUTIVE_APPROVAL" || isTaskPastDue(t.dueDate, systemRefDate)) &&
    t.status !== "COMPLETED"
).length;
const todayEvents = mutations.dashboardData.upcoming.filter(
  (item) => item.dueDate === refDateStr
).length;
```

Trong `src/hooks/use-task-mutations.ts`:
Thay thế tất cả các chuỗi hardcode `"2026-09-06"` và `"2026-09-04"` bằng `getSystemReferenceDateStr()`.

- [ ] **Step 4: Chạy test để xác nhận test pass**

Run: `npx tsx --test tests/system-reference-date-unification.test.ts`
Expected: PASS.

- [ ] **Step 5: Chạy typecheck và commit**

Run: `npm run typecheck`
```bash
git add src/lib/unified-task-hub.ts src/hooks/use-dashboard-state.ts src/hooks/use-task-mutations.ts tests/system-reference-date-unification.test.ts
git commit -m "fix(core): centralize system reference date and eliminate hardcoded date strings

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Hợp Nhất Mô Hình Phạm Vi (Scope Unification)

**Files:**
- Modify: `src/components/dashboard/unified-task-toolbar.ts:1-30`
- Modify: `src/types/workspace.ts:1-25`
- Modify: `src/lib/unified-task-hub.ts:10-45`
- Modify: `src/hooks/use-url-params-sync.ts:40-75`
- Test: `tests/scope-unification.test.ts`

**Interfaces:**
- Consumes: `TaskScope` (`SCHOOL_TASKS` | `UNIT_TASKS` | `MY_TASKS`), `WorkspaceScope` (`school` | `unit` | `my`).
- Produces:
  `scopeToWorkspaceScope(scope: TaskScope): WorkspaceScope`
  `workspaceScopeToTaskScope(scope: WorkspaceScope): TaskScope`
  `workspaceScopeToUrlParam(scope: WorkspaceScope): string`

- [ ] **Step 1: Viết failing test kiểm tra chuyển đổi hai chiều giữa các mô hình Scope**

Tạo `tests/scope-unification.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scopeToWorkspaceScope,
  workspaceScopeToTaskScope,
  workspaceScopeToUrlParam,
  urlParamToWorkspaceScope,
} from "../src/lib/unified-task-hub";

test("scopeToWorkspaceScope transforms correctly", () => {
  assert.equal(scopeToWorkspaceScope("SCHOOL_TASKS"), "school");
  assert.equal(scopeToWorkspaceScope("UNIT_TASKS"), "unit");
  assert.equal(scopeToWorkspaceScope("MY_TASKS"), "my");
});

test("workspaceScopeToTaskScope transforms correctly", () => {
  assert.equal(workspaceScopeToTaskScope("school"), "SCHOOL_TASKS");
  assert.equal(workspaceScopeToTaskScope("unit"), "UNIT_TASKS");
  assert.equal(workspaceScopeToTaskScope("my"), "MY_TASKS");
});

test("urlParamToWorkspaceScope parses bidirectional URL parameters", () => {
  assert.equal(urlParamToWorkspaceScope("all"), "school");
  assert.equal(urlParamToWorkspaceScope("school"), "school");
  assert.equal(urlParamToWorkspaceScope("unit"), "unit");
  assert.equal(urlParamToWorkspaceScope("my"), "my");
  assert.equal(urlParamToWorkspaceScope("personal"), "my");
  assert.equal(urlParamToWorkspaceScope(null, "school"), "school");
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/scope-unification.test.ts`
Expected: FAIL (do các hàm helper chưa được khai báo).

- [ ] **Step 3: Triển khai các helper chuyển đổi Scope trong `src/lib/unified-task-hub.ts`**

Trong `src/lib/unified-task-hub.ts`:
```typescript
import type { WorkspaceScope } from "@/types/workspace";
import type { TaskScope } from "@/components/dashboard/unified-task-toolbar";

export function scopeToWorkspaceScope(scope: TaskScope): WorkspaceScope {
  switch (scope) {
    case "SCHOOL_TASKS":
      return "school";
    case "UNIT_TASKS":
      return "unit";
    case "MY_TASKS":
    default:
      return "my";
  }
}

export function workspaceScopeToTaskScope(scope: WorkspaceScope): TaskScope {
  switch (scope) {
    case "school":
      return "SCHOOL_TASKS";
    case "unit":
      return "UNIT_TASKS";
    case "my":
    default:
      return "MY_TASKS";
  }
}

export function workspaceScopeToUrlParam(scope: WorkspaceScope): string {
  switch (scope) {
    case "school":
      return "all";
    case "unit":
      return "unit";
    case "my":
    default:
      return "personal";
  }
}

export function urlParamToWorkspaceScope(param: string | null | undefined, fallback: WorkspaceScope = "school"): WorkspaceScope {
  if (!param) return fallback;
  const p = param.trim().toLowerCase();
  if (p === "all" || p === "school") return "school";
  if (p === "unit") return "unit";
  if (p === "personal" || p === "my") return "my";
  return fallback;
}
```

- [ ] **Step 4: Chạy test để xác nhận test pass**

Run: `npx tsx --test tests/scope-unification.test.ts`
Expected: PASS.

- [ ] **Step 5: Chạy typecheck và commit**

Run: `npm run typecheck`
```bash
git add src/lib/unified-task-hub.ts tests/scope-unification.test.ts
git commit -m "feat(hub): add bidirectional scope unification helpers between TaskScope and WorkspaceScope

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Đồng Bộ Đường Ống Lọc & Xóa Bỏ Hàm Lọc Phân Kỳ Trong `DashboardZone`

**Files:**
- Modify: `src/components/dashboard/zones/dashboard-zone.tsx:15-80`
- Test: `tests/dashboard-zone-filter-alignment.test.ts`

**Interfaces:**
- Consumes: `filteredTasks: SchoolTask[]`, `activeWorkbox: WorkboxFilter`, `selectedDepartment: string` từ `useDashboardData()`.
- Produces: `DashboardZone` render `filteredTasks` chuẩn xác mà không cần re-filter riêng bằng `filterDashboardReactiveTasks`.

- [ ] **Step 1: Viết failing test kiểm tra sự đồng nhất giữa `filteredTasks` và hiển thị của `DashboardZone`**

Tạo `tests/dashboard-zone-filter-alignment.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterTasksHub } from "../src/lib/unified-task-hub";
import type { SchoolTask } from "../src/types/dashboard";

const mockTasks: SchoolTask[] = [
  {
    id: "task-1",
    title: "Nhiệm vụ CNTT Đang Làm",
    departmentId: "CNTT",
    leadDepartmentId: "CNTT",
    departmentCode: "CNTT",
    status: "IN_PROGRESS",
    dueDate: "2026-09-15",
    weight: 1,
    progress: 50,
    subtasksCount: 0,
    completedSubtasksCount: 0,
    priority: "CAO",
    category: "CHUYEN_MON",
  },
  {
    id: "task-2",
    title: "Nhiệm vụ Quá Hạn",
    departmentId: "DIEN",
    leadDepartmentId: "DIEN",
    departmentCode: "DIEN",
    status: "IN_PROGRESS",
    dueDate: "2026-09-02",
    weight: 1,
    progress: 20,
    subtasksCount: 0,
    completedSubtasksCount: 0,
    priority: "KHAN_CAP",
    category: "CHUYEN_MON",
  },
];

test("filterTasksHub filters by department and workbox correctly", () => {
  const cnttTasks = filterTasksHub(mockTasks, {
    scope: "SCHOOL_TASKS",
    department: "CNTT",
    workbox: "ALL",
  });
  assert.equal(cnttTasks.length, 1);
  assert.equal(cnttTasks[0].id, "task-1");

  const overdueTasks = filterTasksHub(mockTasks, {
    scope: "SCHOOL_TASKS",
    department: "ALL",
    workbox: "URGENT_OVERDUE",
  });
  assert.equal(overdueTasks.length, 1);
  assert.equal(overdueTasks[0].id, "task-2");
});
```

- [ ] **Step 2: Chạy test để xác nhận test chạy được**

Run: `npx tsx --test tests/dashboard-zone-filter-alignment.test.ts`
Expected: PASS.

- [ ] **Step 3: Xóa bỏ `filterDashboardReactiveTasks` trong `src/components/dashboard/zones/dashboard-zone.tsx`**

Trong `src/components/dashboard/zones/dashboard-zone.tsx`:
Thay vì tính toán:
```typescript
const reactiveTasks = React.useMemo(() => {
  return filterDashboardReactiveTasks(baseTasks, activeWorkbox, selectedDepartment, user);
}, [baseTasks, activeWorkbox, selectedDepartment, user]);
```
Thay thế bằng việc lấy trực tiếp `filteredTasks` từ `useDashboardData()`:
```typescript
const {
  tasks: allTasks,
  filteredTasks,
  scopedBaseTasks,
  selectedMonthPeriod,
  activeWorkbox,
  selectedDepartment,
  user,
  // ...
} = useDashboardData();

// Sử dụng filteredTasks trực tiếp từ pipeline chuẩn hóa của useTaskFilters
const reactiveTasks = filteredTasks;
```
Xóa bỏ hoàn toàn định nghĩa hàm `filterDashboardReactiveTasks` (khoảng 40 dòng thừa) và các ép kiểu `(t as any)`.

- [ ] **Step 4: Chạy typecheck và test**

Run: `npm run typecheck`
Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/zones/dashboard-zone.tsx tests/dashboard-zone-filter-alignment.test.ts
git commit -m "refactor(dashboard-zone): eliminate divergent filterDashboardReactiveTasks in favor of unified filteredTasks

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Chuẩn Hóa Ngữ Nghĩa Quyền Hạn Trong `UniversalActionQueue`

**Files:**
- Modify: `src/components/workspace/components/universal-action-queue.tsx:1-150`
- Modify: `src/components/workspace/types.ts`
- Test: `tests/universal-action-queue-semantics.test.ts`

**Interfaces:**
- Consumes: `scope: WorkspaceScope`, `onReview(item: ActionQueueItem): void`, `onCreateSubtask?: (parentId: string) => void`, `onSubmitDeliverable(task: SchoolTask): void`.
- Produces: Hiển thị nhãn nút chính xác: "Thẩm định L1" / "Phê duyệt" (gọi `onReview`) và bổ sung nút "Phân rã việc con" (gọi `onCreateSubtask`).

- [ ] **Step 1: Viết failing test kiểm tra nhãn và hành vi của Action Queue theo từng vai trò**

Tạo `tests/universal-action-queue-semantics.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";

test("action queue determines appropriate action label based on scope and role", () => {
  function getActionQueueButtonMeta(scope: "school" | "unit" | "my", itemType: "approval" | "submission") {
    if (itemType === "approval") {
      return {
        label: scope === "school" ? "Phê duyệt" : "Thẩm định L1",
        variant: "default" as const,
      };
    }
    return {
      label: "Nộp minh chứng",
      variant: "outline" as const,
    };
  }

  const schoolApproval = getActionQueueButtonMeta("school", "approval");
  assert.equal(schoolApproval.label, "Phê duyệt");

  const unitApproval = getActionQueueButtonMeta("unit", "approval");
  assert.equal(unitApproval.label, "Thẩm định L1");

  const staffSubmission = getActionQueueButtonMeta("my", "submission");
  assert.equal(staffSubmission.label, "Nộp minh chứng");
});
```

- [ ] **Step 2: Chạy test để xác nhận test chạy**

Run: `npx tsx --test tests/universal-action-queue-semantics.test.ts`
Expected: PASS.

- [ ] **Step 3: Cập nhật `src/components/workspace/components/universal-action-queue.tsx`**

Sửa đổi đoạn render nút hành động của Trưởng đơn vị:
- Khi `item.type === "approval"`: Nút hiển thị `"Thẩm định"` (nếu là Unit scope) hoặc `"Phê duyệt"` (nếu là School scope). Icon `CheckCircle2`.
- Khi Trưởng đơn vị muốn phân công việc: Thêm nút phụ `"Giao việc con"` (`GitFork` hoặc `Plus` icon) gọi callback `onCreateSubtask(item.task.id)`.
- Bổ sung nút đôn đốc hỏa tốc `"Đôn đốc DRI"` khi nhiệm vụ quá hạn hoặc có nguy cơ chậm tiến độ.

- [ ] **Step 4: Chạy typecheck và test**

Run: `npm run typecheck`
Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/components/universal-action-queue.tsx src/components/workspace/types.ts tests/universal-action-queue-semantics.test.ts
git commit -m "fix(workspace): clarify action queue button semantics between L1 review and subtask delegation

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Bổ Sung Chế Độ Compact Table View Cho `DepartmentProgressMatrix`

**Files:**
- Modify: `src/components/dashboard/department-progress-matrix.tsx:1-180`
- Test: `tests/department-progress-matrix-compact.test.ts`

**Interfaces:**
- Consumes: `departmentHealth: DepartmentHealthSummary[]`, `selectedDepartment: string`, `onSelectDepartment: (deptCode: string) => void`.
- Produces: Công tắc chuyển đổi giữa `Grid View` và `Compact Table View` (có sort theo trễ hạn giảm dần).

- [ ] **Step 1: Viết failing test kiểm tra logic sắp xếp đơn vị theo rủi ro trễ hạn**

Tạo `tests/department-progress-matrix-compact.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import type { DepartmentHealthSummary } from "../src/lib/executive-matrix-aggregator";

test("sorts departments by overdue count descending", () => {
  const depts: DepartmentHealthSummary[] = [
    {
      code: "CNTT",
      name: "Khoa CNTT",
      leadName: "Nguyễn A",
      totalTasks: 10,
      completedTasks: 8,
      inProgressTasks: 2,
      overdueTasks: 0,
      completionRate: 80,
      status: "HEALTHY",
      bottleneckTasks: [],
    },
    {
      code: "DIEN",
      name: "Khoa Điện",
      leadName: "Trần B",
      totalTasks: 10,
      completedTasks: 5,
      inProgressTasks: 5,
      overdueTasks: 3,
      completionRate: 50,
      status: "CRITICAL",
      bottleneckTasks: [],
    },
  ];

  const sorted = [...depts].sort((a, b) => b.overdueTasks - a.overdueTasks);
  assert.equal(sorted[0].code, "DIEN", "Department with highest overdue must be first");
  assert.equal(sorted[1].code, "CNTT");
});
```

- [ ] **Step 2: Chạy test để xác nhận test chạy**

Run: `npx tsx --test tests/department-progress-matrix-compact.test.ts`
Expected: PASS.

- [ ] **Step 3: Cập nhật `src/components/dashboard/department-progress-matrix.tsx`**

Trong `DepartmentProgressMatrix`:
- Thêm state `viewMode: "grid" | "table"` với nút chuyển đổi trực quan (icon `LayoutGrid` và `TableProperties`).
- Thêm state `sortByOverdue: boolean` (mặc định true khi mở chế độ Table).
- Khi ở chế độ `table`:
  Render bảng danh bạ 11 đơn vị chuẩn mực công sở:
  ```tsx
  <div className="overflow-x-auto rounded-xl border border-border/80 bg-card">
    <table className="w-full text-left text-xs border-collapse">
      <thead className="bg-muted/40 border-b border-border/60">
        <tr>
          <th className="p-2.5 font-medium text-muted-foreground">Đơn vị</th>
          <th className="p-2.5 font-medium text-muted-foreground">Lãnh đạo phụ trách</th>
          <th className="p-2.5 font-medium text-muted-foreground">Tiến độ</th>
          <th className="p-2.5 font-medium text-muted-foreground text-center">Đang làm</th>
          <th className="p-2.5 font-medium text-muted-foreground text-center cursor-pointer hover:text-foreground">
            Quá hạn ↕
          </th>
          <th className="p-2.5 font-medium text-muted-foreground">Đánh giá rủi ro</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {/* Render rows with mini SVG progress rings and click-to-filter */}
      </tbody>
    </table>
  </div>
  ```

- [ ] **Step 4: Chạy typecheck và test**

Run: `npm run typecheck`
Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/department-progress-matrix.tsx tests/department-progress-matrix-compact.test.ts
git commit -m "feat(dashboard): add compact table view with overdue sorting to DepartmentProgressMatrix

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Tái Cấu Trúc Bố Cục Split-Cockpit & Thêm Active Filter Breadcrumb Trong `DashboardZone`

**Files:**
- Modify: `src/components/dashboard/zones/dashboard-zone.tsx`
- Create: `src/components/dashboard/active-filter-breadcrumb.tsx`
- Test: `tests/dashboard-zone-split-cockpit.test.ts`

**Interfaces:**
- Consumes: `scope`, `selectedDepartment`, `activeWorkbox`, `searchQuery`, `onResetFilters: () => void`.
- Produces: Bố cục Split-Cockpit Grid (45% Action Queue - 55% Department Matrix/Widgets) và thanh định vị bộ lọc đang kích hoạt.

- [ ] **Step 1: Viết failing test kiểm tra logic hiển thị của ActiveFilterBreadcrumb**

Tạo `tests/dashboard-zone-split-cockpit.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";

test("computes active filter summary correctly", () => {
  function getActiveFilterSummary(params: {
    dept: string;
    workbox: string;
    search: string;
  }) {
    const parts: string[] = [];
    if (params.dept !== "ALL") parts.push(`Đơn vị: ${params.dept}`);
    if (params.workbox !== "ALL") parts.push(`Hộp việc: ${params.workbox}`);
    if (params.search.trim()) parts.push(`Từ khóa: "${params.search.trim()}"`);
    return parts;
  }

  const filters = getActiveFilterSummary({
    dept: "CNTT",
    workbox: "URGENT_OVERDUE",
    search: "nghiệm thu",
  });
  assert.equal(filters.length, 3);
  assert.equal(filters[0], "Đơn vị: CNTT");
  assert.equal(filters[1], "Hộp việc: URGENT_OVERDUE");
});
```

- [ ] **Step 2: Chạy test để xác nhận test chạy**

Run: `npx tsx --test tests/dashboard-zone-split-cockpit.test.ts`
Expected: PASS.

- [ ] **Step 3: Tạo `src/components/dashboard/active-filter-breadcrumb.tsx`**

Tạo component `ActiveFilterBreadcrumb` hiển thị ngữ cảnh lọc và nút "Xóa bộ lọc" khi có ít nhất một tiêu chí lọc ngoài mặc định.

- [ ] **Step 4: Cập nhật `src/components/dashboard/zones/dashboard-zone.tsx` sang bố cục Split-Cockpit**

Tái cấu trúc giao diện `DashboardZone`:
1. Giữ `ExecutiveStatStrip` ở đầu.
2. Dưới đó là lưới chia đôi:
   - Cột trái (khoảng 42-45% trên desktop `lg:col-span-5`): Nhúng `UniversalActionQueue` để hiển thị ngay các việc cần duyệt và cần nộp.
   - Cột phải (khoảng 55-58% trên desktop `lg:col-span-7`): Hiển thị `DepartmentProgressMatrix` và các widget lịch tuần `UpcomingDeadlinesWidget` / `ActivityFeedWidget`.
3. Tiếp theo là thanh `ActiveFilterBreadcrumb`.
4. Cuối cùng là `CascadingTaskTable` để tra cứu cây nhiệm vụ chi tiết.

- [ ] **Step 5: Chạy typecheck và toàn bộ test suite**

Run: `npm run typecheck`
Run: `npm test`
Expected: PASS 100%.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/active-filter-breadcrumb.tsx src/components/dashboard/zones/dashboard-zone.tsx tests/dashboard-zone-split-cockpit.test.ts
git commit -m "feat(dashboard): implement Executive Split-Cockpit layout with ActiveFilterBreadcrumb

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: Xác Thực Hệ Thống Toàn Diện & Kiểm Tra Chuẩn Mực Light-Only

**Files:**
- Run Verification: `npm run typecheck`
- Run Verification: `npm test`
- Inspect: `src/app/globals.css` và các file liên quan (đảm bảo không vi phạm Light-only)

- [ ] **Step 1: Chạy Typecheck toàn bộ dự án**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 2: Chạy toàn bộ Unit & Integration Tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Kiểm tra tuân thủ CSS & Build Rules**

Xác nhận:
- Không có class `dark:`.
- Không gọi `next build` đè lên `.next/`.
- UI hiển thị sắc nét với các token OKLCH hành chính công sở.

- [ ] **Step 4: Hoàn thành & Báo cáo**

---
