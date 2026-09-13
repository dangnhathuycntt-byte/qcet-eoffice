# QCET E-Office: UX V5.1 Contract & Ownership Ledger (S-CONTRACTS)

- **Status**: FROZEN (single-writer)
- **Date**: 2026-09-12
- **Gate**: G0 (V5.1)
- **Owner shard**: `shard-contracts-freeze` (`S-CONTRACTS`, GOV lane)
- **Authority**: Master Plan §5 (C1–C16), §6 execution topology, §7 file ownership,
  §38 (C17); `docs/agent-work/decisions/ux-contract-freeze.md` (the C1–C20 register);
  `docs/agent-work/WORKSTREAMS.json` + `docs/agent-work/OWNERSHIP.md` (lane map)

This is the **contract-surface consolidation ledger** for the V5.1 reconstruction. It
records which contract each lane consumes, who owns each literal file path, and the
open reconciliations. It is a *pointer* document: the authoritative register is
`docs/agent-work/decisions/ux-contract-freeze.md` §1, and the machine-readable lane
map is `docs/agent-work/WORKSTREAMS.json`. This file does not restate or mutate any
frozen schema.

---

## 1. Purpose & boundary

`S-CONTRACTS` is the single owner of every shared cross-lane contract/type/context
surface. It freezes read-only interfaces **before** lane work and serializes any
necessary change behind integration proof. Every other lane *consumes* these
surfaces; none may widen a strict schema, rename a public type, or fork a parallel
implementation (`00-core.md` "One Capability, One Implementation").

- **Read-only surface**: `src/contracts/**`, `src/types/{auth,dashboard}.ts`,
  `src/lib/auth-context.tsx`, `src/context/auth-context.ts`,
  `src/lib/academic-calendar.ts`, `src/components/dashboard/dashboard-context.tsx`,
  and the shared `src/lib/*` engine helpers listed in §4.
- **Anti-owns** (must not be touched by this shard): `src/domain/tasks/**`,
  `src/components/workspace/**`, `src/lib/workspace-query.ts`,
  `src/hooks/use-workspace-query.ts`, `src/lib/adapters/create-task-mapper.ts`,
  `src/components/dashboard/{create-task-modal,task-detail-side-sheet}.tsx`,
  `src/features/flags.ts`, `src/app/api/**`, `prisma/schema.prisma`, `tests/executor/**`,
  `.claude/**`.

---

## 2. Frozen contract register (C1–C20) — one owner pointer each

Status is **FROZEN** for every row. The authoritative register (with notes and
V5.1-addendum detail) is `docs/agent-work/decisions/ux-contract-freeze.md` §1–§7.
Below, each contract carries exactly one owning-lane pointer.

| ID | Contract (short) | Frozen owner |
| --- | --- | --- |
| C1 | Create command: UI Draft → canonical mapper → `CreateTaskInput` → API → DTO → reconciliation | **F3** (`shard-f3-create`) |
| C2 | Capability derives from lifecycle + actor identity + server policy (never role/scope alone) | **F1** (`shard-f1-semantics`) |
| C3 | Canonical workspace query keys `scope dept period status attention view q taskId viewId sort group` | **F2** (`shard-f2-query`) |
| C4 | Counts distinguish server total / filtered total / visible / selected / actionable / context parents | **INT** |
| C5 | Command Palette ≠ Global Search ≠ Current-View Search ≠ Filter | **P6** (`shard-p6-navigation`) |
| C6 | Offline mutation taxonomy | **P10** (`shard-p10-offline`) |
| C7 | Every page declares primary work / action / context / secondary controls | **INT** |
| C8 | Every control belongs to an L1–L4 interaction layer | **INT** |
| C9 | Saved views store durable query intent; Display stores presentation | **INT** |
| C10 | Search defines scope / indexed fields / result types / cancellation-staleness / keyboard / URL | **P6** |
| C11 | Same capability result powers row / detail / bulk / context-menu / command entry points | **INT** |
| C12 | Detail / modal / deep-link restore logical focus and context | **P2** (`shard-p2-detail`) |
| C13 | Density budget records persistent controls / containers / strong-color / duplicate paths | **INT** (Q2/Q3 evaluators) |
| C14 | Creation cost: do not ask for system-derived fields | **P3** (`shard-p3-create-form`) |
| C15 | Surface purpose: no page duplicates another page's mission | **INT** |
| C16 | Performance target (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 @ p75) | **INT** |
| C17 | Rollout / feature-flag contract (**flag is not permission**; documented rollback) | **INT** (see freeze §5) |
| C18 | Design-system convergence (canonical pattern inventory; no page-local system) | **INT** (see freeze §2) |
| C19 | Content / terminology contract (`docs/ux/QCET_UI_VOCABULARY.md`, frozen v1) | **GOV** (`shard-contracts-freeze`) |
| C20 | Migration / deprecation ledger (`docs/agent-work/UX_MIGRATION_LEDGER.md`; ACTIVE→REMOVED) | **GOV** (`shard-contracts-freeze`; ledger stewardship) — per `WORKSTREAMS.json` `governanceLane` + `OWNERSHIP.md` §1, which supersede freeze §1's "INT (ledger)" phrasing; per-entry lane owner executes |

The §2 rows are a transcription of `docs/agent-work/decisions/ux-contract-freeze.md` §1 (the
authoritative register retains the notes and V5.1-addendum detail). Where a transcribed row
diverges from the register, the divergence is recorded here rather than silently aligned:
only **C20** diverges — the register's §1 assigns the ledger to "INT (ledger)" while its own
§8 states the ledger is GOV-owned, and the machine authority (`WORKSTREAMS.json`
`governanceLane` + `OWNERSHIP.md` §1) resolves it to `shard-contracts-freeze`/GOV. That
superseding authority governs this row.

---

## 3. Requirement-ID coverage declaration

| Requirement | Contract carrier | Enforcement / proof |
| --- | --- | --- |
| **R-001** (freeze frozen contracts C1–C20 before rollout; every lane consumes the interface boundary) | §2 register (C1–C20) + §4 exclusive file map | `tests/contracts/input-contracts.test.ts`; `npm run typecheck`; direct-path import of `src/contracts/workspace-semantic.ts` (no barrel re-export) |
| **R-017** (Filter ≠ View ≠ Display ≠ Current search ≠ Global search ≠ Command; saved views store durable query intent, Display stores presentation) | C5 (command/search/filter separation), C9 (saved views store durable query intent vs Display presentation), C10 (search scope/index/cancellation), and the orthogonal workspace-semantic dimensions in `src/contracts/workspace-semantic.ts` | **Machine-proven** by `tests/workspace-semantic-invariants.test.ts`: scope ≠ status (Inv1), attention ≠ status (Inv2), view ≠ filter (Inv3), 'Cửa tôi' scope-vs-status exclusivity (Inv4/Inv6), and period ≠ status (Inv7). The Command-vs-Global-search-vs-Current-view-search clause (C5/C10) and the saved-views-vs-display clause (C9) are **contract-declared frozen interfaces** (`docs/agent-work/UI_SEMANTIC_CONTRACT.md`), not assertions in this test. |

Both shard requirements are covered; no shard requirement is left unowned.

---

## 4. Exclusive file ownership map (reconciled)

Machine source: `docs/agent-work/WORKSTREAMS.json` (V5.1.0, frozen G0). The rows
below are the **reconciled** map after resolving the packet `owns` list against
`WORKSTREAMS.json` (§5). A glob claim is disjoint from every other lane's glob/literal
after applying that lane's `excludes`.

### GOV — Frozen Contracts & Governance (`shard-contracts-freeze` / `S-CONTRACTS`)
- `src/contracts/**` (incl. `tasks.ts` `CreateTaskInputSchema`, `workspace-semantic.ts`)
- `src/types/auth.ts`, `src/types/dashboard.ts`
- `src/lib/auth-context.tsx`, `src/context/auth-context.ts`
- `src/lib/academic-calendar.ts`, `src/lib/utils.ts`
- `src/lib/unified-task-hub.ts`, `src/lib/role-task-filter.ts`,
  `src/lib/delegation-authority-engine.ts`, `src/lib/dashboard-aggregator.ts`,
  `src/lib/dacum-workflow-engine.ts`, `src/lib/server/dashboard-service.ts`
- `src/components/dashboard/dashboard-context.tsx` (**carved out of P5**, see §5.3)
- `tests/contracts/input-contracts.test.ts` (**carved out of F3**, see §5.1)
- `tests/workspace-semantic-invariants.test.ts` (**carved out of F1**, see §5.2)
- `docs/agent-work/UX_V5_OWNERSHIP.md` (this file)
- Governance files (frozen, single-writer): `docs/ux/QCET_UI_VOCABULARY.md`,
  `docs/agent-work/UX_MIGRATION_LEDGER.md`, `docs/agent-work/UI_SEMANTIC_CONTRACT.md`,
  `docs/agent-work/OWNERSHIP.md`, `docs/agent-work/WORKSTREAMS.json`,
  `docs/agent-work/decisions/{manager-school-scope,ux-contract-freeze}.md`

### INT — Integrator / integration owner (`shard-int-integration`, graph id `S-INT-WIRING`)
- `src/components/workspace/unified-adaptive-workspace.tsx` — **RESERVED** to the
  single integration/wiring lane (see §5.4)
- `src/components/tasks/task-management-workspace.tsx`
- `tests/*-integration.test.ts`
- Shared/root/config paths not claimed elsewhere (`fallbackRule`)

### F1 — Semantics (`shard-f1-semantics`)
- `src/domain/tasks/attention-resolver.ts`, `src/domain/tasks/canonical-semantics.ts`
- `tests/domain-task-semantics.test.ts`

### F2 — Query / scope / loading (`shard-f2-query`)
- `src/lib/workspace-query.ts`, `src/hooks/use-workspace-query.ts`
- `src/app/tasks/page.tsx`, `src/app/tasks/tasks-page-client.tsx`
- `tests/workspace-query.test.ts`

### F3 — Create command (`shard-f3-create`)
- canonical create mapper (F3-owned; `src/lib/adapters/create-task-mapper.ts`)
- `tests/contracts/**` **excluding** `tests/contracts/input-contracts.test.ts` (carved to GOV)
- `tests/task-data-contracts.test.ts`

### P1 — Tasks presentation (`shard-p1-tasks`)
- `src/components/tasks/table/**`, `src/components/tasks/task-kanban-board.tsx`,
  `src/components/tasks/saved-views-selector.tsx`,
  `src/components/dashboard/unified-task-toolbar.tsx`

### P2 — Detail (`shard-p2-detail`)
- `src/components/dashboard/task-detail-side-sheet.tsx`

### P3 — Create form (`shard-p3-create-form`)
- `src/components/dashboard/create-task-modal.tsx`

### P4 — Calendar (`shard-p4-calendar`)
- `src/app/calendar/page.tsx`, `src/components/calendar/**`

### P5 — Workbench (`shard-p5-workbench`)
- `src/app/dashboard/page.tsx`, `src/app/page.tsx`, `src/components/dashboard/**`
- `excludes`: `unified-task-toolbar.tsx`, `task-detail-side-sheet.tsx`,
  `create-task-modal.tsx`, **+ `dashboard-context.tsx`** (carved to GOV, see §5.3)

### P6 — Navigation / global interaction (`shard-p6-navigation`)
- `src/lib/navigation/**`, `src/components/layout/app-sidebar.tsx`,
  `src/components/navigation/mobile-bottom-nav.tsx`,
  `src/components/layout/mobile-menu-drawer.tsx`,
  `src/components/layout/command-search-modal.tsx`

### P7 — Notifications (`shard-p7-notifications`)
- `src/app/notifications/page.tsx`, `src/components/notifications/**`,
  `src/lib/notification-triage.ts`

### P8 — Documents (`shard-p8-documents`)
- `src/app/documents/page.tsx`, `src/components/documents/**`

### P9 — Org (`shard-p9-org`)
- `src/app/org/page.tsx`, `src/components/org/**`

### P10 — Offline / PWA (`shard-p10-offline`)
- `src/components/pwa/**`, `src/lib/pwa/**`

---

## 5. Ownership reconciliation (no unowned / duplicated path)

The JIT packet `owns` list, `WORKSTREAMS.json`, and the frozen register did not fully
agree. Each divergence is resolved below by carving the named **literal** file to its true
single owner; the machine map remains the authority and a plan-executor update is
requested rather than silently editing the frozen `WORKSTREAMS.json`.

- **5.1–5.3** reconcile literal-path conflicts between the packet `owns` list and
  `WORKSTREAMS.json` (three paths: `tests/contracts/input-contracts.test.ts`,
  `tests/workspace-semantic-invariants.test.ts`, `src/components/dashboard/dashboard-context.tsx`).
- **5.4** records a single-lane reservation (`unified-adaptive-workspace.tsx`); no second owner exists.
- **5.5** reassigns packet-`owns` paths that `WORKSTREAMS.json` leaves to the INT `fallbackRule`.
- **5.6** records governance files the packet `owns` list omits but `WORKSTREAMS.json` registers.

**5.1 `tests/contracts/input-contracts.test.ts` (packet: GOV; WORKSTREAMS: F3 `tests/contracts/**`).**
This is the frozen re-prove for `CreateTaskInputSchema` `.strict()` — a contract-freeze
obligation, not a create-command obligation. Resolution: **GOV owns this literal**; F3
retains `tests/contracts/**` **excluding** it. Requested `WORKSTREAMS.json` change:
add `tests/contracts/input-contracts.test.ts` to `F3.excludes`.

**5.2 `tests/workspace-semantic-invariants.test.ts` (packet: GOV; WORKSTREAMS: F1).**
The test asserts the frozen semantic-dimension orthogonality (R-017 / C5 / C9) — a
contract-surface obligation. Resolution: **GOV owns this literal**; F1 retains the
domain-semantics file `tests/domain-task-semantics.test.ts`. Requested `WORKSTREAMS.json`
change: remove the literal from `F1.files`.

**5.3 `src/components/dashboard/dashboard-context.tsx` (packet: GOV; WORKSTREAMS: P5 `src/components/dashboard/**`).**
This file defines the frozen `DashboardModalContextValue` and the Nav/Data/Actions
contexts — a shared cross-lane contract consumed by every dashboard lane, not a
workbench-composition file. Resolution: **GOV owns this literal**; P5 retains
`src/components/dashboard/**` **excluding** it (P5's existing `excludes` grows by one).
Requested `WORKSTREAMS.json` change: add the literal to `P5.excludes`.

**5.4 `src/components/workspace/unified-adaptive-workspace.tsx` — single-lane reservation.**
Reserved to exactly one lane: the integration/wiring owner. In `WORKSTREAMS.json` this
lane is `shard-int-integration`; the V5.1 execution graph refers to it as
`S-INT-WIRING`. These are two identifiers for the **same single lane** — no second
owner exists. (Reconciliation note: an executable alias check is a plan-executor
request, not a second claim.)

**5.5 Packet-`owns` paths unlisted in `WORKSTREAMS.json`.** The following packet `owns`
literals are named by no lane in `WORKSTREAMS.json` and therefore fell under the INT
`fallbackRule`: `src/types/auth.ts`, `src/types/dashboard.ts`, `src/lib/auth-context.tsx`,
`src/context/auth-context.ts`, `src/lib/academic-calendar.ts`, `src/lib/utils.ts`,
`src/lib/unified-task-hub.ts`, `src/lib/role-task-filter.ts`,
`src/lib/delegation-authority-engine.ts`, `src/lib/dashboard-aggregator.ts`,
`src/lib/dacum-workflow-engine.ts`, and `src/lib/server/dashboard-service.ts`. All are
shared contract/type/context/engine surfaces, so they are **reassigned to GOV** here; no
other lane claims them, so no conflict results. (The remaining packet-`owns` literals are
resolved in §5.1–§5.3 — `tests/contracts/input-contracts.test.ts`,
`tests/workspace-semantic-invariants.test.ts`, `src/components/dashboard/dashboard-context.tsx`
— and `docs/agent-work/UX_V5_OWNERSHIP.md` is this file, self-owned by GOV.)

**5.6 Governance files absent from the packet `owns` list.** The packet omits
`docs/agent-work/{UX_MIGRATION_LEDGER.md,OWNERSHIP.md,WORKSTREAMS.json,UI_SEMANTIC_CONTRACT.md}`,
`docs/agent-work/decisions/ux-contract-freeze.md`, and `docs/ux/QCET_UI_VOCABULARY.md`.
These are GOV-registered in `WORKSTREAMS.json` (`governanceLane.files`) and are the
current ownership authority (per `ux-contract-freeze.md` §8, which already logs this as
a plan-executor `shard.owns` reconciliation request). This shard does not rewrite them.

After 5.1–5.6, every path in the packet `owns` list has exactly one owner, and no lane
double-claims a literal path.

---

## 6. Consolidation candidates (duplicate PATHS, not duplicate implementations)

Recorded here as `MIGRATING` consolidation candidates. The C20 ledger
`docs/agent-work/UX_MIGRATION_LEDGER.md` is a preserve-only baseline artifact that is
**not** in this shard's packet `owns` list, so this shard does **not** write it; adding the
matching `MIGRATING` rows to the ledger (and adding the ledger to `shard.owns`) is a
plan-executor request (§9). Contracts are **not** silently changed; resolution of either
is a later migration, not a freeze amendment.

1. **Scope-switcher path duplication** —
   `src/components/layout/scope-switcher.tsx` (large, currently the heavily-consumed
   path: `ScopeSwitcher`, `isExecutiveUser`, `isManagerUser`, `resolveScopeDetails`)
   vs `src/components/workspace/scope-switcher.tsx` (canonical `ScopeSwitcher` /
   `WorkspaceScope` symbol the workspace-semantic contract names). Divergent
   implementations with divergent consumer sets — consolidate to one canonical
   `ScopeSwitcher` before removing either path.
2. **Auth-context path duplication** — `src/context/auth-context.ts` is a one-line
   re-export (`export * from "@/lib/auth-context"`) of the canonical
   `src/lib/auth-context.tsx`. Same implementation, duplicate path; repoint consumers
   to `@/lib/auth-context` before deleting the shim.

---

## 7. Producer / consumer coupling (owned test → anti-owned surfaces)

`tests/workspace-semantic-invariants.test.ts` (now GOV-owned per §5.2) imports
**anti-owned** modules: `src/components/workspace/{scope-switcher,status-filter,view-switcher,attention-badge}`,
`src/components/workspace/hooks/use-adaptive-workspace-data`,
`src/components/tasks/table/constants`, and `src/lib/workspace-query`. A change to any
of those anti-owned files can break this GOV-owned test, and a change to the frozen
surface can break their consumers. Cross-lane edits to either side must be recorded in
the lane handoff (`docs/agent-work/handoffs/<LANE>.md`) and re-proved with this test.

---

## 8. Frozen-debt register (recorded, NOT expanded — `05-domain-freeze.md` in force)

These are pre-existing frozen surfaces. Expand/collapse is **out of scope**; they are
recorded so no lane silently "fixes" them into a contract revision.

- **`UserRole = 'ADMIN' | 'MANAGER' | 'STAFF'`** (`src/types/auth.ts`) is the generic
  SaaS triad that `05-domain-freeze.md` §2 prohibits *for business authority*. Real
  statutory authority is carried by `AuthUser.dbRole`/`roleLabel`; the enum is frozen
  debt and must not be expanded with new values.
- **Client masquerading** — `src/lib/auth-context.tsx` exposes `switchRole`/`switchUser`.
  Restricted by `05-domain-freeze.md` §1; recorded, not altered.
- **Three divergent `TaskStatus` vocabularies** — `src/types/dashboard.ts` (10 values),
  `src/contracts/tasks.ts` `TaskStatusSchema` (6 + lowercase aliases + `'all'`), and
  `src/contracts/workspace-semantic.ts` `TaskLifecycleStatus` (7). Unification is a
  contract revision (explicit amendment of `ux-contract-freeze.md`), not a silent edit.
- **`DashboardPayload.source` permits `'mock'` / `'mock-fallback'`** (`src/types/dashboard.ts`),
  in tension with the Never-Invent-Operational-Data invariant. Frozen debt; do not
  expand. Candidate C20 ledger entry (owner INT).

---

## 9. Cross-shard requests (plan-executor)

1. Update `shard.owns` for `shard-contracts-freeze` to include the GOV governance files
   listed in §5.6 — notably `docs/agent-work/UX_MIGRATION_LEDGER.md`, which is a
   preserve-only baseline artifact not in the packet `owns` list, so the C20 `MIGRATING`
   rows of §6 can only be added once ownership is transferred — and the recomputed lane
   map in §4 (supersedes `ux-contract-freeze.md` §8 request).
2. Update `WORKSTREAMS.json` per §5.1–§5.3 (`F3.excludes`, `F1.files`, `P5.excludes`).
3. Executable lane-uniqueness assertion (expand globs, apply excludes, assert pairwise
   disjointness) — already logged as `WORKSTREAMS.json` `laneUniqueness.crossLaneRequest`.

## 10. Verification of this freeze

- `npm run typecheck` (`tsc --noEmit`).
- `node_modules/.bin/tsx --test tests/contracts/input-contracts.test.ts`.
- `node_modules/.bin/tsx --test tests/workspace-semantic-invariants.test.ts`.

Note: the aggregate runner (`npm test` → `node scripts/run-tests.mjs`) discovers **all**
`tests/**/*.test.ts` and ignores positional argv, so `npm test -- <file>` does not scope
execution; targeted single-file runs use `node_modules/.bin/tsx --test <file>`.
