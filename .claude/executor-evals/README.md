# QCET Plan Executor — Benchmark & Evaluation Suite

This directory contains the canonical benchmark evaluation schema, documented baseline runs, regression thresholds, and comparison templates for the QCET Plan Executor (`.claude/workflows/qcet-plan-executor.js`).

It implements **Workstream C (Benchmark/Eval Harness)** and **Section 10.5 (Eval & Observability Layer)** of the *QCET Plan Executor — Performance, Intelligence & Reliability Upgrade Plan* (`QCET_PLAN_EXECUTOR_OPTIMIZATION_ROADMAP.md`).

---

## 1. Objectives & Evaluation Methodology

The QCET Plan Executor orchestrates parallel subagent execution across sharded implementation plans with independent verification and bounded repair loops. Optimization iterations (v1.1 through v1.5) must be measured systematically against empirical baselines rather than intuition.

### Core Principle
> **"Judgment in agents; deterministic mechanics in the workflow/harness."**
> Every proposed optimization must survive empirical A/B comparison on representative QCET benchmark plans before merging into production.

The evaluation suite tracks four orthogonal metric categories:

```
                          ┌───────────────────────────┐
                          │   QCET EVAL METRICS       │
                          └─────────────┬─────────────┘
          ┌─────────────────┬───────────┴───────────┬─────────────────┐
          ▼                 ▼                       ▼                 ▼
   1. CORRECTNESS       2. SPEED              3. EFFICIENCY     4. RELIABILITY
   - Req. Coverage      - Wall-Clock Duration - Total Agents    - Null-Agent Rate
   - Invariant Check    - Calibration Time    - Token Usage     - Schema Retry Rate
   - Scope Violations   - Time-to-1st-Builder - Tokens/Req      - No-Progress Rate
   - Unresolved Issues  - Critical-Path Time  - Verifier Tokens - Workflow Reruns
```

---

## 2. Metric Categories & Schema (Roadmap §10.5)

Every benchmark run records the following telemetry payload:

| Metric Group | Field | Type | Description |
| :--- | :--- | :--- | :--- |
| **Identity** | `runId` | string | Unique run identifier (`run-eval-<version>-<domain>-<date>`) |
| | `plan` | string | Target plan path in repository |
| | `executorVersion` | string | Executor version or milestone (`v1.0-baseline`, `v1.1`, `v1.2`, `v1.4`) |
| | `domain` | string | Domain: `ux`, `business-domain`, `data-architecture`, `general` |
| **Correctness** | `requirementsTotal` | integer | Total explicit requirements declared |
| | `requirementsCovered` | integer | Requirements verified and satisfied |
| | `ownershipViolations` | integer | Files modified outside shard `owns` whitelist (must be 0) |
| | `verificationFindings` | integer | Total defects or issues flagged by verifiers |
| | `findingsConfirmed` | integer | Verified true positive issues needing repair |
| | `globalValidation` | enum | Result of global test/typecheck: `"pass"` or `"fail"` |
| | `buildStatus` | enum | Outcome of build validation: `"passed"`, `"failed"`, `"skipped"` |
| | `finalStatus` | enum | Release gate verdict: `"READY"`, `"READY_WITH_KNOWN_ISSUES"`, `"BLOCKED"` |
| **Speed** | `wallClockMs` | integer | Total execution time in milliseconds |
| | `calibrationDurationMs` | integer | Calibration phase duration (decomposer + mapper + synthesizer) |
| | `timeToFirstBuilderMs` | integer | Time until the first implementation subagent starts writing |
| | `criticalPathDurationMs` | integer | Duration of the longest sequential dependency path |
| | `avgDependencyWaitMs` | integer | Average time shards spent waiting on upstream dependencies |
| **Efficiency** | `shards` | integer | Total execution shards in the manifest |
| | `agents` | integer | Total subagents spawned across all phases |
| | `peakConcurrent` | integer | Maximum subagents executing simultaneously |
| | `tokens` | integer | Total token consumption across all agents |
| | `tokensPerVerifiedRequirement` | integer | Average tokens consumed per satisfied requirement |
| | `verifierTokenCost` | integer | Token consumption specifically by skeptic and arbiter agents |
| | `researchEscalationRate` | float | Percentage of shards triggering external web research |
| **Reliability** | `repairRounds` | integer | Total repair iterations executed |
| | `blockedShards` | integer | Shards ending in an unresolvable or blocked state |
| | `nullAgentRate` | float | Fraction of subagent executions returning null or empty |
| | `structuredOutputRetryRate` | float | Fraction of subagent responses needing schema recovery |
| | `noProgressRepairRate` | float | Fraction of repair attempts failing to resolve findings |

---

## 3. Baseline Reference Runs

Documented in `.claude/executor-evals/baseline.json`, these reference runs establish the empirical v1.0 baseline across three canonical QCET implementation plans:

### Run 1: UI/UX Consolidation (`run-baseline-ux-consolidation-01`)
- **Plan**: `docs/plans/active/2026-09-09-master-ux-consolidation-plan.md`
- **Domain**: `ux` (Frontend / Ergonomics / State Architecture)
- **Scope**: 12 Shards (Canonical Routes, Workspace Engine, Toolbars, Detail Canvas, Row Actions, Executive Cockpit, Home Workbench, Mobile 44px, Operations Calendar, Saved Views, Command Palette, Legacy QA Gate).
- **Baseline Telemetry**:
  - Wall-clock: **462s** (7.7 min) | Calibration: **42s**
  - Agents: **46** spawned | Peak concurrent: **5**
  - Tokens: **894,000** | Tokens / Req: **24,833**
  - Requirements: **36 / 36** covered (100%)
  - Ownership violations: **0** | Repair rounds: **4**
  - Global validation: **PASS** | Final status: **READY**

### Run 2: Business Domain Semantics (`run-baseline-business-domain-01`)
- **Plan**: `docs/plans/active/2026-09-09-business-domain-workflow-rebaseline.md`
- **Domain**: `business-domain` (Statutory Authority / Documents / Workflow)
- **Scope**: 7 Shards (Task Domain Commands, Incoming Docs V2, Outgoing Docs & Signatures, Work Dossier, Institutional Governance, Context API & Action Inbox, Acceptance Test Suite).
- **Baseline Telemetry**:
  - Wall-clock: **374s** (6.2 min) | Calibration: **36s**
  - Agents: **28** spawned | Peak concurrent: **4**
  - Tokens: **648,000** | Tokens / Req: **23,142**
  - Requirements: **28 / 28** covered (100%)
  - Ownership violations: **0** | Repair rounds: **3**
  - Global validation: **PASS** | Final status: **READY**

### Run 3: Database Architecture Hardening (`run-baseline-db-hardening-01`)
- **Plan**: `docs/plans/active/2026-09-09-database-architecture-hardening-plan.md`
- **Domain**: `data-architecture` (PostgreSQL / Prisma / Integrity)
- **Scope**: 14 Shards (Referential Actions, Data Lifecycle & Archive, Single Owner Invariant, Atomic Sequence Generation, Check Constraints, OCC, Transaction Boundaries, Idempotency, Audit Trail, Outbox, Indexes, FTS, Runbook, Test Suite).
- **Baseline Telemetry**:
  - Wall-clock: **508s** (8.5 min) | Calibration: **48s**
  - Agents: **54** spawned | Peak concurrent: **5**
  - Tokens: **954,000** | Tokens / Req: **22,714**
  - Requirements: **42 / 42** covered (100%)
  - Ownership violations: **0** | Repair rounds: **5**
  - Global validation: **PASS** | Final status: **READY**

---

## 4. Regression Thresholds & Invariants

Evaluations classify deltas into two policy tiers:

### 4.1. Zero-Tolerance Invariants (Hard Failure)
Any violation triggers an immediate **`REGRESSION_DETECTED`** verdict:
- **Missed Requirements**: `0` tolerated (`run.requirementsCovered === run.requirementsTotal`).
- **Out-of-Scope File Edits**: `0` tolerated (`run.ownershipViolations === 0`).
- **Invalid DAGs**: `0` self-dependencies, cycles, or missing dependencies allowed.
- **Global Validation Failure**: `globalValidation` must be `"pass"`.
- **Release Status**: `finalStatus` must be `"READY"` or `"READY_WITH_KNOWN_ISSUES"`. `"BLOCKED"` is a hard failure.
- **Blocked Shards**: `0` blocked shards allowed.

### 4.2. Bounded Performance Budgets (Soft Tolerances)
Performance regressions exceeding these tolerances trigger **`REGRESSION_DETECTED`**:
- **Wall-Clock Regression**: Maximum `+5.0%` regression against baseline for identical plans without justification.
- **Token Budget**: Maximum `+10.0%` token growth without commensurate coverage expansion.
- **Repair Round Budget**: Maximum `2` repair rounds per shard.
- **Calibration Duration**: Maximum `180,000ms` (3 minutes).
- **Tokens per Requirement**: Maximum `75,000` tokens per verified requirement.
- **Agent Failure Rate**: `nullAgentRate <= 0.0%`, `structuredOutputRetryRate <= 5.0%`.

---

## 5. Step-by-Step Comparison Guide for Future Roadmap Versions

When validating optimizations in future roadmap milestones (v1.1, v1.2, v1.3, v1.4, v1.5):

### Step 1: Execute the Target Benchmark Plan
Run the plan using the candidate executor version:
```bash
# Example invocation via workflow harness
node -e "/* invoke .claude/workflows/qcet-plan-executor.js on target plan */"
```

### Step 2: Populate the Run Telemetry Template
Copy `.claude/executor-evals/run-template.json` to a dedicated run file:
```bash
cp .claude/executor-evals/run-template.json .claude/executor-evals/runs/run-eval-v1.1-ux-$(date +%Y%m%d).json
```
Populate the `run` object with observed telemetry from the execution report.

### Step 3: Compute Deltas & Regression Verdict
Run the automated comparison validator against `.claude/executor-evals/baseline.json`:
```bash
node -e "
const fs = require('fs');
const baseline = JSON.parse(fs.readFileSync('.claude/executor-evals/baseline.json', 'utf8'));
const runEval = JSON.parse(fs.readFileSync('.claude/executor-evals/run-template.json', 'utf8'));

const baseRun = baseline.runs.find(r => r.runId === runEval.comparison.baselineRunId) || baseline.runs[0];
const run = runEval.run;

const deltaWallClockMs = run.wallClockMs - baseRun.wallClockMs;
const deltaWallClockPct = Number(((deltaWallClockMs / baseRun.wallClockMs) * 100).toFixed(2));
const deltaTokens = run.tokens - baseRun.tokens;
const deltaTokensPct = Number(((deltaTokens / baseRun.tokens) * 100).toFixed(2));

const flags = {
  wallClockRegressed: deltaWallClockPct > baseline.regressionThresholds.boundedPerformanceBudgets.wallClockRegressionTolerancePct,
  tokensBudgetExceeded: deltaTokensPct > baseline.regressionThresholds.boundedPerformanceBudgets.tokensRegressionTolerancePct,
  uncoveredRequirements: run.requirementsCovered < run.requirementsTotal || run.requirementsCovered < baseRun.requirementsCovered,
  scopeViolations: run.ownershipViolations > 0,
  correctnessRegressed: run.globalValidation !== 'pass' || run.finalStatus === 'BLOCKED'
};

const hasRegression = Object.values(flags).some(Boolean);
const isImprovement = !hasRegression && (deltaWallClockPct <= -5.0 || deltaTokensPct <= -5.0);
const verdict = hasRegression ? 'REGRESSION_DETECTED' : (isImprovement ? 'IMPROVEMENT' : 'PASS');

console.log('--- QCET EXECUTOR EVALUATION SUMMARY ---');
console.log('Target Plan:', run.plan);
console.log('Executor Version:', run.executorVersion);
console.log('Delta Wall-Clock:', deltaWallClockMs + ' ms (' + deltaWallClockPct + '%)');
console.log('Delta Tokens:', deltaTokens + ' (' + deltaTokensPct + '%)');
console.log('Regression Flags:', JSON.stringify(flags, null, 2));
console.log('Verdict:', verdict);
"
```

### Roadmap Version Targets (§13–§14)
- **v1.1 (Deterministic Manifest Gate)**:
  - 0 missed manifest requirements.
  - 0 invalid DAGs accepted.
  - 0 ownership violations silently allowed.
- **v1.2 (Agent Cohorts & JIT Context)**:
  - Context & token reduction: target **15–30%** on long plans.
  - 0 increase in requirement miss rate.
- **v1.3 (Adaptive Verification & Web Research)**:
  - Web research triggered strictly for genuine external uncertainty.
  - Increased high-risk defect detection without doubling total tokens.
- **v1.4 (Pre-Recon & Dependency Write Gate)**:
  - Time-to-dependent-builder reduction.
  - Wall-clock improvement: target **10%+** before retaining scheduler complexity.
- **v1.5 (Adaptive Worktrees & Hooks)**:
  - Hook false-block rate near zero.
  - Parallel integration repair faster than single repair worker.

---

## 6. Directory Invariants & File Structure

```
.claude/executor-evals/
├── baseline.json        # Official baseline benchmark dataset & schema definition
├── run-template.json    # Standard JSON template for single-run eval & regression comparison
└── README.md            # Comprehensive documentation, metric formulas & runbook
```

**Guardrails**:
- All evaluation artifacts reside inside `.claude/executor-evals/`.
- Never modify workflow scripts (`.claude/workflows/**`), agent definitions (`.claude/agents/**`), hooks (`.claude/hooks/**`), or settings (`.claude/settings.json`) when updating eval records.
