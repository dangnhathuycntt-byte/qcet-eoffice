# QCET E-Office: Workstream Ownership Matrix (V5.1 / Gate G0)

**Date**: 2026-09-12
**Status**: APPROVED & FROZEN (Gate G0, V5.1)
**Authority**: Master Plan §7 (`docs/plans/active/QCET_EOFFICE_WORLD_CLASS_UX_MASTER_PLAN_V5_1_FINAL_2026-09-12.md`)
**Supersedes**: the Gate-G0 lane map (F1–F4 / P1–P3) previously recorded in this file
and in `docs/agent-work/WORKSTREAMS.json` `contractVersion` `1.0.0`.

**Concurrency Rule**: Strict disjoint file ownership across all V5.1 lanes. No two
lanes may edit the same file. Cross-lane file edits are prohibited; a lane needing a
change in another lane's file records a request in its handoff
(`docs/agent-work/handoffs/<LANE>.md`).

---

## 1. Frozen Contracts & Governance Layer (single-writer)

Owned by `shard-contracts-freeze` and frozen (see
`docs/agent-work/decisions/ux-contract-freeze.md`):

- `src/contracts/**` (incl. `src/contracts/workspace-semantic.ts` and
  `src/contracts/tasks.ts` `CreateTaskInputSchema`)
- `docs/ux/QCET_UI_VOCABULARY.md` (C19 — FROZEN v1)
- `docs/agent-work/UX_MIGRATION_LEDGER.md` (C20)
- `docs/agent-work/UI_SEMANTIC_CONTRACT.md` (FROZEN v1 + V5.1 §7 additions)
- `docs/agent-work/OWNERSHIP.md` (this file)
- `docs/agent-work/WORKSTREAMS.json`
- `docs/agent-work/decisions/manager-school-scope.md`
- `docs/agent-work/decisions/ux-contract-freeze.md`

Consumer lanes must not rename or widen a strict schema/type here without domain
proof and an explicit contract revision.

---

## 2. Lane → file map (§7)

### INT — Integrator / integration owner
- `src/components/workspace/unified-adaptive-workspace.tsx`  ← **RESERVED** to the integration owner (exactly one lane)
- `src/components/tasks/task-management-workspace.tsx`
- integration tests (`tests/*-integration.test.ts`)
- shared/root/config files (Integrator-only unless explicitly reassigned)

### F1 — Semantics
- `src/domain/tasks/attention-resolver.ts`
- `src/domain/tasks/canonical-semantics.ts`
- semantic tests: `tests/domain-task-semantics.test.ts`, `tests/workspace-semantic-invariants.test.ts`

### F2 — Query / scope / loading
- `src/lib/workspace-query.ts`
- `src/hooks/use-workspace-query.ts`
- `src/app/tasks/page.tsx`
- `src/app/tasks/tasks-page-client.tsx`
- `tests/workspace-query.test.ts`

### F3 — Create command
- canonical create mapper (F3-owned; created within F3 discretion, non-overlapping)
- contract tests: `tests/contracts/**`, `tests/task-data-contracts.test.ts`
- Touch API/schema only with proof.

### P1 — Tasks presentation
- `src/components/dashboard/unified-task-toolbar.tsx`
- `src/components/tasks/table/**`
- `src/components/tasks/task-kanban-board.tsx`
- `src/components/tasks/saved-views-selector.tsx`

### P2 — Detail
- `src/components/dashboard/task-detail-side-sheet.tsx`

### P3 — Create form
- `src/components/dashboard/create-task-modal.tsx`
- optional extracted create subcomponents (F3/P3 boundary respected)

### P4 — Calendar
- `src/app/calendar/page.tsx`
- `src/components/calendar/**`

### P5 — Workbench
- `src/app/dashboard/page.tsx`
- `src/app/page.tsx`
- `src/components/dashboard/**` **except** files owned by P1/P2/P3 (see `excludes`
  in `WORKSTREAMS.json`)

### P6 — Navigation / global interaction
- `src/lib/navigation/**`
- `src/components/layout/app-sidebar.tsx`
- `src/components/navigation/mobile-bottom-nav.tsx`
- `src/components/layout/mobile-menu-drawer.tsx`
- `src/components/layout/command-search-modal.tsx`

### P7 — Notifications
- `src/app/notifications/page.tsx`
- `src/components/notifications/**`
- `src/lib/notification-triage.ts`

### P8 — Documents
- `src/app/documents/page.tsx`
- `src/components/documents/**`

### P9 — Org
- `src/app/org/page.tsx`
- `src/components/org/**`

### P10 — Offline / PWA
- `src/components/pwa/**`
- `src/lib/pwa/**`

---

## 3. Shared Invariant Rule

Any agent that discovers another lane's file needs adjustment must report the
requirement in its handoff document instead of editing that file. The Integrator
mediates. Shared primitives not explicitly listed above (e.g. other
`src/components/workspace/**` primitives, root/config) remain **Integrator-only**
until reassigned.

## 4. Machine-readable source

`docs/agent-work/WORKSTREAMS.json` is the machine-readable form of this matrix. It
asserts lane-path uniqueness (no two lanes own the same path; every lane owns at
least one path).
