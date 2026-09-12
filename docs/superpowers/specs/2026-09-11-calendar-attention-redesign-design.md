# Calendar Attention-First Redesign — Design Specification

Date: 2026-09-11
Status: Approved for implementation
Branch: `feat/calendar-attention-redesign`

## Goal

Turn `/calendar` from a dense task listing into an operational attention surface. The month view must answer, at a glance: which days need attention, why they need attention, and where to drill down.

## Product model

- Month view is an overview/attention surface, not a complete task list.
- Day sheet is the detail/action surface.
- Task detail remains the canonical `TaskDetailSideSheet`.
- Mobile prioritizes the linear agenda/list experience.
- Scope (`school`, `unit`, `my`) remains a dataset filter and is never inferred from role.
- The QCET academic operational period (25th of previous month through 24th of named month) remains unchanged.

## Attention model

Calendar items are ranked deterministically:

1. overdue active work
2. waiting approval/review
3. active work due on the reference date
4. in-progress work
5. other active work
6. completed work
7. cancelled work

Ties are resolved by due date, school-level before unit-level, then stable item id.

The same ranking is reused by month cells, day sheet, and agenda to avoid competing semantics.

## Month cell

A day cell presents:

- date and total count
- attention summary when applicable (`N quá hạn`, `N chờ duyệt`)
- at most two ranked previews
- explicit `Xem tất cả` drill-down

Large days must never render dozens of task titles or an opaque `+158 nhiệm vụ` without explaining why the day matters.

## Day sheet

The day sheet becomes the action center for the selected day:

- date + total count
- summary counts
- quick filters: `Cần xử lý`, `Quá hạn`, `Chờ duyệt`, `Tất cả`
- search for high-density days
- items sorted by the same attention ranking
- task click opens the canonical task detail surface

## Events and meetings

Do not create a parallel CalendarEvent domain model. QCET already owns persistent meeting/event semantics through the canonical `Meeting` entity and authenticated `/api/meetings` API.

Calendar event creation must persist through that existing API, and the calendar must read meetings for the active operational period. Client state is a projection of server truth, not the source of truth.

## Accessibility

- Status meaning must not depend on color alone; pair color with icon/text.
- Do not expose partial `role=grid` semantics. If the calendar does not implement the full ARIA grid keyboard model, use ordinary semantic layout/buttons instead.
- Interactive controls keep visible keyboard focus.
- Mobile controls target touch-friendly sizing.

## Performance

Build filtered date indexes and day summaries once with memoized pure functions. Do not scan/sort the full task collection independently for every rendered day cell. Add virtualization only if measurement proves it necessary.

## Non-goals

- no calendar rewrite or new calendar dependency
- no Redux/Zustand
- no Redis or infrastructure changes
- no new Week/Personnel view in this change
- no duplicate event persistence model
- no changes to task business authorization

## Acceptance criteria

- high-density day (100+ items) remains scannable and does not overflow
- max two task previews per month cell
- overdue/review work cannot be displaced by completed work in the preview slots
- scope/search/status/level filters affect totals and previews consistently
- status remains understandable without color
- mobile remains agenda-first
- newly created event/meeting survives reload because it is server persisted
- typecheck, lint, tests, and build pass before completion is claimed
