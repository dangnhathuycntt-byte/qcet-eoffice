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
│ • activeZone │   │ • tasks      │       │ • handleZone...  │   │ • selectedTask  │
│ • scope      │   │ • stats      │       │ • handleScope... │   │ • isCreateOpen  │
│ • viewMode   │   │ • filterTasks│       │ • onStatusChange │   │ • isDelegOpen   │
│ • isExpanded │   │ • user/roles │       │ • onReview...    │   │ • modal params  │
│ • advToolbar │   │ • filters... │       │ • refresh...     │   │ • open/close fn │
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
   - `activeZone: WorkspaceZone`
   - `scope: TaskScope`
   - `viewMode: TaskViewMode`
   - `isStaffExpanded: boolean`
   - `useAdvancedToolbar: boolean`

2. **`DashboardDataContextValue`**:
   - Master data: `tasks: SchoolTask[]`, `stats: DashboardStats`, `upcoming: UpcomingItem[]`, `activities: ActivityFeedItem[]`
   - Computed datasets: `filteredTasks: (SchoolTask | StaffTask)[]`, `scopedBaseTasks: SchoolTask[]`, `monthlyTaskCounts: Record<number, number>`, `displayedStats: DashboardStats`
   - Role context: `user: AuthUser`, `effectiveManagerUser: AuthUser`, `isExecutive: boolean`, `isUnitView: boolean`, `isSchoolView: boolean`
   - Business filters: `selectedDepartment: string`, `selectedAcademicMonth: number | "ALL"`, `activeWorkbox: WorkboxFilter`, `executiveFilter: ExecutiveFilter`, `searchQuery: string`, `selectedPriority: string`, `selectedCategory: string`
   - Matrices: `departmentHealth: DepartmentHealth[]`, `executiveStats: ExecutiveActionStats`, `roleUpcoming: UpcomingItem[]`
   - Delegation data: `delegations: DelegationRule[]`, `delegationDeptCode: string`
   - Flags: `isRefreshing: boolean`

3. **`DashboardActionsContextValue`**:
   - Navigation actions: `handleZoneChange`, `handleScopeChange`, `handleViewModeChange`, `setIsStaffExpanded`, `setUseAdvancedToolbar`
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
│       ├── dashboard-context.tsx         # 4 React Contexts & convenient consumer hooks
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
