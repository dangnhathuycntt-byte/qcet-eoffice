# Task 3 Report: Canonical Task Query & Command Domain Services (Phase 4 & Phase 5)

## Executive Summary
In compliance with the QCET E-Office core invariants ("One Capability, One Canonical Implementation", "Role Is Not Scope", "Server Truth Wins", "Never Invent Operational Data"), the task management domain has been decoupled from route handlers and consolidated into a server domain layer in `src/server/tasks/`.

All task querying, policy authorization checks, and state mutations now flow through:
1. `src/server/tasks/task-policy.ts`: Canonical authorization rules, scope filtering validation, and Segregation of Duties (SoD) enforcement.
2. `src/server/tasks/task-query-service.ts`: Canonical task query engine with scope resolution (`school`, `department`, `individual`, `my`), status mapping, overdue calculation, and metrics aggregation adhering to "One Metric, One Definition".
3. `src/server/tasks/task-command-service.ts`: Canonical atomic mutations (`createTask`, `updateTask`, `deleteTask`, `submitDeliverable`, `reviewDeliverable`, `approveTask`, `rejectTask`) executing inside Prisma transactions with atomic code generation and Next.js 15 `after()` background push notifications.

Existing API routes (`src/app/api/tasks/route.ts`, `src/app/api/tasks/[id]/route.ts`, and `src/app/api/tasks/[id]/deliverables/route.ts`) have been refactored into thin controllers delegating entirely to this domain service layer, while maintaining 100% backward compatibility with client expectations and existing tests.

---

## 1. Domain Service Layer Architecture

```
src/server/tasks/
├── task-policy.ts          # Authorization, SoD checks & active delegation verification
├── task-query-service.ts   # Canonical queries, pagination, relations & metrics
├── task-command-service.ts # Atomic mutations, transaction boundaries, code gen, push notifications
└── index.ts                # Unified public export
```

### Component Breakdown

| Module | Primary Responsibilities | Key Functions / Methods |
|---|---|---|
| `task-policy.ts` | Enforces authorization rules, Segregation of Duties, and active delegation checks. | `canUserCreateTask`, `canUserUpdateTask`, `canUserApproveTask`, `canUserDeleteTask`, `canUserSubmitDeliverable`, `canUserReviewDeliverable`, `canUserTransitionStatus`, `checkActiveDelegation` |
| `task-query-service.ts` | Handles standardized data retrieval, scope filtering, pagination, and unified metric aggregation. | `queryTasks(ctx, filters)`, `getTaskById(taskId)`, `getTaskMetrics(ctx, filters)` |
| `task-command-service.ts` | Orchestrates atomic writes, state machine transitions, single DRI enforcement, and background push notifications. | `createTask(ctx, input)`, `updateTask(ctx, taskId, input)`, `deleteTask(ctx, taskId)`, `submitDeliverable(ctx, taskId, input)`, `reviewDeliverable(ctx, taskId, input)`, `approveTask(ctx, taskId)`, `rejectTask(ctx, taskId)` |

---

## 2. Invariant Enforcement & Business Rules

### Role Is Not Scope
- **Role defines user authority**: `BAN_GIAM_HIEU`, `ADMIN`, `TRUONG_PHONG`, `CHUYEN_VIEN`.
- **Scope defines dataset filters**: `SCHOOL`, `DEPARTMENT`, `INDIVIDUAL`, `my`.
- Querying tasks by `scope: 'school'` filters tasks with `scope = TaskScope.SCHOOL` irrespective of the caller's role.
- Querying tasks by `scope: 'my'` filters tasks where `assignees: { some: { userId: user.id } }`.
- Permission to create school-level tasks (`TaskScope.SCHOOL`) is strictly reserved for privileged users (`BAN_GIAM_HIEU`, `ADMIN`).

### Segregation of Duties (SoD - Chống tự duyệt)
- **Assignee Self-Approval Prohibition**: An assignee (`task.assignees.some(a => a.userId === user.id)`) cannot approve their own task into `COMPLETED` status, unless they hold an active administrative delegation (`dacumDelegation`) or privileged role.
- **Deliverable Submitter Approval Prohibition**: A user who submitted a deliverable (`deliverable.uploadedById === user.id`) is strictly prohibited from reviewing/approving their own deliverable.
- **School Task Approval Authority**: Approving school-scope tasks is restricted to `BAN_GIAM_HIEU` and `ADMIN` (or active delegates).
- **Department Task Approval Authority**: Approving department-scope tasks requires `BAN_GIAM_HIEU`, `ADMIN`, the department's `TRUONG_PHONG`, or active delegation.

### Single DRI & Collaborator Deduplication
- Primary owner (`AssigneeRole.PRIMARY_OWNER`) is assigned from `assigneeId`.
- Collaborators (`AssigneeRole.COLLABORATOR`) are deduplicated and guaranteed to exclude the primary owner.
- Subtasks inherit department, academic month, and academic year from the parent task if omitted.

### Atomic Code Generation & Background Push Dispatch
- `generateTaskCodeAtomic` executes inside `prisma.$transaction` to guarantee collision-free sequence numbers in `NV-YYYY-MM-XXX` format.
- Notification dispatching runs asynchronously via `safeAfter()` (Next.js 15 `after()`), ensuring non-blocking responses without request-context memory leaks in unit testing environments.

### Unified Metric Aggregation ("One Metric, One Definition")
- Total, in-progress, waiting approval, completed, and overdue metrics are calculated using canonical definitions.
- Overdue evaluation uses `getSystemReferenceDate()` and local ICT (Asia/Ho_Chi_Minh) date boundaries via `formatLocalDate` and `isTaskPastDue`, strictly prohibiting UTC slicing.

---

## 3. Route Handlers Refactoring

All duplicate business logic, inline Prisma transaction loops, and bespoke error handling were extracted from route handlers:

1. **`src/app/api/tasks/route.ts`**:
   - `GET`: Authenticates session, parses query parameters, delegates to `taskQueryService.queryTasks`, and returns both canonical pagination and backward-compatible fields (`tasks`, `total`, `totalCount`).
   - `POST`: Authenticates session, parses payload, delegates to `taskCommandService.createTask`, and returns `{ success: true, task, data }` with HTTP 201.
2. **`src/app/api/tasks/[id]/route.ts`**:
   - `GET`: Delegates to `taskQueryService.getTaskById`.
   - `PATCH`: Delegates to `taskCommandService.updateTask`.
   - `DELETE`: Delegates to `taskCommandService.deleteTask`.
3. **`src/app/api/tasks/[id]/deliverables/route.ts`**:
   - `POST`: Delegates to `taskCommandService.submitDeliverable`.
   - `PATCH`: Delegates to `taskCommandService.reviewDeliverable`.

---

## 4. Verification & Testing

A comprehensive unit and integration test suite was created in `tests/task-domain-services.test.ts`, covering all policy rules, query permutations, and command mutations.

### Test Execution Results

All 50 tests across 5 test suites passed cleanly:

1. **`tests/task-domain-services.test.ts`** (15 tests, 0 failures):
   - Policy: `canUserCreateTask` scope authorization checks.
   - Policy: `canUserUpdateTask` creator, assignee, department leader, and admin checks.
   - Policy: `canUserApproveTask` Segregation of Duties and School Scope restrictions.
   - Policy: `canUserReviewDeliverable` Separation of Duties rejection for submitters.
   - Policy: `canUserDeleteTask` creator/admin restrictions.
   - Commands: `createTask` with single DRI and deduplicated collaborators.
   - Commands: `createTask` subtask metadata inheritance.
   - Commands: `updateTask` progress, priority, and DRI replacement.
   - Commands: `submitDeliverable` & `reviewDeliverable` complete workflow with SoD enforcement.
   - Commands: `deleteTask` recursive cascade deletion and document unlinking.
   - Queries: `queryTasks` filtering by department, academic month, and pagination.
   - Queries: `queryTasks` with `scope: 'my'` and `assignedTo: 'me'`.
   - Queries: `getTaskById` with relational graph.
   - Queries: `getTaskMetrics` unified aggregation with canonical reference date.

2. **`tests/tasks-api-route.test.ts`** (9 tests, 0 failures):
   - Validates required fields, continuous code generation, authentication, and query filters.

3. **`tests/task-details-api.test.ts`** (12 tests, 0 failures):
   - Validates detail retrieval, deliverable workflow, SoD rejection, and task deletion.

4. **`tests/task-subtask-api-single-dri.test.ts`** (7 tests, 0 failures):
   - Validates single DRI, subtask hierarchy, self-parenting prevention, and relation integrity.

5. **`tests/tasks-api-performance.test.ts`** (7 tests, 0 failures):
   - Validates pagination defaults, metadata backward compatibility, and cascade deletion.

---

## 5. Architectural Invariant Compliance

- **One Capability, One Canonical Implementation**: All task mutations and queries now originate exclusively from `TaskCommandService` and `TaskQueryService`.
- **Role Is Not Scope**: Explicit distinction between authorization authority and dataset filtering enforced across all methods.
- **Server Truth Wins**: All validations, state machine transitions, and permissions are enforced on the server.
- **Light-Only Standard**: Zero `dark:` CSS classes introduced.
- **Anti-Slop & Zero-Emoji Standard**: Zero emojis in all code and comments; clean type-safe interfaces.
