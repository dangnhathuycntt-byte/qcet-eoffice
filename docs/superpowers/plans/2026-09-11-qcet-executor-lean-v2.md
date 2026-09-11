# QCET Executor Lean V2 Implementation Plan

> **Execution runtime:** Ultracode / Claude Code Dynamic Workflows.
> **Implementation branch:** `refactor/qcet-executor-lean-v2`
> **Required base:** `af9f55b4`
> **Design Philosophy:** Native-First. Rely on native Claude Code primitives for agent lifecycle, scheduling, worktree provisioning, and session management. Retain QCET-specific domain value: requirement coverage, ownership invariants, adversarial verification, atomic file claims, bounded repair, and deterministic release gates.

---

## Executive Summary & Architectural Scope

The QCET Plan Executor V1.5 and the unexecuted V2.3 proposals accumulated unnecessary platform machinery: custom lane schedulers, shadow git checkpoints, heavy hook-driven event firehoses, and custom worktree process management. These duplicate capabilities already provided natively by Claude Code and Ultracode Dynamic Workflows.

**Lean V2** strips away generic platform duplication and delivers a streamlined, rock-solid executor focused strictly on QCET correctness guarantees:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                       Claude Code Native Runtime                        │
│  - Dynamic Workflows (pipeline, parallel, agent)                        │
│  - Native concurrency capping (min(16, CPUs - 2))                       │
│  - Native worktrees (isolation: 'worktree', baseRef: 'head')            │
│  - Native session management, pause / stop / resume (journal.jsonl)     │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      QCET Domain Value-Add Layer                         │
│  1. Plan → Requirement Manifest (100% mapping, DAG validation)          │
│  2. Ownership Policy (owns / antiOwns glob enforcement)                 │
│  3. Hard Budgets (normalized profiles: low/medium/high, turn limits)    │
│  4. Lightweight Worktree Sanity & Atomic File Claims (claims/<hash>)    │
│  5. Risk-Based Adversarial Verification (qcet-skeptic read-only audit)  │
│  6. Bounded Repair (max 2 rounds per shard, non-self-approving)        │
│  7. Integration & Global Verification (Prisma/RBAC/denominators/tests)  │
│  8. Deterministic Release Gate (binary READY / BLOCKED)                 │
│  9. Lightweight Semantic Evidence (shards/<id>/evidence.json)           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Baseline Mechanism Audit (Commits 17fc5309 to af9f55b4)

The audit of changes introduced in the current feature branch establishes the following classification:

| Commit | Component / Mechanism | Action | Justification |
| :--- | :--- | :--- | :--- |
| **17fc5309** | `normalizeBudgetConfig` (concurrency & total agent caps) | **KEEP** | Essential hard stop preventing API flood and runaway loops. Clamped to `[1, 16]` and `[1, 1000]`. |
| **17fc5309** | `BUDGET_PROFILES` (`low`, `medium`, `high`) | **KEEP** | Standardized execution presets matching workload sizing. |
| **17fc5309** | `laneLimits` in budget config | **TRIM** | Custom lane scheduling queues are redundant with native workflow pipeline concurrency. |
| **17fc5309** | `normalizeFailureReason` (canonical reason enum) | **KEEP** | Prevents loose string matching for blocker diagnosis and gate evaluation. |
| **17fc5309** | `buildRuntimeFingerprint` (provenance metadata) | **KEEP** | Records git SHA, node/npm, Claude Code version, model, and effort for audit and benchmark integrity. |
| **bbe89063** | Agent `maxTurns` limits (`builder: 30`, `recon: 15`, `researcher: 12`, `skeptic: 20`, `telemetry: 4`) | **KEEP** | Strict turn boundaries prevent cycling and context window exhaustion. |
| **bbe89063** | Disallowed tools policy (recon/researcher: no Bash/Write; builder/skeptic: no Web) | **KEEP** | Principle of least privilege; prevents unauthorized out-of-band operations. |
| **bbe89063** | Portable hook paths (`${CLAUDE_PROJECT_DIR}/.claude/hooks/...`) | **KEEP** | Ensures hooks execute correctly across worktrees and varied host environments. |
| **bbe89063** | `isAllowedReadOnlyShellCommand` in ownership guard | **KEEP** | Strict allowlist for read-only agents (`git status/diff/log/show/grep`, `npm test`, `npx tsx --test`). |
| **bbe89063** | Compound/redirection syntax denial (`&&`, `;`, `\|`, `>`, `$()`, etc.) | **KEEP** | Closes shell injection and out-of-band file mutation vectors. |
| **bc27e43f** | `sanitizeRunId` & `getRunDir` | **KEEP** | Guarantees safe path isolation under `.claude/executor-runs/<runId>`. |
| **bc27e43f** | `atomicWriteJson` & `readJson` | **KEEP** | Prevents file corruption during concurrent shard artifact persistence. |
| **bc27e43f** | `writeWitness` | **KEEP** | Records shard worktree root and pinned base commit for ancestry validation. |
| **bc27e43f** | `claimFile` (exclusive atomic file locking via `wx`) | **KEEP** | Prevents race conditions and cross-shard file mutation conflicts. |
| **bc27e43f** | `appendEvent` & `events.jsonl` firehose | **REMOVE** | Generic event tracing duplicates Claude Code native workflow journaling (`journal.jsonl`). |
| **bc27e43f** | `qcet-run-event` hook on `PostToolUse` / `SubagentStart` | **REMOVE** | Hook execution on every single tool invocation adds overhead without domain value. |
| **bc27e43f** | Settings hook subscriptions for all subagent / tool events | **REMOVE** | Unregister `qcet-run-event` from `.claude/settings.json`; retain only security enforcement hooks. |
| **af9f55b4** | `verifyWorktreeIdentity` in ownership guard | **KEEP** | Ensures builders execute in valid worktree derived from legitimate feature base. |
| **af9f55b4** | `claimFile` enforcement on builder Write/Edit | **KEEP** | Enforces fail-closed file ownership before file mutation occurs. |
| **af9f55b4** | Fail-open behavior outside executor runs | **KEEP** | Allows normal developer terminal interaction when `QCET_RUN_ID` is absent. |
| **af9f55b4** | `resolveActiveShard` candidate resolution order | **TRIM / FIX** | Audit found global `/tmp/qcet-active-shards.json` overrides `QCET_ACTIVE_SHARDS`. Must prioritize explicit env and runDir state. |

---

## Scope Exclusions (What Lean V2 Will NOT Build)

1. **NO Custom Worktree Manager:** Claude Code native worktrees (`opts.isolation: 'worktree'`, `worktree: { baseRef: 'head' }`) handle creation, isolation, and teardown. QCET only validates the witness and git ancestry.
2. **NO Custom Scheduler or Lane Queues:** Native JavaScript Promises + native workflow `createConcurrencyLimiter` handle parallel DAG resolution.
3. **NO Adaptive Concurrency Engine:** Static, predictable presets (`low`, `medium`, `high`) clamped to safe host limits (`<= 16`).
4. **NO Custom Resume Engine:** Native Claude Code workflow resume (`resumeFromRunId`) handles re-entry.
5. **NO Hidden Git Checkpointing:** No synthetic git commit stacks or custom rollback scripts.
6. **NO Cancellation / Runtime Platform:** Rely on native workflow abort and stop signal handling.
7. **NO Agent Teams or Second Orchestrators:** Ultracode Dynamic Workflows is the single orchestrator.

---

## Lean V2 Implementation Tasks

### Task 1: Finalize Budget and Runtime Contract
* **Objective:** Establish clean, strict budget normalization and provenance fingerprinting without lane-queue bloat.
* **Changes:**
  - In `.claude/workflows/qcet-plan-executor.js`:
    - Remove `laneLimits` from `BUDGET_PROFILES` and `normalizeBudgetConfig`.
    - Keep `maxConcurrentAgents` (clamped 1–16, default 8).
    - Keep `maxAgents` (clamped 1–1000).
    - Retain `normalizeFailureReason` and `buildRuntimeFingerprint`.
* **Testing:**
  - Update `tests/executor/workflow-executor.test.ts` to assert budget presets and remove references to lane queues.
  - Verify all budget tests pass.

### Task 2: Finalize Agent Permissions, MaxTurns, and Portable Hooks
* **Objective:** Enforce strict tool boundaries, turn caps, and anti-tampering shell policies across all specialized agents.
* **Changes:**
  - Verify `.claude/agents/*.md` frontmatter:
    - `qcet-builder.md`: `maxTurns: 30`, tools: `[Read, Edit, Write, Bash, Skill, NotebookEdit]`, disallowed: `[WebSearch, WebFetch]`.
    - `qcet-recon.md`: `maxTurns: 15`, tools: `[Read, Grep, Glob, Skill]`, disallowed: `[Bash, Write, Edit, NotebookEdit, WebSearch, WebFetch]`.
    - `qcet-researcher.md`: `maxTurns: 12`, tools: `[WebSearch, WebFetch, Read, Grep, Glob, Skill]`, disallowed: `[Bash, Write, Edit, NotebookEdit]`.
    - `qcet-skeptic.md`: `maxTurns: 20`, tools: `[Read, Grep, Glob, Bash, Skill]`, disallowed: `[Write, Edit, NotebookEdit, WebSearch, WebFetch]`.
    - `qcet-telemetry-recorder.md`: `maxTurns: 4`, tools: `[Read, Write]`.
  - In `.claude/hooks/pre-tool-use-ownership-guard`:
    - Maintain `isAllowedReadOnlyShellCommand` allowlist for `qcet-skeptic`.
    - Maintain deny on shell chaining (`&&`, `;`, `|`, `>`) and unsafe git flags (`--ext-diff`, `--output`).
    - Enforce builder shell mutation rejection (forces Write/Edit).
* **Testing:**
  - Run `tests/executor/agent-config.test.ts` and `tests/executor/hooks.test.ts`.

### Task 3: Trim Durable Run-State to Lightweight QCET Evidence
* **Objective:** Eliminate generic event firehose hooks while preserving atomic, crash-resilient QCET evidence artifacts.
* **Changes:**
  - Remove `.claude/hooks/qcet-run-event`.
  - In `.claude/settings.json`: Remove `qcet-run-event` hook registrations under `SubagentStart`, `SubagentStop`, `PostToolUse`, `PostToolUseFailure`.
  - In `.claude/hooks/qcet-run-state.cjs`:
    - Remove `appendEvent` and event logging logic.
    - Keep `sanitizeRunId`, `getRunDir`, `atomicWriteJson`, `readJson`, `writeWitness`, `claimFile`.
  - In `.claude/hooks/pre-tool-use-ownership-guard`:
    - Fix `resolveActiveShard`: Ensure explicit `QCET_ACTIVE_SHARDS` environment variable and run-scoped shard state take precedence over global candidate paths.
    - Deprecate reliance on unisolated `/tmp/qcet-active-shards.json`.
  - Define lean run directory layout:
    ```text
    .claude/executor-runs/<runId>/
    ├── manifest.json                 # Execution manifest (requirements & shard DAG)
    ├── claims/                       # Atomic file claim locks
    │   └── <sha256>.json
    └── shards/
        └── <shardId>/
            ├── worktree.json         # Worktree witness (root & base commit)
            └── evidence.json         # Structured subagent completion evidence
    ```
* **Testing:**
  - Update `tests/executor/run-state.test.ts` and `tests/executor/hooks.test.ts`.
  - Verify zero stale `/tmp` state collisions.

### Task 4: Finalize Native Worktree Configuration & QCET Sanity Guards
* **Objective:** Leverage native Claude Code worktree management while asserting repo sanity, ancestry, and atomic file claims.
* **Changes:**
  - In `.claude/settings.json`: Ensure `"worktree": { "baseRef": "head" }` is present.
  - In `.claude/workflows/qcet-plan-executor.js`: Set `builderOptions.isolation = 'worktree'` when shard requires isolation; let Claude Code natively provision the worktree.
  - In `.claude/hooks/pre-tool-use-ownership-guard`:
    - When `QCET_RUN_ID` is present:
      - Verify `worktree.json` witness exists for active shard.
      - Verify git root matches witness root.
      - Verify base commit ancestry via `git merge-base --is-ancestor <base> HEAD`.
      - On Write/Edit: atomic file claim via `claimFile(runDir, shardId, targetFile)`. If already claimed by another shard, block immediately with `ALREADY_CLAIMED`.
* **Testing:**
  - Run `tests/executor/worktree-guard.test.ts`.
  - Confirm all worktree witness, ancestry, and claim conflict tests pass.

### Task 5: Retain Manifest, DAG, and Requirement Coverage
* **Objective:** Ensure 100% of plan requirements are explicitly mapped, partitioned into independent shards, and executed in topological DAG order.
* **Changes:**
  - Retain `validateManifestCoverage(manifest)`:
    - Fails if any requirement in plan is missing from shards.
    - Fails if any requirement appears in multiple shards.
    - Fails if any requirement lacks acceptance criteria.
  - Retain `validateManifestOwnership(manifest)`:
    - Asserts no unisolated shards have overlapping `owns` globs.
  - Retain topological Promise DAG scheduling in `scheduleShard`:
    - Upstream shards execute first.
    - Downstream shards block until all dependencies achieve `pass` verdict.
* **Testing:**
  - Run `tests/executor/contracts.test.ts`.

### Task 6: Retain Risk-Based QCET-Skeptic Review
* **Objective:** Guarantee that builder code is never self-approved; independent adversarial review evaluates every shard.
* **Changes:**
  - Retain `verifyShard(state, round)`:
    - Low/Medium risk: Single targeted `qcet-skeptic` auditor.
    - High/Critical risk: Parallel multi-skeptic panel (Skeptic 1: Specs/Contracts/Regressions; Skeptic 2: Invariants/Security/Denominators) with arbiter synthesis.
  - Verification schema enforcement (`VERIFY_SCHEMA`):
    - Requires explicit verdict (`pass`, `fail`, `blocked`).
    - Requires mapped requirements checked.
    - Requires structured issues list with severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
* **Testing:**
  - Run `tests/executor/workflow-executor.test.ts` (verification assertions).

### Task 7: Retain Bounded Repair
* **Objective:** Provide automated self-healing for verified defects while strictly bounding iterations to prevent runaway token spend.
* **Changes:**
  - In `runShardWithReconciliation`:
    - If skeptic emits `fail` with confirmed defects:
      - If `round <= maxRepairAttempts` (default 2):
        - Dispatch `qcet-builder` with repair prompt, including specific skeptic findings, file diffs, and invariants.
        - Builder applies targeted fix using Write/Edit.
        - Re-dispatch `verifyShard` for independent re-audit.
      - If `round > maxRepairAttempts`:
        - Mark shard `blocked` with failure reason `VERIFICATION_FAILED`.
        - Halt downstream dependent shards immediately.
* **Testing:**
  - Assert bounded repair limit in `tests/cross-shard-integration-repair.test.ts`.

### Task 8: Retain Integration and Global Validation
* **Objective:** Ensure cross-shard harmony and full repository health before any release gate evaluation.
* **Changes:**
  - In `phase('Integration Review')`:
    - Cluster overlapping files across shards.
    - Dispatch multi-dimensional integration review adapting to risk (Architecture, TypeScript contracts, RBAC security, Denominator separation).
  - In `phase('Global Validation')`:
    - Execute targeted test runner for all modified files.
    - Execute full TypeScript typecheck (`npm run typecheck`).
    - Execute full test suite (`npm test`).
    - Scan for QCET architectural invariants (light-only CSS, zero synthetic metrics, separation of duties).
* **Testing:**
  - Run `tests/executor/release-readiness.test.ts` and `tests/executor/targeted-test-runner.test.ts`.

### Task 9: Retain Deterministic Release Gate
* **Objective:** Produce an unambiguous, binary `READY` or `BLOCKED` verdict backed by cryptographic and execution proof.
* **Changes:**
  - Retain `evaluateDeterministicReleaseGate`:
    - `READY` requires:
      1. All shards have status `passed` and 100% requirement coverage confirmed.
      2. Zero open `CRITICAL` or `HIGH` findings.
      3. Global typecheck exit code 0.
      4. Global test suite exit code 0.
      5. Zero unhandled invariant violations.
    - `BLOCKED` emitted if any condition is unmet, accompanied by canonical failure reasons.
  - Persist final verdict to `.claude/executor-runs/<runId>/gate-verdict.json`.
* **Testing:**
  - Run `tests/executor/eval-grader.test.ts`.

### Task 10: Live Benchmark Methodology
* **Objective:** Establish a repeatable, real-world comparative benchmark comparing native Ultracode, QCET V1.5, and QCET Lean V2.

#### Benchmark Experimental Design

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Benchmark Matrix (3 Arms)                       │
├────────────────────────────────────────────────────────────────────────┤
│ Arm A: Pure Ultracode (Native workflow, generic agents, no QCET layer) │
│ Arm B: QCET V1.5 Hardened (Custom scheduling, heavy hook logging)      │
│ Arm C: QCET Lean V2 (Native workflow + lightweight QCET domain layer)  │
└────────────���───────────────────────────────────────────────────────────┘
```

#### Controlled Variables (Strict Parity)
1. **Source SHA:** Identical base commit `af9f55b4` on `refactor/qcet-executor-lean-v2`.
2. **Workload Plan:** Standardized multi-shard test plan (e.g. adding authenticated audit logging across 3 modules with 6 requirements).
3. **Model & Effort:** `claude-combo[1m]` / `claude-fable-5-1` with reasoning effort `high`.
4. **Environment:** Same physical host machine, Node v22.23.2, npm cache warm.
5. **Acceptance Criteria:** Exact same test assertions and typecheck gates.

#### Measured Quantitative Metrics
1. **Requirement Coverage (%):** Percentage of plan requirements verified complete.
2. **Confirmed Defects:** Count of critical/high defects caught during verification vs escaped to global suite.
3. **Wall Clock Duration (s):** Total elapsed time from calibration to release gate.
4. **Time to First Implementation (s):** Elapsed time until the first builder commits functional code.
5. **Agent Count:** Total agent invocations dispatched.
6. **Measured Tokens:** Actual input, output, and total tokens consumed (from native workflow telemetry).
7. **Repair Rounds:** Number of automated repair cycles executed.
8. **Ownership Violations Prevented:** Count of unauthorized cross-shard writes blocked by ownership guard.
9. **Final Gate Result:** Binary `READY` vs `BLOCKED`.

#### Strict Anti-Synthetic Rule
- No simulated timing or mock metrics.
- Benchmark results must be generated from real end-to-end executions.
- Raw telemetry files and run directories must be archived for verification.

---

## File Modification & Impact Matrix

| File Path | Action | Description |
| :--- | :--- | :--- |
| `.claude/settings.json` | **Update** | Add `"worktree": { "baseRef": "head" }`. Remove `qcet-run-event` hook triggers. |
| `.claude/hooks/qcet-run-event` | **Delete** | Delete redundant generic event hook. |
| `.claude/hooks/qcet-run-state.cjs` | **Update** | Remove `appendEvent`. Keep witness, atomic JSON, and file claim primitives. |
| `.claude/hooks/pre-tool-use-ownership-guard` | **Update** | Prioritize `QCET_ACTIVE_SHARDS` env over global `/tmp`. Enforce worktree & atomic claims. |
| `.claude/workflows/qcet-plan-executor.js` | **Update** | Remove lane queues from budget normalization; stream to lean run directory. |
| `.claude/dist/qcet-plan-executor.bundle.js` | **Rebuild** | Synchronize compiled bundle with updated workflow. |
| `tests/executor/run-state.test.ts` | **Update** | Assert lean run-state primitives without event firehose. |
| `tests/executor/hooks.test.ts` | **Update** | Verify lean hook configuration in `settings.json`. |
| `tests/executor/workflow-executor.test.ts` | **Update** | Validate budget normalization without lane limits. |

---

## Verification Plan & Completion Criteria

1. **Pre-requisite Checks:**
   - Confirm branch is `refactor/qcet-executor-lean-v2`.
   - Confirm base commit `af9f55b4` is an ancestor.
   - Confirm working tree is clean.
2. **Deterministic Test Execution:**
   - Execute all unit and contract tests: `npx tsx --test tests/executor/*.test.ts`.
   - Verify 100% passing tests (83+ tests).
3. **Worktree & Claim Safety:**
   - Verify missing witness blocks with `WORKTREE_INVALID`.
   - Verify wrong git root blocks with `root mismatch`.
   - Verify invalid base ancestry blocks with `ancestry mismatch`.
   - Verify concurrent write to claimed file blocks with `ALREADY_CLAIMED`.
4. **Read-Only Shell Security:**
   - Verify shell commands for skeptic are restricted to allowlist.
   - Verify shell chaining (`&&`, `;`, `|`, `>`) is rejected.
5. **No Synthetic Proof:**
   - Ensure all telemetry structures require live execution proof.

---

## Final Status

`LEAN_V2_PLAN_READY`
