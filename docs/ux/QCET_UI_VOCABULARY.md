---
title: QCET UI Vocabulary (C19 — Content & Terminology Contract)
status: FROZEN
version: 1
date: 2026-09-12
authority: QCET E-Office Master Re-architecture — Master Plan §40 (C19), task T88
governs: user-facing copy, labels, and terminology across all QCET E-Office surfaces
related:
  - docs/agent-work/UI_SEMANTIC_CONTRACT.md             # FROZEN v1 — dimension orthogonality model (+ V5.1 §7 C17–C20)
  - docs/agent-work/decisions/ux-contract-freeze.md     # C1–C20 freeze register (C19/C20 V5.1)
  - docs/domain/task-management.md                      # domain lifecycle semantics
  - src/lib/academic-calendar.ts                        # academic period authority (ICT)
---

# QCET UI Vocabulary

The single naming authority for user-facing copy in QCET E-Office. Every lane,
component, and copy-cleanup pass converges to the terms frozen in this document.

**Freeze rule (Master Plan §53):** `QCET_UI_VOCABULARY.md` is frozen **before**
final copy cleanup. Downstream copy work must not begin until this contract lands,
and must not invent labels outside it.

This document names terms only. It does **not** own implementation, does **not**
vendor TypeScript label maps, and does **not** define permissions, roles, or access
control. Code remediation to converge on these terms belongs to lane shards.

---

## 0. Governing model (read before using any term)

This vocabulary aligns to the **FROZEN / IMMUTABLE v1** semantic model in
`docs/agent-work/UI_SEMANTIC_CONTRACT.md`. The vocabulary governs the *exact
Vietnamese strings*; the frozen contract governs the *conceptual dimensions*.
Where a dimension concept and a string differ, the dimension concept wins and the
string is fixed here.

The following dimensions are **orthogonal** and must never be conflated in copy:

```text
scope     ≠ status      "Của tôi" is a dataset filter, never a lifecycle status
attention ≠ status      objective lifecycle vs. subjective user action backlog
period    ≠ status      "Hôm nay" / due-window labels are temporal predicates
view      ≠ filter      switching "Chế độ xem" must not change the dataset
```

Consequences enforced by this vocabulary:

1. **Scope is not status.** `Của tôi` (`my`) may appear only as a **Phạm vi** (scope)
   label. It must never be a status badge, status tab, or kanban column.
2. **Attention is not status.** `Chờ phê duyệt` is the objective lifecycle status
   (`WAITING_APPROVAL`). `Chờ tôi duyệt` is the subjective attention state
   (`requires_my_approval`). They are different strings for different concepts.
3. **Period is not status.** `Hôm nay`, `Ngày mai`, `Quá hạn N ngày` are temporal
   predicates, never lifecycle statuses.
4. **Role is not scope.** Role/position strings are out of scope for this document;
   this vocabulary never encodes authority.

### 0.1 Reconciliation with the frozen UI semantic contract

The frozen contract used the abbreviated gloss `Chờ duyệt` when describing the
concept `WAITING_APPROVAL`. C19 (Master Plan §40, authored 2026-09-12) fixes the
**user-facing string** for that concept to `Chờ phê duyệt`, and classifies the bare
`Chờ duyệt` as forbidden drift. This is a string-level resolution only: the frozen
orthogonality invariant (attention ≠ status) is preserved unchanged.

Two lifecycle models exist locally and can be confused:

- `docs/agent-work/UI_SEMANTIC_CONTRACT.md` — **7-value `TaskLifecycleStatus`**
  (UI copy authority): `NOT_STARTED | IN_PROGRESS | WAITING_APPROVAL |
  PENDING_EXECUTIVE_APPROVAL | COMPLETED | OVERDUE | CANCELLED`.
- `docs/domain/task-management.md` — a richer internal approval lifecycle
  (`SUBMITTED_FOR_REVIEW`, `IN_REVIEW`, `PENDING_APPROVAL`, `REVISION_REQUIRED`,
  `REJECTED`, `APPROVED`).

**The frozen UI contract governs user-facing UI labels.** Internal domain status
identifiers may be richer, but they must map onto the frozen UI labels below; a UI
surface must never display raw domain status codes or uncoordinated approval terms.

---

## A. Core entities

Approved nouns for the task domain.

| Term | Meaning | Notes |
| --- | --- | --- |
| Nhiệm vụ | A task | The canonical noun. Never "công việc"/"task" in copy. |
| Nhiệm vụ cha | Parent task | The top-level work item. |
| Nhiệm vụ con | Subtask | Child work item under a parent. Action to create it: **Thêm việc con** (see §F). |
| Giao việc | Assignment of work to a person/unit | Both the assignment action and the assigned-work concept. |
| Tạo việc cá nhân | Creation of a personal task owned by the current user | Distinct from `Giao việc` (delegation). |

Rules:

- Nouns use **`Nhiệm vụ`**. The word `việc` appears only inside established action
  phrases (`Giao việc`, `Tạo việc cá nhân`, `Thêm việc con`) — never as a standalone
  synonym for `Nhiệm vụ`.
- `Giao việc` (delegate to others) and `Tạo việc cá nhân` (self-owned) are two
  distinct actions, not synonyms.

---

## B. Lifecycle states (objective status)

Objective entity lifecycle. These are the only approved status labels. The
**frozen `TaskLifecycleStatus` union** (`docs/agent-work/UI_SEMANTIC_CONTRACT.md`)
has exactly **seven** members: `NOT_STARTED | IN_PROGRESS | WAITING_APPROVAL |
PENDING_EXECUTIVE_APPROVAL | COMPLETED | OVERDUE | CANCELLED`. The "Dimension / key"
column states the exact source of every key so a runtime key is never mistaken for a
`TaskLifecycleStatus` member. Two rows below are **not** `TaskLifecycleStatus`
values and are marked as such.

| Approved label | Dimension / key | Notes |
| --- | --- | --- |
| Chưa bắt đầu | `TaskLifecycleStatus` `NOT_STARTED` | Created, assigned, no activity yet. Runtime badge key `NEW` currently renders `Mới`; it must converge to this label (see §J). |
| Đang thực hiện | `TaskLifecycleStatus` `IN_PROGRESS` | Under execution. |
| Chờ phê duyệt | `TaskLifecycleStatus` `WAITING_APPROVAL` | Submitted, awaiting unit/approval authority. |
| Chờ BGH duyệt | `TaskLifecycleStatus` `PENDING_EXECUTIVE_APPROVAL` | Awaiting Ban Giám hiệu (executive) approval. |
| Hoàn thành | `TaskLifecycleStatus` `COMPLETED` | Fully completed. |
| Quá hạn | `TaskLifecycleStatus` `OVERDUE` | Past due and not completed. |
| Đã hủy | `TaskLifecycleStatus` `CANCELLED` | Cancelled. |
| Cần chỉnh sửa | Runtime status key / `KanbanColumnId` `NEEDS_REVIEW` — **not** a `TaskLifecycleStatus` member | Returned for revision; folds into the frozen lifecycle (`IN_PROGRESS` bucket), never a separate lifecycle status. |
| Tạm dừng | Display-only pause badge — **not** a `TaskLifecycleStatus` member | A paused/blocked presentation state. The runtime key `BLOCKED` is the **attention** dimension, whose approved label is `Bị chặn` (§C); `Tạm dừng` is not that attention label and does not add a lifecycle status. |

Rules:

- `Chờ BGH duyệt` is the **required-executive** variant and has its own entry; it is
  never folded into a generic approval label.
- `Cần chỉnh sửa` is the **status** (what the task currently is). The **button** that
  moves a task into it is `Yêu cầu chỉnh sửa` (see §F). Do not swap these. `Cần chỉnh sửa`
  (`NEEDS_REVIEW`) is a runtime status key / Kanban column, **not** a `TaskLifecycleStatus`
  member; it folds into the frozen lifecycle. Do not present it as an eighth lifecycle
  status.
- `Tạm dừng` is a display-only pause badge, **not** a `TaskLifecycleStatus` member. The
  `BLOCKED` lifecycle key is the **attention** dimension, and its approved user-facing
  label is `Bị chặn` (see §C). Never conflate `Tạm dừng` (pause badge) with `Bị chặn`
  (attention state).
- `Quá hạn` denotes the same objective temporal condition in both the status and
  attention dimensions; the single approved string is `Quá hạn`.

---

## C. Attention states (subjective user action backlog)

Subjective, viewer-dependent labels describing what *this authenticated user* must
act on. These are never lifecycle statuses.

| Approved label | Attention type | Meaning |
| --- | --- | --- |
| Cần tôi xử lý | `requires_my_action` | I am assignee/co-assignee and the task is active. |
| Chờ tôi duyệt | `requires_my_approval` | I hold approval authority and must decide (subject to Separation of Duties). |
| Quá hạn | `overdue` | Past due and not completed. |
| Sắp đến hạn | `due_soon` | Due within the near-term window (see §G for relative-date rendering). |
| Bị chặn | `blocked` | Blocked/paused and requiring intervention. |

Rules:

- `Cần tôi xử lý` and `Chờ tôi duyệt` are the two distinct attention verbs; `Chờ tôi duyệt`
  is **not** the same string as the lifecycle status `Chờ phê duyệt`.
- Attention labels are computed server-side from authority + `now`; the vocabulary only
  fixes the strings. Never widen or narrow authority by relabeling.
- An attention bucket may contain tasks in multiple lifecycle statuses; this is expected
  and does not violate orthogonality.
- The executive composite KPI that sums the overdue **and** blocked dimensions is titled
  `Trễ / vướng` (rendered by `src/components/dashboard/executive-stat-strip.tsx`). It is
  an approved **composite metric title**, not a per-task label and not a third attention
  state; per-task copy still uses `Quá hạn` / `Bị chặn`.

---

## D. Scope nouns (dataset filter — "Phạm vi")

Scope labels select the visible dataset. They are never statuses.

| Approved label | Scope key | Notes |
| --- | --- | --- |
| Toàn trường | `school` | Institution-wide dataset. |
| Đơn vị | `unit` | Unit / khoa / phòng dataset. |
| Của tôi | `my` | Personal dataset. **Never** a status, tab, or kanban column. |

Rules:

- The scope surface is labelled `Phạm vi công việc` (its accessible name).
- `Việc của tôi` is **reserved** as a workbox/filter-preset label (`my_tasks`); it is
  **not** a Scope label. The Scope label for `my` is strictly `Của tôi`.
- `Cá nhân`, `Trường`, `Personal` are rejected scope synonyms.

---

## E. UI nouns & controls

Approved names for recurring UI controls and objects.

| Approved label | The control / object it names |
| --- | --- |
| Bộ lọc | Filter control. The active-filter summary strip is labelled `Bộ lọc:`. |
| Hiển thị | Display settings control (density, visible columns). |
| Chế độ xem | View-mode switch (layout only). |
| Tìm kiếm | Text search control. |
| Phạm vi | Scope selector. |
| Thông báo | Notifications surface. |
| Văn bản | Documents / official correspondence. |
| Đơn vị | A unit (khoa / phòng / trung tâm). |
| Cán bộ | A member of staff / civil servant. |

Rules:

- `Chế độ xem` (view mode) is a **layout** control and must not be called a filter.
  Approved view option labels: `Bảng`, `Kanban` (tasks); `Lịch tháng` (`month`),
  `Nghị sự` (`agenda`), `Danh sách` (calendar list). Calendar view options never change
  the underlying dataset or active filters (§0 invariant 4).
- `Hiển thị` governs density/columns (e.g. `Gọn`, `Chuẩn`); it is distinct from `Chế độ xem`.
- Search input placeholder/label uses `Tìm kiếm`. The active-filter chip uses `Từ khóa`.
- `Văn bản` is the document noun; document-domain assignment uses `Phân công đơn vị xử lý
  văn bản` as a compound and is outside the task-action drift groups in §H.

---

## F. Actions & buttons

**Button rule (Master Plan §40.4):** buttons describe the **action/outcome**. Prefer
the specific outcome over a generic affirmation.

Approved action labels:

| Approved label | Outcome it describes |
| --- | --- |
| Giao việc | Assign work to a person/unit (replaces `Tạo việc`, `Tạo nhiệm vụ`, `Phân công`). |
| Tạo việc cá nhân | Create a personal task. |
| Thêm việc con | Add a subtask (replaces `Phân rã`, `Phân rã ngay`, `Giao nhanh`). |
| Lưu thay đổi | Persist edits. |
| Yêu cầu chỉnh sửa | Request revision (button); distinct from status `Cần chỉnh sửa`. |
| Phê duyệt | Approve. |
| Nộp minh chứng | Submit evidence/deliverable. |
| Làm mới | Refresh data. |
| Thử lại | Retry a failed operation. |
| Xóa bộ lọc | Clear all filters (replaces `Xóa lọc`). |
| Đóng | Close a panel/overlay. |
| Hủy | Cancel an in-progress action. |
| Xem thêm / Thu gọn | Expand / collapse a list. |

**Banned generic labels** — do not use when a specific outcome exists:

```text
Xác nhận
Tiếp tục
Thực hiện
OK
Đồng ý
```

Rules:

- The banned labels are acceptable only in the rare case where no specific outcome can
  be named; in that case `Xác nhận` is the least-preferred fallback. `/tasks` and
  `/calendar` primary actions must always name their outcome.
- One primary visual action per local area (Master Plan §39.5). Secondary actions use
  secondary/ghost treatment (e.g. `Bộ lọc`, `Hiển thị`, `Làm mới`).
- The single global creation action for `/tasks` is `Giao việc`.

---

## G. Date, time, and academic period

**Timezone:** Indochina Time (`Asia/Ho_Chi_Minh`, **UTC+7**) is the sole timezone for
all dates, deadlines, periods, and relative labels. Never slice a UTC ISO datetime to
derive an ICT calendar day; use the canonical helpers in `src/lib/academic-calendar.ts`.

### G.1 Formats

| Context | Format | Example |
| --- | --- | --- |
| Machine / transport / URL | ISO date `YYYY-MM-DD` | `2026-09-25` |
| Display — full date | `dd/MM/yyyy` | `25/08/2026` |
| Display — compact date (only inside a labeled period span) | `dd/MM` | `25/08` |
| Display — date span | `dd/MM - dd/MM` | `25/08 - 24/09` |
| Display — time | 24-hour `HH:mm` | `08:30` |
| Display — date + time | `dd/MM/yyyy HH:mm` | `25/08/2026 08:30` |

Rules:

- Full and compact date formats are **not** competing: use `dd/MM/yyyy` for a standalone
  date, and `dd/MM` only inside a period span whose label already carries the year.
- `dd/MM/yyyy` is the required row/detail date format; a bare `dd/MM` must not appear for
  a standalone date.

### G.2 Relative-date rules

Relative labels are derived from the system reference date via
`getSystemReferenceDate()` (env `NEXT_PUBLIC_REFERENCE_DATE` first). Copy must **never**
hardcode a reference date or a fixed "today". The in-repo fallback literal is an
implementation detail and must not be surfaced as a UI value.

```text
diffDays == 0    → "Hôm nay"
diffDays == 1    → "Ngày mai"
diffDays in 2..3 → "Còn {diffDays} ngày"
diffDays >= 4    → formatted date "dd/MM/yyyy"   (no relative count)
diffDays == -1   → "Quá hạn 1 ngày"
diffDays <= -2   → "Quá hạn {abs(diffDays)} ngày"
```

Rules:

- These labels are **period predicates**, never lifecycle statuses.
- The near-term relative window is **bounded to `2..3` days**; from `4` days out the badge
  shows the absolute `dd/MM/yyyy` date instead of a count. This is the canonical rule,
  matching `getSlaBadgeStatus` in `src/components/tasks/table/utils/table-date-helpers.ts`.
  `formatDeadlineDistance` (dashboard upcoming-deadlines widget) currently renders an
  unbounded `Còn {n} ngày` and must converge to this bounded rule (see §J).
- `Sắp đến hạn` (attention) renders inline as the relative label above, not as a
  hardcoded phrase.

### G.3 Academic period labels

Reuse the labels emitted by `src/lib/academic-calendar.ts` exactly. Do not restate
month boundaries in contradictory plain language.

| Concept | Approved label form | Example |
| --- | --- | --- |
| Operational month | `Tháng {N}` | `Tháng 9` |
| Operational month (full) | `Tháng {N} / {YYYY} ({span})` | `Tháng 9 / 2026 (25/08 - 24/09)` |
| Date span | `dd/MM - dd/MM` | `25/08 - 24/09` |
| Semester | `Học kỳ I` / `Học kỳ II` | `Học kỳ I` |
| Semester (full) | `Học kỳ {I\|II} ({YYYY} - {YYYY})` | `Học kỳ I (2026 - 2027)` |
| Academic year | `YYYY-YYYY` | `2026-2027` |

Fixed cycle rules (single source of truth: `src/lib/academic-calendar.ts`):

- An operational month runs from **day 25 of the prior month** to **day 24 of the
  named month** (`Tháng 9` = 25/08 → 24/09).
- The academic year runs **25/08 → 24/08** (`2026-2027` = 2026-08-25 → 2027-08-24).
- 12 operational months are ordered `9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8`.
- Semester I = `Tháng 9..12`; Semester II = `Tháng 1..8`.

---

## H. Forbidden drift — consolidation ledger

Multiple labels for the same action/concept are forbidden unless context truly changes
meaning (Master Plan §40.3). Each group below has exactly **one** approved outcome (or an
explicitly distinguished pair). Rejected variants must not appear in new copy.

### H.1 Work creation / delegation

```text
Approved:  Giao việc            (delegate work to a person/unit)
Approved:  Tạo việc cá nhân     (create a self-owned task — distinct action)
Rejected:  Tạo việc
Rejected:  Tạo nhiệm vụ
Rejected:  Phân công
```

### H.2 Subtask creation

```text
Approved:  Thêm việc con
Rejected:  Phân rã
Rejected:  Phân rã ngay
Rejected:  Giao nhanh
```

### H.3 Approval terminology

```text
Approved:  Chờ phê duyệt        (objective status — WAITING_APPROVAL)
Approved:  Chờ BGH duyệt        (objective status — PENDING_EXECUTIVE_APPROVAL)
Approved:  Chờ tôi duyệt        (subjective attention — requires_my_approval)
Rejected:  Chờ duyệt            (bare/ambiguous — collides with status and attention)
Rejected:  Cần duyệt
```

### H.4 In-progress status

```text
Approved:  Đang thực hiện
Rejected:  Đang làm
```

### H.5 Clear filters

```text
Approved:  Xóa bộ lọc
Rejected:  Xóa lọc
```

### H.6 Not-started status

```text
Approved:  Chưa bắt đầu
Rejected:  Mới
```

---

## I. Canonical term index (machine-readable)

One approved term per line, grouped by `#` comment headers. Lane copy assertions may
grep this block instead of hardcoding ad hoc strings. This block is the naming
authority, **not** a test-lock target — assert against intent, not incidental formatting.

```text
# entities
Nhiệm vụ
Nhiệm vụ cha
Nhiệm vụ con
Giao việc
Tạo việc cá nhân
# lifecycle status labels (union membership: see §B)
Chưa bắt đầu
Đang thực hiện
Cần chỉnh sửa
Chờ phê duyệt
Chờ BGH duyệt
Hoàn thành
Quá hạn
Đã hủy
Tạm dừng
# attention
Cần tôi xử lý
Chờ tôi duyệt
Sắp đến hạn
Bị chặn
# scope
Toàn trường
Đơn vị
Của tôi
# ui nouns
Bộ lọc
Hiển thị
Chế độ xem
Tìm kiếm
Phạm vi
Thông báo
Văn bản
Cán bộ
# actions
Thêm việc con
Lưu thay đổi
Yêu cầu chỉnh sửa
Phê duyệt
Nộp minh chứng
Làm mới
Thử lại
Xóa bộ lọc
Đóng
Hủy
# view labels
Bảng
Kanban
Lịch tháng
Nghị sự
Danh sách
# dashboard KPI (composite, see §C)
Trễ / vướng
```

---

## J. Current consumers & known drift (remediation owned by lane shards)

This vocabulary is the authority; the surfaces below currently render strings that
must converge. Code and tests are **not** owned by this shard (anti-owned: `src/**`,
`tests/**`, `docs/plans/**`), so the convergence is executed by lane copy-cleanup work.

| Surface (current consumer) | Current string | Converge to |
| --- | --- | --- |
| `src/components/tasks/table/constants.ts` `SMART_FILTER_TABS` (in_progress) | `Đang làm` | `Đang thực hiện` |
| `src/components/tasks/table/constants.ts` `SMART_FILTER_TABS` (review) | `Chờ duyệt` | `Chờ tôi duyệt` |
| `src/components/workspace/components/active-filter-breadcrumb.tsx` (workbox label) | `Chờ duyệt` | `Chờ tôi duyệt` (attention) |
| `src/components/workspace/components/active-filter-breadcrumb.tsx` (clear button) | `Xóa lọc` | `Xóa bộ lọc` |
| `src/components/workspace/components/active-filter-breadcrumb.tsx` (scope `my`) | `Việc của tôi` | `Của tôi` |
| `src/components/dashboard/executive-stat-strip.tsx` (pending-approval KPI title) | `Chờ duyệt` | `Chờ tôi duyệt` (attention) |
| `src/components/dashboard/task-detail-side-sheet.tsx` | `Phân rã nhiệm vụ`, `Giao nhanh` | `Thêm việc con` |
| `src/components/navigation.tsx` (create title) | `Tạo việc / Giao việc` | `Giao việc` / `Tạo việc cá nhân` |
| `src/components/tasks/table/constants.ts` `STATUS_BADGE_CONFIGS.NEW` / `STATUS_CONFIG.NEW` | `Mới` | `Chưa bắt đầu` |
| `src/components/dashboard/upcoming-deadlines-widget.tsx` `formatDeadlineDistance` | unbounded `Còn {n} ngày` (any `n >= 2`) | bounded: `Còn {n} ngày` for `2..3`, else `dd/MM/yyyy` (§G.2) |

### J.1 Relative-deadline drift map (vocabulary §G.2)

The bounded relative-deadline predicate frozen in §G.2 (`Hôm nay` / `Ngày mai` /
`Còn {n} ngày` for `2..3` / `dd/MM/yyyy` from `4` days out) exists in **five** in-repo
implementations besides the canonical helper: one conforming reference
(`getSlaBadgeStatus`) and **four** drift copies — the widget row above plus three it
omits. The four drift copies do not agree with each other, and each renders its own
"today" string:

| Surface | Function | Today string | Ahead window | Divergence from §G.2 |
| --- | --- | --- | --- | --- |
| `src/components/tasks/table/utils/table-date-helpers.ts` (**conforming reference**) | `getSlaBadgeStatus` | `Hôm nay` | `2..3` → `Còn {n} ngày`; `>= 4` → `dd/MM/yyyy` | none |
| `src/components/dashboard/upcoming-deadlines-widget.tsx` | `formatDeadlineDistance` | `Hôm nay` | `>= 2` → `Còn {n} ngày` (unbounded) | no `dd/MM/yyyy` fallback from `4` days out |
| `src/components/tasks/mobile-task-card.tsx` | `getMobileDueBadge` | `Hạn hôm nay` | `1..3` and `>= 4` → `Còn {n} ngày` (unbounded) | wrong today string; no `dd/MM/yyyy` fallback |
| `src/components/dashboard/task-detail-side-sheet.tsx` | `getRelativeTimeString` | `Hạn hôm nay` | `>= 1` → `Còn {n} ngày` (unbounded) | wrong today string; no `dd/MM/yyyy` fallback |
| `src/components/portal/lecturer-focus-workspace.tsx` | `getDeadlineBadgeInfo` | `Hạn chót: Hôm nay` | `2..7` → `Hạn chót: Còn {n} ngày`; `>= 8` → `Còn {n} ngày` (unbounded) | prefixed today/tomorrow strings; window extended to `7`; no `dd/MM/yyyy` fallback |

- All five agree on the past-due branch (`Quá hạn 1 ngày` / `Quá hạn {abs} ngày`).
- Reference-date source differs: `getMobileDueBadge` and `getRelativeTimeString` read
  `getSystemReferenceDate()`; `getDeadlineBadgeInfo`'s local `getDaysRemaining` falls back
  to the client's local `new Date()` when no reference is passed, so it does not honour
  `NEXT_PUBLIC_REFERENCE_DATE`.
- All four drifting surfaces converge to `formatRelativeDate` in `src/lib/format`
  (`@/lib/format`), which implements the bounded `2..3` rule above.

Notes:

- `Chờ phê duyệt`, `Chờ BGH duyệt`, `Đang thực hiện` already conform (frozen in
  `STATUS_BADGE_CONFIGS`) and are the reference implementations.
- `STATUS_BADGE_CONFIGS.NEW` does **not** yet conform: it renders `Mới` and must converge
  to `Chưa bắt đầu` (see row above and the §H.6 rejected variant).
- `Trễ / vướng` (executive `blocked-overdue` KPI title in
  `src/components/dashboard/executive-stat-strip.tsx`) is an **approved** composite metric
  title — it is intentionally not listed as drift; it must not be split or reworded, and
  must not be reused as a per-task label (§C).
- Some existing copy assertions currently lock drift strings (e.g. an executive card
  title of `Chờ duyệt`). Those must be updated **in their owning lane** to assert the
  frozen vocabulary; this shard does not edit tests.
- The canonical module `src/lib/format` (barrel `@/lib/format`, `formatRelativeDate`,
  §G.2) is currently **dormant**: no production surface imports it yet — its only
  consumer is the C19 contract test. It becomes the single implementation only once the
  surfaces listed above (starting with the §J.1 relative-deadline map) are wired to it;
  until then the in-repo copies remain the de-facto renderers and continue to drift.

---

## K. Freeze declaration

- Status: **FROZEN v1** (2026-09-12).
- Any change to an approved term requires an explicit revision of this file with a
  version bump and recorded rationale; approved terms are immutable otherwise.
- New terms may be **added** (new concepts) but existing approved terms may not be
  silently renamed.
- Terminology changes must land here **before** the corresponding copy-cleanup change.
