---
status: superseded
domain: ux
created: 2026-09-08
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Unified Adaptive Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Transform the 3 fragmented role-based workspaces into a single unified adaptive workspace (`UnifiedAdaptiveWorkspace`) featuring a 3-tier Scope Switcher (`[Toàn trường] | [Đơn vị] | [Của tôi]`), an in-place action queue, and zero-downtime adapter shims preserving 100% DACUM compliance.

**Architecture:** 
- Centralize workspace state in `useAdaptiveWorkspaceData` which dynamically aggregates tasks, metrics, and permissions based on selected scope (`school` | `unit` | `my`) and user identity.
- Build modular subcomponents: `AdaptiveScopeHeader`, `AdaptiveMetricStrip`, and `UniversalActionQueue` (two-lane triage for incoming approvals vs my deliverables).
- Integrate `CascadingTaskTable` as the single shared canvas with contextual in-place action buttons.
- Wrap legacy exports (`ExecutiveCockpitWorkspace`, `DepartmentManagerWorkspace`, `LecturerFocusWorkspace`) as lightweight adapter shims over `UnifiedAdaptiveWorkspace` to ensure all existing integration tests pass without regression.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, Lucide React (`strokeWidth={1.5}`), Node.js `node:test` + `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-08-unified-adaptive-workspace-spec.md`

## Global Constraints

- **Tailwind CSS v4:** Keep styling purely in `globals.css` and utility classes; do NOT create a `tailwind.config.js`. Use theme tokens and OKLCH color variables.
- **Light-Only Standard:** Zero `dark:` classes, zero `.dark` selectors, no `useTheme`. Use semantic light tokens (`bg-card`, `text-foreground`, `border-border`, `text-primary`).
- **Anti-Slop & Zero Emojis:** 0% emojis in source code, buttons, badge text, and labels. Use Lucide icons with `strokeWidth={1.5}`.
- **No Cache Poisoning:** Do NOT run `next build` while dev server is running. Verify correctness with `npm run typecheck` and `npm test`.
- **Typographic Discipline:** Numbers, dates, codes, and counts must use `font-mono tabular-nums`. Text headings use `font-heading font-bold tracking-tight`.

---

### Task 1: Core Types and Data Aggregation Hook (`useAdaptiveWorkspaceData`)

**Files:**
- Create: `src/components/workspace/types.ts`
- Create: `src/components/workspace/hooks/use-adaptive-workspace-data.ts`
- Test: `tests/adaptive-workspace-data.test.ts`

**Interfaces:**
- Consumes:
  - `SchoolTask`, `StaffTask`, `TaskStatus` from `@/types/dashboard`
  - `AuthUser` from `@/types/auth`
  - `ApprovalActionPayload`, `DeliverableSubmissionPayload` from `@/types/workspace`
- Produces:
  - `WorkspaceScope = "school" | "unit" | "my"`
  - `AdaptiveWorkspaceMetrics` interface
  - `useAdaptiveWorkspaceData(tasks: SchoolTask[], user: AuthUser | null, currentScope: WorkspaceScope, selectedDepartment?: string)`

- [x] **Step 1: Write the failing test**

Create `tests/adaptive-workspace-data.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  deriveAdaptiveWorkspaceData,
  type WorkspaceScope,
} from "../src/components/workspace/hooks/use-adaptive-workspace-data";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";

describe("Adaptive Workspace Data Derivation", () => {
  const payload = getMockDashboardPayload();
  const tasks = payload.tasks;
  const adminUser = DEFAULT_DEMO_USERS[0]; // role: ADMIN
  const managerUser = DEFAULT_DEMO_USERS[1]; // role: MANAGER, dept: K_CNTT
  const staffUser = DEFAULT_DEMO_USERS[2]; // role: STAFF, dept: K_CNTT

  test("derives metrics and task list for school scope (ADMIN)", () => {
    const data = deriveAdaptiveWorkspaceData({
      tasks,
      user: adminUser,
      scope: "school",
    });

    assert.equal(data.activeScope, "school");
    assert.equal(data.scopedTasks.length, tasks.length);
    assert.ok(data.metrics.totalTasks >= 0);
    assert.ok(typeof data.metrics.completedRate === "number");
    assert.equal(data.metrics.labelScope, "Toàn trường");
  });

  test("derives metrics and task list for unit scope (MANAGER)", () => {
    const data = deriveAdaptiveWorkspaceData({
      tasks,
      user: managerUser,
      scope: "unit",
      selectedDepartment: "K_CNTT",
    });

    assert.equal(data.activeScope, "unit");
    // All scoped tasks must relate to K_CNTT
    data.scopedTasks.forEach((task) => {
      const isDeptRelated =
        task.departmentCode === "K_CNTT" ||
        task.department === "Khoa CNTT" ||
        task.subTasks?.some((st) => st.departmentCode === "K_CNTT" || st.department === "Khoa CNTT");
      assert.ok(isDeptRelated);
    });
  });

  test("derives metrics and actionable queue for my scope (STAFF)", () => {
    const data = deriveAdaptiveWorkspaceData({
      tasks,
      user: staffUser,
      scope: "my",
    });

    assert.equal(data.activeScope, "my");
    assert.ok(data.actionQueue.myPendingSubmissions !== undefined);
  });

  test("safely handles null user and empty tasks", () => {
    const data = deriveAdaptiveWorkspaceData({
      tasks: [],
      user: null,
      scope: "my",
    });

    assert.equal(data.scopedTasks.length, 0);
    assert.equal(data.metrics.totalTasks, 0);
    assert.equal(data.metrics.completedRate, 0);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/adaptive-workspace-data.test.ts`  
Expected: FAIL (module not found)

- [x] **Step 3: Write minimal implementation**

Create `src/components/workspace/types.ts`:
```typescript
import type { AuthUser } from "@/types/auth";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { DeliverableSubmissionPayload, ApprovalActionPayload } from "@/types/workspace";

export type WorkspaceScope = "school" | "unit" | "my";

export interface AdaptiveWorkspaceMetrics {
  totalTasks: number;
  urgentOverdueCount: number;
  waitingApprovalCount: number;
  completedRate: number;
  labelScope: string;
}

export interface UniversalActionQueueItems {
  pendingApprovals: Array<{
    task: SchoolTask | StaffTask;
    parentTaskTitle?: string;
    submittedBy?: string;
    submittedAt?: string;
    complianceScore?: number;
  }>;
  myPendingSubmissions: Array<{
    task: StaffTask;
    parentTaskTitle: string;
    dueDate?: string;
    isOverdue: boolean;
  }>;
}

export interface UnifiedAdaptiveWorkspaceProps {
  user: AuthUser;
  tasks: SchoolTask[];
  initialScope?: WorkspaceScope;
  forcedRole?: "ADMIN" | "MANAGER" | "STAFF";
  selectedDepartment?: string;
  onSelectTask: (task: SchoolTask | StaffTask) => void;
  onReview?: (payload: ApprovalActionPayload) => Promise<void> | void;
  onSubmitDeliverable?: (payload: DeliverableSubmissionPayload) => Promise<void> | void;
  onStatusChange?: (taskId: string, status: TaskStatus, note?: string) => void;
  onSendReminder?: (targetDeptOrUser: string, reason: string) => void;
  onCreateTask?: (level: "TRUONG" | "DON_VI", parentTaskId?: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}
```

Create `src/components/workspace/hooks/use-adaptive-workspace-data.ts`:
```typescript
import * as React from "react";
import type { AuthUser } from "@/types/auth";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import type {
  WorkspaceScope,
  AdaptiveWorkspaceMetrics,
  UniversalActionQueueItems,
} from "../types";

export interface DeriveWorkspaceDataOptions {
  tasks: SchoolTask[];
  user: AuthUser | null;
  scope: WorkspaceScope;
  selectedDepartment?: string;
}

export interface DerivedWorkspaceData {
  activeScope: WorkspaceScope;
  scopedTasks: SchoolTask[];
  metrics: AdaptiveWorkspaceMetrics;
  actionQueue: UniversalActionQueueItems;
}

export function deriveAdaptiveWorkspaceData({
  tasks = [],
  user,
  scope,
  selectedDepartment,
}: DeriveWorkspaceDataOptions): DerivedWorkspaceData {
  const userDept = selectedDepartment || user?.departmentCode || user?.department || "";
  const userName = user?.name || "";

  let scopedTasks: SchoolTask[] = [];

  if (scope === "school") {
    scopedTasks = tasks;
  } else if (scope === "unit") {
    scopedTasks = tasks.filter((t) => {
      const matchParent =
        t.departmentCode?.toUpperCase() === userDept.toUpperCase() ||
        t.department?.toLowerCase() === userDept.toLowerCase();
      const matchChild = t.subTasks?.some(
        (st) =>
          st.departmentCode?.toUpperCase() === userDept.toUpperCase() ||
          st.department?.toLowerCase() === userDept.toLowerCase()
      );
      return matchParent || matchChild;
    });
  } else {
    // scope === "my"
    scopedTasks = tasks
      .map((t) => {
        const matchingSub = (t.subTasks || []).filter(
          (st) =>
            st.assignedTo === userName ||
            st.assigneeId === user?.id ||
            st.assigneeName === userName
        );
        if (matchingSub.length > 0) {
          return { ...t, subTasks: matchingSub };
        }
        if (
          t.assignedTo === userName ||
          t.assigneeId === user?.id ||
          t.assigneeName === userName
        ) {
          return t;
        }
        return null;
      })
      .filter((t): t is SchoolTask => t !== null);
  }

  // Calculate Metrics
  const totalTasks = scopedTasks.length;
  let completedCount = 0;
  let urgentOverdueCount = 0;
  let waitingApprovalCount = 0;

  const now = new Date();

  scopedTasks.forEach((t) => {
    if (t.status === "COMPLETED") completedCount++;
    if (t.status === "NEEDS_REVIEW" || (t.status as string) === "PENDING_EXECUTIVE_APPROVAL") {
      waitingApprovalCount++;
    }
    if (t.dueDate && new Date(t.dueDate) < now && t.status !== "COMPLETED") {
      urgentOverdueCount++;
    }

    t.subTasks?.forEach((st) => {
      if (st.status === "NEEDS_REVIEW") waitingApprovalCount++;
      if (st.dueDate && new Date(st.dueDate) < now && st.status !== "COMPLETED") {
        urgentOverdueCount++;
      }
    });
  });

  const completedRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const labelScope =
    scope === "school"
      ? "Toàn trường"
      : scope === "unit"
      ? userDept || "Đơn vị"
      : "Cá nhân";

  // Calculate Action Queue
  const pendingApprovals: UniversalActionQueueItems["pendingApprovals"] = [];
  const myPendingSubmissions: UniversalActionQueueItems["myPendingSubmissions"] = [];

  tasks.forEach((t) => {
    if (t.status === "NEEDS_REVIEW") {
      pendingApprovals.push({
        task: t,
        parentTaskTitle: t.title,
        submittedBy: t.assignedTo || t.department,
        submittedAt: t.updatedAt,
      });
    }

    t.subTasks?.forEach((st) => {
      if (st.status === "NEEDS_REVIEW") {
        pendingApprovals.push({
          task: st,
          parentTaskTitle: t.title,
          submittedBy: st.assignedTo || st.assigneeName,
          submittedAt: st.updatedAt,
        });
      }

      const isMine =
        st.assignedTo === userName ||
        st.assigneeId === user?.id ||
        st.assigneeName === userName;
      if (isMine && st.status !== "COMPLETED") {
        const isOverdue = Boolean(st.dueDate && new Date(st.dueDate) < now);
        myPendingSubmissions.push({
          task: st,
          parentTaskTitle: t.title,
          dueDate: st.dueDate,
          isOverdue,
        });
      }
    });
  });

  return {
    activeScope: scope,
    scopedTasks,
    metrics: {
      totalTasks,
      urgentOverdueCount,
      waitingApprovalCount,
      completedRate,
      labelScope,
    },
    actionQueue: {
      pendingApprovals,
      myPendingSubmissions,
    },
  };
}

export function useAdaptiveWorkspaceData(
  tasks: SchoolTask[],
  user: AuthUser | null,
  scope: WorkspaceScope,
  selectedDepartment?: string
): DerivedWorkspaceData {
  return React.useMemo(
    () =>
      deriveAdaptiveWorkspaceData({
        tasks,
        user,
        scope,
        selectedDepartment,
      }),
    [tasks, user, scope, selectedDepartment]
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/adaptive-workspace-data.test.ts`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/components/workspace/types.ts src/components/workspace/hooks/use-adaptive-workspace-data.ts tests/adaptive-workspace-data.test.ts
git commit -m "feat(workspace): implement types and adaptive workspace data derivation hook"
```

---

### Task 2: Adaptive Scope Header Component (`AdaptiveScopeHeader`)

**Files:**
- Create: `src/components/workspace/components/adaptive-scope-header.tsx`
- Test: `tests/adaptive-scope-header.test.ts`

**Interfaces:**
- Consumes:
  - `user: AuthUser`
  - `activeScope: WorkspaceScope`
  - `onScopeChange: (scope: WorkspaceScope) => void`
  - `onRefresh?: () => void`
  - `onCreateTask?: () => void`
- Produces:
  - Export `AdaptiveScopeHeader` rendering the 3-state segmented control with tint accents and responsive labels.

- [x] **Step 1: Write the failing test**

Create `tests/adaptive-scope-header.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdaptiveScopeHeader } from "../src/components/workspace/components/adaptive-scope-header";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";

describe("AdaptiveScopeHeader Component", () => {
  const adminUser = DEFAULT_DEMO_USERS[0];
  const staffUser = DEFAULT_DEMO_USERS[2];

  test("renders 3 segmented scopes for ADMIN user", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveScopeHeader, {
        user: adminUser,
        activeScope: "school",
        onScopeChange: () => {},
      })
    );

    assert.ok(html.includes("Toàn trường"), "Should display Toàn trường option");
    assert.ok(html.includes("Của tôi"), "Should display Của tôi option");
    assert.ok(html.includes("data-slot=\"adaptive-scope-header\""));
  });

  test("hides or disables school scope for non-executive staff", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveScopeHeader, {
        user: staffUser,
        activeScope: "my",
        onScopeChange: () => {},
      })
    );

    // Non-executive staff should not see school scope button
    assert.ok(!html.includes("data-scope=\"school\""), "Staff must not have school scope option");
    assert.ok(html.includes("data-scope=\"my\""), "Staff must have my scope option");
  });

  test("zero emojis in rendered markup", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveScopeHeader, {
        user: adminUser,
        activeScope: "school",
        onScopeChange: () => {},
      })
    );
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "Markup must be 100% free of emojis");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/adaptive-scope-header.test.ts`  
Expected: FAIL (module not found)

- [x] **Step 3: Write minimal implementation**

Create `src/components/workspace/components/adaptive-scope-header.tsx`:
```tsx
"use client";

import * as React from "react";
import { School, Building2, User, Plus, RefreshCw } from "lucide-react";
import type { AuthUser } from "@/types/auth";
import type { WorkspaceScope } from "../types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isExecutiveUser, isManagerUser } from "@/components/layout/scope-switcher";

export interface AdaptiveScopeHeaderProps {
  user: AuthUser;
  activeScope: WorkspaceScope;
  onScopeChange: (scope: WorkspaceScope) => void;
  onRefresh?: () => void;
  onCreateTask?: () => void;
  isRefreshing?: boolean;
}

export function AdaptiveScopeHeader({
  user,
  activeScope,
  onScopeChange,
  onRefresh,
  onCreateTask,
  isRefreshing,
}: AdaptiveScopeHeaderProps) {
  const isExecutive = isExecutiveUser(user);
  const isManager = isManagerUser(user) || isExecutive;
  const unitLabel = user.department || user.departmentCode || "Đơn vị";

  const scopes: Array<{
    id: WorkspaceScope;
    label: string;
    shortLabel: string;
    icon: typeof School;
    visible: boolean;
  }> = [
    {
      id: "school",
      label: "Toàn trường",
      shortLabel: "Trường",
      icon: School,
      visible: isExecutive,
    },
    {
      id: "unit",
      label: unitLabel,
      shortLabel: unitLabel,
      icon: Building2,
      visible: isManager,
    },
    {
      id: "my",
      label: "Việc của tôi",
      shortLabel: "Của tôi",
      icon: User,
      visible: true,
    },
  ];

  return (
    <div
      data-slot="adaptive-scope-header"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border/60"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center p-1 bg-muted/60 rounded-xl border border-border/70">
          {scopes
            .filter((s) => s.visible)
            .map((s) => {
              const Icon = s.icon;
              const isActive = activeScope === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-scope={s.id}
                  onClick={() => onScopeChange(s.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[36px] sm:min-h-[32px] touch-manipulation",
                    isActive
                      ? "bg-card text-foreground shadow-xs font-bold border border-border/80"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                  )}
                >
                  <Icon className="size-3.5 shrink-0 select-none" strokeWidth={1.5} aria-hidden="true" />
                  <span>{s.label}</span>
                </button>
              );
            })}
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 px-2.5 rounded-xl border-border/80 text-xs font-medium cursor-pointer"
            aria-label="Làm mới dữ liệu"
          >
            <RefreshCw
              className={cn("size-3.5 text-muted-foreground", isRefreshing && "animate-spin")}
              strokeWidth={1.5}
            />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>
        )}
        {onCreateTask && (
          <Button
            size="sm"
            onClick={onCreateTask}
            className="h-8 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 cursor-pointer"
          >
            <Plus className="size-3.5 mr-1" strokeWidth={1.5} />
            <span>Giao nhiệm vụ</span>
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/adaptive-scope-header.test.ts`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/components/workspace/components/adaptive-scope-header.tsx tests/adaptive-scope-header.test.ts
git commit -m "feat(workspace): implement AdaptiveScopeHeader component"
```

---

### Task 3: Adaptive Metric Strip Component (`AdaptiveMetricStrip`)

**Files:**
- Create: `src/components/workspace/components/adaptive-metric-strip.tsx`
- Test: `tests/adaptive-metric-strip.test.ts`

**Interfaces:**
- Consumes:
  - `metrics: AdaptiveWorkspaceMetrics`
  - `scope: WorkspaceScope`
- Produces:
  - Export `AdaptiveMetricStrip` rendering 4 responsive metric tiles using `font-mono tabular-nums`.

- [x] **Step 1: Write the failing test**

Create `tests/adaptive-metric-strip.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdaptiveMetricStrip } from "../src/components/workspace/components/adaptive-metric-strip";

describe("AdaptiveMetricStrip Component", () => {
  const metrics = {
    totalTasks: 24,
    urgentOverdueCount: 2,
    waitingApprovalCount: 5,
    completedRate: 68,
    labelScope: "Khoa CNTT",
  };

  test("renders all 4 metric values with font-mono tabular-nums", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "unit",
      })
    );

    assert.ok(html.includes("24"), "Renders total tasks");
    assert.ok(html.includes("2"), "Renders urgent overdue");
    assert.ok(html.includes("5"), "Renders waiting approval");
    assert.ok(html.includes("68%"), "Renders completion rate");
    assert.ok(html.includes("font-mono"), "Enforces font-mono for numbers");
    assert.ok(html.includes("tabular-nums"), "Enforces tabular-nums");
  });

  test("zero emojis in rendered markup", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "school",
      })
    );
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "Markup must be 100% free of emojis");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/adaptive-metric-strip.test.ts`  
Expected: FAIL (module not found)

- [x] **Step 3: Write minimal implementation**

Create `src/components/workspace/components/adaptive-metric-strip.tsx`:
```tsx
"use client";

import * as React from "react";
import { Layers, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import type { AdaptiveWorkspaceMetrics, WorkspaceScope } from "../types";
import { cn } from "@/lib/utils";

export interface AdaptiveMetricStripProps {
  metrics: AdaptiveWorkspaceMetrics;
  scope: WorkspaceScope;
  className?: string;
}

export function AdaptiveMetricStrip({
  metrics,
  scope,
  className,
}: AdaptiveMetricStripProps) {
  const scopeDescription =
    scope === "school"
      ? "toàn trường"
      : scope === "unit"
      ? `đơn vị (${metrics.labelScope})`
      : "cá nhân";

  const cards = [
    {
      title: "Khối lượng công việc",
      value: metrics.totalTasks,
      subtitle: `Nhiệm vụ thuộc ${scopeDescription}`,
      icon: Layers,
      iconColor: "text-blue-700 bg-blue-500/10 border-blue-500/20",
    },
    {
      title: "Hạn gấp & Quá hạn",
      value: metrics.urgentOverdueCount,
      subtitle: metrics.urgentOverdueCount > 0 ? "Cần ưu tiên xử lý" : "Tiến độ đúng hạn",
      icon: AlertCircle,
      iconColor:
        metrics.urgentOverdueCount > 0
          ? "text-rose-700 bg-rose-500/10 border-rose-500/20"
          : "text-muted-foreground bg-muted/30 border-border/40",
    },
    {
      title: "Hàng đợi duyệt",
      value: metrics.waitingApprovalCount,
      subtitle:
        scope === "my"
          ? "Đã nộp chờ thẩm định"
          : "Hồ sơ chờ bạn phê duyệt",
      icon: Clock,
      iconColor:
        metrics.waitingApprovalCount > 0
          ? "text-amber-700 bg-amber-500/10 border-amber-500/20"
          : "text-muted-foreground bg-muted/30 border-border/40",
    },
    {
      title: "Tỷ lệ hoàn thành",
      value: `${metrics.completedRate}%`,
      subtitle: "Theo tiêu chuẩn DACUM",
      icon: CheckCircle2,
      iconColor: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20",
    },
  ];

  return (
    <div
      data-slot="adaptive-metric-strip"
      className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3", className)}
    >
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="p-3.5 rounded-xl border border-border/70 bg-card/80 backdrop-blur-xs flex flex-col justify-between space-y-2 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground truncate">
                {card.title}
              </span>
              <div
                className={cn(
                  "p-1.5 rounded-lg border flex items-center justify-center shrink-0",
                  card.iconColor
                )}
              >
                <Icon className="size-3.5 select-none" strokeWidth={1.5} aria-hidden="true" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-foreground">
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {card.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/adaptive-metric-strip.test.ts`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/components/workspace/components/adaptive-metric-strip.tsx tests/adaptive-metric-strip.test.ts
git commit -m "feat(workspace): implement AdaptiveMetricStrip component"
```

---

### Task 4: Universal Action Queue Component (`UniversalActionQueue`)

**Files:**
- Create: `src/components/workspace/components/universal-action-queue.tsx`
- Test: `tests/universal-action-queue.test.ts`

**Interfaces:**
- Consumes:
  - `actionQueue: UniversalActionQueueItems`
  - `onSelectTask: (task: SchoolTask | StaffTask) => void`
  - `onReview?: (payload: ApprovalActionPayload) => void`
  - `onSubmitDeliverable?: (payload: DeliverableSubmissionPayload) => void`
- Produces:
  - Export `UniversalActionQueue` rendering 2 triage lanes with fast 1-click review/submit buttons.

- [x] **Step 1: Write the failing test**

Create `tests/universal-action-queue.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UniversalActionQueue } from "../src/components/workspace/components/universal-action-queue";
import type { SchoolTask } from "../src/types/dashboard";

describe("UniversalActionQueue Component", () => {
  const mockTask: SchoolTask = {
    id: "TASK-1",
    title: "Nghiệm thu Đề cương bài giảng",
    department: "Khoa CNTT",
    departmentCode: "K_CNTT",
    status: "NEEDS_REVIEW",
    priority: "HIGH",
    category: "CHUYEN_MON",
    assignedTo: "ThS. Lê Văn Phó",
    dueDate: "2026-09-15",
    progress: 85,
    subTasks: [],
    academicYear: "2026-2027",
    updatedAt: "2026-09-08T08:00:00Z",
  };

  const actionQueue = {
    pendingApprovals: [
      {
        task: mockTask,
        parentTaskTitle: mockTask.title,
        submittedBy: "ThS. Lê Văn Phó",
      },
    ],
    myPendingSubmissions: [],
  };

  test("renders approval in-tray card when pendingApprovals exist", () => {
    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        onSelectTask: () => {},
      })
    );

    assert.ok(html.includes("Hàng đợi thẩm định"), "Should render approval header");
    assert.ok(html.includes("Nghiệm thu Đề cương bài giảng"), "Should render task title");
    assert.ok(html.includes("ThS. Lê Văn Phó"), "Should render submitter name");
    assert.ok(html.includes("data-slot=\"universal-action-queue\""));
  });

  test("zero emojis in rendered markup", () => {
    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        onSelectTask: () => {},
      })
    );
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "Markup must be 100% free of emojis");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/universal-action-queue.test.ts`  
Expected: FAIL (module not found)

- [x] **Step 3: Write minimal implementation**

Create `src/components/workspace/components/universal-action-queue.tsx`:
```tsx
"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, UploadCloud, ChevronRight, FileText } from "lucide-react";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import type { UniversalActionQueueItems } from "../types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface UniversalActionQueueProps {
  actionQueue: UniversalActionQueueItems;
  onSelectTask: (task: SchoolTask | StaffTask) => void;
  className?: string;
}

export function UniversalActionQueue({
  actionQueue,
  onSelectTask,
  className,
}: UniversalActionQueueProps) {
  const { pendingApprovals, myPendingSubmissions } = actionQueue;

  if (pendingApprovals.length === 0 && myPendingSubmissions.length === 0) {
    return null;
  }

  return (
    <div
      data-slot="universal-action-queue"
      className={cn("grid grid-cols-1 lg:grid-cols-2 gap-3.5", className)}
    >
      {/* Lane 1: Incoming Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.03] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="text-xs font-bold text-amber-900 tracking-tight">
                Hàng đợi thẩm định ({pendingApprovals.length})
              </h3>
            </div>
            <span className="text-xs font-medium text-amber-800">
              Cần lãnh đạo xử lý
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {pendingApprovals.slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                onClick={() => onSelectTask(item.task)}
                className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer shadow-2xs group"
              >
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-semibold text-foreground truncate group-hover:text-amber-800 transition-colors">
                    {item.task.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    Người nộp: {item.submittedBy || "Cán bộ chuyên trách"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 rounded-lg text-xs font-semibold border-amber-500/30 text-amber-800 hover:bg-amber-500/10 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTask(item.task);
                  }}
                >
                  <span>Thẩm định</span>
                  <ChevronRight className="size-3 ml-0.5" strokeWidth={1.5} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lane 2: My Pending Submissions */}
      {myPendingSubmissions.length > 0 && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.03] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
              <h3 className="text-xs font-bold text-blue-900 tracking-tight">
                Nhiệm vụ cá nhân cần nộp ({myPendingSubmissions.length})
              </h3>
            </div>
            <span className="text-xs font-medium text-blue-800">
              Hạn nộp báo cáo
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {myPendingSubmissions.slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                onClick={() => onSelectTask(item.task)}
                className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-blue-500/20 hover:border-blue-500/40 transition-all cursor-pointer shadow-2xs group"
              >
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-semibold text-foreground truncate group-hover:text-blue-800 transition-colors">
                    {item.task.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                    {item.isOverdue ? (
                      <span className="text-rose-700 font-semibold flex items-center gap-1">
                        <AlertTriangle className="size-3" strokeWidth={1.5} />
                        Quá hạn: {item.dueDate}
                      </span>
                    ) : (
                      <span>Hạn: {item.dueDate || "Trong tuần"}</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-7 px-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTask(item.task);
                  }}
                >
                  <UploadCloud className="size-3 mr-1" strokeWidth={1.5} />
                  <span>Nộp</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/universal-action-queue.test.ts`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/components/workspace/components/universal-action-queue.tsx tests/universal-action-queue.test.ts
git commit -m "feat(workspace): implement UniversalActionQueue component"
```

---

### Task 5: Unified Adaptive Workspace Entrypoint (`UnifiedAdaptiveWorkspace`)

**Files:**
- Create: `src/components/workspace/unified-adaptive-workspace.tsx`
- Test: `tests/unified-adaptive-workspace.test.ts`

**Interfaces:**
- Consumes:
  - `UnifiedAdaptiveWorkspaceProps` from `./types`
  - `useAdaptiveWorkspaceData`
  - `AdaptiveScopeHeader`, `AdaptiveMetricStrip`, `UniversalActionQueue`
  - `CascadingTaskTable` from `@/components/tasks/cascading-task-table`
- Produces:
  - Export `UnifiedAdaptiveWorkspace` as the single shared canvas.

- [x] **Step 1: Write the failing test**

Create `tests/unified-adaptive-workspace.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UnifiedAdaptiveWorkspace } from "../src/components/workspace/unified-adaptive-workspace";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";

describe("UnifiedAdaptiveWorkspace Entrypoint Component", () => {
  const payload = getMockDashboardPayload();
  const tasks = payload.tasks;
  const adminUser = DEFAULT_DEMO_USERS[0];
  const staffUser = DEFAULT_DEMO_USERS[2];

  test("renders unified canvas with scope header and metric strip", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: adminUser,
        tasks,
        onSelectTask: () => {},
      })
    );

    assert.ok(html.includes("data-slot=\"unified-adaptive-workspace\""));
    assert.ok(html.includes("data-slot=\"adaptive-scope-header\""));
    assert.ok(html.includes("data-slot=\"adaptive-metric-strip\""));
  });

  test("defaults to 'my' scope for staff users", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: staffUser,
        tasks,
        onSelectTask: () => {},
      })
    );

    assert.ok(html.includes("data-active-scope=\"my\""));
  });

  test("zero emojis in rendered markup", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: adminUser,
        tasks,
        onSelectTask: () => {},
      })
    );
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "Markup must be 100% free of emojis");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unified-adaptive-workspace.test.ts`  
Expected: FAIL (module not found)

- [x] **Step 3: Write minimal implementation**

Create `src/components/workspace/unified-adaptive-workspace.tsx`:
```tsx
"use client";

import * as React from "react";
import type { UnifiedAdaptiveWorkspaceProps, WorkspaceScope } from "./types";
import { useAdaptiveWorkspaceData } from "./hooks/use-adaptive-workspace-data";
import { AdaptiveScopeHeader } from "./components/adaptive-scope-header";
import { AdaptiveMetricStrip } from "./components/adaptive-metric-strip";
import { UniversalActionQueue } from "./components/universal-action-queue";
import { CascadingTaskTable } from "@/components/tasks/cascading-task-table";
import { isExecutiveUser, isManagerUser } from "@/components/layout/scope-switcher";

export function UnifiedAdaptiveWorkspace({
  user,
  tasks,
  initialScope,
  forcedRole,
  selectedDepartment,
  onSelectTask,
  onReview,
  onSubmitDeliverable,
  onStatusChange,
  onCreateTask,
  onRefresh,
  isRefreshing,
}: UnifiedAdaptiveWorkspaceProps) {
  // Determine default scope based on user role if not provided
  const defaultScope: WorkspaceScope = React.useMemo(() => {
    if (initialScope) return initialScope;
    if (forcedRole === "ADMIN" || isExecutiveUser(user)) return "school";
    if (forcedRole === "MANAGER" || isManagerUser(user)) return "unit";
    return "my";
  }, [initialScope, forcedRole, user]);

  const [activeScope, setActiveScope] = React.useState<WorkspaceScope>(defaultScope);

  // Synchronize when initialScope changes externally
  React.useEffect(() => {
    if (initialScope) {
      setActiveScope(initialScope);
    }
  }, [initialScope]);

  const { scopedTasks, metrics, actionQueue } = useAdaptiveWorkspaceData(
    tasks,
    user,
    activeScope,
    selectedDepartment
  );

  return (
    <div
      data-slot="unified-adaptive-workspace"
      data-active-scope={activeScope}
      className="space-y-4"
    >
      {/* 1. Adaptive Scope Switcher Header */}
      <AdaptiveScopeHeader
        user={user}
        activeScope={activeScope}
        onScopeChange={setActiveScope}
        onRefresh={onRefresh}
        onCreateTask={onCreateTask ? () => onCreateTask(activeScope === "school" ? "TRUONG" : "DON_VI") : undefined}
        isRefreshing={isRefreshing}
      />

      {/* 2. Adaptive Metric Strip */}
      <AdaptiveMetricStrip metrics={metrics} scope={activeScope} />

      {/* 3. Universal Action Queue (Approvals & Deliverables) */}
      <UniversalActionQueue
        actionQueue={actionQueue}
        onSelectTask={onSelectTask}
      />

      {/* 4. Single Shared Task Canvas */}
      <div className="pt-2">
        <CascadingTaskTable
          tasks={scopedTasks}
          onSelectTask={onSelectTask}
          onStatusChange={onStatusChange}
          onOpenSubmitModal={onSubmitDeliverable ? (st) => onSubmitDeliverable({ taskId: st.id, parentTaskId: "", fileUrl: "", notes: "" }) : undefined}
        />
      </div>
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unified-adaptive-workspace.test.ts`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/components/workspace/unified-adaptive-workspace.tsx tests/unified-adaptive-workspace.test.ts
git commit -m "feat(workspace): implement UnifiedAdaptiveWorkspace component"
```

---

### Task 6: Adapter Shims for Existing Workspaces (Zero-Downtime Migration)

**Files:**
- Modify: `src/components/portal/executive-cockpit-workspace.tsx`
- Modify: `src/components/portal/department-manager-workspace.tsx`
- Modify: `src/components/portal/lecturer-focus-workspace.tsx`
- Test: `tests/role-landing-integration.test.ts`

**Interfaces:**
- Preserves 100% of existing prop signatures for `ExecutiveCockpitWorkspace`, `DepartmentManagerWorkspace`, and `LecturerFocusWorkspace`.
- Internally wraps and delegates rendering to `<UnifiedAdaptiveWorkspace />`.

- [x] **Step 1: Check existing integration test baseline**

Run: `npx tsx --test tests/role-landing-integration.test.ts`  
Confirm existing tests pass before refactoring.

- [x] **Step 2: Update `ExecutiveCockpitWorkspace` to be a thin adapter shim**

Update `src/components/portal/executive-cockpit-workspace.tsx`:
Replace body with delegated call to `UnifiedAdaptiveWorkspace initialScope="school" forcedRole="ADMIN"`.

- [x] **Step 3: Update `DepartmentManagerWorkspace` to be a thin adapter shim**

Update `src/components/portal/department-manager-workspace.tsx`:
Replace body with delegated call to `UnifiedAdaptiveWorkspace initialScope="unit" forcedRole="MANAGER"`.

- [x] **Step 4: Update `LecturerFocusWorkspace` to be a thin adapter shim**

Update `src/components/portal/lecturer-focus-workspace.tsx`:
Replace body with delegated call to `UnifiedAdaptiveWorkspace initialScope="my" forcedRole="STAFF"`.

- [x] **Step 5: Run integration tests to verify compatibility**

Run: `npx tsx --test tests/role-landing-integration.test.ts`  
Expected: PASS (All tests pass without regression)

- [x] **Step 6: Commit**

```bash
git add src/components/portal/executive-cockpit-workspace.tsx src/components/portal/department-manager-workspace.tsx src/components/portal/lecturer-focus-workspace.tsx
git commit -m "refactor(portal): convert legacy workspaces into thin adapters over UnifiedAdaptiveWorkspace"
```

---

### Task 7: Central Dispatcher Integration in TasksFocusLanding & Quality Check

**Files:**
- Modify: `src/components/dashboard/zones/tasks-focus-landing.tsx`
- Test: `tests/tasks-focus-landing.test.ts`

**Interfaces:**
- Replaces hard if/else workspace branching with clean `<UnifiedAdaptiveWorkspace />` call.

- [x] **Step 1: Update `TasksFocusLanding`**

In `src/components/dashboard/zones/tasks-focus-landing.tsx`, import `UnifiedAdaptiveWorkspace` and replace the 3-way `isExecutive ? ... : isUnitView ? ... : ...` ternary with `<UnifiedAdaptiveWorkspace />`.

- [x] **Step 2: Run all test suites**

Run: `npm test`  
Expected: PASS (All test suites pass)

- [x] **Step 3: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS (0 type errors)

- [x] **Step 4: Commit**

```bash
git add src/components/dashboard/zones/tasks-focus-landing.tsx
git commit -m "feat(dashboard): integrate UnifiedAdaptiveWorkspace as single source of truth in tasks landing"
```
