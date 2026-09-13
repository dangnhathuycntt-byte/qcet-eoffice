---
status: superseded
superseded_by: executor retirement (2026-09-13)
note: QCET Plan Executor retired. Recoverable from git tag backup/plan-executor-before-removal. Kept for history only; do not action.
---

# QCET PLAN EXECUTOR — HARDENING & PERFORMANCE COMPLETION PLAN

## Mission

You are continuing work on the existing QCET Plan Executor.

Current target branch:
`feat/executor-hardening-and-optimization`

Primary runtime:
`.claude/workflows/qcet-plan-executor.js`

The previous hardening pass fixed several important correctness issues, but the executor is NOT yet considered fully optimized.

Your goal is NOT to rewrite the executor.

Your goal is to close the remaining runtime gaps so that:
1. Correctness never regresses.
2. Independent work executes with maximum SAFE parallelism.
3. Critical-path work gets priority over speculative work.
4. Pre-recon is truly bounded.
5. Context compression is actually used by runtime agents.
6. Documented executor arguments have real runtime effects.
7. Read-only agents are deterministically read-only.
8. Benchmarks never claim performance that they did not actually measure.
9. Performance claims are backed by reproducible evidence.
10. The final executor remains understandable and maintainable.

---

# NON-NEGOTIABLE INVARIANTS

Do NOT weaken any of the following:
* Requirement coverage must remain 100%.
* Ownership violations must remain 0.
* A dependent shard MUST NOT write until all blocking dependencies have independently verified `pass`.
* High/critical confirmed defects must block release until independently verified resolved.
* Critical-risk shards retain strongest adversarial verification.
* Builder self-report is never sufficient proof of correctness.
* Integration repair must be independently reverified.
* Global validation remains independent of builders.
* Deterministic release gates override optimistic LLM verdicts.
* No synthetic benchmark metric may be presented as an observed production/runtime metric.

Do NOT optimize by simply increasing the number of agents.
Do NOT add agents unless they reduce critical-path time or materially increase correctness.

---

# CURRENT VERIFIED STATE

The following previous fixes appear to be present and MUST be preserved:
* immutable release verdict composition: `agentFinalVerdict → deterministicGate → finalVerdict`
* integration severity normalization
* integration repair followed by independent reverification
* expanded manifest kinds: feature, infrastructure, validation, support, exploratory, migration
* isolation contract
* adaptive verification by shard risk
* HIGH-risk clean dual-skeptic fast path
* CRITICAL dual skeptic + arbiter
* adaptive integration review dimensions
* adaptive effort configuration
* workflow-level VM execution tests
* bundle parity tests

Do not redo these unless a regression test proves they are incorrect.

---

# CURRENT VERIFIED GAPS

The next work must address these concrete gaps:
- GAP 1: `concurrency` is documented but not wired into runtime
- GAP 2: bounded pre-recon is currently bypassed
- GAP 3: EvidencePacket/context compression exists but is not wired into runtime
- GAP 4: read-only Bash guard implementation is not wired into settings
- GAP 5: benchmark reporting is currently misleading

---

# PHASE 0 — ESTABLISH CLEAN BASELINE

Before any implementation:
1. Run `git status --short` and confirm expected branch.
2. Run `npm run typecheck`.
3. Run `npm run test:executor`.
4. Run `npx tsx tests/cross-shard-integration-repair.test.ts`.
5. Run current benchmark `npm run eval:benchmark`.
Record:
- exit code
- speedupRatio
- benchmarkPassed
- context bytes
- agent-call counters
- quality score
Store baseline evidence in ledger before edits.

---

## Task 1: Fix Benchmark Truthfulness First (Shard E1)

Target files:
* `scripts/run-benchmark.mjs`
* `scripts/lib/eval-grader.mjs`
* benchmark tests: `tests/executor/benchmark-reporting.test.mjs` (or add new test file)

Requirements:
- Task 1.1 — Correct console result:
  Replace logic that prints PASS in both branches.
  Expected behavior:
  ```js
  console.log(`Benchmark Passed: ${benchmarkResult.passed ? 'PASSED' : 'FAILED'}`)
  ```
- Task 1.2 — Correct process exit:
  At end of benchmark:
  ```js
  if (!benchmarkResult.passed) {
    process.exitCode = 1
  }
  ```
  Do not throw away the report. The report must still be persisted before failure exit.
- Task 1.3 — Rename misleading benchmark type:
  Current local benchmark is not a real LLM execution benchmark.
  Use a truthful label such as:
  `LOCAL_HARNESS_BENCHMARK` or `SCHEDULER_CONTEXT_MICROBENCHMARK`.
  Do NOT use `REAL_EXECUTION` unless the benchmark actually invokes workflow agents.
- Task 1.4 — Separate metric classes:
  Report separately:
  Observed local metrics: local wall-clock, context bytes, scheduler makespan, local extraction duration.
  Estimated structural metrics: expected agent calls, theoretical verifier calls.
  These MUST be labeled as estimated/calculated. Never call calculated counters "observed agent invocations".
- Task 1.5 — Keep tokens null:
  If no model/runtime token counter exists: `"measuredTokens": null`.
  Do not substitute bytes for tokens. Context bytes may remain a separate metric.
- Tests: Add tests proving:
  * failed speed target outputs `FAILED`
  * benchmark result false produces non-zero process exit
  * report still gets written
  * benchmark type is truthful
  * measured tokens remain null without token telemetry

Commit checkpoint:
`fix(executor): make benchmark gates truthful`

---

## Task 2: Wire Read-Only Bash Guard (Shard E2)

Target files:
* `.claude/settings.json`
* `.claude/hooks/pre-tool-use-ownership-guard` (only if inspection shows bug)
* `tests/executor/hooks.test.ts`

Requirements:
- Current ownership guard must also inspect Bash operations for read-only agents.
  Do NOT duplicate hook logic.
  Wiring in `.claude/settings.json`:
  ```json
  {
    "matcher": "Bash",
    "hooks": [
      {
        "type": "command",
        "command": "./.claude/hooks/pre-tool-use-ownership-guard"
      },
      {
        "type": "command",
        "command": "./.claude/hooks/guard-next-build"
      },
      {
        "type": "command",
        "command": "./.claude/hooks/protect-sensitive-files"
      }
    ]
  }
  ```
  Preserve existing hooks. Check ordering deliberately:
  1. ownership/read-only guard
  2. build safety guard
  3. sensitive-file guard
- Required tests in `tests/executor/hooks.test.ts`:
  Simulate read-only agents executing:
  Allowed: `git status`, `git diff`, `rg`, `npm test`, `npm run typecheck`
  Blocked: `rm`, `mv`, `cp`, `touch`, `sed -i`, `git checkout`, `git reset`, `git clean`, `git apply`, `npm install`, output redirection to repository file.
  Ensure builder behavior remains unaffected except for existing ownership restrictions.

Commit checkpoint:
`fix(executor): enforce read-only bash restrictions`

---

## Task 3: Runtime Scheduling — Bounded Pre-Recon, Real Concurrency & Dependency Pass Gate (Shard E3)

Target files:
* `.claude/workflows/qcet-plan-executor.js`
* `scripts/lib/dag-scheduler.mjs`
* `tests/executor/dag-scheduler.test.mjs`
* `tests/executor/full-workflow-execution.test.ts`
* `tests/executor/bounded-recon.test.mjs` (or similar)
* `tests/executor/runtime-concurrency.test.mjs` (or similar)

Requirements:
1. Make Bounded Pre-Recon Real:
   - Eliminate `scheduleShard(shard)` calling `schedulePreRecon(shard)` for all shards regardless of lookahead.
   - Maintain three logical sets: `completed`, `active`, `reconScheduled`.
   - Compute eligible recon shards dynamically:
     ```js
     function refreshReconFrontier() {
       const eligible = computeEligibleReconShards(manifest, activeShardIds, completedShardIds, lookaheadDepth)
       for (const shardId of eligible) {
         if (!preReconPromises.has(shardId)) {
           schedulePreRecon(shardById.get(shardId))
         }
       }
     }
     ```
   - Call it before shard execution begins, whenever a shard finishes verified PASS, and whenever active/completed frontier changes.
   - Deep-future blocked shards must not launch recon merely because their Promise graph exists.
   - Required DAG fixtures and tests:
     - Linear: `A → B → C → D → E` with `lookaheadDepth = 1`. Initially eligible: A, B. NOT C, D, E. After A PASS: expands to C.
     - Branching: `A → (B, C); B → D; C → E`. Verify frontier updates dynamically.
2. Wire Real Runtime Concurrency:
   - Parse `concurrency` argument (default 6, valid 1..16). Accept both string JSON and object args.
   - Concurrency must guard actual `callAgent` via an async semaphore (`createSemaphore(concurrency)`).
   - Priority or reserved capacity:
     Prevent speculative recon from consuming all slots (e.g. `speculativeReadLimit: 2` or priority queue: P0 release/global, P1 builder/repair, P2 verifier/reverify, P3 reconciliation, P4 ready recon, P5 speculative recon).
   - Do NOT derive concurrency from `os.cpus()`.
   - Enforce or clean up `poolCaps` in `scripts/lib/dag-scheduler.mjs`.
   - Tests: `concurrency = 2` ensures peak active calls <= 2; `concurrency = 1` still completes correctly.
3. Preserve Dependency Pass Gate:
   - Invariant: dependency implementation complete ≠ consumer may start. Independent verification PASS = consumer may start.
   - Regression test: `A → B`. If A has `implementation.status = completed` but `verification.verdict = fail`, B must NEVER call its builder and becomes dependency-blocked.

Commit checkpoint:
`perf(executor): enforce bounded recon frontier and global agent concurrency`

---

## Task 4: Runtime Context — EvidencePacket & Context Compression & Safe Research Cache (Shard E4)

Target files:
* `scripts/lib/adaptive-context.mjs`
* `.claude/workflows/qcet-plan-executor.js`
* `tests/executor/adaptive-context.test.mjs`
* `tests/executor/evidence-packet-lossless.test.mjs`

Requirements:
1. Wire EvidencePacket into Runtime:
   - Receiver 1 (dependent shard): replace raw upstream transcripts with compact dependency evidence (`shardId`, `verificationVerdict`, `changedFiles`, `requirements`, `contractDelta`, `testEvidence`, `unresolvedRisks`).
   - Receiver 2 (verifier): needs `shard identity`, `requirements`, `acceptance criteria`, `ownership`, `changed files`, `implementation summary`, `test evidence`, `relevant contracts`, `research claims`. Does NOT need raw recon prose.
   - Receiver 3 (repair agent): needs `shard ownership`, `confirmed findings`, `current changed files`, `targeted tests`, `requirement mapping`.
   - Receiver 4 (integration reviewer): use compact shard summary per shard.
2. Evidence Loss Protection:
   - Add tests asserting critical fields survive compression: requirement IDs, changed files, acceptance criteria, contract delta, tests, high/critical findings, unresolved risks.
   - Research claim schema check: Ensure `createEvidencePacket` maps `source`, `versionOrDate`, `applicability`, `confidence` correctly without assuming non-existent fields like `sourceUrl`.
3. Research Cache (Safe within-run deduplication):
   - Deduplicate identical research questions within ONE executor run using cache key: `question + source/version context + dependency/framework version`.
   - Track telemetry: `researchCacheHits`, `researchCacheMisses`.

Commit checkpoint:
`perf(executor): use compact runtime evidence packets`

---

## Task 5: Adaptive Verification, Integration Review & Telemetry (Shard E5 Part 1)

Target files:
* `.claude/workflows/qcet-plan-executor.js`
* `scripts/lib/adaptive-context.mjs`
* `tests/executor/adaptive-verification.test.ts`
* `tests/executor/integration-lens.test.ts`
* `tests/executor/telemetry.test.ts`

Requirements:
1. Adaptive Verification Policy & Metrics:
   - LOW: 1 focused verifier
   - MEDIUM: 1 strong verifier
   - HIGH: 2 independent skeptics. If both return `pass` & 0 issues -> clean fast path without arbiter. If disagreement -> invoke arbiter.
   - CRITICAL: retain 2 skeptics + arbiter always.
   - Track metrics: `highRiskFastPathCount`, `arbiterInvocations`, `arbiterAvoided`.
2. Adaptive Integration Review Validation:
   - UI-only files -> `semantics`, `regression`, `ux-accessibility`
   - Auth/API files -> `contracts`, `authorization`, `regression`
   - Prisma/migration files -> `contracts`, `data-integrity`, `regression`
   - Cross-cutting / critical -> broad/full review.
   - Blast radius preference: check `actual implementation.changedFiles` first, fall back to `owns`.
3. True Executor Telemetry:
   - Wall-clock: if runtime provides `startTime` and `endTime`, calculate duration; otherwise `null` (never use calibration duration as wall-clock).
   - Calibration duration: measure only if actual timestamps available, else `null`.
   - Track: `totalAgentCalls`, `peakConcurrent`, `reconCalls`, `researchCalls`, `builderCalls`, `verifierCalls`, `arbiterCalls`, `repairCalls`, `integrationReviewerCalls`, `preReconScheduled`, `preReconAvoided`, `researchCacheHits`, `highRiskArbiterAvoided`. Never fabricate.

Commit checkpoint:
`feat(executor): harden adaptive verification lenses and truthful telemetry`

---

## Task 6: Bundle Consolidation, Final Test Matrix & Verification (Shard E5 Part 2)

Target files:
* `scripts/build-executor-bundle.mjs`
* `.claude/workflows/qcet-plan-executor.js`
* `.claude/dist/qcet-plan-executor.bundle.js`
* `tests/executor/bundle-parity.test.mjs`
* `scripts/run-eval-suite.mjs`

Requirements:
1. Bundle & Parity Sync:
   - Run bundle generator and verify zero drift via `tests/executor/bundle-parity.test.mjs`.
2. Run Complete Verification Matrix:
   - `npm run typecheck`
   - `npm run test:executor`
   - `npx tsx tests/cross-shard-integration-repair.test.ts`
   - `npm run eval:suite`
   - `npm run eval:benchmark`
3. Verify Hard Invariants:
   - requirement coverage = 100%
   - ownership violations = 0
   - unresolved critical defects = 0
   - unresolved high defects = 0
   - invalid DAGs = 0
   - dependency write-gate violations = 0
   - global validation = pass
4. Produce Final Performance & Truthfulness Report:
   - Compare before/after behavior table with measured values.
   - Return final verdict: `READY`, `READY_WITH_KNOWN_ISSUES`, or `BLOCKED`.

Commit checkpoint:
`refactor(executor): consolidate bundle parity and complete hardening`
