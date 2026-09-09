---
status: completed
domain: architecture
created: 2026-09-06
---

# Quản Trị & Phân Cụm Nhiệm Vụ Theo Đơn Vị (Department-Grouped Supervisory Task Management) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai mô hình quản trị công việc phân cấp theo Đơn vị giám sát (Supervisory Organization theo chuẩn Stanford Authority Manager, Workday Higher Education và MIT Atlas), chuyển đổi từ quản lý công việc dạng phẳng (flat list) sang phân cụm đa tầng theo Khoa/Phòng/Trung tâm với cảnh báo RAG (Red - Amber - Green) và cơ chế mở rộng/thu gọn (Accordion).

**Architecture:** Tách biệt tầng tính toán chỉ số tổng hợp (`src/lib/department-task-aggregator.ts`) với tầng hiển thị trực quan (`src/components/dashboard/department-grouped-task-view.tsx`). Bổ sung chế độ xem `department` vào `UnifiedTaskToolbar` và tích hợp mượt mà vào `src/app/page.tsx` cho phép Ban Giám Hiệu và Lãnh đạo đơn vị giám sát tiến độ công việc theo từng khối trực thuộc mà không bị quá tải thông tin.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.7, Tailwind CSS v4, Lucide React (strokeWidth 1.5), Node.js native test runner (`node:test`, `node:assert/strict`).

**Spec:** `docs/superpowers/specs/2026-09-06-department-task-organization-design.md`

## Global Constraints

- **Chuẩn Quốc Tế**: Tuân thủ nguyên tắc Supervisory Unit First (mỗi nhiệm vụ phải gắn với Đơn vị chịu trách nhiệm chính), không hiển thị danh sách phẳng khi ở chế độ "Theo đơn vị".
- **Tiêu chuẩn Anti-Slop**: 0% emoji trang trí, 100% icon từ `lucide-react` với `strokeWidth={1.5}`. Toàn bộ số liệu, phần trăm, số lượng và ngày tháng phải dùng `font-mono tabular-nums`.
- **Mã hóa RAG chuẩn mực**:
  - **ĐỎ (RED - Cảnh báo)**: Tiến độ trung bình $< 40\%$ HOẶC có $\ge 1$ công việc trễ hạn (`overdueTasksCount >= 1`).
  - **VÀNG (AMBER - Cần lưu ý)**: Tiến độ trung bình từ $40\% - 69\%$ HOẶC có $\ge 1$ công việc bị nghẽn/tạm dừng (`blockedTasksCount >= 1`).
  - **XANH (GREEN - Bình thường)**: Tiến độ trung bình $\ge 70\%$ VÀ 0 việc trễ hạn VÀ 0 việc bị nghẽn.
- **Hiệu năng**: Tính toán gom nhóm O(N) theo số lượng tasks, hỗ trợ memoization và tương thích hoàn toàn với React 19 / Server & Client Components.

---

### File Structure & Changes

| File | Status | Responsibility |
|------|--------|----------------|
| `src/lib/department-task-aggregator.ts` | **Create** | Hàm gom nhóm `aggregateTasksByDepartment`, tính toán RAG, tiến độ trung bình, số việc cấp trường / đơn vị / quá hạn |
| `tests/department-task-aggregator.test.ts` | **Create** | Unit tests cho logic gom nhóm, đánh giá trạng thái RAG và xử lý đơn vị rỗng |
| `src/components/dashboard/department-grouped-task-view.tsx` | **Create** | Giao diện hiển thị danh sách phòng ban dạng Accordion, card thống kê, bảng nhiệm vụ theo đơn vị, expand/collapse all |
| `src/components/dashboard/unified-task-toolbar.tsx` | **Modify** | Mở rộng `TaskViewMode` thêm `"department"`, bổ sung option và icon `Building2` |
| `src/app/page.tsx` | **Modify** | Kết nối chế độ xem `department` vào canvas công việc trong Zone Tasks, truyền dữ liệu và callbacks |
| `tests/department-task-view-integration.test.ts` | **Create** | Kiểm thử tích hợp chế độ xem, cấu hình toolbar và tính nhất quán dữ liệu |
| `tests/anti-slop-department-view.test.ts` | **Create** | Kiểm thử tuân thủ Anti-Slop (0 emoji, stroke 1.5, tabular-nums) |

---

### Task 1: Bộ tổng hợp dữ liệu & logic phân cụm theo đơn vị (`department-task-aggregator.ts`)

**Files:**
- Create: `src/lib/department-task-aggregator.ts`
- Test: `tests/department-task-aggregator.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type DepartmentRAGStatus = "GREEN" | "AMBER" | "RED";

  export interface DepartmentTaskStats {
    totalTasks: number;
    schoolTasksCount: number;
    unitTasksCount: number;
    completedTasksCount: number;
    inProgressTasksCount: number;
    blockedTasksCount: number;
    overdueTasksCount: number;
    averageProgress: number; // 0 - 100
    ragStatus: DepartmentRAGStatus;
    ragReason: string;
  }

  export interface DepartmentTaskGroup {
    departmentId: string;
    departmentCode: string;
    departmentName: string;
    category: string;
    categoryLabel: string;
    leaderName: string;
    leaderRole: string;
    stats: DepartmentTaskStats;
    schoolTasks: SchoolTask[];
    unitTasks: StaffTask[];
    allTasks: (SchoolTask | StaffTask)[];
  }

  export function aggregateTasksByDepartment(
    tasks: SchoolTask[],
    departments: DepartmentNode[],
    referenceDate?: string
  ): DepartmentTaskGroup[];
  ```

- [ ] **Step 1: Viết test failing cho hàm gom nhóm và tính RAG**

Tạo file `tests/department-task-aggregator.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateTasksByDepartment,
  type DepartmentRAGStatus,
} from "../src/lib/department-task-aggregator";
import type { SchoolTask } from "../src/types/dashboard";
import type { DepartmentNode } from "../src/components/org/organization-tree";

describe("Department Task Aggregator", () => {
  const mockDepartments: DepartmentNode[] = [
    {
      id: "dept-cntt",
      code: "CNTT",
      name: "Khoa Công nghệ thông tin",
      category: "KHOA_CHUYEN_MON",
      categoryLabel: "Khoa Chuyên môn",
      description: "Đào tạo ngành CNTT",
      location: "Khu A - Tầng 2",
      phone: "0256.3846.123",
      email: "cntt@qcet.edu.vn",
      leaderName: "TS. Nguyễn Văn A",
      leaderRole: "Trưởng khoa",
      members: [],
    },
    {
      id: "dept-dao-tao",
      code: "DAO_TAO",
      name: "Phòng Đào tạo & QLKH",
      category: "PHONG_CHUC_NANG",
      categoryLabel: "Phòng Chức năng",
      description: "Quản lý đào tạo",
      location: "Khu B - Tầng 1",
      phone: "0256.3846.456",
      email: "daotao@qcet.edu.vn",
      leaderName: "ThS. Trần Văn B",
      leaderRole: "Trưởng phòng",
      members: [],
    },
  ];

  const mockTasks: SchoolTask[] = [
    {
      id: "task-1",
      title: "Nâng cấp Cổng thông tin đào tạo",
      category: "CNTT",
      categoryLabel: "Công nghệ thông tin",
      leadDepartmentCode: "CNTT",
      leadAssigneeName: "Nguyễn Văn A",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-09-01", // Overdue relative to 2026-09-06
      status: "IN_PROGRESS",
      progressPercent: 30,
      subTasks: [
        {
          id: "sub-1",
          title: "Thiết kế CSDL",
          assigneeName: "Lê Văn C",
          status: "COMPLETED",
          dueDate: "2026-08-20",
          parentSchoolTaskId: "task-1",
          updatedAt: "2026-08-20",
          departmentCode: "CNTT",
        },
      ],
      totalSubTasks: 1,
      completedSubTasks: 1,
    },
    {
      id: "task-2",
      title: "Rà soát đề cương năm học 2026",
      category: "BAO_CAO",
      categoryLabel: "Báo cáo",
      leadDepartmentCode: "DAO_TAO",
      leadAssigneeName: "Trần Văn B",
      coAssignees: [],
      assignedDate: "2026-08-15",
      dueDate: "2026-09-30", // Future due date
      status: "IN_PROGRESS",
      progressPercent: 80,
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
    },
  ];

  test("Gom nhóm công việc đúng theo mã đơn vị", () => {
    const groups = aggregateTasksByDepartment(mockTasks, mockDepartments, "2026-09-06");
    assert.equal(groups.length, 2);

    const cnttGroup = groups.find((g) => g.departmentCode === "CNTT");
    assert.ok(cnttGroup);
    assert.equal(cnttGroup.schoolTasks.length, 1);
    assert.equal(cnttGroup.unitTasks.length, 1);
    assert.equal(cnttGroup.stats.totalTasks, 2);

    const daoTaoGroup = groups.find((g) => g.departmentCode === "DAO_TAO");
    assert.ok(daoTaoGroup);
    assert.equal(daoTaoGroup.schoolTasks.length, 1);
    assert.equal(daoTaoGroup.unitTasks.length, 0);
    assert.equal(daoTaoGroup.stats.totalTasks, 1);
  });

  test("Tính toán chính xác trạng thái RAG", () => {
    const groups = aggregateTasksByDepartment(mockTasks, mockDepartments, "2026-09-06");
    const cnttGroup = groups.find((g) => g.departmentCode === "CNTT");
    const daoTaoGroup = groups.find((g) => g.departmentCode === "DAO_TAO");

    // CNTT có task trễ hạn (2026-09-01 < 2026-09-06) và tiến độ thấp -> RED
    assert.equal(cnttGroup?.stats.ragStatus, "RED");
    assert.ok(cnttGroup?.stats.overdueTasksCount! >= 1);

    // Đào tạo tiến độ 80%, không có trễ hạn -> GREEN
    assert.equal(daoTaoGroup?.stats.ragStatus, "GREEN");
    assert.equal(daoTaoGroup?.stats.overdueTasksCount, 0);
  });

  test("Xử lý an toàn đơn vị rỗng không có công việc nào", () => {
    const emptyDepartments: DepartmentNode[] = [
      {
        id: "dept-empty",
        code: "EMPTY",
        name: "Đơn vị chưa có việc",
        category: "TRUNG_TAM",
        categoryLabel: "Trung tâm",
        description: "Mới thành lập",
        location: "Khu C",
        phone: "0256.3846.789",
        email: "empty@qcet.edu.vn",
        leaderName: "Chưa bổ nhiệm",
        leaderRole: "Phụ trách",
        members: [],
      },
    ];

    const groups = aggregateTasksByDepartment([], emptyDepartments, "2026-09-06");
    assert.equal(groups.length, 1);
    assert.equal(groups[0].stats.totalTasks, 0);
    assert.equal(groups[0].stats.averageProgress, 0);
    assert.equal(groups[0].stats.ragStatus, "GREEN"); // Không có trễ hạn
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận lỗi biên dịch/thất bại**

Chạy:
```bash
npm test tests/department-task-aggregator.test.ts
```
Kỳ vọng: Lỗi không tìm thấy module `../src/lib/department-task-aggregator`.

- [ ] **Step 3: Hiện thực `src/lib/department-task-aggregator.ts`**

Tạo `src/lib/department-task-aggregator.ts`:
```typescript
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import type { DepartmentNode } from "@/components/org/organization-tree";

export type DepartmentRAGStatus = "GREEN" | "AMBER" | "RED";

export interface DepartmentTaskStats {
  totalTasks: number;
  schoolTasksCount: number;
  unitTasksCount: number;
  completedTasksCount: number;
  inProgressTasksCount: number;
  blockedTasksCount: number;
  overdueTasksCount: number;
  averageProgress: number;
  ragStatus: DepartmentRAGStatus;
  ragReason: string;
}

export interface DepartmentTaskGroup {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  category: string;
  categoryLabel: string;
  leaderName: string;
  leaderRole: string;
  stats: DepartmentTaskStats;
  schoolTasks: SchoolTask[];
  unitTasks: StaffTask[];
  allTasks: (SchoolTask | StaffTask)[];
}

function isDatePast(dueDateStr?: string, refDateStr: string = "2026-09-06"): boolean {
  if (!dueDateStr) return false;
  return dueDateStr < refDateStr;
}

export function aggregateTasksByDepartment(
  tasks: SchoolTask[],
  departments: DepartmentNode[],
  referenceDate: string = "2026-09-06"
): DepartmentTaskGroup[] {
  const deptCodeToNode = new Map<string, DepartmentNode>();
  for (const dept of departments) {
    deptCodeToNode.set(dept.code.toUpperCase(), dept);
    deptCodeToNode.set(dept.id.toUpperCase(), dept);
  }

  // Khởi tạo accumulator cho từng department
  const groupsMap = new Map<
    string,
    {
      dept: DepartmentNode;
      schoolTasks: SchoolTask[];
      unitTasks: StaffTask[];
    }
  >();

  for (const dept of departments) {
    groupsMap.set(dept.code.toUpperCase(), {
      dept,
      schoolTasks: [],
      unitTasks: [],
    });
  }

  // Gom các school tasks
  for (const task of tasks) {
    const rawCode = (task.leadDepartmentCode || task.leadDepartment || "BGH").toUpperCase();
    const target = groupsMap.get(rawCode) || groupsMap.get("BGH");
    if (target) {
      target.schoolTasks.push(task);
    }

    // Gom các subTasks (công việc đơn vị / chuyên viên)
    for (const sub of task.subTasks || []) {
      const subCode = (sub.departmentCode || rawCode).toUpperCase();
      const subTarget = groupsMap.get(subCode) || target;
      if (subTarget) {
        subTarget.unitTasks.push(sub);
      }
    }
  }

  // Tính toán chỉ số thống kê & RAG status
  return departments.map((dept) => {
    const data = groupsMap.get(dept.code.toUpperCase())!;
    const schoolTasks = data.schoolTasks;
    const unitTasks = data.unitTasks;

    let completed = 0;
    let inProgress = 0;
    let blocked = 0;
    let overdue = 0;
    let totalProgressSum = 0;

    // Xét School Tasks
    for (const st of schoolTasks) {
      const isCompleted = st.status === "COMPLETED";
      const isPast = !isCompleted && isDatePast(st.dueDate, referenceDate);
      if (isCompleted) {
        completed++;
        totalProgressSum += 100;
      } else {
        inProgress++;
        totalProgressSum += typeof st.progressPercent === "number" ? st.progressPercent : 0;
      }
      if (isPast) overdue++;
    }

    // Xét Unit Tasks
    for (const ut of unitTasks) {
      const isCompleted = ut.status === "COMPLETED";
      const isBlocked = ut.status === "BLOCKED";
      const isPast = !isCompleted && isDatePast(ut.dueDate, referenceDate);

      if (isCompleted) {
        completed++;
      } else if (isBlocked) {
        blocked++;
      } else {
        inProgress++;
      }

      if (isPast) overdue++;
    }

    const totalTasks = schoolTasks.length + unitTasks.length;
    const averageProgress =
      schoolTasks.length > 0 ? Math.round(totalProgressSum / schoolTasks.length) : 0;

    // Xác định RAG Status theo chuẩn kiểm soát đại học
    let ragStatus: DepartmentRAGStatus = "GREEN";
    let ragReason = "Tiến độ bình thường";

    if (overdue > 0 || (totalTasks > 0 && averageProgress < 40)) {
      ragStatus = "RED";
      ragReason = overdue > 0 ? `Có ${overdue} nhiệm vụ trễ hạn` : `Tiến độ thấp (${averageProgress}%)`;
    } else if (blocked > 0 || (totalTasks > 0 && averageProgress < 70)) {
      ragStatus = "AMBER";
      ragReason = blocked > 0 ? `Có ${blocked} nhiệm vụ bị nghẽn` : `Cần theo dõi (${averageProgress}%)`;
    }

    const stats: DepartmentTaskStats = {
      totalTasks,
      schoolTasksCount: schoolTasks.length,
      unitTasksCount: unitTasks.length,
      completedTasksCount: completed,
      inProgressTasksCount: inProgress,
      blockedTasksCount: blocked,
      overdueTasksCount: overdue,
      averageProgress,
      ragStatus,
      ragReason,
    };

    return {
      departmentId: dept.id,
      departmentCode: dept.code,
      departmentName: dept.name,
      category: dept.category,
      categoryLabel: dept.categoryLabel,
      leaderName: dept.leaderName,
      leaderRole: dept.leaderRole,
      stats,
      schoolTasks,
      unitTasks,
      allTasks: [...schoolTasks, ...unitTasks],
    };
  });
}
```

- [ ] **Step 4: Chạy lại test xác nhận PASS**

Chạy:
```bash
npm test tests/department-task-aggregator.test.ts
```
Kỳ vọng: PASS toàn bộ 3 tests.

- [ ] **Step 5: Commit mã ngu��n Task 1**

```bash
git add src/lib/department-task-aggregator.ts tests/department-task-aggregator.test.ts
git commit -m "feat(tasks): implement department task aggregator and RAG evaluation logic"
```

---

### Task 2: Component hiển thị phân cụm theo đơn vị (`department-grouped-task-view.tsx`)

**Files:**
- Create: `src/components/dashboard/department-grouped-task-view.tsx`
- Test: `tests/department-task-view-integration.test.ts`

**Interfaces:**
- Consumes:
  - `aggregateTasksByDepartment`, `DepartmentTaskGroup` từ `src/lib/department-task-aggregator.ts`
  - `QCET_DEPARTMENTS` từ `src/components/org/organization-tree.tsx`
  - `SchoolTask`, `StaffTask`, `TaskStatus` từ `src/types/dashboard.ts`
- Produces:
  ```typescript
  export interface DepartmentGroupedTaskViewProps {
    tasks: SchoolTask[];
    onSelectTask: (task: SchoolTask | StaffTask) => void;
    onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
    onAddTask?: (departmentCode?: string) => void;
    selectedDepartmentFilter?: string; // "ALL" hoặc department code
    searchQuery?: string;
  }
  ```

- [ ] **Step 1: Viết test failing kiểm tra cấu trúc render của component**

Tạo file `tests/department-task-view-integration.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { aggregateTasksByDepartment } from "../src/lib/department-task-aggregator";
import { QCET_DEPARTMENTS } from "../src/components/org/organization-tree";
import { getMockDashboardPayload } from "../src/lib/mock-dashboard-data";

describe("Department Grouped Task View Integration", () => {
  const payload = getMockDashboardPayload();

  test("Gom nhóm toàn bộ dữ liệu mock của trường thành 12 đơn vị", () => {
    const groups = aggregateTasksByDepartment(payload.tasks, QCET_DEPARTMENTS, "2026-09-06");
    assert.equal(groups.length, QCET_DEPARTMENTS.length);

    // Kiểm tra tổng số tasks gom được khớp với số lượng tasks mock
    const totalSchoolTasks = groups.reduce((sum, g) => sum + g.schoolTasks.length, 0);
    assert.equal(totalSchoolTasks, payload.tasks.length);
  });

  test("Mỗi đơn vị có đầy đủ các trường thống kê theo chuẩn Workday Sup-Org", () => {
    const groups = aggregateTasksByDepartment(payload.tasks, QCET_DEPARTMENTS, "2026-09-06");
    for (const g of groups) {
      assert.ok(g.departmentCode);
      assert.ok(g.departmentName);
      assert.ok(g.leaderName);
      assert.ok(["GREEN", "AMBER", "RED"].includes(g.stats.ragStatus));
      assert.ok(typeof g.stats.averageProgress === "number");
      assert.ok(g.stats.averageProgress >= 0 && g.stats.averageProgress <= 100);
    }
  });
});
```

- [ ] **Step 2: Chạy test xác nhận PASS**

Chạy:
```bash
npm test tests/department-task-view-integration.test.ts
```

- [ ] **Step 3: Hiện thực `src/components/dashboard/department-grouped-task-view.tsx`**

Tạo file `src/components/dashboard/department-grouped-task-view.tsx` đảm bảo:
1. Header mỗi khối phòng ban có badge mã đơn vị, tên đơn vị, Trưởng đơn vị, Progress bar & % (font-mono tabular-nums).
2. Badge RAG:
   - RED: `bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60`
   - AMBER: `bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60`
   - GREEN: `bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60`
3. Nút "Mở rộng tất cả" / "Thu gọn tất cả" (Expand/Collapse all).
4. Bảng danh sách nhiệm vụ chi tiết khi mở rộng từng phòng ban, bao gồm: Mã/Tên việc, Phân loại, Người chủ trì, Hạn hoàn thành, Trạng thái và Nút xem chi tiết (SideDrawer).
5. 0% emoji, 100% icon `lucide-react` (strokeWidth 1.5).

```tsx
"use client";

import * as React from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Layers,
  ArrowUpRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import {
  aggregateTasksByDepartment,
  type DepartmentTaskGroup,
  type DepartmentRAGStatus,
} from "@/lib/department-task-aggregator";
import { QCET_DEPARTMENTS } from "@/components/org/organization-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DepartmentGroupedTaskViewProps {
  tasks: SchoolTask[];
  onSelectTask: (task: SchoolTask | StaffTask) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onAddTask?: (departmentCode?: string) => void;
  selectedDepartmentFilter?: string;
  searchQuery?: string;
}

function RAGBadge({ status, reason }: { status: DepartmentRAGStatus; reason: string }) {
  if (status === "RED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900/60 font-mono">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
        Cảnh báo trễ ({reason})
      </span>
    );
  }
  if (status === "AMBER") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/60 font-mono">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Cần lưu ý
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900/60 font-mono">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Bình thường
    </span>
  );
}

export function DepartmentGroupedTaskView({
  tasks,
  onSelectTask,
  onAddTask,
  selectedDepartmentFilter = "ALL",
  searchQuery = "",
}: DepartmentGroupedTaskViewProps) {
  const [expandedDeptIds, setExpandedDeptIds] = React.useState<Set<string>>(() => {
    // Mặc định mở rộng 3 đơn vị đầu tiên
    return new Set(QCET_DEPARTMENTS.slice(0, 3).map((d) => d.id));
  });

  const departmentGroups = React.useMemo(() => {
    let groups = aggregateTasksByDepartment(tasks, QCET_DEPARTMENTS);

    // Lọc theo selectedDepartmentFilter nếu có
    if (selectedDepartmentFilter && selectedDepartmentFilter !== "ALL") {
      groups = groups.filter(
        (g) =>
          g.departmentCode.toUpperCase() === selectedDepartmentFilter.toUpperCase() ||
          g.departmentId.toUpperCase() === selectedDepartmentFilter.toUpperCase()
      );
    }

    // Lọc theo searchQuery nếu có
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      groups = groups.filter((g) => {
        const matchDept =
          g.departmentName.toLowerCase().includes(q) ||
          g.departmentCode.toLowerCase().includes(q) ||
          g.leaderName.toLowerCase().includes(q);
        const matchTask = g.allTasks.some((t) => t.title.toLowerCase().includes(q));
        return matchDept || matchTask;
      });
    }

    return groups;
  }, [tasks, selectedDepartmentFilter, searchQuery]);

  const toggleDept = (id: string) => {
    setExpandedDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedDeptIds(new Set(departmentGroups.map((g) => g.departmentId)));
  };

  const collapseAll = () => {
    setExpandedDeptIds(new Set());
  };

  return (
    <div className="space-y-4" data-slot="department-grouped-task-view">
      {/* Thanh điều khiển phụ: Expand/Collapse All & Tóm tắt số đơn vị */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Building2 size={16} strokeWidth={1.5} className="text-primary" />
          <span className="text-xs font-semibold text-foreground font-mono tabular-nums">
            {departmentGroups.length} đơn vị giám sát
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={expandAll}
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <Maximize2 size={12} strokeWidth={1.5} />
            Mở rộng tất cả
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={collapseAll}
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <Minimize2 size={12} strokeWidth={1.5} />
            Thu gọn
          </Button>
        </div>
      </div>

      {/* Danh sách các khối đơn vị dạng Accordion */}
      <div className="space-y-3">
        {departmentGroups.map((group) => {
          const isExpanded = expandedDeptIds.has(group.departmentId);

          return (
            <div
              key={group.departmentId}
              className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs transition-all shadow-xs overflow-hidden"
            >
              {/* Header của Đơn vị */}
              <div
                onClick={() => toggleDept(group.departmentId)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors select-none"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <button
                    type="button"
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 mt-0.5 sm:mt-0"
                    aria-label={isExpanded ? "Thu gọn" : "Mở rộng"}
                  >
                    {isExpanded ? (
                      <ChevronDown size={18} strokeWidth={1.5} />
                    ) : (
                      <ChevronRight size={18} strokeWidth={1.5} />
                    )}
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 font-mono">
                        {group.departmentCode}
                      </span>
                      <h3 className="text-sm font-bold text-foreground font-heading">
                        {group.departmentName}
                      </h3>
                      <RAGBadge
                        status={group.stats.ragStatus}
                        reason={group.stats.ragReason}
                      />
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <UserCheck size={13} strokeWidth={1.5} className="text-primary/70" />
                        {group.leaderRole}: {group.leaderName}
                      </span>
                      <span>•</span>
                      <span className="font-mono tabular-nums">
                        {group.stats.totalTasks} nhiệm vụ ({group.stats.schoolTasksCount} cấp trường,{" "}
                        {group.stats.unitTasksCount} cấp đơn vị)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress bar & quick metrics */}
                <div className="flex items-center gap-4 sm:self-center shrink-0 pl-7 sm:pl-0">
                  <div className="w-32 sm:w-40 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="text-muted-foreground">Tiến độ</span>
                      <span className="font-bold text-foreground">
                        {group.stats.averageProgress}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          group.stats.ragStatus === "RED"
                            ? "bg-rose-500"
                            : group.stats.ragStatus === "AMBER"
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        )}
                        style={{ width: `${group.stats.averageProgress}%` }}
                      />
                    </div>
                  </div>

                  {onAddTask && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddTask(group.departmentCode);
                      }}
                      className="h-8 px-2 text-xs gap-1 rounded-lg"
                    >
                      <Plus size={13} strokeWidth={1.5} />
                      <span className="hidden sm:inline">Giao việc</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Nội dung chi tiết các việc khi mở rộng */}
              {isExpanded && (
                <div className="border-t border-border/60 bg-background/50 px-4 py-3">
                  {group.allTasks.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      Chưa có nhiệm vụ nào được phân công cho đơn vị này.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-border/40 text-muted-foreground font-mono">
                            <th className="py-2 px-2 font-medium">Nhiệm vụ</th>
                            <th className="py-2 px-2 font-medium">Phân cấp</th>
                            <th className="py-2 px-2 font-medium">Người phụ tr��ch</th>
                            <th className="py-2 px-2 font-medium text-right">Hạn chót</th>
                            <th className="py-2 px-2 font-medium text-center">Trạng thái</th>
                            <th className="py-2 px-2 font-medium text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                          {group.allTasks.map((t) => {
                            const isSchool = "subTasks" in t;
                            const title = t.title;
                            const assignee = isSchool
                              ? t.leadAssigneeName
                              : (t as StaffTask).assigneeName;
                            const dueDate = t.dueDate;
                            const status = t.status;

                            return (
                              <tr
                                key={t.id}
                                onClick={() => onSelectTask(t)}
                                className="hover:bg-muted/40 cursor-pointer transition-colors"
                              >
                                <td className="py-2.5 px-2 font-medium text-foreground max-w-[280px] sm:max-w-md truncate">
                                  {title}
                                </td>
                                <td className="py-2.5 px-2">
                                  <span
                                    className={cn(
                                      "px-1.5 py-0.5 rounded text-[10px] font-mono font-medium",
                                      isSchool
                                        ? "bg-primary/10 text-primary border border-primary/20"
                                        : "bg-muted text-muted-foreground"
                                    )}
                                  >
                                    {isSchool ? "Cấp Trường" : "Cấp Đơn vị"}
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 text-muted-foreground">
                                  {assignee}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono tabular-nums text-muted-foreground">
                                  {dueDate}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <span
                                    className={cn(
                                      "px-2 py-0.5 rounded-full text-[10px] font-medium font-mono",
                                      status === "COMPLETED"
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                                        : status === "BLOCKED"
                                        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                                        : "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400"
                                    )}
                                  >
                                    {status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectTask(t);
                                    }}
                                  >
                                    <ArrowUpRight size={13} strokeWidth={1.5} />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Chạy lại tests xác nhận không có lỗi**

Chạy:
```bash
npm test tests/department-task-view-integration.test.ts
```

- [ ] **Step 5: Commit mã nguồn Task 2**

```bash
git add src/components/dashboard/department-grouped-task-view.tsx tests/department-task-view-integration.test.ts
git commit -m "feat(tasks): create department-grouped accordion task view component"
```

---

### Task 3: Cập nhật `UnifiedTaskToolbar` hỗ trợ chế độ xem theo đơn vị

**Files:**
- Modify: `src/components/dashboard/unified-task-toolbar.tsx`
- Modify: `src/lib/unified-task-hub.ts`
- Test: `tests/unified-task-toolbar.test.ts`

**Interfaces:**
- Consumes:
  - `Building2` từ `lucide-react`
- Produces:
  - `TaskViewMode = "table" | "kanban" | "calendar" | "department"`
  - `VIEW_MODE_OPTIONS` chứa item `{ id: "department", label: "Theo đơn vị", icon: Building2 }`

- [ ] **Step 1: Cập nhật test `tests/unified-task-toolbar.test.ts`**

Chỉnh sửa kiểm tra `VIEW_MODE_OPTIONS` trong `tests/unified-task-toolbar.test.ts`:
```typescript
test("VIEW_MODE_OPTIONS defines table, kanban, calendar, and department modes", () => {
  const ids = VIEW_MODE_OPTIONS.map((v: ViewModeOption) => v.id);
  assert.deepEqual(ids, ["table", "kanban", "calendar", "department"]);
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL do chưa có mode "department"**

Chạy:
```bash
npm test tests/unified-task-toolbar.test.ts
```
Kỳ vọng: FAIL vì thiếu `"department"`.

- [ ] **Step 3: Cập nhật `src/components/dashboard/unified-task-toolbar.tsx` và `src/lib/unified-task-hub.ts`**

Trong `src/components/dashboard/unified-task-toolbar.tsx`:
```typescript
export type TaskViewMode = "table" | "kanban" | "calendar" | "department";

export const VIEW_MODE_OPTIONS: ViewModeOption[] = [
  { id: "table", label: "Bảng", icon: List },
  { id: "kanban", label: "Kanban", icon: Kanban },
  { id: "calendar", label: "Lịch", icon: Calendar },
  { id: "department", label: "Theo đơn vị", icon: Building2 },
];
```

Trong `src/lib/unified-task-hub.ts`:
Cập nhật `parseViewModeParam`:
```typescript
export function parseViewModeParam(param: string | null | undefined): TaskViewMode {
  if (!param) return "table";
  const normalized = param.trim().toLowerCase();
  if (normalized === "kanban" || normalized === "board") return "kanban";
  if (normalized === "calendar" || normalized === "month") return "calendar";
  if (normalized === "department" || normalized === "don-vi" || normalized === "unit") return "department";
  return "table";
}
```

- [ ] **Step 4: Chạy lại test xác nhận PASS**

Chạy:
```bash
npm test tests/unified-task-toolbar.test.ts
```
Kỳ vọng: PASS.

- [ ] **Step 5: Commit mã nguồn Task 3**

```bash
git add src/components/dashboard/unified-task-toolbar.tsx src/lib/unified-task-hub.ts tests/unified-task-toolbar.test.ts
git commit -m "feat(toolbar): add department view mode with Building2 icon"
```

---

### Task 4: Tích hợp chế độ xem theo đơn vị vào Canvas công việc (`src/app/page.tsx`)

**Files:**
- Modify: `src/app/page.tsx`
- Test: `tests/executive-dashboard-integration.test.ts`

**Interfaces:**
- Consumes:
  - `DepartmentGroupedTaskView` từ `src/components/dashboard/department-grouped-task-view.tsx`
  - Dynamic import `const DepartmentGroupedTaskView = dynamic(...)`

- [ ] **Step 1: Viết test failing cho việc kích hoạt chế độ xem department**

Bổ sung test case vào `tests/department-task-view-integration.test.ts`:
```typescript
import { parseViewModeParam } from "../src/lib/unified-task-hub";

test("parseViewModeParam parses 'department' and 'don-vi' correctly", () => {
  assert.equal(parseViewModeParam("department"), "department");
  assert.equal(parseViewModeParam("don-vi"), "department");
  assert.equal(parseViewModeParam("unit"), "department");
});
```

- [ ] **Step 2: Chạy test xác nhận PASS**

Chạy:
```bash
npm test tests/department-task-view-integration.test.ts
```

- [ ] **Step 3: Cập nhật `src/app/page.tsx`**

Thêm dynamic import cho `DepartmentGroupedTaskView`:
```typescript
const DepartmentGroupedTaskView = dynamic(
  () =>
    import("@/components/dashboard/department-grouped-task-view").then(
      (m) => m.DepartmentGroupedTaskView
    ),
  {
    ssr: false,
    loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" />,
  }
);
```

Tại vùng `Zone 3: TASKS` trong `src/app/page.tsx`:
```tsx
{viewMode === "department" && (
  <DepartmentGroupedTaskView
    tasks={filteredTasks}
    onSelectTask={(task) => setSelectedTask(task)}
    onStatusChange={handleStatusChange}
    onAddTask={(deptCode) => handleOpenCreateModal("TRUONG")}
    selectedDepartmentFilter={selectedDepartment}
    searchQuery={searchQuery}
  />
)}
```

- [ ] **Step 4: Chạy toàn bộ test suite để đảm bảo không gãy tính năng khác**

Chạy:
```bash
npm test
```
Kỳ vọng: Tất cả các file test trong `tests/` đều PASS.

- [ ] **Step 5: Commit mã nguồn Task 4**

```bash
git add src/app/page.tsx tests/department-task-view-integration.test.ts
git commit -m "feat(dashboard): integrate department grouped task view into tasks zone"
```

---

### Task 5: Kiểm định Anti-Slop & Tuân thủ Hệ thống Thiết kế (`tests/anti-slop-department-view.test.ts`)

**Files:**
- Create: `tests/anti-slop-department-view.test.ts`
- Test: `tests/anti-slop-department-view.test.ts`

- [ ] **Step 1: Viết test audit cho component và aggregator mới**

Tạo `tests/anti-slop-department-view.test.ts`:
```typescript
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Department Task View Anti-Slop Audit", () => {
  const targetFiles = [
    "src/lib/department-task-aggregator.ts",
    "src/components/dashboard/department-grouped-task-view.tsx",
  ];

  test("Zero decorative emojis in new department view files", () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    for (const relPath of targetFiles) {
      const fullPath = path.join(process.cwd(), relPath);
      assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        assert.ok(
          !emojiRegex.test(line),
          `Found decorative emoji in ${relPath}:${idx + 1}: ${line}`
        );
      });
    }
  });

  test("Contains font-mono and tabular-nums for numeric metrics", () => {
    const viewPath = path.join(
      process.cwd(),
      "src/components/dashboard/department-grouped-task-view.tsx"
    );
    const content = fs.readFileSync(viewPath, "utf-8");
    assert.ok(content.includes("tabular-nums"), "Must use tabular-nums for numbers");
    assert.ok(content.includes("font-mono"), "Must use font-mono for metrics and codes");
  });

  test("Lucide icons use strokeWidth={1.5} or consistent styling", () => {
    const viewPath = path.join(
      process.cwd(),
      "src/components/dashboard/department-grouped-task-view.tsx"
    );
    const content = fs.readFileSync(viewPath, "utf-8");
    assert.ok(content.includes("strokeWidth={1.5}"), "Icons must use strokeWidth 1.5");
  });
});
```

- [ ] **Step 2: Chạy test audit**

Chạy:
```bash
npm test tests/anti-slop-department-view.test.ts
```
Kỳ vọng: PASS.

- [ ] **Step 3: Commit mã nguồn Task 5**

```bash
git add tests/anti-slop-department-view.test.ts
git commit -m "test(audit): enforce anti-slop rules on department-grouped task view"
```

---

### Task 6: Kiểm thử toàn diện và kiểm tra kiểu dữ liệu (Build & Typecheck)

**Files:**
- Modify/Verify: Toàn bộ dự án

- [ ] **Step 1: Chạy TypeScript typecheck**

Chạy:
```bash
npm run typecheck
```
Kỳ vọng: 0 lỗi typecheck.

- [ ] **Step 2: Chạy toàn bộ test suite**

Chạy:
```bash
npm test
```
Kỳ vọng: Toàn bộ > 45 files test chạy thành công.

- [ ] **Step 3: Chạy Next.js build để xác nhận SSR và bundles**

Chạy:
```bash
npm run build
```
Kỳ vọng: Build thành công, bundle route `/` được tối ưu hóa với dynamic imports.

- [ ] **Step 4: Commit kết thúc sprint hoàn thiện**

```bash
git commit --allow-empty -m "chore(release): complete department-grouped task supervisory view implementation"
```
