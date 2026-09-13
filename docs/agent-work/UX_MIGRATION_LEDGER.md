# QCET E-Office — UX Migration / Deprecation Ledger (C20)

- **Status**: FROZEN (schema + status set) — entries are live and mutable
- **Date**: 2026-09-12
- **Authority**: Master Plan §41 (C20); contract freeze `docs/agent-work/decisions/ux-contract-freeze.md` §7
- **Owner**: Integrator (ledger stewardship); each entry is executed by its named Owner lane

## Purpose

Single home for every legacy artifact being replaced by a V5.1 canonical surface.
A replacement is **not** complete merely because the new implementation exists.

## Schema

```markdown
| Artifact | Current consumers | Canonical replacement | Status | Owner | Flag | Delete after | Proof |
```

## Allowed statuses

```text
ACTIVE        — legacy still in service, no migration started
MIGRATING     — canonical replacement exists; consumers still on legacy
REDIRECTED    — legacy path forwards to canonical; legacy code removable
DEPRECATED    — retained only for compatibility; no new consumers
DELETE_READY  — old consumers = 0 and delete-proof recorded; safe to remove
REMOVED       — deleted
BLOCKED       — cannot proceed; blocker recorded
```

## Completion rule

Removal is allowed only when **all** hold: `old consumers = 0`, compatibility
requirement documented, tests cover the canonical path, redirect/migration exists
where required, and delete-ready proof is recorded.

## Entries

| Artifact | Current consumers | Canonical replacement | Status | Owner | Flag | Delete after | Proof |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/unit-tasks` route | `src/app/unit-tasks/**` (route still present) | `/tasks?scope=unit` | ACTIVE | INT | — | redirect live + no inbound links | consumer = 0; redirect test |
| `/dashboard` route | `src/app/dashboard/**` (route still present) | `/` (root workbench) | ACTIVE | INT | — | no inbound nav links; parity recorded | consumer = 0; journey J1 pass |
| `/portal` route | `src/app/portal/**` | audit pending (T89/T90) | BLOCKED | INT | — | portal inventory + deprecation decision | T89 audit outcome |
| legacy mobile navigation arrays | `src/components/navigation/mobile-bottom-nav.tsx`, `src/components/layout/mobile-menu-drawer.tsx` | canonical navigation registry (`src/lib/navigation/canonical-navigation-registry.ts`) | ACTIVE | P6 | — | T86 single-source test passes; arrays deleted | `navigation-consumer-single-source.test.ts` |
| calendar local task-create mapper | calendar create path | canonical create adapter (F3) | ACTIVE | P4 | — | C1 parity test passes | `calendar-create-task-contract-parity.test.ts` |
| legacy task create raw payload | raw create payload callers | canonical create adapter (F3) | ACTIVE | F3 | — | all create callers use canonical mapper | `task-create-ui-api-contract.test.ts` |
| duplicate task action/status paths | bulk/row/detail action handlers | capability-driven command path | ACTIVE | INT | — | C11 single capability path; duplicates deleted | capability tests |
| `WorkspaceQueryParams.sort` / `.group` parser support | none yet (contract keys declared, parser gap) | `src/lib/workspace-query.ts` parse/serialize | MIGRATING | F2 | — | `sort`/`group` parsed + serialized + tested | `tests/workspace-query.test.ts` |
| `SMART_FILTER_TABS` "Đang làm" (`src/components/tasks/table/constants.ts`) | tasks table filter tabs | `Đang thực hiện` (vocabulary §H.4) | MIGRATING | P1 | — | copy converged + assertion updated | vocabulary §J |
| `STATUS_BADGE_CONFIGS.NEW` / `STATUS_CONFIG.NEW` "Mới" | tasks table status badges | `Chưa bắt đầu` (vocabulary §H.6) | MIGRATING | P1 | — | copy converged | vocabulary §J |
| `Chờ duyệt` (attention badge / KPI title) | `active-filter-breadcrumb.tsx`, `executive-stat-strip.tsx` | `Chờ tôi duyệt` (attention, vocabulary §H.3) | MIGRATING | P5 | — | copy converged | vocabulary §J |
| `Xóa lọc` clear-filter button | `active-filter-breadcrumb.tsx` | `Xóa bộ lọc` (vocabulary §H.5) | MIGRATING | INT | — | copy converged | vocabulary §J |
| `Việc của tôi` scope label | `active-filter-breadcrumb.tsx` | `Của tôi` (vocabulary §D) | MIGRATING | INT | — | copy converged | vocabulary §J |
| `Phân rã nhiệm vụ` / `Giao nhanh` | `src/components/dashboard/task-detail-side-sheet.tsx` | `Thêm việc con` (vocabulary §H.2) | MIGRATING | P2 | — | copy converged | vocabulary §J |
| `Tạo việc / Giao việc` create title | `src/components/navigation.tsx` | `Giao việc` / `Tạo việc cá nhân` (vocabulary §H.1) | MIGRATING | P6 | — | copy converged | vocabulary §J |
| unbounded relative-deadline renderers (`formatDeadlineDistance`, `getMobileDueBadge`, `getRelativeTimeString`, `getDeadlineBadgeInfo`) | `upcoming-deadlines-widget.tsx`, `mobile-task-card.tsx`, `task-detail-side-sheet.tsx`, `lecturer-focus-workspace.tsx` | `formatRelativeDate` (`@/lib/format`) — bounded `2..3` rule (vocabulary §G.2/§J.1) | MIGRATING | P5/P2/P1 | — | four drifting copies deleted; `src/lib/format` is sole renderer | vocabulary §J.1 |
| `src/lib/format` canonical formatter (dormant) | contract test only (`tests/content-terminology.test.ts`) | becomes sole date/number formatter of record | MIGRATING | INT | — | ≥ 1 production consumer wired; drift copies removed | vocabulary §J.1 |

## Notes

- Flag column stays `—` until a concrete flag is created at a migration boundary
  (C17). Flags must follow the camelCase `src/features/flags.ts` convention; they
  are operational gates, never permissions.
- Do not split this ledger: it is the single C20 home. Vocabulary §J/§J.1 is the
  terminology authority; this ledger tracks the *migration* of those surfaces.
