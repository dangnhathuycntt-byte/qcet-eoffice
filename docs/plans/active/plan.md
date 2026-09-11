# QCET WORK — UX RECONSTRUCTION MASTER PLAN V3

**Repository:** `dangnhathuycntt-byte/qcet-eoffice`  
**Target branch:** `main`  
**Verified baseline SHA (2026-09-11):** `5abd205e91d327b331808bae44cf6a5727b1eefe`  
**Execution mode:** Claude Code + existing QCET plan executor when appropriate  
**Primary objective:** Reconstruct the visible information architecture and interaction hierarchy of QCET's core workspaces while preserving the existing domain engine, authorization, APIs, query state, and task/calendar semantics.

---

## 1. Why this sprint exists

The previous UX pass changed substantial code but left the product composition visually close to the baseline. The next sprint must therefore be judged by **observable interaction hierarchy**, not by line count, commit messages, or test success alone.

The product should move from:

```text
Navigation
→ Page title
→ Context controls
→ More controls
→ Metrics/cards
→ Actual work
```

to:

```text
Context
→ What needs attention / current view
→ Actual work
→ Secondary configuration on demand
```

### External design principles used

This plan intentionally borrows patterns from current high-quality productivity software:

- **Linear 2026 UI refresh:** calmer interface, consistent headers/navigation/view controls, quieter sidebar, stronger main-content emphasis.
- **Linear Custom Views:** filtered views are durable, saveable, shareable, and can be favorited into navigation.
- **Linear Display Options:** layout, grouping, ordering, and visible properties live behind a display-options surface.
- **GitHub Pull Requests dashboard (2026):** a single Inbox home for work requiring attention, plus saved views and powerful search/filter.
- **Notion database views:** the view is the primary container; filter/sort/group/layout are settings of the view; side peek preserves context.
- **WCAG 2.2:** no drag-only workflow; minimum pointer target requirements must be respected.
- **Anthropic prompting guidance:** use subagents when workstreams are truly parallel/isolated, not for trivial single-file tasks.

References are listed at the end of this document.

---

# 2. Non-negotiable constraints

## 2.1 Do not rewrite the application

Do **not** replace:

- Next.js 15
- React 19
- TypeScript
- PostgreSQL / Prisma
- existing auth/session model
- task domain model
- current APIs
- current task mutation flow
- current workspace URL/query model

## 2.2 Preserve canonical engines

Preserve and reuse, unless a proven correctness defect requires a narrow fix:

- `UnifiedAdaptiveWorkspace`
- workspace query state
- existing Saved Views infrastructure
- scope authorization
- task creation and optimistic mutation logic
- `TaskDetailSideSheet`
- dashboard data services
- calendar data model
- notification semantics

## 2.3 Prefer deletion over abstraction

When choosing between:

1. another wrapper/component/setting; or
2. deleting duplicated UI and reusing an existing capability,

prefer deletion/consolidation.

## 2.4 No feature expansion

Do not add unrelated product features while reconstructing UX.

---

# 3. Source baseline and preflight

Before modifying anything:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log -1 --oneline
```

Expected baseline when this plan was created:

```text
main
5abd205e91d327b331808bae44cf6a5727b1eefe
```

### If HEAD has advanced

Do **not** hard reset or rewrite history.

Instead:

1. record the actual current HEAD;
2. inspect changes since `5abd205e...`;
3. determine whether they touch the UX target files;
4. update the execution report baseline;
5. continue from current `main` unless the new changes invalidate the plan.

### Working tree rule

If there are unrelated local changes:

- do not discard them;
- use a branch/worktree or isolate changes safely;
- report conflicts before editing overlapping files.

---

# 4. Existing repository commands

Current repository scripts include:

```bash
npm run typecheck
npm run lint
npm test
npm run verify
npm run build
npm run test:gate0
npm run test:sprint2
npm run test:sprint3
npm run test:executor
```

Minimum final verification:

```bash
npm run verify
npm run build
```

Run narrower relevant tests during each shard before full integration.

---

# 5. Phase 0 — Freeze and capture the UX baseline

**No production UI edits before this phase is complete.**

## 5.1 Capture matrix

Capture the following deterministic states:

| Route / State | Desktop | Mobile |
|---|---:|---:|
| `/` | 1440×900 | 390×844 |
| `/tasks?view=kanban` | 1440×900 | 390×844 |
| `/tasks?view=table` | 1440×900 | 390×844 |
| `/calendar` | 1440×900 | 390×844 |
| `/notifications` | 1440×900 | 390×844 |

Store under:

```text
artifacts/ux-reconstruction/baseline/
```

Suggested names:

```text
dashboard-desktop.png
dashboard-mobile.png
tasks-kanban-desktop.png
tasks-kanban-mobile.png
tasks-table-desktop.png
tasks-table-mobile.png
calendar-desktop.png
calendar-mobile.png
notifications-desktop.png
notifications-mobile.png
```

## 5.2 Capture UX metrics

For each target screen record:

```json
{
  "controlsBeforePrimaryContent": 0,
  "verticalPixelsBeforePrimaryContent": 0,
  "visiblePillOrSegmentCount": 0,
  "borderedSurfaceCount": 0,
  "permanentActionsPerTaskCard": 0,
  "duplicateSemanticIndicators": 0,
  "primaryActionCount": 0
}
```

Store as:

```text
artifacts/ux-reconstruction/baseline/metrics.json
```

## 5.3 Screenshot mechanism preflight

The current `package.json` does not declare Playwright.

Use this order:

1. use an already-available project/browser automation tool if present;
2. use an existing MCP/browser capability if configured in Claude Code;
3. only if no capture mechanism exists, add the smallest dev-only visual harness necessary.

Do not introduce a broad testing stack merely to satisfy this phase.

## Gate 0

Proceed only when:

```text
baseline SHA recorded
AND screenshots exist
AND UX metrics exist
```

Otherwise stop and report the blocker.

---

# 6. Phase 1 — Semantic correctness before presentation reconstruction

This phase is sequential and blocks all visual shards.

## 6.1 Known correctness defect

Current Kanban contains presentation-owned overdue truth:

```ts
return d < "2026-09-04";
```

This must be removed.

UI components must not own the definition of "today", overdue, approval state, or canonical task status.

## 6.2 Audit

Search presentation code for:

```text
hard-coded ISO dates
new Date() used as business "today"
manual overdue comparison
duplicate status normalization
duplicate waiting-approval logic
duplicate completion rules
magic progress thresholds that change business meaning
```

## 6.3 Target

Use canonical domain/time helpers already present in the repository.

The same task must resolve identically in:

```text
table
kanban
dashboard
calendar
detail
```

## 6.4 Regression cases

At minimum:

```text
due yesterday + active      => overdue
due today + active          => not overdue
due future + active         => not overdue
due yesterday + completed   => not active overdue
```

## Gate 1

Do not start UI reconstruction until semantic regression tests pass.

---

# 7. Phase 2 — Freeze shared contracts

Before spawning parallel builders, define ownership.

## Protected shared files

Treat these as integration-owned by default:

```text
src/components/workspace/unified-adaptive-workspace.tsx
shared workspace types/contracts
shared task domain semantics
global auth/authorization
global query parser/state
```

A builder may not edit a protected shared file unless:

1. the change is required for its shard;
2. it proposes the smallest interface change;
3. the coordinator/integration owner approves it;
4. the change is committed before dependent shards continue.

This prevents parallel agents from turning the canonical workspace back into a merge-conflict hotspot.

---

# 8. Phase 3A — Tasks workspace: VIEW-FIRST reconstruction

**Primary owner:** UX-A

Likely primary files:

```text
src/components/dashboard/unified-task-toolbar.tsx
src/components/tasks/saved-views-selector.tsx
task-workspace presentation wiring
relevant task workspace tests
```

## 8.1 Current problem

The toolbar currently represents too many concepts simultaneously:

```text
scope
search
smart status pills
department
category
priority
academic month
saved views
view mode
density
sort
create
```

This creates a control wall before actual work.

## 8.2 New mental model

```text
SCOPE
→ CURRENT VIEW
→ CONTENT
→ FILTER / DISPLAY ON DEMAND
```

### Desktop target

```text
Nhiệm vụ                                           [+ Giao việc]

[Toàn trường] [Đơn vị] [Của tôi]

[ Việc cần tôi xử lý ▾ ] [ Tìm nhiệm vụ... ] [Filter 2] [Display]

────────────────────────────────────────────────────────────

ACTUAL TASK CONTENT
```

Hard requirement:

- no third permanent control row;
- task content appears substantially earlier than baseline.

## 8.3 Saved Views become primary work navigation

Do not rebuild Saved Views.

Promote the existing infrastructure.

Recommended role presets:

### Executive

```text
Cần Ban Giám hiệu xử lý
Chờ phê duyệt
Trễ / vướng
Nhiệm vụ trọng tâm
Tất cả nhiệm vụ
```

### Manager

```text
Cần tôi xử lý
Chờ tôi duyệt
Chờ đơn vị nộp
Quá hạn đơn vị
Tất cả nhiệm vụ đơn vị
```

### Staff

```text
Cần tôi xử lý
Việc hôm nay
Sắp đến hạn
Chờ nộp
Đã hoàn thành
```

These presets should compile into existing criteria rather than creating new filtering code.

## 8.4 Remove the permanent smart-filter rail

Remove default rendering of:

```text
Tất cả
Chờ duyệt
Chờ nộp BC
Quá hạn
Hôm nay
```

Preserve their behavior as view presets/criteria.

## 8.5 Filter surface

Permanent UI:

```text
[Filter]
```

Popover/sheet owns:

```text
Đơn vị
Danh mục
Ưu tiên
Tháng công tác
Trạng thái nâng cao
```

Active count:

```text
Filter 3
```

Do not expand active values into a second toolbar unless a concrete workflow proves that necessary.

## 8.6 Display surface

One `Display` control owns presentation preferences such as:

```text
Table / Kanban
Compact / Comfortable
Grouping where supported
Sorting
Visible metadata where supported
```

Do not expose density/sort/layout as separate permanent buttons.

## UX-A acceptance

```text
smart pill rail absent by default
saved/current view is obvious and primary
<= 2 permanent control layers
actual task content visible in first desktop viewport
Filter is secondary
Display is secondary
existing URL criteria restored correctly
role/scope authorization unchanged
```

---

# 9. Phase 3B — Kanban reconstruction

**Primary owner:** UX-B

Primary file:

```text
src/components/tasks/task-kanban-board.tsx
```

plus focused tests.

## 9.1 Current problem

Every card currently exposes too much:

```text
level badge
category badge
overdue badge
parent
title
progress
assignee
due date
status select
previous status
next status
```

The column already communicates the task's workflow stage, so repeating status controls on every card creates noise.

## 9.2 Target card hierarchy

```text
┌────────────────────────────────┐
│ Nâng cấp cổng tuyển sinh    ⋯ │
│                                │
│ CNTT · Nguyễn Văn An           │
│ Hạn 15/09             Quá hạn │
│                                │
│ ████████░░  78%               │
└────────────────────────────────┘
```

Priority:

```text
1. title
2. risk/deadline
3. owner/unit
4. meaningful progress
5. secondary metadata
```

## 9.3 Remove permanent workflow controls

Delete from every card:

```text
[Hiện tại: ... ▼]
[←]
[→]
```

Status mutation must remain accessible through contextual action.

## 9.4 Context menu

Use one contextual menu/action entry point:

```text
Mở chi tiết
Chuyển trạng thái >
Nhắc việc
Giao lại
```

Only expose a direct inline action when it is truly contextual, for example:

```text
Duyệt
Nộp báo cáo
Tiếp nhận
```

Do not show generic workflow controls on all cards.

## 9.5 Dragging

Do not make drag the only way to change status.

If drag/drop exists now or is introduced, retain a single-pointer/non-drag alternative in accordance with WCAG 2.2.

## UX-B acceptance

```text
no permanent status select per card
no permanent previous/next controls
<= 1 permanent generic action per card
canonical overdue semantics
title precedes secondary metadata
task detail still opens
status mutation remains available
mobile card remains usable
```

---

# 10. Phase 3C — Dashboard reconstruction: ACTION → SITUATION → CONTEXT

**Primary owner:** UX-C

Likely files:

```text
src/components/dashboard/zones/dashboard-zone.tsx
executive/personal attention presentation components
executive stat presentation components where necessary
focused dashboard tests
```

## 10.1 Current composition problem

Current dashboard composition still resembles:

```text
Header
Scope + Month + Refresh
Metric Strip
Overdue banner
Executive action surface
Personal workbench
```

Multiple areas compete to answer the same question:

> What needs my attention?

## 10.2 New model

```text
ACTION
→ SITUATION
→ CONTEXT
```

## 10.3 Executive target

```text
Bàn làm việc Ban Giám hiệu
Toàn trường · Tháng 9                           [•••]


CẦN XỬ LÝ                                      5
────────────────────────────────────────────────────

Báo cáo học vụ chờ duyệt
Phòng Đào tạo · gửi 25 phút trước                [Duyệt]

Kế hoạch CNTT quá hạn 3 ngày
Khoa CNTT                                        [Xem]

Đề nghị điều chỉnh cần phản hồi
Phòng HCQT                                     [Xử lý]

                                         Xem tất cả →


TÌNH HÌNH
────────────────────────────────────────────────────

73% tiến độ · 4 việc trễ · 2 đơn vị cần chú ý


ĐƠN VỊ CẦN CHÚ Ý
────────────────────────────────────────────────────

CNTT                 61%      4 trễ
Đào tạo              70%      2 trễ
```

## 10.4 Composition invariants

Dashboard must contain:

```text
exactly ONE attention/action surface
exactly ONE macro situation summary
context after situation
```

Do not render several layers of cards that repeat the same counts.

## 10.5 Empty action state

When there is nothing actionable:

```text
Không có việc cần bạn xử lý
Các hàng đợi hiện đã được giải quyết.
```

Render this once.

Do not amplify zero state into many cards with `0`, `0`, `0`, `0%`.

## 10.6 No-data semantics

Distinguish:

```text
NO_ACTION
NO_DATA
HEALTHY
```

Never infer healthy/green merely because data is absent.

## 10.7 Metrics

Prefer a compact situation strip over a large KPI card grid.

Example:

```text
73% tiến độ · 407 nhiệm vụ · 4 trễ · 2 đơn vị cần chú ý
```

Use semantic color only where severity requires it.

## UX-C acceptance

```text
exactly one attention surface
exactly one situation summary
no duplicate zero-state surfaces
NO_DATA != HEALTHY
first actionable item is visible in first desktop viewport
role behavior preserved
drill-down remains available
```

---

# 11. Phase 3D — Calendar reconstruction: CONTENT-FIRST

**Primary owner:** UX-D

Likely files:

```text
src/app/calendar/page.tsx
src/components/calendar/*
focused calendar tests
```

## 11.1 Current problem

Calendar currently exposes too much permanent chrome before the calendar:

```text
scope
month
academic year
prev
next
today
view mode
search
filter
create
```

## 11.2 Desktop target

```text
Lịch công tác                                 [+ Tạo]

‹       Tháng 9       ›    Hôm nay    Toàn trường ▾    ⋯

──────────────────────────────────────────────────────────
T2     T3     T4     T5     T6     T7     CN
...
```

The calendar grid/agenda should enter the first viewport materially sooner.

## 11.3 Secondary disclosure

Move secondary configuration behind `⋯`, `Display`, or another single secondary surface:

```text
Chế độ
  ✓ Tháng
    Danh sách

Năm học
  2026–2027

Tìm kiếm

Bộ lọc
  Cấp nhiệm vụ
  Trạng thái
```

Search may expand inline after user intent; it should not permanently consume a full row.

## 11.4 Day density

Keep cells focused:

```text
08:00 Họp giao ban
15:00 Hạn báo cáo
+4
```

Use `CalendarDaySheet` or equivalent contextual detail to preserve calendar context.

## UX-D acceptance

```text
calendar content visible in first desktop viewport
primary calendar chrome <= 1 main row
search is not a permanent second row
advanced filters disclosed
day sheet preserved
task/event creation preserved
month navigation preserved
mobile calendar/agenda remains usable
```

---

# 12. Phase 3E — Visual and accessibility gates

**Primary owner:** UX-E

This shard should primarily own tests, capture, measurement, and audit tooling—not production composition.

## 12.1 Accessibility requirements

All reconstructed controls:

```text
keyboard reachable
visible focus
Escape closes menu/popover/sheet
focus returns to trigger
no critical hover-only action
no drag-only workflow
appropriate aria-expanded / roles / labels
```

WCAG 2.2 AA minimum pointer target is 24×24 CSS px, with documented exceptions.

QCET product targets should remain more generous where practical:

```text
mobile common controls: ~44px target
desktop compact controls: >= 32px target where practical
```

## 12.2 Structural UX assertions

Add targeted checks for invariants such as:

```text
task smart-filter rail not rendered by default
Kanban cards do not each contain permanent status select
dashboard has exactly one attention surface
calendar has one primary chrome row on desktop
```

Avoid brittle tests based solely on exact prose when a semantic selector/test-id is possible.

## UX-E acceptance

```text
before/after captures exist
metrics are generated
keyboard paths tested
target sizing audited
visual invariant checks exist
no production redesign owned by UX-E unless required for test hooks
```

---

# 13. Parallel execution topology

After Phase 0, Phase 1, and shared-contract freeze:

```text
                         ┌── UX-A Tasks/View Bar
Baseline → Semantics ────┼── UX-B Kanban
                         ├── UX-C Dashboard
                         ├── UX-D Calendar
                         └── UX-E Visual/A11y Gates
                                   ↓
                            Integration Owner
                                   ↓
                             Visual Reviewer
```

## Subagent rule

Use subagents only when the shard:

- can run independently;
- benefits from isolated context;
- has clear file ownership;
- does not require constant shared-state coordination.

Do not spawn subagents for trivial grep, a single small edit, or a task that is faster and safer in the coordinator context.

---

# 14. Branch/worktree strategy

Recommended integration structure:

```text
main
 ├── ux/tasks-view
 ├── ux/kanban
 ├── ux/dashboard
 ├── ux/calendar
 └── ux/visual-gates
          ↓
ux-reconstruction-integration
          ↓
visual + functional gates
          ↓
main
```

Use repository-native worktree/shard facilities if the QCET executor already provides them.

Do not manually invent a second orchestration system if `.claude/workflows/qcet-plan-executor.js` already solves branch/worktree ownership.

---

# 15. Using the existing QCET plan executor

Before execution:

1. inspect `.claude/workflows/qcet-plan-executor.js`;
2. inspect any corresponding skill/docs/help;
3. use its actual supported invocation;
4. do not guess CLI flags;
5. do not refactor the executor as part of this UX sprint.

The executor is infrastructure, not the sprint target.

If a visual-capture step cannot run inside executor isolation, the coordinator may perform Phase 0 and final visual review outside shard execution, while keeping production edits inside owned shards.

---

# 16. Integration order

Do not merge all five shards blindly.

Recommended order:

```text
1. semantics/correctness base
2. UX-A Tasks navigation
3. UX-B Kanban
4. run /tasks integration tests + screenshots
5. UX-C Dashboard
6. UX-D Calendar
7. UX-E gates
8. integration-wide verify/build
9. after screenshots + metrics
10. independent visual review
```

Tasks + Kanban must be visually reviewed together because they are one user journey.

---

# 17. Automated UX acceptance targets

## `/tasks`

Desktop:

```text
actual task content visible in first viewport
<= 2 permanent control layers
no permanent academic-month rail
no permanent smart-filter pill row
one obvious current/saved view
one obvious primary creation action
```

Kanban:

```text
no permanent status select on every card
no permanent previous/next buttons
<= 1 permanent generic action/card
```

## Dashboard

```text
attention surfaces == 1
situation summaries == 1
duplicate zero surfaces == 0
NO_DATA never rendered as HEALTHY
first actionable item visible in first viewport when actions exist
```

## Calendar

```text
calendar/agenda visible in first viewport
primary desktop chrome <= 1 main row
secondary configuration disclosed
day detail preserves context
```

---

# 18. Quantitative before/after targets

These are targets, not excuses to break functionality.

| Metric | Target |
|---|---:|
| `/tasks` permanent controls | reduce ≥ 35% |
| Kanban permanent actions/card | reduce ≥ 60% |
| Vertical chrome before task content | reduce ≥ 30% |
| Dashboard attention surfaces | exactly 1 |
| Duplicate empty/zero surfaces | 0 |
| Calendar primary chrome rows | ≤ 1 main row |
| First-viewport actionable content | yes |
| Accidental mobile horizontal overflow | 0 |

If one numeric target conflicts with a proven usability/accessibility requirement, document the exception and have the visual reviewer judge it explicitly.

---

# 19. Independent visual review gate

The builder must not approve its own visual result.

The visual reviewer receives:

```text
baseline screenshot
candidate screenshot
route/state
viewport
rubric
```

Do **not** bias the visual reviewer with:

```text
lines changed
commit message
tests passed
builder explanation
```

## Rubric

| Dimension | Weight |
|---|---:|
| Information hierarchy | 25 |
| Action discoverability | 20 |
| Permanent-control reduction | 15 |
| Content scannability | 15 |
| Context preservation | 10 |
| Mobile usability | 10 |
| Cosmetic quality | 5 |

Pass:

```text
>= 80 / 100
```

Hard fail if:

```text
primary content remains buried below excessive chrome
OR layout hierarchy is substantially unchanged
OR permanent controls do not materially decrease
OR existing capabilities/permissions regress
```

Output must be one of:

```text
PASS_VISUAL
```

or:

```text
FAIL_VISUAL
```

with reasons.

---

# 20. Functional regression matrix

Before final merge prove that the following still work:

```text
role authorization
school / unit / my scope
URL query restoration
Saved Views
table mode
Kanban mode
task detail sheet
create task
status mutation
optimistic rollback
calendar task detail
calendar event creation
notification badge semantics
server-rendered initial data
```

Final minimum:

```bash
npm run verify
npm run build
```

Run relevant additional project gates where the changed code intersects those areas.

---

# 21. Visual language rules

Do not turn the sprint into a cosmetic redesign, but enforce consistency.

## Header

One page-context pattern:

```text
Title                              Primary action
Optional context/subtitle
```

Avoid wrapping the page header in a decorative card.

## View bar

One pattern:

```text
Current View | Search | Filter | Display
```

## Borders

Use borders when they convey:

- interaction boundary;
- actual grouping;
- input boundary;
- selection/focus.

Do not add a border merely to make every region look like a component.

## Radius

Suggested visual budget:

```text
8px   controls
10px  task cards
12px  true panels
full  avatars / dots / counters only
```

Respect existing tokens/Tailwind conventions rather than hardcoding a second style system.

## Color

Use strong color primarily for:

```text
risk
error
overdue
success
selection
primary action
```

Navigation/chrome should be quieter than the work content.

---

# 22. Mobile composition rules

Do not simply wrap desktop controls.

## Dashboard mobile

Order:

```text
Cần xử lý
→ top actions
→ situation
→ next context
```

Do not lead with a carousel of KPI cards.

## Tasks mobile

Suggested model:

```text
Nhiệm vụ                         +

[Của tôi ▾] [Current View ▾]

[Tìm] [Filter]

Mới 4 | Đang làm 8 | Chờ duyệt 2

TASK
TASK
TASK
```

## Calendar mobile

If full month cells become unreadable, favor agenda/day presentation while keeping month navigation accessible.

---

# 23. Stop conditions

Stop and report instead of inventing a workaround if:

```text
business semantics are ambiguous
authorization must change
an API contract must change unexpectedly
two shards need conflicting edits to a protected shared file
baseline cannot be rendered deterministically
visual capture cannot be made reliable
required live data is nondeterministic and prevents comparison
```

Do not "fix UX" by silently removing a capability.

---

# 24. Evidence required from every shard

Each builder returns:

```text
shard name
owned files
changed files
deleted UI inventory
preserved capability inventory
tests run
test results
known risks
shared-contract changes requested
screenshots if applicable
```

No vague "done" status.

---

# 25. Final evidence package

Create:

```text
artifacts/ux-reconstruction/final/
```

containing at minimum:

```text
baseline-sha.txt
candidate-sha.txt
before/
after/
metrics-before.json
metrics-after.json
changed-files.md
capability-regression.md
accessibility-audit.md
visual-review.md
final-verdict.md
```

`final-verdict.md` must contain:

```text
FUNCTIONAL: PASS|FAIL
BUILD: PASS|FAIL
VISUAL: PASS_VISUAL|FAIL_VISUAL
UX_SCORE: NN/100
```

---

# 26. Definition of Done

This sprint is done only when all are true:

```text
✓ canonical semantics are correct
✓ `/tasks` is view-first
✓ permanent smart-filter rail is gone
✓ Kanban cards are materially simpler
✓ dashboard follows Action → Situation → Context
✓ dashboard has one attention surface
✓ zero/no-data duplication is removed
✓ calendar content appears materially earlier
✓ secondary controls use progressive disclosure
✓ desktop passes
✓ mobile passes
✓ keyboard/a11y checks pass
✓ existing capabilities remain intact
✓ npm run verify passes
✓ npm run build passes
✓ before/after evidence exists
✓ visual score >= 80/100
✓ independent reviewer returns PASS_VISUAL
```

If the after screenshots retain substantially the same information hierarchy as baseline:

```text
FAIL_VISUAL_RECONSTRUCTION
```

even if build and tests pass.

---

# 27. Research references

- Linear — UI refresh (2026-03-12):  
  https://linear.app/changelog/2026-03-12-ui-refresh
- Linear — A calmer interface for a product in motion:  
  https://linear.app/now/behind-the-latest-design-refresh
- Linear — Custom Views:  
  https://linear.app/docs/custom-views
- Linear — Display options:  
  https://linear.app/docs/display-options
- Linear — Filters:  
  https://linear.app/docs/filters
- GitHub — New pull requests dashboard GA (2026-07-09):  
  https://github.blog/changelog/2026-07-09-new-pull-requests-dashboard-is-now-generally-available/
- Notion — Views, filters, sorts & groups:  
  https://www.notion.com/help/views-filters-and-sorts
- W3C — WCAG 2.2:  
  https://www.w3.org/TR/WCAG22/
- Anthropic — Prompting best practices:  
  https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prompt-templates-and-variables
- Anthropic — Claude Code CLI reference:  
  https://docs.anthropic.com/en/docs/claude-code/cli-usage
