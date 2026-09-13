# T01 — Contract map

Every row below was verified by reading the file at HEAD `65f99561`. Rows whose symbol could not be
located are marked **UNRESOLVED** rather than guessed. This map was produced before any edit in this
workstream.

## Review / approval

| Question | Answer | Evidence |
|---|---|---|
| Statuses meaning "waiting for review" | `TaskStatus.WAITING_APPROVAL`; `TaskStatus.PENDING_EXECUTIVE_APPROVAL`; a subtask (`Task` row) with status `NEEDS_REVIEW` or `requiresReview === true` | `prisma/schema.prisma` TaskStatus enum; `src/lib/executive-matrix-aggregator.ts:609-618` |
| Real review steps | Two-level DACUM: `LEVEL_1_DEPARTMENT_HEAD` (1), `LEVEL_2_EXECUTIVE_BOARD` (2) | `src/lib/dacum-workflow-engine.ts:34-40,111-137`; `src/lib/services/task-actor-service.ts:562-727` (`executeApprovalStep`) |
| Capability source (server) | `evaluateCapabilityMatrix` inside `authorize()` — ReBAC over role + unit leadership + relationships | `src/lib/auth/hybrid-authorization.ts` (`evaluateCapabilityMatrix`, `relationships.has("APPROVER")`) |
| Capability source (client) | `deriveTaskDetailCapabilities(task, actor, delegations)` — pure projection of the same canonical matrix | `src/components/dashboard/task-detail-side-sheet.tsx:386-460` |
| Approval endpoint (canonical) | `POST /api/tasks/[id]/actions/approve` → `TaskDomainActionService.approve` | `src/app/api/tasks/[id]/actions/approve/route.ts:16-56` |
| Approval endpoint (legacy) | `POST /api/tasks/[id]/approve` → `approveTaskAtomic` | `src/app/api/tasks/[id]/approve/route.ts:22-127`; `src/lib/db/transactions.ts:514` |
| Error contract | `OCCConflictError` → **409**; `SeparationOfDutiesError` → **403**; `HybridAuthorizationError` → **403**; `StepProgressionError` → **400** | `src/app/api/tasks/[id]/actions/approve/route.ts` catch block |

### Divergence found (drives T04's label decision)

The codebase does **not** implement one consistent notion of "the actor may approve *this* task":

- `src/lib/services/task-actor-service.ts:611-624` honours the **designated step reviewer** (`step.reviewerUserId`), with an executive override.
- `src/lib/task-ownership.ts:120` (`canApproveTask`) honours `task.actors.APPROVER`.
- `src/app/api/tasks/[id]/approve/route.ts:47-52` accepts `isAssignedApprover` **OR** `isExecutive`/`isUnitHead`.
- **But** `src/lib/auth/hybrid-authorization.ts` `evaluateCapabilityMatrix` restricts `task.approve` to Rector / Vice-Rector / Unit Leader and never consults the `APPROVER` relationship for the approve capability, and `src/domain/tasks/canonical-semantics.ts:204` (`canApprove`) likewise checks only Rector/ViceRector/UnitLeader.

**Decision taken (per plan T01 "Quyết định bắt buộc"):** the client must not invent its own notion.
The command queue derives its *label* from the canonical client projection
(`deriveTaskDetailCapabilities`, which is a pure projection of the server matrix) and prefers the
wording **"Hồ sơ chờ xem xét"** over **"Chờ bạn duyệt"**, because the payload carried to the
dashboard does not prove that the current actor is the designated approver for a given row.
No server authorization was changed, and no new permission was granted.

## Scope

| Question | Answer | Evidence |
|---|---|---|
| Scope vocabulary (dashboard) | `TaskScope = "SCHOOL_TASKS" \| "UNIT_TASKS" \| "MY_TASKS"`; workspace vocabulary `"school" \| "unit" \| "my"`; converters in `unified-task-hub.ts:20-45` | `src/components/dashboard/unified-task-toolbar.tsx:18-20` |
| Scope filter | `filterTasksByScope(tasks, scope, user?, departmentCode?)` | `src/components/dashboard/unified-task-toolbar.tsx:270-309` |
| `MY_TASKS` semantics | lead match **or** any subtask assignee match; the whole parent (with all subtasks) is returned | same, `:276-285` |
| departmentId source | JWT `SessionPayload.departmentId`, re-read from `prisma.user.findUnique` per request into `AuthenticatedUser.departmentId` | `src/server/api/request-context.ts:180-205`; `src/lib/jwt-session.ts:20-27` |
| Client `departmentCode` | `mapDbUserToAuthUser` sets `departmentCode: dbUser.departmentId \|\| 'QCET'` — `AuthUser` has no separate `departmentId` field | `src/lib/auth-context.tsx:51-100`; `src/types/auth.ts:28-44` |
| Server confinement (dashboard) | `GET /api/dashboard/overview` forces `options.departmentId = authUser.departmentId` (or `userId`) for non-admins, then re-filters `data.tasks` in memory | `src/app/api/dashboard/overview/route.ts:40-97` |
| Server confinement (query) | Prisma `whereTask` restricts `scope in [SCHOOL, DEPARTMENT]`, `parentTaskId: null`, `status != CANCELLED`; when `scopedDepartmentId` is set, subtasks are additionally restricted by `departmentId` | `src/lib/server/dashboard-service.ts:37-88` |
| Subtask participation | For a scoped non-admin, cross-department subtasks are **excluded server-side** and never reach the client. The task is still in scope via its parent department. | `src/lib/server/dashboard-service.ts:79-88` |

**UNRESOLVED:** `sub.assignedToDepartmentId` is consulted by the overview route's in-memory filter
(`route.ts:93`) but is never populated on the `StaffTask` DTO by `mapPrismaTaskToStaffTask`
(documented as such at `dashboard-service.ts:85-86`), so that clause is currently dead and the
route relies on `sub.assigneeId` and the parent `departmentId` instead. Left as-is; not in this
workstream's scope to change the DTO.

## Period

| Question | Answer | Evidence |
|---|---|---|
| Year / month helpers | `getAcademicYear`, `getAcademicMonthsForYear`, `getAcademicMonthPeriod`, `getCurrentAcademicPeriod`, `isDateInAcademicMonth`, `ACADEMIC_MONTH_ORDER = [9,10,11,12,1,2,3,4,5,6,7,8]` | `src/lib/academic-calendar.ts:65,210,364,451,385` |
| Strict month filter | `filterTasksByAcademicMonthStrict(tasks, month, year)` — keys on **`dueDate` only**; a task with no due date or a non-`YYYY-MM-DD` due date fails the parent test; non-matching subtasks are pruned from the returned copy | `src/lib/academic-calendar.ts:493-560` (`isDateInAcademicMonth` guard at `:174-177`) |
| Prior-period backlog | `computePriorOverdueBacklog(tasks, month, year, referenceDate?)` returns incomplete tasks whose `dueDate < period.startDate && dueDate < referenceDate`; returns `[]` for `month === "ALL"` | `src/lib/academic-calendar.ts:572-594` |
| Prior backlog consumers | `use-task-filters.ts:453-461` computes it and exposes `priorOverdueBacklog`; rendered by `PriorOverdueBacklogBanner` | `src/components/dashboard/prior-overdue-backlog-banner.tsx` |

## Date

**This is the most fragmented contract in the system.**

| Question | Answer | Evidence |
|---|---|---|
| Canonical parser / validator | `parseDateParts` (ICT-resolved), `isTaskPastDue`, `isTaskOverdue` | `src/lib/academic-calendar.ts:132,84,116` |
| Canonical ICT formatting | `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })` | `src/lib/academic-calendar.ts:71-84` |
| `Task.dueDate` storage type | **`DateTime`** (timestamp, `@map("due_date")`), non-null, no `@db.Date` | `prisma/schema.prisma:217` |
| Subtask storage | **No `Subtask` model.** Subtasks are `Task` rows via `parentTaskId` + `SubTasks` self-relation — so a subtask due date is the *same* `DateTime` column | `prisma/schema.prisma:223-225` |
| Predicate duplication | Two parallel `isTaskPastDue` (`academic-calendar.ts:84`, `unified-task-hub.ts:101`) and two parallel `isTaskOverdue` (`academic-calendar.ts:116`, `tasks/executive-department-aggregator.ts:392`) | see files |
| Reference date (server) | `getSystemReferenceDate(): string` → `NEXT_PUBLIC_REFERENCE_DATE` else hardcoded **`"2026-09-09"`**. Takes **no** `now` parameter. | `src/lib/academic-calendar.ts:70-75` |
| Reference date (client widgets) | a *second, different* `getSystemReferenceDate(): Date` → env else **`"2026-09-06"`** | `src/lib/unified-task-hub.ts:80-85` |
| `TODAY_ISO` | Module-load-time constant `= getSystemReferenceDate()` → `"2026-09-09"` | `src/lib/executive-matrix-aggregator.ts:4` |
| Competing `TODAY_ISO` | `"2026-09-06"` | `src/lib/unified-task-hub.ts:15` |

**Consequence:** four different "today" values coexist — `"2026-09-09"`, `"2026-09-06"`, live
`new Date()`, and UTC-derived `toISOString()` — so the server can mark a row overdue while a
client widget does not. `referenceDate` is **not** carried in `DashboardPayload` and is **not**
passed into `useTaskFilters` from `use-dashboard-state.ts:34-45`; each consumer defaults
separately. This is the root defect behind plan T03.5 and T05.

**UNRESOLVED:** whether the deployment sets `NEXT_PUBLIC_REFERENCE_DATE`, and which of the two
hardcoded defaults is intended. Not determinable from the repository.

## Task detail

| Question | Answer | Evidence |
|---|---|---|
| Open path | `openTaskDetail(task)` → `useModalState.setSelectedTask` + `setIsTaskDetailOpen(true)` → `DashboardModalsHost` → `TaskDetailSideSheet` | `src/components/dashboard/dashboard-context.tsx:173-179`; `src/hooks/use-modal-state.ts:38-39,76-80`; `src/components/dashboard/dashboard-modals-host.tsx:68-80` |
| Signature | **Takes a full `SchoolTask \| StaffTask` object, not an ID.** | `src/components/dashboard/dashboard-context.tsx:98,173` |
| Not-found behaviour | The `qcet:open-task-detail` window listener searches loaded tasks + subtasks and **returns silently** if the id is not found — no message, no fallback fetch | `src/components/dashboard/dashboard-context.tsx:244-274` |
| Deep link | `/tasks?taskId=` is consumed by `UnifiedAdaptiveWorkspace` (`useWorkspaceQuery` → `selectedTaskId`), but **only** by searching the already-loaded task list; `/tasks/page.tsx` reads only `scope` | `src/components/workspace/unified-adaptive-workspace.tsx:557-586`; `src/app/tasks/page.tsx:11-13` |
| Close / focus | Raw `createPortal` to `document.body` (not the `ui/` modal primitives); handles Escape and a close button; restores focus via `returnFocusRef` + `restoreLogicalFocus` | `src/components/dashboard/task-detail-side-sheet.tsx:4,698-719,775-791,978-985,1039-1047` |
| Submit pending state | **None.** `handleManagerApprove` / `handleManagerReject` call `onStatusChange` with no in-flight state | `src/components/dashboard/task-detail-side-sheet.tsx:897-935` |
| 403/409 handling | `useTaskMutations` rolls back optimistic data and sets `errorMessage` on `!res.ok`; network errors enqueue an offline mutation. The **modal's** `selectedTask` is not rolled back. | `src/hooks/use-task-mutations.ts:157-236,345-446`; `src/components/dashboard/dashboard-context.tsx:213-234` |

## Drill-down

Two **independent** query parsers exist for the same URL:

| Parser | Owner | Keys |
|---|---|---|
| `parseWorkspaceQuery` | `src/lib/workspace-query.ts` — used by the `/tasks` page | `scope`, `unit`/`dept`/`unitId`/`departmentId`/`department`, `month`/`academicMonth`/`m`/`period`/`p`, `date`/`d`, `status`/`tab`, `view`/`viewMode`/`v`, `q`/`query`/`search`, `taskId`/`selectedTaskId`/`task_id`, `attention` |
| `parseTaskUrlParams` | `src/hooks/use-task-filters.ts` — used elsewhere | `scope`, `dept`, `status`/`tab`, `workbox`, `month`, `q`, `view`, `taskId`, `viewId`/`view_id`/`savedView` |

Consumed vocabularies:

- `WorkboxFilter` (`executive-stat-strip.tsx:18-24`): `ALL | URGENT_OVERDUE | MY_ACTION | ASSIGNED_BY_ME | COMPLETED | NEEDS_REVIEW`. `filterTasksByWorkbox` falls through and returns tasks unchanged for an unknown value (`unified-task-hub.ts:240-303`).
- `status` (`workspace-query.ts:69-77,273-307`): canonical `NOT_STARTED | IN_PROGRESS | WAITING_APPROVAL | PENDING_EXECUTIVE_APPROVAL | COMPLETED | OVERDUE | CANCELLED` plus legacy aliases; unknown → `ALL`.
- `view` (`workspace-query.ts:60`): `table | kanban | timeline | calendar`; unknown → `table`.
- `attention`: `overdue` is accepted (`workspace-query.ts:344`).

### Dead drill-down links found (these are plan T07.7 / T08.1 defects)

| Link | Where | Why it is dead |
|---|---|---|
| `/tasks?filter=upcoming` | `upcoming-deadlines-widget.tsx:97` (`viewAllHref` default) | `filter` is in **neither** parser's key list — silently ignored |
| `/tasks?scope=school&filter=pending` | `executive-cockpit-workspace.tsx:266` | `scope` is consumed; `filter=pending` is ignored |
| `/tasks?view=audit` | `activity-feed-widget.tsx:100` (`auditLogHref` default) | `audit` is not in `VALID_VIEW_MODES` → falls back to `table`; **no audit route exists anywhere under `src/app`** |
| Works correctly | `department-progress-matrix.tsx:25` (`scope`+`dept`), `personal-workbench.tsx:155` (`taskId`), `:547-550` (`scope`), `executive-cockpit-workspace.tsx:120,144,168,209` (`taskId`), `workbench-mobile-feed.tsx:293-296` (`scope`) | keys are parsed |

## Activity

| Question | Answer | Evidence |
|---|---|---|
| Source | `prisma.notification.findMany({ take: 15, orderBy: { createdAt: 'desc' } })`, mapped to `ActivityEvent` | `src/lib/server/dashboard-service.ts:126-143,364-394` |
| View permission | **Server-side binary admin gate**: non-admins receive `activities: []` | `src/app/api/dashboard/overview/route.ts:40,65-85` |
| Subscription / polling | **None.** The "Live" badge is static JSX; the only refresh is the manual button. | `src/components/dashboard/activity-feed-widget.tsx:144-148`; `src/hooks/use-task-mutations.ts:100,135` |
| Timestamp formatting | **None** — the raw string is printed, and the server sends `createdAt.toISOString()` | `src/components/dashboard/activity-feed-widget.tsx:203`; `dashboard-service.ts:390` |
| Category | `Notification.category` is a plain `String @default('task')`, not an enum; unknown values fall back to `KHAC` server-side | `prisma/schema.prisma:742`; `dashboard-service.ts:16-24,383` |
| Limit | DB `take: 15`; callers pre-slice to 5, which makes the widget's own expand toggle unreachable | `dashboard-zone.tsx:123`; `personal-workbench.tsx:806`; `activity-feed-widget.tsx:103,213-234` |

## Test

| Question | Answer | Evidence |
|---|---|---|
| Does the runner discover dashboard tests? | Yes — recursive `tests/**/*.test.ts` | `scripts/run-tests.mjs:15-30` |
| Real render vs source grep | Mixed. 57 files use `renderToStaticMarkup`; many "UI" suites grep source text | see `baseline.md` §Harness |
| Tests locking old CSS/copy | `tests/executive-action-center-ui.test.ts` requires `max-h-[460px] overflow-y-auto pr-1` (:127), `INITIAL_LIMIT` (:123), `"Xem thêm"`/`"Thu gọn danh sách"` (:131), `"Verified Clear"` (:54), `"Hàng đợi điều hành thông suốt"` (:46), `"min-h-[44px] sm:min-h-[36px]"` (:142) | file |
| **Contradiction** | `tests/dashboard-composition-invariants.test.ts:33-34` **forbids** `"Verified Clear"` and `"Hàng đợi điều hành thông suốt"`; `tests/executive-action-center-ui.test.ts:46,54` and `tests/dashboard-data-consistency-full-regression.test.ts:155` **require** them. Both pass today only because the invariant test greps `dashboard-zone.tsx`, which does not contain those strings — the rule is enforced nowhere it matters. | files |
| Test-only fakes | `tests/dashboard-composition-invariants.test.ts:55` `getDepartmentDashboardSummary` (the top-5 helper; never calls production); `tests/dashboard-empty-state.test.ts` (imports **no** production code — whole DASH-05/06 contract is a local fake); `tests/dashboard-scope-invariants.test.ts:36` `resolveCanonicalDashboardScope` (no production import) | files |

## Decision log

| # | Decision | Rationale |
|---|---|---|
| D1 | Do not add a new `UserRole` value, viewpoint facade, or role-string branch | `.claude/rules/05-domain-freeze.md` §1, §2 — and the plan's own "Không suy quyền từ role label" |
| D2 | Queue labels use the canonical capability projection; wording is "Hồ sơ chờ xem xét", never "Chờ bạn duyệt" | The dashboard payload does not prove the actor is the designated approver (see §Review divergence) |
| D3 | `TaskScope` stays a display/aggregation filter only; never used to grant or deny a write | `.claude/rules/05-domain-freeze.md` §3 |
| D4 | Do not change the hardcoded reference-date *value*; instead make one source flow to all consumers | The intended value is UNRESOLVED (env not visible), and changing it silently would move every overdue boundary |
| D5 | Extend the canonical capture harness with two env-gated options rather than forking a second one | `.claude/rules/00-core.md` §1 "One Capability, One Implementation" |
| D6 | Dead drill-down links are removed or repointed to a target that the real parser consumes; no new query param is invented without shipping its parser | Plan T08.2 |
