# QCET E-Office — Task Workspace Architecture

**Document Status**: Canonical Reference  
**Scope**: Unified Task Workspace, Cascading Table, Filter Coordination, URL State Sync  
**Last Updated**: 2026-09-09  

---

## 1. Architectural Mission & Single Implementation Invariant

The Task Workspace in QCET E-Office manages all institutional milestones, departmental projects, and individual deliverables. To eliminate UI fragmentation, the workspace strictly follows the **Single Implementation Invariant**:

- **Canonical Workspace**: `src/components/workspace/unified-adaptive-workspace.tsx` (`UnifiedAdaptiveWorkspace`) is the sole workspace engine.
- **Canonical Table**: `src/components/tasks/table/modular-cascading-task-table.tsx` (`ModularCascadingTaskTable`) is the sole task grid component.
- **Single Filter Hook**: `src/hooks/use-task-filters.ts` (`useTaskFilters`) owns all filter, search, sort, and pagination state.
- **No Secondary Toolbars**: Never instantiate secondary search inputs, standalone filter dropdowns, or uncoordinated status tabs outside the canonical toolbar.

---

## 2. Workspace Component Hierarchy

```
UnifiedAdaptiveWorkspace
├── AdaptiveScopeHeader         # Scope title, department selector, create CTA
├── AdaptiveMetricStrip         # KPI tiles (total, in progress, completed, overdue)
├── UniversalActionQueue        # Urgent alerts, pending approvals, bottlenecks
├── UnifiedTaskToolbar          # Search, category filter, priority filter, view toggles
├── ActiveFilterBreadcrumb      # Removable active filter chips & clear-all button
├── Data View Container:
│   ├── ModularCascadingTaskTable  # Primary view: Parent/subtask collapsible rows
│   └── TaskKanbanBoard            # Secondary board view (Status swimlanes)
└── Overlays & Modals:
    ├── TaskDetailSideSheet     # Sliding drawer for task details & subtask breakdown
    ├── CreateTaskModal         # Task authoring modal (school/unit scope aware)
    ├── SubmitDeliverableModal  # Staff deliverable upload and note submission
    └── ReviewActionDialog      # Manager/Executive approval/rejection dialog
```

---

## 3. Filter State & URL Synchronization

All filter state is coordinated through `useTaskFilters`, ensuring seamless browser history, shareable deep links, and UI consistency:

### 3.1 Synchronized Parameters
- `scope`: `school` | `unit` | `my`
- `category`: Task category code or `ALL`
- `priority`: Task priority code or `ALL`
- `status`: Task status filter or `ALL`
- `view`: `table` | `kanban` | `calendar`
- `q`: Free-text search query (debounced via `useDeferredValue`)
- `month`: Academic month index (`0` to `11`)
- `dept`: Department code filter

### 3.2 URL Sync Mechanics
1. **Initial Mount**: `parseTaskUrlParams` reads `window.location.search` and initializes hook state.
2. **State Transition**: Any filter update pushes or replaces the URL query string using `syncTaskUrlParams` via Next.js `router.replace(..., { scroll: false })`.
3. **Badge Symmetry**: Filter badges and counter strips receive data filtered through the exact same predicates as the table body.

---

## 4. Hierarchy Management & Cascading Rows

QCET E-Office represents task relationships hierarchically:

```
[ Parent Task: SchoolTask ] (Strategic Milestone)
   │
   ├── [ Subtask: StaffTask #1 ] (Operational Deliverable)
   ├── [ Subtask: StaffTask #2 ] (Operational Deliverable)
   └── [ Subtask: StaffTask #3 ] (Operational Deliverable)
```

### Cascading Invariants:
1. **Collapsible Accordion**: Parent rows expand/collapse to display nested subtasks without navigating away from the workspace.
2. **Progress Rollup**: Parent task progress percent is calculated dynamically using `computeSchoolTaskRollup(task)` based on the ratio of completed subtasks.
3. **Filter Preservation**: When filtering by assignee or status, if a subtask matches the filter criteria, its parent row is retained in the table in an expanded state so hierarchical context is never lost.

---

## 5. Optimistic Mutations & Server Truth

Mutations (e.g., status change, task completion, inline editing) follow optimistic reconciliation:

1. **User Action**: User triggers an action (e.g., marks subtask complete).
2. **Optimistic Update**: `applyOptimisticStatusChange` updates the in-memory React state immediately, providing instant visual feedback.
3. **Server Dispatch**: An asynchronous PATCH/POST request is dispatched to `/api/tasks/[id]`.
4. **Reconciliation**:
   - On HTTP 200: Server response payload reconciles with the local store; revalidation hooks fire.
   - On HTTP 4xx/5xx: The optimistic change is rolled back cleanly, and an error notification is displayed.

---

## 6. Legacy Route Policy

Legacy routes (such as `/unit-tasks`) must act solely as thin route wrappers delegating into `UnifiedAdaptiveWorkspace`:

```tsx
// src/app/unit-tasks/page.tsx
export default function UnitTasksPage() {
  return <UnifiedAdaptiveWorkspace initialScope="unit" />;
}
```

Never re-implement table logic or instantiate duplicate data fetching in route wrappers.
