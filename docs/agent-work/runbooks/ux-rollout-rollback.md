# Runbook: UX V5 Rollout, Halt & Rollback

- **Status**: Active
- **Date**: 2026-09-12
- **Scope**: Operational rollout / halt / rollback of the V5.1 UX reconstruction surfaces gated by `src/features/flags.ts`.
- **Owner shard**: `shard-flags-rollout` (flag + runtime config surface). Surface lanes own their own consumers.
- **Reconciles with**: `docs/operations/rollback.md` (Canonical Operational Reference — container/DB rollback). This runbook is the **feature-flag** layer that sits *on top of* that document and never contradicts it. It does **not** duplicate the container paste-back procedure; it defers to §3–§4 there for P1 severity.
- **Decision record**: `docs/agent-work/decisions/ux-rollout-and-halt.md` (C17 / T92 / T95).

## 1. Flags this runbook operates

| Surface | Flag key | Env override (enable) | Default |
| --- | --- | --- | --- |
| Tasks V5 core | `uxTasksV5` | `FEATURE_FLAG_UX_TASKS_V5=true` | OFF |
| Calendar V5 | `uxCalendarV5` | `FEATURE_FLAG_UX_CALENDAR_V5=true` | OFF |
| Notifications V5 | `uxNotificationsV5` | `FEATURE_FLAG_UX_NOTIFICATIONS_V5=true` | OFF |
| Documents V5 | `uxDocumentsV5` | `FEATURE_FLAG_UX_DOCUMENTS_V5=true` | OFF |
| Organization V5 | `uxOrgV5` | `FEATURE_FLAG_UX_ORG_V5=true` | OFF |

Accepted truthy/falsy tokens: `true|1|yes|on|enabled` / `false|0|no|off|disabled` (`parseBooleanFlag` in `src/features/flags.ts`). Alternative env names (`FEATURE_<UPPER_SNAKE>`, `NEXT_PUBLIC_FEATURE_FLAG_*`, etc.) are also honored — see `getEnvVariableNamesForFlag`.

**Hard invariant:** these flags gate **implementation availability only**. They never grant, widen, or restrict authorization. If a surface requires a capability the user lacks, the server denies it regardless of the flag state (`docs/agent-work/decisions/ux-rollout-and-halt.md`; `.claude/rules/05-domain-freeze.md`).

## 2. Rollout sequence

Advance each flag independently through cohorts A→F (§43.2). Do not enable a secondary module before its dependency surface is stable (§43.1 order: Tasks core → presentation/detail/create → Calendar → Workbench → Notifications → Documents → Org → global convergence).

1. **Verify prerequisites.** For the target surface: targeted tests green, Q1–Q6 green, pilot feedback collected.
2. **Capture the metric baseline** for the target cohort (see §4). The Wave 0 screenshot baseline (`artifacts/ux-v5-1/baseline/**`) is **not** a metric baseline.
3. **Phase A — local/dev:** set the env override in the dev environment; smoke-test the surface.
4. **Phase B — maintainers/internal test users:** enable for the internal cohort.
5. **Phase C — small representative role sample:** enable for a bounded role sample; watch every halt signal in §4 for the observation window.
6. **Phase D — broader school cohort:** expand if no halt signal fired.
7. **Phase E — default on:** flip the flag's `defaultValue` only via a reviewed code change to `src/features/flags.ts` (not by relying on env).
8. **Phase F — legacy removal:** execute the removal gate (§6).

**Instant hot override (no deploy):** during an incident, `setFeatureFlagOverride(key, false)` disables a surface in-process (highest precedence, above env and default). This is the fastest halt mechanism but is per-process; for a durable halt use the env override.

## 3. Halt procedure

Halt the rollout immediately on a material negative change in any §46 signal (authorization/security errors, task-create failures, approval failures, bulk mutation failures, sync conflicts, service error rate, p75 interaction latency, p75 INP, critical journey completion).

1. **Disable the smallest scope that resolves the signal.**
   - Feature-level halt: unset/disable the surface env override, or `setFeatureFlagOverride(surfaceKey, false)`.
   - Deployment-level halt (P1): follow `docs/operations/rollback.md` §3–§4 (paste back the prior verified container image).
2. **Do not** reverse schema, weaken authorization, delete new data, or re-introduce a P0 defect to "fix" the halt.
3. **Record** the incident against the seeded halt table (`docs/agent-work/decisions/ux-rollout-and-halt.md`): metric / baseline / candidate / severity / owner / rollback action / re-enable criteria.
4. **Re-enable only** when the re-enable criteria for that signal are met (defect fixed + regression test green + same-data re-verify).

## 4. Halt signals & metric baseline capture

The nine §46 halt signals and their owner/severity are tabulated in `docs/agent-work/decisions/ux-rollout-and-halt.md`. Because the Wave 0 baseline contains no performance/error/journey metrics, each `baseline` cell is **capture-required**. Before Phase C of any flag:

- capture the legacy-surface value for each signal on **same-data** (`docs/agent-work/handoffs/BASELINE.md` §3 pinning rules: same route/user/role/dept/scope/viewport/zoom, no reseed between baseline and candidate);
- record it under `artifacts/ux-v5-1/baseline/**` and fill the halt table's `baseline` column;
- **do not invent percentages** (§46).

## 5. Rollback of a flagged surface (config-only)

Rollback of a UX flag is a **configuration** action and, by itself, reverses nothing structural:

```bash
# Durable halt (env): disable the surface for the whole deployment
#   FEATURE_FLAG_UX_TASKS_V5=false   (etc. for the affected surface)
# Hot halt (in-process): setFeatureFlagOverride("<surfaceKey>", false)
```

Because flags gate implementation availability only:

- **Schema**: unaffected — no migration is reversed (`Expand → Migrate → Contract`, `docs/operations/rollback.md` §2).
- **Authorization**: unaffected — flags never gate authorization.
- **User data**: not discarded — the legacy path writes the same schema.
- **P0 defects**: none re-introduced — the legacy path is unchanged.

If a P1 signal is *also* present (e.g. API 5xx > 5%), escalate to the **container rollback** in `docs/operations/rollback.md` §4 in addition to disabling the flag.

## 6. Flag-removal gate (Phase F)

Remove a flag and its legacy path only after **all** hold: targeted tests pass, Q1–Q6 pass, pilot passes, performance acceptable, no blocking telemetry regression, legacy consumer inventory = 0, and `docs/agent-work/UX_MIGRATION_LEDGER.md` records `DELETE_READY` for the surface. Removal is a reviewed code change to `src/features/flags.ts` (drop the key + its `FEATURE_FLAGS` entry) plus the surface's legacy-path deletion by that surface lane.

## 7. References

- `docs/agent-work/decisions/ux-rollout-and-halt.md` — decision + halt table.
- `docs/operations/rollback.md` — container/DB rollback (P1/P2/P3; `Expand → Migrate → Contract`).
- `docs/agent-work/handoffs/BASELINE.md` — Wave 0 same-data baseline.
- `src/features/flags.ts`, `src/config/runtime.ts`, `tests/features/feature-flags.test.ts`.
- Plan §38 (C17), §43 (T92), §46 (T95).
