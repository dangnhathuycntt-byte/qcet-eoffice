# Decision: UX Contract Freeze (C1–C20) & Single-Writer Contracts Layer

- **Status**: Frozen
- **Date**: 2026-09-12
- **Gate**: G0 (V5.1)
- **Owner shard**: `shard-contracts-freeze`
- **Authority**: `docs/plans/active/QCET_EOFFICE_WORLD_CLASS_UX_MASTER_PLAN_V5_1_FINAL_2026-09-12.md`
  §5 (C1–C16, lines 426–530), §6 topology, §7 file ownership, §38 (C17), §39 (C18),
  §40 (C19), §41 (C20), §53 orchestrator addendum.
- **Supersedes**: the Gate-G0 lane map (F1–F4 / P1–P3) recorded in `docs/agent-work/OWNERSHIP.md`
  and `docs/agent-work/WORKSTREAMS.json` `contractVersion` `1.0.0`.

This record freezes the twenty Master Plan UX contracts (C1–C20) with their owning
lane and freezes `src/contracts/**` as a single-writer layer. C17–C20 are V5.1
additions (they do not exist in the C1–C16-era `UI_SEMANTIC_CONTRACT.md`).

---

## 1. Frozen contract register (C1–C20)

Status is **FROZEN** for every row. "Owning lane" names the single lane accountable
for keeping the contract intact where it binds code (per §7 lane map). Governance
contracts that describe process rather than a file are owned by the Integrator
unless stated.

| ID | Contract | Owning lane | Notes |
| --- | --- | --- | --- |
| C1 | Create Command: UI Draft → canonical mapper → `CreateTaskInput` → API → server DTO → client reconciliation | F3 (create command) | Binds `src/contracts/tasks.ts` `CreateTaskInputSchema` and the F3 canonical create mapper. See §3. |
| C2 | Capability derives from lifecycle + actor identity + server policy; never role/scope alone | F1 (semantics) | Server-evaluated; never a client role branch (`05-domain-freeze.md`). |
| C3 | Canonical workspace query keys: `scope dept period status attention view q taskId viewId sort group` | F2 (query/scope/loading) | Binds `WorkspaceQueryParams`. Reconciliation in §4. |
| C4 | Counts distinguish server total / filtered total / visible rows / selected / actionable / context parents | INT | Cross-dataset; see `40-data-integrity.md` "One Metric, One Definition". |
| C5 | Command Palette ≠ Global Search ≠ Current View Search ≠ Filter | P6 (navigation/global interaction) | |
| C6 | Offline mutation taxonomy: local-only / queued / syncing / server-confirmed / failed / conflict / unknown-after-timeout | P10 (offline/PWA) | |
| C7 | Every page declares primary work / primary action / primary context / secondary controls | INT | Page composition contract. |
| C8 | Every control belongs to an L1/L2/L3/L4 interaction layer | INT | |
| C9 | Saved views store durable query intent; Display stores presentation preferences | INT | |
| C10 | Search defines scope / indexed fields / result types / cancellation-staleness / keyboard-focus / URL behavior | P6 | |
| C11 | Same capability result powers row / detail / bulk / context-menu / command entry points | INT | Capability-driven command path. |
| C12 | Detail / modal / deep-link flows restore logical focus and context | P2 (detail) | |
| C13 | Density budget records persistent controls / containers / strong-color elements / duplicate action paths / concepts before action | INT (evaluators) | Recorded by `Q2`/`Q3` evaluators. |
| C14 | Creation cost: do not ask for system-derived fields | P3 (create form) | |
| C15 | Surface purpose: no page duplicates another page's mission | INT | |
| C16 | Performance target: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 at p75, split mobile/desktop | INT | |
| C17 | Rollout / feature-flag contract (IMPLEMENT→VERIFY→FLAGGED CANDIDATE→PILOT→LIMITED COHORT→MEASURE→EXPAND→REMOVE LEGACY; flag is not permission; documented rollback) | INT | **V5.1 addition.** See §5. |
| C18 | Design-system convergence (canonical pattern inventory, search-before-create, no page-local design system, ≤ 1 primary action per local area) | INT | **V5.1 addition.** Runs after page lanes, not inside them. |
| C19 | Content / terminology contract (`docs/ux/QCET_UI_VOCABULARY.md`; consolidate label drift; outcome-based buttons; standardize date/time/period) | `shard-contracts-freeze` | **V5.1 addition.** See §6. |
| C20 | Migration / deprecation ledger (`docs/agent-work/UX_MIGRATION_LEDGER.md`; statuses ACTIVE→REMOVED; replacement complete only at zero old consumers) | INT (ledger) / per-entry lane owner | **V5.1 addition.** See §7. |

The machine-readable lane→file mapping (the §7 V5.1 map that supersedes the earlier
G0 map) lives in `docs/agent-work/WORKSTREAMS.json`; the human-readable matrix in
`docs/agent-work/OWNERSHIP.md`.

---

## 2. V5.1 additions registered (C17–C20)

C17–C20 are new in V5.1 and are cross-referenced from `UI_SEMANTIC_CONTRACT.md`
§7 (appended, without mutating the frozen C1–C16 text):

- **C17** rollout lifecycle and the hard rule **Feature Flag ≠ Permission**.
  Repository convention: flag keys are camelCase in `src/features/flags.ts`
  (e.g. `taskWorkspaceV2`, `mobileAgenda`, `newExecutiveDashboard`) with env
  overrides of the form `FEATURE_FLAG_<UPPER_SNAKE>` (see `toSnakeCaseUpper` /
  `getEnvVariableNamesForFlag`). The §38.3 `UX_*_V5` names are conceptual
  placeholders only; any concrete flag added at a migration boundary must follow
  the camelCase convention. C17 is recorded as a **contract**; no flag is created
  here (creating flags is an implementation/lane action).
- **C18** design-system convergence: canonical pattern inventory, search-before-create,
  no page-local design system, one primary action per local area.
- **C19** content/terminology: the vocabulary file is frozen v1 and is the single
  naming authority (see §6).
- **C20** migration/deprecation ledger with the ACTIVE→REMOVED status set and the
  zero-old-consumers completion rule (see §7).

---

## 3. Single-writer freeze of `src/contracts/**`

`src/contracts/**` is frozen single-writer. `shard-contracts-freeze` is the sole
writer; no consumer lane may widen a strict schema or rename a public type without
domain proof and an explicit revision of this record.

- **`src/contracts/tasks.ts` — `CreateTaskInputSchema` (aka `CreateTaskSchema`)**
  is frozen. Its `.strict()` boundary is deliberately load-bearing: it blocks
  mass-assignment of `id`, `status`, `createdById`, `approvedAt`, and other
  privileged fields. It is enforced by `tests/contracts/input-contracts.test.ts`
  and `tests/task-data-contracts.test.ts`. **Strictness was not relaxed.**
- **`src/contracts/workspace-semantic.ts`** is frozen. It is imported by direct
  path (`@/contracts/workspace-semantic`) by `src/lib/workspace-query.ts`,
  `src/domain/tasks/canonical-semantics.ts`, `src/domain/tasks/attention-resolver.ts`,
  and `src/components/tasks/task-kanban-board.tsx`; it is intentionally **not**
  re-exported from `src/contracts/index.ts` (no barrel change is made here, to
  avoid introducing a duplicate/ambiguous export).

Any lane that needs a contract change records the request in its handoff and this
record is revised; the barrel/type surface is not mutated by consumers.

---

## 4. C3 reconciliation (frozen as-is, divergence recorded)

C3 names `period`, `sort`, and `group` among the canonical keys. Before this freeze:

- `WorkspaceQueryParams` exposed `month` / `date` but no `period`, `sort`, or `group`.
- `src/lib/workspace-query.ts` already accepts `period` (and `p`) as an input alias
  that resolves to `month` or `date`, but has **zero** handling of `sort` / `group`.

Resolution taken by this freeze (no anti-owned file touched):

1. `period`, `sort`, and `group` were **added to the frozen `WorkspaceQueryParams`
   type** so the contract reflects C3 exactly. `month` / `date` are documented as
   concrete period **sub-keys**, not independent dimensions.
2. The parser gap (`sort` / `group` are declared but not yet parsed/serialized by
   `src/lib/workspace-query.ts`) is **not** a semantic or security change and is
   owned by the **F2** query/scope/loading lane. It is recorded as a
   `MIGRATING` cross-lane request in `docs/agent-work/UX_MIGRATION_LEDGER.md`
   (the ledger is the single home for this divergence, per §7 of this record).
   No parser change is attempted here because `src/lib/**` is anti-owned.

The contract type is now complete for C3; the F2 lane closes the parser half.

---

## 5. C17 rollout / feature-flag contract (binding statements)

- Lifecycle for major reconstructed surfaces:
  `IMPLEMENT → VERIFY → FLAGGED CANDIDATE → INTERNAL PILOT → LIMITED COHORT → MEASURE → EXPAND → REMOVE LEGACY`.
- **Feature Flag ≠ Permission.** A flag gates whether a capability/integration is
  active in a deployment; it must never substitute a server-side RBAC/capability
  check (`src/features/flags.ts` header invariant; `05-domain-freeze.md`).
- A flagged surface keeps a documented rollback path until its legacy path is
  removed. Rollback must not change schema backward, weaken authorization, discard
  new user data, or resurrect known P0 defects.
- Flag removal requires: targeted tests pass, Q1–Q6 pass, pilot passes, performance
  acceptable, no blocking telemetry regression, legacy consumer inventory = 0,
  migration ledger = `DELETE_READY`.

---

## 6. C19 content/terminology contract (freeze statement)

- `docs/ux/QCET_UI_VOCABULARY.md` is **FROZEN v1** (2026-09-12) and is the single
  naming authority for user-facing copy. It freezes all §40.2 terms and consolidates
  the §40.3 forbidden-drift groups to one approved outcome each, plus the §G
  date/time/period rules (ICT `Asia/Ho_Chi_Minh`, bounded relative-deadline window
  `2..3` days, academic-period labels from `src/lib/academic-calendar.ts`).
- Executable acceptance: `tests/content-terminology.test.ts` asserts the frozen
  terms, drift consolidations, banned generic labels, and the date rules against
  the vocabulary document (not against brittle source-string locks).
- Terminology changes land in the vocabulary **before** the corresponding copy
  cleanup; label remediation of consumer surfaces is owned by the lane that owns
  each surface (`src/lib/format` is the canonical date/number formatter of record).

---

## 7. C20 migration/deprecation ledger (freeze statement)

- `docs/agent-work/UX_MIGRATION_LEDGER.md` is the single migration/deprecation
  ledger. Schema:
  `| Artifact | Current consumers | Canonical replacement | Status | Owner | Flag | Delete after | Proof |`.
- Allowed statuses: `ACTIVE`, `MIGRATING`, `REDIRECTED`, `DEPRECATED`,
  `DELETE_READY`, `REMOVED`, `BLOCKED`.
- Hard rule: a replacement is **not** complete because the new implementation
  exists. Completion requires old consumers = 0, documented compatibility, tests
  covering the canonical path, redirect/migration where required, and recorded
  delete-ready proof.
- The ledger is seeded with the §41 entries and the C3 parser divergence from §4.

---

## 8. Ownership supersession

This record supersedes the Gate-G0 map:

- `docs/agent-work/OWNERSHIP.md` and `docs/agent-work/WORKSTREAMS.json` are
  rewritten to the §7 V5.1 lane map: **INT, F1, F2, F3, P1–P10**, plus the frozen
  contracts/governance layer.
- `src/components/workspace/unified-adaptive-workspace.tsx` is **reserved to the
  integration owner** (`shard-int-integration`); it appears in exactly one lane.
- No two lanes claim the same path (`WORKSTREAMS.json` `laneUniqueness` is
  **asserted** by manual review and records a cross-lane request for executable
  enforcement; see §9).

### Ownership of the C20 ledger (packet reconciliation)

The C20 artifact `docs/agent-work/UX_MIGRATION_LEDGER.md` is a **governance-layer
file owned by `shard-contracts-freeze` (GOV lane)** and is registered as such in
`WORKSTREAMS.json` (`governanceLane.files`) and `OWNERSHIP.md` §1. The JIT shard
packet's static `owns` list predates that registration and omits the path, while
requirement **C20 / plan §41** mandates creating the file. Because the packet
`owns` list is not a file this shard writes, the reconciliation is a **plan-executor
request**: add `docs/agent-work/UX_MIGRATION_LEDGER.md` to `shard.owns`. Until then,
`WORKSTREAMS.json` + `OWNERSHIP.md` remain the ownership authority (per §7), and no
other lane claims the path.

---

## 9. Verification of this freeze

- C19 acceptance: `node_modules/.bin/tsx --test tests/content-terminology.test.ts`
  (17 pass).
- Contracts strictness unchanged: `tests/contracts/input-contracts.test.ts`,
  `tests/task-data-contracts.test.ts`.
- Ownership uniqueness: `WORKSTREAMS.json` claims are **manually inspected** so that
  no two lanes own the same literal path (after applying each lane's `excludes`) and
  every lane owns at least one path. Executable enforcement is out of this shard's
  ownership (`tests/**`), so it is recorded as a cross-lane request in the
  `laneUniqueness.crossLaneRequest` field.
