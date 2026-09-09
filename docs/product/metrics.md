# QCET E-Office — Canonical Metrics & Denominator Rules

**Document Status**: Canonical Reference  
**Scope**: Metric Formulas, Aggregation Logic, Denominator Integrity, Status Calculations  
**Last Updated**: 2026-09-09  

---

## 1. Overview & Core Invariant

All operational metrics, executive dashboards, department summaries, and badge counters in QCET E-Office must derive from identical, deterministic mathematical definitions implemented in `src/lib/dashboard-aggregator.ts` and `src/lib/executive-matrix-aggregator.ts`.

### Core Invariant: One Metric, One Formula
- Every institutional KPI must have exactly one formula across all surfaces (desktop header, mobile summary, export reports).
- **Never Mix Denominators**: Parent tasks (`SchoolTask`) and subtasks (`StaffTask`) represent different levels of abstraction. Their denominators must never be mixed silently in completion or overdue calculations.
- **Filter-Stat Symmetry**: Metric numbers in summary strips must reflect the exact same query filters (search, scope, academic month, category) as the task table beneath them.

---

## 2. Canonical Status Definitions

A task transitions through the following discrete statuses:

| Status Code | Vietnamese Label | Condition & Definition |
|---|---|---|
| `NOT_STARTED` | Chưa bắt đầu | Task created; progress is 0%; work has not commenced. |
| `IN_PROGRESS` | Đang thực hiện | Work underway; progress > 0% and < 100%; not past due. |
| `WAITING_APPROVAL` | Chờ phê duyệt | Deliverable submitted or progress = 100%; awaiting manager/executive sign-off (`NEEDS_REVIEW`, `PENDING_EXECUTIVE_APPROVAL`). |
| `COMPLETED` | Đã hoàn thành | Formally approved by authorized reviewer; deliverable accepted. |
| `OVERDUE` | Quá hạn | Non-completed task where `dueDate < referenceDate` (evaluated via `isTaskPastDue`). Also includes `BLOCKED` states requiring intervention. |
| `CANCELLED` | Đã hủy | Abandoned or rescinded task. Excluded from valid calculation denominators. |

---

## 3. Denominator Rules & Separation

### 3.1 Parent Tasks vs. Subtasks
- **Parent Task (`SchoolTask`)**: Strategic, high-level institutional milestones assigned to departments or key leads.
- **Subtask (`StaffTask`)**: Operational deliverables assigned to individual specialists or lecturers to fulfill a parent task.

```
Institutional Denominator:
Valid Parent Tasks = Total Parent Tasks - Cancelled Parent Tasks

Operational Denominator:
Valid Subtasks = Total Subtasks - Cancelled Subtasks
```

**Rule**: Never calculate a blended completion rate like `(Completed Parents + Completed Subs) / (Total Parents + Total Subs)`. Doing so disproportionately weights parent tasks with many trivial subtasks and distorts administrative reporting.

---

## 4. Mathematical Formulas

All formulas are evaluated relative to the canonical system reference date (`referenceDate`) pinned to Indochina Time (ICT, UTC+7) via `src/lib/academic-calendar.ts`.

### 4.1 Completion Rate (%)
```
Completion Rate = ( Completed Tasks / (Total Tasks - Cancelled Tasks) ) * 100
```
- If `(Total Tasks - Cancelled Tasks) === 0`, Completion Rate = `0%`.
- Cancelled tasks are excluded from both numerator and denominator.

### 4.2 Parent Task Rollup Progress (%)
For a parent task with $N$ subtasks:
```
Progress (%) = round( ( Completed Subtasks / Total Subtasks ) * 100 )
```
- If a parent task has zero subtasks, its progress reflects the manually recorded `progressPercent` (0 to 100), or `100%` if status is `COMPLETED`.

### 4.3 On-Time Completion Rate (%)
```
On-Time Rate = ( Tasks Completed with completionDate <= dueDate / Total Completed Tasks ) * 100
```
- If `Total Completed Tasks === 0`, On-Time Rate = `100%` (or indicated as `N/A - Chưa có dữ liệu`).

### 4.4 Overdue Task Count
A task is counted as overdue if and only if:
1. Status is not `COMPLETED`, and
2. Status is not `CANCELLED`, and
3. `status === "OVERDUE"` OR `status === "BLOCKED"` OR `isTaskPastDue(dueDate, referenceDate) === true`.

---

## 5. Dashboard Aggregation Contract

Implemented in `src/lib/dashboard-aggregator.ts`, the canonical return schema is:

```typescript
export interface DashboardStats {
  // Parent Task Metrics (School Tasks)
  totalSchoolTasks: number;
  schoolTasksInProgress: number;
  schoolTasksCompleted: number;
  schoolTasksNotStarted: number;
  schoolTasksWaitingApproval: number;
  schoolTasksOverdue: number;
  
  // Subtask Metrics (Staff Tasks)
  totalStaffTasks: number;
  staffTasksInProgress: number;
  staffTasksCompleted: number;
  staffTasksNotStarted: number;
  staffTasksWaitingApproval: number;
  staffTasksOverdue: number;
  
  // Unified Rollups
  needsReviewTasksCount: number; // schoolTasksWaitingApproval + staffTasksWaitingApproval
  overdueTasksCount: number;     // schoolTasksOverdue + staffTasksOverdue
  completionRate: number;        // (schoolTasksCompleted / validSchoolTasks) * 100
  cancelledTasksCount: number;
}
```

---

## 6. Implementation Checklist for New Metrics

When introducing any new metric or counter:
1. Locate `src/lib/dashboard-aggregator.ts`.
2. Add the formula calculation to `computeDashboardStats`.
3. Verify zero-denominator safeguards (`total === 0 ? 0 : ...`).
4. Exclude `CANCELLED` tasks explicitly from the denominator.
5. Ensure unit tests in `tests/` verify both empty arrays and mixed-status lists.
