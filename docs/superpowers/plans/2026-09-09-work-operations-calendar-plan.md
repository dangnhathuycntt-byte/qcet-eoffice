# Hệ Thống Lịch Quản Lý Công Tác & Điều Hành Công Việc (Work Operations Calendar Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển hóa trang Lịch công tác (`/calendar`) thành Trung tâm Điều hành Tiến độ Công việc (Work Operations Calendar) 100% dữ liệu sống, loại bỏ mock data, tích hợp phân loại nhiệm vụ đa tầng (mốc cấp trường, sản phẩm DACUM, việc đơn vị), dải tồn đọng kỳ trước và bộ l��c phòng ban đa chiều.

**Architecture:** Xây dựng module thuần túy `src/lib/work-calendar-adapter.ts` chuyển đổi `SchoolTask[]`, `StaffTask[]`, `Deliverable[]` thành `WorkCalendarItem[]`; nâng cấp `executive-calendar-workspace.tsx` hiển thị thẻ công việc thông minh (tiến độ %, DRI, đơn vị chủ trì, badge phân loại) và bộ lọc 11 Khoa/Phòng; kết nối `/calendar` với `TaskDetailSideSheet` và `CreateTaskModal`.

**Tech Stack:** Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS v4 (Light-Only OKLCH), Lucide Icons, Node.js Test Runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-09-work-operations-calendar-spec.md`

## Global Constraints

- Enforce Tailwind CSS v4 Light-Only standard (`@theme inline`, OKLCH palette). Tuyệt đối không thêm class `dark:`, khối `.dark`, hoặc `ThemeProvider`.
- 100% Real Task Data: Loại bỏ hoàn toàn `DEFAULT_SAMPLE_EVENTS`. Dữ liệu hiển thị phải từ Task Engine.
- Zero Overdue Task Loss: Nhiệm vụ quá hạn từ các tuần/kỳ trước phải hiển thị trong dải "Tồn đọng kỳ trước cần xử lý gấp" (Prior Overdue Backlog).
- Tương thích với `getSystemReferenceDate()` và chuẩn hóa UTC từ `@/lib/academic-calendar`.
- Đảm bảo kiểm tra kiểu nghiêm ngặt (`npm run typecheck`) và chạy qua 100% bộ kiểm thử (`npm test`).

---

### Task 1: Bộ Chuyển Đổi Dữ Liệu Nhiệm Vụ Thành Thao Tác Lịch (Work Calendar Adapter)

**Files:**
- Create: `src/lib/work-calendar-adapter.ts`
- Test: `tests/work-calendar-adapter.test.ts`

**Interfaces:**
- Consumes:
  - `SchoolTask`, `StaffTask`, `Deliverable` từ `@/types/dashboard`
  - `getSystemReferenceDate`, `isTaskPastDue` từ `@/lib/academic-calendar`
- Produces:
  - `WorkItemType`: `"school_milestone" | "subtask" | "deliverable" | "urgent_overdue"`
  - `WorkCalendarItem` interface
  - `WorkCalendarFilters` interface
  - `transformTasksToCalendarOperations(tasks: SchoolTask[], options?: { academicMonth?: number | "ALL", referenceDate?: string }): WorkCalendarItem[]`
  - `getPriorOverdueWorkItems(tasks: SchoolTask[], referenceDate?: string): WorkCalendarItem[]`
  - `filterWorkCalendarItems(items: WorkCalendarItem[], filters: WorkCalendarFilters): WorkCalendarItem[]`

- [ ] **Step 1: Viết test kiểm tra chuyển đổi dữ liệu và lọc công việc**

Tạo file `tests/work-calendar-adapter.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  transformTasksToCalendarOperations,
  getPriorOverdueWorkItems,
  filterWorkCalendarItems,
  type WorkCalendarItem,
} from "../src/lib/work-calendar-adapter";
import type { SchoolTask } from "../src/types/dashboard";

describe("Work Calendar Adapter & Operations Engine", () => {
  const sampleTasks: SchoolTask[] = [
    {
      id: "school-task-1",
      code: "NV-01",
      title: "Nghiệm thu chuẩn đầu ra DACUM",
      category: "CHUYEN_MON",
      priority: "URGENT",
      status: "IN_PROGRESS",
      progressPercent: 75,
      dueDate: "2026-09-16T00:00:00.000Z",
      startDate: "2026-09-01T00:00:00.000Z",
      departmentId: "P_DTQLKH",
      departmentName: "Phòng Đào tạo & QLKH",
      leadAssigneeName: "Thầy Nam",
      subTasks: [
        {
          id: "subtask-1-1",
          taskId: "school-task-1",
          title: "Hoàn thiện ma trận kỹ năng nghề CNTT",
          status: "IN_PROGRESS",
          dueDate: "2026-09-15T00:00:00.000Z",
          assignedToDepartmentId: "K_CNTT",
          assignedToDepartmentName: "Khoa CNTT",
          assigneeName: "Cô Lan",
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-10T00:00:00.000Z",
        },
      ],
      deliverables: [
        {
          id: "deliv-1",
          taskId: "school-task-1",
          title: "Báo cáo tổng hợp góp ý doanh nghiệp",
          status: "PENDING",
          dueDate: "2026-09-14T00:00:00.000Z",
          submittedAt: null,
          verifiedAt: null,
        },
      ],
      assignees: [],
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
    },
    {
      id: "school-task-overdue",
      code: "NV-02",
      title: "Kế hoạch tu sửa xưởng thực hành E3",
      category: "CO_SO_VAT_CHAT",
      priority: "HIGH",
      status: "IN_PROGRESS",
      progressPercent: 30,
      dueDate: "2026-09-02T00:00:00.000Z",
      startDate: "2026-08-20T00:00:00.000Z",
      departmentId: "P_QTTB",
      departmentName: "Phòng Quản trị - Thiết bị",
      leadAssigneeName: "Thầy Dũng",
      subTasks: [],
      deliverables: [],
      assignees: [],
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    },
  ];

  test("chuyển đổi đầy đủ mốc trường, tiểu nhiệm vụ và sản phẩm bàn giao", () => {
    const items = transformTasksToCalendarOperations(sampleTasks, {
      referenceDate: "2026-09-14T00:00:00.000Z",
    });

    assert.ok(items.length >= 3, `Expected at least 3 items, got ${items.length}`);

    // Kiểm tra mốc nhiệm vụ trường
    const schoolMilestone = items.find((i) => i.id === "milestone-school-task-1");
    assert.ok(schoolMilestone, "Phải có item mốc nhiệm vụ trường");
    assert.strictEqual(schoolMilestone?.type, "school_milestone");
    assert.strictEqual(schoolMilestone?.dueDate, "2026-09-16");
    assert.strictEqual(schoolMilestone?.assigneeName, "Thầy Nam");

    // Kiểm tra subtask
    const subtaskItem = items.find((i) => i.id === "subtask-subtask-1-1");
    assert.ok(subtaskItem, "Phải có item tiểu nhiệm vụ");
    assert.strictEqual(subtaskItem?.type, "subtask");
    assert.strictEqual(subtaskItem?.dueDate, "2026-09-15");
    assert.strictEqual(subtaskItem?.departmentId, "K_CNTT");
    assert.strictEqual(subtaskItem?.assigneeName, "Cô Lan");

    // Kiểm tra deliverable
    const delivItem = items.find((i) => i.id === "deliverable-deliv-1");
    assert.ok(delivItem, "Phải có item sản phẩm bàn giao");
    assert.strictEqual(delivItem?.type, "deliverable");
    assert.strictEqual(delivItem?.dueDate, "2026-09-14");
  });

  test("trích xuất chính xác danh sách nhiệm vụ quá hạn (Prior Overdue)", () => {
    const overdueItems = getPriorOverdueWorkItems(sampleTasks, "2026-09-14T00:00:00.000Z");
    assert.strictEqual(overdueItems.length, 1);
    assert.strictEqual(overdueItems[0].sourceTaskId, "school-task-overdue");
    assert.strictEqual(overdueItems[0].isOverdue, true);
    assert.ok((overdueItems[0].daysOverdue || 0) > 0);
  });

  test("bộ lọc công việc theo phòng ban và trạng thái", () => {
    const items = transformTasksToCalendarOperations(sampleTasks, {
      referenceDate: "2026-09-14T00:00:00.000Z",
    });

    const cnttItems = filterWorkCalendarItems(items, { departmentId: "K_CNTT" });
    assert.strictEqual(cnttItems.length, 1);
    assert.strictEqual(cnttItems[0].departmentId, "K_CNTT");

    const overdueOnly = filterWorkCalendarItems(items, { statusFilter: "OVERDUE" });
    assert.strictEqual(overdueOnly.length, 1);
    assert.strictEqual(overdueOnly[0].sourceTaskId, "school-task-overdue");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (đỏ)**

Chạy lệnh: `npx tsx --test tests/work-calendar-adapter.test.ts`
Kỳ vọng: Thất bại do chưa tồn tại module `src/lib/work-calendar-adapter.ts`.

- [ ] **Step 3: Xây dựng module `src/lib/work-calendar-adapter.ts`**

Tạo `src/lib/work-calendar-adapter.ts`:
```typescript
import type { SchoolTask, StaffTask, Deliverable } from "@/types/dashboard";
import { getSystemReferenceDate, isTaskPastDue } from "@/lib/academic-calendar";

export type WorkItemType = "school_milestone" | "subtask" | "deliverable" | "urgent_overdue";

export interface WorkCalendarItem {
  id: string;
  sourceTaskId: string;
  parentSchoolTaskId?: string;
  title: string;
  code?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  type: WorkItemType;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "TODO" | "IN_PROGRESS" | "WAITING_APPROVAL" | "COMPLETED" | "OVERDUE";
  progressPercent: number;
  departmentId: string;
  departmentName: string;
  assigneeName: string;
  isOverdue: boolean;
  daysOverdue?: number;
  deliverableSummary?: string;
}

export interface WorkCalendarFilters {
  departmentId?: string | "ALL";
  assigneeName?: string | "ALL";
  itemType?: WorkItemType | "ALL";
  statusFilter?: "ALL" | "ACTIVE" | "OVERDUE" | "COMPLETED";
  searchQuery?: string;
}

export function extractDateString(isoString?: string | null): string {
  if (!isoString) return "";
  return isoString.split("T")[0];
}

export function calculateDaysOverdue(dueDateStr: string, refDateStr?: string): number {
  const refDate = refDateStr ? new Date(refDateStr) : new Date(getSystemReferenceDate());
  const due = new Date(dueDateStr);
  const diffTime = refDate.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

export function transformTasksToCalendarOperations(
  tasks: SchoolTask[],
  options?: { academicMonth?: number | "ALL"; referenceDate?: string }
): WorkCalendarItem[] {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];
  const refDate = options?.referenceDate || getSystemReferenceDate();
  const items: WorkCalendarItem[] = [];

  for (const task of tasks) {
    if (!task.dueDate) continue;
    const taskDueDate = extractDateString(task.dueDate);
    const isOverdue = isTaskPastDue(task, refDate);
    const daysOverdue = isOverdue ? calculateDaysOverdue(task.dueDate, refDate) : 0;

    // 1. Mốc nhiệm vụ trường
    items.push({
      id: `milestone-${task.id}`,
      sourceTaskId: task.id,
      title: task.title,
      code: task.code,
      dueDate: taskDueDate,
      dueTime: "17:00",
      type: isOverdue ? "urgent_overdue" : "school_milestone",
      priority: task.priority || "HIGH",
      status: task.status === "COMPLETED" ? "COMPLETED" : isOverdue ? "OVERDUE" : "IN_PROGRESS",
      progressPercent: task.progressPercent || 0,
      departmentId: task.departmentId || "BGH",
      departmentName: task.departmentName || "Ban Giám hiệu",
      assigneeName: task.leadAssigneeName || "Lãnh đạo phụ trách",
      isOverdue,
      daysOverdue,
    });

    // 2. Tiểu nhiệm vụ đơn vị (Subtasks)
    if (Array.isArray(task.subTasks)) {
      for (const sub of task.subTasks) {
        if (!sub.dueDate) continue;
        const subDueDate = extractDateString(sub.dueDate);
        const subOverdue = sub.status !== "COMPLETED" && calculateDaysOverdue(sub.dueDate, refDate) > 0;
        const subDaysOverdue = subOverdue ? calculateDaysOverdue(sub.dueDate, refDate) : 0;

        items.push({
          id: `subtask-${sub.id}`,
          sourceTaskId: sub.id,
          parentSchoolTaskId: task.id,
          title: sub.title,
          dueDate: subDueDate,
          dueTime: "16:30",
          type: subOverdue ? "urgent_overdue" : "subtask",
          priority: task.priority || "MEDIUM",
          status: sub.status === "COMPLETED" ? "COMPLETED" : subOverdue ? "OVERDUE" : "IN_PROGRESS",
          progressPercent: sub.status === "COMPLETED" ? 100 : 50,
          departmentId: sub.assignedToDepartmentId || task.departmentId || "BGH",
          departmentName: sub.assignedToDepartmentName || task.departmentName || "Đơn vị",
          assigneeName: sub.assigneeName || "Chuyên viên",
          isOverdue: subOverdue,
          daysOverdue: subDaysOverdue,
        });
      }
    }

    // 3. Sản phẩm nghiệm thu (Deliverables)
    if (Array.isArray(task.deliverables)) {
      for (const deliv of task.deliverables) {
        if (!deliv.dueDate) continue;
        const delivDueDate = extractDateString(deliv.dueDate);
        const delivOverdue = deliv.status !== "APPROVED" && calculateDaysOverdue(deliv.dueDate, refDate) > 0;
        const delivDaysOverdue = delivOverdue ? calculateDaysOverdue(deliv.dueDate, refDate) : 0;

        items.push({
          id: `deliverable-${deliv.id}`,
          sourceTaskId: task.id,
          parentSchoolTaskId: task.id,
          title: `[Sản phẩm] ${deliv.title}`,
          dueDate: delivDueDate,
          dueTime: "11:30",
          type: delivOverdue ? "urgent_overdue" : "deliverable",
          priority: "URGENT",
          status: deliv.status === "APPROVED" ? "COMPLETED" : delivOverdue ? "OVERDUE" : "WAITING_APPROVAL",
          progressPercent: deliv.status === "APPROVED" ? 100 : 0,
          departmentId: task.departmentId || "BGH",
          departmentName: task.departmentName || "Đơn vị nộp",
          assigneeName: task.leadAssigneeName || "Người phụ trách",
          isOverdue: delivOverdue,
          daysOverdue: delivDaysOverdue,
          deliverableSummary: deliv.title,
        });
      }
    }
  }

  return items;
}

export function getPriorOverdueWorkItems(
  tasks: SchoolTask[],
  referenceDate?: string
): WorkCalendarItem[] {
  const allItems = transformTasksToCalendarOperations(tasks, { referenceDate });
  return allItems
    .filter((item) => item.isOverdue && item.status !== "COMPLETED")
    .sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
}

export function filterWorkCalendarItems(
  items: WorkCalendarItem[],
  filters: WorkCalendarFilters
): WorkCalendarItem[] {
  if (!Array.isArray(items)) return [];

  return items.filter((item) => {
    if (filters.departmentId && filters.departmentId !== "ALL") {
      if (item.departmentId !== filters.departmentId) return false;
    }
    if (filters.assigneeName && filters.assigneeName !== "ALL") {
      if (!item.assigneeName.toLowerCase().includes(filters.assigneeName.toLowerCase())) {
        return false;
      }
    }
    if (filters.itemType && filters.itemType !== "ALL") {
      if (item.type !== filters.itemType) return false;
    }
    if (filters.statusFilter && filters.statusFilter !== "ALL") {
      if (filters.statusFilter === "OVERDUE" && !item.isOverdue) return false;
      if (filters.statusFilter === "COMPLETED" && item.status !== "COMPLETED") return false;
      if (filters.statusFilter === "ACTIVE" && item.status === "COMPLETED") return false;
    }
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDept = item.departmentName.toLowerCase().includes(q);
      const matchAssignee = item.assigneeName.toLowerCase().includes(q);
      if (!matchTitle && !matchDept && !matchAssignee) return false;
    }
    return true;
  });
}
```

- [ ] **Step 4: Chạy test xác nhận xanh**

Chạy lệnh: `npx tsx --test tests/work-calendar-adapter.test.ts`
Kỳ vọng: PASS 100%.

- [ ] **Step 5: Commit**

```bash
git add src/lib/work-calendar-adapter.ts tests/work-calendar-adapter.test.ts
git commit -m "feat(calendar): implement work calendar adapter and prior overdue engine

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Nâng Cấp Executive Calendar Workspace với Thẻ Công Việc Thông Minh & Bộ Lọc Phòng Ban

**Files:**
- Modify: `src/components/calendar/executive-calendar-workspace.tsx`
- Test: `tests/executive-calendar-workspace.test.ts`

**Interfaces:**
- Consumes:
  - `WorkCalendarItem`, `WorkCalendarFilters`, `transformTasksToCalendarOperations`, `getPriorOverdueWorkItems`, `filterWorkCalendarItems` từ `@/lib/work-calendar-adapter`
  - `SchoolTask` từ `@/types/dashboard`
- Produces:
  - Loại bỏ hoàn toàn `DEFAULT_SAMPLE_EVENTS`.
  - Hiển thị dải `PriorOverdueBacklogBanner` ghim đầu trang khi có việc trễ hạn.
  - Thêm thanh công cụ lọc ma trận: Lọc 11 Đơn vị QCET, Lọc loại mốc công việc, Lọc trạng thái, Ô tìm kiếm nhanh.
  - Component `WorkCalendarCard` hiển thị: Mã việc, Tên việc, Đơn vị, DRI, Thanh tiến độ %, Badge trạng thái.
  - Hỗ trợ click vào việc mở `onSelectWorkItem` hoặc `onSelectEvent`.

- [ ] **Step 1: Viết test cho Executive Calendar Workspace mới**

Cập nhật `tests/executive-calendar-workspace.test.ts` để kiểm tra:
- Không còn hiển thị mock data tĩnh khi không có tasks.
- Khi truyền `tasks`, component tự động hiển thị các mốc công việc tương ứng.
- Lọc theo phòng ban làm thay đổi danh sách công việc hiển thị.

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Chạy: `npx tsx --test tests/executive-calendar-workspace.test.ts`

- [ ] **Step 3: Cập nhật `src/components/calendar/executive-calendar-workspace.tsx`**

- Tích hợp `transformTasksToCalendarOperations` và `getPriorOverdueWorkItems`.
- Loại bỏ mảng `DEFAULT_SAMPLE_EVENTS`.
- Thêm giao diện `PriorOverdueBacklogBanner`:
  - Khối màu hổ phách/hoa hồng (`bg-rose-50/70 border-rose-200 text-rose-800`).
  - Hiển thị danh sách các việc trễ hạn kèm số ngày trễ.
- Thêm thanh bộ lọc công việc:
  - Dropdown 11 đơn vị: Tất cả, P_DTQLKH (Đào tạo), P_TCHC (Tổ chức - Hành chính), P_KHTC (Tài chính), K_CNTT (CNTT), K_CD (Cơ điện), v.v.
  - Toggle Lọc loại mốc: Tất cả, Mốc trường, Sản phẩm DACUM, Việc đơn vị.
- Cập nhật thẻ công việc trong chế độ xem Lưới tuần (Week Grid) và Danh sách nghị trình (Agenda List):
  - Hiển thị rõ: Badge loại việc, Mã nhiệm vụ, Tiêu đề, Đơn vị chủ trì, DRI, Thanh tiến độ mini.

- [ ] **Step 4: Chạy test xác nhận xanh**

Chạy: `npx tsx --test tests/executive-calendar-workspace.test.ts`
Kỳ vọng: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/executive-calendar-workspace.tsx tests/executive-calendar-workspace.test.ts
git commit -m "feat(calendar): connect executive calendar workspace to live work items and department filters

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Kết Nối Route `/calendar` với Dữ Liệu Sống và Tác Nghiệp Trực Tiếp

**Files:**
- Modify: `src/app/calendar/page.tsx`
- Test: `tests/calendar-route-integration.test.ts`

**Interfaces:**
- Consumes:
  - `/api/dashboard/overview` lấy danh sách `SchoolTask[]` thực tế.
  - `TaskDetailSideSheet` hiển thị và cập nhật nhiệm vụ/sản phẩm.
  - `CreateTaskModal` tạo việc mới.
- Produces:
  - Click vào thẻ công việc trên lịch -> Mở `TaskDetailSideSheet` với đúng thực thể (nhiệm vụ trường hoặc subtask).
  - Click vào ô ngày trống -> Mở `CreateTaskModal` với ngày đến hạn (`initialDueDate`) đã chọn sẵn.
  - Đồng bộ trạng thái và tiến độ tức thì (Optimistic update) sau khi chỉnh sửa qua SideSheet hoặc tạo việc mới.

- [ ] **Step 1: Viết test kiểm tra tương tác tại trang `/calendar`**

Tạo `tests/calendar-route-integration.test.ts`:
- Kiểm tra kết nối giữa danh sách `tasks` và sự kiện click chọn thẻ công việc.
- Kiểm tra click vào ngày trống gọi đúng hàm mở modal tạo việc.

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Chạy: `npx tsx --test tests/calendar-route-integration.test.ts`

- [ ] **Step 3: Cập nhật `src/app/calendar/page.tsx`**

- Hoàn thiện hàm `handleSelectEvent`: tìm kiếm chính xác nhiệm vụ cha (`SchoolTask`) hoặc tiểu nhiệm vụ (`StaffTask`/`SubTask`) và truyền vào `selectedTask`.
- Xử lý mở `TaskDetailSideSheet` mượt mà.
- Hỗ trợ đổi trạng thái `handleStatusChange` cập nhật lại tiến độ và rollup lên toàn bộ danh sách `tasks`.
- Kết nối `handleOpenAddTask(dateStr)` điền tự động ngày vào `CreateTaskModal`.

- [ ] **Step 4: Chạy test xác nhận xanh**

Chạy: `npx tsx --test tests/calendar-route-integration.test.ts`
Kỳ vọng: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/calendar/page.tsx tests/calendar-route-integration.test.ts
git commit -m "feat(calendar): streamline direct work operations and modal side-sheet interaction

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Kiểm Thử Toàn Diện Hệ Thống & Kiểm Tra Kiểu TypeScript

**Files:**
- Modify: Kiểm tra toàn bộ các file liên quan
- Test: Toàn bộ test suite `tests/**/*.test.ts`

- [ ] **Step 1: Chạy kiểm tra kiểu TypeScript**

Chạy: `npm run typecheck`
Kỳ vọng: Không có bất kỳ lỗi TypeScript nào (`exit code 0`).

- [ ] **Step 2: Chạy toàn bộ bộ kiểm thử tự động**

Chạy: `npm test`
Kỳ vọng: Toàn bộ các bài test đều xanh.

- [ ] **Step 3: Commit hoàn tất**

```bash
git commit --allow-empty -m "chore(calendar): verify work operations calendar engine passes all tests and typechecks

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
