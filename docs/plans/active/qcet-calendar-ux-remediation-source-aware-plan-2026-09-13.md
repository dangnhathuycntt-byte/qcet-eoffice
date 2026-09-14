QCET WORK — Calendar UX Remediation Plan

Source-aware implementation plan for /calendar

Date: 2026-09-13
Status: Ready for agent execution
Scope: /calendar only, plus shared calendar helpers/tests required to make the route correct
Priority: P0 UX / information architecture
Implementation style: incremental refactor, no rewrite
Target stack: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, PostgreSQL/Prisma
Primary UX references: Google Calendar, Asana Calendar, Linear, Notion Calendar, WAI-ARIA APG

1. Executive goal

Turn /calendar from a task list squeezed into month cells into a time-based operations calendar for QCET.

The finished calendar must answer three different questions through three different views:

Tháng: “Tháng này ngày nào có sự kiện, deadline hoặc ngoại lệ cần chú ý?”

Tuần: “Tuần này khi nào có họp/sự kiện và ngày nào có deadline?”

Danh sách: “Những việc/sự kiện nào đang đến hạn theo trình tự thời gian?”

The page must stop trying to display all task content directly inside the month grid.

The redesign is successful only if it changes:

information hierarchy,

calendar semantics,

interaction model,

density,

source/data consistency,

not merely radius, spacing, border, shadow, or color.

2. Mandatory repository invariants

Read these before changing code:

.claude/rules/00-core.md

.claude/rules/10-ui.md

.claude/rules/11-mobile.md

.claude/rules/22-calendar.md

.claude/rules/50-testing.md

The implementation MUST preserve these repository rules:

2.1 One capability, one implementation

Do not create a second calendar engine, second event store, second scope engine, or a new parallel task projection path.

The current repository already contains duplicated historical calendar components. The new work must reduce duplication rather than add another “workspace”.

2.2 Role is not scope

Role controls authority.

Scope controls dataset:

school

unit

my

Never use role directly as a substitute for scope.

2.3 Server truth wins

Task creation/update stays on canonical task endpoints/domain.

Event/meeting creation stays on /api/meetings.

Reload/refetch canonical server state after mutation.

Do not fabricate local persisted state.

2.4 Never invent operational data

Do not synthesize:

fake times for tasks,

fake progress values,

fake department IDs,

fake assignees,

mock events.

2.5 Academic-cycle and ICT safety

Continue using src/lib/academic-calendar.ts.

Do not use unsafe UTC slicing for local calendar boundaries.

2.6 Mobile is adaptive

Mobile must remain agenda/list-first.

Do not squeeze a 7-column desktop calendar into a 390 px viewport.

3. Web benchmark conclusions

This plan intentionally combines patterns instead of copying one product.

3.1 Google Calendar

Useful patterns:

Day / Week / Month / Schedule are primary calendar views.

“Today” is a primary navigation action.

Clicking empty calendar time creates an event in context.

The selected view persists.

QCET implication:

[Tháng | Tuần | Danh sách] must be visible in the primary calendar chrome.

Do not hide the view switcher inside ....

Week time-slot click should prefill event date/time.

Reference:

Google Calendar Help — View your day, week or month

Google Calendar Help — Create an event

3.2 Asana

Useful patterns:

Tasks appear on calendar according to due dates.

Week and Month views are separate.

Calendar supports filters.

Unscheduled work is not forced onto dated cells.

Dragging a task can update its due date.

7-day view emphasizes prioritization inside each day.

QCET implication:

Only time-bound work belongs on calendar.

Task without dueDate must not appear in Month/Week.

Drag/drop is P1/P2 after authorization rules are explicit.

Dense days must summarize and rank attention rather than display source-order items.

Reference:

Asana Help — Calendar view

Asana Help — Planning with Asana calendar

3.3 Linear

Useful patterns:

Filters determine what appears.

Display Options determine how it appears.

URLs reflect view/filter state.

Dense operational surfaces are compact.

Context panels preserve current view instead of navigating users away.

QCET implication:

Scope, Filter, Display Options, View, and Search must not be mixed into one popup.

Use Day Sheet / right inspector to preserve calendar context.

Local calendar search must be clearly distinct from global app search.

Reference:

Linear Docs — Filters

Linear Docs — Display options

Linear Docs — Custom views

3.4 Notion Calendar

Useful patterns:

weekends,

week numbers,

interface/grid density

are view settings, not data filters.

QCET implication:

Create a dedicated Hiển thị surface for view preferences.

3.5 Accessibility

WAI-ARIA APG states that an actual role="grid" is a composite keyboard widget and therefore requires deliberate arrow-key/focus-management behavior.

QCET implication:

Do not add partial ARIA grid semantics.

Either implement a complete keyboard grid contract, or use semantic HTML/sections/buttons without claiming an ARIA grid.

Keep visible focus rings and accessible names.

4. Current-source audit

4.1 Canonical route is currently a large client-side page

Current file:

src/app/calendar/page.tsx

Observed state:

~1,200 lines.

Owns:

task fetch,

meeting fetch,

URL state,

view state,

scope state,

filters,

create dropdown,

CreateEventModal,

task mutation,

meeting projection,

page chrome,

day sheet,

task detail sheet.

Current views are only:

month

agenda

viewMode is typed as:

"month" | "agenda"

Problem

The route is becoming the de facto calendar engine while old calendar workspaces still exist elsewhere.

Required direction

Keep the route canonical, but extract cohesive pieces from it.

Do not create another “CalendarWorkspace v2”.

4.2 View switching is hidden in secondary disclosure

Current route hides:

Tháng

Danh sách

academic year

local calendar search

under the ... popup.

Relevant current state:

isSecondaryOpen

with Chế độ xem nested inside.

Problem

Changing calendar view is a primary navigation action, not a rare configuration.

The current source also has tests that explicitly lock this bad behavior in place.

Required change

Move the view switcher into the permanent toolbar:

[ Tháng | Tuần | Danh sách ]

Keep secondary disclosure only for rare display/preferences.

4.3 Scope and filters are mixed

Current scope button displays:

Toàn trường / Đơn vị / Của tôi

but opening it also exposes:

Cấp nhiệm vụ

Trạng thái

Problem

This violates the intended mental model:

Scope = dataset context.

Filter = narrowing that dataset.

It also makes the visible label misleading: the user clicks “Toàn trường” but gets a mixed scope/filter control panel.

Required change

Separate:

[ Toàn trường | Đơn vị | Của tôi ] [ Bộ lọc ] [ Hiển thị ]

On narrower desktop widths, scope may use a compact dropdown, but its semantics remain separate.

4.4 Month grid currently renders too many arbitrary task previews

Current file:

src/components/calendar/calendar-month-grid.tsx

Current behavior:

const MAX_PREVIEW = 3;
const displayedTasks = dayTasks.slice(0, MAX_PREVIEW);

Then:

+N nhiệm vụ

The file already sorts using attention helpers, which is good, but it still renders up to three item pills per date.

Problem

On dense days such as 27–35 items:

the month grid becomes a mini task list,

task titles are truncated,

users cannot infer workload severity,

empty dates consume the same large cell height,

completed tasks compete visually with active/attention work.

Required change

Month becomes an overview surface.

Per date:

date number,

event(s) if genuinely time-bound and high-value,

attention summary:

overdue,

waiting approval,

due,

compact “N việc khác” drill-down.

Do not attempt to expose 3 arbitrary titles on every populated day.

4.5 Month grid currently owns Agenda rendering too

calendar-month-grid.tsx includes:

renderAgendaList(...)

and returns Agenda when:

viewMode === "agenda"

Problem

One component owns two very different layouts:

month grid,

vertical agenda.

This increases conditional complexity and makes a Week view harder to add cleanly.

Required change

Split:

calendar-month-grid.tsx

calendar-week-view.tsx

calendar-agenda-view.tsx

All consume the same canonical projected data and presentation helpers.

This is component extraction, not a second engine.

5. Critical data-consistency findings

These are not cosmetic UX issues. Fix them before trusting the redesigned UI.

5.1 /calendar currently bypasses work-calendar-adapter.ts

Repository rule .claude/rules/22-calendar.md says canonical calendar transformation should use:

src/lib/academic-calendar.ts

src/lib/work-calendar-adapter.ts

But current /calendar month grid rebuilds task projection itself inside:

src/components/calendar/calendar-month-grid.tsx

It directly loops:

school tasks,

subtasks,

meeting events.

Risk

Two independent projection rules can diverge.

Required change

Create one canonical calendar projection pipeline.

Preferred route:

repair work-calendar-adapter.ts,

make it authoritative for task/deadline projection,

adapt persisted meetings separately,

merge both into one calendar presentation entry model.

Do NOT create a third projection implementation.

5.2 work-calendar-adapter.ts currently invents data

Current adapter contains synthetic values such as:

dueTime: "17:00"
dueTime: "16:30"
dueTime: "11:30"

and:

progressPercent: sub.status === "COMPLETED" ? 100 : 50

It also falls back to labels such as:

"Lãnh đạo phụ trách"
"Chuyên viên"
"Người phụ trách"

Problem

This conflicts with:

Never Invent Operational Data

Data Dignity

A task deadline with date-only semantics is NOT an event at an invented hour.

Required change

Repair adapter semantics before wiring it into the new Week view.

Target:

interface CalendarTaskDeadlineEntry {
  kind: "task";
  id: string;
  sourceTaskId: string;
  parentSchoolTaskId?: string;
  title: string;
  dueDate: string;
  status: string;
  progressPercent?: number;
  departmentId?: string;
  departmentName?: string;
  assigneeId?: string;
  assigneeName?: string;
  ...
}

Rules:

dueTime must be absent unless source data has a real time.

progressPercent remains undefined when source does not provide it.

missing assignee remains semantically “Chưa phân công” at presentation time, not fabricated into domain data.

missing department remains absent.

preserve canonical source task ID.

5.3 Current unit scope appears too broad in client projection

Current MonthGrid logic includes:

scope === "unit"

as enough to match subtasks.

It does not visibly compare task department against the authenticated user’s canonical department in that projection.

Risk

“Đơn vị” may mean “all unit-level subtasks in the dataset” rather than “my unit”.

Required change

Add explicit canonical scope resolver.

Inputs should include:

currentUserId
currentUserDepartmentId
currentUserName // compatibility only if needed

Rules:

school:

dataset permitted for school scope by server authority.

unit:

only entries belonging to authenticated user’s canonical department/unit.

my:

only entries assigned/owned/organized by authenticated user according to canonical identity fields.

Do not rely on display-name matching when ID exists.

Add boundary tests.

5.4 Current event handling for my scope is suspicious

Current meeting match logic in MonthGrid includes:

scope === "my"

without visibly requiring organizer/participant identity.

Risk

“My” scope can display all events.

Required change

Define meeting scope semantics explicitly.

Minimum safe behavior:

school: meetings visible under existing server permissions.

unit: event unit ID equals current user department/unit ID.

my: current user is canonical organizer or participant if participant identity is available.

If participant data is not available from current API response, do not fake it. Use organizer identity only and document the limitation.

5.5 Status filter currently suppresses persisted meetings

Current MonthGrid only loops meetings when:

statusFilter === "ALL"

Problem

Selecting “Quá hạn” implicitly removes all events, but the UI does not explain that status filter applies only to task deadlines.

Required change

Use a clearer filter model:

type CalendarItemTypeFilter = "ALL" | "EVENT" | "TASK";
type CalendarTaskStatusFilter = ...

Then meeting/event visibility is controlled by item type, not a task-state filter.

6. Existing strengths to preserve

Do not throw away working parts.

6.1 Persisted meetings are already canonical

src/app/calendar/page.tsx currently:

GETs /api/meetings,

POSTs /api/meetings,

refetches server truth after create.

Preserve this.

6.2 Task detail context already exists

Current route opens:

TaskDetailSideSheet

Preserve canonical task detail behavior and task IDs.

6.3 Day Sheet already exists

src/components/calendar/calendar-day-sheet.tsx

Current strengths:

right-side sheet,

attention summary,

quick status filters,

local search on dense days,

mobile full-screen behavior,

44 px touch-target support.

Keep it and evolve it rather than replacing it.

6.4 Attention presentation helpers already exist

src/lib/calendar/calendar-presentation.ts

Current useful functions:

getCalendarAttentionState

sortCalendarItemsByAttention

getCalendarDaySummary

filterCalendarItems

Reuse and extend them.

6.5 Mobile agenda-first behavior already exists

Current MonthGrid renders agenda on compact widths.

Preserve the product decision.

7. Target UX architecture

7.1 Desktop page header

Target:

Lịch công tác

‹  Tháng 9, 2026  ›   Hôm nay

[ Tháng | Tuần | Danh sách ]    [ Toàn trường | Đơn vị | Của tôi ]
                                 [ Bộ lọc ] [ Hiển thị ] [ + Tạo ]

At narrower desktop width, controls may wrap into two logical rows, but do not hide the view switcher in ....

Priority order:

time navigation,

view mode,

scope,

filter,

display,

create.

7.2 Month view

Month view is overview-first.

Each date cell should answer:

Is there a scheduled event?

Is something overdue?

Is something waiting for approval?

How much work is due?

Example:

14                                      10

09:00  Họp giao ban BGH

▲ 2 quá hạn
◷ 1 chờ duyệt

7 việc khác →

Dense day:

25                                      35

09:00  Họp BGH
▲ 4 quá hạn
◷ 7 chờ duyệt

23 việc khác →

Do not render three task pills merely because three fit.

7.3 Week view

Week becomes the primary operational scheduling view.

Use two semantic regions:

Timed schedule

Real meetings/events positioned by real start/end times.

          T2          T3          T4 ...

08:00
09:00   [Họp BGH]
10:00

Deadline lane

Task deadlines are NOT positioned at fake clock times.

──────────────── DEADLINES ────────────────
T2: 3 việc
T3: ▲ 2 quá hạn
T4: 1 chờ duyệt

Clicking a deadline opens task detail or day inspector.

Clicking an empty time slot creates a meeting/event with actual date/time context.

7.4 Agenda / Danh sách view

Replace tall cards with compact rows.

Target desktop density:

approximately 40–52 px per normal task row, expanding only when necessary.

Example:

THỨ HAI · 14/09                               10 việc
────────────────────────────────────────────────────

09:00–10:00  Họp giao ban BGH     A101       Sự kiện
▲            Báo cáo tuyển sinh   P.ĐT       Quá hạn
◷            Duyệt hồ sơ          Khoa CNTT  Chờ duyệt
○            Hoàn thiện đề cương  Chưa giao  Đang làm

Completed items:

muted,

optionally collapsed,

never dominate current work.

7.5 Day inspector

Keep CalendarDaySheet, but adjust desktop behavior:

preserve context,

no route navigation,

task/event list ranked by attention,

actions in context.

Desktop target:

Calendar                               Day Inspector
┌──────────────────────────────┬─────────────────────┐
│                              │ Thứ Hai · 14/09    │
│       current view           │                     │
│                              │ Sự kiện             │
│                              │ 09:00 Họp BGH       │
│                              │                     │
│                              │ Đến hạn             │
│                              │ ▲ Báo cáo tháng     │
│                              │ ○ Hồ sơ tuyển sinh  │
│                              │                     │
│                              │ + Tạo               │
└──────────────────────────────┴─────────────────────┘

Mobile remains full-screen / sheet.

8. Target component structure

Do not create another giant workspace component.

Recommended target:

src/app/calendar/page.tsx
src/components/calendar/
  calendar-toolbar.tsx
  calendar-month-grid.tsx
  calendar-week-view.tsx
  calendar-agenda-view.tsx
  calendar-day-sheet.tsx
  calendar-filter-popover.tsx
  calendar-display-popover.tsx
  create-event-modal.tsx
src/lib/calendar/
  calendar-presentation.ts
  calendar-projection.ts      # only if adapter cannot cleanly own merged projection
  calendar-week.ts
src/lib/work-calendar-adapter.ts

Important

Prefer enhancing work-calendar-adapter.ts rather than introducing calendar-projection.ts.

Create calendar-projection.ts only if it is strictly an orchestration adapter that combines:

canonical task projections,

persisted meetings,

without duplicating domain rules.

9. Execution plan

Phase 0 — Baseline and safety

Task 0.1 — Read source and rules

Agent must read:

.claude/rules/00-core.md
.claude/rules/10-ui.md
.claude/rules/11-mobile.md
.claude/rules/22-calendar.md
.claude/rules/50-testing.md

src/app/calendar/page.tsx
src/components/calendar/calendar-month-grid.tsx
src/components/calendar/calendar-day-sheet.tsx
src/lib/calendar/calendar-presentation.ts
src/lib/work-calendar-adapter.ts

tests/calendar-route-integration.test.ts
tests/calendar-route-hygiene.test.ts
tests/calendar-page-persistence.test.ts
tests/calendar-presentation.test.ts
tests/mobile-calendar-documents.test.ts
tests/calendar-task-interaction.test.ts
tests/semantic-overdue-regression.test.ts

Also inspect runtime references to:

src/components/calendar/calendar-workspace.tsx
src/components/calendar/executive-calendar-workspace.tsx
src/components/calendar/calendar-month-view.tsx

Do not assume those are all canonical.

Task 0.2 — Capture current baseline

Capture:

/calendar?view=month

/calendar?view=agenda

desktop 1440x900

mobile 390x844

Keep screenshots under existing artifact convention.

Do not evaluate success from screenshots alone; use them for regression comparison.

Task 0.3 — Baseline tests

Run focused calendar tests first.

Suggested:

npm test -- tests/calendar-presentation.test.ts
npm test -- tests/calendar-page-persistence.test.ts
npm test -- tests/calendar-route-hygiene.test.ts
npm test -- tests/calendar-route-integration.test.ts
npm test -- tests/calendar-task-interaction.test.ts
npm test -- tests/mobile-calendar-documents.test.ts

If repository test runner does not accept this syntax, use the project’s existing focused-test convention.

Record existing failures before changing code.

Phase 1 — Repair canonical calendar data semantics

This phase must happen before visual Week view implementation.

Task 1.1 — Fix work-calendar-adapter.ts

File:

src/lib/work-calendar-adapter.ts

Remove fabricated values

Remove hardcoded task deadline times:

"17:00"
"16:30"
"11:30"

Do not replace them with another guessed time.

Preserve real progress

For StaffTask:

progressPercent: sub.progressPercent

If undefined, keep undefined.

Do not convert unknown progress to 50%.

Preserve real identity

Add optional canonical fields where available:

assigneeId?: string
departmentId?: string

Do not fabricate BGH when a canonical ID is absent unless BGH is actually sourced from the record.

Preserve status semantics

Avoid flattening all active statuses into IN_PROGRESS if that destroys meaning needed by Calendar.

If the adapter must expose a presentation state, derive it separately from canonical status.

Preferred:

status: originalStatus
isOverdue: boolean

Attention state remains the responsibility of calendar-presentation.ts.

Task 1.2 — Add adapter regression tests

Add/update tests to prove:

no fake due time exists for date-only task,

StaffTask without progress remains undefined,

StaffTask with progress preserves exact value,

assignee ID is preserved,

department ID is preserved when available,

missing department is not silently turned into fake BGH,

completed task is not marked overdue,

ICT date projection is stable.

Task 1.3 — Canonical task calendar projection

Replace duplicated task loop in:

calendar-month-grid.tsx

with canonical projected task entries produced upstream.

Do not let the Month component know how to traverse SchoolTask → subTasks.

Target:

<CalendarMonthGrid
  entries={calendarEntries}
  ...
/>

instead of:

<CalendarMonthGrid
  tasks={tasks}
  events={meetingDayItems}
/>

The view should render data, not rebuild domain projections.

Phase 2 — Create one merged presentation model

Task 2.1 — Define a discriminated calendar entry

Recommended shape:

type CalendarEntry =
  | CalendarTaskEntry
  | CalendarEventEntry;

interface CalendarBaseEntry {
  id: string;
  date: string;
  title: string;
  level?: "Trường" | "Đơn vị";
}

interface CalendarTaskEntry extends CalendarBaseEntry {
  kind: "task";
  sourceTaskId: string;
  parentSchoolTaskId?: string;
  dueDate: string;
  status: string;
  assigneeId?: string;
  assigneeName?: string;
  departmentId?: string;
  departmentName?: string;
  progressPercent?: number;
  originalTask: SchoolTask | StaffTask;
}

interface CalendarEventEntry extends CalendarBaseEntry {
  kind: "event";
  meetingId: string;
  startTime: string;
  endTime?: string;
  location?: string;
  organizerId?: string;
  organizerName?: string;
  unitId?: string;
  unitName?: string;
}

Do not add time to task entries unless the source task truly stores a time.

Task 2.2 — Extend presentation helpers

File:

src/lib/calendar/calendar-presentation.ts

Add pure/testable helpers:

groupCalendarEntriesByDate(...)
getMonthCellPresentation(...)
sortAgendaEntries(...)
getDeadlineSummary(...)
isCalendarEntryVisibleForScope(...)

Keep attention ranking deterministic.

Target ranking for task deadlines:

overdue

waiting approval/review

due today

in progress

pending

completed

Timed events are not “overdue tasks”; treat them by event time.

Task 2.3 — Fix scope semantics

Use canonical IDs.

Pass:

currentUserId={user?.id}
currentUserDepartmentId={user?.departmentId}

Rules must be test-driven.

Do not allow scope === "unit" to mean “every unit-level task”.

Do not allow scope === "my" to mean “every event”.

Phase 3 — Toolbar information architecture

Task 3.1 — Extract CalendarToolbar

Create:

src/components/calendar/calendar-toolbar.tsx

Move from page.tsx:

prev/next navigation,

current period label,

Hôm nay,

view switcher,

scope control,

filter button,

display button.

Keep + Tạo either in page heading or at right end of toolbar, but there must still be exactly one primary create trigger.

Task 3.2 — Primary view switcher

Add:

type CalendarViewMode = "month" | "week" | "agenda";

Support URL:

?view=month
?view=week
?view=agenda

Compatibility:

keep accepting existing agenda_list if current route does.

normalize it to agenda.

UI:

[ Tháng | Tuần | Danh sách ]

Must be visible without opening ....

Task 3.3 — Separate scope

Desktop target:

[ Toàn trường | Đơn vị | Của tôi ]

Use role/authority to decide which options are allowed, but never merge role and scope.

If existing app-level scope component is canonical and reusable, reuse it instead of implementing a calendar-specific clone.

Task 3.4 — Separate Filter popover

Create:

calendar-filter-popover.tsx

Initial filters:

loại:

tất cả

sự kiện

nhiệm vụ

trạng thái task:

tất cả

cần xử lý

quá hạn

chờ duyệt

đang thực hiện

hoàn thành

cấp:

tất cả

trường

đơn vị

Only add department/person filters if current canonical data/API reliably supplies IDs.

Do not implement display-name-only filtering as the long-term authority.

Task 3.5 — Separate Display popover

Create:

calendar-display-popover.tsx

P0 options:

Hiện cuối tuần      on
Hiện hoàn thành     off/default-muted
Mật độ              Compact | Comfortable

Do not mix these with status filters.

Task 3.6 — Search semantics

Global shell search already exists.

Do not add another always-visible top-level search bar.

Calendar-local search can live in Filter popover or Agenda controls and must be labeled:

Lọc lịch hiện tại

not generic “Tìm nhanh”.

Phase 4 — Month view redesign

File:

src/components/calendar/calendar-month-grid.tsx

Task 4.1 — Remove Agenda code from MonthGrid

Move vertical list logic to calendar-agenda-view.tsx.

MonthGrid renders only Month.

Task 4.2 — Replace fixed MAX_PREVIEW = 3

Delete the old contract:

MAX_PREVIEW = 3

Do not replace it with MAX_PREVIEW = 2 as a superficial fix.

Introduce semantic month-cell presentation.

Example helper output:

{
  eventPreviews: [...],
  overdueCount: 2,
  waitingCount: 1,
  dueCount: 7,
  hiddenCount: 6
}

Suggested priority:

show at most one high-value timed event preview,

show attention summaries,

show remaining count/drill-down.

Task 4.3 — Distinguish today vs selected date

Today:

circular date marker / subtle indicator.

Selected:

clear border/ring/background.

Urgent/attention:

separate semantic indicators.

Do not reuse the same blue background semantics for all three.

Task 4.4 — Reduce completed noise

Default Month behavior:

do not display completed task title previews.

completed count may remain in Day Sheet or display option.

if showCompleted=true, render muted.

Task 4.5 — Click behavior

Click date header/cell:

set selected date,

open Day Sheet.

Click task summary/drill-down:

open Day Sheet filtered to relevant date.

Click real event preview:

open event/day detail behavior; do not route away.

Phase 5 — Week view

Create:

src/components/calendar/calendar-week-view.tsx

Create pure helper:

src/lib/calendar/calendar-week.ts

Do not bury date math inside the React component.

Task 5.1 — Reuse proven week-date logic

There is existing getWeekDays() logic in:

src/components/calendar/executive-calendar-workspace.tsx

Do not copy/paste it into the new component.

Extract/reimplement as a pure helper under src/lib/calendar/ and migrate tests.

Preserve:

Monday-first week,

date-only timezone safety,

current-day detection.

Task 5.2 — Timed event grid

Render only real events/meetings with real times inside hour lanes.

Do not place task due dates at fake hours.

Initial visible time window can be a sensible workday range, but it must not truncate events outside it.

If an event is outside default visible hours, ensure it remains reachable.

Task 5.3 — Deadline lane

Add separate task deadline section.

Example:

NHIỆM VỤ ĐẾN HẠN

T2   3 việc
T3   ▲ 2 quá hạn
T4   ◷ 1 chờ duyệt

Clicking count/day opens Day Sheet.

High attention can expose one compact title where space permits, but never convert the whole lane into task cards.

Task 5.4 — Contextual event creation

Click empty time slot:

handleOpenAddEvent({
  date,
  startTime,
  endTime
})

Refactor CreateEventModal props so it accepts:

initialDate
initialStartTime
initialEndTime

The default end time can be derived from a fixed duration only as a UI creation default, not persisted task data.

This default is user-editable before submit.

Task 5.5 — Week navigation

Prev/next when Week view is active must move by one week, not one academic month.

Hôm nay returns to the current week.

Month view prev/next continues to use academic month semantics.

Agenda can move according to selected academic period or selected date; keep behavior explicit and tested.

Phase 6 — Agenda redesign

Create:

src/components/calendar/calendar-agenda-view.tsx

Task 6.1 — Compact rows

Desktop:

40–52 px normal row target.

avoid repeated card containers.

use separators and alignment.

use monospace/tabular time/date only where appropriate.

Task row:

▲  Báo cáo tuyển sinh     P. Đào tạo      Quá hạn

Event row:

09:00–10:00  Họp giao ban BGH   A101

Task 6.2 — Sticky date headers

Each date section should remain readable while scrolling.

Use position: sticky only where it does not create stacking/accessibility conflicts.

Task 6.3 — Completed behavior

Default:

active/attention first,

completed muted and collapsed when many.

Provide:

✓ 6 việc đã hoàn thành

expand on demand if useful.

Do not permanently remove completed items if the product needs historical audit.

Task 6.4 — Event/task visual grammar

Event:

real time prominent.

Task:

attention/status prominent.

Do not use the same pill layout for both.

Phase 7 — Day Sheet refinement

File:

src/components/calendar/calendar-day-sheet.tsx

Task 7.1 — Keep existing attention filters

Preserve:

Cần xử lý

Quá hạn

Chờ duyệt

Tất cả

Rename only if terminology needs consistency.

Task 7.2 — Separate Event and Deadline sections

Instead of mixing all entries as identical cards:

Sự kiện
  09:00 Họp BGH

Nhiệm vụ đến hạn
  ▲ Báo cáo tháng
  ○ Hồ sơ tuyển sinh

Task 7.3 — Contextual create

Current sheet has:

+ Thêm việc ngày này

Replace or extend with:

+ Tạo
  - Nhiệm vụ hạn ngày này
  - Sự kiện ngày này

Do not add a second prominent page-level CTA.

Task 7.4 — Desktop vs mobile

Desktop:

right-side contextual inspector,

avoid unnecessarily hiding the calendar.

Mobile:

full-screen sheet/overlay,

44 px targets,

explicit back/close action.

Phase 8 — Event creation refactor

Task 8.1 — Extract modal

Move current inline modal from page.tsx to:

src/components/calendar/create-event-modal.tsx

No behavior rewrite during extraction.

Task 8.2 — Preserve canonical API

Keep POST:

/api/meetings

Continue:

validate client form,

submit canonical payload,

server persists,

refetch calendar,

close modal on confirmed success.

Task 8.3 — No free-text unit identity

Current modal contains free-text department context.

Do not convert free text into a canonical unitId.

If a canonical unit selector is later added, it must submit a real unit ID.

Until then, free text may remain agenda/context text only.

Phase 9 — Remove legacy duplicate route engines

Current repository contains:

src/components/calendar/calendar-workspace.tsx
src/components/calendar/executive-calendar-workspace.tsx

Runtime search shows /calendar currently does not mount these as its route implementation.

Tests still import the legacy Executive workspace.

Task 9.1 — Determine live usage

Use repository-wide imports, not filename assumptions.

If these two components are test-only/dead runtime code after migration:

move any reusable pure helpers out,

migrate tests,

delete dead components.

Do not leave two giant alternate calendar workspaces “just in case”.

Task 9.2 — Do not delete calendar-month-view.tsx blindly

calendar-month-view.tsx is still used in dashboard/task zones.

It is outside this route-remediation deletion scope unless all live imports are migrated intentionally.

10. Tests that MUST be changed

Several existing tests encode old flawed behavior.

Tests must be updated to intended behavior, not weakened.

10.1 tests/calendar-route-integration.test.ts

Current outdated assertion:

MAX_PREVIEW = 3
+{remainingCount} nhiệm vụ

Replace with assertions for semantic summary behavior.

New test should prove:

dense day does not render arbitrary 3-title contract,

attention count visible,

hidden/remaining count available,

completed titles are not promoted by default.

Current test also expects view controls under disclosure.

Replace with:

primary toolbar visibly contains Month/Week/Agenda switcher,

secondary display surface does not own primary view selection.

10.2 tests/calendar-route-hygiene.test.ts

Remove expectation that:

secondary disclosure contains view mode

New assertions:

view switcher is primary,

Filter and Display are distinct,

only one global + Tạo,

local search is not duplicated permanently.

10.3 tests/calendar-page-persistence.test.ts

Extend:

meeting persists through canonical API,

Week view receives projected meeting events,

creation with initial slot date/time does not create local-only events.

10.4 tests/calendar-presentation.test.ts

Add:

month cell summary,

event/task distinction,

completed suppression,

deterministic attention ranking,

dense day fixture,

scope boundary behavior.

10.5 Add tests/calendar-week-view.test.ts

Minimum cases:

Monday-first week.

Sunday boundary.

selected date around month boundary.

ICT-safe date.

event uses real start/end time.

task without real time is not placed into hour grid.

deadlines grouped into deadline lane.

empty time slot passes date/start/end to create handler.

current week indicator.

weekends hidden/shown via display setting.

10.6 Add tests/calendar-scope-semantics.test.ts

Cases:

school scope.

unit scope matches current user department ID.

unit scope rejects other departments.

my scope matches assignee ID.

my scope rejects other assignees.

my event scope matches organizer/participant where canonical data exists.

no fallback broadening when IDs are absent.

10.7 Add adapter data-dignity tests

Must fail if:

fake 17:00/16:30/11:30 returns,

unknown progress becomes 50,

fake BGH ID is inserted,

fake assignee is inserted into domain projection.

11. URL-state contract

Keep calendar state shareable.

Recommended parameters:

/calendar?view=month
/calendar?view=week
/calendar?view=agenda

&date=2026-09-14
&scope=school|unit|my
&month=9
&year=2026-2027

Filter query params may be added only if they are stable and useful.

Do not serialize every transient UI preference.

Compatibility:

continue reading old agenda_list,

normalize writes to agenda.

12. Responsive contract

Desktop >= 1024 px

full toolbar,

Month 7-column grid,

Week time grid,

compact Agenda,

right-side Day Sheet.

Tablet 640–1023 px

allow toolbar wrapping,

keep Month if readable,

Week may become horizontally compressed only if readability remains acceptable,

otherwise use adaptive week columns / day-focused layout.

Mobile < 640 px

Default:

view=agenda

If user explicitly chooses Month/Week, do not silently override their URL preference, but provide a mobile-appropriate structure.

Never render the desktop 7-column month grid as the primary default on mobile.

Touch targets:

minimum 44x44 px for primary touch interactions.

13. Visual-system requirements

Follow current QCET UI rules.

Use

Tailwind CSS v4.

semantic tokens:

bg-background

bg-card

border-border

text-foreground

text-muted-foreground

OKLCH-based project tokens.

Lucide strokeWidth={1.5}.

font-mono tabular-nums for time/date/count where scanning benefits.

restrained shadows.

small semantic status indicators.

Avoid

dark mode classes,

gradients for decoration,

oversized pill UI everywhere,

icon boxes as decoration,

duplicate cards inside cards,

heavy colored surfaces,

emojis,

AI-slop ornamental backgrounds.

14. Status visual hierarchy

Recommended prominence, not hardcoded palette:

Quá hạn — highest attention.

Chờ duyệt — second.

Đến hạn hôm nay.

Sự kiện sắp diễn ra.

Đang thực hiện.

Chờ thực hiện.

Hoàn thành — lowest active prominence.

Color must never be the only carrier.

Always pair with:

text,

icon,

or both.

15. Parallel agent execution map

Do NOT run every task in parallel against the same files.

Use dependency-aware lanes.

Wave A — can run in parallel

Agent A1 — Data semantics

Own:

src/lib/work-calendar-adapter.ts
tests/work-calendar-adapter*.test.ts
tests/calendar-scope-semantics.test.ts

Goal:

eliminate fabricated calendar task data,

define ID-based scope rules.

Agent A2 — Presentation helpers

Own:

src/lib/calendar/calendar-presentation.ts
src/lib/calendar/calendar-week.ts
tests/calendar-presentation.test.ts
tests/calendar-week-view.test.ts  # helper-level initially

Goal:

pure grouping/ranking/week helpers.

Agent A3 — UI spec/test migration

Own tests only initially:

tests/calendar-route-hygiene.test.ts
tests/calendar-route-integration.test.ts
tests/calendar-page-persistence.test.ts

Goal:

replace outdated structural assertions with desired behavior contracts.

A3 should commit failing tests before UI implementation.

Merge checkpoint A

Merge pure helper/data/test work.

Run focused tests.

Resolve contracts before React work.

Wave B — can partly run in parallel

Agent B1 — Toolbar

Own:

src/components/calendar/calendar-toolbar.tsx
src/components/calendar/calendar-filter-popover.tsx
src/components/calendar/calendar-display-popover.tsx

Avoid editing page.tsx until integration phase if possible.

Agent B2 — Month

Own:

src/components/calendar/calendar-month-grid.tsx

Consumes shared canonical CalendarEntry[].

Agent B3 — Week

Own:

src/components/calendar/calendar-week-view.tsx

Consumes shared CalendarEntry[] and week helpers.

Agent B4 — Agenda

Own:

src/components/calendar/calendar-agenda-view.tsx

Agent B5 — Day Sheet

Own:

src/components/calendar/calendar-day-sheet.tsx

Goal:

Event/Deadline sections,

contextual create action.

Merge checkpoint B

Merge UI leaf components before page integration.

Run component-focused tests.

Wave C — serial integration

One agent only.

Own:

src/app/calendar/page.tsx
src/components/calendar/create-event-modal.tsx

Tasks:

wire canonical projection,

wire view mode,

wire toolbar,

wire Month/Week/Agenda,

URL state,

scope identity,

create context,

API persistence.

Do not have multiple agents editing page.tsx concurrently.

Wave D — legacy cleanup

After all route tests pass:

inspect calendar-workspace.tsx,

inspect executive-calendar-workspace.tsx,

extract any remaining useful pure helpers,

migrate tests,

delete dead runtime duplicates if truly unused.

This wave must not happen before the canonical route is stable.

16. Acceptance criteria

The task is NOT done until all of these are true.

Information architecture

Tháng | Tuần | Danh sách visible without opening ....

Scope separate from Filters.

Filters separate from Display options.

Exactly one prominent global + Tạo.

No duplicate permanent calendar search beside global shell search.

Data semantics

Tasks appear only with canonical due dates.

Task deadlines do not receive invented clock times.

Unknown progress is not fabricated.

Unit scope uses canonical unit/department identity.

My scope does not accidentally expose every event.

Persisted meetings remain server-authoritative.

Month

Dense days are summary-first.

No fixed “show 3 arbitrary task titles” contract.

Overdue/waiting counts are immediately visible.

Completed work is visually de-emphasized.

Today and selected date have distinct visuals.

Week

Real events positioned by real times.

Task deadlines live in a separate deadline lane.

Empty slot click prefills event date/time.

Prev/next moves by week in Week mode.

No fake task hour positioning.

Agenda

Compact information-dense rows.

Event and task have different visual grammar.

Sticky/readable date grouping.

Attention-first ordering.

Completed work does not dominate.

Day Sheet

Preserves current calendar context.

Separates events from deadlines.

Keeps attention filters.

Supports contextual task/event creation.

Mobile remains full-screen/touch-safe.

Accessibility

no color-only status.

all interactive controls have accessible names.

visible focus.

no partial/incorrect role="grid".

44px primary mobile touch targets.

Escape closes dialog/sheet where appropriate.

focus behavior verified.

17. Verification gates

Run in this order.

Gate 1 — focused unit tests

Calendar presentation, adapter, week/date, scope.

Gate 2 — focused route/UI tests

Calendar route integration, persistence, task interactions, mobile calendar.

Gate 3 — typecheck

npm run typecheck

Gate 4 — lint

npm run lint

Gate 5 — full test suite

npm test

Gate 6 — visual capture

Re-capture at minimum:

/calendar?view=month
/calendar?view=week
/calendar?view=agenda

Desktop:

1440x900

Mobile:

390x844

Review:

no control overload,

no giant whitespace in Agenda,

no task-title spam in Month,

Week readable,

no duplicated search/action surface.

Gate 7 — build

Only run production build according to repository build/cache rules.

Do not run a build in a way that corrupts an active dev .next cache.

18. Files expected to change

Likely:

src/app/calendar/page.tsx

src/components/calendar/calendar-toolbar.tsx               NEW
src/components/calendar/calendar-filter-popover.tsx        NEW
src/components/calendar/calendar-display-popover.tsx       NEW
src/components/calendar/calendar-week-view.tsx             NEW
src/components/calendar/calendar-agenda-view.tsx           NEW
src/components/calendar/create-event-modal.tsx             NEW

src/components/calendar/calendar-month-grid.tsx
src/components/calendar/calendar-day-sheet.tsx

src/lib/calendar/calendar-presentation.ts
src/lib/calendar/calendar-week.ts                          NEW
src/lib/work-calendar-adapter.ts

tests/calendar-route-hygiene.test.ts
tests/calendar-route-integration.test.ts
tests/calendar-page-persistence.test.ts
tests/calendar-presentation.test.ts
tests/calendar-week-view.test.ts                           NEW
tests/calendar-scope-semantics.test.ts                     NEW
tests/work-calendar-adapter.test.ts                        NEW/UPDATE

Potential deletion after proof of no live runtime imports:

src/components/calendar/calendar-workspace.tsx
src/components/calendar/executive-calendar-workspace.tsx

Do not delete calendar-month-view.tsx as part of this plan unless its dashboard consumers are separately migrated.

19. Do not do these things

Do not redesign by changing colors/radius only.

Do not add Framer Motion as a dependency just for this work.

Do not add another calendar library without proving current implementation cannot satisfy the requirements.

Do not add FullCalendar merely to avoid designing the domain projection.

Do not create a second event table/store.

Do not convert task deadlines into fake 08:00/17:00 events.

Do not make Month display every task.

Do not put Week switcher back under ....

Do not couple scope to role.

Do not weaken authorization to make school scope work.

Do not duplicate global search.

Do not keep legacy workspace components after they become proven-dead duplicates.

Do not blindly preserve tests that encode the old bad UX.

Do not rewrite unrelated dashboard calendar widgets in the same branch.

20. Agent execution prompt

Use the following prompt with the implementation agent:

Thực thi kế hoạch Calendar UX Remediation trên source hiện tại, trực tiếp bằng code.

BẮT BUỘC trước khi sửa:
1. Đọc các repository rules áp dụng cho calendar/UI/testing.
2. Đọc toàn bộ plan.
3. Rà soát source thực tế và đối chiếu từng task với code hiện tại.
4. Xác định phần nào đã có, phần nào thiếu, phần nào trong plan cần điều chỉnh vì source đã thay đổi.
5. Không dừng ở việc tóm tắt; phải triển khai.

Nguyên tắc:
- Không rewrite.
- Server truth wins.
- Không tạo parallel calendar/event engine.
- Không invent operational data.
- Không tạo fake due time/progress.
- Role != scope.
- Preserve academic-calendar/ICT semantics.
- Mobile agenda-first.
- Tailwind v4 light-only; semantic tokens; Lucide strokeWidth 1.5.
- Không phá unrelated user changes.

Thực thi theo dependency:
Wave A: canonical calendar data + pure helpers + failing intended-behavior tests.
Wave B: toolbar/month/week/agenda/day-sheet leaf components.
Wave C: tích hợp serial vào src/app/calendar/page.tsx.
Wave D: xóa legacy duplicate calendar workspaces chỉ sau khi chứng minh không còn runtime usage.

TDD:
- Sửa các test đang encode UX cũ; không được “relax” assertions chỉ để pass.
- Thêm regression tests cho scope unit/my, fake time/progress, Week deadline lane.
- Chạy focused tests sau từng task.
- Cuối cùng chạy typecheck, lint, full tests và visual baseline.

Mục tiêu UX bắt buộc:
- View switcher [Tháng | Tuần | Danh sách] là primary control.
- Month summary-first, không task-title spam.
- Week tách timed event và task deadline lane.
- Agenda compact.
- Scope / Filter / Display tách semantic.
- Day Sheet giữ context.
- Contextual create prefill đúng ngày/giờ.
- Không color-only status.
- URL state ổn định.

Khi hoàn tất:
1. Báo cáo các file thay đổi.
2. Báo cáo test/typecheck/lint/build thực sự đã chạy và kết quả.
3. Nêu các legacy files đã xóa hoặc lý do giữ lại.
4. Nêu những việc chưa làm và vì sao.
5. Không tự merge vào main nếu chưa được yêu cầu.

21. Definition of Done

Calendar redesign được coi là hoàn thành khi một người dùng có thể:

mở /calendar,

nhìn Month và ngay lập tức biết ngày nào có ngoại lệ,

đổi sang Week trong một click,

phân biệt rõ cuộc họp/sự kiện với task deadline,

click ngày để xem chi tiết mà không mất context,

tạo event từ time slot với ngày/giờ đúng,

đổi scope mà không nhầm với filter,

scan Agenda với density cao,

sử dụng trên mobile mà không bị ép vào 7-column grid,

reload và thấy dữ liệu persisted từ server.

Nếu thành phẩm vẫn chủ yếu giống hiện tại nhưng chỉ đổi spacing, màu, radius, shadow hoặc icon thì plan được xem là chưa hoàn thành.