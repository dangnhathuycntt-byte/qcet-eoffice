---
status: completed
domain: architecture
created: 2026-09-06
---

# Kế Hoạch Hiện Thực Hóa Quy Trình Quản Trị Phân Cấp, Phân Cụm Đơn Vị & Ủy Quyền Duyệt Việc (Supervisory Org & Delegation Workflow)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiện thực hóa quy trình điều hành phân cấp chuẩn đại học quốc tế (Stanford Authority Manager, Workday Higher Education & MIT Atlas), bao gồm: phân cụm nhiệm vụ theo Đơn vị giám sát (Supervisory Organization) với mã hóa RAG, và cơ chế Ủy quyền phê duyệt nhiệm vụ/minh chứng DACUM có thời hạn, phạm vi và kiểm toán vết duyệt.

**Architecture:** Tách bạch 3 lớp: (1) Lớp nghiệp vụ phân quyền & ủy quyền (`src/lib/delegation-authority-engine.ts`) kết hợp với bộ tổng hợp dữ liệu đơn vị (`src/lib/department-task-aggregator.ts`); (2) Lớp giao diện phân cụm Accordion (`src/components/dashboard/department-grouped-task-view.tsx`) và hộp thoại quản lý ủy quyền (`src/components/dashboard/delegation-management-modal.tsx`); (3) Lớp điều hướng và tích hợp trên Toolbar (`UnifiedTaskToolbar`) và Trang chủ (`src/app/page.tsx`).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5.7, Tailwind CSS v4, Lucide React (strokeWidth 1.5), Node.js native test runner (`node:test`, `node:assert/strict`).

**Spec:** `docs/superpowers/specs/2026-09-06-department-task-organization-design.md` và `docs/superpowers/specs/2026-09-06-world-class-eoffice-detailed-spec.md`.

## Global Constraints

- **Chuẩn Quốc Tế**: Tuân thủ nguyên tắc Supervisory Unit First (nhiệm vụ không bao giờ nằm phẳng; luôn thuộc về Đơn vị giám sát) và Stanford Scope-bound Delegation (ủy quyền có phạm vi, thời hạn, ngăn tự duyệt).
- **Tiêu chuẩn Anti-Slop**: 0% emoji trang trí, 100% icon từ `lucide-react` với `strokeWidth={1.5}`. Toàn bộ số liệu đo lường, phần trăm, số lượng, ngày tháng định dạng `font-mono tabular-nums`.
- **Mã hóa RAG chuẩn mực**:
  - **ĐỎ (RED)**: Tiến độ $< 40\%$ HOẶC có $\ge 1$ công việc trễ hạn (`overdueTasksCount >= 1`).
  - **VÀNG (AMBER)**: Tiến độ $40\% - 69\%$ HOẶC có $\ge 1$ việc nghẽn/tạm dừng (`blockedTasksCount >= 1`).
  - **XANH (GREEN)**: Tiến độ $\ge 70\%$ VÀ 0 việc trễ hạn VÀ 0 việc nghẽn.
- **Bảo mật & Trách nhiệm giải trình (Separation of Duties)**: Người phụ trách nhiệm vụ hoặc người nộp minh chứng tuyệt đối KHÔNG được tự phê duyệt (Self-Approval Prevention) kể cả khi nắm quyền ủy quyền. Mọi hành động duyệt qua ủy quyền phải ghi nhận vết kiểm toán (`delegatedAt`, `grantorId`, `granteeId`).

---

### Cấu Trúc Tệp Tin & Nhiệm Vụ (File Structure & Tasks)

| File | Hành động | Trách nhiệm |
|------|-----------|-------------|
| `src/types/delegation.ts` | **Create** | Định nghĩa interfaces: `DelegationScope`, `DelegationStatus`, `DelegationRule`, `ApprovalAuditLog` |
| `src/lib/delegation-authority-engine.ts` | **Create** | Động cơ kiểm tra quyền ủy quyền, ngăn tự duyệt, chuyển trạng thái duyệt có vết kiểm toán |
| `tests/delegation-authority-engine.test.ts` | **Create** | Unit tests cho engine ủy quyền (thời hạn, phạm vi, self-approval prevention, audit log) |
| `src/components/dashboard/department-grouped-task-view.tsx` | **Create** | Component hiển thị 12 đơn vị dạng Accordion, card thống kê, RAG badges, bảng nhiệm vụ chi tiết |
| `src/components/dashboard/delegation-management-modal.tsx` | **Create** | Modal quản lý ủy quyền cho Trưởng khoa/Trưởng phòng (tạo, xem, hủy ủy quyền theo chuẩn Stanford) |
| `src/components/dashboard/unified-task-toolbar.tsx` | **Modify** | Mở rộng `TaskViewMode` thêm `"department"`, bổ sung option và icon `Building2` |
| `src/lib/unified-task-hub.ts` | **Modify** | Parse param URL chế độ xem `department`, `don-vi`, `unit` |
| `src/app/page.tsx` | **Modify** | Kết nối `DepartmentGroupedTaskView` và `DelegationManagementModal` vào Zone Tasks |
| `tests/department-task-view-integration.test.ts` | **Create** | Kiểm thử tích hợp phân cụm và kết nối dữ liệu 12 đơn vị |
| `tests/anti-slop-delegation-workflow.test.ts` | **Create** | Kiểm thử kiểm định 0 emoji, strokeWidth 1.5, tabular-nums |

---

### Task 1: Định nghĩa kiểu dữ liệu & Động cơ Ủy quyền (`src/types/delegation.ts` & `src/lib/delegation-authority-engine.ts`)

**Files:**
- Create: `src/types/delegation.ts`
- Create: `src/lib/delegation-authority-engine.ts`
- Test: `tests/delegation-authority-engine.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type DelegationScope =
    | "DACUM_REVIEW_STEP1"
    | "TASK_ASSIGNMENT"
    | "FULL_DEPARTMENT_APPROVAL";

  export type DelegationStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

  export interface DelegationRule {
    id: string;
    grantorId: string;
    grantorName: string;
    grantorRole: "ADMIN" | "MANAGER";
    granteeId: string;
    granteeName: string;
    granteeRole: "MANAGER" | "STAFF";
    departmentCode: string;
    scope: DelegationScope;
    startDate: string; // ISO or YYYY-MM-DD
    endDate: string;   // ISO or YYYY-MM-DD
    status: DelegationStatus;
    reason: string;
    createdAt: string;
  }

  export interface ApprovalAuditLog {
    taskId: string;
    action: "APPROVE_DACUM_STEP1" | "REJECT_DACUM_STEP1" | "APPROVE_SCHOOL_TASK";
    performedByUserId: string;
    performedByUserName: string;
    performedByUserRole: string;
    isDelegated: boolean;
    delegatedByGrantorId?: string;
    delegatedByGrantorName?: string;
    timestamp: string;
    notes?: string;
  }

  export function isDelegationActive(rule: DelegationRule, referenceDate?: string): boolean;
  export function canReviewDeliverable(
    actor: { id: string; role: string; departmentCode: string },
    task: { id: string; assigneeId?: string; assigneeName?: string; departmentCode: string },
    activeDelegations: DelegationRule[],
    referenceDate?: string
  ): { allowed: boolean; reason?: string; isDelegated?: boolean; rule?: DelegationRule };
  ```

- [ ] **Step 1: Viết test failing cho Động cơ Ủy quyền**

Tạo `tests/delegation-authority-engine.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isDelegationActive,
  canReviewDeliverable,
  recordDelegatedApproval,
} from "../src/lib/delegation-authority-engine";
import type { DelegationRule } from "../src/types/delegation";

describe("Delegation Authority Engine (Stanford Authority Manager Pattern)", () => {
  const mockDelegation: DelegationRule = {
    id: "del-001",
    grantorId: "user-truong-khoa",
    grantorName: "TS. Nguyễn Văn A",
    grantorRole: "MANAGER",
    granteeId: "user-pho-khoa",
    granteeName: "ThS. Trần Văn B",
    granteeRole: "STAFF",
    departmentCode: "CNTT",
    scope: "DACUM_REVIEW_STEP1",
    startDate: "2026-09-01",
    endDate: "2026-09-10",
    status: "ACTIVE",
    reason: "Trưởng khoa đi công tác nước ngoài, ủy quyền phê duyệt minh chứng DACUM",
    createdAt: "2026-09-01T08:00:00Z",
  };

  test("Kiểm tra thời hạn ủy quyền (Active trong hạn, Expired khi quá hạn)", () => {
    assert.equal(isDelegationActive(mockDelegation, "2026-09-05"), true);
    assert.equal(isDelegationActive(mockDelegation, "2026-09-11"), false);
    assert.equal(isDelegationActive({ ...mockDelegation, status: "REVOKED" }, "2026-09-05"), false);
  });

  test("Người được ủy quyền có quyền duyệt thay Trưởng khoa khi còn hạn", () => {
    const actor = { id: "user-pho-khoa", role: "STAFF", departmentCode: "CNTT" };
    const task = { id: "task-101", assigneeId: "user-giang-vien", departmentCode: "CNTT" };

    const result = canReviewDeliverable(actor, task, [mockDelegation], "2026-09-06");
    assert.equal(result.allowed, true);
    assert.equal(result.isDelegated, true);
    assert.equal(result.rule?.id, "del-001");
  });

  test("Ngăn chặn tự phê duyệt (Self-Approval Prevention): Nhân viên không được tự duyệt việc của chính mình", () => {
    // Pho khoa duoc uy quyen nhung la nguoi truc tiep thuc hien task nay -> Cam tu duyet
    const actor = { id: "user-pho-khoa", role: "STAFF", departmentCode: "CNTT" };
    const task = { id: "task-102", assigneeId: "user-pho-khoa", departmentCode: "CNTT" };

    const result = canReviewDeliverable(actor, task, [mockDelegation], "2026-09-06");
    assert.equal(result.allowed, false);
    assert.match(result.reason || "", /tự phê duyệt/);
  });

  test("Người không được ủy quyền hoặc khác phòng ban bị từ chối", () => {
    const actorDiffDept = { id: "user-phong-khac", role: "STAFF", departmentCode: "DAO_TAO" };
    const task = { id: "task-101", assigneeId: "user-giang-vien", departmentCode: "CNTT" };

    const result = canReviewDeliverable(actorDiffDept, task, [mockDelegation], "2026-09-06");
    assert.equal(result.allowed, false);
  });

  test("Ghi nhận vết duyệt ủy quyền vào Audit Log", () => {
    const audit = recordDelegatedApproval({
      taskId: "task-101",
      action: "APPROVE_DACUM_STEP1",
      actor: { id: "user-pho-khoa", name: "ThS. Trần Văn B", role: "STAFF" },
      rule: mockDelegation,
      timestamp: "2026-09-06T10:00:00Z",
    });

    assert.equal(audit.isDelegated, true);
    assert.equal(audit.delegatedByGrantorId, "user-truong-khoa");
    assert.equal(audit.performedByUserId, "user-pho-khoa");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test fails**

Chạy:
```bash
npx tsx --test tests/delegation-authority-engine.test.ts
```
Kỳ vọng: FAIL vì chưa có file `src/types/delegation.ts` và `src/lib/delegation-authority-engine.ts`.

- [ ] **Step 3: Hiện thực `src/types/delegation.ts` và `src/lib/delegation-authority-engine.ts`**

Tạo `src/types/delegation.ts`:
```typescript
export type DelegationScope =
  | "DACUM_REVIEW_STEP1"
  | "TASK_ASSIGNMENT"
  | "FULL_DEPARTMENT_APPROVAL";

export type DelegationStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

export interface DelegationRule {
  id: string;
  grantorId: string;
  grantorName: string;
  grantorRole: "ADMIN" | "MANAGER";
  granteeId: string;
  granteeName: string;
  granteeRole: "MANAGER" | "STAFF";
  departmentCode: string;
  scope: DelegationScope;
  startDate: string;
  endDate: string;
  status: DelegationStatus;
  reason: string;
  createdAt: string;
}

export interface ApprovalAuditLog {
  taskId: string;
  action: "APPROVE_DACUM_STEP1" | "REJECT_DACUM_STEP1" | "APPROVE_SCHOOL_TASK";
  performedByUserId: string;
  performedByUserName: string;
  performedByUserRole: string;
  isDelegated: boolean;
  delegatedByGrantorId?: string;
  delegatedByGrantorName?: string;
  timestamp: string;
  notes?: string;
}
```

Tạo `src/lib/delegation-authority-engine.ts`:
```typescript
import type { DelegationRule, ApprovalAuditLog } from "@/types/delegation";

export function isDelegationActive(
  rule: DelegationRule,
  referenceDate: string = "2026-09-06"
): boolean {
  if (rule.status !== "ACTIVE") return false;
  const ref = referenceDate.slice(0, 10);
  const start = rule.startDate.slice(0, 10);
  const end = rule.endDate.slice(0, 10);
  return ref >= start && ref <= end;
}

export function canReviewDeliverable(
  actor: { id: string; role: string; departmentCode: string },
  task: { id: string; assigneeId?: string; assigneeName?: string; departmentCode: string },
  activeDelegations: DelegationRule[] = [],
  referenceDate: string = "2026-09-06"
): {
  allowed: boolean;
  reason?: string;
  isDelegated?: boolean;
  rule?: DelegationRule;
} {
  // Quy tắc cốt lõi: Ngăn chặn tự phê duyệt (Self-Approval Prevention)
  if (task.assigneeId && actor.id === task.assigneeId) {
    return {
      allowed: false,
      reason: "Theo quy định quản trị và phân lập nhiệm vụ (Separation of Duties), người thực hiện không được tự phê duyệt công việc của mình.",
    };
  }

  // Ban Giám Hiệu / Quản trị viên luôn có quyền duyệt tối cao
  if (actor.role === "ADMIN") {
    return { allowed: true, isDelegated: false };
  }

  // Trưởng đơn vị quản trị đúng phòng ban
  if (actor.role === "MANAGER" && actor.departmentCode === task.departmentCode) {
    return { allowed: true, isDelegated: false };
  }

  // Kiểm tra ủy quyền hợp lệ theo chuẩn Stanford Authority Manager
  const matchingRule = activeDelegations.find(
    (d) =>
      d.granteeId === actor.id &&
      d.departmentCode === task.departmentCode &&
      (d.scope === "DACUM_REVIEW_STEP1" || d.scope === "FULL_DEPARTMENT_APPROVAL") &&
      isDelegationActive(d, referenceDate)
  );

  if (matchingRule) {
    return {
      allowed: true,
      isDelegated: true,
      rule: matchingRule,
    };
  }

  return {
    allowed: false,
    reason: "Bạn không có quyền phê duyệt công việc này hoặc thời gian ủy quyền đã hết hiệu lực.",
  };
}

export function recordDelegatedApproval(params: {
  taskId: string;
  action: "APPROVE_DACUM_STEP1" | "REJECT_DACUM_STEP1" | "APPROVE_SCHOOL_TASK";
  actor: { id: string; name: string; role: string };
  rule?: DelegationRule;
  timestamp?: string;
  notes?: string;
}): ApprovalAuditLog {
  const { taskId, action, actor, rule, timestamp = new Date().toISOString(), notes } = params;

  return {
    taskId,
    action,
    performedByUserId: actor.id,
    performedByUserName: actor.name,
    performedByUserRole: actor.role,
    isDelegated: Boolean(rule),
    delegatedByGrantorId: rule?.grantorId,
    delegatedByGrantorName: rule?.grantorName,
    timestamp,
    notes,
  };
}
```

- [ ] **Step 4: Chạy test xác nhận PASS**

Chạy:
```bash
npx tsx --test tests/delegation-authority-engine.test.ts
```
Kỳ vọng: PASS toàn bộ 5 tests.

- [ ] **Step 5: Commit mã nguồn Task 1**

```bash
git add src/types/delegation.ts src/lib/delegation-authority-engine.ts tests/delegation-authority-engine.test.ts
git commit -m "feat(auth): implement delegation authority engine with self-approval prevention"
```

---

### Task 2: Component hiển thị phân cụm theo Đơn vị (`DepartmentGroupedTaskView`)

**Files:**
- Create: `src/components/dashboard/department-grouped-task-view.tsx`
- Test: `tests/department-task-view-integration.test.ts`

**Interfaces:**
- Consumes:
  - `aggregateTasksByDepartment`, `DepartmentTaskGroup` từ `src/lib/department-task-aggregator.ts`
  - `QCET_DEPARTMENTS` từ `src/components/org/organization-tree.tsx`
  - `SchoolTask`, `StaffTask`, `TaskStatus` từ `src/types/dashboard.ts`
- Produces:
  - `DepartmentGroupedTaskViewProps` và React component `DepartmentGroupedTaskView`

- [ ] **Step 1: Viết test failing cho tích hợp phân cụm**

Tạo `tests/department-task-view-integration.test.ts`:
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
npx tsx --test tests/department-task-view-integration.test.ts
```

- [ ] **Step 3: Hiện thực `src/components/dashboard/department-grouped-task-view.tsx`**

Tạo `src/components/dashboard/department-grouped-task-view.tsx` (chi tiết code hoàn chỉnh không placeholder):
```tsx
"use client";

import * as React from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Plus,
  ArrowUpRight,
  Maximize2,
  Minimize2,
  ShieldAlert,
  CalendarDays,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import {
  aggregateTasksByDepartment,
  type DepartmentTaskGroup,
  type DepartmentRAGStatus,
} from "@/lib/department-task-aggregator";
import { QCET_DEPARTMENTS } from "@/components/org/organization-tree";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DepartmentGroupedTaskViewProps {
  tasks: SchoolTask[];
  onSelectTask: (task: SchoolTask | StaffTask) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onAddTask?: (departmentCode?: string) => void;
  onManageDelegation?: (departmentCode: string) => void;
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
  onManageDelegation,
  selectedDepartmentFilter = "ALL",
  searchQuery = "",
}: DepartmentGroupedTaskViewProps) {
  const [expandedDeptIds, setExpandedDeptIds] = React.useState<Set<string>>(() => {
    return new Set(QCET_DEPARTMENTS.slice(0, 3).map((d) => d.id));
  });

  const departmentGroups = React.useMemo(() => {
    let groups = aggregateTasksByDepartment(tasks, QCET_DEPARTMENTS);

    if (selectedDepartmentFilter && selectedDepartmentFilter !== "ALL") {
      groups = groups.filter(
        (g) =>
          g.departmentCode.toUpperCase() === selectedDepartmentFilter.toUpperCase() ||
          g.departmentId.toUpperCase() === selectedDepartmentFilter.toUpperCase()
      );
    }

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

      <div className="space-y-3">
        {departmentGroups.map((group) => {
          const isExpanded = expandedDeptIds.has(group.departmentId);

          return (
            <div
              key={group.departmentId}
              className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs transition-all shadow-xs overflow-hidden"
            >
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

                  {onManageDelegation && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onManageDelegation(group.departmentCode);
                      }}
                      className="h-8 px-2 text-xs gap-1 rounded-lg text-muted-foreground hover:text-foreground"
                      title="Ủy quyền điều hành theo chuẩn Stanford Authority Manager"
                    >
                      <ShieldAlert size={13} strokeWidth={1.5} />
                      <span className="hidden md:inline">Ủy quyền</span>
                    </Button>
                  )}

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
                            <th className="py-2 px-2 font-medium">Người phụ trách</th>
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
                                        : status === "NEEDS_REVIEW"
                                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
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

- [ ] **Step 4: Chạy test xác nhận PASS**

Chạy:
```bash
npx tsx --test tests/department-task-view-integration.test.ts
```

- [ ] **Step 5: Commit mã nguồn Task 2**

```bash
git add src/components/dashboard/department-grouped-task-view.tsx tests/department-task-view-integration.test.ts
git commit -m "feat(dashboard): create department-grouped task view component"
```

---

### Task 3: Modal Quản Lý Ủy Quyền (`DelegationManagementModal`)

**Files:**
- Create: `src/components/dashboard/delegation-management-modal.tsx`
- Test: `tests/delegation-management-modal.test.ts`

**Interfaces:**
- Consumes:
  - `DelegationRule`, `DelegationScope` từ `src/types/delegation.ts`
  - `QCET_DEPARTMENTS` từ `src/components/org/organization-tree.tsx`
- Produces:
  ```typescript
  export interface DelegationManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    departmentCode: string;
    delegations: DelegationRule[];
    onSaveDelegation: (rule: Omit<DelegationRule, "id" | "createdAt">) => void;
    onRevokeDelegation: (ruleId: string) => void;
  }
  ```

- [ ] **Step 1: Viết test cho logic cấu hình Delegation Modal**

Tạo `tests/delegation-management-modal.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { QCET_DEPARTMENTS } from "../src/components/org/organization-tree";

describe("Delegation Management Logic", () => {
  test("Tìm đúng thông tin Trưởng đơn vị của phòng ban được chọn", () => {
    const dept = QCET_DEPARTMENTS.find((d) => d.code === "CNTT");
    assert.ok(dept);
    assert.ok(dept.leaderName);
    assert.equal(dept.code, "CNTT");
  });
});
```

- [ ] **Step 2: Chạy test xác nhận PASS**

Chạy:
```bash
npx tsx --test tests/delegation-management-modal.test.ts
```

- [ ] **Step 3: Hiện thực `src/components/dashboard/delegation-management-modal.tsx`**

Tạo `src/components/dashboard/delegation-management-modal.tsx`:
```tsx
"use client";

import * as React from "react";
import { X, ShieldAlert, Calendar, UserCheck, Plus, AlertCircle, Trash2 } from "lucide-react";
import type { DelegationRule, DelegationScope } from "@/types/delegation";
import { QCET_DEPARTMENTS } from "@/components/org/organization-tree";
import { Button } from "@/components/ui/button";

export interface DelegationManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentCode: string;
  delegations: DelegationRule[];
  onSaveDelegation: (rule: Omit<DelegationRule, "id" | "createdAt">) => void;
  onRevokeDelegation: (ruleId: string) => void;
}

export function DelegationManagementModal({
  isOpen,
  onClose,
  departmentCode,
  delegations,
  onSaveDelegation,
  onRevokeDelegation,
}: DelegationManagementModalProps) {
  const dept = React.useMemo(() => {
    return QCET_DEPARTMENTS.find((d) => d.code.toUpperCase() === departmentCode.toUpperCase()) || QCET_DEPARTMENTS[0];
  }, [departmentCode]);

  const [granteeName, setGranteeName] = React.useState("");
  const [granteeRole, setGranteeRole] = React.useState<"MANAGER" | "STAFF">("STAFF");
  const [scope, setScope] = React.useState<DelegationScope>("DACUM_REVIEW_STEP1");
  const [startDate, setStartDate] = React.useState("2026-09-06");
  const [endDate, setEndDate] = React.useState("2026-09-20");
  const [reason, setReason] = React.useState("");

  if (!isOpen) return null;

  const currentDeptDelegations = delegations.filter(
    (d) => d.departmentCode.toUpperCase() === departmentCode.toUpperCase()
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!granteeName.trim() || !reason.trim()) return;

    onSaveDelegation({
      grantorId: "user-leader-" + dept.code.toLowerCase(),
      grantorName: dept.leaderName,
      grantorRole: "MANAGER",
      granteeId: "user-delegated-" + Date.now(),
      granteeName: granteeName.trim(),
      granteeRole,
      departmentCode: dept.code,
      scope,
      startDate,
      endDate,
      status: "ACTIVE",
      reason: reason.trim(),
    });

    setGranteeName("");
    setReason("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <ShieldAlert size={18} strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground font-heading">
                Ủy Quyền Điều Hành & Phê Duyệt (Stanford Authority Model)
              </h2>
              <p className="text-xs text-muted-foreground">
                Đơn vị: <span className="font-semibold text-foreground">{dept.name} ({dept.code})</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="rounded-xl border border-border/70 bg-background/50 p-4 space-y-3">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
              <Plus size={14} strokeWidth={1.5} className="text-primary" />
              Thiết lập quyết định ủy quyền mới
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-muted-foreground mb-1">Người ủy quyền (Grantor)</label>
                  <input
                    type="text"
                    disabled
                    value={`${dept.leaderRole}: ${dept.leaderName}`}
                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-muted/50 text-foreground font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Người được ủy quyền (Grantee) *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: ThS. Lê Văn Phó"
                    value={granteeName}
                    onChange={(e) => setGranteeName(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Phạm vi ủy quyền (Scope) *</label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as DelegationScope)}
                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                  >
                    <option value="DACUM_REVIEW_STEP1">Duyệt thẩm định minh chứng DACUM bước 1</option>
                    <option value="TASK_ASSIGNMENT">Giao việc & phân công nội bộ đơn vị</option>
                    <option value="FULL_DEPARTMENT_APPROVAL">Toàn quyền điều hành đơn vị tạm thời</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-muted-foreground mb-1">Từ ngày</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-border bg-background text-foreground text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">Đến ngày</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-border bg-background text-foreground text-xs font-mono tabular-nums"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Căn cứ / Lý do ủy quyền *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Đi công tác từ 06/09 đến 20/09 theo Quyết định số 123/QĐ-CĐKTCN"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end pt-1">
                <Button type="submit" size="sm" className="h-8 text-xs gap-1.5 rounded-lg">
                  <UserCheck size={13} strokeWidth={1.5} />
                  Ký & Kích hoạt ủy quyền
                </Button>
              </div>
            </form>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground font-heading">
              Danh sách ủy quyền đang hiệu lực trong đơn vị ({currentDeptDelegations.length})
            </h3>
            {currentDeptDelegations.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-xl">
                Chưa có quyết định ủy quyền nào. Trưởng đơn vị trực tiếp phê duyệt toàn bộ nhiệm vụ.
              </p>
            ) : (
              <div className="space-y-2">
                {currentDeptDelegations.map((del) => (
                  <div
                    key={del.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-background text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{del.granteeName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-primary/10 text-primary border border-primary/20">
                          {del.scope}
                        </span>
                        <span className="text-muted-foreground font-mono tabular-nums">
                          ({del.startDate} → {del.endDate})
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{del.reason}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRevokeDelegation(del.id)}
                      className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1"
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                      Thu hồi
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit mã nguồn Task 3**

```bash
git add src/components/dashboard/delegation-management-modal.tsx tests/delegation-management-modal.test.ts
git commit -m "feat(delegation): implement Stanford-style delegation management modal"
```

---

### Task 4: Cập nhật `UnifiedTaskToolbar` & `unified-task-hub.ts`

**Files:**
- Modify: `src/components/dashboard/unified-task-toolbar.tsx`
- Modify: `src/lib/unified-task-hub.ts`
- Test: `tests/unified-task-toolbar.test.ts`

- [ ] **Step 1: Cập nhật kiểm thử `tests/unified-task-toolbar.test.ts`**

Chỉnh sửa `tests/unified-task-toolbar.test.ts`:
```typescript
test("VIEW_MODE_OPTIONS defines table, kanban, calendar, and department modes", () => {
  const ids = VIEW_MODE_OPTIONS.map((v: ViewModeOption) => v.id);
  assert.deepEqual(ids, ["table", "kanban", "calendar", "department"]);
});
```

- [ ] **Step 2: Cập nhật code trong `src/components/dashboard/unified-task-toolbar.tsx` và `src/lib/unified-task-hub.ts`**

Trong `src/components/dashboard/unified-task-toolbar.tsx`:
```typescript
import { List, Kanban, Calendar, Building2 } from "lucide-react";

export type TaskViewMode = "table" | "kanban" | "calendar" | "department";

export const VIEW_MODE_OPTIONS: ViewModeOption[] = [
  { id: "table", label: "Bảng", icon: List },
  { id: "kanban", label: "Kanban", icon: Kanban },
  { id: "calendar", label: "Lịch", icon: Calendar },
  { id: "department", label: "Theo đơn vị", icon: Building2 },
];
```

Trong `src/lib/unified-task-hub.ts`:
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

- [ ] **Step 3: Chạy test xác nhận PASS**

Chạy:
```bash
npx tsx --test tests/unified-task-toolbar.test.ts
```

- [ ] **Step 4: Commit mã nguồn Task 4**

```bash
git add src/components/dashboard/unified-task-toolbar.tsx src/lib/unified-task-hub.ts tests/unified-task-toolbar.test.ts
git commit -m "feat(toolbar): integrate department view mode with Building2 icon"
```

---

### Task 5: Tích hợp vào Trang Chủ (`src/app/page.tsx`)

**Files:**
- Modify: `src/app/page.tsx`
- Test: `tests/executive-dashboard-integration.test.ts`

- [ ] **Step 1: Cập nhật `src/app/page.tsx` kết nối view phân cụm và modal ủy quyền**

Thêm dynamic imports:
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

const DelegationManagementModal = dynamic(
  () =>
    import("@/components/dashboard/delegation-management-modal").then(
      (m) => m.DelegationManagementModal
    ),
  { ssr: false }
);
```

Bổ sung state quản lý modal ủy quyền và render `DepartmentGroupedTaskView` khi `viewMode === "department"`.

- [ ] **Step 2: Chạy test tích hợp dashboard**

Chạy:
```bash
npx tsx --test tests/executive-dashboard-integration.test.ts
```
Kỳ vọng: PASS.

- [ ] **Step 3: Commit mã nguồn Task 5**

```bash
git add src/app/page.tsx
git commit -m "feat(portal): connect department grouped view and delegation modal to tasks zone"
```

---

### Task 6: Kiểm định Tiêu Chuẩn Anti-Slop (`tests/anti-slop-delegation-workflow.test.ts`)

**Files:**
- Create: `tests/anti-slop-delegation-workflow.test.ts`
- Test: `tests/anti-slop-delegation-workflow.test.ts`

- [ ] **Step 1: Viết test audit cho toàn bộ các file mới**

Tạo `tests/anti-slop-delegation-workflow.test.ts`:
```typescript
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Delegation & Department Workflow Anti-Slop Audit", () => {
  const targetFiles = [
    "src/types/delegation.ts",
    "src/lib/delegation-authority-engine.ts",
    "src/lib/department-task-aggregator.ts",
    "src/components/dashboard/department-grouped-task-view.tsx",
    "src/components/dashboard/delegation-management-modal.tsx",
  ];

  test("Zero decorative emojis in all new workflow files", () => {
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

  test("Numeric metrics use font-mono tabular-nums", () => {
    const viewPath = path.join(
      process.cwd(),
      "src/components/dashboard/department-grouped-task-view.tsx"
    );
    const content = fs.readFileSync(viewPath, "utf-8");
    assert.ok(content.includes("tabular-nums"), "Must use tabular-nums");
    assert.ok(content.includes("font-mono"), "Must use font-mono");
  });

  test("Icons use strokeWidth={1.5}", () => {
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
npx tsx --test tests/anti-slop-delegation-workflow.test.ts
```
Kỳ vọng: PASS.

- [ ] **Step 3: Commit mã nguồn Task 6**

```bash
git add tests/anti-slop-delegation-workflow.test.ts
git commit -m "test(audit): enforce anti-slop rules on delegation and department views"
```

---

### Task 7: Kiểm Thử Toàn Diện & Biên Dịch (Build & Typecheck)

**Files:**
- Toàn bộ codebase

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
Kỳ vọng: Toàn bộ > 45 files test đều PASS.

- [ ] **Step 3: Chạy Next.js build để xác nhận SSR và bundles**

Chạy:
```bash
npm run build
```
Kỳ vọng: Build thành công, tối ưu hóa routes.

- [ ] **Step 4: Commit hoàn tất sprint**

```bash
git commit --allow-empty -m "chore(release): complete supervisory org and delegation workflow implementation"
```
