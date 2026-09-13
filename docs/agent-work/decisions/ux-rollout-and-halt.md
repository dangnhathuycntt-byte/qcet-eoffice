# Decision: UX Rollout Flags & Halt Criteria (C17 / T92 / T95)

- **Status**: Decided (evidence-based) — recorded by `shard-flags-rollout`
- **Date**: 2026-09-12
- **Scope**: §38 (C17), §43 (T92), §46 (T95) of `docs/plans/active/QCET_EOFFICE_WORLD_CLASS_UX_MASTER_PLAN_V5_1_FINAL_2026-09-12.md`
- **Owner shard**: `shard-flags-rollout` (single-writer of `src/features/flags.ts`, `src/config/runtime.ts`, `tests/features/feature-flags.test.ts`, and this record)
- **Method**: Read of the existing flag infrastructure, the frozen governance record, the operational rollback reference, and the Wave 0 baseline handoff. Every claim is cited to file + symbol (function/constant names), not brittle line numbers.

## Decision

1. **Five V5.1 rollout flags are placed at meaningful migration boundaries**, one per reconstructed surface — never one per component. They extend the `FeatureFlagKey` union in `src/features/flags.ts`:

   | Key (canonical, camelCase) | Env override (`getEnvVariableNamesForFlag`) | Boundary |
   | --- | --- | --- |
   | `uxTasksV5` | `FEATURE_FLAG_UX_TASKS_V5` | Tasks V5 core workspace (list/board/detail/create) |
   | `uxCalendarV5` | `FEATURE_FLAG_UX_CALENDAR_V5` | Calendar V5 |
   | `uxNotificationsV5` | `FEATURE_FLAG_UX_NOTIFICATIONS_V5` | Notifications V5 |
   | `uxDocumentsV5` | `FEATURE_FLAG_UX_DOCUMENTS_V5` | Documents V5 |
   | `uxOrgV5` | `FEATURE_FLAG_UX_ORG_V5` | Organization V5 |

2. **Flag keys follow the repository camelCase convention.** The §38.3 `UX_*_V5` names are **conceptual/env names**, realized as camelCase keys whose env names resolve through `toSnakeCaseUpper` (`uxTasksV5` → `UX_TASKS_V5` → `FEATURE_FLAG_UX_TASKS_V5`). This resolution is independently confirmed by the frozen record `docs/agent-work/decisions/ux-contract-freeze.md` §2: *"flag keys are camelCase in `src/features/flags.ts` … The §38.3 `UX_*_V5` names are conceptual placeholders only."* Literal UPPER_SNAKE keys are **not** inserted into the union.

3. **Shape mirrors the existing rollout flags** (`taskWorkspaceV2`): `{ defaultValue: false, isKillSwitch: false, isPublic: true }`. This is distinct from the four operational kill switches (`pushNotifications`, `externalGoogleLogin`, `offlineMutations`, `largeExcelExport`), which are `{ defaultValue: true, isKillSwitch: true }`. Operational kill switches stay separate from the new UX rollout flags.

4. **Feature Flag ≠ Permission.** No flag value is read inside any authorization or policy module. Verified by `tests/features/feature-flags.test.ts` §8 (a recursive scan of `src/server/authorization` and `src/server/policies` for `isFeatureEnabled` / `FEATURE_FLAGS` / `features/flags` / `getPublicFeatureFlags` / `getAllFeatureFlags` returns zero matches) and by `src/features/flags.ts` header invariant + `.claude/rules/05-domain-freeze.md`.

## Rollout order and cohorts (T92)

Rollout order (§43.1) — secondary modules must not precede their dependencies:

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

Cohort phases (§43.2), applied per flag via the existing env/override mechanism:

```text
Phase A: local/dev only
Phase B: maintainers/internal test users
Phase C: small representative role sample
Phase D: broader school cohort
Phase E: default on
Phase F: legacy removal
```

Each flag advances independently through A→F. A flag is promoted to the next cohort only after the current cohort shows no halt signal (see below).

**Workbench coverage note.** §43.1 names *Workbench* in the rollout order, but the packet's flag set (§38.3) contains no `UX_WORKBENCH_V5` flag and Workbench carries no standalone migration boundary. Workbench is therefore covered by the **Tasks core / presentation** flags (`uxTasksV5`) — the workspace shell is part of the Tasks reconstruction boundary — plus the global convergence pass. No dedicated Workbench flag is created (per §38.3: *"Do not create a flag for every tiny component. Flags belong at meaningful migration boundaries."*).

## Halt criteria (T95)

Plan §46 requires recording the current baseline before rollout and **forbids inventing arbitrary percentages without data**. The Wave 0 baseline (`docs/agent-work/handoffs/BASELINE.md`, `artifacts/ux-v5-1/baseline/**`) captures an immutable **same-data screenshot** baseline (26 frames), a git snapshot, and a DB-disposal proof — but it contains **no** performance, error-rate, latency, or journey-completion metrics. The `baseline` column below is therefore recorded as **capture-required** (owner/action) rather than fabricated, pending a metric-baseline capture.

| Metric | Baseline | Candidate | Severity | Owner | Rollback action | Re-enable criteria |
| --- | --- | --- | --- | --- | --- | --- |
| Authorization/security errors | capture-required (security metric not in Wave 0 artifact) | observe auth-error count on flagged surface | P1 | security reviewer | disable flag (`FEATURE_FLAG_*` = false) | defect fixed + regression test added + re-verify |
| Task-create failures | capture-required (no journey metric in Wave 0 artifact) | observe create-command failure rate | P1 | Tasks lane owner | disable `uxTasksV5` | root cause fixed + create-command regression test green |
| Approval failures | capture-required | observe approval transition failure rate | P1 | Tasks lane owner | disable `uxTasksV5` | transition defect fixed + test green |
| Bulk mutation failures | capture-required | observe bulk-action failure rate | P2 | Tasks lane owner | disable `uxTasksV5` | bulk-path defect fixed + test green |
| Sync conflicts | capture-required | observe offline outbox conflict count | P2 | offline/PWA lane owner | disable `uxTasksV5` (if Tasks-bound) | conflict handling verified on same-data replay |
| Service error rate | capture-required | observe 5xx rate (P1 threshold > 5%, `docs/operations/rollback.md` §3) | P1 | Integrator | container paste-back per `docs/operations/rollback.md` | error rate back within baseline band |
| p75 interaction latency | capture-required (C16 target direction: INP ≤ 200ms) | observe p75 on flag-enabled cohort | P2 | UX/perf owner | disable the affected surface flag | p75 within target |
| p75 INP | capture-required (C16 target INP ≤ 200ms, split mobile/desktop) | observe p75 INP | P2 | UX/perf owner | disable the affected surface flag | p75 INP within target |
| Critical journey completion | capture-required (no journey metric in Wave 0 artifact) | observe completion rate for the flagged journey | P1 | Integrator | disable the affected surface flag | journey completes on same-data replay |

**Baseline capture action (capture-required resolution):** the halt table's `baseline` cells must be filled from a **metric** baseline (error rate, p75 INP / interaction latency, create/approval/bulk failure counts, critical-journey completion) captured on the un-flagged (legacy) surface and recorded at `artifacts/ux-v5-1/baseline/**` before Phase C (small representative role sample) of any flag. Owner: the UX/perf + Integrator lanes; the Wave 0 screenshot baseline alone is insufficient for these signals. §46's prohibition on invented percentages is respected by **not** writing numeric baselines here.

## Rollback constraints (C17 §38.4)

A flagged surface keeps a documented rollback path until its legacy path is removed (operational steps in `docs/agent-work/runbooks/ux-rollout-rollback.md`). Rollback of a UX flag must **not**:

- change database schema backward (aligns with the `Expand → Migrate → Contract` invariant, `docs/operations/rollback.md` §2);
- weaken authorization (feature flags never gate authorization);
- discard new user data;
- resurrect known P0 semantic defects.

Because the flags gate **implementation availability only**, rollback is a **config-only** operation (env/override flip) — it does not reverse schema and does not require a container paste-back unless the P1 path in `docs/operations/rollback.md` §3 is independently triggered.

## Flag removal gate (C17 §38.5)

A flag and its legacy path are removed only after: targeted tests pass, Q1–Q6 pass, pilot passes, performance acceptable, no blocking telemetry regression, legacy consumer inventory = zero, and the migration ledger (`docs/agent-work/UX_MIGRATION_LEDGER.md`) says `DELETE_READY`.

## Evidence / references

- `src/features/flags.ts` — `FeatureFlagKey`, `FEATURE_FLAGS`, `isFeatureEnabled` (precedence: runtime override > env > default), `toSnakeCaseUpper`, `getEnvVariableNamesForFlag`, `getAllFeatureFlags`, `getPublicFeatureFlags`; header invariant "Feature Flag != Authorization / Permission".
- `src/config/runtime.ts` — `PublicRuntimeFeatures` (index signature propagates new public flags), `getPublicRuntimeConfig`, `assertZeroSecrets`.
- `tests/features/feature-flags.test.ts` — §8 V5 migration-boundary flags + authorization-independence scan.
- `docs/agent-work/decisions/ux-contract-freeze.md` §2, §5 (C17 binding statements; camelCase naming resolution).
- `docs/operations/rollback.md` — P1/P2/P3 severity matrix; `Expand → Migrate → Contract`.
- `docs/agent-work/handoffs/BASELINE.md` — Wave 0 baseline scope and its metric gap.
- Plan §38 (C17), §43 (T92), §46 (T95).
