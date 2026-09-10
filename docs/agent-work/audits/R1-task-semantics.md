# R1 Task Semantics & Domain Model Audit

**Document**: `docs/agent-work/audits/R1-task-semantics.md`  
**Auditor**: Agent R1 (QCET Work UI Semantic Consolidation)  
**Date**: 2026-09-10  
**Status**: COMPLETE — READ-ONLY RECONNAISSANCE AUDIT  
**Scope**:
- Database Schema (`prisma/schema.prisma` - Task, TaskStatus, TaskPriority, Assignee, Deliverable)
- API Contracts & Schemas (`src/contracts/tasks.ts`)
- Domain Task Entities & State Machine (`src/domain/tasks/*`)
- Server Services & Policies (`src/server/tasks/*`)
- Database Adapters (`src/lib/adapters/task-db-adapter.ts`)
- Dashboard & Calendar Aggregators (`src/lib/server/dashboard-service.ts`, `src/lib/dashboard-aggregator.ts`, `src/lib/work-calendar-adapter.ts`)
- Frontend Task Components & Kanban Board (`src/components/tasks/*`, `src/components/workspace/*`)

---

## Executive Summary

This forensic audit resolves the domain model ambiguity behind task status, approval, attention dimensions, and proves mathematically and programmatically the exact cause of the **Total = 395 vs Visible Kanban = 310 (Delta = 85)** discrepancy.

### Key Discoveries:
1. **The 85-Task Kanban Discrepancy is an Exact Enum Mismatch Bug in the Kanban Viewport**:
   - Total tasks in the operational dataset: **395** (now **406** in live database; **404** in dashboard query).
   - Visible tasks rendered across Kanban columns: **310** (now **319** in live database).
   - **Delta = 85 tasks** (75 `NOT_STARTED` + 9 `WAITING_APPROVAL` + 1 `OVERDUE`).
   - In `src/components/tasks/task-kanban-board.tsx`, `KANBAN_COLUMNS` declares only 4 column IDs: `NEW`, `IN_PROGRESS`, `NEEDS_REVIEW`, and `COMPLETED`.
   - The grouping function `groupTasksByStatus` places tasks into dictionary keys matching their raw status strings (`NOT_STARTED`, `WAITING_APPROVAL`, `OVERDUE`).
   - The UI rendering loop iterates *strictly* over `KANBAN_COLUMNS`. Because there are no columns for `NOT_STARTED`, `WAITING_APPROVAL`, or `OVERDUE`, and because `NEW` and `NEEDS_REVIEW` do not alias `NOT_STARTED` and `WAITING_APPROVAL`, **all 75 `NOT_STARTED` tasks, all 9 `WAITING_APPROVAL` tasks, and the 1 `OVERDUE` task are completely dropped from the DOM**.
2. **Triplicate Status Systems Running in Parallel**:
   - **Database / Prisma**: Uppercase enum `TaskStatus` (`NOT_STARTED`, `IN_PROGRESS`, `WAITING_APPROVAL`, `COMPLETED`, `OVERDUE`, `CANCELLED`).
   - **Domain / State Machine**: Canonical normalized statuses (`NEW`, `IN_PROGRESS`, `WAITING_APPROVAL`, `COMPLETED`, `CANCELLED`).
   - **Frontend / ViewModels**: A conflicting mix of lowercase strings (`not_started`, `in_progress`, `waiting_approval`, `completed`, `overdue`, `cancelled`) in `SchoolTask`, uppercase strings with legacy states (`NEW`, `NEEDS_REVIEW`, `BLOCKED`) in `StaffTask`, and custom collapsing in `work-calendar-adapter.ts`.
3. **Conflation of Temporal Health and User Attention with Lifecycle Status**:
   - `OVERDUE` is stored as an enum value in the database, yet it is simultaneously calculated dynamically across frontend components (`isTaskPastDue(dueDate)`). This creates split-brain states where a task is `IN_PROGRESS` in DB but labeled `OVERDUE` in UI, or `OVERDUE` in DB with no clear transition back to progress.
   - `WAITING_APPROVAL` is treated as a lifecycle stage, but "My Approval" vs "Pending Approval" is subjective per user persona and governed by Segregation of Duties (SoD).

---

## 1. DB Value to End-to-End Surface Mapping Matrix

Below is the complete trace of every task status from database persistence to domain entity, API transport, frontend adapters, Tasks workspace, Work Calendar, and Executive Dashboard.

| Database Enum (`TaskStatus`) | Domain Entity (`DomainTaskStatus`) | API DTO (`TaskDTO.status`) | Legacy Adapter (`task-db-adapter.ts`) | Tasks UI (`SchoolTask.status` / `StaffTask.status`) | Kanban Column (`KANBAN_COLUMNS`) | Calendar Mapping (`work-calendar-adapter.ts`) | Dashboard Aggregation (`dashboard-aggregator.ts`) | Included / Excluded Reason & Lifecycle Semantics |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`NOT_STARTED`** | `NOT_STARTED` (or normalized to `NEW`) | `"NOT_STARTED"` | `SchoolTask`: `'not_started'`<br>`StaffTask`: `'NEW'` | `SchoolTask`: `'NOT_STARTED'` or `'not_started'`<br>`StaffTask`: `'NEW'` | **DROPPED**<br>(Stored in `grouped['NOT_STARTED']`; no column exists. `NEW` column has count 0) | Converted to `'IN_PROGRESS'` (unless overdue) | Counted as `schoolTasksNotStarted` / `staffTasksNotStarted` | **Task exists but work has not commenced.** In Kanban, it is completely invisible because the column is titled "Mới / Tiếp nhận" with ID `'NEW'`, but tasks retain `'NOT_STARTED'`. |
| **`IN_PROGRESS`** | `IN_PROGRESS` | `"IN_PROGRESS"` | `SchoolTask`: `'in_progress'`<br>`StaffTask`: `'IN_PROGRESS'` | `'IN_PROGRESS'` / `'in_progress'` | **Rendered** in `IN_PROGRESS` column ("Đang thực hiện") | `'IN_PROGRESS'` (or `'OVERDUE'` if past due date) | Counted as `schoolTasksInProgress` / `staffTasksInProgress` | **Active working state.** Visible on all surfaces. |
| **`WAITING_APPROVAL`** | `WAITING_APPROVAL` | `"WAITING_APPROVAL"` | `SchoolTask`: `'waiting_approval'`<br>`StaffTask`: `'NEEDS_REVIEW'` | `'WAITING_APPROVAL'` / `'waiting_approval'` / `'NEEDS_REVIEW'` | **DROPPED**<br>(Stored in `grouped['WAITING_APPROVAL']`; no column exists. `NEEDS_REVIEW` column has count 0) | Converted to `'IN_PROGRESS'` (unless overdue) | Counted as `schoolTasksWaitingApproval` (also checks progress = 100%) | **Maker completed work; awaiting Checker/Approver review.** Dropped in Kanban because column ID is `'NEEDS_REVIEW'`. In Calendar, collapsed into `'IN_PROGRESS'`. |
| **`COMPLETED`** | `COMPLETED` | `"COMPLETED"` | `SchoolTask`: `'completed'`<br>`StaffTask`: `'COMPLETED'` | `'COMPLETED'` / `'completed'` | **Rendered** in `COMPLETED` column ("Hoàn thành") | `'COMPLETED'` | Counted as `schoolTasksCompleted` / `staffTasksCompleted` | **Terminal approved state.** Progress is 100%. Visible on all surfaces. |
| **`OVERDUE`** | `OVERDUE` | `"OVERDUE"` | `SchoolTask`: `'overdue'`<br>`StaffTask`: `'BLOCKED'` | `'OVERDUE'` / `'overdue'` / `'BLOCKED'` | **DROPPED**<br>(Stored in `grouped['OVERDUE']`; no column exists) | `'OVERDUE'` (or `'urgent_overdue'`) | Counted as `schoolTasksOverdue` (along with any past-due tasks) | **Temporal breach state in DB.** Dropped in Kanban because no column exists. Redundant with dynamic overdue calculation. |
| **`CANCELLED`** | `CANCELLED` | `"CANCELLED"` | `SchoolTask`: `'cancelled'`<br>`StaffTask`: `'BLOCKED'` | `'CANCELLED'` / `'cancelled'` | **DROPPED**<br>(Filtered out by query, or grouped into unrendered key) | **EXCLUDED**<br>(Filtered out by query) | **EXCLUDED** from active counts; tracked as `cancelledTasksCount` | **Administrative voiding.** Excluded by default from dashboard query `where: { status: { not: 'CANCELLED' } }`. |

### Synthetic / Transient States Present in Codebase:

- **`NEW`**: Exists in `src/types/dashboard.ts` (`TaskStatus`), `domain/tasks/state-machine.ts`, and Kanban column config. In the database, tasks are created as `NOT_STARTED`. The adapter maps `NOT_STARTED` to `NEW` for `StaffTask`, but leaves it as `not_started` or raw `NOT_STARTED` for `SchoolTask`.
- **`NEEDS_REVIEW`**: Used interchangeably with `WAITING_APPROVAL` in legacy client code (`StaffTask`, `UniversalActionQueue`). In DB, this is strictly `WAITING_APPROVAL`.
- **`BLOCKED`**: Present in UI types and mapped from `OVERDUE` / `CANCELLED` in `mapPrismaTaskToStaffTask`. It does not exist in Prisma schema `TaskStatus`.
- **`PENDING_EXECUTIVE_APPROVAL`**: Used in `types/dashboard.ts` and `use-adaptive-workspace-data.ts` to identify School-level tasks requiring Principal (Hiệu trưởng / Ban Giám hiệu) statutory approval. In DB, it is represented as `WAITING_APPROVAL` with `scope = 'SCHOOL'`.

---

## 2. Forensic Resolution of Count Discrepancy: Total = 395 vs Visible Kanban = 310 (Delta = 85)

### 2.1 The Mathematical Proof

The observed count discrepancy is governed by the following strict identity:

$$\text{Total Tasks} (395) - \text{Visible Kanban Items} (310) = \Delta (85)$$

The 85-task delta decomposes into three specific database status buckets:

$$\Delta = N_{\text{NOT\_STARTED}} + N_{\text{WAITING\_APPROVAL}} + N_{\text{OVERDUE}}$$
$$85 = 75 + 9 + 1$$

| Status Category | Database Count (Snapshot) | Database Count (Live DB) | Kanban Column Config ID | Column Count in UI | Tasks Dropped from Kanban |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NOT_STARTED` | **75** | **75** | `NEW` ("Mới / Tiếp nhận") | **0** | **-75** (Invisible) |
| `WAITING_APPROVAL` | **9** | **9** | `NEEDS_REVIEW` ("Cần chỉnh sửa") | **0** | **-9** (Invisible) |
| `OVERDUE` | **1** | **1** | *(None)* | *(N/A)* | **-1** (Invisible) |
| **Sum of Invisible Tasks** | **85** | **85** | — | — | **-85 (Delta)** |
| `IN_PROGRESS` | 294 | 303 | `IN_PROGRESS` ("Đang thực hiện") | 303 | 0 (Visible) |
| `COMPLETED` | 16 | 16 | `COMPLETED` ("Hoàn thành") | 16 | 0 (Visible) |
| **Sum of Visible Tasks** | **310** | **319** | — | **319** | — |
| **Total Query Tasks** | **395** | **404** | — | — | — |

*(Note: In the live database today, total tasks in `getLiveDashboardData` is 404, visible Kanban is 319, and the delta remains exactly **85**).*

### 2.2 Forensic Code Path Analysis

The data drop occurs through a two-stage bug in `src/components/tasks/task-kanban-board.tsx`:

#### Stage 1: Grouping preserves unmapped keys
In `src/components/tasks/task-kanban-board.tsx` (lines 238–274):
```typescript
export function groupTasksByStatus(
  tasks: SchoolTask[],
  levelFilter: TaskLevelFilter = "ALL",
  categoryFilter: TaskCategory | "ALL" = "ALL",
  searchQuery: string = ""
): Record<TaskStatus, KanbanItem[]> {
  const filtered = filterKanbanItems(tasks, levelFilter, categoryFilter, searchQuery);

  const grouped: Record<TaskStatus, KanbanItem[]> = {
    NEW: [],
    NOT_STARTED: [],
    IN_PROGRESS: [],
    WAITING_APPROVAL: [],
    PENDING_EXECUTIVE_APPROVAL: [],
    NEEDS_REVIEW: [],
    BLOCKED: [],
    COMPLETED: [],
    OVERDUE: [],
    CANCELLED: [],
  };

  for (const item of filtered) {
    if (grouped[item.status]) {
      grouped[item.status].push(item);
    } else {
      grouped.IN_PROGRESS.push(item);
    }
  }

  return grouped;
}
```
- Because `item.status` for the 75 tasks is `"NOT_STARTED"`, `grouped['NOT_STARTED']` is truthy. They are pushed into `grouped.NOT_STARTED`.
- Because `item.status` for the 9 tasks is `"WAITING_APPROVAL"`, they are pushed into `grouped.WAITING_APPROVAL`.
- Because `item.status` for the 1 task is `"OVERDUE"`, it is pushed into `grouped.OVERDUE`.
- `grouped.NEW` and `grouped.NEEDS_REVIEW` remain completely empty (`length: 0`).

#### Stage 2: UI Column Rendering Iterates Strictly over KANBAN_COLUMNS
In `src/components/tasks/task-kanban-board.tsx` (lines 46–95 and 405–410):
```typescript
export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  { id: "NEW", title: "Mới / Tiếp nhận", ... },
  { id: "IN_PROGRESS", title: "Đang thực hiện", ... },
  { id: "NEEDS_REVIEW", title: "Cần chỉnh sửa", ... },
  { id: "COMPLETED", title: "Hoàn thành", ... },
];

// Inside TaskKanbanBoard JSX:
{KANBAN_COLUMNS.map((col, idx) => {
  const colTasks = groupedTasks[col.id] || [];
  ...
  return ( ... );
})}
```
- The JSX renderer maps *only* `KANBAN_COLUMNS`.
- It accesses `groupedTasks['NEW']` (which is 0).
- It accesses `groupedTasks['NEEDS_REVIEW']` (which is 0).
- It accesses `groupedTasks['IN_PROGRESS']` (which is 303 / 294).
- It accesses `groupedTasks['COMPLETED']` (which is 16).
- **It never accesses `groupedTasks['NOT_STARTED']`, `groupedTasks['WAITING_APPROVAL']`, or `groupedTasks['OVERDUE']`.**
- Result: 85 tasks exist in the application memory state and in the Table view, but vanish completely from the Kanban board.

### 2.3 Additional Exclusions from the Database Query

Beyond the 85-task Kanban bug, the database itself contains **406** tasks. Two tasks are excluded before reaching the frontend query in `src/lib/server/dashboard-service.ts`:
1. `scope: TaskScope.INDIVIDUAL` (1 task: `cmtrag205003dviu2pshkppp5` - "Nghiên cứu phát triển module AI..."). Excluded because the dashboard query explicitly filters for `scope: { in: [TaskScope.SCHOOL, TaskScope.DEPARTMENT] }`.
2. `status: TaskStatus.CANCELLED` (1 task: `task_test_1789019492084` - "Nhiệm vụ kiểm thử V2..."). Excluded because the dashboard query explicitly filters for `status: { not: TaskStatus.CANCELLED }`.
3. Subtasks (`parentTaskId != null`): Currently 0 subtasks in DB, but if subtasks exist, `where: { parentTaskId: null }` prevents double-counting them at the top level while attaching them inside `SchoolTask.subTasks`.

---

## 3. Orthogonal Decomposition: Lifecycle Status vs. User Attention State

A fundamental root cause of UI clutter and contradictory metric cards across QCET E-Office is the conflation of **Objective Task Lifecycle Status** with **Subjective User Attention State**.

```
+-------------------------------------------------------------------------------+
|                             TASK DOMAIN MODEL                                 |
+-------------------------------------------------------------------------------+
         |                                             |
         v                                             v
+-----------------------------+               +---------------------------------+
|   TASK LIFECYCLE STATUS     |               |      USER ATTENTION STATE       |
|  (Objective Entity State)   |               |   (Subjective Action Required)  |
+-----------------------------+               +---------------------------------+
| * NEW / NOT_STARTED         |               | * Checker: "Cần tôi duyệt"     |
| * IN_PROGRESS               |               |   (Waiting for My Approval)     |
| * WAITING_APPROVAL          |               | * Maker: "Cần tôi nộp/làm"      |
| * COMPLETED                 |               |   (Assigned to Me / Submission) |
| * CANCELLED                 |               | * Temporal: "Quá hạn / Khẩn"    |
+-----------------------------+               |   (Overdue / Urgent Attention)  |
                                              | * Informational / Observer      |
                                              +---------------------------------+
```

### 3.1 Task Lifecycle Status (Objective State)
Lifecycle status describes the state machine position of the task entity itself, independent of who is looking at it:
- `NOT_STARTED` / `NEW`: Task is created and assigned; work has not begun.
- `IN_PROGRESS`: Assignee is actively executing; progress is between 1% and 99%.
- `WAITING_APPROVAL`: Maker has submitted deliverables or marked 100%; task is awaiting institutional review.
- `COMPLETED`: Reviewer accepted deliverables; task is frozen and closed.
- `CANCELLED`: Administratively abandoned or superseded.

### 3.2 User Attention State (Subjective Action Context)
Attention represents what the currently logged-in user needs to DO about the task. It is a function of:
$$\text{Attention}(\text{Task}, \text{CurrentUser}, \text{CurrentTime}) \rightarrow \text{Action}$$

#### A. Checker / Approver Attention ("Cần tôi phê duyệt" — `pendingApprovals`):
- **Condition**: Task is in `WAITING_APPROVAL`.
- **Authority**: Current user has statutory approval rights (Ban Giám hiệu for `SCHOOL` scope, Trưởng phòng/Khoa for `DEPARTMENT` scope, or Lead Assignee for subtasks).
- **Segregation of Duties (SoD / Maker-Checker Invariant)**: The user **cannot** be the person who submitted the deliverable or the primary assignee (unless Hiệu trưởng statutory executive override applies).
- **Action**: Approve, Request Changes (Yêu cầu chỉnh sửa), or Reject.

#### B. Maker Attention ("Cần tôi nộp / xử lý" — `myPendingSubmissions`):
- **Condition**: Task is assigned to current user (`isAssignedToUser(task, user)`).
- **Status**: Task is in `NOT_STARTED` or `IN_PROGRESS`, or was returned with `REVISION_REQUIRED`.
- **Action**: Begin execution, update progress, or submit deliverable.

#### C. Temporal Attention ("Quá hạn" — `isOverdue`):
- **Invariant**: `OVERDUE` is **not** a valid static lifecycle status; it is a **temporal condition**.
- A task in `IN_PROGRESS` whose `dueDate < referenceDate` requires urgent attention, but its lifecycle status remains `IN_PROGRESS`.
- A task in `WAITING_APPROVAL` whose `dueDate < referenceDate` requires executive expediting, but its lifecycle status remains `WAITING_APPROVAL`.
- Elevating `OVERDUE` to a mutually exclusive status in `TaskStatus` enum forces the system to erase whether the task was in progress, awaiting review, or not started.

---

## 4. Comprehensive Inventory of Task Statuses & Approval Responsibilities

### 4.1 Detailed Status Inventory Across All Lifecycle States

| Status Category | Database Representation | Progress Bounds | Query Visibility / Filter Semantics | Terminal / Mutability | Lifecycle Definition & Business Semantics |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ACTIVE: NOT_STARTED** | `TaskStatus.NOT_STARTED` | `progressPercent === 0` | Query includes; historically dropped in Kanban due to `NEW` column id mismatch | Mutable (Can transition to `IN_PROGRESS` or `CANCELLED`) | Task record established and assigned to DRI/collaborators. Operational work has not commenced. In UI, displayed in Table and TaskDetail; dropped in naive Kanban. |
| **ACTIVE: IN_PROGRESS** | `TaskStatus.IN_PROGRESS` | `progressPercent` 1% to 99% | Query includes; rendered in Kanban `IN_PROGRESS` column | Mutable (Can transition to `WAITING_APPROVAL`, `CANCELLED`) | Operational execution underway. Assignee updating progress notes, checklists, or interim deliverables. |
| **ACTIVE: WAITING_APPROVAL** | `TaskStatus.WAITING_APPROVAL` | Typically `progressPercent === 100` | Query includes; historically dropped in Kanban due to `NEEDS_REVIEW` column id mismatch | Mutable (Transitions to `COMPLETED` on approval, `IN_PROGRESS` on revision request, or `CANCELLED`) | Maker/DRI completed work and submitted deliverables or 100% completion declaration. Awaiting statutory review from authorized Checker. |
| **ACTIVE: OVERDUE (Static Enum)** | `TaskStatus.OVERDUE` | Any | Query includes (1 record in DB); historically dropped in Kanban (no column defined) | Mutable (Can transition to `IN_PROGRESS` or `COMPLETED`) | Legacy static enum value representing past-due deadline. Redundant with dynamic temporal check `dueDate < referenceDate`. Must be projected into `IN_PROGRESS` with visual warning badge. |
| **SYNTHETIC ACTIVE: NEW** | Client alias for `NOT_STARTED` | `progressPercent === 0` | Kanban column `NEW`; `StaffTask.status` | Mutable | Legacy client-side alias introduced in `types/dashboard.ts` and `KANBAN_COLUMNS`. Does not exist in Prisma enum. |
| **SYNTHETIC ACTIVE: PENDING_EXECUTIVE_APPROVAL** | DB: `WAITING_APPROVAL` with `scope: SCHOOL` | `progressPercent === 100` | Unified query maps to `WAITING_APPROVAL` | Mutable | Specialized classification for School-level tasks requiring Principal / BGH statutory approval. |
| **SYNTHETIC ACTIVE: NEEDS_REVIEW** | Client alias for `WAITING_APPROVAL` | `progressPercent === 100` | Kanban column `NEEDS_REVIEW`; `StaffTask.status` | Mutable | Legacy client-side alias. Does not exist in Prisma enum. |
| **ARCHIVED** | `Task.archivedAt != null`, `archivedById`, `archiveReason` | 100% or frozen | Currently NOT filtered out in `dashboard-service.ts` query (risk of active count inflation) | Read-only / Frozen (Can be unarchived by Administrator) | Completed or retired tasks from prior academic years/semesters preserved for institutional accreditation and historical audit trails. Governed by `TaskArchiver` relation. |
| **CANCELLED** | `TaskStatus.CANCELLED` | Any | Explicitly excluded via `where: { status: { not: TaskStatus.CANCELLED } }` (1 record in DB) | **Terminal & Immutable** | Formally abandoned, voided, or superseded task (e.g. ministerial cancellation, duplicate assignment). Excluded from active dashboards and metrics. |
| **DELETED** | Hard database deletion (No `deletedAt` column exists on `Task` model) | N/A | Removed from database permanently | **Permanent** | Prisma `Task` model has no soft-delete column (`deletedAt`). Deletion triggers cascading delete on `subTasks`, `assignees`, `deliverables`, `actors`, `approvalProcesses`, and `taskResults`. Prohibited once work commences. |

### 4.2 Approval Responsibilities & Governance Framework

Approval authority within QCET E-Office is statutory and legal, anchored in Vietnamese vocational education regulations (Luật Giáo dục nghề nghiệp, Thông tư 15/2021/TT-BLĐTBXH Điều lệ Trường Cao đẳng, QĐ 283/QĐ-CĐKTCNQN Quy chế Tổ chức và Hoạt động, QĐ 420/QĐ-CĐKTCNQN Quy định Giao việc và Quản lý Tiến độ).

#### A. Statutory Approval Tiers
1. **Executive Tier (Ban Giám hiệu — Hiệu trưởng, Phó Hiệu trưởng)**:
   - **Scope Authority**: Full statutory jurisdiction over all `TaskScope.SCHOOL` tasks (`originLevel === 'SCHOOL'`).
   - **Approval Power**: Final approval of institutional initiatives, strategic plans, accreditation documentation, and inter-departmental policies (`PENDING_EXECUTIVE_APPROVAL`).
   - **Executive Interventions**: Enacts `ExecutiveResolution` records (extend deadline, reassign owner, issue directive note, dismiss bottleneck).
   - **Positions**: Hiệu trưởng, Phó Hiệu trưởng (Role: `HIEU_TRUONG`, `PHO_HIEU_TRUONG`, `ADMIN`, `BAN_GIAM_HIEU`).

2. **Unit Leadership Tier (Trưởng phòng, Trưởng khoa, Giám đốc Trung tâm)**:
   - **Scope Authority**: Statutory jurisdiction over all `TaskScope.DEPARTMENT` tasks within their appointed unit (`task.departmentId === user.departmentId` or `task.leadUnitId === user.unitId`).
   - **Approval Power**: Approves deliverable submissions, technical plans, and milestone completions for departmental personnel.
   - **Positions**: Trưởng phòng, Phó Trưởng phòng, Trưởng khoa, Phó Trưởng khoa, Giám đốc trung tâm.

3. **Operational DRI / Lead Assignee Tier**:
   - **Scope Authority**: Subtasks (`parentTaskId != null`) and collaborative assignments.
   - **Review Power**: Evaluates collaborator deliverables (`TaskDeliverable.reviewStatus`: `PENDING` -> `APPROVED` | `REVISION_REQUIRED`). Aggregates completed work before final submission to Unit Head or BGH.

4. **Staff / Faculty Specialist Tier (Chuyên viên, Giảng viên)**:
   - **Maker Only**: Executes tasks, updates progress percentage, uploads deliverables. Has **zero** statutory institutional approval authority.

#### B. Separation of Duties (SoD / Maker-Checker Invariant)
The core governance rule strictly enforced in `src/domain/tasks/contract.ts` and `src/domain/tasks/attention-resolver.ts`:

$$\text{Maker}(\text{Task}) \cap \text{Checker}(\text{Task}) = \emptyset$$

- **Anti-Self-Approval Rule**: An individual who acted as Maker (Creator `createdById`, Primary DRI `primaryOwnerId`, Assignee/Collaborator `assigneeIds`, or Deliverable Submitter `submittedByUserId` / `deliverables.uploadedById`) **cannot** approve or reject that task.
- Even if a Department Head creates a task where they are designated as the lead executor, they cannot self-approve it upon completion; the task must escalate to Ban Giám hiệu for independent review.
- Violations are rejected deterministically with code `CANNOT_APPROVE_OWN_TASK`.

#### C. Database Architecture for Approval Processes
The database schema (`prisma/schema.prisma`) provides dedicated relational models for structured, audit-proof approval flows:
- **`TaskApprovalProcess`**: Tracks workflow lifecycle (`NOT_STARTED`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `CANCELLED`), tracking `totalSteps` and `currentStepIndex`.
- **`TaskApprovalStep`**: Ordered approval checkpoints with `reviewerAssignmentId` (pointing to `PositionAssignment`), `reviewerUserId`, `stepOrder`, `status` (`PENDING`, `APPROVED`, `REJECTED`, `BYPASSED`), and cryptographic/audit `decisionNote` with `decidedAt`.
- **`TaskActor`**: Maps operational actors to specific roles (`ASSIGNER`, `LEAD_UNIT`, `COORDINATING_UNIT`, `DRI`, `COLLABORATOR`, `FOLLOWER`, `REVIEWER`, `APPROVER`, `OBSERVER`).
- **`TaskResult`**: Holds verified outcomes, linking `submittedByUserId` (Maker) and `verifiedByUserId` (Checker) with verifiable evidence (`reportUrl`, `summary`).

---

## 5. Cross-Subsystem Inconsistencies & Collateral Damage

### 5.1 Work Calendar Adapter Collapse
In `src/lib/work-calendar-adapter.ts` (lines 86 and 115):
```typescript
status: task.status === "COMPLETED" ? "COMPLETED" : isOverdue ? "OVERDUE" : "IN_PROGRESS"
```
- The calendar adapter forcibly collapses all statuses into only 3 values: `COMPLETED`, `OVERDUE`, or `IN_PROGRESS`.
- Any task in `WAITING_APPROVAL` or `NOT_STARTED` is wiped out and rendered as `IN_PROGRESS`.
- The user cannot tell from the calendar whether a deadline requires their review or their submission.

### 5.2 Dashboard Aggregator Double-Counting & Assumptions
In `src/lib/dashboard-aggregator.ts` (lines 62–71):
```typescript
const isWaitingApproval =
  t.status === "WAITING_APPROVAL" ||
  t.status === "PENDING_EXECUTIVE_APPROVAL" ||
  (rawProgress === 100 && t.status !== "COMPLETED");

const isOverdue =
  t.status === "OVERDUE" ||
  t.status === "BLOCKED" ||
  (t.status !== "COMPLETED" && isTaskPastDue(t.dueDate, referenceDate));
```
- If a task has `rawProgress === 100`, the aggregator classifies it as `schoolTasksWaitingApproval`, even if its database status is still `IN_PROGRESS`.
- If a task is past due, it gets counted as `schoolTasksOverdue`, subtracting it from `schoolTasksInProgress`.
- The sum of dashboard status buckets does not match the database `TaskStatus` distribution because of these heuristic overrides.

### 5.3 Client-Side SoD Evaluation vs Server Truth
In `src/components/workspace/hooks/use-adaptive-workspace-data.ts`:
- The client re-evaluates complex authorization rules (`canUserApproveParentTask`, `canUserApproveSubTask`) using role strings (`ADMIN`, `MANAGER`, `STAFF`) and name string matching (`matchesUser(t.assignedTo, user)`).
- This violates **Rule 05-domain-freeze** and **Universal Invariant 3 (Server Truth Wins)**.
- Authority to approve must be provided authoritatively by the backend via `task.availableActions` or `GET /api/me/inbox`.

---

## 6. Architectural Remediation Plan (Requirements for F1 / F2 / P1)

To restore semantic integrity and eliminate the 85-task ghost delta, subsequent waves must execute the following canonical remediations:

1. **Fix Kanban Column Alignment (Immediate / Wave 1)**:
   - Option A: Add a dedicated column for `NOT_STARTED` ("Chưa thực hiện" / "Tiếp nhận") and a dedicated column for `WAITING_APPROVAL` ("Chờ duyệt" / "Nghiệm thu").
   - Option B: Normalize task grouping so that `NOT_STARTED` maps to `NEW`, and `WAITING_APPROVAL` maps to `NEEDS_REVIEW` (renaming the column title to "Chờ duyệt / Nghiệm thu").
   - Map `OVERDUE` tasks to their operational stage (`IN_PROGRESS` or `WAITING_APPROVAL`) while attaching an `isOverdue` visual warning badge, rather than dropping them.
2. **Canonicalize Task Status in Types**:
   - Align `SchoolTask.status` and `StaffTask.status` to strict uppercase `TaskStatus` from `@prisma/client`. Eliminate lowercase status strings across all adapters and view models.
3. **Deprecate Static OVERDUE in Database**:
   - Treat `isOverdue` strictly as a calculated virtual property (`dueDate < referenceDate && status !== 'COMPLETED'`).
4. **Decouple Universal Action Queue from Task Array Traversal**:
   - Migrate `pendingApprovals` in `UniversalActionQueue` to consume `GET /api/me/inbox` or server-computed `availableActions.canApprove`.

---

## 7. Verification Proof

Live programmatic verification executed against the repository confirms:
- **Prisma Task Table Total**: 406 records.
- **Top-Level Dashboard Query**: 404 records (1 `CANCELLED` excluded, 1 `INDIVIDUAL` excluded).
- **Kanban Visible Sum**: 319 records (`NEW`: 0, `IN_PROGRESS`: 303, `NEEDS_REVIEW`: 0, `COMPLETED`: 16).
- **Kanban Invisible Dropped**: Exactly **85 records** (`NOT_STARTED`: 75, `WAITING_APPROVAL`: 9, `OVERDUE`: 1).
- **Discrepancy Formula**: $404 - 319 = 85$. Verified.
