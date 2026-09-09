---
name: qcet-data-audit
description: "Audit data integrity, metric calculations, operational data sources, time/date standardization in ICT (UTC+7), and server truth reconciliation in QCET E-Office."
---

# QCET Data Audit Checklist (`qcet-data-audit`)

This checklist defines the data integrity requirements for QCET E-Office. It must be applied whenever introducing or refactoring business metrics, calculations, data queries, caching, or date manipulation.

---

## 1. Zero Hardcoded or Synthetic Operational Data

- [ ] **Database-Backed Metrics**:
  - All operational counts (total tasks, completion rates, overdue tasks, pending approvals, notifications) originate from authenticated Prisma database queries or API endpoints.
  - No static arrays (`const MOCK_TASKS = [...]`), placeholder percentages (`88%`), or synthetic progress bars in production components.
- [ ] **No Artificial Fallbacks**:
  - In error or empty states, display `0` or explicit empty state UI rather than defaulting to hardcoded demo numbers.

---

## 2. Canonical Metric Formulas (`docs/product/metrics.md`)

- [ ] **One Metric, One Canonical Formula**:
  - **Task Completion Rate (%)**:
    $$\text{Completion Rate} = \frac{\text{Completed Parent Tasks}}{\text{Total Parent Tasks}} \times 100$$
    (Or subtask completion if explicitly labeled as "Tỉ lệ hoàn thành công việc chi tiết").
  - **Overdue Tasks (Quá hạn)**:
    $$\text{isOverdue} = \text{dueDate} < \text{currentDate} \land \text{status} \neq \text{'COMPLETED'}$$
  - **Active Tasks (Đang thực hiện)**:
    $$\text{isActive} = \text{status} \in \{\text{'IN_PROGRESS'}, \text{'PENDING'}\}$$
  - **Blocked Tasks (Tắc nghẽn / Cần hỗ trợ)**:
    $$\text{isBlocked} = \text{status} == \text{'BLOCKED'}$$
- [ ] **Formula Consistency Across Views**:
  - Overview strip, Kanban columns, Task data tables, and Monthly partition filters calculate metrics with identical business logic.
- [ ] **Shared Metric Implementations**:
  - Calculation logic resides in `src/lib/server/metrics/task-metrics.ts` or `src/lib/metrics/` rather than inline ad-hoc math scattered across components.

---

## 3. Parent Task vs Subtask Denominator Separation

- [ ] **Explicit Denominators**:
  - Parent tasks (nhiệm vụ cha) and subtasks (công việc chi tiết) must NEVER be commingled into a single denominator in task rollups.
  - Parent task statistics filter by `parentId: null`.
  - Subtask statistics filter by `parentId !== null`.
- [ ] **Avoid Double-Counting**:
  - Total workload count must not sum $(M \text{ parents} + N \text{ subtasks})$ together into a single total unless explicitly labeled as "Tổng số đầu việc".
- [ ] **Parent Progress Derivation**:
  - A parent task's progress percentage is either calculated from its direct child subtasks completion or updated via state transition, but never both simultaneously in conflicting ways.

---

## 4. Date & Time Standardization (ICT UTC+7 & Academic Calendar)

- [ ] **Indochina Timezone (ICT, UTC+7)**:
  - All date calculations, day boundaries, and display values must be anchored in `Asia/Ho_Chi_Minh` timezone.
  - Never use naive UTC conversions (e.g. `toISOString().slice(0, 10)`) which shift midnight boundaries by 7 hours (leading to yesterday/tomorrow bugs for actions at 23:00 UTC / 06:00 ICT).
- [ ] **Academic Calendar Engine**:
  - Academic weeks, semester dates, and monthly partitions must use helper functions from `src/lib/academic-calendar.ts`.
  - System reference date for date calculations must be retrieved via `getSystemReferenceDate()`.
- [ ] **Formatted Dates**:
  - User-visible dates use Vietnamese formatting: `DD/MM/YYYY` or `DD/MM/YYYY HH:mm`.

---

## 5. Database Truth vs Client Cache & Optimistic State

- [ ] **Server State Is Canonical**:
  - Database state from PostgreSQL/Prisma is the ultimate source of truth.
  - Client state (`useState`, Zustand, SWR cache, React Query) is a transient reflection of server truth.
- [ ] **Optimistic Update Rollback**:
  - If an optimistic mutation (e.g. dragging a task to "COMPLETED") fails on the server, the UI must immediately revert the visual state to the previous server snapshot and alert the user.
- [ ] **Cache Invalidation on Mutation**:
  - Successful mutations must trigger automatic revalidation of all affected queries (e.g. task list, counters, activity logs).
- [ ] **Query-Stat Derivation Symmetry**:
  - The number of rows returned in the task table must match the count displayed on the corresponding scope tab badge.
