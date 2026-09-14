QCET WORK — Task Management + App Shell UX Consolidation Plan

Date: 2026-09-13
Status: Ready for implementation
Primary route: /tasks
Cross-cutting shell scope: desktop sidebar + global top navigation + task toolbar + list/table + Kanban + saved views + bulk actions
Implementation strategy: incremental consolidation, test-first, no rewrite
Stack: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, PostgreSQL/Prisma
Design direction: Quiet enterprise UI, Linear-style information hierarchy, task-management semantics appropriate for QCET
Do not merge automatically to main.

0. Why this plan exists

The current /tasks page has improved visually, but the remaining UX problem is not a lack of features.

The repository already has:

canonical navigation registry,

global topbar,

collapsible sidebar,

global command search,

scope switching,

saved views,

task search,

advanced filters,

Display options,

List/Table,

Kanban,

keyboard navigation,

row selection,

a floating bulk-action bar,

task detail side sheet,

an action queue / workbox,

URL-synchronized task state.

The current issue is hierarchy and duplication.

At the moment, a user can encounter several concepts that look like parallel ways to answer the same question:

Toàn trường / Đơn vị / Của tôi

Việc cần tôi xử lý

Hộp việc xử lý

Saved Views

Filter

Display

List/Kanban

density

global search

local task search

shortcut strip

The goal of this work is therefore:

Remove chrome and duplication, clarify the semantic role of every control, and make the task inventory attention-first without adding another task-management engine.

This plan deliberately changes information architecture before visual polish.

1. World-class benchmark conclusions

The implementation should learn patterns from several products rather than copy one product literally.

1.1 Linear — main reference for task-management interaction grammar

Linear separates three concepts cleanly:

Filters determine which issues appear.

Display Options determine how those issues are shown.

Custom Views persist useful filtered perspectives.

Linear also lets users:

switch between list and board from Display Options,

group/order work,

choose which properties appear,

favorite frequently used views into the sidebar,

use a contextual bulk-action surface after selecting issues,

use workspace search separately from search/find in the current view.

Relevant references:

Display options: https://linear.app/docs/display-options

Board layout: https://linear.app/docs/board-layout

Custom views: https://linear.app/docs/custom-views

Favorites: https://linear.app/docs/favorites

Select issues: https://linear.app/docs/select-issues

Search: https://linear.app/docs/search

2026 UI refresh: https://linear.app/changelog/2026-03-12-ui-refresh

Important takeaway for QCET:

Scope, Filter, Saved View, Display, Attention Queue, and Global Search must not be visually interchangeable controls.

Linear's March 2026 refresh also explicitly moved toward calmer and more consistent headers/navigation/view controls and made side navigation slightly dimmer so main content has greater prominence.

1.2 Asana — reference for choosing the right task view

Asana treats List, Board, Timeline and Calendar as different views for different questions rather than forcing one view to handle every workload.

Reference:

Filter and save views: https://help.asana.com/s/article/filter-and-save-views

QCET implication:

List/Table is the safest default for large school-wide inventories.

Kanban remains available for workflow/flow inspection.

A user's explicit/saved layout choice must still be respected.

1.3 ClickUp — reference for large task inventories and board configuration

ClickUp describes List as the flexible view for managing/prioritizing tasks, while Board is useful for status/workflow. Both views support filters; Board cards can be configured to show fewer properties.

References:

Intro to views: https://help.clickup.com/hc/en-us/articles/6310383076503-Task-views

Filter List: https://help.clickup.com/hc/en-us/articles/6310206119575-Filter-and-search-tasks-in-List-view

Filter Board: https://help.clickup.com/hc/en-us/articles/6310208036503-Filter-tasks-in-Board-View

Customize Board: https://help.clickup.com/hc/en-us/articles/35342044832279-Customize-Board-view

QCET implication:

Do not turn 156 school-wide tasks into 156 equally prominent Kanban cards by default.

Board cards should expose only the properties needed to understand workflow state.

1.4 Slack — reference for global navigation simplification

Slack has repeatedly simplified global navigation to reduce distractions and keep global search/navigation distinct from page-local content.

References:

Simplified layout: https://slack.com/help/articles/41214514885907-Use-simplified-layout-mode-in-Slack

Simpler organized Slack: https://slack.com/blog/productivity/simpler-more-organized-slack

Streamlined sidebar: https://slack.com/blog/news/simpler-streamlined-sidebar

QCET implication:

Global top navigation should contain only global concerns:

navigation affordance,

global search/command launcher,

notifications,

account.

Task filters, view selection, and + Giao việc belong to the task page, not the app topbar.

1.5 Atlassian Design System — reference for page/shell hierarchy

Atlassian distinguishes navigation layout from page header/content. Its Page Header can combine page-level title/actions/search/filter when needed, while breadcrumbs exist to communicate deeper location.

Atlassian also warns that excessive raised/elevated surfaces create visual noise; borders/whitespace are often sufficient.

References:

Page header: https://atlassian.design/components/page-header

Breadcrumbs: https://atlassian.design/components/breadcrumbs/breadcrumbs

Navigation layout: https://atlassian.design/components/navigation-system/layout

Grid: https://atlassian.design/foundations/grid-beta/applying-grid

Elevation: https://atlassian.design/foundations/elevation/

Border: https://atlassian.design/foundations/border

QCET implication:

Flatten the task toolbar.

Reserve shadow/elevation for true overlays: dropdowns, drawers, bulk action bar, modals.

Use dividers, spacing, typography and selected states for ordinary layout grouping.

2. Repository source audit

The following findings are based on the current QCET source, not only the screenshots.

2.1 Canonical app shell

Current shell:

src/components/layout/app-shell.tsx

The shell currently owns:

AppSidebar

AppTopbar

MobileBottomNav

MobileMenuDrawer

CommandSearchModal

PWA/onboarding surfaces

central content width

Current main-content wrapper:

<div className="max-w-[1440px] w-full mx-auto px-3.5 sm:px-6">

Finding

A single max-w-[1440px] is currently shared by pages whose spatial needs differ.

For tasks:

Table benefits from a bounded readable width.

Kanban benefits from more horizontal room.

Required direction

Do not rewrite AppShell.

Add a controlled way for a route/workspace to request a wider/fluid canvas, or handle task-canvas width locally without breaking the shell contract.

Avoid hardcoding a second app shell.

2.2 Global top navigation

Current file:

src/components/layout/app-topbar.tsx

Current structure:

LEFT                        CENTER                        RIGHT
sidebar toggle              global search                notifications
breadcrumb                                                 PWA install
                                                           profile

Current topbar height:

h-[calc(52px+env(safe-area-inset-top,0px))]

Strengths to preserve

52 px desktop height is appropriate.

Global command/search launcher already exists.

⌘K / Ctrl+K already exists.

Level-1 breadcrumb suppression already exists.

Notification popover already exists.

Profile menu already exists.

PWA install already exists in the profile menu.

Source issue A — PWA install is duplicated

The source renders:

a top-level Smartphone action in the topbar, and

Cài đặt ứng dụng di động inside the profile dropdown.

The top-level PWA action is unnecessary daily chrome.

Source issue B — the center search is flex-centered, not structurally centered

Current topbar uses a left flex zone, center flex zone and right zone.

On level-1 routes such as:

/tasks

/calendar

/notifications

/org

TopbarBreadcrumbs returns null.

That makes the left zone much narrower than the right profile/action zone, so the search can feel visually offset even when the flex layout is technically valid.

Source issue C — notification is dot-only

Current topbar only renders a destructive dot when notifications > 0.

For an operations product, an unread/actionable count is often more informative.

Source issue D — profile trigger carries two text lines at XL

Current desktop trigger can show:

user name

role/department

This competes with the global search and increases right-side mass.

Source issue E — glass treatment is stronger than necessary

Current:

bg-background/80 backdrop-blur-md

The rest of the app already contains many bordered cards/popovers.

The topbar should become quieter.

2.3 Sidebar

Current file:

src/components/layout/app-sidebar.tsx

Navigation data source:

src/lib/navigation/canonical-navigation-registry.ts

Sidebar state:

src/components/layout/sidebar-context.tsx

Strengths to preserve

canonical registry exists,

active-route matcher exists,

collapsed state persists,

expanded width 248 px is reasonable,

collapsed width 64 px is reasonable,

tooltip behavior exists in collapsed state,

Settings is correctly placed in footer.

Source issue A — registry order and visual order diverge

Registry currently gives an order roughly equivalent to:

Bàn làm việc
Quản lý nhiệm vụ
Văn bản
Lịch
Tổ chức
Thông báo

But AppSidebar renders by SECTIONS first:

ĐIỀU HÀNH & CÁ NHÂN
NGHIỆP VỤ CỐT LÕI
HỆ THỐNG & TỔ CHỨC

Therefore the visible order becomes:

Bàn làm việc
Lịch công tác
Thông báo & Nhắc việc

Quản lý nhiệm vụ
Văn bản

Cơ cấu & Danh bạ

This places the core task-management destination lower than it should be even though the registry already assigns Tasks a low order value.

Source issue B — too many section headings for too few routes

There are approximately six main destinations but three uppercase sections.

This creates too much sidebar hierarchy.

Source issue C — task badge can fall back to total inventory

AppSidebar.getBadgeInfo() can use:

badgeCounts?.allTasks ?? badgeCounts?.tasks

for /tasks.

A total such as 156 is inventory information, not sidebar attention.

Source issue D — duplicate collapse affordance

There is:

sidebar toggle in the topbar, and

Thu gọn thanh bên in sidebar footer.

The footer control consumes an entire row for an action already globally available.

Source issue E — active state is over-specified

Expanded active item can combine:

colored background,

primary text,

stronger icon,

bold label,

left indicator,

subtle shadow.

Reduce to 2 clear signals.

Source issue F — Đang phát triển badge is visually large

Văn bản has a long amber badge.

A not-yet-usable feature should not compete with active destinations.

2.4 Mobile navigation must not be accidentally broken

Current:

src/components/navigation/mobile-bottom-nav.tsx

uses the canonical registry.

Current:

src/components/layout/mobile-menu-drawer.tsx

owns secondary mobile navigation plus mobile PWA/push settings.

Important constraint

Changes to canonical route order/placement can automatically affect MobileBottomNav.

Any desktop sidebar registry change MUST be verified on mobile.

Do not “fix desktop” by silently breaking bottom-nav order.

2.5 Tasks route and canonical workspace

Route:

src/app/tasks/page.tsx

Client:

src/app/tasks/tasks-page-client.tsx

Facade:

src/components/tasks/task-management-workspace.tsx

Canonical engine:

src/components/workspace/unified-adaptive-workspace.tsx

Strength

TaskManagementWorkspace is already a forwarding facade into UnifiedAdaptiveWorkspace.

Keep that architecture.

Do not build TasksWorkspaceV2.

Source issue — default view mode is Kanban at facade level

Current:

initialViewMode = "kanban"

in TaskManagementWorkspace.

For a school-wide inventory with 100+ tasks, Table/List is the stronger neutral default.

Explicit URL/Saved View/user choice must still win.

2.6 Unified task toolbar

Current:

src/components/dashboard/unified-task-toolbar.tsx

Current layout already has the right primitives:

Row 1:

Scope switcher                                        + Giao việc

Row 2:

Saved View       Search                 Bộ lọc      Hiển thị

This is substantially better than earlier QCET versions.

Source issue A — outer card is too heavy

Current root:

rounded-2xl border bg-card p-3 shadow-xs

The task toolbar becomes a raised card above another raised data surface.

Source issue B — Saved View default label is semantically misleading

Current workspace passes/defaults to:

Việc cần tôi xử lý

but the component is actually a SavedViewsSelector.

Its menu contains:

BGH presets,

manager presets,

staff presets,

custom saved views.

It should look and read as a view selector, not as an Inbox.

Source issue C — Action Queue is rendered separately below the toolbar

UnifiedAdaptiveWorkspace currently renders a separate trigger:

Hộp việc xử lý 6

between the toolbar and data canvas.

This causes three nearby concepts to compete:

Của tôi

Saved View Việc cần tôi xử lý

Hộp việc xử lý

Source issue D — scope selected states use three unrelated semantic colors

Current:

school = amber,

unit = blue,

my = emerald.

Scope is navigation/context, not task status.

Using three status-like colors makes scope look like a semantic severity dimension.

Source issue E — filter/display architecture is conceptually good

Do not undo this.

The source already separates:

Filter

Display

Preserve that and improve their contents.

2.7 Saved views

Current selector:

src/components/tasks/saved-views-selector.tsx

Store:

src/lib/saved-views/saved-views-store.ts

Current presets include:

Executive:

★ Chờ BGH duyệt
★ Trễ hạn toàn trường
★ Nhiệm vụ trọng tâm

Manager:

★ Chờ tôi duyệt
★ Việc đơn vị
★ Quá hạn đơn vị

Staff:

★ Việc của tôi
★ Hạn tuần này

Strength

This is exactly the right infrastructure to become a major workflow primitive.

Problem

The selector currently has a weak default label, and the decorative star is stored in preset names rather than represented as UI/favorite state.

Direction

Make Saved Views visibly mean:

reusable work perspectives

not:

another inbox.

P1 can expose pinned/favorite task views in the sidebar.

2.8 Table/List source findings

Canonical table:

src/components/tasks/table/modular-cascading-task-table.tsx

Rows:

src/components/tasks/table/components/task-row.tsx

Constants:

src/components/tasks/table/constants.ts

Date helpers:

src/components/tasks/table/utils/table-date-helpers.ts

Pagination:

src/components/tasks/table/components/task-pagination-bar.tsx

Bulk actions:

src/components/tasks/table/components/batch-action-bar.tsx

Source issue A — raw enum leaks

STATUS_BADGE_CONFIGS does not contain NOT_STARTED.

The fallback is:

label: typeof status === "string" ? status : "Chưa rõ"

Therefore the UI can show:

NOT_STARTED

This must be fixed.

Source issue B — normal due date is duplicated

TaskRow renders:

formatTableDate(task.dueDate)

then renders slaStatus.label.

But getSlaBadgeStatus() returns the same formatted date for ordinary future dates.

Result:

14/09/2026   [14/09/2026]

This is a confirmed source bug, not merely a visual opinion.

Source issue C — task code has excessive prominence

Task code currently renders as a filled bordered mono pill before the title.

For an operations inventory, title should lead.

Source issue D — progress is always rendered

Every row renders progress, including:

0%

100%

This adds repetitive low-value visual noise.

Source issue E — hard-coded slate palette remains

Task row and pagination still contain numerous slate-* utility classes instead of consistently using semantic project tokens.

Source issue F — persistent shortcut documentation strip

ModularCascadingTaskTable renders a full-width strip:

Phím tắt nhanh:
/
J K
Enter
X
Esc
⌘K

This is documentation permanently occupying the data canvas.

Strength — contextual bulk action already exists

TaskBulkActionBar already:

appears only when selection > 0,

floats at the bottom,

respects bulk capability filtering,

handles Escape.

Do not build another bulk toolbar.

Remove the persistent shortcut strip and let the existing contextual bulk surface do its job.

Source issue G — pagination wording is verbose

Current pagination says:

Hiển thị 1 - 10 trên tổng số 156 nhiệm vụ
Hiển thị: 10 / trang

This can be reduced without losing clarity.

2.9 Kanban source findings

Current:

src/components/tasks/task-kanban-board.tsx

Strengths

canonical four-column mapping exists,

raw statuses are projected into workflow columns,

completed/cancelled handling exists,

per-column counts exist,

mobile carousel exists,

task card action menu exists,

status transitions exist.

Source issue A — count notice adds another card-like surface

Current board starts with:

Bảng Kanban: 156 / 156 công việc

inside a rounded bordered notice.

This is chrome rather than work.

Source issue B — cards are too tall for high task volume

Current card can contain:

parent title,

title (up to 3 lines),

category + assignee,

deadline,

overdue badge,

progress label,

progress value,

progress bar.

Source issue C — 0% and 100% progress bars repeat useless information

Progress row renders whenever progressPercent !== undefined.

For:

new tasks at 0%,

completed tasks at 100%,

the board column already communicates the lifecycle state.

Source issue D — board columns internally show up to 30 cards before “show more”

The behavior is technically bounded, but 30 large cards × 4 columns still creates a visually heavy board.

The solution should primarily be card density + display preferences, not arbitrarily hide data.

3. Target information architecture

The redesign must establish this hierarchy.

Layer 1 — Global app shell

Global only:

Sidebar
Global topbar
Global command/search
Notifications
Account

No task filters in global shell.

No page-specific + Giao việc in topbar.

Layer 2 — Task page context

Task-specific:

Scope
Attention Queue
Primary task action
Saved View
Local Search
Filter
Display

Layer 3 — Task data canvas

Either:

List/Table

or:

Kanban

Both represent the same filtered task universe.

Layer 4 — Contextual actions

Only when relevant:

task detail sheet,

Action Queue drawer,

bulk action bar,

dropdown menus,

filter/display popovers.

4. Target desktop composition

┌────────────── SIDEBAR ──────────────┐ ┌──────────── GLOBAL TOPBAR ─────────────────────────────┐
│ CỔNG ĐIỀU HÀNH QCET                │ │ [sidebar]       [⌕ Tìm kiếm…              ⌘K]  🔔 3 [TT] │
│                                     │ └─────────────────────────────────────────────────────────┘
│ CÔNG VIỆC                           │
│ Bàn làm việc                        │    Toàn trường 156   Đơn vị 8   Của tôi 12       + Giao việc
│ Quản lý nhiệm vụ                    │
│ Lịch công tác                       │    Cần xử lý 6
│ Thông báo                           │
│ Văn bản                             │    Góc nhìn: Tất cả nhiệm vụ
│                                     │    ⌕ Tìm trong 156 nhiệm vụ…   Bộ lọc   Hiển thị
│ TỔ CHỨC                             │    ───────────────────────────────────────────────────────
│ Cơ cấu & Danh bạ                    │
│                                     │      NHIỆM VỤ          DRI          ĐƠN VỊ        HẠN
│ ĐÃ GHIM  (P1; only if non-empty)    │
│ Trễ hạn toàn trường            12   │      ▲ Báo cáo...       Nguyễn A     P.ĐT       Quá hạn 2d
│ Chờ BGH duyệt                   6   │      ◷ Duyệt hồ sơ     Nguyễn B     CNTT        Hôm nay
│                                     │      ○ Hoàn thiện...    Chưa giao    TCHC        16/09
│ ⚙ Cài đặt                           │
└─────────────────────────────────────┘

5. Global topbar target

Keep topbar approximately 52 px.

Level-1 route

[sidebar toggle]          [⌕ Tìm kiếm toàn hệ thống…  ⌘K]          [🔔 3] [TT ▾]

Deeper route/context

[sidebar] Nhiệm vụ › NV-2026-085    [⌕ Tìm kiếm… ⌘K]        [🔔 3] [TT ▾]

Rules:

no breadcrumb for ordinary /tasks,

max 2 visible breadcrumb levels in topbar,

detailed hierarchy can live inside content/detail surfaces,

no PWA install button in the top-level right actions,

no page-specific task action in topbar,

notification count represents unread/actionable state,

user role/department belongs in profile dropdown rather than persistent second line.

6. Sidebar target

Expanded

Two conceptual groups only:

CÔNG VIỆC

Bàn làm việc
Quản lý nhiệm vụ
Lịch công tác
Thông báo
Văn bản


TỔ CHỨC

Cơ cấu & Danh bạ

Footer:

Cài đặt

No permanent Thu gọn thanh bên footer row.

Use topbar toggle + keyboard shortcut.

Collapsed

Keep 64 px rail.

Use:

icon,

active state,

actionable badge,

tooltip.

Do not show total inventory badges.

7. Task toolbar target

Do not create a third toolbar implementation.

Refactor UnifiedTaskToolbar.

Row 1

[ Toàn trường 156 | Đơn vị 8 | Của tôi 12 ]  [ Cần xử lý 6 ]       [+ Giao việc]

Cần xử lý should open the existing Action Queue drawer.

It is not a scope.

It is not a saved view.

Row 2

[Góc nhìn: Tất cả nhiệm vụ ▾] [⌕ Tìm nhiệm vụ…] [Bộ lọc] [Hiển thị]

No extra outer raised card.

Use spacing/dividers instead.

8. Semantic definitions that agent must preserve

Scope

Dataset authority/context:

school

unit

my

Saved View

Durable query/presentation preset:

scope,

filter criteria,

layout,

density/order where appropriate.

Attention Queue

Tasks requiring an action, review, submission or intervention now.

It must not be named or styled as another scope.

Filter

Controls which tasks appear.

Display

Controls how currently visible tasks are presented.

Search

Task-local temporary refinement of the current view.

Global Search

Workspace-wide command/search launcher.

9. Implementation phases

Phase 0 — Baseline, tests, and change isolation

Task 0.1 — Read repository rules first

Before coding, agent must inspect repository instructions that apply to:

core architecture,

UI,

mobile,

authorization,

testing,

accessibility.

Do not rely solely on this plan if source rules have changed.

Task 0.2 — Read all affected source files

Minimum:

src/components/layout/app-shell.tsx
src/components/layout/app-sidebar.tsx
src/components/layout/app-topbar.tsx
src/components/layout/sidebar-context.tsx
src/lib/navigation/canonical-navigation-registry.ts
src/components/navigation/mobile-bottom-nav.tsx
src/components/layout/mobile-menu-drawer.tsx

src/app/tasks/page.tsx
src/app/tasks/tasks-page-client.tsx
src/components/tasks/task-management-workspace.tsx
src/components/workspace/unified-adaptive-workspace.tsx

src/components/dashboard/unified-task-toolbar.tsx
src/components/tasks/saved-views-selector.tsx
src/lib/saved-views/saved-views-store.ts

src/components/tasks/table/modular-cascading-task-table.tsx
src/components/tasks/table/components/task-row.tsx
src/components/tasks/table/components/task-table-header.tsx
src/components/tasks/table/components/task-pagination-bar.tsx
src/components/tasks/table/components/batch-action-bar.tsx
src/components/tasks/table/constants.ts
src/components/tasks/table/utils/table-date-helpers.ts

src/components/tasks/task-kanban-board.tsx

Task 0.3 — Capture baseline

Desktop:

/tasks?scope=school&view=table
/tasks?scope=school&view=kanban

At:

1440x900

Also capture:

1280x800

Mobile:

390x844

Capture these states:

default task page,

Saved View popover,

Filter popover,

Display popover,

row selected,

bulk action bar,

Kanban,

profile dropdown,

collapsed sidebar.

Task 0.4 — Run existing focused tests

At minimum inspect/run:

tests/unified-task-toolbar.test.ts

Search repository for tests covering:

sidebar,

topbar,

canonical navigation registry,

mobile bottom navigation,

task table,

Kanban,

saved views,

keyboard navigation,

bulk lifecycle actions.

Do not invent duplicate tests if an existing test file already owns the contract.

Record baseline failures before code changes.

Phase 1 — Navigation registry and sidebar consolidation

Primary files:

src/lib/navigation/canonical-navigation-registry.ts
src/components/layout/app-sidebar.tsx
src/components/layout/sidebar-context.tsx

Task 1.1 — Define one canonical visible desktop order

Target desktop order:

1 Bàn làm việc
2 Quản lý nhiệm vụ
3 Lịch công tác
4 Thông báo & Nhắc việc
5 Văn bản & Công văn
6 Cơ cấu & Danh bạ

Settings remains footer-only.

Important

Because the same registry feeds mobile navigation, validate all mobile placement/order before committing.

Do not create a second hard-coded desktop array just to obtain this order.

The canonical registry remains authoritative.

Task 1.2 — Reduce sidebar sections

Target:

CÔNG VIỆC
TỔ CHỨC

Do not render an empty personal section merely for backwards compatibility.

Prefer a compatibility-preserving registry migration over parallel data.

Possible migration:

keep section type compatibility if other code imports it,

map active primary routes into one workspace visual group,

keep operations for org/settings,

update sidebar section labels/loop accordingly.

If changing the type union causes broad unrelated churn, introduce a canonical presentation-group resolver in the navigation registry itself — not in AppSidebar.

Task 1.3 — Replace task total badge semantics

Do not render allTasks/total inventory as the task nav badge.

Trace where setBadgeCounts is populated.

Introduce or reuse an actionable count such as:

taskAttention

or canonical equivalent.

Definition must be explicit and testable.

Examples of valid badge semantics:

tasks waiting for current user approval,

current user's overdue/action-required work,

unresolved action queue count.

Do not invent a number from total task count.

Task 1.4 — Reduce active style

Choose two signals:

Recommended:

subtle selected background
+ stronger text/icon

Remove either:

left blue rail,

or shadow,

so active nav is not emphasized five ways.

Task 1.5 — Remove footer collapse duplicate

Remove expanded footer:

Thu gọn thanh bên   ⌘B

Keep:

topbar sidebar-toggle button,

collapsed/expanded persisted state,

keyboard support.

Do not remove the ability to expand a collapsed sidebar.

Task 1.6 — Normalize shortcut copy

Current code implements Cmd/Ctrl+B in handleSidebarShortcut.

Topbar copy references [ in addition to Ctrl+B.

Choose one supported contract and make UI/tests match implementation.

Lowest-risk P0:

Cmd/Ctrl+B

Do not add [ unless product intentionally wants it and collision testing is done.

Task 1.7 — Reduce coming-soon prominence

For Văn bản:

do not render a long amber Đang phát triển chip in the normal sidebar row,

use a subtle indicator/dot or compact Sắp có,

preserve accessible description/tooltip.

Do not make an unavailable feature visually louder than an active route.

Phase 2 — Global topbar simplification

Primary:

src/components/layout/app-topbar.tsx

Task 2.1 — Keep 52 px height

Do not redesign height without a measured need.

Task 2.2 — Convert desktop inner layout to true three-zone grid

Current flex layout can visually offset search.

Target conceptual structure:

left: minmax(0, 1fr)
center: bounded search launcher
right: minmax(0, 1fr)

Example direction:

<div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(280px,384px)_minmax(0,1fr)] items-center">

Exact values may adapt after visual testing.

Left:

sidebar toggle,

deep breadcrumb only.

Center:

global command search launcher.

Right:

notifications,

account.

Use justify-self-end for right actions.

At narrower widths, switch to the existing compact/mobile pattern.

Task 2.3 — Keep level-1 breadcrumb suppression

The existing LEVEL_1_ROOTS behavior is correct.

Do not reintroduce:

Quản lý nhiệm vụ › Quản lý nhiệm vụ

For deep task context:

Nhiệm vụ › <task code or compact task title>

Maximum 2 visible levels in topbar.

Task 2.4 — Remove top-level PWA install button

Delete only the topbar Smartphone action.

Preserve:

profile-menu install action,

mobile drawer install path,

install modal event infrastructure.

This is removal of duplicate chrome, not removal of the PWA capability.

Task 2.5 — Compact profile trigger

Desktop target:

avatar,

optional one-line short name on wide screens,

chevron.

Move persistent role/department second line into dropdown.

Preserve offline/read-only visibility; if read-only state is operationally critical, keep a compact explicit indicator.

Task 2.6 — Improve notification badge

Current dot-only behavior may become:

1–9 -> number
>=10 -> 9+
0 -> hidden

Only do this if badgeCounts.notifications is semantically unread/actionable.

If the current number is not reliable, keep dot until data semantics are fixed.

Data correctness beats visual count.

Task 2.7 — Quiet the topbar surface

Replace strong glass feel with a flatter shell.

Direction:

bg-background/95
border-b
little/no desktop blur
no drop shadow

Keep overlay effects for popovers.

Phase 3 — Task toolbar information architecture

Primary:

src/components/dashboard/unified-task-toolbar.tsx

Integration:

src/components/workspace/unified-adaptive-workspace.tsx

Task 3.1 — Flatten the toolbar root

Current:

rounded-2xl border bg-card p-3 shadow-xs

Target:

no raised-card impression,

no standalone shadow,

use bottom divider or subtle border,

maintain internal spacing.

Example direction:

border-b border-border/60
pb-3

or a flat default surface.

Do not remove grouping entirely; remove elevation overload.

Task 3.2 — Normalize scope visuals

Scope is context, not severity.

Remove permanent:

amber school,

blue unit,

emerald my.

Use a neutral segmented control.

Selected state:

bg-card / bg-muted
text-foreground
selected border

Count remains tabular.

Authorized scope logic stays unchanged.

Task 3.3 — Move Action Queue trigger into Row 1

Current trigger is rendered as a separate row below toolbar.

Integrate into Row 1:

[scope] [Cần xử lý 6]                         [+ Giao việc]

Use the existing action queue data/handler.

Rename visible trigger from:

Hộp việc xử lý

to:

Cần xử lý

Drawer title can remain:

Hàng đợi xử lý công việc

if that terminology is canonical.

Must preserve

same underlying action queue,

same permissions,

same drawer,

same task actions.

Do not create an alternative attention query engine.

Task 3.4 — Fix Saved View default label

Change:

Việc cần tôi xử lý

to something semantically exact:

Góc nhìn: Tất cả nhiệm vụ

When active:

Góc nhìn: Trễ hạn toàn trường

Do not let this control read like a second inbox.

Task 3.5 — Keep local task search

Search stays in Row 2.

Default:

Tìm nhiệm vụ…

When a saved view is active, optional contextual placeholder:

Tìm trong góc nhìn này…

Do not remove / shortcut.

Do not confuse with global ⌘K search.

Task 3.6 — Preserve Filter vs Display separation

Filter should answer:

Which tasks are included?

Display should answer:

How are those tasks arranged/rendered?

Do not merge them.

Task 3.7 — Display options structure

P0:

Bố cục
  Bảng
  Kanban

Mật độ
  Gọn
  Chuẩn

P1:

Nhóm theo
  Không
  Trạng thái
  Đơn vị
  Người phụ trách

Thuộc tính
  Người phụ trách
  Đơn vị
  Hạn
  Trạng thái
  Mã nhiệm vụ
  Tiến độ

Do not put task filters under Display.

Phase 4 — Make List/Table the safe default

Files:

src/components/tasks/task-management-workspace.tsx
src/components/workspace/unified-adaptive-workspace.tsx
src/hooks/use-workspace-query.ts (if needed)

Task 4.1 — Default to Table when no explicit preference exists

Current facade:

initialViewMode = "kanban"

Change neutral default to:

"table"

Precedence must remain

explicit URL view,

active Saved View layout,

persisted valid user preference if repository already has one,

default table.

Do not override an explicit ?view=kanban.

Task 4.2 — Preserve List/Kanban dataset parity

Switching layout must not silently change filters.

The same Saved View/filter state should feed both.

Do not silently remove completed tasks only in Kanban unless this is an explicit Display option.

Phase 5 — Saved Views as workflow navigation

Files:

src/components/tasks/saved-views-selector.tsx
src/lib/saved-views/saved-views-store.ts

Task 5.1 — Remove decorative star from presentation

Preset names currently include ★.

Preferred migration:

store/display a clean name,

use a Lucide icon if favorite/preset semantics need an icon.

Do not use decorative unicode star as the only indicator.

Because findPresetByName() already strips leading stars for comparison, maintain backwards compatibility for old names/URLs.

Add tests for both old starred aliases and clean names.

Task 5.2 — Make selector header semantics explicit

Header:

Góc nhìn nhiệm vụ

Sections:

Mặc định cho vai trò
Góc nhìn tùy chỉnh

Keep save/rename/delete behavior.

Task 5.3 — P1 sidebar favorites

Linear favorites are a useful reference, but QCET should reuse its own saved-view infrastructure.

Add a user-local pin/favorite flag only if it can be implemented without a new server domain.

Target sidebar section only when non-empty:

ĐÃ GHIM

Trễ hạn toàn trường   12
Chờ BGH duyệt          6

Important

This is P1.

Do not block P0 cleanup on persistence for favorites.

If there is no clean existing preference store, defer this feature rather than adding an ad-hoc persistence system.

Phase 6 — Table attention-first remediation

Files:

src/components/tasks/table/constants.ts
src/components/tasks/table/components/task-row.tsx
src/components/tasks/table/utils/table-date-helpers.ts

Task 6.1 — Fix all user-visible task status labels

Add mappings for at least all currently reachable canonical statuses:

NOT_STARTED               → Chưa bắt đầu
NEW                       → Mới
IN_PROGRESS               → Đang thực hiện
WAITING_APPROVAL          → Chờ phê duyệt
PENDING_EXECUTIVE_APPROVAL→ Chờ BGH duyệt
NEEDS_REVIEW              → Cần chỉnh sửa
BLOCKED                   → Bị chặn / Tạm dừng (use canonical Vietnamese terminology)
COMPLETED                 → Hoàn thành
OVERDUE                   → Quá hạn
CANCELLED                 → Đã hủy

Fallback must not dump internal enum directly.

Safe fallback:

Chưa xác định

Log/telemetry can retain raw value separately if needed.

Add regression test that NOT_STARTED never appears in rendered task row HTML.

Task 6.2 — Fix duplicated deadline

Current ordinary future date:

14/09/2026 [14/09/2026]

Change rendering contract.

Recommended behavior:

Normal future date > 3 days

14/09/2026

single value only.

Due soon

14/09/2026
Còn 2 ngày

or compact inline semantic label.

Today

14/09/2026
Hôm nay

Overdue

12/09/2026
Quá hạn 2 ngày

Completed

Do not add a duplicate “Đã hoàn thành” SLA chip when a dedicated status column already says Hoàn thành unless historical completion timing is meaningful.

Update getSlaBadgeStatus() contract or TaskRow rendering so a normal SLA label can be null.

Do not solve with CSS hiding of duplicate text.

Task 6.3 — De-emphasize task code

Current code pill competes with title.

P0 target:

Task title                         primary
NV-2026-09-085                    secondary mono

or a lighter inline mono identifier.

Do not delete task code.

In compact density, code may be hidden or only shown on hover/detail if product requirements allow.

Task 6.4 — Add attention signal

Use a small non-color-only indicator for:

overdue,

waiting/review,

due today.

Do not turn the entire row red/orange.

The title remains primary.

Task 6.5 — Reduce progress noise

P0:

progress 0%: no prominent progress bar,

progress 100% on completed: no redundant progress bar,

1–99%: compact progress may remain.

If progress is operationally required in every row, show numeric value without a colored bar at 0/100.

P1 Display properties can allow explicit show/hide.

Task 6.6 — Convert hardcoded slate UI to semantic tokens

Replace presentation-only hardcoded:

slate-*
white

where practical with:

bg-background
bg-card
bg-muted
border-border
text-foreground
text-muted-foreground

Do not change semantic state colors blindly.

Phase 7 — Kanban density redesign

File:

src/components/tasks/task-kanban-board.tsx

Task 7.1 — Remove card-like count notice

Replace:

[Bảng Kanban: 156 / 156 công việc]

with a flat, compact summary:

Kanban · 156 nhiệm vụ

or integrate count into toolbar/view context.

The board should begin visually with columns, not another card.

Task 7.2 — Compact card hierarchy

Target card:

Kiểm tra toàn vẹn quan hệ TaskActor

Chưa phân công
14/09 · Cấp trường

For attention:

▲ Quá hạn 2 ngày

For partial progress:

65%  ━━━━━━━

Rules:

title max 2 lines by default,

assignee stays visible,

deadline/attention stays visible,

category/parent metadata only when useful,

no default 3-line title plus four metadata rows.

Task 7.3 — Suppress redundant progress

Render progress bar by default only when:

0 < progress < 100

For 0%:

column/state is enough.

For 100% in Completed:

column/state is enough.

If a 100% task is not completed, show the value because it signals lifecycle inconsistency.

Task 7.4 — Preserve zero-silent-loss contract

Do not hide tasks just to make Kanban prettier.

Current count/excluded logic should remain testable.

If completed column is collapsed by default later, count/data must remain accessible.

Task 7.5 — Optional P1 card property controls

Use Display Options to choose:

Assignee
Unit
Deadline
Progress
Parent task

Do not implement a separate Kanban-only filter engine.

Phase 8 — Remove persistent shortcut documentation

File:

src/components/tasks/table/modular-cascading-task-table.tsx

Task 8.1 — Delete persistent full-width shortcut strip

Remove the rendered desktop strip:

Phím tắt nhanh: / J K Enter X Esc ⌘K

Do not remove the actual keyboard functionality.

Task 8.2 — Add lightweight discoverability

Preferred:

? Phím tắt

near pagination/footer or inside a Help/command surface.

Click opens compact shortcut help.

If a global shortcut-help system already exists, reuse it.

Do not create a second shortcut modal if the app already has one.

Task 8.3 — Keep contextual bulk toolbar

Existing TaskBulkActionBar is already the correct pattern.

Improve only visual token consistency if needed.

Do not replace it.

Phase 9 — Pagination cleanup

File:

src/components/tasks/table/components/task-pagination-bar.tsx

Current:

Hiển thị 1 - 10 trên tổng số 156 nhiệm vụ
Hiển thị: 10 / trang

Target desktop:

1–10 / 156      [10 / trang]                      ‹ 1 2 … 16 ›

Keep accessible labels.

Keep first/last controls only if product testing shows they remain useful.

P0 can retain first/last while simplifying copy.

Convert hardcoded slate/white presentation to semantic tokens.

Phase 10 — Task canvas width behavior

Files:

src/components/layout/app-shell.tsx
src/components/workspace/unified-adaptive-workspace.tsx

Do not globally widen every page.

Table

Keep readable bounded width.

Current global max 1440 may remain suitable.

Kanban

Allow wider/fluid task canvas on large screens where safe.

Possible approaches:

route/workspace-level breakout within main content,

AppShell-supported contentMode,

CSS custom property/context already present in repository.

Choose the smallest architecture that avoids hacks.

Do not use negative-margin “escape the shell” code unless repository already standardizes it.

Phase 11 — Mobile and responsive verification

This plan is desktop-driven because screenshots are desktop, but implementation must preserve mobile.

Topbar mobile

Keep:

mobile search icon,

notification,

account/menu trigger.

Removing desktop PWA icon must not remove mobile PWA installation from MobileMenuDrawer.

Task toolbar mobile

Do not force all Row 1/Row 2 controls into one horizontal line.

Recommended:

Scope horizontally scrollable/segmented,

primary action reachable,

local search full width,

Filter + Display touch-safe,

44 px primary touch targets.

Table mobile

Continue card/feed behavior.

Do not render desktop columns into mobile.

Kanban mobile

Preserve stage carousel/tabs.

Compact cards should improve mobile density as well.

Registry validation

After sidebar order changes, verify MobileBottomNav order produced by:

getMobileBottomBarItems().

No duplicate route owner.

10. Test plan

Tests must validate product semantics, not only source strings.

Reuse current files where they own the behavior.

Create new test files only where no clear existing owner exists.

10.1 Update tests/unified-task-toolbar.test.ts

Current test explicitly expects:

Việc cần tôi xử lý

as the Saved View trigger.

Replace with intended contract:

Góc nhìn

or exact approved label.

Add assertions:

scope remains role-authorized,

scope selected state is neutral (avoid hardcoding exact colors if possible),

Search exists,

Filter exists,

Display exists,

no permanent smart-filter rail,

Action Queue trigger is integrated at toolbar/workspace level,

no duplicate external Hộp việc xử lý trigger below toolbar,

default layout preference semantics remain correct.

Do not weaken security/scope tests.

10.2 Add/update topbar regression tests

Test contracts:

level-1 /tasks has no redundant breadcrumb,

deep task context can render breadcrumb,

global search launcher remains,

⌘K label remains,

no top-level PWA install button,

profile menu still contains install action,

notifications accessible,

account accessible,

no task-specific Giao việc in global topbar.

10.3 Add/update navigation registry/sidebar tests

Test:

canonical desktop order,

only intended desktop visual groups,

tasks immediately follows workbench,

total task inventory does not become sidebar badge,

collapsed sidebar retains tooltips/accessibility,

Settings remains footer,

one collapse affordance in visible desktop shell,

canonical registry still drives MobileBottomNav.

10.4 Task status regression tests

Add:

NOT_STARTED → Chưa bắt đầu

Ensure no known raw enum is exposed.

Test fallback label does not equal raw unknown enum.

10.5 Deadline presentation tests

Cases:

normal date > 3 days:

one date,

no duplicate badge.

due today:

date + Hôm nay.

tomorrow:

date + Ngày mai.

due in 2 days:

date + Còn 2 ngày.

overdue:

date + Quá hạn N ngày.

completed:

never marked overdue.

cancelled:

never marked overdue.

Use canonical reference date injection.

10.6 Task-row hierarchy tests

Test:

title remains present,

code remains accessible but not rendered as primary status signal,

progress 0 does not produce redundant high-emphasis progress UI,

completed 100 does not show redundant progress bar,

partial progress does show useful progress,

waiting task exposes action semantics.

Avoid snapshot tests of every Tailwind class.

10.7 Kanban tests

Existing mapping tests must remain.

Add:

0% progress card suppresses progress bar,

100% completed suppresses progress bar,

65% shows progress,

overdue text is not color-only,

all active statuses still map to a visible canonical column,

cancelled/archived exclusion remains explicit,

count integrity remains.

10.8 Shortcut/bulk tests

Test:

keyboard navigation hook still works,

persistent shortcut strip is absent,

shortcut help trigger exists if implemented,

bulk action bar remains hidden at selection=0,

appears at selection>0,

Escape clears selection,

capability-gated lifecycle options remain fail-safe.

Do not weaken bulk authorization tests.

10.9 Pagination tests

Preserve:

page number math,

ellipsis,

page-size changes,

disabled first/previous/next/last behavior.

Presentation test may assert compact count copy.

11. Accessibility requirements

Global shell

all icon-only actions require accessible names,

topbar keyboard focus visible,

notification count announced meaningfully,

sidebar active item uses aria-current="page".

Scope

Use actual tab semantics only if keyboard/tab behavior satisfies the tab contract.

If not, use pressed/segmented buttons.

Popovers

Escape closes,

outside click closes,

focus remains discoverable,

trigger exposes expanded state.

Table

Current interactive rows have keyboard behavior.

Preserve:

Enter/Space details,

selection accessibility,

visible focus,

non-color attention labels.

Kanban

Card remains keyboard reachable if intended as interactive.

Do not rely on drag as the only way to change status.

Mobile

Primary targets >= 44 px.

12. Visual system requirements

Follow current QCET project rules.

Use

Tailwind CSS v4,

light-only,

project semantic tokens,

Lucide,

strokeWidth={1.5},

font-mono tabular-nums for codes/counts/dates only,

subtle 1px dividers,

elevation for overlays only.

Avoid

new gradients,

decorative glass panels,

excessive nested cards,

shadows on every container,

large rounded pills for every property,

emojis as control semantics,

raw backend enums,

status color without text/icon.

13. File ownership / expected changes

Likely P0/P1 files:

src/lib/navigation/canonical-navigation-registry.ts

src/components/layout/app-sidebar.tsx
src/components/layout/app-topbar.tsx
src/components/layout/sidebar-context.tsx
src/components/layout/app-shell.tsx               # only if content width contract requires

src/components/dashboard/unified-task-toolbar.tsx
src/components/workspace/unified-adaptive-workspace.tsx
src/components/tasks/task-management-workspace.tsx

src/components/tasks/saved-views-selector.tsx
src/lib/saved-views/saved-views-store.ts

src/components/tasks/table/constants.ts
src/components/tasks/table/utils/table-date-helpers.ts
src/components/tasks/table/components/task-row.tsx
src/components/tasks/table/components/task-pagination-bar.tsx
src/components/tasks/table/modular-cascading-task-table.tsx
src/components/tasks/table/components/batch-action-bar.tsx

src/components/tasks/task-kanban-board.tsx

Files to verify but avoid unnecessary modifications:

src/components/navigation/mobile-bottom-nav.tsx
src/components/layout/mobile-menu-drawer.tsx
src/app/tasks/page.tsx
src/app/tasks/tasks-page-client.tsx

14. Parallel agent execution plan

Do not run multiple agents against the same large file concurrently.

Wave A — independent contracts

Agent A1 — Shell/navigation

Own:

src/lib/navigation/canonical-navigation-registry.ts
src/components/layout/app-sidebar.tsx
src/components/layout/sidebar-context.tsx

Tasks:

route order,

group simplification,

badge semantic contract,

active state simplification,

collapse duplication.

Do not edit app-topbar.tsx.

Agent A2 — Topbar

Own:

src/components/layout/app-topbar.tsx

Tasks:

3-zone layout,

remove top PWA action,

compact profile,

breadcrumb behavior,

notification badge presentation.

Do not edit Sidebar files.

Agent A3 — Table semantics

Own:

src/components/tasks/table/constants.ts
src/components/tasks/table/utils/table-date-helpers.ts
src/components/tasks/table/components/task-row.tsx

Tasks:

raw enum localization,

deadline duplication,

task-code hierarchy,

progress noise,

semantic token cleanup.

Agent A4 — Kanban density

Own:

src/components/tasks/task-kanban-board.tsx

Tasks:

card density,

progress suppression,

flat count summary,

no data loss.

Agent A5 — Test contracts

Own new/isolated test files and prepare failing intended-behavior tests.

Do not simultaneously edit tests/unified-task-toolbar.test.ts if Toolbar agent is editing it unless branch ownership is explicit.

Merge checkpoint A

Merge helper/presentation work.

Run:

focused tests,

typecheck for changed contracts.

Resolve any canonical route/mobile order impact before proceeding.

Wave B — Task toolbar and saved views

Agent B1 — Toolbar

Own:

src/components/dashboard/unified-task-toolbar.tsx

Tasks:

flatten root,

neutral scope,

Saved View label,

Row 1/Row 2 composition.

Agent B2 — Saved Views

Own:

src/components/tasks/saved-views-selector.tsx
src/lib/saved-views/saved-views-store.ts

Tasks:

clean preset presentation,

backwards compatibility,

future favorite contract.

Agent B3 — Table footer ergonomics

Own:

src/components/tasks/table/modular-cascading-task-table.tsx
src/components/tasks/table/components/task-pagination-bar.tsx
src/components/tasks/table/components/batch-action-bar.tsx

Tasks:

remove persistent shortcut strip,

compact pagination,

preserve bulk action bar.

Wave C — serial workspace integration

One agent only.

Own:

src/components/workspace/unified-adaptive-workspace.tsx
src/components/tasks/task-management-workspace.tsx
src/app/tasks/tasks-page-client.tsx (only if required)
src/components/layout/app-shell.tsx (only if required)

Tasks:

move Attention Queue trigger into toolbar contract,

remove old standalone trigger,

default Table safely,

preserve URL Saved View precedence,

optional Kanban width mode,

reconcile props across components.

Do not let several agents edit UnifiedAdaptiveWorkspace at once.

Wave D — P1 optional enhancements

Only after P0 verification.

pinned Saved Views in sidebar,

display-property chooser,

grouping options,

personal display preferences,

wider Kanban canvas if not already done.

15. Priority breakdown

P0 — required

Task becomes second primary desktop destination after Workbench.

Sidebar reduces to two meaningful visual groups.

Task sidebar badge no longer shows total inventory.

Duplicate sidebar collapse row removed.

Top-level PWA install icon removed from topbar.

PWA install remains available in profile/mobile drawer.

Global search is structurally centered.

Level-1 breadcrumbs remain suppressed.

Toolbar is flattened.

Scope uses neutral selected states.

Saved View no longer defaults to Việc cần tôi xử lý.

Action Queue becomes Cần xử lý N and is integrated into task toolbar hierarchy.

Default task layout is Table when no explicit preference exists.

NOT_STARTED and known enums are localized.

deadline duplicate date is fixed.

task code is de-emphasized.

redundant 0%/100% progress treatment is reduced.

persistent shortcut strip removed.

existing floating bulk toolbar preserved.

Kanban cards compacted.

Kanban count card flattened.

pagination copy compacted.

P1 — valuable

Display property visibility.

Grouping in Display Options.

pinned/favorite Saved Views in sidebar.

notification numeric badge if data semantics proven.

contextual shortcut-help popover.

fluid Kanban width.

compact sticky task toolbar while scrolling.

P2 — later

user-customizable sidebar reorder/hide.

Kanban swimlanes.

drag/drop status changes with full authorization.

persisted personal column/property layouts.

richer global recents/history navigation.

16. Sticky task toolbar — P1 design

Do not implement before P0 composition is clean.

When at page top:

Scope / Attention / Create
Saved View / Search / Filter / Display

When the data canvas scrolls:

Scope     Search...     Filter     Display     + Giao việc

Requirements:

must sit below the 52px global topbar,

must not obscure table header,

must account for OfflineBanner if visible,

must not stack 3 sticky bars with ambiguous z-index,

use border/solid surface rather than heavy shadow.

Table header can be sticky only after offsets are verified.

17. Do NOT do these things

Do not create another task workspace.

Do not create a second navigation registry.

Do not move + Giao việc into global topbar.

Do not put Filter/View/Scope into global topbar.

Do not remove global command search.

Do not remove PWA support; only remove duplicate top-level icon.

Do not use total task count as sidebar urgency.

Do not invent attention counts.

Do not silently filter different datasets in List vs Kanban.

Do not hide tasks to make Kanban prettier.

Do not replace all statuses with color only.

Do not leak raw enums.

Do not add Framer Motion for this remediation.

Do not add another state-management library.

Do not add a second preference persistence layer without proving it is needed.

Do not rewrite AppShell.

Do not break mobile registry parity.

Do not weaken bulk lifecycle authorization.

Do not weaken scope authorization.

Do not preserve tests that encode known bad UX purely to keep them green.

Do not refactor unrelated calendar/documents/org pages in this branch.

18. Verification sequence

Run verification progressively.

Gate 1 — focused unit/presentation tests

navigation registry,

Saved Views,

toolbar,

date helpers,

status labels,

Kanban projection.

Gate 2 — task interaction tests

scope,

URL state,

row selection,

keyboard navigation,

task detail,

bulk capability.

Gate 3 — mobile navigation tests

Verify canonical registry changes did not reorder/hide invalid mobile destinations.

Gate 4 — typecheck

npm run typecheck

Gate 5 — lint

npm run lint

Gate 6 — full tests

npm test

Gate 7 — visual captures

Desktop:

1440x900
1280x800

States:

/tasks?scope=school&view=table
/tasks?scope=school&view=kanban
saved-view popover
filter popover
display popover
profile popover
collapsed sidebar
selected rows + bulk toolbar

Mobile:

390x844

Gate 8 — production build

Run only according to repository build/cache rules.

Do not corrupt an active dev .next cache.

19. Visual review checklist

A reviewer should be able to answer “yes” to all:

App shell

Main content is visually more prominent than navigation.

Topbar feels almost invisible until needed.

Search is clearly global.

PWA install is no longer daily chrome.

Sidebar can be scanned in under 2 seconds.

Tasks is a primary destination.

No inventory badge looks like an urgent badge.

Toolbar

Scope is obviously scope.

Saved View is obviously Saved View.

Cần xử lý is obviously an attention queue.

Filter and Display are visually distinct concepts.

Search is local to tasks.

Primary action is unique.

Table

Title leads the row.

Internal ID does not dominate.

Raw enums never appear.

Deadline is not duplicated.

Overdue/review/today are easy to scan.

Completed items have lower visual priority.

0%/100% progress does not form visual noise.

No permanent keyboard manual competes with data.

Kanban

Columns are the first thing noticed.

Cards are compact.

Deadline and owner are easy to scan.

Attention is obvious without full-card color.

0%/100% progress is not repeated on every card.

No task is silently lost.

Board remains usable with large school scope.

20. Definition of Done

The implementation is done only when:

/tasks still uses the current canonical task engine.

Server authority and scope authorization are unchanged or stronger.

Global topbar contains global actions only.

Sidebar hierarchy is simpler.

Task toolbar concepts have unambiguous semantic roles.

Table is the neutral default unless a user explicitly requests/saves Kanban.

Known statuses are fully localized.

Deadline duplication is gone.

Table and Kanban show the same filtered dataset.

Kanban cards are materially denser.

Persistent shortcut documentation is gone.

Contextual bulk actions still work.

Mobile navigation still derives from canonical registry correctly.

Focused tests, typecheck, lint and full tests pass.

Visual captures show a substantive hierarchy improvement, not merely new colors/radius.

If the finished screen still mainly differs through:

radius,

border color,

shadow,

icon size,

spacing,

while Scope/Saved View/Attention/Filter/Display remain semantically confusing, the remediation is not complete.

21. Copy-paste execution prompt for the coding agent

Thực thi file kế hoạch “QCET WORK — Task Management + App Shell UX Consolidation Plan” trực tiếp trên source hiện tại.

Không dừng ở tóm tắt hoặc viết lại plan.

BẮT BUỘC TRƯỚC KHI SỬA:
1. Đọc repository instructions/rules liên quan core architecture, UI, mobile, auth, testing.
2. Đọc toàn bộ plan.
3. Rà soát lại tất cả file được plan tham chiếu.
4. Rà soát git diff/worktree để không ghi đè thay đổi người dùng hoặc agent khác.
5. Tìm test hiện có trước khi tạo test mới.
6. Xác định task nào source hiện tại đã hoàn thành, task nào còn thiếu, task nào cần điều chỉnh vì code đã đổi.

MỤC TIÊU:
- Giảm chrome và control overload trên /tasks.
- Làm rõ Global shell vs Page controls.
- Làm rõ Scope vs Saved View vs Attention Queue vs Filter vs Display.
- Table attention-first.
- Kanban compact nhưng zero-silent-loss.
- Không rewrite.

KIẾN TRÚC BẮT BUỘC:
- Giữ TaskManagementWorkspace -> UnifiedAdaptiveWorkspace là canonical task engine.
- Giữ canonical-navigation-registry là navigation SSoT.
- Không tạo TasksWorkspaceV2.
- Không tạo navigation registry thứ hai.
- Server truth wins.
- Role != scope.
- Không weaken authorization.
- List và Kanban phải dùng cùng filtered dataset.
- Không invent badge/attention counts.
- Không expose raw status enum.
- Mobile navigation phải được verify sau mọi thay đổi registry.

THỨ TỰ:
Wave A:
- Sidebar/navigation registry.
- Topbar.
- Table semantic helpers/rows.
- Kanban card density.
Các agent phải có file ownership riêng.

Checkpoint A:
- merge,
- focused tests,
- typecheck contracts.

Wave B:
- UnifiedTaskToolbar.
- SavedViews.
- Table footer/shortcut/pagination.

Wave C — SERIAL, một agent:
- UnifiedAdaptiveWorkspace integration.
- Move Action Queue trigger into toolbar hierarchy.
- Remove old standalone trigger.
- Set safe default Table respecting URL/Saved View precedence.
- AppShell width adjustment only if actually needed.

P0 BẮT BUỘC:
- Tasks ngay sau Bàn làm việc trong desktop nav.
- Sidebar chỉ còn hierarchy cần thiết.
- Không dùng total task inventory làm sidebar urgency badge.
- Xóa duplicate collapse footer.
- Xóa top-level PWA icon nhưng giữ PWA trong profile/mobile drawer.
- Global search structurally centered.
- Không breadcrumb level-1.
- Toolbar flat hơn.
- Scope neutral, không amber/blue/green như trạng thái.
- Saved View label rõ “Góc nhìn”.
- “Hộp việc xử lý” chuyển semantic thành “Cần xử lý N” trong toolbar, reuse drawer hiện tại.
- Default Table nếu không có explicit view preference.
- NOT_STARTED -> Chưa bắt đầu.
- Không raw enum fallback.
- Fix deadline đang render 14/09/2026 + badge 14/09/2026.
- De-emphasize task code.
- Reduce redundant 0%/100% progress.
- Remove persistent keyboard hints strip.
- Preserve existing contextual TaskBulkActionBar.
- Compact Kanban card.
- Flatten Kanban count notice.
- Compact pagination copy.

KHÔNG ĐƯỢC:
- Không đưa + Giao việc lên global topbar.
- Không đưa page Filter/Display/Scope lên global topbar.
- Không xóa PWA capability.
- Không silently hide tasks trong Kanban.
- Không refactor unrelated routes.
- Không thêm motion/dependency mới.
- Không thay đổi backend/domain chỉ để polish UI.
- Không tự merge main.

TDD / VERIFICATION:
- Cập nhật tests đang encode UX cũ sang contract mới; không relax test vô nghĩa.
- Thêm regression cho raw enum và duplicate deadline.
- Giữ bulk authorization tests.
- Chạy focused tests sau từng wave.
- Sau cùng: typecheck, lint, full tests.
- Capture desktop 1440x900, 1280x800 và mobile 390x844 cho table/kanban/popovers/bulk state.

BÁO CÁO KẾT QUẢ:
1. Files changed.
2. Source findings that caused deviations from plan.
3. Tests actually run + pass/fail.
4. Typecheck/lint/build result.
5. Before/after UX summary.
6. Remaining P1/P2 items.
7. Any legacy/dead code discovered but intentionally left untouched.

22. Recommended execution decision

For this plan, use dependency-aware multi-agent execution, but not “maximum parallelism”.

Reason:

Sidebar, Topbar, TaskRow and Kanban can be modified independently.

UnifiedAdaptiveWorkspace and UnifiedTaskToolbar are integration hotspots.

Parallel edits to those hotspots will generate conflicts and semantic drift.

Recommended:

Wave A: 4–5 parallel focused agents
      ↓
merge + tests
      ↓
Wave B: 2–3 parallel leaf agents
      ↓
merge + tests
      ↓
Wave C: 1 integration agent
      ↓
full verification

This is faster and safer than either:

one giant agent editing the whole UI sequentially, or

many agents concurrently editing UnifiedAdaptiveWorkspace.