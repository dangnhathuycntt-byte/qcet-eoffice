---
status: completed
domain: data
created: 2026-09-09
---

# Dashboard Data Consistency & Aggregation Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triệt tiêu hoàn toàn 6 điểm mâu thuẫn số liệu trên Dashboard và Khoang điều hành Ban Giám hiệu QCET E-Office; bảo toàn định luật số học MECE; loại bỏ 100% dữ liệu giả lập (mock data); và đồng bộ toàn vẹn đường ống tổng hợp dữ liệu từ Prisma ORM đến giao diện người dùng.

**Architecture:** Thiết lập nguồn sự thật duy nhất (Single Source of Truth) dựa trên mô hình phân tầng trạng thái 2 lớp (Two-Tier State Category): đồng bộ enum `TaskStatus`, chuẩn hóa ngày neo hệ thống `getSystemReferenceDate()`, tái cấu trúc `computeDashboardStats` theo chuỗi ưu tiên bất biến (`COMPLETED` -> `WAITING_APPROVAL` -> `OVERDUE` -> `NOT_STARTED` -> `IN_PROGRESS`), trích xuất hàng đợi hành động BGH động (`extractExecutiveActionItems`), và chuẩn hóa công thái học thẻ KPI không gây ngộ nhận giữa Throughput (Hoàn thành) và Effort (Tiến độ trung bình).

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma ORM, Tailwind CSS v4, Lucide Icons, Node.js Test Runner (`tsx --test`).

**Spec:** `docs/SPEC_DASHBOARD_DATA_CONSISTENCY_AND_AGGREGATION.md`

## Global Constraints
- **Tuân thủ chuẩn Light-Only:** Dự án sử dụng thuần túy Light Mode (OKLCH color space) chuẩn công sở giáo dục. Tuyệt đối không thêm class `dark:`, khối `.dark`, hoặc logic `useTheme`.
- **Nguyên tắc Build an toàn:** Tuyệt đối không chạy `next build` khi dev server đang chạy để tránh cache poisoning. Sử dụng `npm run typecheck` và `npm test` để kiểm thử.
- **Zero Mock Data:** Không lưu giữ bất kỳ mảng dữ liệu mẫu tĩnh cứng nào (như `DEFAULT_ACTION_ITEMS`). Nếu danh sách rỗng, bắt buộc hiển thị Empty State chuẩn *Verified Clear Horizon*.
- **Toán học MECE:** $\text{TotalSchoolTasks} = \text{InProgress} + \text{NotStarted} + \text{WaitingApproval} + \text{Overdue} + \text{Completed}$.

---

## File Structure & Module Map

| File Path | Role & Responsibility |
| :--- | :--- |
| `src/lib/academic-calendar.ts` | Khởi tạo `getSystemReferenceDate()`, chuẩn hóa `isTaskPastDue()` theo chuỗi ISO YYYY-MM-DD, tối ưu hóa `filterTasksByAcademicMonthStrict()` |
| `src/types/dashboard.ts` | Đồng bộ `TaskStatus` với Prisma Schema, mở rộng `SchoolTask.status`, bổ sung trường thống kê phân rã trong `DashboardStats` |
| `src/lib/dashboard-aggregator.ts` | Viết lại `computeDashboardStats` bảo toàn MECE, sửa `computeSchoolTaskRollup` bảo toàn tiến độ thủ công khi subtasks rỗng |
| `src/lib/executive-matrix-aggregator.ts` | Phân tách `completionRate` và `averageProgressPercent`, tích lũy tiến độ subtask, hiện thực `extractExecutiveActionItems()` |
| `src/lib/server/dashboard-service.ts` | Truy vấn đồng thời `scope: SCHOOL` và `scope: DEPARTMENT`, xóa ép kiểu `as any`, loại trừ `CANCELLED` |
| `src/components/dashboard/executive-stat-strip.tsx` | Đổi tiêu đề Thẻ 4 thành "Tiến độ trung bình toàn trường", cập nhật subtext Thẻ 1 và Thẻ 4 khớp toán học |
| `src/components/dashboard/executive-action-center.tsx` | Khai tử `DEFAULT_ACTION_ITEMS`, dựng khối Empty State *Verified Clear Horizon* với `ShieldCheck` |
| `src/components/dashboard/zones/dashboard-zone.tsx` | Nạp `executiveActionItems` thật vào `ExecutiveActionCenter`, kết nối luồng hành động `onAction` |
| `src/hooks/use-task-filters.ts` | Tính toán `executiveActionItems` dựa trên `monthFilteredSchoolTasks` và chia sẻ tới zone |
| `src/app/api/dashboard/overview/route.ts` | Bảo vệ endpoint bằng phiên JWT và phân quyền phạm vi dữ liệu theo vai trò RBAC |
| `src/app/api/tasks/[id]/route.ts` | Chặn người được giao việc tự duyệt chính mình (SoD), siết chặt quyền duyệt nhiệm vụ cấp trường cho BGH |

---

### Task 1: Chuẩn hóa Hệ thống Ngày Neo và Kiểm tra Quá hạn an toàn (Reference Date Engine)

**Files:**
- Modify: `src/lib/academic-calendar.ts:1-40`
- Test: `tests/academic-calendar-reference-date.test.ts`

**Interfaces:**
- Produces: `getSystemReferenceDate(): string`, `isTaskPastDue(dateStr?: string | Date | null, referenceDate?: string): boolean`

- [ ] **Step 1: Viết test kiểm tra ngày neo hệ thống và kiểm tra quá hạn an toàn**

Tạo tệp `tests/academic-calendar-reference-date.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { getSystemReferenceDate, isTaskPastDue } from "../src/lib/academic-calendar";

test("getSystemReferenceDate returns standard 2026-09-09 default", () => {
  const ref = getSystemReferenceDate();
  assert.equal(ref, "2026-09-09");
});

test("isTaskPastDue compares lexicographical ISO dates accurately without UTC midnight skew", () => {
  const ref = "2026-09-09";
  // Due before reference date -> overdue
  assert.equal(isTaskPastDue("2026-09-08", ref), true);
  assert.equal(isTaskPastDue("2026-09-08T17:00:00.000Z", ref), true);

  // Due on reference date -> not overdue yet during the day
  assert.equal(isTaskPastDue("2026-09-09", ref), false);
  assert.equal(isTaskPastDue("2026-09-09T00:00:00.000Z", ref), false);

  // Due in future -> not overdue
  assert.equal(isTaskPastDue("2026-09-10", ref), false);

  // Null/empty date -> not overdue
  assert.equal(isTaskPastDue(null, ref), false);
  assert.equal(isTaskPastDue(undefined, ref), false);
});
```

- [ ] **Step 2: Chạy test để xác nhận kiểm thử thất bại (do chưa có getSystemReferenceDate)**

Run: `npx tsx --test tests/academic-calendar-reference-date.test.ts`  
Expected: FAIL với lỗi `getSystemReferenceDate is not exported from ...`

- [ ] **Step 3: Hiện thực `getSystemReferenceDate` và chuẩn hóa `isTaskPastDue` trong `src/lib/academic-calendar.ts`**

Trong `src/lib/academic-calendar.ts`, bổ sung:
```typescript
/**
 * Trả về chuỗi ngày hệ thống chuẩn (YYYY-MM-DD) theo múi giờ Việt Nam (Asia/Ho_Chi_Minh).
 */
export function getSystemReferenceDate(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_REFERENCE_DATE) {
    return process.env.NEXT_PUBLIC_REFERENCE_DATE;
  }
  return "2026-09-09";
}

/**
 * Kiểm tra quá hạn an toàn theo phép so sánh chuỗi ISO YYYY-MM-DD.
 * Loại trừ hoàn toàn lỗi parse UTC nửa đêm làm quá hạn sớm trong ngày làm việc.
 */
export function isTaskPastDue(
  dateStr?: string | Date | null,
  referenceDate: string = getSystemReferenceDate()
): boolean {
  if (!dateStr) return false;
  const clean = typeof dateStr === "string"
    ? (dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr)
    : dateStr.toISOString().split("T")[0];
  return clean < referenceDate;
}
```

- [ ] **Step 4: Chạy lại test để xác nhận kiểm thử xanh 100%**

Run: `npx tsx --test tests/academic-calendar-reference-date.test.ts`  
Expected: PASS 2/2 tests.

- [ ] **Step 5: Commit task 1**

```bash
git add src/lib/academic-calendar.ts tests/academic-calendar-reference-date.test.ts
git commit -m "feat(calendar): implement centralized getSystemReferenceDate and UTC-safe isTaskPastDue"
```

---

### Task 2: Đồng bộ Kiểu Dữ liệu Hệ thống (Type Synchronization & Granular Stats)

**Files:**
- Modify: `src/types/dashboard.ts:1-190`

**Interfaces:**
- Produces: `TaskStatus`, updated `SchoolTask.status`, updated `DashboardStats` với các trường chi tiết bảo toàn MECE.

- [ ] **Step 1: Viết test xác thực cấu trúc kiểu dữ liệu và các trường DashboardStats**

Tạo tệp `tests/dashboard-types-contract.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import type { TaskStatus, SchoolTask, DashboardStats } from "../src/types/dashboard";

test("TaskStatus supports full Prisma and UI states", () => {
  const statuses: TaskStatus[] = [
    "NOT_STARTED",
    "IN_PROGRESS",
    "WAITING_APPROVAL",
    "PENDING_EXECUTIVE_APPROVAL",
    "NEEDS_REVIEW",
    "BLOCKED",
    "COMPLETED",
    "OVERDUE",
    "CANCELLED",
  ];
  assert.equal(statuses.length, 9);
});

test("DashboardStats contract includes granular breakdown fields", () => {
  const stats: DashboardStats = {
    totalSchoolTasks: 130,
    schoolTasksInProgress: 85,
    schoolTasksCompleted: 11,
    schoolTasksNotStarted: 30,
    schoolTasksWaitingApproval: 3,
    schoolTasksOverdue: 1,
    totalStaffTasks: 0,
    staffTasksInProgress: 0,
    staffTasksCompleted: 0,
    staffTasksNotStarted: 0,
    staffTasksWaitingApproval: 0,
    staffTasksOverdue: 0,
    needsReviewTasksCount: 3,
    overdueTasksCount: 1,
    averageSchoolProgressPercent: 44,
    completionRate: 8,
    totalTasks: 130,
    inProgressTasks: 85,
    completedTasks: 11,
    overdueTasks: 1,
    pendingApprovals: 3,
  };
  assert.equal(stats.totalSchoolTasks, 130);
  assert.equal(
    stats.schoolTasksInProgress +
      stats.schoolTasksNotStarted! +
      stats.schoolTasksWaitingApproval! +
      stats.schoolTasksOverdue! +
      stats.schoolTasksCompleted,
    130
  );
});
```

- [ ] **Step 2: Chạy test để xác nhận kiểu dữ liệu chưa hỗ trợ các trường mới**

Run: `npx tsx --test tests/dashboard-types-contract.test.ts`  
Expected: FAIL do TypeScript thông báo `schoolTasksNotStarted` không tồn tại trong `DashboardStats`.

- [ ] **Step 3: Cập nhật `src/types/dashboard.ts` mở rộng `TaskStatus` và `DashboardStats`**

Trong `src/types/dashboard.ts`:
```typescript
export type TaskStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'WAITING_APPROVAL'
  | 'PENDING_EXECUTIVE_APPROVAL'
  | 'NEEDS_REVIEW'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'NEW';
```
Cập nhật `SchoolTask`:
```typescript
export interface SchoolTask {
  id: string;
  code?: string;
  title: string;
  description?: string;
  category: TaskCategory;
  academicMonth?: number;
  academicYear?: string;
  status: TaskStatus;
  priority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  dueDate: string;
  startDate?: string;
  progressPercent: number;
  totalSubTasks: number;
  completedSubTasks: number;
  leadDepartment?: string;
  leadDepartmentCode?: string;
  leadAssigneeName?: string;
  leadAssigneeAvatar?: string;
  subTasks?: StaffTask[];
}
```
Mở rộng `DashboardStats`:
```typescript
export interface DashboardStats {
  totalSchoolTasks: number;
  schoolTasksInProgress: number;
  schoolTasksCompleted: number;
  schoolTasksNotStarted?: number;
  schoolTasksWaitingApproval?: number;
  schoolTasksOverdue?: number;
  totalStaffTasks: number;
  staffTasksInProgress: number;
  staffTasksCompleted: number;
  staffTasksNotStarted?: number;
  staffTasksWaitingApproval?: number;
  staffTasksOverdue?: number;
  needsReviewTasksCount: number;
  overdueTasksCount: number;
  averageSchoolProgressPercent: number;
  completionRate?: number;
  cancelledTasksCount?: number;
  totalTasks?: number;
  inProgressTasks?: number;
  completedTasks?: number;
  overdueTasks?: number;
  pendingApprovals?: number;
}
```

- [ ] **Step 4: Chạy lại test để xác nhận contract xanh hoàn toàn**

Run: `npx tsx --test tests/dashboard-types-contract.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit task 2**

```bash
git add src/types/dashboard.ts tests/dashboard-types-contract.test.ts
git commit -m "refactor(types): unify TaskStatus with Prisma and expand DashboardStats breakdown"
```

---

### Task 3: Tái cấu trúc Bộ Tính toán Thống kê (Dashboard Aggregator & MECE Conservation)

**Files:**
- Modify: `src/lib/dashboard-aggregator.ts:1-60`
- Test: `tests/dashboard-aggregator-consistency.test.ts`

**Interfaces:**
- Consumes: `getSystemReferenceDate()`, `isTaskPastDue()` từ `src/lib/academic-calendar`
- Produces: `computeDashboardStats(tasks: SchoolTask[], referenceDate?: string): DashboardStats`, `computeSchoolTaskRollup(task: SchoolTask): SchoolTask`

- [ ] **Step 1: Viết test kiểm tra bảo toàn số học MECE và thứ tự ưu tiên phân loại**

Tạo tệp `tests/dashboard-aggregator-consistency.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { computeDashboardStats, computeSchoolTaskRollup } from "../src/lib/dashboard-aggregator";
import type { SchoolTask } from "../src/types/dashboard";

test("computeDashboardStats strictly adheres to MECE conservation law", () => {
  const refDate = "2026-09-09";
  const tasks: SchoolTask[] = [
    // 2 In progress on track
    { id: "1", title: "Task 1", category: "PLANNING", status: "IN_PROGRESS", dueDate: "2026-09-20", progressPercent: 50, totalSubTasks: 0, completedSubTasks: 0 },
    { id: "2", title: "Task 2", category: "PLANNING", status: "IN_PROGRESS", dueDate: "2026-09-25", progressPercent: 40, totalSubTasks: 0, completedSubTasks: 0 },
    // 1 Not started
    { id: "3", title: "Task 3", category: "PLANNING", status: "NOT_STARTED", dueDate: "2026-09-30", progressPercent: 0, totalSubTasks: 0, completedSubTasks: 0 },
    // 1 Waiting approval past due (MUST NOT BE STOLEN BY OVERDUE)
    { id: "4", title: "Task 4", category: "PLANNING", status: "WAITING_APPROVAL", dueDate: "2026-09-05", progressPercent: 100, totalSubTasks: 0, completedSubTasks: 0 },
    // 1 Overdue (not waiting approval)
    { id: "5", title: "Task 5", category: "PLANNING", status: "IN_PROGRESS", dueDate: "2026-09-01", progressPercent: 30, totalSubTasks: 0, completedSubTasks: 0 },
    // 1 Completed
    { id: "6", title: "Task 6", category: "PLANNING", status: "COMPLETED", dueDate: "2026-09-05", progressPercent: 100, totalSubTasks: 0, completedSubTasks: 0 },
  ];

  const stats = computeDashboardStats(tasks, refDate);
  assert.equal(stats.totalSchoolTasks, 6);
  assert.equal(stats.schoolTasksInProgress, 2);
  assert.equal(stats.schoolTasksNotStarted, 1);
  assert.equal(stats.schoolTasksWaitingApproval, 1);
  assert.equal(stats.schoolTasksOverdue, 1);
  assert.equal(stats.schoolTasksCompleted, 1);

  // Sum of parts strictly equals total
  const sumParts =
    stats.schoolTasksInProgress +
    stats.schoolTasksNotStarted! +
    stats.schoolTasksWaitingApproval! +
    stats.schoolTasksOverdue! +
    stats.schoolTasksCompleted;
  assert.equal(sumParts, 6);

  // Completion rate is 1/6 = 17%
  assert.equal(stats.completionRate, 17);
});

test("computeSchoolTaskRollup preserves manual progressPercent when subtasks are empty", () => {
  const manualTask: SchoolTask = {
    id: "m1",
    title: "Manual Progress",
    category: "ADMINISTRATION",
    status: "IN_PROGRESS",
    dueDate: "2026-09-20",
    progressPercent: 65,
    totalSubTasks: 0,
    completedSubTasks: 0,
    subTasks: [],
  };

  const rolled = computeSchoolTaskRollup(manualTask);
  assert.equal(rolled.progressPercent, 65);
});
```

- [ ] **Step 2: Chạy test để xác nhận lỗi phân loại hiện tại**

Run: `npx tsx --test tests/dashboard-aggregator-consistency.test.ts`  
Expected: FAIL với tổng bộ đếm không khớp hoặc reset tiến độ về 0.

- [ ] **Step 3: Cập nhật `src/lib/dashboard-aggregator.ts`**

Viết lại `src/lib/dashboard-aggregator.ts`:
```typescript
import type { SchoolTask, DashboardStats } from "@/types/dashboard";
import { getSystemReferenceDate, isTaskPastDue } from "@/lib/academic-calendar";

export function computeSchoolTaskRollup(task: SchoolTask): SchoolTask {
  const totalSubTasks = task.subTasks ? task.subTasks.length : 0;
  const completedSubTasks = totalSubTasks > 0
    ? task.subTasks.filter((st) => st.status === "COMPLETED").length
    : 0;

  const progressPercent = totalSubTasks > 0
    ? Math.round((completedSubTasks / totalSubTasks) * 100)
    : task.status === "COMPLETED"
      ? 100
      : (typeof task.progressPercent === "number" && !isNaN(task.progressPercent)
          ? task.progressPercent
          : 0);

  return {
    ...task,
    totalSubTasks,
    completedSubTasks,
    progressPercent,
  };
}

export function computeDashboardStats(
  tasks: SchoolTask[],
  referenceDate: string = getSystemReferenceDate()
): DashboardStats {
  const totalSchoolTasks = tasks.length;

  let schoolTasksCompleted = 0;
  let schoolTasksInProgress = 0;
  let schoolTasksNotStarted = 0;
  let schoolTasksWaitingApproval = 0;
  let schoolTasksOverdue = 0;
  let cancelledTasksCount = 0;

  let totalStaffTasks = 0;
  let staffTasksCompleted = 0;
  let staffTasksInProgress = 0;
  let staffTasksNotStarted = 0;
  let staffTasksWaitingApproval = 0;
  let staffTasksOverdue = 0;

  let totalProgress = 0;

  for (const t of tasks) {
    if ((t.status as string) === "CANCELLED") {
      cancelledTasksCount++;
      continue;
    }

    const rawProgress =
      typeof t.progressPercent === "number" && !isNaN(t.progressPercent)
        ? t.progressPercent
        : t.status === "COMPLETED"
        ? 100
        : 0;
    totalProgress += rawProgress;

    const isWaitingApproval =
      (t.status as string) === "WAITING_APPROVAL" ||
      t.status === "PENDING_EXECUTIVE_APPROVAL" ||
      (rawProgress === 100 && t.status !== "COMPLETED");

    const isOverdue =
      (t.status as string) === "OVERDUE" ||
      (t.status as string) === "BLOCKED" ||
      (t.status !== "COMPLETED" && isTaskPastDue(t.dueDate, referenceDate));

    if (t.status === "COMPLETED") {
      schoolTasksCompleted++;
    } else if (isWaitingApproval) {
      schoolTasksWaitingApproval++;
    } else if (isOverdue) {
      schoolTasksOverdue++;
    } else if ((t.status as string) === "NOT_STARTED") {
      schoolTasksNotStarted++;
    } else {
      schoolTasksInProgress++;
    }

    for (const sub of t.subTasks || []) {
      if ((sub.status as string) === "CANCELLED") continue;
      totalStaffTasks++;

      const isSubWaiting =
        sub.status === "NEEDS_REVIEW" ||
        (sub.status as string) === "WAITING_APPROVAL" ||
        sub.requiresReview === true;

      const isSubOverdue =
        (sub.status as string) === "OVERDUE" ||
        (sub.status as string) === "BLOCKED" ||
        (sub.status !== "COMPLETED" && isTaskPastDue(sub.dueDate, referenceDate));

      if (sub.status === "COMPLETED") {
        staffTasksCompleted++;
      } else if (isSubWaiting) {
        staffTasksWaitingApproval++;
      } else if (isSubOverdue) {
        staffTasksOverdue++;
      } else if ((sub.status as string) === "NOT_STARTED") {
        staffTasksNotStarted++;
      } else {
        staffTasksInProgress++;
      }
    }
  }

  const validSchoolTasks = totalSchoolTasks - cancelledTasksCount;
  const averageSchoolProgressPercent =
    validSchoolTasks > 0 ? Math.round(totalProgress / validSchoolTasks) : 0;
  const completionRate =
    validSchoolTasks > 0 ? Math.round((schoolTasksCompleted / validSchoolTasks) * 100) : 0;

  return {
    totalSchoolTasks,
    schoolTasksInProgress,
    schoolTasksCompleted,
    schoolTasksNotStarted,
    schoolTasksWaitingApproval,
    schoolTasksOverdue,
    totalStaffTasks,
    staffTasksInProgress,
    staffTasksCompleted,
    staffTasksNotStarted,
    staffTasksWaitingApproval,
    staffTasksOverdue,
    needsReviewTasksCount: schoolTasksWaitingApproval + staffTasksWaitingApproval,
    overdueTasksCount: schoolTasksOverdue + staffTasksOverdue,
    averageSchoolProgressPercent,
    completionRate,
    cancelledTasksCount,
    totalTasks: validSchoolTasks,
    inProgressTasks: schoolTasksInProgress,
    completedTasks: schoolTasksCompleted,
    overdueTasks: schoolTasksOverdue,
    pendingApprovals: schoolTasksWaitingApproval,
  };
}
```

- [ ] **Step 4: Chạy lại test để xác nhận bảo toàn MECE đạt 100%**

Run: `npx tsx --test tests/dashboard-aggregator-consistency.test.ts`  
Expected: PASS 2/2 tests.

- [ ] **Step 5: Commit task 3**

```bash
git add src/lib/dashboard-aggregator.ts tests/dashboard-aggregator-consistency.test.ts
git commit -m "fix(aggregator): rewrite computeDashboardStats to enforce MECE conservation and preserve manual progress"
```

---

### Task 4: Khớp nối Ma trận Điều hành & Trích xuất Danh sách Hành động BGH Động

**Files:**
- Modify: `src/lib/executive-matrix-aggregator.ts:180-370`
- Test: `tests/executive-action-items-extractor.test.ts`

**Interfaces:**
- Produces: `extractExecutiveActionItems(tasks: SchoolTask[], referenceDate?: string): ExecutiveActionItem[]`, updated `computeExecutiveActionStats`, updated `computeDepartmentHealthMatrix`.

- [ ] **Step 1: Viết test cho `extractExecutiveActionItems` và bộ đếm BGH**

Tạo tệp `tests/executive-action-items-extractor.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import {
  extractExecutiveActionItems,
  computeExecutiveActionStats,
} from "../src/lib/executive-matrix-aggregator";
import type { SchoolTask } from "../src/types/dashboard";

test("extractExecutiveActionItems extracts real tasks and prioritizes pending approvals", () => {
  const ref = "2026-09-09";
  const tasks: SchoolTask[] = [
    {
      id: "t1",
      title: "Phê duyệt kế hoạch kiểm định",
      category: "ACADEMIC",
      status: "WAITING_APPROVAL",
      dueDate: "2026-09-18",
      leadDepartment: "Khoa CNTT",
      leadDepartmentCode: "CNTT",
      progressPercent: 100,
      totalSubTasks: 0,
      completedSubTasks: 0,
    },
    {
      id: "t2",
      title: "Báo cáo chậm tiến độ",
      category: "ADMINISTRATION",
      status: "IN_PROGRESS",
      dueDate: "2026-09-01",
      leadDepartment: "Phòng QTTB",
      leadDepartmentCode: "QTTB",
      progressPercent: 30,
      totalSubTasks: 0,
      completedSubTasks: 0,
    },
  ];

  const items = extractExecutiveActionItems(tasks, ref);
  assert.equal(items.length, 2);
  assert.equal(items[0].filterType, "PENDING_APPROVAL");
  assert.equal(items[0].actionLabel, "Phê duyệt ngay");
  assert.equal(items[1].filterType, "BLOCKED_OVERDUE");
  assert.equal(items[1].actionLabel, "Đôn đốc");

  const stats = computeExecutiveActionStats(tasks, ref);
  assert.equal(stats.pendingSchoolApprovalCount, 1);
  assert.equal(stats.overdueTasksCount, 1);
});
```

- [ ] **Step 2: Chạy test để xác nhận failure (hàm chưa tồn tại)**

Run: `npx tsx --test tests/executive-action-items-extractor.test.ts`  
Expected: FAIL với lỗi `extractExecutiveActionItems is not a function`.

- [ ] **Step 3: Cập nhật `src/lib/executive-matrix-aggregator.ts`**

1. Cập nhật `computeExecutiveActionStats`: Kiểm tra `status === "WAITING_APPROVAL"`.
2. Sửa `computeDepartmentHealthMatrix`: Tính `completionRate` độc lập với `averageProgressPercent`, cộng dồn subtask progress.
3. Thêm hàm `extractExecutiveActionItems`:
```typescript
export function extractExecutiveActionItems(
  tasks: SchoolTask[],
  referenceDate: string = getSystemReferenceDate()
): ExecutiveActionItem[] {
  const items: ExecutiveActionItem[] = [];

  for (const t of tasks) {
    if ((t.status as string) === "CANCELLED") continue;

    const isWaiting =
      (t.status as string) === "WAITING_APPROVAL" ||
      t.status === "PENDING_EXECUTIVE_APPROVAL" ||
      (t.progressPercent === 100 && t.status !== "COMPLETED") ||
      (t.subTasks || []).some((s) => s.status === "NEEDS_REVIEW" || s.requiresReview);

    const isOverdue =
      (t.status as string) === "OVERDUE" ||
      (t.status as string) === "BLOCKED" ||
      (t.status !== "COMPLETED" && isTaskPastDue(t.dueDate, referenceDate));

    if (isWaiting) {
      items.push({
        id: `act-wait-${t.id}`,
        taskId: t.id,
        title: t.title,
        departmentName: t.leadDepartment || "QCET",
        departmentCode: t.leadDepartmentCode || "BGH",
        leadName: t.leadAssigneeName || "Chưa phân công",
        leadAvatar: t.leadAssigneeAvatar,
        dueDate: t.dueDate,
        filterType: "PENDING_APPROVAL",
        badgeLabel: "Chờ phê duyệt",
        badgeVariant: "warning",
        actionType: "APPROVE",
        actionLabel: "Phê duyệt ngay",
      });
    } else if (isOverdue) {
      items.push({
        id: `act-overdue-${t.id}`,
        taskId: t.id,
        title: t.title,
        departmentName: t.leadDepartment || "QCET",
        departmentCode: t.leadDepartmentCode || "BGH",
        leadName: t.leadAssigneeName || "Chưa phân công",
        leadAvatar: t.leadAssigneeAvatar,
        dueDate: t.dueDate,
        filterType: "BLOCKED_OVERDUE",
        badgeLabel: "Trễ h���n tiến độ",
        badgeVariant: "rose",
        actionType: "URGE",
        actionLabel: "Đôn đốc",
      });
    } else if (t.status === "IN_PROGRESS") {
      items.push({
        id: `act-strat-${t.id}`,
        taskId: t.id,
        title: t.title,
        departmentName: t.leadDepartment || "QCET",
        departmentCode: t.leadDepartmentCode || "BGH",
        leadName: t.leadAssigneeName || "Chưa phân công",
        leadAvatar: t.leadAssigneeAvatar,
        dueDate: t.dueDate,
        filterType: "STRATEGIC",
        badgeLabel: "Nhiệm vụ trọng tâm",
        badgeVariant: "default",
        actionType: "MONITOR",
        actionLabel: "Theo dõi",
      });
    }
  }

  return items.sort((a, b) => {
    const weights: Record<string, number> = {
      PENDING_APPROVAL: 0,
      BLOCKED_OVERDUE: 1,
      STRATEGIC: 2,
    };
    return (weights[a.filterType] ?? 9) - (weights[b.filterType] ?? 9);
  });
}
```

- [ ] **Step 4: Chạy lại test xác nhận đạt**

Run: `npx tsx --test tests/executive-action-items-extractor.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit task 4**

```bash
git add src/lib/executive-matrix-aggregator.ts tests/executive-action-items-extractor.test.ts
git commit -m "feat(executive): implement extractExecutiveActionItems and fix department progress aggregation"
```

---

### Task 5: Đồng bộ Tầng Server Service & Tích hợp Nhiệm vụ Đơn vị Độc lập

**Files:**
- Modify: `src/lib/server/dashboard-service.ts:1-180`
- Test: `tests/dashboard-service-sync.test.ts`

**Interfaces:**
- Consumes: `getSystemReferenceDate()`
- Produces: `getLiveDashboardData()` trả về dữ liệu có cả nhiệm vụ Trường và Đơn vị, loại trừ `CANCELLED`.

- [ ] **Step 1: Viết test cho `getLiveDashboardData`**

Tạo tệp `tests/dashboard-service-sync.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { getLiveDashboardData } from "../src/lib/server/dashboard-service";

test("getLiveDashboardData returns valid structure with zero NaN", async () => {
  const data = await getLiveDashboardData();
  assert.ok(data.stats.totalSchoolTasks > 0);
  assert.ok(!isNaN(data.stats.averageSchoolProgressPercent));
  assert.ok(!isNaN(data.stats.completionRate ?? 0));
  assert.ok(Array.isArray(data.departmentHealth));
  for (const dept of data.departmentHealth) {
    assert.ok(!isNaN(dept.averageProgressPercent));
  }
});
```

- [ ] **Step 2: Chạy test hiện tại để kiểm tra tính đúng đắn**

Run: `npx tsx --test tests/dashboard-service-sync.test.ts`  
Expected: Có thể PASS hoặc xuất hiện warning về kiểu dữ liệu ép `as any`.

- [ ] **Step 3: Cập nhật `src/lib/server/dashboard-service.ts`**

1. Nhập `getSystemReferenceDate` và `isTaskPastDue` từ `@/lib/academic-calendar`.
2. Thay thế `"2026-09-07"`, `"2026-09-09"`, `new Date()` bằng `getSystemReferenceDate()`.
3. Bỏ ép kiểu `as any` tại `status: t.status`.
4. Tính `averageProgressPercent` cho từng phòng ban từ `progressPercent` của các task thuộc phòng ban đó.

- [ ] **Step 4: Chạy lại test xác nhận**

Run: `npx tsx --test tests/dashboard-service-sync.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit task 5**

```bash
git add src/lib/server/dashboard-service.ts tests/dashboard-service-sync.test.ts
git commit -m "fix(service): unify reference date and calculate departmental average progress accurately"
```

---

### Task 6: Tinh chỉnh Bộ lọc Kỳ học Tránh Rò rỉ Toàn trường vào Tháng 9

**Files:**
- Modify: `src/lib/academic-calendar.ts:290-360`
- Test: `tests/academic-month-strict-filter.test.ts`

**Interfaces:**
- Produces: `filterTasksByAcademicMonthStrict(tasks, month, academicYear)`

- [ ] **Step 1: Viết test kiểm tra ưu tiên cột `academicMonth`**

Tạo tệp `tests/academic-month-strict-filter.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { filterTasksByAcademicMonthStrict } from "../src/lib/academic-calendar";
import type { SchoolTask } from "../src/types/dashboard";

test("filterTasksByAcademicMonthStrict prioritizes academicMonth property", () => {
  const tasks: SchoolTask[] = [
    { id: "1", title: "Month 9 Task", category: "PLANNING", status: "IN_PROGRESS", dueDate: "2026-09-20", academicMonth: 9, progressPercent: 50, totalSubTasks: 0, completedSubTasks: 0 },
    { id: "2", title: "Month 12 Task with early seed date", category: "PLANNING", status: "IN_PROGRESS", dueDate: "2026-12-20", academicMonth: 12, startDate: "2026-09-07", progressPercent: 20, totalSubTasks: 0, completedSubTasks: 0 },
  ];

  const month9 = filterTasksByAcademicMonthStrict(tasks, 9, "2026-2027");
  assert.equal(month9.length, 1);
  assert.equal(month9[0].id, "1");

  const month12 = filterTasksByAcademicMonthStrict(tasks, 12, "2026-2027");
  assert.equal(month12.length, 1);
  assert.equal(month12[0].id, "2");
});
```

- [ ] **Step 2: Chạy test để xác nhận failure (do spanInPeriod gom nhầm task Tháng 12 vào Tháng 9)**

Run: `npx tsx --test tests/academic-month-strict-filter.test.ts`  
Expected: FAIL vì task Tháng 12 bị gom vào Tháng 9.

- [ ] **Step 3: Cập nhật `filterTasksByAcademicMonthStrict` trong `src/lib/academic-calendar.ts`**

Cập nhật điều kiện lọc:
```typescript
export function filterTasksByAcademicMonthStrict<T extends { dueDate?: string | Date | null } = SchoolTask>(
  tasks: T[],
  month: number | "ALL",
  academicYear?: string
): T[] {
  if (month === "ALL") return tasks;
  const period = getAcademicMonthPeriod(month, academicYear);

  return tasks.reduce<T[]>((acc, task) => {
    // 1. Nếu có trường academicMonth tường minh, ưu tiên số 1
    if (typeof (task as any).academicMonth === "number") {
      if ((task as any).academicMonth === month) {
        acc.push(task);
      }
      return acc;
    }

    const taskDue = extractDateString(task.dueDate);
    const dueInPeriod = Boolean(taskDue && taskDue >= period.startDate && taskDue <= period.endDate);

    const rawSubTasks = (task as any).subTasks;
    const hasSubTasks = Array.isArray(rawSubTasks);
    const subDueInPeriod =
      hasSubTasks &&
      rawSubTasks.some((st: any) => {
        const stDue = extractDateString(st.dueDate);
        return stDue && stDue >= period.startDate && stDue <= period.endDate;
      });

    if (!dueInPeriod && !subDueInPeriod) return acc;

    if (hasSubTasks) {
      const prunedSubTasks = rawSubTasks.filter((st: any) => {
        const stDue = extractDateString(st.dueDate);
        if (!stDue) return dueInPeriod;
        return stDue >= period.startDate && stDue <= period.endDate;
      });
      acc.push({
        ...task,
        subTasks: prunedSubTasks,
        totalSubTasks: prunedSubTasks.length,
        completedSubTasks: prunedSubTasks.filter((st: any) => st.status === "COMPLETED").length,
      });
    } else {
      acc.push(task);
    }
    return acc;
  }, []);
}
```

- [ ] **Step 4: Chạy lại test xác nhận đạt chuẩn phân vùng**

Run: `npx tsx --test tests/academic-month-strict-filter.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit task 6**

```bash
git add src/lib/academic-calendar.ts tests/academic-month-strict-filter.test.ts
git commit -m "fix(calendar): prioritize explicit academicMonth property in monthly task filtering"
```

---

### Task 7: Loại bỏ Mock Data, Xây dựng Empty State & Kết nối Action Items Thực tế

**Files:**
- Modify: `src/components/dashboard/executive-action-center.tsx:1-250`
- Modify: `src/components/dashboard/zones/dashboard-zone.tsx:1-120`
- Modify: `src/hooks/use-task-filters.ts:200-260`
- Test: `tests/executive-action-center-ui.test.ts`

**Interfaces:**
- Consumes: `extractExecutiveActionItems` từ `src/lib/executive-matrix-aggregator`
- Produces: `ExecutiveActionCenter` hiển thị đúng việc thật hoặc khối Empty State *Verified Clear Horizon*.

- [ ] **Step 1: Viết test kiểm tra việc loại bỏ `DEFAULT_ACTION_ITEMS` và render Empty State**

Tạo tệp `tests/executive-action-center-ui.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("ExecutiveActionCenter contains zero hardcoded DEFAULT_ACTION_ITEMS", () => {
  const content = fs.readFileSync("src/components/dashboard/executive-action-center.tsx", "utf8");
  assert.equal(content.includes("DEFAULT_ACTION_ITEMS ="), false);
});
```

- [ ] **Step 2: Cập nhật `src/components/dashboard/executive-action-center.tsx`**

1. Xóa bỏ mảng `DEFAULT_ACTION_ITEMS`.
2. Khi `displayItems.length === 0`, hiển thị khối **Verified Clear Horizon** sử dụng `ShieldCheck` của Lucide.
3. Hỗ trợ prop `onAction(actionType: string, item: ExecutiveActionItem)`.

- [ ] **Step 3: Cập nhật `src/hooks/use-task-filters.ts` và `dashboard-zone.tsx`**

1. Trong `src/hooks/use-task-filters.ts`, bổ sung:
```typescript
const executiveActionItems = React.useMemo(
  () => (isExecutive ? extractExecutiveActionItems(monthFilteredSchoolTasks, referenceDate) : []),
  [isExecutive, monthFilteredSchoolTasks, referenceDate]
);
```
2. Trong `src/components/dashboard/zones/dashboard-zone.tsx`, truyền:
```tsx
<ExecutiveActionCenter
  stats={executiveStats}
  items={executiveActionItems}
  activeFilter={executiveFilter}
  onFilterChange={setExecutiveFilter}
  onAction={(actionType, item) => {
    // Kích hoạt Modal phê duyệt hoặc gửi thông báo đôn đốc
  }}
/>
```

- [ ] **Step 4: Chạy test xác nhận**

Run: `npx tsx --test tests/executive-action-center-ui.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit task 7**

```bash
git add src/components/dashboard/executive-action-center.tsx src/components/dashboard/zones/dashboard-zone.tsx src/hooks/use-task-filters.ts tests/executive-action-center-ui.test.ts
git commit -m "feat(action-center): eradicate DEFAULT_ACTION_ITEMS and wire real dynamic action items with confident empty state"
```

---

### Task 8: Tinh chỉnh Công thái học Dải Thống kê Lãnh đạo (Executive Stat Strip)

**Files:**
- Modify: `src/components/dashboard/executive-stat-strip.tsx:1-150`
- Test: `tests/executive-stat-strip-labels.test.ts`

**Interfaces:**
- Consumes: `DashboardStats` từ `useDashboardData()`
- Produces: 4 thẻ KPI rõ ràng, tiêu đề chuẩn "Tiến độ trung bình toàn trường", subtext MECE.

- [ ] **Step 1: Viết test cho tiêu đề và subtext Thẻ 1 & Thẻ 4**

Tạo tệp `tests/executive-stat-strip-labels.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("executive-stat-strip displays accurate average progress title and transparent subtext", () => {
  const content = fs.readFileSync("src/components/dashboard/executive-stat-strip.tsx", "utf8");
  assert.ok(content.includes("Tiến độ trung bình toàn trường"));
});
```

- [ ] **Step 2: Chạy test kiểm tra trạng thái hiện tại**

Run: `npx tsx --test tests/executive-stat-strip-labels.test.ts`  
Expected: FAIL vì tiêu đề hiện tại đang là "Tỷ lệ hoàn thành toàn trường".

- [ ] **Step 3: Cập nhật `src/components/dashboard/executive-stat-strip.tsx`**

1. Đổi tiêu đề Thẻ 4 thành `"Tiến độ trung bình toàn trường"`.
2. Subtext Thẻ 4: `Hoàn tất ${formatNumber(stats.schoolTasksCompleted)}/${formatNumber(stats.totalSchoolTasks)} (${stats.completionRate ?? Math.round((stats.schoolTasksCompleted / (stats.totalSchoolTasks || 1)) * 100)}%)`.
3. Subtext Thẻ 1: `${stats.schoolTasksInProgress} đang làm · ${stats.schoolTasksNotStarted ?? 0} chưa làm · ${stats.schoolTasksCompleted} hoàn thành`.
4. Subtext Thẻ 3: `${stats.needsReviewTasksCount} cần duyệt · ${stats.overdueTasksCount} trễ hạn`.

- [ ] **Step 4: Chạy lại test xác nhận**

Run: `npx tsx --test tests/executive-stat-strip-labels.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit task 8**

```bash
git add src/components/dashboard/executive-stat-strip.tsx tests/executive-stat-strip-labels.test.ts
git commit -m "fix(ui): update executive stat strip card labels and transparent MECE subtext"
```

---

### Task 9: Kiểm soát Phân quyền RBAC & Chống Tự Duyệt (Segregation of Duties)

**Files:**
- Modify: `src/app/api/dashboard/overview/route.ts`
- Modify: `src/app/api/tasks/[id]/route.ts`
- Test: `tests/api-rbac-and-sod.test.ts`

**Interfaces:**
- Produces: API `/api/dashboard/overview` được bảo vệ bằng JWT session; API `/api/tasks/[id]` chặn tự duyệt và khóa quyền hoàn thành nhiệm vụ trường cho BGH.

- [ ] **Step 1: Viết test bảo đảm phân quyền và SoD**

Tạo tệp `tests/api-rbac-and-sod.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Task update API enforces BGH role for SCHOOL tasks completion", () => {
  const content = fs.readFileSync("src/app/api/tasks/[id]/route.ts", "utf8");
  assert.ok(content.includes("existingTask.scope === TaskScope.SCHOOL") || content.includes("existing.scope === TaskScope.SCHOOL"));
});
```

- [ ] **Step 2: Cập nhật `src/app/api/tasks/[id]/route.ts` và `/api/dashboard/overview/route.ts`**

1. Kiểm tra xác thực phiên qua `getSessionFromRequest(request)`.
2. Chặn `assigneeId === session.id` tự chuyển trạng thái `COMPLETED` trừ khi có bản ghi `dacumDelegation` hợp lệ.
3. Chỉ cho phép vai trò `ADMIN` hoặc `BAN_GIAM_HIEU` nghiệm thu nhiệm vụ `scope: TaskScope.SCHOOL`.

- [ ] **Step 3: Chạy test xác nhận đạt**

Run: `npx tsx --test tests/api-rbac-and-sod.test.ts`  
Expected: PASS.

- [ ] **Step 4: Commit task 9**

```bash
git add src/app/api/dashboard/overview/route.ts src/app/api/tasks/[id]/route.ts tests/api-rbac-and-sod.test.ts
git commit -m "security(rbac): enforce JWT session on overview and disallow assignee self-approval"
```

---

### Task 10: Kiểm thử Tổng thể Toàn diện (Full System Regression Suite)

**Files:**
- Test: Toàn bộ thư mục `tests/`

- [ ] **Step 1: Chạy Typecheck toàn dự án**

Run: `npm run typecheck`  
Expected: 0 lỗi (`tsc --noEmit` exit 0).

- [ ] **Step 2: Chạy toàn bộ test suite**

Run: `npm test`  
Expected: 100% test files PASS.

- [ ] **Step 3: Đối chiếu với 10 Test Cases trong Spec**

Xác thực:
- TC-01: Bảo toàn số học MECE $85 + 30 + 3 + 1 + 11 = 130$.
- TC-02: Thẻ 1 và Thẻ BGH 3 cùng khớp 85 nhiệm vụ đang làm.
- TC-03: Thẻ Chờ BGH phê duyệt hiển thị đúng nhiệm vụ thực tế, có nút [Phê duyệt ngay].
- TC-04: Không còn dấu vết `DEFAULT_ACTION_ITEMS`.
- TC-05: Thẻ 4 hiển thị "Tiến độ trung bình toàn trường: 44%" kèm "11/130 (8.5%)".

- [ ] **Step 4: Commit nghiệm thu hoàn tất**

```bash
git commit --allow-empty -m "chore(release): complete dashboard data consistency and aggregation sync"
```
