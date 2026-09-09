---
status: superseded
domain: ux
created: 2026-09-09
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Linear & Plane.so Workspace & Calendar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn diện phân hệ Quản lý công việc và Lịch công tác QCET E-Office sang mô hình Full-Width Canvas kết hợp Slide-Over Side-Sheet (Drawer) và Thanh điều khiển hợp nhất (Unified Linear Toolbar), giải quyết triệt để tình trạng cắt cụt thông tin thị giác và phân mảnh các tầng lọc.

**Architecture:** 
- Xây dựng component `TaskDetailSideSheet` (Drawer 540px trượt từ mép phải) để chứa toàn bộ nghiệp vụ thẩm định BGH, phê duyệt cấp Trưởng và xem chi tiết nhiệm vụ, bảo toàn 100% ngữ cảnh cuộn trang bên dưới.
- Xây dựng `UnifiedLinearToolbar` tích hợp 1 dòng duy nhất gồm: Quick Search (phím tắt `/`), Multi-Filter Popover gom (Đơn vị, Tháng học thuật, Danh mục), Inline Segmented Status Pills, và View Mode Switcher (Bảng / Kanban / Lịch).
- Tái cấu trúc `UnifiedAdaptiveWorkspace` và `CascadingTaskTable` sang 100% chiều ngang (`w-full`), đưa `AdaptiveMetricStrip` thành dải băng chỉ số mảnh (Slim Horizontal Strip).
- Tái thiết kế `CalendarMonthView` thành lưới 7 cột Full-width với Event Capsules có viền màu nhận diện và Popover xem nhanh khi rê chuột vào ngày nhiều việc.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4 (Light-Only Standard, OKLCH color space), Lucide React (strokeWidth=1.5), Radix UI / Native accessible primitives, Node test runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-09-linear-plane-workspace-calendar-spec.md`

## Global Constraints
- **Light-Only Standard:** 100% giao diện vận hành trên chuẩn màu OKLCH công sở giáo dục. Tuyệt đối không thêm class `dark:`, khối `.dark` hoặc hook `useTheme`.
- **Typography Floor & Hierarchy:** Sàn font tối thiểu là 12px (`text-xs`). Tuyệt đối cấm các font `text-[9px]`, `text-[10px]`, `text-[11px]`. Tiêu đề dùng font `Plus Jakarta Sans` với `letter-spacing: -0.01em` (cấm `tracking-tighter`). Số liệu KPI và mã nhiệm vụ dùng font `JetBrains Mono` kèm `.tabular-nums`.
- **Engineering Rule:** Không chạy `next build` đè lên `.next` khi dev server đang chạy. Kiểm tra bằng `npm run typecheck` (`npx tsc --noEmit`) và `npm test`.
- **Zero Decorative Emojis:** Tất cả nhãn, icon sử dụng Lucide SVG icons (strokeWidth={1.5}), 0 emoji trang trí.
- **Backward Compatibility:** Giữ nguyên các facade export hiện có (`src/components/tasks/cascading-task-table.tsx`, `src/components/dashboard/cascading-task-table.tsx`) để bảo đảm 100% test suites (2017+ tests) đều vượt qua.

---

### Task 1: Slide-Over Side-Sheet (Drawer Thẩm Định & Xem Chi Tiết Nhiệm Vụ)

**Files:**
- Create: `src/components/tasks/side-sheet/task-detail-side-sheet.tsx`
- Test: `tests/tasks/task-detail-side-sheet.test.ts`

**Interfaces:**
- Consumes: `SchoolTask`, `StaffTask`, `TaskStatus`, `TaskPriority` từ `@/types/dashboard`.
- Produces: 
  ```typescript
  export interface TaskDetailSideSheetProps {
    isOpen: boolean;
    onClose: () => void;
    task: SchoolTask | StaffTask | null;
    reviewerRole?: "ADMIN" | "MANAGER" | "STAFF";
    reviewerName?: string;
    onReview?: (payload: { taskId: string; action: "APPROVE" | "REJECT"; feedback?: string }) => Promise<void> | void;
    onSubmitDeliverable?: (task: SchoolTask | StaffTask) => void;
    onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
    onRemind?: (taskId: string, title: string, leadAssignee: string) => void;
  }
  export function TaskDetailSideSheet(props: TaskDetailSideSheetProps): React.JSX.Element | null;
  ```

- [ ] **Step 1: Write the failing test**

Tạo file `tests/tasks/task-detail-side-sheet.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { TaskDetailSideSheet } from "@/components/tasks/side-sheet/task-detail-side-sheet";
import type { SchoolTask } from "@/types/dashboard";

describe("TaskDetailSideSheet Component", () => {
  const sampleTask: SchoolTask = {
    id: "NV-2026-09-006",
    code: "NV-2026-09-006",
    title: "Triển khai Kế hoạch Khảo sát việc làm cựu sinh viên năm 2026",
    department: "Phòng Công tác Học sinh - Sinh viên",
    category: "CHUYEN_DOI_SO",
    categoryLabel: "Chuyển đổi số",
    leadAssigneeName: "ThS. Nguyễn Tiến Phong",
    leadAssigneeRole: "Trưởng phòng",
    dueDate: "2026-09-24",
    status: "WAITING_APPROVAL",
    priority: "HIGH",
    progressPercent: 85,
    description: "Khảo sát tình hình việc làm của sinh viên tốt nghiệp năm 2025 theo chuẩn kiểm định Bộ GD&ĐT.",
    academicYear: "2026-2027",
    subTasks: [
      {
        id: "sub-1",
        title: "Soạn thảo biểu mẫu khảo sát trực tuyến",
        assigneeName: "Nguyễn Văn A",
        dueDate: "2026-09-15",
        status: "COMPLETED",
        progressPercent: 100,
      },
    ],
  };

  test("renders nothing when isOpen is false", () => {
    const html = renderToString(
      React.createElement(TaskDetailSideSheet, {
        isOpen: false,
        onClose: () => {},
        task: sampleTask,
      })
    );
    assert.equal(html, "");
  });

  test("renders task details, DRI, SLA and approval actions when open", () => {
    const html = renderToString(
      React.createElement(TaskDetailSideSheet, {
        isOpen: true,
        onClose: () => {},
        task: sampleTask,
        reviewerRole: "ADMIN",
        reviewerName: "Hiệu trưởng",
      })
    );
    assert.match(html, /NV-2026-09-006/);
    assert.match(html, /Triển khai Kế hoạch Khảo sát việc làm/);
    assert.match(html, /Phòng Công tác Học sinh - Sinh viên/);
    assert.match(html, /ThS. Nguyễn Tiến Phong/);
    assert.match(html, /Phê duyệt/);
    assert.match(html, /Yêu cầu chỉnh sửa/);
    // Anti-slop invariants
    assert.doesNotMatch(html, /dark:/);
    assert.doesNotMatch(html, /text-\[9px\]|text-\[10px\]|text-\[11px\]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/tasks/task-detail-side-sheet.test.ts`
Expected: FAIL with "Cannot find module '@/components/tasks/side-sheet/task-detail-side-sheet'"

- [ ] **Step 3: Implement `TaskDetailSideSheet`**

Tạo file `src/components/tasks/side-sheet/task-detail-side-sheet.tsx`:
- Render backdrop và drawer container trượt từ phải sang với `w-full sm:max-w-[560px]`.
- Bắt sự kiện `keydown` phím `Escape` để đóng.
- Hiển thị đầy đủ thông tin: Mã NV, Tiêu đề nhiệm vụ, Trạng thái, Mức độ ưu tiên, DRI (avatar + tên + đơn vị), Thời hạn & SLA, Mô tả, Khối thẩm định BGH (form ghi chú + nút Phê duyệt / Yêu cầu sửa), Cây công việc con (Subtasks).
- Tuân thủ nghiêm ngặt 100% Light-Only và sàn font 12px (`text-xs`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/tasks/task-detail-side-sheet.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/side-sheet/task-detail-side-sheet.tsx tests/tasks/task-detail-side-sheet.test.ts
git commit -m "feat(tasks): create modern slide-over side-sheet for task review and inspection"
```

---

### Task 2: Unified Linear Control Bar (Toolbar 1 Dòng Hợp Nhất)

**Files:**
- Create: `src/components/tasks/toolbar/unified-linear-toolbar.tsx`
- Test: `tests/tasks/unified-linear-toolbar.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface UnifiedLinearToolbarProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    // Multi-filter popover values
    selectedDepartment?: string;
    onDepartmentChange?: (dept: string) => void;
    selectedAcademicMonth?: number | "ALL";
    onAcademicMonthChange?: (month: number | "ALL") => void;
    selectedCategory?: string;
    onCategoryChange?: (cat: string) => void;
    // Status tabs
    activeStatusTab: string;
    onStatusTabChange: (status: string) => void;
    statusCounts: Record<string, number>;
    // View switcher & density
    viewMode: "table" | "kanban" | "calendar";
    onViewModeChange: (mode: "table" | "kanban" | "calendar") => void;
    density: "compact" | "comfortable";
    onDensityToggle: () => void;
    onResetAllFilters?: () => void;
  }
  export function UnifiedLinearToolbar(props: UnifiedLinearToolbarProps): React.JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

Tạo file `tests/tasks/unified-linear-toolbar.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { UnifiedLinearToolbar } from "@/components/tasks/toolbar/unified-linear-toolbar";

describe("UnifiedLinearToolbar Component", () => {
  test("renders unified search bar, filter popover button, status pills, and view switcher", () => {
    const html = renderToString(
      React.createElement(UnifiedLinearToolbar, {
        searchQuery: "",
        onSearchChange: () => {},
        activeStatusTab: "ALL",
        onStatusTabChange: () => {},
        statusCounts: { ALL: 149, IN_PROGRESS: 91, WAITING_APPROVAL: 5, OVERDUE: 1, COMPLETED: 13 },
        viewMode: "table",
        onViewModeChange: () => {},
        density: "comfortable",
        onDensityToggle: () => {},
      })
    );

    assert.match(html, /Tìm nhiệm vụ/);
    assert.match(html, /Bộ lọc/);
    assert.match(html, /Tất cả/);
    assert.match(html, /149/);
    assert.match(html, /Chờ duyệt/);
    assert.match(html, /Bảng/);
    assert.match(html, /Kanban/);
    assert.match(html, /Lịch/);
    // Anti-slop rules
    assert.doesNotMatch(html, /dark:/);
    assert.doesNotMatch(html, /text-\[9px\]|text-\[10px\]|text-\[11px\]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/tasks/unified-linear-toolbar.test.ts`
Expected: FAIL with "Cannot find module '@/components/tasks/toolbar/unified-linear-toolbar'"

- [ ] **Step 3: Implement `UnifiedLinearToolbar`**

Tạo file `src/components/tasks/toolbar/unified-linear-toolbar.tsx`:
- Bố trí 1 dòng ngang (`flex items-center justify-between gap-3`):
  - Trái: Ô tìm kiếm với phím tắt `/` hoặc `⌘K` + Nút `Bộ lọc` (có badge số lượng bộ lọc hoạt động) mở Popover đa tiêu chí (Đơn vị, Tháng học thuật, Danh mục).
  - Giữa: Dải segmented pills trạng thái (`Tất cả`, `Đang làm`, `Chờ duyệt`, `Quá hạn`, `Hoàn thành`).
  - Phải: Segmented control chuyển view `Bảng | Kanban | Lịch` và nút chuyển mật độ `Gọn | Chuẩn`.
- 100% Light mode, font floor 12px.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/tasks/unified-linear-toolbar.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/toolbar/unified-linear-toolbar.tsx tests/tasks/unified-linear-toolbar.test.ts
git commit -m "feat(tasks): create unified linear-style toolbar consolidating multi-level filters"
```

---

### Task 3: Tái Cấu Trúc Bảng Nhiệm Vụ Full-Width & Tích Hợp Slim Metric Strip

**Files:**
- Modify: `src/components/workspace/unified-adaptive-workspace.tsx`
- Modify: `src/components/workspace/components/adaptive-metric-strip.tsx`
- Modify: `src/components/tasks/table/modular-cascading-task-table.tsx`
- Test: `tests/workspace/unified-adaptive-workspace-fullwidth.test.ts`

**Interfaces:**
- Consumes: `UnifiedLinearToolbar`, `TaskDetailSideSheet`, `AdaptiveMetricStrip`.
- Produces: Full-width table layout (`w-full`), eliminate cramped 8:4 grid split, row click opens side-sheet.

- [ ] **Step 1: Write the failing test**

Tạo file `tests/workspace/unified-adaptive-workspace-fullwidth.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { UnifiedAdaptiveWorkspace } from "@/components/workspace/unified-adaptive-workspace";
import type { SchoolTask } from "@/types/dashboard";

describe("UnifiedAdaptiveWorkspace Full-Width Layout", () => {
  const sampleTasks: SchoolTask[] = [
    {
      id: "NV-1",
      code: "NV-1",
      title: "Triển khai hệ thống E-Office",
      department: "Phòng Hành chính",
      category: "CHUYEN_DOI_SO",
      leadAssigneeName: "Nguyễn Văn A",
      dueDate: "2026-09-24",
      status: "IN_PROGRESS",
      priority: "HIGH",
      progressPercent: 50,
    },
  ];

  test("renders full-width table without cramped lg:col-span-8 and static right sidebar", () => {
    const html = renderToString(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: { name: "ThS. Hiệu trưởng", role: "ADMIN" } as any,
        tasks: sampleTasks,
      })
    );

    // Should have full-width canvas container
    assert.match(html, /data-slot="full-width-task-canvas"/);
    // Should render the slim metric strip at top
    assert.match(html, /data-slot="slim-metric-strip"/);
    // Zero dark classes
    assert.doesNotMatch(html, /dark:/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/workspace/unified-adaptive-workspace-fullwidth.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `AdaptiveMetricStrip` and `UnifiedAdaptiveWorkspace`**

1. Cập nhật `src/components/workspace/components/adaptive-metric-strip.tsx`:
   - Hỗ trợ chế độ hiển thị `variant="slim"` (thanh ngang tinh gọn 1 hàng 5 ô KPI mảnh).
   - Thêm `data-slot="slim-metric-strip"`.
2. Cập nhật `src/components/workspace/unified-adaptive-workspace.tsx`:
   - Thay thế `grid grid-cols-1 lg:grid-cols-12` bằng bố cục `full-width-task-canvas` (`w-full`).
   - Đặt `AdaptiveMetricStrip` ở dạng thanh mảnh phía trên bảng.
   - Bỏ cột tĩnh cố định bên phải `UniversalActionQueue`.
   - Kết nối sự kiện click hàng trên bảng $\rightarrow$ mở `TaskDetailSideSheet` (Drawer trượt từ phải sang).
3. Cập nhật `src/components/tasks/table/modular-cascading-task-table.tsx`:
   - Tích hợp `UnifiedLinearToolbar`.
   - Đảm bảo các cột: Mã NV, Tiêu đề nhiệm vụ (không bị cắt cụt), Đơn vị & Danh mục, DRI (kèm avatar), Hạn chót/SLA, Mức độ ưu tiên, Huy hiệu trạng thái, và Tiến độ hiển thị rộng rãi và cân đối.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/workspace/unified-adaptive-workspace-fullwidth.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite to check regressions**

Run: `npm test`
Expected: PASS (all tests pass, 0 regressions)

- [ ] **Step 6: Commit**

```bash
git add src/components/workspace/unified-adaptive-workspace.tsx src/components/workspace/components/adaptive-metric-strip.tsx src/components/tasks/table/modular-cascading-task-table.tsx tests/workspace/unified-adaptive-workspace-fullwidth.test.ts
git commit -m "feat(workspace): redesign task table into full-width canvas with slim metric strip and side-sheet"
```

---

### Task 4: Tái Thiết Kế Lịch Công Tác Full-Width Với Event Capsules & Hover Popover

**Files:**
- Modify: `src/components/calendar/calendar-month-view.tsx`
- Modify: `src/components/dashboard/zones/calendar-zone.tsx`
- Test: `tests/calendar/calendar-month-view-fullwidth.test.ts`

**Interfaces:**
- Consumes: `CalendarMonthViewProps`, `CalendarTaskItem`, `TaskDetailSideSheet`.
- Produces: 100% full-width 7-day grid, eliminates empty right column, event capsules with color coding, date hover card / popover.

- [ ] **Step 1: Write the failing test**

Tạo file `tests/calendar/calendar-month-view-fullwidth.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";
import type { SchoolTask } from "@/types/dashboard";

describe("CalendarMonthView Full-Width & Event Capsules", () => {
  const sampleTasks: SchoolTask[] = [
    {
      id: "NV-1",
      code: "NV-1",
      title: "Lễ Khai giảng năm học 2026-2027",
      department: "Ban Giám hiệu",
      category: "CHUYEN_DOI_SO",
      leadAssigneeName: "TS. Hiệu trưởng",
      dueDate: "2026-09-16",
      status: "IN_PROGRESS",
      priority: "URGENT",
      progressPercent: 60,
    },
  ];

  test("renders full-width calendar grid without dead-space right column", () => {
    const html = renderToString(
      React.createElement(CalendarMonthView, {
        tasks: sampleTasks,
        initialMonth: 9,
        initialYear: 2026,
      })
    );

    assert.match(html, /data-slot="fullwidth-calendar-grid"/);
    assert.doesNotMatch(html, /Không có hạn chót công việc/);
    assert.doesNotMatch(html, /dark:/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/calendar/calendar-month-view-fullwidth.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `CalendarMonthView` and `CalendarZoneComponent`**

1. Cập nhật `src/components/calendar/calendar-month-view.tsx`:
   - Bỏ cột phụ `lg:col-span-4` (vốn hiển thị "Không có hạn chót công việc...").
   - Cho lưới lịch 7 cột mở rộng 100% chiều ngang màn hình (`w-full`) với `data-slot="fullwidth-calendar-grid"`.
   - Nâng cấp hiển thị tác vụ trong ô ngày thành các thanh **Event Capsules** đẹp mắt có viền màu nhận diện bên trái (`border-l-2`).
   - Tích hợp Hover Popover / Tooltip khi rê chuột vào ô ngày hoặc nhãn `+X nhiệm vụ` để xem ngay toàn bộ danh sách công việc của ngày đó mà không che khuất lịch.
   - Kết nối sự kiện bấm vào sự kiện $\rightarrow$ kích hoạt `onSelectTask` mở `TaskDetailSideSheet`.
2. Cập nhật `src/components/dashboard/zones/calendar-zone.tsx`:
   - Thu gọn header và dải chọn 12 tháng học thuật thành một thanh điều hướng tinh gọn, thanh thoát ở đầu trang.
   - Kết nối `TaskDetailSideSheet` khi người dùng bấm vào một sự kiện trên lịch.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/calendar/calendar-month-view-fullwidth.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/calendar/calendar-month-view.tsx src/components/dashboard/zones/calendar-zone.tsx tests/calendar/calendar-month-view-fullwidth.test.ts
git commit -m "feat(calendar): implement full-width calendar grid with event capsules and side-sheet integration"
```

---

### Task 5: Kiểm Thử Toàn Diện, Anti-Slop Audit & Đóng Gói Hoàn Thiện

**Files:**
- Run: `npm run typecheck`
- Run: `npm test`
- Audit: Kiểm tra vi phạm `dark:`, font floor 12px, tab numbers, visual styling.

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Run full automated test suite**

Run: `npm test`
Expected: 100% pass (2020+ tests).

- [ ] **Step 3: Run anti-slop audit check**

Kiểm tra:
```bash
grep -rn "dark:" src/components/tasks/side-sheet/ src/components/tasks/toolbar/ src/components/calendar/calendar-month-view.tsx || true
```
Expected: 0 kết quả `dark:`.

- [ ] **Step 4: Final commit**

```bash
git commit -m "chore(release): complete linear & plane.so workspace and calendar redesign with 100% quality gate pass"
```
