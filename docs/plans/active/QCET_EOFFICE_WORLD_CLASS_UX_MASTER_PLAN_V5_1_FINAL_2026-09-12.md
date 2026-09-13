# QCET E-OFFICE — WORLD-CLASS UX CONSOLIDATION & AGENT EXECUTION MASTER PLAN V5.1 FINAL

**Date:** 2026-09-12  
**Workspace:** `qcet work` via `c2c- qcet eoffical`  
**Audited branch:** `main`  
**Audited HEAD:** `7363c430`  
**Status:** FINAL — Source-audited + web-researched + rollout-hardened execution plan

## Goal

Consolidate QCET E-Office into a coherent, fast, role-aware, production-grade workspace without rewriting the platform.

This V5 keeps the source-backed correctness work from V4 and adds the missing world-class layers:

- attention hierarchy;
- filter/view/display/search contracts;
- contextual actions;
- bulk lifecycle safety;
- global command/search;
- notifications;
- documents;
- organization/directory;
- offline/PWA truthfulness;
- cross-app state taxonomy;
- performance gates;
- production UX telemetry;
- cross-page journey evaluation.

**Do not clone Linear visually.** Use its principles to make QCET calmer, denser, clearer and more predictable.

# 1. WORLD-CLASS UX DOCTRINE

## D1 — Primary work dominates

Each page has one dominant work surface. Navigation, orientation and secondary controls recede.

Fail if the first viewport is dominated by:
- stacked toolbars;
- metric cards unrelated to the immediate task;
- oversized banners;
- decorative cards;
- repeated filters;
- duplicated actions.

## D2 — Attention must be earned

Use strong visual emphasis only for:
- error;
- overdue;
- blocked;
- requires my action;
- waiting for my approval;
- destructive action;
- offline/conflict.

Scope is not status. Do not color `school/unit/my` as alert/success semantics.

## D3 — Structure should be felt, not seen

Prefer:
- spacing;
- alignment;
- typography;
- restrained surfaces;
- subtle separators.

Do not wrap every section in `rounded-2xl border bg-card shadow`.

## D4 — Simple first, powerful later

Classify every control:

```text
L1 Always visible
L2 Contextual
L3 Filter / Display / Overflow
L4 Advanced / Settings
```

Tasks L1:
```text
Scope | Search current tasks | Filter | Display | Giao việc
```

Create L1:
```text
Title | Responsible person | Due date | Description/outcome
```

## D5 — Do not make users maintain the tool

Derive when possible:
- creator;
- current unit;
- allowed scope;
- parent task;
- current period;
- actor authority.

Do not ask the user to choose internal architecture when context already determines it.

## D6 — Filter ≠ View ≠ Display ≠ Search

```text
FILTER = which entities match
VIEW = durable named/preset work context
DISPLAY = layout/group/order/visible fields
CURRENT SEARCH = temporary narrowing of current dataset
GLOBAL SEARCH = cross-entity lookup
COMMAND = invoke action/navigation
```

## D7 — Contextual actions over permanent actions

Rows/cards show only the most relevant action. Other actions belong in `…`, context menu, command palette or detail.

All entry points consume the same capability/command logic.

## D8 — Keyboard accelerates; it does not replace mouse/touch

Critical actions must remain accessible without shortcuts.

## D9 — Preserve context

Opening/closing detail must preserve where appropriate:
- route;
- scope;
- filters;
- view;
- search;
- scroll;
- selection;
- focus;
- period.

## D10 — Dense is good; clutter is bad

Do not cure clutter with giant cards and whitespace. Fix hierarchy first.

## D11 — Frequent create flows must be cheap

The ordinary task flow asks only for data required to create a valid task. Institutional metadata is progressively disclosed.

## D12 — One mission per surface

```text
/              Attention + decisions
/tasks         Operational task inventory
/calendar      Temporal coordination
/notifications Updates/events/inbox
/documents     Official document registry/process
/org           Directory/organization reference
```

## D13 — Server truth wins

Authorization/lifecycle is server-driven. High-risk success is not declared before confirmation unless the user is explicitly told it is queued offline.

## D14 — Performance is UX

Measure filter, search, detail open, modal open, calendar navigation and bulk interactions—not only initial page load.

## D15 — System language must be bounded

Avoid universal claims such as “Verified Clear” when only one queue/filter was checked.

# 2. RESEARCH BASIS

## Linear Method
Use:
- Aim for clarity
- Say no to busy work
- Simple first, then powerful

https://linear.app/method/introduction

## Linear 2026 interface refresh
Use:
- primary work should win attention;
- navigation/supporting chrome should recede;
- rich density can coexist with calm UI;
- structure can remain clear with fewer separators;
- incremental integration and side-by-side evaluation.

https://linear.app/now/behind-the-latest-design-refresh

## Linear 2024 redesign
Use:
- reduce visual noise;
- strengthen hierarchy and density;
- stress-test environment, appearance and hierarchy;
- test complete screens and flows.

https://linear.app/now/how-we-redesigned-the-linear-ui

## Linear interaction references
Filters:
https://linear.app/docs/filters

Display options:
https://linear.app/docs/display-options

Custom views:
https://linear.app/docs/custom-views

Search:
https://linear.app/docs/search

Create + drafts:
https://linear.app/docs/creating-issues

Selection/bulk:
https://linear.app/docs/select-issues

My Issues:
https://linear.app/docs/my-issues

Inbox:
https://linear.app/docs/inbox

Triage:
https://linear.app/docs/triage

## Approval reference
https://help.asana.com/s/article/giving-feedback-and-approvals

## Accessibility references
https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
https://www.w3.org/WAI/ARIA/apg/patterns/grid/

## Validation
https://design-system.service.gov.uk/components/error-summary/

## Performance
https://web.dev/articles/defining-core-web-vitals-thresholds
https://web.dev/articles/optimize-inp

# 3. SOURCE BASELINE

Audited with `c2c- qcet eoffical`.

```text
workspace  qcet work
branch     main
HEAD       7363c430
framework  Next.js / React / TypeScript
```

Unrelated dirty files observed:

```text
M .claude/settings.json
M tests/executor/agent-config.test.ts
M tests/executor/hook-portable.test.ts
?? .claude/settings.local.json
```

Agents must preserve them.

## Active paths

### Workbench
```text
src/app/page.tsx
→ UnifiedTaskHubClient
→ DashboardZone
```

### Tasks
```text
src/app/tasks/page.tsx
→ TasksPageClient
→ TaskManagementWorkspace
→ UnifiedAdaptiveWorkspace
→ UnifiedTaskToolbar
→ ModularCascadingTaskTable / TaskKanbanBoard
→ TaskDetailSideSheet
→ CreateTaskModal
```

### Calendar
```text
src/app/calendar/page.tsx
→ calendar components
→ TaskDetailSideSheet
→ CreateTaskModal
→ meeting/event flow
```

### Notifications
```text
src/app/notifications/page.tsx
→ notification-triage helpers
→ MobileNotificationInbox
```

### Documents
```text
src/app/documents/page.tsx
→ DocumentRegistryView
```

### Organization
```text
src/app/org/page.tsx
→ OrganizationTree
```

### Global command/search
```text
AppShell
→ CommandSearchModal
```

### Offline/PWA
Existing source already includes:
```text
ONLINE / DEGRADED / OFFLINE
outbox
flush
pending
failed
conflict
conflict dialog
```

# 4. CONFIRMED HIGH-RISK FINDINGS

## P0-01 Create Task contract mismatch

Create UI includes fields such as:

```text
level
category
leadAssigneeName
coAssignees
internalDueDate
requiredDeliverables
vtvlRole
requiresReview
```

Canonical strict task API expects fields such as:

```text
departmentId
assigneeId
collaboratorIds
scope
priority
parentTaskId
```

`UnifiedAdaptiveWorkspace` currently sends raw form data to `POST /api/tasks`.

## P0-02 Calendar uses a parallel create mapping

Calendar must not persist a different assignee/context from the selected form state.

## P0-03 Progress 100 can be treated as completed

Canonical completion must be lifecycle completion, not percent.

## P0-04 Waiting approval ≠ waiting for current user

Attention needs actor-specific capability.

## P0-05 Task load failure can become empty task data

Error is not empty.

## P0-06 Staff personal create is contradictory

UI intent and submit-level rules need one product policy.

## P0-07 Bulk lifecycle bypass risk

Current `TaskBulkActionBar` exposes:
- Complete;
- status → COMPLETED;
- WAITING_APPROVAL;
- NEEDS_REVIEW;
- CANCELLED;
- reassign;
- delete.

Bulk availability must be capability-safe for the entire selection.

## P1-01 Tasks still default Kanban through facade

V5 target: default Table unless URL/saved preference explicitly says otherwise.

## P1-02 Duplicate plus

Workspace passes `"+ Giao việc"` while toolbar already renders `Plus`.

## P1-03 Notifications swallow fetch errors

Current notification page uses best-effort fetch handling and can collapse error into apparent no-data.

## P1-04 Notification empty copy overclaims

Current copy can imply all work/activity is resolved from an empty notification subset.

## P1-05 Documents status hierarchy is ambiguous

Current page places a large “phase 2 / under development” banner before an interactive registry.

## P1-06 Org page is metric-heavy

Directory/tree mission competes with metric cards and controls.

## P1-07 Org refresh is presentation-only

Current refresh behavior uses timeout state rather than proven data reload.

## P1-08 Global CommandSearchModal mixes several intents

Tasks/documents/users/actions/recent searches require explicit semantics.

## P1-09 Offline/PWA exists but is not part of current UX consolidation gates

This must be audited as correctness, not optional polish.

# 5. FROZEN CONTRACTS C1–C16

## C1 Create Command
```text
UI Draft
→ canonical mapper
→ CreateTaskInput
→ API
→ server DTO
→ client reconciliation
```

## C2 Capability
Actions derive from:
```text
lifecycle + actor identity + server policy/capability
```

## C3 Workspace Query
Canonical keys:
```text
scope dept period status attention view q taskId viewId sort group
```

## C4 Counts
Distinguish:
```text
server total
filtered total
visible rows
selected
actionable
context parents
```

## C5 Global Interaction
```text
Command Palette ≠ Global Search ≠ Current View Search ≠ Filter
```

## C6 Offline Mutation
```text
local-only
queued
syncing
server-confirmed
failed
conflict
unknown-after-timeout
```

## C7 Attention Hierarchy
Every page declares:
```text
primary work
primary action
primary context
secondary controls
```

## C8 Interaction Layers
Every control belongs to L1/L2/L3/L4.

## C9 Filter/View/Display
Saved views store durable query intent. Display stores presentation preferences.

## C10 Search
Define:
- scope;
- indexed fields;
- result types;
- request cancellation/staleness;
- keyboard/focus;
- URL behavior.

## C11 Contextual Actions
Same capability result powers row/detail/bulk/context-menu/command entry points.

## C12 Focus Preservation
Detail/modal/deep-link flows restore logical focus and context.

## C13 Density Budget
Evaluator records:
```text
persistent controls
visual containers
strong-color elements
duplicate action paths
concepts needed before action
```

## C14 Creation Cost
Do not ask system-derived fields.

## C15 Surface Purpose
No page duplicates another page's mission.

## C16 Performance
Target good Core Web Vitals:
```text
LCP <= 2.5s
INP <= 200ms
CLS <= 0.1
```
Measure p75, split mobile/desktop.

# 6. EXECUTION TOPOLOGY

```text
WAVE 0  Baseline + runtime recon
  ↓
G0      Freeze C1–C16 + ownership
  ↓
WAVE 1  P0 correctness
  ↓
G1      Semantic safety gate
  ↓
WAVE 2  Parallel page reconstruction
  ↓
INT     Cross-lane integration
  ↓
G2      Integrated candidate
  ↓
WAVE 3  Independent evaluators
  ↓
WAVE 4  Owner remediation
  ↓
G3      Verify + build + runtime journeys + performance
```

Do not maximize agent count. Maximize independent file ownership.

# 7. FILE OWNERSHIP

## INT
```text
src/components/workspace/unified-adaptive-workspace.tsx
src/components/tasks/task-management-workspace.tsx
integration tests
```

## F1 Semantics
```text
src/domain/tasks/attention-resolver.ts
src/domain/tasks/canonical-semantics.ts
semantic tests
```

## F2 Query/scope/loading
```text
src/lib/workspace-query.ts
src/hooks/use-workspace-query.ts
src/app/tasks/page.tsx
src/app/tasks/tasks-page-client.tsx
```

## F3 Create command
Own canonical create mapper + contract tests.
Touch API/schema only with proof.

## P1 Tasks presentation
```text
src/components/dashboard/unified-task-toolbar.tsx
src/components/tasks/table/**
src/components/tasks/task-kanban-board.tsx
src/components/tasks/saved-views-selector.tsx
```

## P2 Detail
```text
src/components/dashboard/task-detail-side-sheet.tsx
```

## P3 Create form
```text
src/components/dashboard/create-task-modal.tsx
optional extracted create subcomponents
```

## P4 Calendar
```text
src/app/calendar/page.tsx
src/components/calendar/**
```

## P5 Workbench
Active dashboard composition files only.

## P6 Navigation/global interaction
```text
src/lib/navigation/**
src/components/layout/app-sidebar.tsx
src/components/navigation/mobile-bottom-nav.tsx
src/components/layout/mobile-menu-drawer.tsx
src/components/layout/command-search-modal.tsx
```

## P7 Notifications
```text
src/app/notifications/page.tsx
src/components/notifications/**
src/lib/notification-triage.ts
```

## P8 Documents
```text
src/app/documents/page.tsx
src/components/documents/**
```

## P9 Org
```text
src/app/org/page.tsx
src/components/org/**
```

## P10 Offline/PWA
```text
src/components/pwa/**
src/lib/pwa/**
```

Shared/root/config files remain Integrator-only unless explicitly reassigned.

# 8. WAVE 0 — BASELINE

Before mutation:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log -5 --oneline
node --version
npm --version
```

Read:
```text
AGENTS.md
ARCHITECTURE.md
docs/product/invariants.md
docs/product/metrics.md
docs/product/roles-and-scopes.md
src/components/tasks/AGENTS.md
src/app/api/AGENTS.md
tests/AGENTS.md
```

Capture same-data screenshots:
```text
1440×900
390×844
```

States:
```text
/
 /tasks
 /tasks?view=table
 /tasks?view=kanban
 /calendar
 /notifications
 /documents
 /org
 task detail
 create task
 create event
 command/search modal
 bulk selection
 offline/PWA state if safely reproducible
```

Before full `npm test`, prove DATABASE_URL is a disposable test database.

# 9. P0 TICKETS

## T01 Error vs Empty
Owner F2.

Remove catch-all task data fallback to `[]`.

Acceptance:
- failed read → error/retry;
- valid [] → empty;
- loading → neutral;
- auth change → no stale previous user data.

## T02 Scope and URL precedence
Owner F2.

```text
explicit authorized URL
→ saved preference if owned by product
→ authorized role default
```

No early parser default that forces `school`.

## T03 Completed semantics
Owner F1.

```text
WAITING_APPROVAL + progress=100 != completed
COMPLETED = completed
```

## T04 Actor-specific approval attention
Owner F1.

`WAITING_APPROVAL` alone is insufficient. Resolve whether the current user can review.

## T05 Canonical task create adapter
Owner F3.

```text
CreateTaskDraft
→ map to canonical CreateTaskInput
→ POST
→ reconcile returned task
```

Use stable IDs.

## T06 Staff personal create policy
Owner P3/F3.

Resolve from product + server policy. Do not choose the easiest UI workaround.

## T07 Remove lifecycle bypass
Owner P2/INT.

Generic status UI may not bypass submit/review/approval.

## T08 Bulk capability safety
Owner P1/F1.

For selected tasks:
```text
safe bulk action = action valid for every selected task
```

Hard failures:
- bulk complete bypasses review;
- bulk cancel bypasses authority;
- bulk reassign crosses unit/role policy;
- bulk delete skips confirmation/reconciliation.

# 10. TASKS WORKSPACE

## T09 Table default
No explicit representation → Table.
Explicit `?view=kanban` must survive reload/back.

## T10 Reduce toolbar
Desktop north star:
```text
[Scope] [Search........................] [Filter] [Display] [Giao việc]
```

Move to secondary surfaces:
- density;
- sort;
- grouping;
- advanced filters;
- period/month;
- saved-view administration.

## T11 Explain active query
User can answer:
```text
Why are these tasks here?
```

Show non-default filters/view + result count.

## T12 Table hierarchy
Priority:
```text
Task | Owner | Unit | Due | Status | Progress | Actions
```

## T13 Quiet Kanban
Remove permanent:
- status select;
- workflow prev/next;
- “Đầy đủ 100% công việc”.

## T14 Selection model
Selection is temporary:
- Escape clears;
- incompatible scope/filter clears/reconciles;
- keyboard/mouse semantics match.

## T15 Saved Views vs Display
Saved View = durable query.
Display = representation.
Current search = transient.

# 11. TASK DETAIL

## T16 Decision-first order
```text
Title
status/deadline
owner/unit
requirement
submitted result/evidence
context action
child tasks
timeline
```

## T17 Consolidate child CTAs
Choose one primary:
```text
Thêm nhiệm vụ con
```

## T18 Truthful history
Real audit events → `Lịch sử`.
Derived facts → `Mốc thông tin`.

## T19 History/focus
Open from list → push taskId.
Switch detail → replace taskId.
Close → same list state + logical focus.

## T20 Capability-driven review
Reviewer sees allowed review actions.
Submitter does not see approve.
Completed does not show review CTA.

# 12. CREATE TASK

## T21 Intent-first
User answers:
```text
Việc gì?
Ai làm?
Hạn khi nào?
Kết quả mong đợi?
```

## T22 Primary fields
```text
Tên nhiệm vụ *
Người phụ trách *
Hạn *
Ưu tiên (if canonical)
Mô tả/kết quả mong đợi
```

## T23 Progressive disclosure
Optional:
- collaborators;
- internal due date;
- parent;
- category;
- VTVL;
- deliverables;
- review settings.

## T24 Identity by ID
Persist assignee ID, not name.

## T25 Derive hierarchy
Create from parent/unit context pre-fills parent/scope/unit.

## T26 Preserve draft on error
Do not clear the form after rejected mutation.

## T27 Unknown result after timeout
A sent request with lost response is not proven failure.
Reconcile/idempotency before unsafe retry.

# 13. CALENDAR

## T28 Use canonical task-create command
Delete local divergent mapping once F3 is ready.

## T29 Make Month/Agenda discoverable
Primary representation switch should not be buried.

## T30 Atomic URL state
Define push/replace rules for:
- month/date;
- view;
- search;
- scope;
- taskId.

## T31 Month density
Limited previews + overflow count.
Full detail moves to day/agenda.

## T32 Mobile
Prefer Agenda when month grid becomes unreadable.

## T33 Event correctness
Validate:
- start/end;
- timezone;
- host/unit;
- form preservation;
- keyboard/safe-area.

# 14. WORKBENCH

## T34 Preserve Action → Situation → Context
Do not rebuild active dashboard from scratch.

## T35 Remove false certainty
Replace universal health claims with bounded queue/filter wording.

## T36 Metric label = formula
Do not fallback between progress/completion while keeping one label.

## T37 Drill-down symmetry
Metric opens `/tasks` with equivalent scope/dept/period/status/attention.

# 15. GLOBAL SEARCH / COMMAND

## T38 Inventory CommandSearchModal
Classify every item:
```text
navigation
command
task result
document result
user result
recent
```

## T39 Visually separate intents
If one modal remains:
```text
Đi tới
Nhiệm vụ
Văn bản
Cán bộ
Hành động
```

## T40 Current-view search stays local
`/tasks` search must not become global search.

## T41 Account-safe recents
Local recents must not leak prior-user entities.

## T42 Keyboard/focus
Support:
- Up/Down;
- Enter;
- Escape;
- focus containment;
- IME-safe commands.

# 16. NOTIFICATIONS

## T43 Mission
Notification = update/event/incoming attention.
Not a second Task inventory.

## T44 Error vs Empty
Current best-effort fetch must distinguish:
```text
loading
data
empty
error
```

## T45 Bounded empty copy
Avoid claims like “all work has been handled” from an empty notification subset.

## T46 Read-state reconciliation
Optimistic mark-read must rollback/reconcile on failure.

## T47 Mobile/desktop parity
Same triage/read/deep-link semantics.

## T48 Canonical deep links
Task notification → task detail.
Document notification → document detail.
No duplicate entity page.

# 17. DOCUMENTS

## T49 Decide product state
Current page looks both “under development” and interactive.
Choose:
```text
preview
or
operational module
```

## T50 Registry first
If operational, registry/search/filter appear before roadmap messaging.

## T51 Search/filter/display separation
Apply C9/C10.

## T52 Preserve registry context
Open detail without losing search/filter/scroll.

## T53 Document → Task uses canonical create command
No second task payload.

## T54 Capability-driven actions
Edit/route/sign/assign actions follow server capability.

## T55 State taxonomy
Differentiate:
- empty;
- no matches;
- load failure;
- permission denied;
- missing preview/file;
- workflow conflict.

# 18. ORGANIZATION / DIRECTORY

## T56 Directory is primary
Primary mission:
```text
find person/unit and understand organizational relationship
```

## T57 Audit `QCET_DEPARTMENTS`
Determine whether current UI data duplicates a canonical API/service.

## T58 Search-first
Find:
- person;
- unit;
- role;
- contact.

## T59 Preserve tree state
Expand/search/back/mobile drill-down preserve logical context.

## T60 Secondary actions
Print/export belong secondary unless usage proves otherwise.
A fake timeout refresh must not pretend server reload.

## T61 Prove metrics
Static claims such as `100%` require canonical data or removal.

# 19. OFFLINE / PWA

## T62 Truthful states
Use:
```text
Đã lưu trên thiết bị
Đang chờ đồng bộ
Đang đồng bộ
Đã đồng bộ
Không thể đồng bộ
Xung đột cần xử lý
```

## T63 Account isolation
Outbox is partitioned/cleared safely across account switch.

## T64 Conflict resolution
Explain local vs server change.
Do not default to destructive overwrite.

## T65 Reconnect race
Only one logical flush; no duplicate mutations.

## T66 Unknown mutation result
Network loss after send requires reconciliation.

## T67 Placement
Status visible only when relevant; verify no collision with bottom nav/safe area.

## T68 PWA onboarding cleanup
Audit duplicate install/push/onboarding prompts.

# 20. CROSS-APP STATE TAXONOMY

Every major surface supports distinct:

```text
Loading
Content
Empty
No results
Permission denied
Validation error
Service error
Offline
Conflict
Success
```

## T69 Copy rules
Empty:
```text
Chưa có nhiệm vụ trong phạm vi này.
```

No results:
```text
Không có nhiệm vụ phù hợp bộ lọc.
[Xóa bộ lọc]
```

Error:
```text
Không thể tải nhiệm vụ.
[Thử lại]
```

## T70 Validation
Complex forms:
- summary;
- field messages;
- links/focus;
- preserve input.

## T71 Permission
Do not present permission denied as empty.

## T72 Retry
Read retry is safe.
Mutation retry follows reconciliation/idempotency rules.

## T73 Success
Only server-confirmed or explicitly queued-offline success.

# 21. PERFORMANCE

## T74 Baseline
Measure:
```text
/
 /tasks table
 /tasks kanban
 task detail open
 /calendar
 /notifications
 /documents
 /org
 command search
```

## T75 Realistic data
Test meaningful sizes:
```text
100 / 500 / 1000+ tasks where feasible
large org
large notification list
large document registry
```

## T76 Interaction profiling
Measure:
- filter;
- search;
- detail open;
- bulk selection;
- calendar navigation;
- command results.

## T77 Fix at owner
Performance findings return to the lane that owns the bottleneck.

## T78 Avoid unnecessary waterfalls
Do not block the main surface on secondary widgets.

## T79 No decorative performance debt
No new heavy animation/design dependencies.

## T80 Gate
Target good CWV and no meaningful regression from baseline.
If target cannot be reached, document delta + bottleneck.

# 22. UX TELEMETRY

Use existing telemetry where possible.

Aggregate health signals only.

## T81 Task create
```text
attempt
success
failure
reconcile
```

## T82 Interaction latency
```text
detail_open
filter_apply
global_search
```

## T83 Offline
```text
queue_count
sync_failure
conflict
```

## T84 Errors/retry
```text
route error class
retry outcome
```

## T85 Web Vitals
Split mobile/desktop/route class.

Do not log sensitive task/document contents or personal search content unless explicitly privacy-reviewed.

# 23. NAVIGATION / PORTAL

## T86 Mobile nav consumes canonical registry
No second hard-coded route owner.

## T87 Active route parity
Test nested task/calendar/document routes and aliases.

## T88 Labels
Sidebar/mobile/command/breadcrumb/page header use one semantic naming system.

## T89 Portal inventory
Search all `/portal` dependencies before mutation.

## T90 Portal deprecation
If no unique responsibility remains:
```text
/portal → /
```
with compatibility redirect.
Delete old code only after no consumer remains.

# 24. UNRESOLVED MANAGER SCHOOL SCOPE

Do not guess.

Trace:
```text
server read authorization
/api/tasks scope behavior
dashboard service scoping
roles/scopes docs
```

Write:
```text
docs/agent-work/decisions/manager-school-scope.md
```

Other work may proceed.

# 25. TEST STRATEGY

Reuse existing targeted tests first.

High-value new regressions:

```text
task-create-ui-api-contract.test.ts
task-loading-error-vs-empty.test.ts
workspace-role-default-scope.test.ts
task-completed-status-only.test.ts
task-attention-authority.test.ts
task-detail-action-capability.test.ts
task-bulk-capability.test.ts
task-bulk-review-bypass.test.ts
calendar-create-task-contract-parity.test.ts
command-search-semantics.test.ts
notifications-error-vs-empty.test.ts
notification-read-reconciliation.test.ts
documents-state-taxonomy.test.ts
org-data-source.test.ts
offline-user-isolation.test.ts
offline-reconnect-idempotency.test.ts
navigation-consumer-single-source.test.ts
```

Do not replace requirement tests with brittle source-string locks.

Do not weaken security tests to get green.

# 26. ACCESSIBILITY GATE

## Modal
True modal:
- focus enters;
- Tab/Shift+Tab remain;
- Escape closes;
- visible close;
- background inert;
- logical focus return.

## Table
Prefer semantic table.
Do not use `role=grid` unless full composite focus behavior is intentionally implemented.

## Forms
- visible label;
- required semantics;
- field error;
- complex-form summary;
- no color-only meaning;
- 200% zoom;
- Vietnamese text expansion.

## Drag
Every drag action has non-drag alternative.

## Touch
QCET internal target ~44px where practical.

# 27. CROSS-PAGE JOURNEYS

## J1 Executive review
```text
Workbench alert
→ Tasks drill-down
→ detail
→ evidence
→ approve/request changes
→ same filtered list
→ counts reconcile
```

## J2 Manager assignment
```text
Unit scope
→ create
→ assignee
→ due
→ submit
→ task appears if matching filter
```

## J3 Staff submit
```text
My tasks
→ assigned task
→ submit result
→ waiting review
→ no completion bypass
```

## J4 Calendar create
```text
date
→ create task
→ selected assignee preserved
→ canonical task visible
```

## J5 Notification
```text
notification
→ canonical entity
→ mark read
→ back
→ inbox context preserved
```

## J6 Offline
```text
offline
→ supported mutation
→ queued
→ reconnect
→ sync
→ confirmed
```

## J7 Global interaction
```text
command/search
→ entity
→ detail
→ close
→ previous context preserved
```

# 28. INDEPENDENT EVALUATORS

Builders cannot approve themselves.

## Q1 Semantic/Security
Fail:
- wrong assignee;
- unauthorized approval;
- bulk bypass;
- scope leak;
- progress-as-completion;
- fake audit event.

## Q2 Linear-style hierarchy
Per page record:
```text
persistent control count
container count
strong-color element count
duplicate action paths
concepts required before primary action
```

## Q3 Accessibility/Mobile
Keyboard, focus, zoom, touch, semantic parity.

## Q4 State/History/Race
URL, Back/Forward, stale request, account switch, offline transitions.

## Q5 Performance
Baseline vs candidate.

## Q6 Cross-page consistency
Terminology, scope, filters, create, errors, navigation, density.

# 29. VISUAL ACCEPTANCE

## Tasks
- real work visible in first viewport;
- <= two persistent control layers;
- Table default;
- normal rows quiet;
- exception states clear.

## Kanban
- no permanent workflow controls on every card;
- fewer visual decorations;
- contextual actions.

## Detail
- evidence before decision;
- one child CTA;
- truthful history.

## Create
- title/owner/due obvious;
- advanced governance secondary;
- assignee identity preserved.

## Calendar
- Month/Agenda discoverable;
- date content precedes chrome.

## Notifications
- notification list is primary, not metric chrome.

## Documents
- registry primary when operational.

## Org
- directory/tree primary, metrics secondary or removed.

# 30. MERGE ORDER

```text
1  F1 semantics
2  F2 query/scope/loading
3  F3 create adapter
4  invariant tests
5  P1 Tasks
6  P2 Detail
7  P3 Create
8  P4 Calendar
9  P5 Workbench
10 P6 Global interaction/navigation
11 P7 Notifications
12 P8 Documents
13 P9 Org
14 P10 Offline/PWA
15 INT UnifiedAdaptiveWorkspace wiring
16 owner-specific performance fixes
```

After each merge, run lane-targeted tests.

# 31. HANDOFF TEMPLATE

```markdown
# <LANE> Handoff

## Base
Branch:
Base SHA:
Final SHA:

## Owned files

## Changed files

## Reproduced issue

## Implementation

## Frozen contracts consumed

## Tests actually run
command:
exit:
summary:

## Runtime evidence

## Screenshots

## Performance evidence

## Known limitations

## Cross-owner request

## git status
```

No “done” without evidence.

# 32. ORCHESTRATOR PROMPT

```text
You are the QCET E-Office UX V5 orchestrator.

Do not edit code first.

1. Read repository architecture, product invariants, role/scope docs and test instructions.
2. Record branch, SHA, dirty files and runtime identity.
3. Re-audit V5 source findings against the live checkout.
4. Capture same-data baseline screenshots.
5. Freeze C1–C16.
6. Assign exclusive file ownership.
7. Reserve UnifiedAdaptiveWorkspace for the Integration owner.

Run P0 correctness before visual polish:
- task load error semantics;
- scope/query;
- lifecycle completion;
- actor-specific attention;
- create contract;
- Staff create policy;
- lifecycle bypass;
- bulk capability.

Then run independent page lanes.

UX doctrine:
- primary work dominates;
- attention is earned;
- structure is subtle;
- simple first, powerful later;
- filter/view/display/search are separate;
- contextual actions over permanent controls;
- preserve context;
- dense not cluttered;
- status language is truthful;
- performance is UX.

Do not:
- rewrite the platform;
- introduce V2 parallel engines;
- weaken authorization;
- widen strict APIs to accept legacy UI without domain proof;
- report tests/builds that were not run;
- overwrite unrelated dirty files.

After integration:
- Q1–Q6 independent evaluators;
- owner remediation;
- targeted tests;
- typecheck/lint/diff-check;
- full verify only on safe test DB;
- production build;
- J1–J7 runtime journeys;
- performance comparison;
- before/after evidence.

The task is not done because the build passes.
It is done only when Definition of Done passes.
```

# 33. WORKER PROMPT

```text
You are QCET UX V5 worker <LANE>.

Read C1–C16 and your file ownership before editing.

Tickets:
<TICKETS>

Owned files:
<FILES>

Rules:
- edit only owned files;
- preserve unrelated changes;
- no parallel domain/state engines;
- no permission expansion;
- stable IDs for identity;
- server truth for lifecycle/capability;
- use Linear principles as hierarchy guidance, not visual cloning;
- classify every new persistent control into L1/L2/L3/L4;
- preserve context;
- distinguish Empty / No results / Error / Permission;
- do not claim a test ran unless it actually ran.

Workflow:
1. reproduce;
2. add/reuse requirement-level regression test;
3. make smallest root-cause fix;
4. run targeted tests;
5. inspect diff;
6. capture runtime/visual evidence;
7. commit;
8. write handoff.

If another owner must change a file:
do not edit it.
Write the exact contract/interface request.
```

# 34. DEFINITION OF DONE

## Correctness
- [ ] task read error ≠ empty;
- [ ] explicit URL/scope deterministic;
- [ ] progress 100 ≠ completed unless lifecycle completed;
- [ ] approval queue actor-specific;
- [ ] CreateTask UI maps to strict API;
- [ ] assignee stable ID persists;
- [ ] Staff create policy consistent;
- [ ] no detail lifecycle bypass;
- [ ] no bulk lifecycle bypass;
- [ ] offline wording truthful.

## Tasks
- [ ] Table default;
- [ ] explicit Kanban preserved;
- [ ] toolbar materially reduced;
- [ ] Filter/View/Display/Search separated;
- [ ] rows/cards quieter;
- [ ] active query understandable.

## Detail/Create
- [ ] evidence before review;
- [ ] child CTA consolidated;
- [ ] history truthful;
- [ ] create intent-first;
- [ ] advanced fields progressive;
- [ ] failed create preserves input;
- [ ] timeout duplicate risk handled.

## Calendar
- [ ] same create command;
- [ ] Month/Agenda discoverable;
- [ ] URL/history stable;
- [ ] mobile usable;
- [ ] event validation correct.

## Workbench
- [ ] no false certainty;
- [ ] metric formula/label integrity;
- [ ] drill-down symmetry.

## Global interaction
- [ ] command/search intents explicit;
- [ ] recents account-safe;
- [ ] keyboard/focus safe.

## Notifications
- [ ] error ≠ empty;
- [ ] bounded copy;
- [ ] read reconciliation;
- [ ] canonical deep links;
- [ ] mobile/desktop semantics match.

## Documents
- [ ] product state clear;
- [ ] registry-first when operational;
- [ ] state taxonomy;
- [ ] canonical task linkage.

## Org
- [ ] directory primary;
- [ ] data source audited;
- [ ] fake refresh removed;
- [ ] unproven metrics removed/reworked.

## Offline/PWA
- [ ] queue user isolation;
- [ ] conflict UX safe;
- [ ] reconnect does not duplicate;
- [ ] onboarding not duplicated.

## Accessibility
- [ ] dialogs;
- [ ] keyboard;
- [ ] 200% zoom;
- [ ] touch;
- [ ] non-drag alternative;
- [ ] semantic table by default.

## Performance
- [ ] baseline measured;
- [ ] candidate measured;
- [ ] no major regression;
- [ ] CWV evidence recorded.

## Verification
- [ ] targeted tests;
- [ ] typecheck;
- [ ] lint;
- [ ] git diff --check;
- [ ] verify on safe DB;
- [ ] production build;
- [ ] J1–J7 journeys;
- [ ] Q1–Q6 reports;
- [ ] same-data before/after screenshots;
- [ ] unrelated files preserved.

# 35. RELEASE BLOCKERS

Do not release with any of:

```text
scope leakage
wrong assignee persisted
unauthorized/self approval
bulk lifecycle bypass
progress 100 treated completed
strict create schema rejection
server failure presented as empty
offline queue presented as server-confirmed
fake audit actor/event
cross-account recent/offline data leak
unsafe duplicate mutation
history losing security-sensitive scope
```

# 36. FINAL STANDARD

A user entering any core page must be able to answer quickly:

```text
Where am I?
What is the primary work here?
What needs my action?
Why am I seeing these items?
What can I do now?
Will opening this preserve my context?
Did the system really save/approve/sync the action?
```

QCET V5 should feel:

```text
truthful
fast
dense
calm
predictable
role-aware
context-preserving
accessible
measurable
```

If the user must understand QCET's internal architecture before completing a routine task, the UX is not done.

If the UI is visually clean but lifecycle semantics are wrong, the UX is not done.

If lifecycle is correct but primary work is buried beneath controls, the UX is not done.

---

# 37. V5.1 FINAL — WHY THIS IS THE LAST PLANNING UPGRADE

V5 already defines the correct product architecture and most implementation work.

V5.1 does **not** add another feature wave.

It hardens execution in five areas that determine whether a redesign survives real production:

```text
rollout safety
design-system convergence
content/terminology consistency
legacy migration/removal
pilot + rollback validation
```

After V5.1, stop adding planning layers unless runtime evidence reveals a blocker.

The next source of truth becomes:

```text
candidate code
tests
runtime traces
same-data screenshots
performance evidence
pilot feedback
```

not more benchmark-product research.

---

# 38. C17 — ROLLOUT & FEATURE-FLAG CONTRACT

## 38.1 Principle

Large UX reconstruction must not ship as one irreversible replacement.

Use the existing QCET feature-flag infrastructure where appropriate.

Repository evidence:

```text
src/features/flags.ts
```

already separates operational feature flags from authorization.

Hard rule:

```text
Feature Flag != Permission
```

Authorization remains server-side capability/policy.

## 38.2 Required rollout lifecycle

For major reconstructed surfaces:

```text
IMPLEMENT
→ VERIFY
→ FLAGGED CANDIDATE
→ INTERNAL PILOT
→ LIMITED COHORT/ROLE
→ MEASURE
→ EXPAND
→ REMOVE LEGACY
```

## 38.3 Candidate flags

Exact names must follow the repository convention discovered in `src/features/flags.ts`.

Conceptual examples only:

```text
UX_TASKS_V5
UX_CALENDAR_V5
UX_NOTIFICATIONS_V5
UX_DOCUMENTS_V5
UX_ORG_V5
```

Do not create a flag for every tiny component.

Flags belong at meaningful migration boundaries.

## 38.4 Rollback

A flagged surface must have a documented rollback path until its legacy path is removed.

Rollback must not:
- change database schema backward;
- weaken authorization;
- discard new user data;
- resurrect known P0 semantic defects.

## 38.5 Flag-removal gate

Remove the flag and old path only after:

```text
targeted tests pass
Q1–Q6 pass
pilot passes
performance acceptable
no blocking telemetry regression
legacy consumer inventory = zero
migration ledger says DELETE_READY
```

---

# 39. C18 — DESIGN SYSTEM CONVERGENCE CONTRACT

## 39.1 Why

Parallel page agents can independently produce good-looking pages that still feel like different products.

After page-level implementation, QCET needs one dedicated convergence pass.

Linear’s 2026 refresh explicitly made headers, navigation and view controls consistent across projects, issues, reviews and documents.

QCET must enforce the same kind of cross-surface consistency without visually cloning Linear.

## 39.2 Canonical pattern inventory

Audit existing implementations before creating anything new:

```text
PageHeader
WorkspaceHeader
WorkspaceToolbar
ScopeSwitcher
SearchInput
FilterTrigger
DisplayMenu
PrimaryAction
SecondaryAction
EntityTable
EntityRow
StatusBadge
AttentionBadge
EmptyState
NoResultsState
ErrorState
SideSheet
Modal
ActionMenu
BulkActionBar
Toast/Feedback
```

For each pattern:

```text
existing candidates
active consumers
canonical owner
duplicates
migration path
delete-after criteria
```

## 39.3 Rule: search before create

Every agent must:

```text
search existing component
→ inspect active consumers
→ reuse or extend canonical owner
→ only create new primitive if no suitable owner exists
```

## 39.4 Rule: no page-local design system

Do not create:

```text
TasksFilterButton
CalendarFilterButton
DocumentsFilterButton
NotificationsFilterButton
```

when the difference is only copy/icon.

Use one primitive plus domain-specific configuration.

## 39.5 Primary-action invariant

Within one local area:

```text
usually <= 1 primary visual action
```

Other actions use secondary/default/ghost/contextual treatment.

Example `/tasks`:

```text
Primary:
Giao việc

Secondary/contextual:
Filter
Display
Export
Bulk actions
Refresh
```

---

# 40. C19 — CONTENT & TERMINOLOGY CONTRACT

## 40.1 Purpose

A consistent UI vocabulary is part of the design system.

Create:

```text
docs/ux/QCET_UI_VOCABULARY.md
```

The file must define approved Vietnamese terms for core entities, lifecycle states, attention states and actions.

## 40.2 Terms to freeze

At minimum:

```text
Nhiệm vụ
Giao việc
Tạo việc cá nhân
Nhiệm vụ cha
Nhiệm vụ con

Đang thực hiện
Chờ phê duyệt
Cần chỉnh sửa
Hoàn thành
Đã hủy

Cần tôi xử lý
Chờ tôi duyệt
Quá hạn
Bị chặn

Bộ lọc
Hiển thị
Chế độ xem
Tìm kiếm
Phạm vi

Thông báo
Văn bản
Đơn vị
Cán bộ
```

Final wording must be checked against QCET business terminology before freeze.

## 40.3 Forbidden drift

Do not use multiple labels for the same action unless context truly changes meaning.

Examples requiring consolidation:

```text
Giao việc
Tạo việc
Tạo nhiệm vụ
Phân công

Phân rã
Thêm việc con
Giao nhanh
Phân rã ngay

Chờ duyệt
Chờ phê duyệt
Chờ tôi duyệt
```

## 40.4 Button writing

Buttons describe the action/outcome.

Prefer:

```text
Giao việc
Lưu thay đổi
Yêu cầu chỉnh sửa
Phê duyệt
Thử lại
Xóa bộ lọc
```

Avoid generic labels when a specific outcome exists:

```text
Xác nhận
Tiếp tục
Thực hiện
OK
```

## 40.5 Date/time

Standardize:
- date format;
- time format;
- relative-date rules;
- academic period labels;
- timezone assumptions.

Do not hard-code ad hoc relative-date reference values.

---

# 41. C20 — MIGRATION / DEPRECATION LEDGER

Create:

```text
docs/agent-work/UX_MIGRATION_LEDGER.md
```

Schema:

```markdown
| Artifact | Current consumers | Canonical replacement | Status | Owner | Flag | Delete after | Proof |
```

Allowed statuses:

```text
ACTIVE
MIGRATING
REDIRECTED
DEPRECATED
DELETE_READY
REMOVED
BLOCKED
```

Seed entries:

```text
/unit-tasks
→ /tasks?scope=unit

/dashboard
→ /

/portal
→ audit pending

legacy mobile navigation arrays
→ canonical navigation registry

calendar local task-create mapper
→ canonical create adapter

legacy task create raw payload
→ canonical create adapter

duplicate task action/status paths
→ capability-driven command path
```

Hard rule:

A replacement is not complete merely because the new implementation exists.

Completion requires:

```text
old consumers = 0
compatibility requirement documented
tests cover canonical path
redirect/migration exists where required
delete-ready proof recorded
```

---

# 42. T91 — SIDE-BY-SIDE UX COMPARISON HARNESS

## 42.1 Purpose

Linear’s redesign team used a dev toolbar to toggle refreshed and previous UI states quickly.

QCET does not need to copy that implementation, but must reproduce the evaluation property:

```text
same state
same data
same viewport
old candidate
new candidate
```

## 42.2 Required comparison dimensions

```text
route
user
role
department
scope
query
period
dataset snapshot
viewport
zoom
```

## 42.3 Viewports

Minimum:

```text
1440×900
1280×800
768×1024
390×844
200% zoom
```

## 42.4 Evidence

Store:

```text
artifacts/ux-v5-1/<route>/<state>/
  baseline.png
  candidate.png
  notes.md
```

If a feature flag controls the surface, record flag state.

## 42.5 Reviewer questions

```text
Does primary work appear earlier?
Are permanent controls reduced?
Are the same capabilities still reachable?
Is terminology more consistent?
Is the candidate denser without being noisier?
Are exception states easier to scan?
Did any workflow move behind an obscure interaction?
```

---

# 43. T92 — FEATURE-FLAG ROLLOUT GATES

## 43.1 Rollout order

Recommended:

```text
Tasks core semantics
→ Task presentation/detail/create
→ Calendar
→ Workbench
→ Notifications
→ Documents
→ Org
→ global convergence cleanup
```

Do not rollout secondary modules before their dependencies are stable.

## 43.2 Suggested cohorts

Use whatever cohort mechanism QCET already supports.

Conceptual phases:

```text
Phase A: local/dev only
Phase B: maintainers/internal test users
Phase C: small representative role sample
Phase D: broader school cohort
Phase E: default on
Phase F: legacy removal
```

## 43.3 Never use UX flags to bypass authorization

Flag determines implementation availability.

Server policy determines capability.

---

# 44. T93 — DESIGN-SYSTEM CONVERGENCE CAMPAIGN

Run **after** major page lanes are integrated.

## 44.1 Audit

Search for repeated implementations of:

```text
page headers
toolbar shells
segmented controls
filter buttons
display menus
status pills
primary action styles
empty/error states
side sheets
modal headers/footers
bulk bars
```

## 44.2 Consolidate

Prefer:

```text
delete duplicate
reuse canonical
extract only proven common structure
```

Avoid prematurely abstracting every page-specific layout.

## 44.3 Token discipline

QCET constraints remain:

```text
Tailwind v4
light-only
Lucide
strokeWidth=1.5
OKLCH/tokens where already canonical
no decorative radial-gradient AI styling
```

## 44.4 Visual regression

After convergence, rerun Q2 and Q6.

A convergence refactor must not silently change:
- permissions;
- lifecycle;
- URL semantics;
- data queries.

---

# 45. T94 — PILOT VALIDATION

## 45.1 Why

Agents and visual reviewers cannot fully determine whether school staff understand the final terminology and workflows.

Use a small representative pilot before wide rollout.

Suggested composition:

```text
1–2 executive/admin users
2 managers/unit heads
3–5 staff users
```

Adjust to availability.

## 45.2 Core pilot tasks

Ask users to complete, without coaching where possible:

```text
1. Find an overdue task requiring attention.
2. Assign/create a task for another person.
3. Find something waiting for your approval.
4. Open submitted evidence and approve/request changes.
5. Find work on a specific calendar date.
6. Find a person/unit or document.
```

## 45.3 Record

For each task:

```text
success/failure
completion time
misclicks
backtracks
help requests
terminology confusion
unexpected interpretation
```

Do not record sensitive task/document contents in the UX report.

## 45.4 Pass condition

No release blocker confusion around:
- scope;
- approval authority;
- save/sync state;
- task ownership;
- Filter vs Display;
- notification vs task inventory.

---

# 46. T95 — ROLLBACK / HALT CRITERIA

Before rollout, record current baseline.

Do not invent arbitrary percentages without data.

Halt rollout if candidate shows a material negative change in:

```text
authorization/security errors
task-create failures
approval failures
bulk mutation failures
sync conflicts
service error rate
p75 interaction latency
p75 INP
critical journey completion
```

For each halt signal:

```text
metric
baseline
candidate
severity
owner
rollback action
re-enable criteria
```

Rollback is a production-safety mechanism, not a way to hide known semantic defects.

---

# 47. T96 — LEGACY REMOVAL GATE

Legacy code deletion happens last.

For each artifact marked `DELETE_READY`:

1. search all imports/references;
2. verify compatibility redirect if needed;
3. run targeted tests;
4. run build;
5. update migration ledger;
6. delete;
7. search again;
8. rerun relevant journeys.

Do not keep permanent dual implementations “just in case”.

Do not remove compatibility routes without explicit migration policy.

---

# 48. PERFORMANCE BUDGET INTEGRATION

V5 already defines performance as UX.

V5.1 adds enforcement.

## 48.1 Establish budget from baseline

Measure key route classes first.

Define budgets around:
- user-centric timing;
- script/resource growth where useful;
- interaction regressions.

## 48.2 Build/staging integration

Where practical, integrate budget checking into the existing verification/build pipeline.

Do not add a heavy new CI platform solely for this plan.

## 48.3 Lab + field

Lighthouse/lab evidence is useful for regression detection.

It is not sufficient alone.

Compare with existing production/field telemetry where QCET can safely collect it.

## 48.4 No blind budget worship

A page may exceed one synthetic target while delivering a materially better real interaction.

Document exceptions with evidence.

---

# 49. FINAL EXECUTION ORDER — V5.1

```text
0. Baseline current checkout
1. Read repository/product contracts
2. Freeze C1–C20
3. Create ownership map
4. Create migration ledger
5. Execute P0 correctness
6. Execute core Tasks/Detail/Create
7. Execute Calendar/Workbench
8. Execute Global Search/Nav
9. Execute Notifications/Documents/Org
10. Execute Offline/PWA correctness
11. Integration owner wires canonical workspace
12. Design-system convergence
13. Q1–Q6 independent evaluation
14. Performance comparison
15. Side-by-side screenshots
16. Runtime journeys J1–J7
17. Flagged internal candidate
18. Pilot validation
19. Limited rollout
20. Measure + halt/rollback decision
21. Default-on
22. Legacy-removal gate
23. Remove obsolete flags/paths
24. Final verification report
```

---

# 50. V5.1 FINAL DEFINITION OF DONE ADDENDUM

In addition to all V5 Definition of Done items:

## Rollout
- [ ] C17 rollout contract documented;
- [ ] major migration boundaries have safe flag/rollback strategy where justified;
- [ ] authorization is independent of feature flags;
- [ ] limited rollout completed before default-on for major risky surfaces.

## Design System
- [ ] canonical pattern inventory completed;
- [ ] repeated page-local patterns audited;
- [ ] primary action treatment consistent;
- [ ] convergence pass completed;
- [ ] no new uncontrolled visual primitive family.

## Content
- [ ] QCET UI vocabulary documented;
- [ ] lifecycle/attention terminology consistent;
- [ ] action labels describe outcomes;
- [ ] date/time/period labels consistent.

## Migration
- [ ] migration ledger exists;
- [ ] legacy routes/components have explicit status;
- [ ] no `DELETE_READY` artifact retains unknown consumers;
- [ ] redirects preserved where needed.

## Evaluation
- [ ] side-by-side evidence captured;
- [ ] pilot completed for major workflow changes;
- [ ] terminology confusion documented/remediated;
- [ ] rollout metrics compared to baseline.

## Rollback
- [ ] halt criteria defined from baseline;
- [ ] rollback owner/action documented;
- [ ] no critical candidate regression remains.

---

# 51. STOP PLANNING CONDITION

After V5.1:

```text
DO NOT create V6 merely because more inspiration can be found.
```

Create a new planning revision only if one of these happens:

```text
runtime evidence disproves a frozen contract
server/business policy changes
new module enters scope
security model changes
major architecture changes
pilot reveals a repeated cross-product mental-model failure
```

Otherwise:

```text
execute
measure
fix
ship incrementally
```

This prevents a plan-perfection loop.

---

# 52. V5.1 RESEARCH REFERENCES

## Linear — calmer, consistent UI + feature-flag comparison
https://linear.app/now/behind-the-latest-design-refresh

## Linear — March 2026 UI refresh
https://linear.app/changelog/2026-03-12-ui-refresh

## Atlassian Design System
https://atlassian.design/get-started/about-atlassian-design-system

## Atlassian Content Design
https://atlassian.design/get-started/content-design

## Atlassian Buttons
https://atlassian.design/guidelines/product/components/buttons

## web.dev — performance budgets
https://web.dev/articles/performance-budgets-101

## web.dev — Lighthouse performance budgets
https://web.dev/articles/use-lighthouse-for-performance-budgets

## web.dev — build-process budgets
https://web.dev/articles/incorporate-performance-budgets-into-your-build-tools

---

# 53. FINAL ORCHESTRATOR ADDENDUM

Append this to the V5 orchestrator prompt:

```text
V5.1 execution hardening:

- Freeze C17–C20 before the first broad rollout.
- Maintain UX_MIGRATION_LEDGER.md.
- Use existing QCET feature-flag infrastructure only at meaningful migration boundaries.
- Never use feature flags as permission checks.
- Run design-system convergence after page lanes, not inside every lane independently.
- Freeze QCET_UI_VOCABULARY.md before final copy cleanup.
- Produce same-data side-by-side evidence for major surfaces.
- Pilot major workflow changes with representative role users.
- Compare candidate health to baseline before widening rollout.
- Stop/rollback on material semantic, error-rate, interaction-latency or journey regression.
- Remove legacy paths only after DELETE_READY proof.
- After V5.1, stop expanding the plan without runtime evidence.
```

---

# 54. FINAL PRODUCT PRINCIPLE

> **Primary work should dominate the screen; everything else must earn its visibility.**

For QCET this means:

```text
less tool maintenance
less chrome
less duplicate meaning
less fake certainty

more work visibility
more contextual power
more truthful states
more preserved context
more consistent language
more measurable safety
```

The final QCET experience must not merely look modern.

It must behave predictably under:

```text
different roles
different scopes
different network conditions
different data volumes
different devices
different lifecycle states
different failure modes
```

That is the release standard for V5.1 FINAL.
