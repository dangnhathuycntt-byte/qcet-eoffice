# Technical Specification: QCET Dashboard Architecture Refactor (Phase 1)

- **Date:** 2026-09-07
- **Topic:** Refactoring the 1,629-line `page.tsx` God Component into Modular Contexts & Zone Containers
- **Status:** Approved for Implementation Planning

---

## 1. Executive Summary & Goals

### 1.1 Context
`src/app/page.tsx` hiện tại là một "God Component" dài **1.629 dòng**, gánh vác:
- Toàn bộ State management (tasks, rollups, academic calendar filter, role detection, delegation management).
- Đồng bộ URL 2 chiều (`?zone=`, `?scope=`, `?view=`, `?dept=`, `?month=`).
- Lắng nghe các sự kiện cửa sổ toàn cục (`qcet:task-created`, `qcet:open-create-task`).
- Render 5 phân khu giao diện (Portal, Dashboard, Tasks, Calendar, Org) và 3 Modals/SideSheets.

### 1.2 Problems Solved
1. **Render Cascading:** Bất kỳ thay đổi dữ liệu nào (nhiệm vụ cập nhật trạng thái, chuyển bộ lọc nhỏ) đều gây re-render toàn bộ cây DOM của trang.
2. **High Cognitive Load:** Rất khó bảo trì, kiểm thử độc lập hay thực hiện code review.
3. **Dead Code Elimination:** Phân khu `portal` bên trong `page.tsx` là dead code do đã có route riêng `/portal` và redirection logic.

### 1.3 Target Architecture
- Giảm `src/app/page.tsx` xuống **< 90 dòng**.
- Tách state engine vào `useDashboardState()` và `useModalState()`.
- Tách 4 React Contexts chuyên biệt: `DashboardNavContext`, `DashboardDataContext`, `DashboardActionsContext`, `DashboardModalContext`.
- Tách 4 Zone Containers độc lập với `React.memo`.
- Chia `TasksZone` thành 3 tầng con mạch lạc (< 200 dòng/file).
- Đảm bảo 100% test suite hiện tại (744 tests) và typecheck luôn xanh, visual parity được giữ nguyên.

---

## 2. Context Architecture & Render Boundaries

Để giải quyết triệt để bài toán render cascading, hệ thống phân tách thành 4 Contexts:

```
                          ┌───────────────────────────┐
                          │   DashboardStateProvider  │
                          └─────────────┬─────────────┘
                                        │
      ┌────────────────────┬────────────┴───────────┬─────────────────────┐
      ▼                    ▼                        ▼                     ▼
┌──────────────┐   ┌──────────────┐       ┌──────────────────┐   ┌─────────────────┐
│  NavContext  │   │  DataContext │       │  ActionsContext  │   │  ModalContext   │
├──────────────┤   ├──────────────┤       ├──────────────────┤   ├─────────────────┤
│ • activeZone │   │ • tasks      │       │ • onStatusChange │   │ • selectedTask  │
│ • scope      │   │ • stats      │       │ • onReview...    │   │ • isCreateOpen  │
│ • viewMode   │   │ • filterTasks│       │ • onSubmitDeliv  │   │ • isDelegOpen   │
│ • isExpanded │   │ • user/roles │       │ • handleCreate...│   │ • modal params  │
│ • advToolbar │   │ • filters... │       │ • refresh...     │   │ • open/close fn │
│ • nav setters│   │ • delegations│       │ • filter setters │   │                 │
└──────┬───────┘   └──────┬───────┘       └────────┬─────────┘   └────────┬────────┘
       │                  │                        │                      │
       │                  └───────────┬────────────┘                      │
       ▼                              ▼                                   ▼
┌──────────────┐         ┌──────────────────────────────┐       ┌─────────────────┐
│ Orchestrator │         │   Zone Containers (Memo)     │       │ ModalsHost      │
│  (page.tsx)  │         │   • DashboardZone            │       │ (SideSheet,     │
│ (Only diffs  │         │   • TasksZone                │       │  CreateModal,   │
│  activeZone) │         │     ├─ TasksFocusLanding     │       │  Delegation)    │
│              │         │     └─ TasksExpandedViews    │       │                 │
│              │         │   • CalendarZone             │       │                 │
│              │         │   • OrgZone                  │       │                 │
└──────────────┘         └──────────────────────────────┘       └─────────────────┘
```

### 2.1 Context Interfaces
1. **`DashboardNavContextValue`**:
   - Navigation state: `activeZone: WorkspaceZone`, `scope: TaskScope`, `viewMode: TaskViewMode`, `isStaffExpanded: boolean`, `useAdvancedToolbar: boolean`
   - Navigation actions:
     - `handleZoneChange(zone: WorkspaceZone): void`
     - `handleScopeChange(scope: TaskScope): void`
     - `handleViewModeChange(view: TaskViewMode): void`
     - `setIsStaffExpanded(expanded: boolean): void`
     - `setUseAdvancedToolbar(use: boolean): void`

2. **`DashboardDataContextValue`**:
   - Master data: `tasks: SchoolTask[]`, `stats: DashboardStats`, `upcoming: UpcomingItem[]`, `activities: ActivityFeedItem[]`
   - Computed datasets: `filteredTasks: (SchoolTask | StaffTask)[]`, `scopedBaseTasks: SchoolTask[]`, `monthlyTaskCounts: Record<number, number>`, `displayedStats: DashboardStats`
   - Role context: `user: AuthUser`, `effectiveManagerUser: AuthUser`, `isExecutive: boolean`, `isUnitView: boolean`, `isSchoolView: boolean`
   - Business filters: `selectedDepartment: string`, `selectedAcademicMonth: number | "ALL"`, `activeWorkbox: WorkboxFilter`, `executiveFilter: ExecutiveFilter`, `searchQuery: string`, `selectedPriority: string`, `selectedCategory: string`
   - Matrices: `departmentHealth: DepartmentHealth[]`, `executiveStats: ExecutiveActionStats`, `roleUpcoming: UpcomingItem[]`
   - Delegation data: `delegations: DelegationRule[]`, `delegationDeptCode: string`
   - Flags: `isRefreshing: boolean`

3. **`DashboardActionsContextValue`**:
   - Filter actions: `handleDepartmentChange`, `handleAcademicMonthChange`, `setActiveWorkbox`, `setExecutiveFilter`, `setSearchQuery`, `setSelectedPriority`, `setSelectedCategory`, `handleResetFilters`
   - Business mutations: `handleStatusChange`, `handleSubmitDeliverable`, `handleReviewAction`, `handleCreateTask`, `handleManualRefresh`
   - Delegation mutations: `handleSaveDelegation`, `handleRevokeDelegation`

4. **`DashboardModalContextValue`**:
   - State: `selectedTask: SchoolTask | StaffTask | null`, `isCreateModalOpen: boolean`, `initialTaskLevel: "TRUONG" | "DON_VI"`, `initialParentTaskId?: string`, `initialAssigneeName?: string`, `isDelegationModalOpen: boolean`, `delegationDeptCode: string`
   - Actions: `openTaskDetail`, `closeTaskDetail`, `openCreateModal`, `closeCreateModal`, `openDelegationModal`, `closeDelegationModal`

---

## 3. Directory Layout & Module Specifications

```
src/
├── hooks/
│   ├── use-dashboard-state.ts            # State engine: tasks, filters, URL params sync
│   └── use-modal-state.ts                # Modals state & handlers
├── components/
│   └── dashboard/
│       ├── dashboard-context.tsx         # 4 React Contexts, DashboardStateProvider & hooks
│       ├── dashboard-modals-host.tsx     # Independent host for SideSheet & Modals
│       └── zones/
│           ├── dashboard-zone.tsx        # KPI Strip, Executive Matrix, Cockpit, Widgets
│           ├── tasks-zone.tsx            # Tasks Orchestrator: Banner + Switch landing/expanded
│           ├── tasks-focus-landing.tsx   # Role Dispatch (Executive, Manager, Lecturer Focus)
│           ├── tasks-expanded-views.tsx  # Toolbar + 5 View Modes (Table, Kanban, etc.)
│           ├── calendar-zone.tsx         # Academic Calendar view
│           └── org-zone.tsx              # Organization Structure Tree
└── app/
    └── page.tsx                          # Thin Orchestrator (< 90 lines)
```

### 3.1 `DashboardStateProvider` Component Architecture
Component `DashboardStateProvider` trong `src/components/dashboard/dashboard-context.tsx` đóng vai trò "cầu nối" khởi tạo state và cấp phát vào 4 React Contexts riêng biệt thông qua `useMemo`:

```tsx
export function DashboardStateProvider({ children }: { children: React.ReactNode }) {
  const dashboardState = useDashboardState();
  const modalState = useModalState();

  // 1. Navigation value: Chỉ re-render khi navigation state hoặc handler thay đổi
  const navValue = React.useMemo(
    () => ({
      activeZone: dashboardState.activeZone,
      scope: dashboardState.scope,
      viewMode: dashboardState.viewMode,
      isStaffExpanded: dashboardState.isStaffExpanded,
      useAdvancedToolbar: dashboardState.useAdvancedToolbar,
      handleZoneChange: dashboardState.handleZoneChange,
      handleScopeChange: dashboardState.handleScopeChange,
      handleViewModeChange: dashboardState.handleViewModeChange,
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
      dashboardState.setIsStaffExpanded,
      dashboardState.setUseAdvancedToolbar,
    ]
  );

  // 2. Data value: Re-render khi tasks, filters, hoặc computed stats thay đổi
  const dataValue = React.useMemo(
    () => ({
      tasks: dashboardState.tasks,
      stats: dashboardState.stats,
      upcoming: dashboardState.upcoming,
      activities: dashboardState.activities,
      filteredTasks: dashboardState.filteredTasks,
      scopedBaseTasks: dashboardState.scopedBaseTasks,
      monthlyTaskCounts: dashboardState.monthlyTaskCounts,
      displayedStats: dashboardState.displayedStats,
      user: dashboardState.user,
      effectiveManagerUser: dashboardState.effectiveManagerUser,
      isExecutive: dashboardState.isExecutive,
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
      dashboardState.displayedStats,
      dashboardState.user,
      dashboardState.effectiveManagerUser,
      dashboardState.isExecutive,
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
      dashboardState.delegations,
      dashboardState.delegationDeptCode,
      dashboardState.isRefreshing,
    ]
  );

  // 3. Actions value: Stable callbacks (empty dependency array -> KHÔNG BAO GIỜ re-render thừa)
  const actionsValue = React.useMemo(
    () => ({
      handleDepartmentChange: dashboardState.handleDepartmentChange,
      handleAcademicMonthChange: dashboardState.handleAcademicMonthChange,
      setActiveWorkbox: dashboardState.setActiveWorkbox,
      setExecutiveFilter: dashboardState.setExecutiveFilter,
      setSearchQuery: dashboardState.setSearchQuery,
      setSelectedPriority: dashboardState.setSelectedPriority,
      setSelectedCategory: dashboardState.setSelectedCategory,
      handleResetFilters: dashboardState.handleResetFilters,
      handleStatusChange: dashboardState.handleStatusChange,
      handleSubmitDeliverable: dashboardState.handleSubmitDeliverable,
      handleReviewAction: dashboardState.handleReviewAction,
      handleCreateTask: dashboardState.handleCreateTask,
      handleManualRefresh: dashboardState.handleManualRefresh,
      handleSaveDelegation: dashboardState.handleSaveDelegation,
      handleRevokeDelegation: dashboardState.handleRevokeDelegation,
    }),
    [
      dashboardState.handleDepartmentChange,
      dashboardState.handleAcademicMonthChange,
      dashboardState.setActiveWorkbox,
      dashboardState.setExecutiveFilter,
      dashboardState.setSearchQuery,
      dashboardState.setSelectedPriority,
      dashboardState.setSelectedCategory,
      dashboardState.handleResetFilters,
      dashboardState.handleStatusChange,
      dashboardState.handleSubmitDeliverable,
      dashboardState.handleReviewAction,
      dashboardState.handleCreateTask,
      dashboardState.handleManualRefresh,
      dashboardState.handleSaveDelegation,
      dashboardState.handleRevokeDelegation,
    ]
  );

  // 4. Modal value: Chỉ re-render khi modal state mở/đóng hoặc đổi target
  const modalValue = React.useMemo(
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

---

## 4. Implementation Phasing & Step-by-Step Migration

Để đảm bảo an toàn tuyệt đối và không gây regression:

### Bước 1: Foundation Hooks & Contexts
- Xây dựng `src/hooks/use-dashboard-state.ts` và `src/hooks/use-modal-state.ts`.
- Xây dựng `src/components/dashboard/dashboard-context.tsx`.
- Chạy `npm run typecheck` xác nhận contracts tương thích 100%.

### Bước 2: Extract Leaf Zones (Org & Calendar)
- Tạo `src/components/dashboard/zones/org-zone.tsx`.
- Tạo `src/components/dashboard/zones/calendar-zone.tsx`.
- Tích hợp vào `page.tsx` thay thế code cũ.
- **Checkpoint 1:** Typecheck + Test Pass → Commit.

### Bước 3: Extract Dashboard Zone
- Tạo `src/components/dashboard/zones/dashboard-zone.tsx` (chứa ExecutiveStatStrip, ExecutiveActionCenter, DepartmentProgressMatrix, UpcomingDeadlinesWidget, ActivityFeedWidget).
- Tích hợp vào `page.tsx`.
- **Checkpoint 2:** Typecheck + Test Pass → Commit.

### Bước 4: Extract Modals Host
- Tạo `src/components/dashboard/dashboard-modals-host.tsx`.
- Đưa `TaskDetailSideSheet`, `CreateTaskModal`, `DelegationManagementModal` vào host.
- Tích hợp vào `page.tsx`.
- **Checkpoint 3:** Typecheck + Test Pass → Commit.

### Bước 5: Extract Tasks Zone (Decomposed 3 Files)
- Tạo `src/components/dashboard/zones/tasks-focus-landing.tsx` (chứa ExecutiveCockpitWorkspace, DepartmentManagerWorkspace, LecturerFocusWorkspace).
- Tạo `src/components/dashboard/zones/tasks-expanded-views.tsx` (chứa UnifiedTaskToolbar, CascadingTaskTable, TaskKanbanBoard, CalendarMonthView, DepartmentGroupedTaskView, ExecutiveDepartmentCommandCenter).
- Tạo `src/components/dashboard/zones/tasks-zone.tsx` (chứa header banner + điều phối focus landing vs expanded views).
- Tích hợp vào `page.tsx`.
- **Checkpoint 4:** Typecheck + Test Pass → Commit.

### Bước 6: Simplify `src/app/page.tsx` & Verification
- Tối giản `page.tsx` thành orchestrator thuần túy.
- Xóa bỏ dead code `portal-zone` trong `page.tsx`.
- Chạy toàn bộ 744 tests và kiểm tra visual fidelity trên trình duyệt.

---

## 5. Quality Assurance & Rollback Plan

1. **Automated Verification:**
   - `npm run typecheck`: 0 errors.
   - `npm test`: 744 passing tests (120 test suites).
2. **Visual & Interaction Parity:**
   - Kiểm tra chuyển đổi 3 role (`BGH`, `TRUONG_DON_VI`, `GIANG_VIEN`).
   - Kiểm tra đổi view mode (Focus ↔ Expanded; Table ↔ Kanban ↔ Calendar ↔ Department).
   - Kiểm tra URL params phản ánh chính xác trạng thái và giữ lại khi F5.
   - Kiểm tra mở/đóng modals (Create Task, Detail SideSheet, Delegation).
3. **Rollback Strategy:**
   - Mỗi bước extraction có 1 checkpoint commit riêng trên Git. Nếu có bất kỳ sự cố không mong muốn, có thể revert ngay lập tức về commit trước đó mà không ảnh hưởng nhánh chính.
