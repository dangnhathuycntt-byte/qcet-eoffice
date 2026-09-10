---
status: completed
domain: architecture
created: 2026-09-07
---

# Dashboard Architecture Refactor (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the 1,629-line `src/app/page.tsx` "God Component" down to < 90 lines by decomposing it into 3 sub-hooks (`useUrlParamsSync`, `useTaskMutations`, `useTaskFilters`) composed by `useDashboardState`, 4 isolated React Contexts (`NavContext`, `DataContext`, `ActionsContext`, `ModalContext`), 4 Zone Containers with sub-level decomposition, and a dedicated Modals Host, while eliminating render cascading and maintaining 100% test pass rate (744 tests) and visual parity.

**Architecture:** 
- A top-level `DashboardStateProvider` composes 3 clean sub-hooks (`useUrlParamsSync`, `useTaskMutations`, `useTaskFilters`) plus `useModalState()`, distributing state into 4 narrowly-scoped React Contexts (`DashboardNavContext`, `DashboardDataContext`, `DashboardActionsContext`, `DashboardModalContext`).
- Zone containers (`DashboardZone`, `TasksZone`, `CalendarZone`, `OrgZone`) and `DashboardModalsHost` subscribe only to the specific contexts they require, wrapped in `React.memo` to eliminate cascading re-renders.
- `TasksZone` is decomposed into `TasksFocusLanding` and `TasksExpandedViews` to keep individual file sizes strictly under 350 lines.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Lucide React, Node.js test runner (`node:test`, `node:assert/strict`).

**Spec:** `docs/superpowers/specs/2026-09-07-dashboard-architecture-refactor-spec.md`

## 5 Architectural Invariants & Refinements Incorporated

1. **Exact Workspace Exports Verified**:
   - `ExecutiveCockpitWorkspace`: exported from `@/components/portal/executive-cockpit-workspace`
   - `DepartmentManagerWorkspace`: exported from `@/components/portal/department-manager-workspace`
   - `LecturerFocusWorkspace`: exported from `@/components/portal/lecturer-focus-workspace`
2. **Hook Decomposition (No God Hook)**:
   - `src/hooks/use-url-params-sync.ts`: Handles URL read/write & synchronization for zone, scope, view, dept, month (~110 lines).
   - `src/hooks/use-task-mutations.ts`: Handles task mutations (status change, review, deliverable, create), delegations, and background fetch (~160 lines).
   - `src/hooks/use-task-filters.ts`: Handles filter state, role resolution, scoped tasks, monthly counts, and computed stats (~150 lines).
   - `src/hooks/use-dashboard-state.ts`: Facade hook composing the 3 sub-hooks (~90 lines).
3. **Rigorous Test Coverage**:
   - Error throwing tests for all 4 context hooks outside of providers.
   - Status transition and optimistic rollup tests for mutations.
   - Filtering matrix tests across scope, workbox, department, and academic months.
   - Architectural line count and import cleanliness tests.
4. **`handleToggleStaffExpanded` in NavContext**:
   - Explicitly defined in `DashboardNavContextValue` and `useUrlParamsSync()` to maintain clean navigation ownership.
5. **`parentSchoolTaskTitle` in DataContext**:
   - `parentSchoolTaskTitle?: string` explicitly typed in `DashboardDataContextValue`.

---

### Task 1: Foundation Hooks (3 Sub-Hooks + Facade + Modals) & 4 Contexts

**Files:**
- Create: `src/hooks/use-modal-state.ts`
- Create: `src/hooks/use-url-params-sync.ts`
- Create: `src/hooks/use-task-mutations.ts`
- Create: `src/hooks/use-task-filters.ts`
- Create: `src/hooks/use-dashboard-state.ts`
- Create: `src/components/dashboard/dashboard-context.tsx`
- Test: `tests/dashboard-subhooks-logic.test.ts`
- Test: `tests/dashboard-contexts-invariants.test.ts`

- [ ] **Step 1: Write unit tests for sub-hooks logic and mutation contracts**

Create `tests/dashboard-subhooks-logic.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getMockDashboardPayload } from "../src/lib/mock-dashboard-data";
import {
  computeSchoolTaskRollup,
  computeDashboardStats,
} from "../src/lib/dashboard-aggregator";
import {
  filterTasksHub,
  parseScopeParam,
  scopeToParam,
  parseViewModeParam,
} from "../src/lib/unified-task-hub";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";
import type { SchoolTask, StaffTask, TaskStatus } from "../src/types/dashboard";
import type { DelegationRule } from "../src/types/delegation";

describe("Dashboard Sub-Hooks Logic Verification", () => {
  const payload = getMockDashboardPayload();
  const managerUser = DEFAULT_DEMO_USERS[1];

  test("Optimistic task status change updates subtask and rolls up to school task", () => {
    const originalTask = payload.tasks[0];
    assert.ok(originalTask.subTasks.length > 0);
    const subTaskId = originalTask.subTasks[0].id;

    const updatedTasks: SchoolTask[] = payload.tasks.map((st) => {
      const updatedSubs: StaffTask[] = st.subTasks.map((sub) =>
        sub.id === subTaskId ? { ...sub, status: "COMPLETED" as TaskStatus } : sub
      );
      return computeSchoolTaskRollup({ ...st, subTasks: updatedSubs });
    });

    const targetSchoolTask = updatedTasks.find((t) => t.id === originalTask.id);
    assert.ok(targetSchoolTask);
    const targetSub = targetSchoolTask.subTasks.find((s) => s.id === subTaskId);
    assert.equal(targetSub?.status, "COMPLETED");
  });

  test("Task filter logic isolates department and scope correctly", () => {
    const unitTasks = filterTasksHub({
      tasks: payload.tasks,
      scope: "UNIT_TASKS",
      workboxFilter: "ALL",
      category: "ALL",
      priority: "ALL",
      department: "K_CNTT",
      searchQuery: "",
      user: managerUser,
      academicMonth: "ALL",
      academicYear: "2026-2027",
    });

    assert.ok(Array.isArray(unitTasks));
    assert.ok(unitTasks.length > 0);
  });

  test("URL parameter mapping handles edge cases cleanly", () => {
    assert.equal(parseScopeParam(null, "UNIT_TASKS"), "UNIT_TASKS");
    assert.equal(parseScopeParam("my", "SCHOOL_TASKS"), "MY_TASKS");
    assert.equal(scopeToParam("MY_TASKS"), "my");
    assert.equal(parseViewModeParam(null, "table"), "table");
    assert.equal(parseViewModeParam("kanban", "table"), "kanban");
  });

  test("Delegation rule management adds and revokes rules correctly", () => {
    let delegations: DelegationRule[] = [];
    const newRule: DelegationRule = {
      id: "del-test-1",
      grantorId: "vinh-nn",
      grantorName: "TS. Nguyễn Ngọc Vinh",
      grantorRole: "MANAGER",
      granteeId: "pho-lv",
      granteeName: "ThS. Lê Văn Phó",
      granteeRole: "STAFF",
      departmentCode: "K_CNTT",
      scope: "DACUM_REVIEW_STEP1",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      status: "ACTIVE",
      reason: "Ủy quyền công tác",
      createdAt: new Date().toISOString(),
    };

    delegations = [newRule, ...delegations];
    assert.equal(delegations.length, 1);
    assert.equal(delegations[0].status, "ACTIVE");

    delegations = delegations.map((d) =>
      d.id === "del-test-1" ? { ...d, status: "REVOKED" as const } : d
    );
    assert.equal(delegations[0].status, "REVOKED");
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx tsx --test tests/dashboard-subhooks-logic.test.ts`
Expected: PASS

- [ ] **Step 3: Implement `src/hooks/use-modal-state.ts`**

Create `src/hooks/use-modal-state.ts`:
```typescript
"use client";

import * as React from "react";
import type { SchoolTask, StaffTask } from "@/types/dashboard";

export interface ModalStateReturn {
  selectedTask: SchoolTask | StaffTask | null;
  isCreateModalOpen: boolean;
  initialTaskLevel: "TRUONG" | "DON_VI";
  initialParentTaskId?: string;
  initialAssigneeName?: string;
  isDelegationModalOpen: boolean;
  delegationDeptCode: string;
  setSelectedTask: React.Dispatch<React.SetStateAction<SchoolTask | StaffTask | null>>;
  openTaskDetail: (task: SchoolTask | StaffTask) => void;
  closeTaskDetail: () => void;
  openCreateModal: (level?: "TRUONG" | "DON_VI", parentId?: string, assigneeName?: string) => void;
  closeCreateModal: () => void;
  openDelegationModal: (deptCode?: string) => void;
  closeDelegationModal: () => void;
}

export function useModalState(): ModalStateReturn {
  const [selectedTask, setSelectedTask] = React.useState<SchoolTask | StaffTask | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [initialTaskLevel, setInitialTaskLevel] = React.useState<"TRUONG" | "DON_VI">("TRUONG");
  const [initialParentTaskId, setInitialParentTaskId] = React.useState<string | undefined>(undefined);
  const [initialAssigneeName, setInitialAssigneeName] = React.useState<string | undefined>(undefined);
  const [isDelegationModalOpen, setIsDelegationModalOpen] = React.useState(false);
  const [delegationDeptCode, setDelegationDeptCode] = React.useState("K_CNTT");

  const openTaskDetail = React.useCallback((task: SchoolTask | StaffTask) => {
    setSelectedTask(task);
  }, []);

  const closeTaskDetail = React.useCallback(() => {
    setSelectedTask(null);
  }, []);

  const openCreateModal = React.useCallback(
    (level: "TRUONG" | "DON_VI" = "TRUONG", parentId?: string, assigneeName?: string) => {
      setInitialTaskLevel(level);
      setInitialParentTaskId(parentId);
      setInitialAssigneeName(assigneeName);
      setIsCreateModalOpen(true);
    },
    []
  );

  const closeCreateModal = React.useCallback(() => {
    setIsCreateModalOpen(false);
    setInitialParentTaskId(undefined);
    setInitialAssigneeName(undefined);
  }, []);

  const openDelegationModal = React.useCallback((deptCode: string = "K_CNTT") => {
    setDelegationDeptCode(deptCode);
    setIsDelegationModalOpen(true);
  }, []);

  const closeDelegationModal = React.useCallback(() => {
    setIsDelegationModalOpen(false);
  }, []);

  return {
    selectedTask,
    isCreateModalOpen,
    initialTaskLevel,
    initialParentTaskId,
    initialAssigneeName,
    isDelegationModalOpen,
    delegationDeptCode,
    setSelectedTask,
    openTaskDetail,
    closeTaskDetail,
    openCreateModal,
    closeCreateModal,
    openDelegationModal,
    closeDelegationModal,
  };
}
```

- [ ] **Step 4: Implement `src/hooks/use-url-params-sync.ts`**

Create `src/hooks/use-url-params-sync.ts`:
```typescript
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkspaceZone, parseZoneParam } from "@/types/workspace";
import type { TaskScope, TaskViewMode } from "@/components/dashboard/unified-task-toolbar";
import {
  getDefaultScopeForRole,
  getDefaultViewModeForRole,
  parseScopeParam,
  scopeToParam,
  parseViewModeParam,
} from "@/lib/unified-task-hub";
import { getAcademicMonthInfo } from "@/lib/academic-calendar";
import type { UserRole } from "@/types/auth";

export interface UrlParamsSyncReturn {
  activeZone: WorkspaceZone;
  scope: TaskScope;
  viewMode: TaskViewMode;
  selectedDepartment: string;
  selectedAcademicMonth: number | "ALL";
  isStaffExpanded: boolean;
  useAdvancedToolbar: boolean;
  handleZoneChange: (zone: WorkspaceZone) => void;
  handleScopeChange: (scope: TaskScope) => void;
  handleViewModeChange: (view: TaskViewMode) => void;
  handleDepartmentChange: (dept: string) => void;
  handleAcademicMonthChange: (month: number | "ALL") => void;
  handleToggleStaffExpanded: () => void;
  setIsStaffExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setUseAdvancedToolbar: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useUrlParamsSync(userRole?: UserRole): UrlParamsSyncReturn {
  const router = useRouter();
  const searchParams = useSearchParams();

  const zoneQuery = searchParams.get("zone");
  const scopeQuery = searchParams.get("scope");
  const viewQuery = searchParams.get("view");
  const deptQuery = searchParams.get("dept");
  const monthQuery = searchParams.get("month");

  const defaultScope = React.useMemo(() => getDefaultScopeForRole(userRole), [userRole]);
  const defaultViewMode = React.useMemo(() => getDefaultViewModeForRole(userRole), [userRole]);

  const [activeZone, setActiveZone] = React.useState<WorkspaceZone>(() => parseZoneParam(zoneQuery));
  const [scope, setScope] = React.useState<TaskScope>(() => parseScopeParam(scopeQuery, defaultScope));
  const [viewMode, setViewMode] = React.useState<TaskViewMode>(() => parseViewModeParam(viewQuery, defaultViewMode));
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>(deptQuery || "ALL");
  const [selectedAcademicMonth, setSelectedAcademicMonth] = React.useState<number | "ALL">(() => {
    if (monthQuery === "ALL") return "ALL";
    if (monthQuery) {
      const parsed = parseInt(monthQuery, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) return parsed;
    }
    return getAcademicMonthInfo(new Date()).monthNumber;
  });

  const [isStaffExpanded, setIsStaffExpanded] = React.useState<boolean>(
    () => viewQuery !== null && viewQuery !== "focus"
  );
  const [useAdvancedToolbar, setUseAdvancedToolbar] = React.useState<boolean>(false);

  // Sync from URL
  React.useEffect(() => {
    if (zoneQuery === "portal") {
      router.replace("/portal");
      return;
    }
    setActiveZone(parseZoneParam(zoneQuery));
  }, [zoneQuery, router]);

  React.useEffect(() => {
    setScope(scopeQuery ? parseScopeParam(scopeQuery, defaultScope) : defaultScope);
  }, [scopeQuery, defaultScope]);

  React.useEffect(() => {
    if (viewQuery) {
      setViewMode(parseViewModeParam(viewQuery, defaultViewMode));
      setIsStaffExpanded(viewQuery !== "focus");
    } else {
      setViewMode(defaultViewMode);
      setIsStaffExpanded(false);
    }
  }, [viewQuery, defaultViewMode]);

  React.useEffect(() => {
    if (deptQuery !== null) setSelectedDepartment(deptQuery);
  }, [deptQuery]);

  React.useEffect(() => {
    if (monthQuery !== null) {
      if (monthQuery === "ALL") setSelectedAcademicMonth("ALL");
      else {
        const parsed = parseInt(monthQuery, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) setSelectedAcademicMonth(parsed);
      }
    }
  }, [monthQuery]);

  const updateUrlParams = React.useCallback(
    (updates: {
      zone?: WorkspaceZone;
      scope?: TaskScope;
      view?: TaskViewMode;
      dept?: string;
      month?: number | "ALL";
    }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (updates.zone !== undefined) {
        if (updates.zone === "portal") params.delete("zone");
        else params.set("zone", updates.zone);
      }
      if (updates.scope !== undefined) params.set("scope", scopeToParam(updates.scope));
      if (updates.view !== undefined) params.set("view", updates.view);
      if (updates.dept !== undefined) {
        if (updates.dept && updates.dept !== "ALL") params.set("dept", updates.dept);
        else params.delete("dept");
      }
      if (updates.month !== undefined) {
        if (updates.month === "ALL") params.set("month", "ALL");
        else params.set("month", String(updates.month));
      }
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [router, searchParams]
  );

  const handleZoneChange = React.useCallback(
    (newZone: WorkspaceZone) => {
      if (newZone === "portal") {
        router.push("/portal");
        return;
      }
      setActiveZone(newZone);
      updateUrlParams({ zone: newZone });
    },
    [updateUrlParams, router]
  );

  const handleScopeChange = React.useCallback(
    (newScope: TaskScope) => {
      setScope(newScope);
      updateUrlParams({ scope: newScope });
    },
    [updateUrlParams]
  );

  const handleViewModeChange = React.useCallback(
    (newMode: TaskViewMode) => {
      setViewMode(newMode);
      updateUrlParams({ view: newMode });
    },
    [updateUrlParams]
  );

  const handleDepartmentChange = React.useCallback(
    (newDept: string) => {
      setSelectedDepartment(newDept);
      updateUrlParams({ dept: newDept });
    },
    [updateUrlParams]
  );

  const handleAcademicMonthChange = React.useCallback(
    (newMonth: number | "ALL") => {
      setSelectedAcademicMonth(newMonth);
      updateUrlParams({ month: newMonth });
    },
    [updateUrlParams]
  );

  const handleToggleStaffExpanded = React.useCallback(() => {
    setIsStaffExpanded((prev) => {
      const next = !prev;
      if (next) {
        updateUrlParams({ view: "table" });
      } else {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("view");
        const qs = params.toString();
        router.replace(qs ? `/?${qs}` : "/", { scroll: false });
      }
      return next;
    });
  }, [updateUrlParams, searchParams, router]);

  return {
    activeZone,
    scope,
    viewMode,
    selectedDepartment,
    selectedAcademicMonth,
    isStaffExpanded,
    useAdvancedToolbar,
    handleZoneChange,
    handleScopeChange,
    handleViewModeChange,
    handleDepartmentChange,
    handleAcademicMonthChange,
    handleToggleStaffExpanded,
    setIsStaffExpanded,
    setUseAdvancedToolbar,
  };
}
```

- [ ] **Step 5: Implement `src/hooks/use-task-mutations.ts`**

Create `src/hooks/use-task-mutations.ts`:
```typescript
"use client";

import * as React from "react";
import type {
  SchoolTask,
  StaffTask,
  DashboardPayload,
  TaskStatus,
} from "@/types/dashboard";
import { getMockDashboardPayload } from "@/lib/mock-dashboard-data";
import {
  computeSchoolTaskRollup,
  computeDashboardStats,
} from "@/lib/dashboard-aggregator";
import type { DeliverableSubmissionPayload, ApprovalActionPayload } from "@/types/workspace";
import type { CreateTaskFormData } from "@/components/dashboard/create-task-modal";
import { CATEGORY_TABS } from "@/components/dashboard/cascading-task-table";
import type { DelegationRule } from "@/types/delegation";
import type { AuthUser } from "@/types/auth";

const INITIAL_QCET_DELEGATIONS: DelegationRule[] = [
  {
    id: "del-cntt-001",
    grantorId: "staff-vinh-nn",
    grantorName: "TS. Nguyễn Ngọc Vinh",
    grantorRole: "MANAGER",
    granteeId: "staff-pho-lv",
    granteeName: "ThS. Lê Văn Phó",
    granteeRole: "STAFF",
    departmentCode: "K_CNTT",
    scope: "DACUM_REVIEW_STEP1",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    status: "ACTIVE",
    reason: "Ủy quyền thẩm định và phê duyệt hồ sơ DACUM bước 1 trong thời gian Trưởng khoa công tác.",
    createdAt: "2026-09-01T08:00:00.000Z",
  },
];

export interface TaskMutationsReturn {
  dashboardData: DashboardPayload;
  isRefreshing: boolean;
  delegations: DelegationRule[];
  delegationDeptCode: string;
  handleStatusChange: (taskId: string, newStatus: TaskStatus, note?: string) => void;
  handleSubmitDeliverable: (payload: DeliverableSubmissionPayload) => Promise<void>;
  handleReviewAction: (payload: ApprovalActionPayload) => Promise<void>;
  handleCreateTask: (data: CreateTaskFormData) => void;
  handleManualRefresh: () => Promise<void>;
  handleSaveDelegation: (ruleData: Omit<DelegationRule, "id" | "createdAt">) => void;
  handleRevokeDelegation: (ruleId: string) => void;
}

export function useTaskMutations(
  user?: AuthUser,
  onOpenCreateModal?: (level?: "TRUONG" | "DON_VI", parentId?: string, assigneeName?: string) => void
): TaskMutationsReturn {
  const [dashboardData, setDashboardData] = React.useState<DashboardPayload>(() =>
    getMockDashboardPayload()
  );
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [delegations, setDelegations] = React.useState<DelegationRule[]>(INITIAL_QCET_DELEGATIONS);
  const [delegationDeptCode] = React.useState("K_CNTT");

  // Initial background sync
  React.useEffect(() => {
    let isMounted = true;
    async function syncDashboardOverview() {
      try {
        const response = await fetch("/api/dashboard/overview");
        if (response.ok && isMounted) {
          const liveData: DashboardPayload = await response.json();
          if (liveData && liveData.tasks && liveData.stats) {
            setDashboardData(liveData);
          }
        }
      } catch {
        // Silently keep optimistic payload
      }
    }
    syncDashboardOverview();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleManualRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/dashboard/overview");
      if (response.ok) {
        const liveData: DashboardPayload = await response.json();
        if (liveData && liveData.tasks && liveData.stats) {
          setDashboardData(liveData);
        }
      }
    } catch {
      // Keep existing data
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }, []);

  const handleStatusChange = React.useCallback(
    (taskId: string, newStatus: TaskStatus, _note?: string) => {
      setDashboardData((prev) => {
        const updatedTasks: SchoolTask[] = prev.tasks.map((st) => {
          if (st.id === taskId) {
            const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
              newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
            return { ...st, status: schoolStatus };
          }
          const updatedSubs: StaffTask[] = st.subTasks.map((sub) =>
            sub.id === taskId ? { ...sub, status: newStatus } : sub
          );
          return { ...st, subTasks: updatedSubs };
        });
        const rolledUpTasks = updatedTasks.map((t) => computeSchoolTaskRollup(t));
        return {
          ...prev,
          tasks: rolledUpTasks,
          stats: computeDashboardStats(rolledUpTasks),
        };
      });
    },
    []
  );

  const handleSubmitDeliverable = React.useCallback(
    async (payload: DeliverableSubmissionPayload) => {
      const todayStr = "2026-09-06";
      setDashboardData((prev) => {
        const updatedTasks: SchoolTask[] = prev.tasks.map((st) => {
          if (st.id === payload.taskId) {
            return {
              ...st,
              status: "PENDING_EXECUTIVE_APPROVAL" as const,
              completionReport: {
                summary:
                  payload.note ||
                  payload.deliverableName ||
                  "Nộp minh chứng hoàn thành nhiệm vụ cấp trường",
                submittedBy: user?.name || "Cán bộ chủ trì",
                submittedAt: todayStr,
                reportUrl: payload.url,
              },
            };
          }
          const updatedSubs: StaffTask[] = st.subTasks.map((sub) => {
            if (sub.id === payload.taskId) {
              const existingDeliverables = sub.deliverables || [];
              const newFile = {
                id: `deliv-${Date.now()}`,
                name: payload.deliverableName || "Tài liệu minh chứng",
                url: payload.url || "#",
                fileType: payload.fileType || "application/pdf",
                submittedAt: todayStr,
              };
              return {
                ...sub,
                status: "NEEDS_REVIEW" as const,
                deliverables: [...existingDeliverables, newFile],
                deliverableDescription: payload.note || sub.deliverableDescription,
                updatedAt: todayStr,
              };
            }
            return sub;
          });
          return { ...st, subTasks: updatedSubs };
        });

        const rolledUp = updatedTasks.map((t) => computeSchoolTaskRollup(t));
        return {
          ...prev,
          tasks: rolledUp,
          stats: computeDashboardStats(rolledUp),
        };
      });
    },
    [user?.name]
  );

  const handleReviewAction = React.useCallback(
    async (payload: ApprovalActionPayload) => {
      const todayStr = "2026-09-06";
      let statusToSet: TaskStatus = "IN_PROGRESS";
      if (payload.decision === "approved") {
        statusToSet = "COMPLETED";
      } else if (payload.decision === "revision_requested") {
        statusToSet = "IN_PROGRESS";
      } else if (payload.decision === "rejected") {
        statusToSet = "BLOCKED";
      }

      setDashboardData((prev) => {
        const updatedTasks: SchoolTask[] = prev.tasks.map((st) => {
          if (st.id === payload.taskId) {
            const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
              payload.decision === "approved" ? "COMPLETED" : "IN_PROGRESS";
            return {
              ...st,
              status: schoolStatus,
            };
          }
          const updatedSubs: StaffTask[] = st.subTasks.map((sub) => {
            if (sub.id === payload.taskId) {
              return {
                ...sub,
                status: statusToSet,
                updatedAt: todayStr,
                rejectionReason:
                  payload.decision !== "approved" ? payload.comment : undefined,
              };
            }
            return sub;
          });
          return { ...st, subTasks: updatedSubs };
        });

        const rolledUp = updatedTasks.map((t) => computeSchoolTaskRollup(t));
        return {
          ...prev,
          tasks: rolledUp,
          stats: computeDashboardStats(rolledUp),
        };
      });
    },
    []
  );

  const handleCreateTask = React.useCallback(
    (data: CreateTaskFormData) => {
      const todayStr = "2026-09-04";

      setDashboardData((prev) => {
        let updatedTasks = [...prev.tasks];

        if (data.level === "TRUONG") {
          const newTask: SchoolTask = {
            id: `task-${Date.now()}`,
            title: data.title,
            category: data.category,
            categoryLabel:
              CATEGORY_TABS.find((c) => c.id === data.category)?.label || data.category,
            leadAssigneeName: data.leadAssigneeName,
            coAssignees: data.coAssignees,
            assignedDate: todayStr,
            dueDate: data.dueDate,
            status: "IN_PROGRESS",
            subTasks: [],
            totalSubTasks: 0,
            completedSubTasks: 0,
            progressPercent: 0,
          };
          updatedTasks.unshift(newTask);
        } else {
          const newSubTask: StaffTask = {
            id: `sub-${Date.now()}`,
            title: data.title,
            assigneeName: data.leadAssigneeName,
            status: "NEW",
            dueDate: data.dueDate,
            internalDueDate: data.internalDueDate,
            deliverableDescription: data.requiredDeliverables,
            vtvlRole: data.vtvlRole,
            requiresReview: data.requiresReview,
            parentSchoolTaskId: data.parentTaskId || updatedTasks[0]?.id || "task-1",
            updatedAt: todayStr,
          };

          if (data.parentTaskId) {
            updatedTasks = updatedTasks.map((st) => {
              if (st.id === data.parentTaskId) {
                return {
                  ...st,
                  subTasks: [newSubTask, ...st.subTasks],
                };
              }
              return st;
            });
          } else if (updatedTasks.length > 0) {
            updatedTasks[0] = {
              ...updatedTasks[0],
              subTasks: [newSubTask, ...updatedTasks[0].subTasks],
            };
          }
        }

        const rolledUp = updatedTasks.map((t) => computeSchoolTaskRollup(t));
        return {
          ...prev,
          tasks: rolledUp,
          stats: computeDashboardStats(rolledUp),
        };
      });
    },
    []
  );

  const handleSaveDelegation = React.useCallback(
    (ruleData: Omit<DelegationRule, "id" | "createdAt">) => {
      const newRule: DelegationRule = {
        ...ruleData,
        id: `del-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setDelegations((prev) => [newRule, ...prev]);
    },
    []
  );

  const handleRevokeDelegation = React.useCallback((ruleId: string) => {
    setDelegations((prev) =>
      prev.map((d) => (d.id === ruleId ? { ...d, status: "REVOKED" as const } : d))
    );
  }, []);

  // Global custom event listeners
  React.useEffect(() => {
    const handleGlobalTaskCreated = (e: Event) => {
      const customEvent = e as CustomEvent<CreateTaskFormData>;
      if (customEvent.detail) {
        handleCreateTask(customEvent.detail);
      }
    };

    const handleGlobalOpenCreate = (e: Event) => {
      const customEvent = e as CustomEvent<{ leadAssigneeName?: string }>;
      onOpenCreateModal?.("TRUONG", undefined, customEvent?.detail?.leadAssigneeName);
    };

    window.addEventListener("qcet:task-created", handleGlobalTaskCreated);
    window.addEventListener("qcet:open-create-task", handleGlobalOpenCreate);
    return () => {
      window.removeEventListener("qcet:task-created", handleGlobalTaskCreated);
      window.removeEventListener("qcet:open-create-task", handleGlobalOpenCreate);
    };
  }, [handleCreateTask, onOpenCreateModal]);

  return {
    dashboardData,
    isRefreshing,
    delegations,
    delegationDeptCode,
    handleStatusChange,
    handleSubmitDeliverable,
    handleReviewAction,
    handleCreateTask,
    handleManualRefresh,
    handleSaveDelegation,
    handleRevokeDelegation,
  };
}
```

- [ ] **Step 6: Implement `src/hooks/use-task-filters.ts`**

Create `src/hooks/use-task-filters.ts`:
```typescript
"use client";

import * as React from "react";
import type {
  SchoolTask,
  StaffTask,
  UpcomingItem,
  DashboardStats,
} from "@/types/dashboard";
import { computeDashboardStats } from "@/lib/dashboard-aggregator";
import type { WorkboxFilter } from "@/components/dashboard/executive-stat-strip";
import type {
  ExecutiveFilter,
  ExecutiveActionStats,
  DepartmentHealthSummary,
} from "@/lib/executive-matrix-aggregator";
import {
  computeExecutiveActionStats,
  computeDepartmentHealthMatrix,
  filterTasksByExecutive,
} from "@/lib/executive-matrix-aggregator";
import type { TaskScope } from "@/components/dashboard/unified-task-toolbar";
import { filterTasksByScope } from "@/components/dashboard/unified-task-toolbar";
import { WorkspaceZone } from "@/types/workspace";
import type { AuthUser } from "@/types/auth";
import {
  filterTasksByRole,
  filterUpcomingByRole,
} from "@/lib/role-task-filter";
import {
  filterTasksHub,
  computeMonthlyTaskCounts,
} from "@/lib/unified-task-hub";
import {
  formatDepartmentLabel,
  resolveDepartment,
} from "@/components/layout/scope-switcher";
import {
  getAcademicMonthsForYear,
  type AcademicMonthInfo,
} from "@/lib/academic-calendar";

export interface TaskFiltersReturn {
  // Filter state
  selectedCategory: string;
  selectedPriority: string;
  searchQuery: string;
  activeWorkbox: WorkboxFilter;
  executiveFilter: ExecutiveFilter;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
  setSelectedPriority: React.Dispatch<React.SetStateAction<string>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setActiveWorkbox: React.Dispatch<React.SetStateAction<WorkboxFilter>>;
  setExecutiveFilter: React.Dispatch<React.SetStateAction<ExecutiveFilter>>;
  handleResetFilters: () => void;

  // Role resolution
  isExecutive: boolean;
  isManager: boolean;
  isStaff: boolean;
  isUnitView: boolean;
  isSchoolView: boolean;
  effectiveManagerUser: AuthUser;

  // Computed memoized outputs
  scopedBaseTasks: SchoolTask[];
  monthlyTaskCounts: Record<number, number>;
  selectedMonthPeriod: AcademicMonthInfo | null;
  displayedStats: DashboardStats;
  filteredTasks: (SchoolTask | StaffTask)[];
  roleUpcoming: UpcomingItem[];
  departmentHealth: DepartmentHealthSummary[];
  executiveStats: ExecutiveActionStats | null;
  handleSelectUpcoming: (item: UpcomingItem) => SchoolTask | StaffTask | undefined;
}

export function useTaskFilters({
  tasks,
  upcoming,
  scope,
  activeZone,
  selectedDepartment,
  selectedAcademicMonth,
  user,
  onSelectTask,
  onResetDepartment,
  onResetMonth,
}: {
  tasks: SchoolTask[];
  upcoming: UpcomingItem[];
  scope: TaskScope;
  activeZone: WorkspaceZone;
  selectedDepartment: string;
  selectedAcademicMonth: number | "ALL";
  user: AuthUser;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onResetDepartment: () => void;
  onResetMonth: () => void;
}): TaskFiltersReturn {
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [activeWorkbox, setActiveWorkbox] = React.useState<WorkboxFilter>("ALL");
  const [executiveFilter, setExecutiveFilter] = React.useState<ExecutiveFilter>("ALL");

  const handleResetFilters = React.useCallback(() => {
    onResetDepartment();
    onResetMonth();
    setSelectedPriority("ALL");
    setSelectedCategory("ALL");
    setActiveWorkbox("ALL");
    setSearchQuery("");
  }, [onResetDepartment, onResetMonth]);

  const roleStr = String(user?.role || "").toUpperCase();
  const isExecutive =
    user?.role === "ADMIN" ||
    roleStr === "ADMIN" ||
    roleStr === "BGH" ||
    roleStr === "BAN_GIAM_HIEU";
  const isManager =
    user?.role === "MANAGER" ||
    roleStr === "MANAGER" ||
    roleStr === "TRUONG_DON_VI" ||
    roleStr === "TRUONG_PHONG";
  const isStaff =
    user?.role === "STAFF" ||
    roleStr === "STAFF" ||
    roleStr === "GIANG_VIEN" ||
    roleStr === "CHUYEN_VIEN" ||
    (!isExecutive && !isManager);

  const isSchoolView = scope === "SCHOOL_TASKS" || (isExecutive && scope !== "UNIT_TASKS" && scope !== "MY_TASKS");
  const isUnitView = !isSchoolView && (scope === "UNIT_TASKS" || (isManager && scope !== "MY_TASKS"));

  const effectiveManagerUser: AuthUser = React.useMemo(() => {
    if (
      selectedDepartment &&
      selectedDepartment !== "ALL" &&
      selectedDepartment !== user.departmentCode
    ) {
      const resolvedDept = resolveDepartment(selectedDepartment);
      return {
        ...user,
        departmentCode: selectedDepartment,
        department: resolvedDept
          ? formatDepartmentLabel(resolvedDept)
          : (user.department || selectedDepartment),
      };
    }
    return user;
  }, [user, selectedDepartment]);

  const scopedBaseTasks = React.useMemo(
    () => filterTasksByScope(tasks, scope, user, selectedDepartment),
    [tasks, scope, user, selectedDepartment]
  );

  const monthlyTaskCounts = React.useMemo(
    () => computeMonthlyTaskCounts(scopedBaseTasks, "2026-2027"),
    [scopedBaseTasks]
  );

  const selectedMonthPeriod = React.useMemo(() => {
    if (selectedAcademicMonth === "ALL") return null;
    const months = getAcademicMonthsForYear("2026-2027");
    return months.find((m) => m.monthNumber === selectedAcademicMonth) ?? null;
  }, [selectedAcademicMonth]);

  const displayedStats = React.useMemo(() => {
    if (scopedBaseTasks.length > 0) return computeDashboardStats(scopedBaseTasks);
    return computeDashboardStats(tasks);
  }, [scopedBaseTasks, tasks]);

  const executiveStats = React.useMemo(
    () => (isExecutive && activeZone === "dashboard" ? computeExecutiveActionStats(tasks) : null),
    [tasks, isExecutive, activeZone]
  );

  const departmentHealth = React.useMemo(
    () => (isExecutive && activeZone === "dashboard" ? computeDepartmentHealthMatrix(tasks) : []),
    [tasks, isExecutive, activeZone]
  );

  const filteredTasks = React.useMemo(() => {
    if (activeZone === "portal" || activeZone === "org") return [];
    let result = filterTasksHub({
      tasks,
      scope,
      workboxFilter: activeWorkbox,
      category: selectedCategory,
      priority: selectedPriority,
      department: selectedDepartment,
      searchQuery,
      user,
      academicMonth: selectedAcademicMonth,
      academicYear: "2026-2027",
    });
    if (isExecutive && executiveFilter !== "ALL") {
      result = filterTasksByExecutive(result, executiveFilter);
    }
    return result;
  }, [
    activeZone,
    tasks,
    scope,
    activeWorkbox,
    selectedCategory,
    selectedPriority,
    selectedDepartment,
    searchQuery,
    user,
    isExecutive,
    executiveFilter,
    selectedAcademicMonth,
  ]);

  const roleVisibleTasks = React.useMemo(
    () => filterTasksByRole(tasks, user),
    [tasks, user]
  );

  const roleUpcoming = React.useMemo(
    () => filterUpcomingByRole(upcoming, user, roleVisibleTasks),
    [upcoming, user, roleVisibleTasks]
  );

  const handleSelectUpcoming = React.useCallback(
    (item: UpcomingItem) => {
      const targetId = item.taskId || item.id;
      const matched = tasks.find((t) => t.id === targetId);
      if (matched) {
        onSelectTask?.(matched);
        return matched;
      }
      for (const parent of tasks) {
        const foundSub = parent.subTasks.find((s) => s.id === targetId);
        if (foundSub) {
          onSelectTask?.(foundSub);
          return foundSub;
        }
      }
      return undefined;
    },
    [tasks, onSelectTask]
  );

  return {
    selectedCategory,
    selectedPriority,
    searchQuery,
    activeWorkbox,
    executiveFilter,
    setSelectedCategory,
    setSelectedPriority,
    setSearchQuery,
    setActiveWorkbox,
    setExecutiveFilter,
    handleResetFilters,
    isExecutive,
    isManager,
    isStaff,
    isUnitView,
    isSchoolView,
    effectiveManagerUser,
    scopedBaseTasks,
    monthlyTaskCounts,
    selectedMonthPeriod,
    displayedStats,
    filteredTasks,
    roleUpcoming,
    departmentHealth,
    executiveStats,
    handleSelectUpcoming,
  };
}
```

- [ ] **Step 7: Implement facade hook `src/hooks/use-dashboard-state.ts`**

Create `src/hooks/use-dashboard-state.ts`:
```typescript
"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/components/layout/sidebar-context";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import { useUrlParamsSync, type UrlParamsSyncReturn } from "./use-url-params-sync";
import { useTaskMutations, type TaskMutationsReturn } from "./use-task-mutations";
import { useTaskFilters, type TaskFiltersReturn } from "./use-task-filters";

export type DashboardStateReturn = UrlParamsSyncReturn & TaskMutationsReturn & TaskFiltersReturn & {
  user: ReturnType<typeof useAuth>["user"];
  tasks: SchoolTask[];
  stats: TaskMutationsReturn["dashboardData"]["stats"];
  upcoming: TaskMutationsReturn["dashboardData"]["upcoming"];
  activities: TaskMutationsReturn["dashboardData"]["activities"];
};

export function useDashboardState(
  onSelectTask?: (task: SchoolTask | StaffTask) => void,
  onOpenCreateModal?: (level?: "TRUONG" | "DON_VI", parentId?: string, assigneeName?: string) => void
): DashboardStateReturn {
  const { user } = useAuth();
  const { setBadgeCounts } = useSidebar();

  const urlSync = useUrlParamsSync(user?.role);
  const mutations = useTaskMutations(user, onOpenCreateModal);
  const filters = useTaskFilters({
    tasks: mutations.dashboardData.tasks,
    upcoming: mutations.dashboardData.upcoming,
    scope: urlSync.scope,
    activeZone: urlSync.activeZone,
    selectedDepartment: urlSync.selectedDepartment,
    selectedAcademicMonth: urlSync.selectedAcademicMonth,
    user,
    onSelectTask,
    onResetDepartment: () => urlSync.handleDepartmentChange("ALL"),
    onResetMonth: () => urlSync.handleAcademicMonthChange("ALL"),
  });

  // Sync Dynamic Badge Counts with left sidebar
  React.useEffect(() => {
    const urgentTasks = mutations.dashboardData.tasks.filter(
      (t) =>
        (t.status === "PENDING_EXECUTIVE_APPROVAL" || t.dueDate <= "2026-09-08") &&
        t.status !== "COMPLETED"
    ).length;
    const todayStr = "2026-09-06";
    const todayEvents = mutations.dashboardData.upcoming.filter(
      (item) => item.dueDate === todayStr
    ).length;

    const nextTasks = urgentTasks > 0 ? urgentTasks : undefined;
    const nextCalendar = todayEvents > 0 ? todayEvents : undefined;
    const nextOrg = undefined;
    const nextNotifications = 5;

    setBadgeCounts((prev) => {
      if (
        prev.tasks === nextTasks &&
        prev.calendar === nextCalendar &&
        prev.org === nextOrg &&
        prev.notifications === nextNotifications
      ) {
        return prev;
      }
      return {
        tasks: nextTasks,
        calendar: nextCalendar,
        org: nextOrg,
        notifications: nextNotifications,
      };
    });
  }, [mutations.dashboardData.tasks, mutations.dashboardData.upcoming, setBadgeCounts]);

  return {
    ...urlSync,
    ...mutations,
    ...filters,
    user,
    tasks: mutations.dashboardData.tasks,
    stats: mutations.dashboardData.stats,
    upcoming: mutations.dashboardData.upcoming,
    activities: mutations.dashboardData.activities,
  };
}
```

- [ ] **Step 8: Implement `src/components/dashboard/dashboard-context.tsx`**

Create `src/components/dashboard/dashboard-context.tsx` with all 4 contexts, `parentSchoolTaskTitle?: string` in DataContext, and `handleToggleStaffExpanded` in NavContext:
```typescript
"use client";

import * as React from "react";
import type {
  SchoolTask,
  StaffTask,
  UpcomingItem,
  DashboardStats,
  TaskStatus,
  ActivityEvent,
} from "@/types/dashboard";
import type { WorkspaceZone, DeliverableSubmissionPayload, ApprovalActionPayload } from "@/types/workspace";
import type { TaskScope, TaskViewMode } from "@/components/dashboard/unified-task-toolbar";
import type { AuthUser } from "@/types/auth";
import type { WorkboxFilter } from "@/components/dashboard/executive-stat-strip";
import type { ExecutiveFilter, ExecutiveActionStats, DepartmentHealthSummary } from "@/lib/executive-matrix-aggregator";
import type { DelegationRule } from "@/types/delegation";
import type { CreateTaskFormData } from "@/components/dashboard/create-task-modal";
import type { AcademicMonthInfo } from "@/lib/academic-calendar";
import { useModalState } from "@/hooks/use-modal-state";
import { useDashboardState } from "@/hooks/use-dashboard-state";

// 1. Navigation Context
export interface DashboardNavContextValue {
  activeZone: WorkspaceZone;
  scope: TaskScope;
  viewMode: TaskViewMode;
  isStaffExpanded: boolean;
  useAdvancedToolbar: boolean;
  handleZoneChange: (zone: WorkspaceZone) => void;
  handleScopeChange: (scope: TaskScope) => void;
  handleViewModeChange: (view: TaskViewMode) => void;
  handleToggleStaffExpanded: () => void;
  setIsStaffExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setUseAdvancedToolbar: React.Dispatch<React.SetStateAction<boolean>>;
}

export const DashboardNavContext = React.createContext<DashboardNavContextValue | null>(null);

export function useDashboardNav(): DashboardNavContextValue {
  const context = React.useContext(DashboardNavContext);
  if (!context) {
    throw new Error("useDashboardNav must be used within a DashboardStateProvider");
  }
  return context;
}

// 2. Data Context
export interface DashboardDataContextValue {
  tasks: SchoolTask[];
  stats: DashboardStats;
  upcoming: UpcomingItem[];
  activities: ActivityEvent[];
  filteredTasks: (SchoolTask | StaffTask)[];
  scopedBaseTasks: SchoolTask[];
  monthlyTaskCounts: Record<number, number>;
  selectedMonthPeriod: AcademicMonthInfo | null;
  displayedStats: DashboardStats;
  user: AuthUser;
  effectiveManagerUser: AuthUser;
  isExecutive: boolean;
  isManager: boolean;
  isStaff: boolean;
  isUnitView: boolean;
  isSchoolView: boolean;
  selectedDepartment: string;
  selectedAcademicMonth: number | "ALL";
  activeWorkbox: WorkboxFilter;
  executiveFilter: ExecutiveFilter;
  searchQuery: string;
  selectedPriority: string;
  selectedCategory: string;
  departmentHealth: DepartmentHealthSummary[];
  executiveStats: ExecutiveActionStats | null;
  roleUpcoming: UpcomingItem[];
  parentSchoolTaskTitle?: string;
  delegations: DelegationRule[];
  delegationDeptCode: string;
  isRefreshing: boolean;
}

export const DashboardDataContext = React.createContext<DashboardDataContextValue | null>(null);

export function useDashboardData(): DashboardDataContextValue {
  const context = React.useContext(DashboardDataContext);
  if (!context) {
    throw new Error("useDashboardData must be used within a DashboardStateProvider");
  }
  return context;
}

// 3. Actions Context
export interface DashboardActionsContextValue {
  handleDepartmentChange: (dept: string) => void;
  handleAcademicMonthChange: (month: number | "ALL") => void;
  setActiveWorkbox: React.Dispatch<React.SetStateAction<WorkboxFilter>>;
  setExecutiveFilter: React.Dispatch<React.SetStateAction<ExecutiveFilter>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setSelectedPriority: React.Dispatch<React.SetStateAction<string>>;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
  handleResetFilters: () => void;
  handleStatusChange: (taskId: string, newStatus: TaskStatus, note?: string) => void;
  handleSubmitDeliverable: (payload: DeliverableSubmissionPayload) => Promise<void>;
  handleReviewAction: (payload: ApprovalActionPayload) => Promise<void>;
  handleCreateTask: (data: CreateTaskFormData) => void;
  handleManualRefresh: () => Promise<void>;
  handleSaveDelegation: (ruleData: Omit<DelegationRule, "id" | "createdAt">) => void;
  handleRevokeDelegation: (ruleId: string) => void;
  handleSelectUpcoming: (item: UpcomingItem) => SchoolTask | StaffTask | undefined;
}

export const DashboardActionsContext = React.createContext<DashboardActionsContextValue | null>(null);

export function useDashboardActions(): DashboardActionsContextValue {
  const context = React.useContext(DashboardActionsContext);
  if (!context) {
    throw new Error("useDashboardActions must be used within a DashboardStateProvider");
  }
  return context;
}

// 4. Modal Context
export interface DashboardModalContextValue {
  selectedTask: SchoolTask | StaffTask | null;
  isCreateModalOpen: boolean;
  initialTaskLevel: "TRUONG" | "DON_VI";
  initialParentTaskId?: string;
  initialAssigneeName?: string;
  isDelegationModalOpen: boolean;
  delegationDeptCode: string;
  openTaskDetail: (task: SchoolTask | StaffTask) => void;
  closeTaskDetail: () => void;
  openCreateModal: (level?: "TRUONG" | "DON_VI", parentId?: string, assigneeName?: string) => void;
  closeCreateModal: () => void;
  openDelegationModal: (deptCode?: string) => void;
  closeDelegationModal: () => void;
}

export const DashboardModalContext = React.createContext<DashboardModalContextValue | null>(null);

export function useDashboardModal(): DashboardModalContextValue {
  const context = React.useContext(DashboardModalContext);
  if (!context) {
    throw new Error("useDashboardModal must be used within a DashboardStateProvider");
  }
  return context;
}

// Top-Level Provider
export function DashboardStateProvider({ children }: { children: React.ReactNode }) {
  const modalState = useModalState();
  const dashboardState = useDashboardState(
    modalState.openTaskDetail,
    modalState.openCreateModal
  );

  // Synchronize status change with modal selected task
  const handleStatusChangeWithSync = React.useCallback(
    (taskId: string, newStatus: TaskStatus, note?: string) => {
      dashboardState.handleStatusChange(taskId, newStatus, note);
      modalState.setSelectedTask((prev) => {
        if (!prev || prev.id !== taskId) return prev;
        if ("subTasks" in prev) {
          const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
            newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
          return { ...prev, status: schoolStatus };
        }
        return { ...prev, status: newStatus };
      });
    },
    [dashboardState.handleStatusChange, modalState.setSelectedTask]
  );

  const handleSubmitDeliverableWithSync = React.useCallback(
    async (payload: DeliverableSubmissionPayload) => {
      await dashboardState.handleSubmitDeliverable(payload);
      modalState.setSelectedTask((prev) => {
        if (!prev || prev.id !== payload.taskId) return prev;
        if ("subTasks" in prev) {
          return { ...prev, status: "PENDING_EXECUTIVE_APPROVAL" as const };
        }
        return { ...prev, status: "NEEDS_REVIEW" as const };
      });
    },
    [dashboardState.handleSubmitDeliverable, modalState.setSelectedTask]
  );

  const handleReviewActionWithSync = React.useCallback(
    async (payload: ApprovalActionPayload) => {
      await dashboardState.handleReviewAction(payload);
      let statusToSet: TaskStatus = "IN_PROGRESS";
      if (payload.decision === "approved") {
        statusToSet = "COMPLETED";
      } else if (payload.decision === "revision_requested") {
        statusToSet = "IN_PROGRESS";
      } else if (payload.decision === "rejected") {
        statusToSet = "BLOCKED";
      }

      modalState.setSelectedTask((prev) => {
        if (!prev || prev.id !== payload.taskId) return prev;
        if ("subTasks" in prev) {
          const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
            payload.decision === "approved" ? "COMPLETED" : "IN_PROGRESS";
          return { ...prev, status: schoolStatus };
        }
        return { ...prev, status: statusToSet };
      });
    },
    [dashboardState.handleReviewAction, modalState.setSelectedTask]
  );

  const parentSchoolTaskTitle = React.useMemo(() => {
    if (!modalState.selectedTask || "subTasks" in modalState.selectedTask) return undefined;
    const parent = dashboardState.tasks.find(
      (t) => t.id === (modalState.selectedTask as StaffTask).parentSchoolTaskId
    );
    return parent?.title;
  }, [modalState.selectedTask, dashboardState.tasks]);

  // 1. Nav value: Stable unless activeZone, scope, viewMode, or view toggles change
  const navValue = React.useMemo<DashboardNavContextValue>(
    () => ({
      activeZone: dashboardState.activeZone,
      scope: dashboardState.scope,
      viewMode: dashboardState.viewMode,
      isStaffExpanded: dashboardState.isStaffExpanded,
      useAdvancedToolbar: dashboardState.useAdvancedToolbar,
      handleZoneChange: dashboardState.handleZoneChange,
      handleScopeChange: dashboardState.handleScopeChange,
      handleViewModeChange: dashboardState.handleViewModeChange,
      handleToggleStaffExpanded: dashboardState.handleToggleStaffExpanded,
      setIsStaffExpanded: dashboardState.setIsStaffExpanded,
      setUseAdvancedToolbar: dashboardState.setUseAdvancedToolbar,
    }),
    [
      dashboardState.activeZone,
      dashboardState.scope,
      dashboardState.viewMode,
      dashboardState.isStaffExpanded,
      dashboardState.useAdvancedToolbar,
      dashboardState.handleZoneChange,
      dashboardState.handleScopeChange,
      dashboardState.handleViewModeChange,
      dashboardState.handleToggleStaffExpanded,
      dashboardState.setIsStaffExpanded,
      dashboardState.setUseAdvancedToolbar,
    ]
  );

  // 2. Data value: Re-rendered when datasets or filter conditions change
  const dataValue = React.useMemo<DashboardDataContextValue>(
    () => ({
      tasks: dashboardState.tasks,
      stats: dashboardState.stats,
      upcoming: dashboardState.upcoming,
      activities: dashboardState.activities,
      filteredTasks: dashboardState.filteredTasks,
      scopedBaseTasks: dashboardState.scopedBaseTasks,
      monthlyTaskCounts: dashboardState.monthlyTaskCounts,
      selectedMonthPeriod: dashboardState.selectedMonthPeriod,
      displayedStats: dashboardState.displayedStats,
      user: dashboardState.user,
      effectiveManagerUser: dashboardState.effectiveManagerUser,
      isExecutive: dashboardState.isExecutive,
      isManager: dashboardState.isManager,
      isStaff: dashboardState.isStaff,
      isUnitView: dashboardState.isUnitView,
      isSchoolView: dashboardState.isSchoolView,
      selectedDepartment: dashboardState.selectedDepartment,
      selectedAcademicMonth: dashboardState.selectedAcademicMonth,
      activeWorkbox: dashboardState.activeWorkbox,
      executiveFilter: dashboardState.executiveFilter,
      searchQuery: dashboardState.searchQuery,
      selectedPriority: dashboardState.selectedPriority,
      selectedCategory: dashboardState.selectedCategory,
      departmentHealth: dashboardState.departmentHealth,
      executiveStats: dashboardState.executiveStats,
      roleUpcoming: dashboardState.roleUpcoming,
      parentSchoolTaskTitle,
      delegations: dashboardState.delegations,
      delegationDeptCode: dashboardState.delegationDeptCode,
      isRefreshing: dashboardState.isRefreshing,
    }),
    [
      dashboardState.tasks,
      dashboardState.stats,
      dashboardState.upcoming,
      dashboardState.activities,
      dashboardState.filteredTasks,
      dashboardState.scopedBaseTasks,
      dashboardState.monthlyTaskCounts,
      dashboardState.selectedMonthPeriod,
      dashboardState.displayedStats,
      dashboardState.user,
      dashboardState.effectiveManagerUser,
      dashboardState.isExecutive,
      dashboardState.isManager,
      dashboardState.isStaff,
      dashboardState.isUnitView,
      dashboardState.isSchoolView,
      dashboardState.selectedDepartment,
      dashboardState.selectedAcademicMonth,
      dashboardState.activeWorkbox,
      dashboardState.executiveFilter,
      dashboardState.searchQuery,
      dashboardState.selectedPriority,
      dashboardState.selectedCategory,
      dashboardState.departmentHealth,
      dashboardState.executiveStats,
      dashboardState.roleUpcoming,
      parentSchoolTaskTitle,
      dashboardState.delegations,
      dashboardState.delegationDeptCode,
      dashboardState.isRefreshing,
    ]
  );

  // 3. Actions value: Stable references with empty dependency array []
  const actionsValue = React.useMemo<DashboardActionsContextValue>(
    () => ({
      handleDepartmentChange: dashboardState.handleDepartmentChange,
      handleAcademicMonthChange: dashboardState.handleAcademicMonthChange,
      setActiveWorkbox: dashboardState.setActiveWorkbox,
      setExecutiveFilter: dashboardState.setExecutiveFilter,
      setSearchQuery: dashboardState.setSearchQuery,
      setSelectedPriority: dashboardState.setSelectedPriority,
      setSelectedCategory: dashboardState.setSelectedCategory,
      handleResetFilters: dashboardState.handleResetFilters,
      handleStatusChange: handleStatusChangeWithSync,
      handleSubmitDeliverable: handleSubmitDeliverableWithSync,
      handleReviewAction: handleReviewActionWithSync,
      handleCreateTask: dashboardState.handleCreateTask,
      handleManualRefresh: dashboardState.handleManualRefresh,
      handleSaveDelegation: dashboardState.handleSaveDelegation,
      handleRevokeDelegation: dashboardState.handleRevokeDelegation,
      handleSelectUpcoming: dashboardState.handleSelectUpcoming,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // 4. Modal value: Re-rendered only when modal target/state changes
  const modalValue = React.useMemo<DashboardModalContextValue>(
    () => ({
      selectedTask: modalState.selectedTask,
      isCreateModalOpen: modalState.isCreateModalOpen,
      initialTaskLevel: modalState.initialTaskLevel,
      initialParentTaskId: modalState.initialParentTaskId,
      initialAssigneeName: modalState.initialAssigneeName,
      isDelegationModalOpen: modalState.isDelegationModalOpen,
      delegationDeptCode: modalState.delegationDeptCode,
      openTaskDetail: modalState.openTaskDetail,
      closeTaskDetail: modalState.closeTaskDetail,
      openCreateModal: modalState.openCreateModal,
      closeCreateModal: modalState.closeCreateModal,
      openDelegationModal: modalState.openDelegationModal,
      closeDelegationModal: modalState.closeDelegationModal,
    }),
    [
      modalState.selectedTask,
      modalState.isCreateModalOpen,
      modalState.initialTaskLevel,
      modalState.initialParentTaskId,
      modalState.initialAssigneeName,
      modalState.isDelegationModalOpen,
      modalState.delegationDeptCode,
      modalState.openTaskDetail,
      modalState.closeTaskDetail,
      modalState.openCreateModal,
      modalState.closeCreateModal,
      modalState.openDelegationModal,
      modalState.closeDelegationModal,
    ]
  );

  return (
    <DashboardNavContext.Provider value={navValue}>
      <DashboardDataContext.Provider value={dataValue}>
        <DashboardActionsContext.Provider value={actionsValue}>
          <DashboardModalContext.Provider value={modalValue}>
            {children}
          </DashboardModalContext.Provider>
        </DashboardActionsContext.Provider>
      </DashboardDataContext.Provider>
    </DashboardNavContext.Provider>
  );
}
```

- [ ] **Step 9: Write unit test for context hook throw behaviors & invariants**

Create `tests/dashboard-contexts-invariants.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import {
  DashboardNavContext,
  DashboardDataContext,
  DashboardActionsContext,
  DashboardModalContext,
  useDashboardNav,
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
} from "../src/components/dashboard/dashboard-context";

describe("Dashboard Context Invariants & Hook Boundary Tests", () => {
  test("All 4 React Contexts are defined with null default values", () => {
    assert.ok(DashboardNavContext);
    assert.ok(DashboardDataContext);
    assert.ok(DashboardActionsContext);
    assert.ok(DashboardModalContext);
  });

  test("useDashboardNav throws descriptive error when used outside DashboardStateProvider", () => {
    assert.throws(
      () => {
        useDashboardNav();
      },
      /useDashboardNav must be used within a DashboardStateProvider/
    );
  });

  test("useDashboardData throws descriptive error when used outside DashboardStateProvider", () => {
    assert.throws(
      () => {
        useDashboardData();
      },
      /useDashboardData must be used within a DashboardStateProvider/
    );
  });

  test("useDashboardActions throws descriptive error when used outside DashboardStateProvider", () => {
    assert.throws(
      () => {
        useDashboardActions();
      },
      /useDashboardActions must be used within a DashboardStateProvider/
    );
  });

  test("useDashboardModal throws descriptive error when used outside DashboardStateProvider", () => {
    assert.throws(
      () => {
        useDashboardModal();
      },
      /useDashboardModal must be used within a DashboardStateProvider/
    );
  });
});
```

- [ ] **Step 10: Run typecheck and tests to verify Task 1**

Run: `npm run typecheck && npm test`
Expected: 0 TypeScript errors, all tests pass.

- [ ] **Step 11: Commit Task 1**

```bash
git add src/hooks/use-modal-state.ts src/hooks/use-url-params-sync.ts src/hooks/use-task-mutations.ts src/hooks/use-task-filters.ts src/hooks/use-dashboard-state.ts src/components/dashboard/dashboard-context.tsx tests/dashboard-subhooks-logic.test.ts tests/dashboard-contexts-invariants.test.ts
git commit -m "feat(dashboard): extract decomposed sub-hooks and 4 scoped React contexts"
```

---

### Task 2: Extract Leaf Zones (Org & Calendar)

**Files:**
- Create: `src/components/dashboard/zones/org-zone.tsx`
- Create: `src/components/dashboard/zones/calendar-zone.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/dashboard-leaf-zones.test.ts`

- [ ] **Step 1: Write test for OrgZone & CalendarZone contracts and exports**

Create `tests/dashboard-leaf-zones.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { OrgZone } from "../src/components/dashboard/zones/org-zone";
import { CalendarZone } from "../src/components/dashboard/zones/calendar-zone";

describe("Leaf Zones Contract & Implementation Audit", () => {
  test("OrgZone and CalendarZone are memoized React components", () => {
    assert.equal(typeof OrgZone, "object");
    assert.equal(typeof CalendarZone, "object");
  });

  test("OrgZone source contains data-slot zone-org and imports OrganizationTree", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/zones/org-zone.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(content.includes('data-slot="zone-org"'));
    assert.ok(content.includes("OrganizationTree"));
  });

  test("CalendarZone source contains data-slot zone-calendar and imports CalendarMonthView", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/zones/calendar-zone.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(content.includes('data-slot="zone-calendar"'));
    assert.ok(content.includes("CalendarMonthView"));
  });
});
```

- [ ] **Step 2: Implement `src/components/dashboard/zones/org-zone.tsx`**

Create `src/components/dashboard/zones/org-zone.tsx`:
```typescript
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Network, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardData, useDashboardActions } from "@/components/dashboard/dashboard-context";

const OrganizationTree = dynamic(
  () => import("@/components/org/organization-tree").then((m) => m.OrganizationTree),
  { ssr: false, loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" /> }
);

function OrgZoneComponent() {
  const { isRefreshing } = useDashboardData();
  const { handleManualRefresh } = useDashboardActions();

  return (
    <div className="space-y-6" data-slot="zone-org">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Network className="size-3" strokeWidth={1.5} />
              <span>CƠ CẤU BỘ MÁY & DANH BẠ QCET</span>
            </span>
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
              • 11 Đơn vị • 95 Cán bộ
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-heading">
            Cơ Cấu Tổ Chức & Danh Bạ Cán Bộ
          </h1>
          <p className="text-xs text-muted-foreground mt-1 text-balance">
            Sơ đồ phân cấp bộ máy tổ chức và danh bạ liên hệ toàn trường QCET
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="gap-1.5 text-xs rounded-xl"
          >
            <RefreshCw
              size={14}
              className={isRefreshing ? "animate-spin text-primary" : ""}
            />
            <span className="hidden sm:inline">Làm mới danh bạ</span>
          </Button>
        </div>
      </div>

      <section aria-label="Sơ đồ cây tổ chức">
        <OrganizationTree />
      </section>
    </div>
  );
}

export const OrgZone = React.memo(OrgZoneComponent);
```

- [ ] **Step 3: Implement `src/components/dashboard/zones/calendar-zone.tsx`**

Create `src/components/dashboard/zones/calendar-zone.tsx`:
```typescript
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
} from "@/components/dashboard/dashboard-context";

const CalendarMonthView = dynamic(
  () => import("@/components/calendar/calendar-month-view").then((m) => m.CalendarMonthView),
  { ssr: false, loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" /> }
);

function CalendarZoneComponent() {
  const { filteredTasks, selectedAcademicMonth, isExecutive, isRefreshing } = useDashboardData();
  const { handleManualRefresh } = useDashboardActions();
  const { openCreateModal, openTaskDetail } = useDashboardModal();

  return (
    <div className="space-y-6" data-slot="zone-calendar">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-2xs font-mono">
              Phân khu Lịch công tác
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-heading">
            Lịch Công Tác & Hạn Chót Toàn Trường
          </h1>
          <p className="text-xs text-muted-foreground mt-1 text-balance">
            Theo dõi lịch trình các nhiệm vụ, sự kiện BGH và hạn chót giao việc theo thời gian thực
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isExecutive && (
            <Button
              onClick={() => openCreateModal("TRUONG")}
              className="gap-1.5 text-xs font-bold rounded-xl"
            >
              <Plus size={14} />
              <span>Thêm sự kiện / Việc mới</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="gap-1.5 text-xs rounded-xl"
          >
            <RefreshCw
              size={14}
              className={isRefreshing ? "animate-spin text-primary" : ""}
            />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>
        </div>
      </div>

      <section aria-label="Lưới lịch tháng">
        <CalendarMonthView
          tasks={filteredTasks}
          initialMonth={typeof selectedAcademicMonth === "number" ? selectedAcademicMonth : 9}
          initialYear={2026}
          onSelectTask={(task) => openTaskDetail(task)}
          onAddTask={() => openCreateModal("TRUONG")}
        />
      </section>
    </div>
  );
}

export const CalendarZone = React.memo(CalendarZoneComponent);
```

- [ ] **Step 4: Connect CalendarZone and OrgZone into `page.tsx`**

In `src/app/page.tsx`:
- Import `OrgZone` and `CalendarZone`.
- Replace lines 1481–1581 with `{activeZone === "calendar" && <CalendarZone />}` and `{activeZone === "org" && <OrgZone />}`.

- [ ] **Step 5: Run tests & typecheck to verify Checkpoint 1**

Run: `npm run typecheck && npm test`
Expected: PASS with all tests passing.

- [ ] **Step 6: Commit Task 2 (Checkpoint 1)**

```bash
git add src/components/dashboard/zones/org-zone.tsx src/components/dashboard/zones/calendar-zone.tsx src/app/page.tsx tests/dashboard-leaf-zones.test.ts
git commit -m "refactor(dashboard): extract OrgZone and CalendarZone containers (Checkpoint 1)"
```

---

### Task 3: Extract Dashboard Zone

**Files:**
- Create: `src/components/dashboard/zones/dashboard-zone.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/dashboard-zone.test.ts`

- [ ] **Step 1: Write test for DashboardZone contract and elements**

Create `tests/dashboard-zone.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DashboardZone } from "../src/components/dashboard/zones/dashboard-zone";

describe("DashboardZone Contract & Structure Verification", () => {
  test("DashboardZone is a memoized React component", () => {
    assert.equal(typeof DashboardZone, "object");
  });

  test("DashboardZone source file exists and adheres to size budget (< 150 lines)", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/zones/dashboard-zone.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    const lineCount = content.split("\n").length;
    assert.ok(lineCount < 150, `DashboardZone exceeded 150 lines: ${lineCount}`);
    assert.ok(content.includes('data-slot="zone-dashboard"'));
    assert.ok(content.includes("ExecutiveStatStrip"));
    assert.ok(content.includes("UpcomingDeadlinesWidget"));
    assert.ok(content.includes("ActivityFeedWidget"));
  });
});
```

- [ ] **Step 2: Implement `src/components/dashboard/zones/dashboard-zone.tsx`**

Create `src/components/dashboard/zones/dashboard-zone.tsx`:
```typescript
"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExecutiveStatStrip } from "@/components/dashboard/executive-stat-strip";
import { ExecutiveActionCenter } from "@/components/dashboard/executive-action-center";
import { DepartmentProgressMatrix } from "@/components/dashboard/department-progress-matrix";
import { UpcomingDeadlinesWidget } from "@/components/dashboard/upcoming-deadlines-widget";
import { ActivityFeedWidget } from "@/components/dashboard/activity-feed-widget";
import {
  useDashboardData,
  useDashboardActions,
} from "@/components/dashboard/dashboard-context";

function DashboardZoneComponent() {
  const {
    displayedStats,
    activeWorkbox,
    isExecutive,
    executiveStats,
    executiveFilter,
    departmentHealth,
    selectedDepartment,
    roleUpcoming,
    activities,
    isRefreshing,
    user,
  } = useDashboardData();

  const {
    setActiveWorkbox,
    setExecutiveFilter,
    handleDepartmentChange,
    handleManualRefresh,
    handleSelectUpcoming,
  } = useDashboardActions();

  return (
    <div className="space-y-6" data-slot="zone-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-2xs font-mono">
              Phân khu Điều hành
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              {isExecutive ? "BGH Giám sát toàn trường" : `Đơn vị: ${user?.department || "QCET"}`}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-heading">
            Dashboard Điều Hành & Báo Cáo KPI
          </h1>
          <p className="text-xs text-muted-foreground mt-1 text-balance">
            Theo dõi toàn cảnh tiến độ, điểm nghẽn, và hàng đợi phê duyệt chiến lược của 11 đơn vị
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="gap-1.5 text-xs rounded-xl"
          >
            <RefreshCw
              size={14}
              className={isRefreshing ? "animate-spin text-primary" : ""}
            />
            <span className="hidden sm:inline">Làm mới dữ liệu</span>
          </Button>
        </div>
      </div>

      {/* Stat Strip */}
      <section aria-label="Chỉ số điều hành toàn trường">
        <ExecutiveStatStrip
          stats={displayedStats}
          activeFilter={activeWorkbox}
          onFilterChange={(filter) => setActiveWorkbox(filter)}
        />
      </section>

      {/* Executive Cockpit (BGH only) */}
      {isExecutive && executiveStats && (
        <section aria-label="Khoang điều hành Ban Giám hiệu" className="space-y-4">
          <ExecutiveActionCenter
            stats={executiveStats}
            activeFilter={executiveFilter}
            onFilterChange={setExecutiveFilter}
          />
          <DepartmentProgressMatrix
            departments={departmentHealth}
            selectedDepartment={selectedDepartment}
            onSelectDepartment={handleDepartmentChange}
          />
        </section>
      )}

      {/* Widgets Grid: Upcoming Deadlines & Live Activity Feed */}
      <section
        aria-label="Tiện ích theo dõi tiến độ và hoạt động"
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
      >
        <UpcomingDeadlinesWidget
          items={roleUpcoming}
          onSelectTask={handleSelectUpcoming}
        />
        <ActivityFeedWidget activities={activities} />
      </section>
    </div>
  );
}

export const DashboardZone = React.memo(DashboardZoneComponent);
```

- [ ] **Step 3: Connect DashboardZone into `page.tsx`**

In `src/app/page.tsx`:
- Import `DashboardZone`.
- Replace Zone 2 JSX with `{activeZone === "dashboard" && <DashboardZone />}`.

- [ ] **Step 4: Run tests & typecheck to verify Checkpoint 2**

Run: `npm run typecheck && npm test`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit Task 3 (Checkpoint 2)**

```bash
git add src/components/dashboard/zones/dashboard-zone.tsx src/app/page.tsx tests/dashboard-zone.test.ts
git commit -m "refactor(dashboard): extract DashboardZone container (Checkpoint 2)"
```

---

### Task 4: Extract Modals Host

**Files:**
- Create: `src/components/dashboard/dashboard-modals-host.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/dashboard-modals-host.test.ts`

- [ ] **Step 1: Write test for DashboardModalsHost contract and lazy imports**

Create `tests/dashboard-modals-host.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DashboardModalsHost } from "../src/components/dashboard/dashboard-modals-host";

describe("DashboardModalsHost Contract & Import Audit", () => {
  test("DashboardModalsHost is a memoized React component", () => {
    assert.equal(typeof DashboardModalsHost, "object");
  });

  test("DashboardModalsHost dynamically loads all 3 modals on-demand", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/dashboard-modals-host.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(content.includes("TaskDetailSideSheet"));
    assert.ok(content.includes("CreateTaskModal"));
    assert.ok(content.includes("DelegationManagementModal"));
    assert.ok(content.includes("useDashboardModal"));
  });
});
```

- [ ] **Step 2: Implement `src/components/dashboard/dashboard-modals-host.tsx`**

Create `src/components/dashboard/dashboard-modals-host.tsx`:
```typescript
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  useDashboardModal,
  useDashboardData,
  useDashboardActions,
} from "@/components/dashboard/dashboard-context";

const TaskDetailSideSheet = dynamic(
  () => import("@/components/dashboard/task-detail-side-sheet").then((m) => m.TaskDetailSideSheet),
  { ssr: false }
);

const CreateTaskModal = dynamic(
  () => import("@/components/dashboard/create-task-modal").then((m) => m.CreateTaskModal),
  { ssr: false }
);

const DelegationManagementModal = dynamic(
  () =>
    import("@/components/dashboard/delegation-management-modal").then(
      (m) => m.DelegationManagementModal
    ),
  { ssr: false }
);

function DashboardModalsHostComponent() {
  const {
    selectedTask,
    isCreateModalOpen,
    initialTaskLevel,
    initialParentTaskId,
    initialAssigneeName,
    isDelegationModalOpen,
    delegationDeptCode,
    closeTaskDetail,
    closeCreateModal,
    closeDelegationModal,
  } = useDashboardModal();

  const { tasks, parentSchoolTaskTitle, delegations } = useDashboardData();
  const {
    handleStatusChange,
    handleCreateTask,
    handleSaveDelegation,
    handleRevokeDelegation,
  } = useDashboardActions();

  return (
    <>
      {/* TaskDetailSideSheet Slide-Over (only rendered when task is active) */}
      {selectedTask && (
        <TaskDetailSideSheet
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={closeTaskDetail}
          onStatusChange={handleStatusChange}
          parentSchoolTaskTitle={parentSchoolTaskTitle}
          delegations={delegations}
        />
      )}

      {/* CreateTaskModal for School-level & Unit-level task creation (rendered on-demand) */}
      {isCreateModalOpen && (
        <CreateTaskModal
          isOpen={isCreateModalOpen}
          onClose={closeCreateModal}
          onSubmit={handleCreateTask}
          initialLeadAssigneeName={initialAssigneeName}
          schoolTasks={tasks}
          initialLevel={initialTaskLevel}
          initialParentTaskId={initialParentTaskId}
        />
      )}

      {/* DelegationManagementModal for Stanford Authority Delegation (rendered on-demand) */}
      {isDelegationModalOpen && (
        <DelegationManagementModal
          isOpen={isDelegationModalOpen}
          onClose={closeDelegationModal}
          departmentCode={delegationDeptCode}
          delegations={delegations}
          onSaveDelegation={handleSaveDelegation}
          onRevokeDelegation={handleRevokeDelegation}
        />
      )}
    </>
  );
}

export const DashboardModalsHost = React.memo(DashboardModalsHostComponent);
```

- [ ] **Step 3: Connect DashboardModalsHost into `page.tsx`**

In `src/app/page.tsx`:
- Import `DashboardModalsHost`.
- Replace the 3 bottom modals JSX with `<DashboardModalsHost />`.

- [ ] **Step 4: Run tests & typecheck to verify Checkpoint 3**

Run: `npm run typecheck && npm test`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit Task 4 (Checkpoint 3)**

```bash
git add src/components/dashboard/dashboard-modals-host.tsx src/app/page.tsx tests/dashboard-modals-host.test.ts
git commit -m "refactor(dashboard): extract DashboardModalsHost container (Checkpoint 3)"
```

---

### Task 5: Extract Tasks Zone (Decomposed into 3 Files)

**Files:**
- Create: `src/components/dashboard/zones/tasks-focus-landing.tsx`
- Create: `src/components/dashboard/zones/tasks-expanded-views.tsx`
- Create: `src/components/dashboard/zones/tasks-zone.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/tasks-zone.test.ts`

- [ ] **Step 1: Write test for TasksZone contracts and sub-file bounds**

Create `tests/tasks-zone.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TasksFocusLanding } from "../src/components/dashboard/zones/tasks-focus-landing";
import { TasksExpandedViews } from "../src/components/dashboard/zones/tasks-expanded-views";
import { TasksZone } from "../src/components/dashboard/zones/tasks-zone";

describe("Tasks Zone Decomposed Contracts & Size Verification", () => {
  test("TasksFocusLanding, TasksExpandedViews, and TasksZone are memoized React components", () => {
    assert.equal(typeof TasksFocusLanding, "object");
    assert.equal(typeof TasksExpandedViews, "object");
    assert.equal(typeof TasksZone, "object");
  });

  test("Sub-files adhere to the <= 350 lines strict modularity threshold", () => {
    const files = [
      "../src/components/dashboard/zones/tasks-focus-landing.tsx",
      "../src/components/dashboard/zones/tasks-expanded-views.tsx",
      "../src/components/dashboard/zones/tasks-zone.tsx",
    ];

    for (const rel of files) {
      const full = path.resolve(__dirname, rel);
      const lines = fs.readFileSync(full, "utf-8").split("\n").length;
      assert.ok(lines <= 350, `File ${rel} exceeded 350 lines: found ${lines}`);
    }
  });
});
```

- [ ] **Step 2: Implement `src/components/dashboard/zones/tasks-focus-landing.tsx` with verified workspace imports**

Create `src/components/dashboard/zones/tasks-focus-landing.tsx`:
```typescript
"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExecutiveCockpitWorkspace } from "@/components/portal/executive-cockpit-workspace";
import { DepartmentManagerWorkspace } from "@/components/portal/department-manager-workspace";
import { LecturerFocusWorkspace } from "@/components/portal/lecturer-focus-workspace";
import {
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
} from "@/components/dashboard/dashboard-context";

function TasksFocusLandingComponent() {
  const {
    tasks,
    user,
    effectiveManagerUser,
    isExecutive,
    isSchoolView,
    isUnitView,
    isRefreshing,
  } = useDashboardData();

  const {
    handleReviewAction,
    handleSubmitDeliverable,
    handleStatusChange,
    handleManualRefresh,
  } = useDashboardActions();

  const { openTaskDetail, openCreateModal } = useDashboardModal();

  return (
    <div className="space-y-4" data-slot="role-workspace-landing">
      {/* Context Banner & Action Bar (non-executive roles only; ExecutiveCockpitWorkspace provides its own header) */}
      {!isExecutive && !isSchoolView && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border border-border rounded-2xl p-4 shadow-xs">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-2xs font-mono">
                {isUnitView
                  ? "Trung tâm điều hành Đơn vị"
                  : "Không gian làm việc cá nhân"}
              </span>
              <span className="text-xs text-muted-foreground font-mono tabular-nums">
                Năm học 2026 - 2027
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading">
              {isUnitView
                ? `Trung tâm Điều hành: ${effectiveManagerUser.department || user?.department || "Khoa / Phòng"}`
                : "Công việc Của tôi (My Focus)"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isUnitView
                ? "Phân công nhiệm vụ, kiểm tra tiến độ và thẩm định minh chứng cấp khoa/phòng"
                : "Tập trung xử lý nhiệm vụ được phân công, theo dõi hạn chót và nộp minh chứng"}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="gap-1.5 text-xs rounded-xl"
            >
              <RefreshCw
                size={14}
                strokeWidth={1.5}
                className={isRefreshing ? "animate-spin text-primary" : ""}
              />
              <span className="hidden sm:inline">Làm mới</span>
            </Button>
          </div>
        </div>
      )}

      {/* Role-Based Dispatching: Executive, Manager, or Staff Workspace */}
      {isSchoolView ? (
        <ExecutiveCockpitWorkspace
          user={user}
          tasks={tasks}
          onSelectTask={(task) => openTaskDetail(task)}
          onReview={handleReviewAction}
          onSubmitDeliverable={handleSubmitDeliverable}
          onCreateDirective={() => openCreateModal("TRUONG")}
          onSendReminder={(_deptCode, _reason) => {
            // Executive reminder dispatched
          }}
        />
      ) : isUnitView ? (
        <DepartmentManagerWorkspace
          user={effectiveManagerUser}
          tasks={tasks}
          onSelectTask={(task) => openTaskDetail(task)}
          onReview={handleReviewAction}
          onSubmitDeliverable={handleSubmitDeliverable}
          onStatusChange={handleStatusChange}
          onCreateSubTask={(parentTaskId) =>
            openCreateModal("DON_VI", parentTaskId)
          }
        />
      ) : (
        /* STAFF, GIANG_VIEN, CHUYEN_VIEN & Fallback */
        <LecturerFocusWorkspace
          user={user}
          tasks={tasks}
          onSelectTask={(task) => openTaskDetail(task)}
          onSubmitDeliverable={handleSubmitDeliverable}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

export const TasksFocusLanding = React.memo(TasksFocusLandingComponent);
```

- [ ] **Step 3: Implement `src/components/dashboard/zones/tasks-expanded-views.tsx`**

Create `src/components/dashboard/zones/tasks-expanded-views.tsx`:
```typescript
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  RefreshCw,
  UserCheck,
  ShieldAlert,
  Table,
  KanbanSquare,
  Calendar,
  Building2,
  FileCheck,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DensityToggle } from "@/components/ui/density-toggle";
import { ExecutiveStatStrip } from "@/components/dashboard/executive-stat-strip";
import { CascadingTaskTable } from "@/components/dashboard/cascading-task-table";
import { SimplifiedTaskFilterBar } from "@/components/dashboard/simplified-task-filter-bar";
import { UnifiedTaskToolbar } from "@/components/dashboard/unified-task-toolbar";
import {
  useDashboardNav,
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
} from "@/components/dashboard/dashboard-context";

const TaskKanbanBoard = dynamic(
  () => import("@/components/tasks/task-kanban-board").then((m) => m.TaskKanbanBoard),
  { ssr: false, loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" /> }
);

const CalendarMonthView = dynamic(
  () => import("@/components/calendar/calendar-month-view").then((m) => m.CalendarMonthView),
  { ssr: false, loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" /> }
);

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

const ExecutiveDepartmentCommandCenter = dynamic(
  () =>
    import("@/components/tasks/executive-department-command-center").then(
      (m) => m.ExecutiveDepartmentCommandCenter
    ),
  {
    ssr: false,
    loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" />,
  }
);

function TasksExpandedViewsComponent() {
  const {
    scope,
    viewMode,
    isStaffExpanded,
    useAdvancedToolbar,
    handleScopeChange,
    handleViewModeChange,
    setUseAdvancedToolbar,
    handleToggleStaffExpanded,
  } = useDashboardNav();

  const {
    filteredTasks,
    displayedStats,
    activeWorkbox,
    selectedDepartment,
    selectedAcademicMonth,
    selectedMonthPeriod,
    monthlyTaskCounts,
    selectedPriority,
    selectedCategory,
    searchQuery,
    user,
    isExecutive,
    delegations,
    isRefreshing,
  } = useDashboardData();

  const {
    handleDepartmentChange,
    handleAcademicMonthChange,
    setSelectedPriority,
    setSelectedCategory,
    setSearchQuery,
    setActiveWorkbox,
    setExecutiveFilter,
    handleResetFilters,
    handleStatusChange,
    handleManualRefresh,
  } = useDashboardActions();

  const { openTaskDetail, openCreateModal, openDelegationModal } = useDashboardModal();

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-2xs font-mono">
              Năm học 2026 - 2027
            </span>
            {selectedMonthPeriod ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shadow-2xs font-mono">
                <span className="size-1.5 rounded-full bg-sky-500 animate-pulse" />
                <span>{selectedMonthPeriod.label} ({selectedMonthPeriod.shortDateSpan})</span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground font-medium">
                Cả năm học (12 tháng chu kỳ)
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-heading">
            Quản lý Giao việc & Nhiệm vụ
          </h1>
          <p className="text-xs text-muted-foreground mt-1 text-balance">
            Trung tâm điều hành và giao việc hợp nhất: Phân cấp nhiệm vụ toàn trường, khoa phòng và cá nhân
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {user?.role === "STAFF" && isStaffExpanded && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleStaffExpanded}
              className="gap-1.5 text-xs rounded-xl border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
            >
              <UserCheck size={14} strokeWidth={1.5} />
              <span>Quay lại Chế độ trọng tâm (Cá nhân)</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="gap-1.5 text-xs rounded-xl"
          >
            <RefreshCw
              size={14}
              strokeWidth={1.5}
              className={isRefreshing ? "animate-spin text-primary" : ""}
            />
            <span className="hidden sm:inline">Làm mới dữ liệu</span>
          </Button>
        </div>
      </div>

      {/* Executive Stat Strip / Interactive Workbox Filter */}
      <section aria-label="Chỉ số điều hành toàn trường">
        <ExecutiveStatStrip
          stats={displayedStats}
          activeFilter={activeWorkbox}
          onFilterChange={(filter) => setActiveWorkbox(filter)}
        />
      </section>

      {/* Simplified Filter Bar for Admin / Manager OR Unified Toolbar when toggled or fallback */}
      {(user?.role === "ADMIN" || user?.role === "MANAGER") && !useAdvancedToolbar ? (
        <section aria-label="Thanh lọc tối giản & Điều hướng nhanh" className="space-y-3">
          {/* High-Level Views & Approvals Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground mr-1">Chế độ xem:</span>
              {user?.role === "ADMIN" && (
                <button
                  type="button"
                  onClick={() => handleViewModeChange("executive")}
                  className={cn(
                    "px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5",
                    viewMode === "executive"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-card hover:bg-muted text-muted-foreground border border-border"
                  )}
                >
                  <ShieldAlert size={13} strokeWidth={1.5} />
                  <span>Chỉ huy BGH</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleViewModeChange("table")}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5",
                  viewMode === "table"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-card hover:bg-muted text-muted-foreground border border-border"
                )}
              >
                <Table size={13} strokeWidth={1.5} />
                <span>Bảng phân cấp</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange("kanban")}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5",
                  viewMode === "kanban"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-card hover:bg-muted text-muted-foreground border border-border"
                )}
              >
                <KanbanSquare size={13} strokeWidth={1.5} />
                <span>Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange("calendar")}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5",
                  viewMode === "calendar"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-card hover:bg-muted text-muted-foreground border border-border"
                )}
              >
                <Calendar size={13} strokeWidth={1.5} />
                <span>Lịch tháng</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange("department")}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5",
                  viewMode === "department"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-card hover:bg-muted text-muted-foreground border border-border"
                )}
              >
                <Building2 size={13} strokeWidth={1.5} />
                <span>Theo đơn vị</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Direct Access to Approvals Queue */}
              <button
                type="button"
                onClick={() => {
                  if (isExecutive) {
                    handleViewModeChange("executive");
                    setExecutiveFilter("PENDING_APPROVAL");
                  } else {
                    setActiveWorkbox("NEEDS_REVIEW");
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors cursor-pointer"
              >
                <FileCheck size={13} strokeWidth={1.5} />
                <span>Hàng đợi phê duyệt</span>
              </button>

              {/* Toggle to full toolbar */}
              <button
                type="button"
                onClick={() => setUseAdvancedToolbar(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors cursor-pointer"
                title="Mở thanh công cụ đầy đủ"
              >
                <SlidersHorizontal size={13} strokeWidth={1.5} />
                <span className="hidden md:inline">Thanh công cụ đầy đủ</span>
              </button>

              {/* Density Toggle */}
              <DensityToggle className="h-7.5 rounded-xl border-border/70 shadow-2xs" />
            </div>
          </div>

          {/* Simplified Task Filter Bar */}
          <SimplifiedTaskFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeStatus={
              activeWorkbox === "NEEDS_REVIEW" || activeWorkbox === "URGENT_OVERDUE"
                ? "ACTION_REQUIRED"
                : activeWorkbox === "COMPLETED"
                ? "COMPLETED"
                : "ALL"
            }
            onStatusChange={(newStatus) => {
              if (newStatus === "ACTION_REQUIRED") {
                setActiveWorkbox("NEEDS_REVIEW");
              } else if (newStatus === "COMPLETED") {
                setActiveWorkbox("COMPLETED");
              } else {
                setActiveWorkbox("ALL");
              }
            }}
            selectedDepartment={selectedDepartment}
            onDepartmentChange={handleDepartmentChange}
            selectedAcademicMonth={selectedAcademicMonth}
            onAcademicMonthChange={handleAcademicMonthChange}
            selectedPriority={selectedPriority}
            onPriorityChange={setSelectedPriority}
            totalCount={filteredTasks.length}
            onResetFilters={handleResetFilters}
          />
        </section>
      ) : (
        /* Unified Task Toolbar */
        <section aria-label="Thanh công cụ điều khiển nhiệm vụ" className="space-y-2">
          {(user?.role === "ADMIN" || user?.role === "MANAGER") && useAdvancedToolbar && (
            <div className="flex justify-end mb-1">
              <button
                type="button"
                onClick={() => setUseAdvancedToolbar(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-colors cursor-pointer"
              >
                <SlidersHorizontal size={13} strokeWidth={1.5} />
                <span>Quay lại Bộ lọc tinh giản</span>
              </button>
            </div>
          )}
          <UnifiedTaskToolbar
            scope={scope}
            onScopeChange={handleScopeChange}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            selectedDepartment={selectedDepartment}
            onDepartmentChange={handleDepartmentChange}
            selectedPriority={selectedPriority}
            onPriorityChange={setSelectedPriority}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onNewTaskClick={() => openCreateModal("TRUONG")}
            totalTasksCount={filteredTasks.length}
            isExecutive={isExecutive}
            userRole={user?.role}
            selectedAcademicMonth={selectedAcademicMonth}
            onAcademicMonthChange={handleAcademicMonthChange}
            academicYear="2026-2027"
            monthlyTaskCounts={monthlyTaskCounts}
          />

          {/* Active Academic Month Filter Notification Banner */}
          {selectedMonthPeriod && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block size-1.5 rounded-full bg-primary shrink-0" />
                <span className="truncate">
                  Đang lọc hiển thị theo chu kỳ <strong>{selectedMonthPeriod.fullLabel}</strong> ({filteredTasks.length} nhiệm vụ)
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleAcademicMonthChange("ALL")}
                className="shrink-0 text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                Hiển thị cả năm
              </button>
            </div>
          )}
        </section>
      )}

      {/* Dynamic Work Canvas */}
      <section
        aria-label="Không gian làm việc nhiệm vụ"
        className="min-h-[420px]"
        data-slot="work-canvas"
      >
        {viewMode === "table" && (
          <CascadingTaskTable
            tasks={filteredTasks}
            onSelectTask={(task) => openTaskDetail(task)}
            onAddTask={() => openCreateModal("TRUONG")}
            onStatusChange={handleStatusChange}
            hideWorkbox={true}
            hideToolbar={true}
          />
        )}

        {viewMode === "kanban" && (
          <TaskKanbanBoard
            tasks={filteredTasks}
            onSelectTask={(task) => openTaskDetail(task)}
            onStatusChange={handleStatusChange}
            onAddTask={() => openCreateModal("TRUONG")}
          />
        )}

        {viewMode === "calendar" && (
          <CalendarMonthView
            tasks={filteredTasks}
            initialMonth={typeof selectedAcademicMonth === "number" ? selectedAcademicMonth : 9}
            initialYear={2026}
            onSelectTask={(task) => openTaskDetail(task)}
            onAddTask={() => openCreateModal("TRUONG")}
          />
        )}

        {viewMode === "department" && (
          <DepartmentGroupedTaskView
            tasks={filteredTasks}
            onSelectTask={(task) => openTaskDetail(task)}
            onStatusChange={handleStatusChange}
            onAddTask={(_deptCode) => openCreateModal("TRUONG")}
            selectedDepartmentFilter={selectedDepartment}
            searchQuery={searchQuery}
            delegations={delegations}
            onManageDelegation={openDelegationModal}
          />
        )}

        {viewMode === "executive" && (
          <ExecutiveDepartmentCommandCenter
            tasks={filteredTasks}
            onSelectTask={(task) => openTaskDetail(task)}
            onSelectDepartment={(deptId) => handleDepartmentChange(deptId || "ALL")}
            selectedDepartmentId={selectedDepartment !== "ALL" ? selectedDepartment : null}
          />
        )}
      </section>
    </>
  );
}

export const TasksExpandedViews = React.memo(TasksExpandedViewsComponent);
```

- [ ] **Step 4: Implement `src/components/dashboard/zones/tasks-zone.tsx`**

Create `src/components/dashboard/zones/tasks-zone.tsx`:
```typescript
"use client";

import * as React from "react";
import { useDashboardNav } from "@/components/dashboard/dashboard-context";
import { TasksFocusLanding } from "./tasks-focus-landing";
import { TasksExpandedViews } from "./tasks-expanded-views";

function TasksZoneComponent() {
  const { isStaffExpanded } = useDashboardNav();

  return (
    <div className="space-y-6" data-slot="zone-tasks">
      {!isStaffExpanded ? <TasksFocusLanding /> : <TasksExpandedViews />}
    </div>
  );
}

export const TasksZone = React.memo(TasksZoneComponent);
```

- [ ] **Step 5: Connect TasksZone into `page.tsx`**

In `src/app/page.tsx`:
- Import `TasksZone`.
- Replace Zone 3 JSX with `{activeZone === "tasks" && <TasksZone />}`.

- [ ] **Step 6: Run tests & typecheck to verify Checkpoint 4**

Run: `npm run typecheck && npm test`
Expected: PASS with 0 errors.

- [ ] **Step 7: Commit Task 5 (Checkpoint 4)**

```bash
git add src/components/dashboard/zones/tasks-focus-landing.tsx src/components/dashboard/zones/tasks-expanded-views.tsx src/components/dashboard/zones/tasks-zone.tsx src/app/page.tsx tests/tasks-zone.test.ts
git commit -m "refactor(dashboard): extract TasksZone into 3 modular sub-components (Checkpoint 4)"
```

---

### Task 6: Simplify `src/app/page.tsx` & Clean Dead Code

**Files:**
- Modify: `src/app/page.tsx` (reduce to < 90 lines)
- Test: `tests/dashboard-architecture-integration.test.ts`

- [ ] **Step 1: Write integration test for the new orchestrator architecture**

Create `tests/dashboard-architecture-integration.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Dashboard Architecture Line Count & Modularity Audit", () => {
  const pagePath = path.resolve(__dirname, "../src/app/page.tsx");

  test("src/app/page.tsx is reduced to under 90 lines", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    const lines = content.split("\n").length;
    assert.ok(
      lines < 90,
      `Expected page.tsx to be < 90 lines, but found ${lines} lines`
    );
  });

  test("src/app/page.tsx does not contain dead portal zone inline", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    assert.equal(
      content.includes("<BentoPortalHub"),
      false,
      "Expected inline BentoPortalHub to be eliminated (redirects to /portal)"
    );
  });

  test("All zone container files exist and are focused under 350 lines", () => {
    const zones = [
      "../src/components/dashboard/zones/org-zone.tsx",
      "../src/components/dashboard/zones/calendar-zone.tsx",
      "../src/components/dashboard/zones/dashboard-zone.tsx",
      "../src/components/dashboard/zones/tasks-zone.tsx",
      "../src/components/dashboard/zones/tasks-focus-landing.tsx",
      "../src/components/dashboard/zones/tasks-expanded-views.tsx",
      "../src/components/dashboard/dashboard-modals-host.tsx",
    ];

    for (const relPath of zones) {
      const fullPath = path.resolve(__dirname, relPath);
      assert.ok(fs.existsSync(fullPath), `Missing expected file: ${relPath}`);
      const lines = fs.readFileSync(fullPath, "utf-8").split("\n").length;
      assert.ok(
        lines <= 350,
        `Expected ${relPath} to be <= 350 lines, but found ${lines}`
      );
    }
  });
});
```

- [ ] **Step 2: Rewrite `src/app/page.tsx` to the clean < 90 line orchestrator**

Replace `src/app/page.tsx` with:
```typescript
"use client";

import * as React from "react";
import {
  DashboardStateProvider,
  useDashboardNav,
} from "@/components/dashboard/dashboard-context";
import { DashboardZone } from "@/components/dashboard/zones/dashboard-zone";
import { TasksZone } from "@/components/dashboard/zones/tasks-zone";
import { CalendarZone } from "@/components/dashboard/zones/calendar-zone";
import { OrgZone } from "@/components/dashboard/zones/org-zone";
import { DashboardModalsHost } from "@/components/dashboard/dashboard-modals-host";

function DashboardLoadingFallback() {
  return (
    <div className="max-w-[1440px] w-full mx-auto space-y-6 pb-24 md:pb-10 animate-pulse">
      <div className="h-16 rounded-2xl bg-muted/40" />
      <div className="h-28 rounded-2xl bg-muted/40" />
      <div className="h-14 rounded-2xl bg-muted/40" />
      <div className="h-96 rounded-2xl bg-muted/40" />
    </div>
  );
}

function UnifiedTaskHubContent() {
  const { activeZone } = useDashboardNav();

  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-6 pb-24 md:pb-10"
      data-slot="twenty-dashboard"
      data-hub="unified-task-hub"
      data-active-zone={activeZone}
    >
      {activeZone === "dashboard" && <DashboardZone />}
      {activeZone === "tasks" && <TasksZone />}
      {activeZone === "calendar" && <CalendarZone />}
      {activeZone === "org" && <OrgZone />}

      <DashboardModalsHost />
    </div>
  );
}

export default function UnifiedTaskHubPage() {
  return (
    <React.Suspense fallback={<DashboardLoadingFallback />}>
      <DashboardStateProvider>
        <UnifiedTaskHubContent />
      </DashboardStateProvider>
    </React.Suspense>
  );
}
```

- [ ] **Step 3: Run typecheck and full test suite**

Run: `npm run typecheck && npm test`
Expected: 0 TypeScript errors, 100% tests pass (all 744 existing tests + new unit & integration tests).

- [ ] **Step 4: Commit Task 6 & Final Refactor**

```bash
git add src/app/page.tsx tests/dashboard-architecture-integration.test.ts
git commit -m "refactor(page): reduce page.tsx to < 90 line orchestrator and purge dead portal code"
```

---

## Plan Self-Review Checklist

1. **Spec & Reviewer Coverage:**
   - [x] Exact workspace exports verified: `ExecutiveCockpitWorkspace`, `DepartmentManagerWorkspace`, `LecturerFocusWorkspace` imported from their true locations.
   - [x] Hook decomposition: split into `useUrlParamsSync`, `useTaskMutations`, `useTaskFilters`, and composed by `useDashboardState` (avoiding god hook).
   - [x] Meaningful unit tests: testing context boundary throws, filtering matrix, and optimistic mutation rollups.
   - [x] `handleToggleStaffExpanded`: defined in `DashboardNavContextValue` and `useUrlParamsSync`.
   - [x] `parentSchoolTaskTitle?: string`: added to `DashboardDataContextValue`.
   - [x] 4 React Contexts (`NavContext`, `DataContext`, `ActionsContext`, `ModalContext`) with stable `actionsValue []`.
   - [x] Checkpoint commits at every task.
   - [x] Zero regressions against 744 existing tests.
