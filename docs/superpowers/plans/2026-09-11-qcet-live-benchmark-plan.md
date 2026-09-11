# QCET Plan Executor — Live Production-Like Benchmark Plan (A/B/C)

> **Document Status**: READY FOR IMPLEMENTATION  
> **Date**: 2026-09-11  
> **Standard**: Anthropic Production-Like Agentic System Evaluation  
> **Location**: `docs/superpowers/plans/2026-09-11-qcet-live-benchmark-plan.md`

---

## 1. Executive Summary & Core Objective

This plan establishes a rigorous, production-grade, empirical benchmark to evaluate three execution modes for QCET E-Office:
1. **Arm A — Pure Ultracode**: Native Claude Code with `/effort ultracode` and zero QCET executor machinery.
2. **Arm B — QCET V1.5 Hardened**: Pinned at commit `3f5e804c` (the battle-tested V1.5 hardened executor).
3. **Arm C — QCET Lean V2 Candidate**: Pinned at commit `02d090e8` (the lean, native-first V2 executor).

### Core Research Questions (Not "Who is faster?", but "What is the optimal routing policy?"):
1. **Low-Risk Adequacy**: Is Pure Ultracode (Arm A) sufficient, faster, and cheaper for small, self-contained tasks without custom QCET governance?
2. **Lean Overhead Reduction**: Does Lean V2 (Arm C) preserve 100% of V1.5's correctness while significantly reducing token waste, wall-clock latency, agent count, and repair loops on medium workloads?
3. **Governance ROI on Critical Tasks**: On high-risk tasks (statutory RBAC, data integrity, migration safety), does QCET governance (Arm B & C) provide enough correctness lift (zero false READY, zero security escapees) to justify its overhead over Pure Ultracode?

---

## 2. Pinned Hardware, Environmental, & Revision Invariants

### 2.1 Pinned Commit Revisions
- **Arm A (Pure Ultracode)**: Native harness, latest Claude Code CLI runtime (`claude --effort ultracode`).
- **Arm B (QCET V1.5)**: Commit SHA `3f5e804c3f5e804cefaef25776d5e1b4b600d83d`.
- **Arm C (QCET Lean V2)**: Commit SHA `02d090e8e8e23c9c7def9826b99c815af74ecf42`.
- **Workload Base Application SHA**: `3f0e5320b67acf5fd814c6a0c49e3b9ff9e09a1c` (clean, committed application base).

### 2.2 Workload vs. Harness Decoupling
To eliminate confounders, every trial begins with **identical product code**:
```text
src/
prisma/
public/
tests/
package.json
package-lock.json
```
Only the execution harness (`.claude/`, `scripts/build-executor-bundle.mjs`, `scripts/run-executor-tests.mjs`, etc.) differs between arms.

### 2.3 Environmental Isolation Rules
- **MacBook Sequential Execution**: All trials run **sequentially**. Never run arms or trials concurrently to prevent CPU throttling, memory paging, and disk I/O interference.
- **Isolated Fresh Directories**: Every single trial runs in a completely fresh directory under `/tmp/qcet-live-bench/<benchmark-id>/<arm>-<task>-r<trial>/`. No workspace or git cache is reused across runs.
- **Pre-Execution Setup**: `npm ci` and fixture initialization are performed prior to starting the timer. Pre-flight dependency installation is not counted toward agent wall-clock execution time.
- **No Background Contention**: No other developer agents, Next.js build daemons, or heavy Docker containers may run concurrently during live trials.

---

## 3. Benchmark Workload Tiers (Fixtures)

We design 3 distinct workload tiers with deterministic acceptance criteria.

```text
benchmarks/live/tasks/
├── small-01/
│   ├── plan.md            # Presented to agent
│   ├── setup.patch        # Applies pre-task state to fixture repo
│   └── grader/            # Isolated test suite (NOT visible to agent)
│       └── verify.mjs
├── medium-01/
│   ├── plan.md
│   ├── setup.patch
│   └── grader/
│       └── verify.mjs
└── critical-01/
    ├── plan.md
    ├── setup.patch
    └── grader/
        └── verify.mjs
```

### 3.1 Workload W1 — SMALL / LOW RISK (`small-01`)
- **Intent**: Determine if QCET executor overhead is unnecessary when native Ultracode can cleanly solve single-module tasks.
- **Scope**: 1-2 requirements, 1 subsystem, 1-3 files modified, 0 DB migrations, 0 auth changes.
- **Example Task**: Academic calendar date-boundary helper correction + associated unit tests in `src/lib/academic-calendar.ts`.
- **Hard Timeout**: 20 minutes.

### 3.2 Workload W2 — MEDIUM / MULTI-MODULE (`medium-01`)
- **Intent**: Test multi-shard coordination, cross-layer contracts (API -> server domain -> UI/test), and bounded repair.
- **Scope**: 4-7 requirements, 3-6 files modified, 2-3 logical shards with dependency edge.
- **Example Task**: Calendar meeting action propagation & attendance verification hook.
- **Hard Timeout**: 60 minutes.

### 3.3 Workload W3 — CRITICAL / AUTH & DATA INTEGRITY (`critical-01`)
- **Intent**: Stress-test statutory RBAC, negative authorization assertions, server truth, and zero-synthetic-data rules.
- **Scope**: 5-8 requirements, auth boundaries, negative security test assertions (403 for invalid roles, disabled accounts blocked), migration check.
- **Example Task**: Document dispatch authorization enforcement with strict statutory titles and data classification isolation.
- **Hard Timeout**: 90 minutes.

---

## 4. Hidden Grader Architecture

The agent's own declaration of `READY` is an assertion, **never the ground truth**.
A trial is evaluated by a standalone, out-of-process grader script that executes only **after** the agent completes its run:

```bash
node benchmarks/live/grade.mjs \
  --task <task-id> \
  --trial-dir /tmp/qcet-live-bench/<benchmark-id>/<arm>-<task>-r<trial>
```

### 4.1 Hidden Grader Schema (`grader-output.json`)
```json
{
  "task": "critical-01",
  "arm": "C",
  "trial": 1,
  "timestamp": "2026-09-11T14:30:00.000Z",
  "requirementsTotal": 7,
  "requirementsPassed": 7,
  "hiddenTestsPassed": true,
  "forbiddenFilesChanged": [],
  "securityAssertionsPassed": true,
  "escapedDefects": 0,
  "ownershipViolations": 0,
  "groundTruth": "PASS",
  "verdictMatch": true,
  "falseReady": false,
  "falseBlocked": false
}
```

### 4.2 Definition of Critical Flaws
- **`falseReady`**: The agent / executor reported `READY`, but the independent hidden grader failed (`groundTruth === "FAIL"`). This is the most severe defect for an autonomous executor.
- **`falseBlocked`**: The agent / executor reported `BLOCKED`, but all requirements and hidden tests actually pass.
- **`escapedDefects`**: The count of negative security tests or boundary regressions that failed in the hidden evaluation suite.

---

## 5. Metrics & Telemetry Specification

Data is collected across four orthogonal dimensions:

| Dimension | Metric | Extraction Method |
| :--- | :--- | :--- |
| **Correctness** (Primary) | `groundTruth` (PASS/FAIL) | Standalone Hidden Grader |
| | `requirementCoverage` (%) | Grader requirement checklist |
| | `falseReady` (boolean) | `agentVerdict === 'READY' && groundTruth === 'FAIL'` |
| | `securityAssertionsPassed` | Negative authorization test results |
| **Speed** | `wallClockMs` | Process start-to-finish duration |
| | `timeToFirstImplementationMs` | Git timestamp of first file change |
| **Efficiency** | `inputTokens` / `outputTokens` | Native Claude Code OTel / Transcript |
| | `totalAgentsDispatched` | Workflow journal / process logs |
| | `repairRounds` | Count of fix iterations executed |
| **Harness Overhead** | `verificationDurationMs` | Time spent running skeptic verifiers |
| | `reconDurationMs` | Time spent in reconnaissance |
| | `builderDurationMs` | Time spent actively writing code |

### Telemetry Configuration
All arms run with native Claude Code telemetry enabled:
```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=console
export OTEL_LOGS_EXPORTER=none
export OTEL_TRACES_EXPORTER=none
```

---

## 6. Latin-Square Block Randomization & Sample Size

To counteract diurnal API latency variation and network jitter, trials run in 3 Latin-Square blocks:

### Block Schedule (27 Sequential Runs):
- **Block 1**:
  - Small: Arm A -> Arm B -> Arm C
  - Medium: Arm A -> Arm B -> Arm C
  - Critical: Arm A -> Arm B -> Arm C
- **Block 2**:
  - Small: Arm B -> Arm C -> Arm A
  - Medium: Arm B -> Arm C -> Arm A
  - Critical: Arm B -> Arm C -> Arm A
- **Block 3**:
  - Small: Arm C -> Arm A -> Arm B
  - Medium: Arm C -> Arm A -> Arm B
  - Critical: Arm C -> Arm A -> Arm B

*(If any tier shows mixed results or delta < 10%, an additional 2 blocks are executed to reach N=5 per arm/tier, for 45 total runs).*

---

## 7. Execution Runbook Per Arm

### 7.1 Arm A — Pure Ultracode
1. Instantiate fresh directory with workload base SHA.
2. Apply task `setup.patch`.
3. Launch Claude CLI with native prompt:
   ```bash
   claude --effort ultracode << 'EOF'
   Implement the attached implementation plan completely:
   $(cat plan.md)
   Verify the result against every acceptance criterion.
   Do not modify files unrelated to the requested change.
   EOF
   ```
4. Record exit status, capture git diff, and run hidden grader.

### 7.2 Arm B — QCET V1.5 Hardened
1. Instantiate fresh directory with workload base SHA.
2. Checkout `.claude/` and executor scripts from SHA `3f5e804c`.
3. Apply task `setup.patch`.
4. Launch executor command:
   ```bash
   claude --effort ultracode -p "/qcet-plan-executor plan.md"
   ```
5. Record exit status, parse run ledger (`.claude/runs/`), and run hidden grader.

### 7.3 Arm C — QCET Lean V2 Candidate
1. Instantiate fresh directory with workload base SHA.
2. Checkout `.claude/` and executor scripts from SHA `02d090e8`.
3. Apply task `setup.patch`.
4. Launch executor command:
   ```bash
   claude --effort ultracode -p "/qcet-plan-executor plan.md"
   ```
5. Record exit status, parse run ledger (`.claude/runs/`), and run hidden grader.

---

## 8. Statistical Aggregation & Production Routing Decision Matrix

Results must report **Median** and **Interquartile Range (IQR)**, not single-run bests.

### 8.1 Decision Criteria
1. **W1 (Small)**:
   - If Arm A correctness == Arm C correctness AND Arm A is >= 15% faster:
     -> **Route Small/Low-Risk tasks directly to Pure Ultracode**.
2. **W2 (Medium)**:
   - Arm C is deemed successful over Arm B if:
     - Correctness(C) >= Correctness(B)
     - `falseReady`(C) <= `falseReady`(B)
     - AND Median wallClock(C) improves >= 10% OR Median tokens(C) improves >= 15%.
3. **W3 (Critical)**:
   - Correctness dominates latency.
   - If Arm A produces any `falseReady` or fails security assertions, Arm C wins decisively if it maintains 100% security correctness.

### 8.2 Target Production Routing Policy Table
```text
Task Risk Profile        | Recommended Production Engine
-------------------------+----------------------------------------------
Small / Low-Risk         | Pure Ultracode (Native Claude Code)
Medium / Multi-Module    | QCET Executor Lean V2 (Arm C)
Critical / Auth & Data   | QCET Executor Lean V2 + Specialized Skeptic
```

---

## 9. Implementation Checklist for Benchmark Harness

- [ ] **Task 1: Benchmark Directory Scaffolding & Shared Runner**
  - Create `benchmarks/live/run-benchmark-suite.mjs` (deterministic Latin-Square controller).
  - Create `benchmarks/live/lib/environment.mjs` (fingerprints host, CPU, OS, Node, Git, Claude CLI).
  - Create `benchmarks/live/lib/git-harness.mjs` (handles worktree creation, commit checkout, and patch injection).
- [ ] **Task 2: Task Fixtures & Hidden Graders**
  - Scaffold `benchmarks/live/tasks/small-01/` (`plan.md`, `setup.patch`, `grader/verify.mjs`).
  - Scaffold `benchmarks/live/tasks/medium-01/` (`plan.md`, `setup.patch`, `grader/verify.mjs`).
  - Scaffold `benchmarks/live/tasks/critical-01/` (`plan.md`, `setup.patch`, `grader/verify.mjs`).
- [ ] **Task 3: Grader Engine & Result Aggregator**
  - Create `benchmarks/live/grade.mjs` (runs post-agent grading and enforces forbidden-file assertions).
  - Create `benchmarks/live/aggregate.mjs` (computes median, IQR, false READY rates, and renders summary markdown).
- [ ] **Task 4: Dry-Run Smoke Test**
  - Run a single smoke test of W1 across Arm A and Arm C to verify environment capture and grader integration.
