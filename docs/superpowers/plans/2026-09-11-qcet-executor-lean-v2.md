# QCET Executor Lean V2 Implementation Plan

> **Execution runtime:** Ultracode / Claude Code Dynamic Workflows
> **Implementation branch:** `refactor/qcet-executor-lean-v2`
> **Required base:** `af9f55b4`
> **Design philosophy:** Native-first. Claude Code owns generic agent lifecycle, worktree lifecycle, workflow execution, pause/stop/resume primitives, and generic runtime management. QCET retains only project-specific governance, safety assertions, evidence, verification, repair, and deterministic release policy.

---

## Goal

Upgrade the current executor baseline into a smaller **QCET Executor Lean V2** that improves correctness and governance without rebuilding Claude Code itself.

Lean V2 must preserve:

- implementation-plan → requirement manifest;
- dependency DAG and requirement coverage;
- shard `owns` / `antiOwns` enforcement;
- QCET architecture/domain invariants;
- hard concurrency / total-agent budgets;
- independent `qcet-skeptic` verification;
- bounded repair;
- integration/global validation;
- deterministic `READY` / `BLOCKED` release gating;
- lightweight semantic evidence and benchmark provenance;
- lightweight fail-closed worktree/file-claim assertions.

Lean V2 must rely on Claude Code native capabilities for:

- subagent creation and lifecycle;
- Dynamic Workflow execution;
- generic parallel execution;
- native worktree creation/teardown;
- workflow monitoring;
- pause/stop/resume primitives;
- generic runtime/session management.

---

## Current Verified Configuration

The Lean V2 branch already contains:

```json
{
  "worktree": {
    "baseRef": "head"
  }
}
```

in `.claude/settings.json`.

Implementation work must **preserve** this setting rather than re-add or replace it.

Before implementation begins, verify:

```bash
git branch --show-current
git merge-base --is-ancestor af9f55b4 HEAD
git status --short
```

Required:

- branch = `refactor/qcet-executor-lean-v2`;
- `af9f55b4` is an ancestor;
- no unrelated uncommitted changes.

Do not use `git reset --hard`.

---

## Native-First Architecture

```text
Implementation Plan
        │
        ▼
QCET Manifest / DAG / Ownership Policy
        │
        ▼
Claude Code Dynamic Workflow Runtime
   ┌────┼───────────────┐
   ▼    ▼               ▼
 recon builder        skeptic
      native worktree
   └────┼───────────────┘
        ▼
QCET bounded repair
        ▼
QCET integration/global validation
        ▼
QCET deterministic release gate
        │
   ┌────┴────┐
   ▼         ▼
 READY     BLOCKED
```

QCET is a **policy/governance layer**, not a replacement runtime.

---

## Baseline Mechanism Audit

Audit scope: commits `17fc5309`, `bbe89063`, `bc27e43f`, `af9f55b4`.

| Component / Mechanism | Action | Reason |
|---|---|---|
| `normalizeBudgetConfig` hard concurrency / agent caps | **KEEP** | QCET-specific deterministic cost/runaway protection. |
| `BUDGET_PROFILES` | **KEEP** | Stable operator presets. |
| `laneLimits` | **TRIM** | Do not build lane queues or a second scheduler. |
| `normalizeFailureReason` | **KEEP** | Stable blocker taxonomy for deterministic gates/telemetry. |
| `buildRuntimeFingerprint` | **KEEP** | Reproducible live benchmark provenance. |
| Agent `maxTurns` | **KEEP** | Bounded agent execution. |
| Tool/disallowed-tool policy | **KEEP** | Least-privilege worker boundaries. |
| Portable `${CLAUDE_PROJECT_DIR}` hook paths | **KEEP** | Worktree-safe hook invocation. |
| Read-only Bash allowlist | **KEEP** | Fail-closed shell policy for verifier roles. |
| Compound shell/redirection denial | **KEEP** | Prevents mutation escape through Bash. |
| `sanitizeRunId`, `getRunDir` | **KEEP** | Safe run-scoped evidence paths. |
| `atomicWriteJson`, `readJson` | **KEEP** | Small persistence primitive used by QCET evidence. |
| `writeWitness` | **KEEP** | Worktree/base provenance for QCET mutation guard. |
| `claimFile` | **KEEP** | Prevents simultaneous cross-shard mutation of the same file. |
| `appendEvent` / generic `events.jsonl` firehose | **REMOVE** | Per-tool tracing adds hook/I/O overhead and is not consumed by QCET correctness/release gates. Do **not** justify this with an unverified `journal.jsonl` claim. |
| `qcet-run-event` on every tool/subagent event | **REMOVE** | High-frequency generic tracing with no required domain-gate value. |
| Generic event hook registrations | **REMOVE** | Keep security/evidence enforcement hooks only. |
| `verifyWorktreeIdentity` | **KEEP** | Cheap defense-in-depth around native worktree execution. |
| File-claim enforcement on Write/Edit | **KEEP** | Deterministic cross-shard conflict prevention. |
| Fail-open behavior outside executor runs | **KEEP** | Normal developer sessions remain unaffected. |
| Global `/tmp` shard-state fallback precedence | **FIX/TRIM** | Explicit/run-scoped state must win; avoid stale cross-run state collisions. |

---

## Explicit Scope Exclusions

Lean V2 will **not** build:

1. a custom worktree lifecycle manager;
2. a custom lane scheduler;
3. adaptive concurrency control;
4. a generic resume engine;
5. hidden git checkpoint/rollback infrastructure;
6. a custom cancellation/runtime platform;
7. agent lease/watchdog infrastructure;
8. ROI/self-tuning policy compilation;
9. Agent Teams/swarm consensus;
10. another orchestrator.

Native Claude Code primitives should be configured and used directly whenever they already solve the generic runtime problem.

---

# Implementation Tasks

## Task 1 — Finalize Budget and Runtime Contract

**Files**

- Modify: `.claude/workflows/qcet-plan-executor.js`
- Modify: `tests/executor/workflow-executor.test.ts`
- Regenerate: `.claude/dist/qcet-plan-executor.bundle.js`

**Keep**

```text
maxConcurrentAgents: clamp 1..16
maxAgents: clamp 1..1000
budget profiles: low / medium / high
failure taxonomy
runtime fingerprint
```

**Remove**

```text
laneLimits
lane scheduling assumptions
```

**TDD**

1. Update tests so budget profiles no longer expect lane limits.
2. Run:

```bash
npx tsx --test tests/executor/workflow-executor.test.ts
```

Expected before implementation: RED where lane limits are still part of the contract.

3. Remove lane-limit output/consumers without changing existing hard global caps.
4. Run the same test again; expected GREEN.
5. Rebuild executor bundle.

**Acceptance**

- string and object budget forms still work;
- unknown profile fails closed;
- no scheduler/lane abstraction is introduced.

---

## Task 2 — Finalize Agent Permissions, MaxTurns, and Portable Hooks

**Files**

- Verify/modify: `.claude/agents/qcet-builder.md`
- Verify/modify: `.claude/agents/qcet-recon.md`
- Verify/modify: `.claude/agents/qcet-researcher.md`
- Verify/modify: `.claude/agents/qcet-skeptic.md`
- Verify/modify: `.claude/agents/qcet-telemetry-recorder.md`
- Verify/modify: `.claude/hooks/pre-tool-use-ownership-guard`
- Modify tests only where current behavior differs from the required contract.

**Required policy**

```text
builder       maxTurns 30
recon         maxTurns 15
researcher    maxTurns 12
skeptic       maxTurns 20
telemetry     maxTurns 4
```

Recon/researcher remain non-mutating. Skeptic Bash remains deny-by-default except the existing explicit read-only/test allowlist. Builder shell mutation remains blocked so file mutations flow through Write/Edit and ownership checks.

**Verification**

```bash
npx tsx --test tests/executor/agent-config.test.ts tests/executor/hooks.test.ts
```

Do not add new runtime machinery if current committed behavior already satisfies the tests.

---

## Task 3 — Trim Durable Run State to Lightweight QCET Evidence

**Files**

- Delete: `.claude/hooks/qcet-run-event`
- Modify: `.claude/settings.json`
- Modify: `.claude/hooks/qcet-run-state.cjs`
- Modify: `.claude/hooks/pre-tool-use-ownership-guard`
- Modify: `tests/executor/run-state.test.ts`
- Modify: `tests/executor/hooks.test.ts`

**Remove**

- generic `appendEvent` tracing;
- `events.jsonl` firehose;
- `qcet-run-event` registrations from `SubagentStart`, `PostToolUse`, `PostToolUseFailure`, and `SubagentStop`.

Reason: the generic event stream imposes per-event hook/filesystem overhead and is not required by QCET correctness, ownership, release gating, benchmark provenance, or manual recovery.

Do **not** claim Claude Code exposes a documented `journal.jsonl` replacement unless that is independently verified from official documentation.

**Keep minimal evidence layout**

```text
.claude/executor-runs/<runId>/
├── manifest.json
├── claims/
│   └── <hash>.json
├── shards/
│   └── <shardId>/
│       ├── worktree.json
│       └── evidence.json
└── gate-verdict.json
```

**Fix state precedence**

Priority must be:

```text
explicit run/shard environment
→ run-scoped state
→ session-scoped state when unavoidable
→ legacy global /tmp fallback only for backward compatibility
```

Global `/tmp/qcet-active-shards.json` must never override explicit/run-scoped state.

**Verification**

```bash
npx tsx --test tests/executor/run-state.test.ts tests/executor/hooks.test.ts
```

Add regression coverage proving stale global state cannot hijack an active run.

---

## Task 4 — Finalize Native Worktree Configuration and QCET Sanity Guards

**Files**

- Verify: `.claude/settings.json`
- Modify only if necessary: `.claude/workflows/qcet-plan-executor.js`
- Modify: `.claude/hooks/pre-tool-use-ownership-guard`
- Test: existing/new worktree guard tests.

**Native worktree rule**

Preserve:

```json
{
  "worktree": {
    "baseRef": "head"
  }
}
```

Use Claude Code native worktree creation/lifecycle. QCET does not create a second worktree manager.

When a shard is isolated, the workflow may request native `isolation: 'worktree'`; QCET guards only validate invariants before mutation.

**Mutation guard**

Inside an executor run, before Write/Edit:

- resolve active shard from explicit/run-scoped state;
- verify worktree witness exists when isolation is expected;
- verify actual git root matches witness root;
- verify expected base is an ancestor of current HEAD;
- enforce `owns` / `antiOwns`;
- atomically claim the target file;
- block if another shard owns the claim.

Outside executor runs, existing developer behavior remains unaffected.

**Verification**

Cover at minimum:

- missing witness;
- wrong git root;
- invalid base ancestry;
- two shards claiming one file;
- valid native worktree mutation;
- non-executor normal development path.

---

## Task 5 — Preserve Manifest, DAG, Requirement Coverage, and Ownership Semantics

Do not rewrite working V1.5 logic simply to rename it Lean V2.

Retain and regression-test:

- requirement IDs are unique;
- every plan requirement is mapped to at least one implementing shard;
- shard requirement references are valid;
- non-infrastructure work cannot silently contain zero requirements;
- dependency references are valid and cycles are rejected;
- downstream mutation waits for required upstream verification;
- unisolated mutable `owns` overlaps are rejected;
- `antiOwns` remains enforceable.

Do **not** add a new scheduler. Preserve the current dependency-aware Promise/DAG execution where it is already correct.

---

## Task 6 — Risk-Proportional Independent Verification

**Principle:** builder output is never self-approved.

Use one independent `qcet-skeptic` for every implementing shard.

### Low / Medium

```text
1 qcet-skeptic
→ targeted requirements/contracts/regression review
```

### High

```text
1 qcet-skeptic
→ stronger deterministic rubric based on the actual risk surface
```

Examples: authorization boundaries, schema compatibility, public API contracts, caller regressions.

### Critical auth/security/data

```text
qcet-skeptic
+
optional specialized domain verifier
```

The second verifier is dispatched **only when deterministic risk policy requires it**, such as security/auth authorization logic, destructive data/schema migration, or another explicitly classified critical domain.

Do **not** spawn multiple generic skeptics merely because risk is `high` or `critical`.

Verification output must remain structured and include:

- verdict: `pass | fail | blocked`;
- requirements checked;
- confirmed issues;
- severity;
- evidence/failure scenario.

---

## Task 7 — Preserve Bounded Repair

Maximum default repair attempts per shard: **2**.

Flow:

```text
independent verification fail
→ targeted builder repair using confirmed findings
→ independent re-verification
→ optional second bounded repair if progress exists
→ BLOCKED if unresolved / stagnant
```

Builder never validates its own repair.

Do not add a generic rollback/checkpoint framework.

Regression tests must prove:

- repair is bounded;
- downstream shards do not treat failed verification as satisfied;
- persistent failure ends in canonical `VERIFICATION_FAILED` or `REPAIR_STAGNATED`.

---

## Task 8 — Preserve Integration Review and Global Validation

Keep adaptive integration verification, but do not automatically create reviewer panels for ordinary changes.

Required global proof should include the checks relevant to the change, including existing QCET commands such as:

```bash
npm run typecheck
npm run lint
npm test
```

when they are part of the release policy for the run.

Integration/global verification must distinguish:

- newly introduced failures;
- verified pre-existing unrelated failures;
- unresolved high/critical findings caused or exposed by the current change.

A failure may only be labeled `preExisting` with concrete baseline evidence. The executor must never skip or weaken a check merely to classify it as pre-existing.

---

## Task 9 — Refine Deterministic READY / BLOCKED Semantics

Retain `evaluateDeterministicReleaseGate`, but use regression-aware semantics.

### READY requires all of the following

1. **100% required requirement coverage** is proven by successfully verified implementing shards.
2. Every required shard reaches successful independent verification.
3. No unresolved **new blocking finding** remains.
4. No unresolved relevant `high` / `critical` finding remains.
5. Every validation check required by this change/run passes.
6. No ownership, anti-ownership, worktree identity, or file-claim violation remains.
7. No regression introduced by the current run remains unresolved.
8. Required evidence artifacts are present and internally consistent.

### Pre-existing failures

A demonstrably pre-existing, unrelated repository failure may be recorded as `preExisting` and does **not automatically become a newly introduced blocker**.

To classify a failure as pre-existing, the run must retain baseline evidence showing the same failure existed before the current change. Classification must never be used to weaken a security/correctness check or hide a changed failure.

### BLOCKED

Emit `BLOCKED` when any required READY condition fails, with canonical failure reasons and concrete evidence.

Builder or reviewer prose cannot override deterministic blockers.

**Persistence**

Write the final semantic verdict to:

```text
.claude/executor-runs/<runId>/gate-verdict.json
```

---

## Task 10 — Real Live Benchmark: Pure Ultracode vs V1.5 vs Lean V2

Benchmark only **after Lean V2 passes its regression suite**.

### Arms

```text
A — Pure Ultracode / Claude Code native execution
B — QCET V1.5 hardened
C — QCET Lean V2
```

### Controlled variables

The **workload/application source fixture** must be identical across all three arms.

Pin and record separately:

- workload source commit/fixture SHA;
- executor revision for Arm B;
- executor revision for Arm C;
- actual Ultracode/Claude Code version;
- actual model identifier/alias available to the run;
- effort level;
- machine/OS/Node/npm;
- implementation plan;
- acceptance criteria;
- relevant cache/warm-up policy.

Do **not** claim that all three arms share the same executor SHA; they intentionally compare different execution policies.

Do not hardcode a model name in the benchmark plan. Use the actual runtime fingerprint and require the same model/effort across comparable runs.

### Workloads

Use at least three representative classes:

```text
small     — low-risk focused change
medium    — multi-module dependency plan
critical  — auth/security/data-sensitive plan
```

Prefer repeat runs per arm/workload. Compare medians and failure/defect rates rather than a single fastest result.

### Metrics

Measure only real values:

- requirement coverage;
- confirmed defects caught during verification;
- escaped defects found by final/global proof;
- wall-clock duration;
- time to first useful implementation;
- total agent invocations;
- measured tokens when available;
- repair rounds;
- ownership/worktree violations prevented;
- final deterministic gate result.

### Anti-synthetic rule

Synthetic/simulated durations or token estimates may test benchmark code, but they must never be presented as evidence that one harness is faster or better.

Archive raw run evidence sufficient to reproduce the comparison.

---

# File Impact Matrix

| File | Expected action |
|---|---|
| `.claude/settings.json` | Preserve `worktree.baseRef = head`; remove generic `qcet-run-event` registrations only. |
| `.claude/hooks/qcet-run-event` | Delete. |
| `.claude/hooks/qcet-run-state.cjs` | Remove event firehose; retain minimal atomic evidence/claim primitives. |
| `.claude/hooks/pre-tool-use-ownership-guard` | Fix state precedence; retain worktree/ownership/file-claim guards. |
| `.claude/workflows/qcet-plan-executor.js` | Remove lane-limit contract; retain manifest/DAG/verification/repair/release logic. |
| `.claude/dist/qcet-plan-executor.bundle.js` | Regenerate after workflow changes. |
| `tests/executor/run-state.test.ts` | Update for lean evidence model. |
| `tests/executor/hooks.test.ts` | Verify lean hook config and fail-closed guards. |
| `tests/executor/workflow-executor.test.ts` | Verify budget/release/risk policy changes. |
| Agent markdown files | Modify only if current committed frontmatter fails the required policy. |

---

# Execution Order

```text
Task 1 budget contract ─────┐
Task 2 agent policy ────────┼─ may proceed independently if file ownership is disjoint
Task 3 evidence trim ───────┘
             │
             ▼
Task 4 worktree/state guards
             │
             ▼
Task 5 manifest/DAG regression proof
             │
             ▼
Task 6 risk-proportional verification
             │
             ▼
Task 7 bounded repair
             │
             ▼
Task 8 integration/global validation
             │
             ▼
Task 9 deterministic release semantics
             │
             ▼
Full executor regression suite
             │
             ▼
Task 10 live 3-arm benchmark
```

Do not parallelize tasks that edit `.claude/workflows/qcet-plan-executor.js` against each other without isolated worktrees and explicit integration order.

---

# Verification Before Lean V2 Completion

Run the repository-supported executor checks, then full harness/repository validation required by the current branch.

At minimum:

```bash
npm run test:executor
npm run build:executor
npm run verify
git diff --check
```

Also run targeted tests introduced/modified by this plan before the full suite.

Completion requires:

- executor tests pass;
- generated bundle matches source;
- no unresolved ownership/worktree guard regression;
- deterministic gate regression tests pass;
- no generic event-firehose hook remains;
- `worktree.baseRef` remains `head`;
- no custom scheduler/resume/worktree lifecycle engine was added;
- live benchmark is clearly separated from synthetic test data.

---

# Freeze Rule

Do not create a future V2.x feature merely because another orchestration idea is available.

After Lean V2 is proven, further harness complexity requires at least one of:

- a measured performance bottleneck;
- a demonstrated correctness/ownership/isolation failure;
- a repeated recovery failure;
- a material Claude Code/Ultracode runtime change.

The default decision after Lean V2 should be **freeze and measure**, not expand.

---

## Final Plan Status

`LEAN_V2_PLAN_REVIEWED`
