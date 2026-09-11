# QCET Plan Executor V2.3 Final Architecture Design

**Status:** APPROVED DESIGN / FREEZE CANDIDATE

**Execution runtime:** Ultracode / Claude Code Dynamic Workflows

**Orchestrator:** `.claude/workflows/qcet-plan-executor.js`

**Objective:** Execute an implementation plan as fast as safely possible while preserving requirement coverage, independent review, bounded recovery, deterministic release gating, and reproducible evidence.

## 1. Architectural position

QCET Plan Executor is the sole orchestration layer for plan execution. Superpowers may be used outside the runtime to help author/review plans, but it is not part of the QCET execution path.

The executor MUST remain a standalone Dynamic Workflow script. Do not split it into imported runtime modules: Claude Code Dynamic Workflows do not provide direct filesystem/shell access to the workflow script and do not support module loading. Filesystem durability, claims, checkpoints, and mutation guards belong in hooks or specialized worker actions.

The design deliberately does NOT add Agent Teams, swarm consensus, vector memory, Redis, Temporal, an external scheduler, a second orchestrator, or an LLM-controlled concurrency controller.

## 2. Success definition

A new executor revision is better only if, on comparable live Ultracode runs using the same source commit, plan, runtime profile, and acceptance criteria, it improves at least one of:

- wall-clock duration;
- time-to-first-builder;
- critical-path duration;
- token/agent efficiency;
- repair rounds;
- failure/stall rate;
- confirmed-defect detection;

while never regressing:

- requirement coverage;
- ownership/worktree isolation;
- release-gate correctness;
- unresolved critical/high defect count.

Synthetic simulations are useful for deterministic unit/regression tests but MUST NOT be represented as live speed evidence.

## 3. Final execution flow

```text
IMPLEMENTATION PLAN
        |
        v
RUNTIME FINGERPRINT + PINNED BASE SHA
        |
        v
FAST CALIBRATION -> MANIFEST + DAG
        |
        v
EXECUTION MODE GATE
MICRO | STANDARD | CRITICAL
        |
        v
CHANGE-SURFACE GATE + SHARD CONTRACT
        |
        v
INDEPENDENT PRE-REVIEW (when required)
        |
        v
LANE SCHEDULER
READ | WRITE | VERIFY | GIT-CONTROL
        |
        v
SPECULATIVE READ / JIT CONTEXT
        |
        v
WORKTREE IDENTITY PRECHECK
        |
        v
ATOMIC SHARD/FILE CLAIM
        |
        v
PRE-BUILDER CHECKPOINT
        |
        v
BUILDER
        |
        +--> CONTINUOUS MUTATION GUARD
        +--> RUNTIME FILE-CONFLICT GUARD
        +--> APPEND-ONLY RUN EVENTS
        |
        v
REVIEW TRIGGER
        |
        +--> CONTINUE (low-risk/no trigger)
        |
        +--> CHECKPOINT -> DETERMINISTIC CHECKS -> QCET SKEPTIC
                                               |
                                         PASS / FAIL
                                               |
                                               +--> targeted repair
                                                    -> reverify
                                                    -> rollback/block on stagnation
        |
        v
SHARD PROOF + DEPENDENCY UNLOCK
        |
        v
CROSS-SHARD INTEGRATION REVIEW
        |
        v
GLOBAL VALIDATION
        |
        v
DELIVERY CHECKPOINT + REPRODUCIBLE HEAD PROOF
        |
        v
DETERMINISTIC RELEASE GATE
        |
READY / BLOCKED
```

## 4. Execution modes

Execution mode selection MUST be deterministic from the manifest; an LLM does not choose its own safety level.

### MICRO

Use only when all are true:

- one low-risk shard;
- no auth/RBAC/security-sensitive path;
- no Prisma/schema/migration path;
- no cross-shard dependency;
- no shared-contract boundary;
- change surface under the configured MICRO threshold.

Flow: builder -> deterministic checks -> one targeted skeptic review -> shard/delivery gate.

### STANDARD

Default for multi-file/multi-shard medium-risk work.

Flow: recon/research as needed -> dependency-ready builders -> checkpoint review -> bounded repair -> integration review -> global validation.

### CRITICAL

Mandatory when auth/RBAC/security, Prisma/schema/migration, authorization-sensitive API, high/critical risk, or broad shared contracts are involved.

Requirements:

- worktree isolation required;
- pre-implementation contract review required;
- mid-shard checkpoint review required;
- stronger proof requirements;
- authorization/security verification required;
- delivery HEAD proof required.

## 5. Scheduler design

Replace one undifferentiated concurrency queue with logical lanes while preserving one global hard cap.

Default `high` profile target:

- READ: 3 active slots;
- WRITE: 3 active slots;
- VERIFY: 2 active slots;
- GIT-CONTROL: 1 serialized mutation lane;
- GLOBAL: max 8 active agents by default, hard-clamped to Claude Code runtime maximum 16.

Idle lane capacity may be borrowed, but a ready critical-path WRITE task cannot be starved by speculative READ work.

Git-control serialization applies only to shared git metadata mutations such as worktree creation/removal and checkpoint/ref management. Editing/testing inside isolated worktrees remains parallel.

## 6. Performance strategy

Deterministic optimizations are active immediately:

- MICRO/STANDARD/CRITICAL execution modes;
- critical-path priority;
- agent spawn gate;
- speculative read-only preparation;
- JIT shard context packets;
- recon/evidence reuse keyed by base state;
- fail-fast descendant cancellation after dependency failure;
- lane scheduler and idle-slot borrowing.

Empirical optimizations are implemented but start in SHADOW mode:

- adaptive concurrency recommendation;
- verifier ROI/pruning recommendation;
- dynamic phase-budget recommendation;
- harness-ablation recommendation.

SHADOW components may log recommendations but MUST NOT alter correctness-sensitive behavior until live benchmark evidence promotes them to CANARY/ACTIVE.

## 7. Review architecture

Builder output is never self-approved.

`qcet-skeptic` is reused in three explicit modes instead of adding new reviewer agents:

- `contract`: validate shard contract, testability, dependencies, ownership, and verification plan before implementation when required;
- `implementation`: independently inspect actual repository state, git diff, targeted tests, and requirements at shard checkpoints;
- `integration`: inspect cross-shard contracts and regressions after shard integration.

Review is checkpoint-triggered, not Edit-triggered. `shouldReviewCheckpoint(state)` is deterministic and triggers on risk, schema/auth surfaces, ownership-boundary changes, failing tests, contract changes, or change-surface thresholds.

Deterministic guards block immediately without an LLM reviewer for:

- worktree/cwd identity mismatch;
- out-of-ownership mutation;
- antiOwns violation;
- runtime file-claim conflict;
- forbidden read-only shell mutation;
- malformed required evidence.

## 8. Worktree and mutation safety

Before every mutating `Write`, `Edit`, or mutating `Bash` action from a builder, the hook boundary validates:

- run ID;
- agent/shard identity;
- expected worktree root;
- actual cwd/git root;
- expected base commit ancestry;
- shard ownership/antiOwns;
- runtime file claim.

Failure is fail-closed. Never silently fall back to the parent working tree.

Runtime file claims supplement manifest ownership. The first valid shard to mutate a file claims it for the run. A different shard attempting to mutate the same file is blocked unless an explicit integration-repair ownership packet grants it.

## 9. Durable run state

Because the workflow script cannot directly access the filesystem, durable evidence is produced through hooks and bounded recorder actions rather than an agent call per event.

Canonical per-run artifacts:

```text
.claude/executor-runs/<runId>/
  runtime.json
  manifest.json
  events.jsonl
  claims/
  shards/<shardId>/
    contract.json
    worktree.json
    implemented.json
    proof.json
    verified.json
  checkpoints/
  final.json
```

`events.jsonl` is append-only. Witness files are the durable truth for reconstruction; mutable in-memory status is not sufficient proof.

## 10. Baseline and checkpoints

Every run pins an exact source SHA at startup. All worktrees and strict live comparisons derive from that pinned commit.

Checkpoints are git-backed and content-addressable. For isolated shards, maintain recoverable checkpoint refs for at least:

- pre-builder;
- post-builder/pre-review;
- post-repair when a repair is accepted;
- delivery/integration.

A repair that regresses the proof state can be rolled back to the prior checkpoint rather than asking an agent to reason backward manually.

## 11. Idempotency and recovery

Each expensive phase receives an idempotency fingerprint derived from run ID, shard ID, phase, input-state hash, and pinned base commit.

Possible phase states:

- `COMPLETED`: matching witnessed artifact exists; reuse it;
- `FAILED`: retry if policy permits;
- `UNKNOWN`: previous process/agent may have produced external effects but completion is not proven; inspect witnesses before rerun;
- `NOT_RUN`: execute normally.

When an agent/session fails, recovery uses a fresh agent plus a structured Resume Capsule containing objective, requirements, checkpoint reference, touched files, previous findings, remaining issues, failing checks, and proof references. Claude native workflow resume is an optimization, not the QCET source of durable truth.

## 12. Proof model

A shard is not verified because its builder says it is complete.

Minimum Shard Proof:

- shard ID and pinned base commit;
- changed/touched files;
- diff/checkpoint identity;
- requirement IDs proven;
- targeted check commands and actual exit codes;
- output digests or bounded captured output;
- independent skeptic verdict;
- unresolved finding IDs/severities;
- ownership/worktree/conflict status.

Release requires three gates:

### Shard Gate

All required requirements for the shard are proven, deterministic guards pass, required checks pass, and independent review passes.

### Integration Gate

Cross-shard contracts, overlapping mutations, required global type/lint/tests, and critical-domain invariants pass.

### Delivery Gate

Pinned source SHA and exact delivery checkpoint/HEAD are known, proof bundles are complete, final HEAD/checkpoint is reproducibly validated, and no unresolved critical/high finding remains.

Only the deterministic release gate may emit READY.

## 13. Failure taxonomy

Use canonical machine-readable reasons:

- `DEPENDENCY_BLOCKED`
- `WORKTREE_INVALID`
- `OWNERSHIP_CONFLICT`
- `RUNTIME_FILE_CONFLICT`
- `AGENT_BUDGET_EXHAUSTED`
- `TURN_BUDGET_EXHAUSTED`
- `TOKEN_BUDGET_EXHAUSTED`
- `WALLCLOCK_TIMEOUT`
- `AGENT_STALLED`
- `NETWORK_INTERRUPTED`
- `SCHEMA_INVALID`
- `VERIFICATION_FAILED`
- `REPAIR_STAGNATED`
- `TOOL_FAILURE`
- `RUNTIME_FAILURE`
- `EVIDENCE_INCOMPLETE`

Do not collapse these into generic `blocked` telemetry.

## 14. Progress circuit breaker

Repair progress is measured by a signature over:

- diff/checkpoint hash;
- failing/passing test sets;
- resolved/new/remaining finding IDs;
- proven requirement IDs;
- verification verdict.

Issue count alone is insufficient. On first no-progress cycle, run a targeted falsifying diagnostic. On the second no-progress cycle, open the circuit and rollback/block rather than spending another blind repair round.

## 15. Capability policy

Read-only workers should not have general mutating shell access.

- recon: Read/Grep/Glob/Skill; no general Bash mutation path;
- researcher: WebSearch/WebFetch/Read/Grep/Glob/Skill; no general Bash mutation path;
- skeptic: read-only tools plus a strict allowlist of test/git inspection commands;
- builder: Read/Edit/Write/Bash/Skill with web tools disabled and continuous mutation guard;
- telemetry recorder: write only approved executor-run artifact paths.

External research is treated as untrusted input. Researcher returns structured sourced claims; raw web text is not injected directly into builder instructions when a structured research packet is sufficient.

## 16. Runtime fingerprint and compatibility canary

Every run records at least:

- executor version;
- Claude Code version when available;
- effective model/Ultracode model identifier when available;
- effort level when available;
- Node/npm versions when available;
- OS/architecture when available;
- budget profile/lane limits;
- pinned source commit;
- worktree isolation policy.

Strict A/B benchmark evidence requires comparable runtime fingerprints.

When executor/runtime/agent/hook policy changes materially, run a canary suite before production-sized plans.

## 17. Evaluation

Separate evaluation surfaces:

- `eval:synthetic`: deterministic scheduler/logic simulation;
- `eval:synthetic:benchmark`: synthetic microbenchmark, explicitly labeled synthetic;
- `eval:live:compare`: compare immutable live run telemetry.

Live comparison rejects unpinned source provenance. Use medians across repeated comparable runs; do not claim speed improvement from one lucky run.

Shadow ROI telemetry records reviewer/phase latency, token usage when measured, confirmed findings, false positives when adjudicated, retries, stalls, and defects prevented. It can recommend policy changes but cannot self-modify production correctness policy.

## 18. Fault-injection requirements

The executor is not final until deterministic tests demonstrate fail-closed behavior for at least:

- builder returns null;
- malformed structured output;
- worktree/cwd mismatch;
- stale/wrong base commit;
- ownership missing or violated;
- two shards touch the same file;
- test command fails;
- skeptic crashes/returns null;
- agent/turn/token budget exhaustion;
- dependency failure cancels descendants;
- repair produces no progress;
- telemetry/witness persistence failure;
- incomplete proof bundle;
- unresolved high/critical integration finding.

No injected failure may produce silent READY, infinite retry, or untracked mutation.

## 19. Freeze criteria

Architecture becomes FROZEN when live Ultracode runs demonstrate:

- 100% requirement coverage for benchmark plans;
- zero silent READY;
- zero ownership/worktree escape;
- fault injection is detected and fail-closed;
- crash/retry does not discard already-proven work;
- no unresolved critical/high finding at READY;
- performance is equal to or better than V1.5 on comparable runs;
- every persistent orchestration layer has a measurable safety/performance purpose.

After freeze, orchestration changes require one of:

- a measured performance bottleneck;
- a correctness/reliability failure;
- a material Claude Code/runtime change;

and must ship with regression tests plus comparable evidence.
