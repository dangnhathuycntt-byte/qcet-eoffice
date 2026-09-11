# QCET Plan Executor V2.3 Final Implementation Plan

> **Execution runtime:** Ultracode / Claude Code Dynamic Workflows. Execute this plan through the QCET Plan Executor itself. Superpowers is a planning aid only and MUST NOT become part of the harness runtime. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing V1.5 executor into the V2.3 freeze candidate: faster proportional execution, independent mid-run review, continuous worktree/ownership safety, durable proof/recovery, and reproducible live evaluation.

**Architecture:** Preserve `.claude/workflows/qcet-plan-executor.js` as the single standalone Dynamic Workflow. The workflow owns orchestration and in-memory scheduling; Node hooks own filesystem durability/enforcement because Dynamic Workflows have no direct filesystem/shell access and cannot load modules. Builder output is never self-approved; deterministic guards plus independent `qcet-skeptic` reviews produce proof consumed by three deterministic release gates.

**Tech Stack:** Claude Code Dynamic Workflows, JavaScript, Node.js 20+, TypeScript tests via `tsx`, Git worktrees/refs, existing QCET hooks/agents, npm scripts.

**Spec:** `docs/superpowers/specs/2026-09-11-qcet-plan-executor-v23-design.md`

## Global Constraints

- Do not split the workflow into runtime imports or add `import()`.
- Do not add Agent Teams, swarm consensus, Redis, Temporal, vector memory, a second orchestrator, or LLM-controlled scheduling/concurrency.
- Do not change QCET product code under `src/` or Prisma application schema for this harness upgrade.
- Clamp concurrent agents to `<= 16` and total agent calls to `<= 1000`.
- All correctness-sensitive policy is deterministic; empirical optimizers start in `shadow` mode.
- Builder completion is not verification. Only independent review plus deterministic proof gates may unblock dependencies or emit READY.
- Synthetic evaluation must be labeled synthetic and must never be presented as live speed evidence.
- Every implementation task follows TDD: failing targeted test, confirm RED, minimal implementation, confirm GREEN, commit.
- Regenerate `.claude/dist/qcet-plan-executor.bundle.js` after every workflow change.

## Dependency DAG

```text
Task 0 Baseline
  +--> Task 1 Budget/runtime provenance
  +--> Task 2 Agent/hook capability hardening
  +--> Task 3 Durable run-state primitives
          +--> Task 4 Continuous worktree + file claims
          +--> Task 5 Execution modes + change surface + spawn gate
                   +--> Task 6 Lane scheduler + cancellation
                   +--> Task 7 Shard contract + mid-run review
                             +--> Task 8 Proof bundle + shard gate
                                       +--> Task 9 Checkpoints + recovery
                                       +--> Task 10 Integration/delivery gates
Task 1 + Task 3 --> Task 11 Live telemetry/evaluation
Task 4 + Task 7 + Task 8 + Task 9 + Task 10 --> Task 12 Fault injection/canary
Task 6 + Task 11 --> Task 13 Shadow performance analysis
Tasks 1-13 --> Task 14 Full gate/live smoke/freeze
```

Tasks 1, 2, and 3 may run in parallel. After that, workflow-heavy tasks integrate sequentially even when researched in parallel, because `.claude/workflows/qcet-plan-executor.js` is intentionally one standalone script.

---

### Task 0: Establish the V1.5 Baseline

**Files:** read-only `.claude/workflows/qcet-plan-executor.js`, `.claude/hooks/*`, `.claude/agents/*`, `tests/executor/*`, `package.json`.

**Produces:** clean baseline SHA and passing regression/build evidence.

- [ ] Run:

```bash
git switch fix/qcet-plan-executor-v1.5-hardening
git status --short
printf '%s\n' "$(git rev-parse HEAD)" > /tmp/qcet-v15-base-sha
npm ci
npm run test:executor
npm run build:executor
git diff --exit-code .claude/dist/qcet-plan-executor.bundle.js
```

Expected: clean tree before work, all executor tests pass, bundle is reproducible. Do not commit this task.

---

### Task 1: Canonical Budget Profiles, Failure Reasons, and Runtime Provenance

**Files:**
- Modify: `.claude/workflows/qcet-plan-executor.js`
- Modify: `.claude/skills/qcet-plan-executor/SKILL.md`
- Modify: `tests/executor/workflow-executor.test.ts`
- Regenerate: `.claude/dist/qcet-plan-executor.bundle.js`

**Interfaces:**

```js
normalizeBudgetConfig(input) -> {
  profile,
  maxConcurrentAgents,
  maxAgents,
  laneLimits: { read, write, verify, gitControl }
}
normalizeFailureReason(value) -> canonical string
buildRuntimeFingerprint(input) -> serializable provenance object
```

- [ ] Add failing tests for exact budget presets:

```js
const BUDGET_PROFILES = {
  low:    { maxConcurrentAgents: 4, maxAgents: 40,  laneLimits: { read: 2, write: 1, verify: 1, gitControl: 1 } },
  medium: { maxConcurrentAgents: 6, maxAgents: 72,  laneLimits: { read: 2, write: 2, verify: 2, gitControl: 1 } },
  high:   { maxConcurrentAgents: 8, maxAgents: 128, laneLimits: { read: 3, write: 3, verify: 2, gitControl: 1 } },
};
```

Tests must prove `high` resolves to `8/128`, object overrides work, concurrency `99` clamps to `16`, agents `5000` clamp to `1000`, and unknown profile `turbo` throws.

- [ ] Add failing tests for this exact failure taxonomy:

```js
const FAILURE_REASONS = new Set([
  'DEPENDENCY_BLOCKED', 'WORKTREE_INVALID', 'OWNERSHIP_CONFLICT',
  'RUNTIME_FILE_CONFLICT', 'AGENT_BUDGET_EXHAUSTED',
  'TURN_BUDGET_EXHAUSTED', 'TOKEN_BUDGET_EXHAUSTED',
  'WALLCLOCK_TIMEOUT', 'AGENT_STALLED', 'NETWORK_INTERRUPTED',
  'SCHEMA_INVALID', 'VERIFICATION_FAILED', 'REPAIR_STAGNATED',
  'TOOL_FAILURE', 'RUNTIME_FAILURE', 'EVIDENCE_INCOMPLETE',
]);
```

Unknown reasons normalize to `RUNTIME_FAILURE`.

- [ ] Confirm RED:

```bash
npx tsx --test tests/executor/workflow-executor.test.ts
```

- [ ] Implement `normalizeBudgetConfig`, clamping every lane to `1..maxConcurrentAgents`; replace current direct optional reads from `budgetConfig`.

- [ ] Implement `buildRuntimeFingerprint` with nullable values only; never fabricate unavailable runtime/model/version data:

```js
function buildRuntimeFingerprint(input = {}) {
  return {
    executorVersion: input.executorVersion || 'v2.3',
    claudeCodeVersion: input.claudeCodeVersion || null,
    model: input.model || null,
    effort: input.effort || null,
    nodeVersion: input.nodeVersion || null,
    npmVersion: input.npmVersion || null,
    os: input.os || null,
    arch: input.arch || null,
    budgetProfile: input.budgetProfile || null,
    maxConcurrentAgents: input.maxConcurrentAgents ?? null,
    maxAgents: input.maxAgents ?? null,
    sourceCommit: input.sourceCommit || null,
    worktreeIsolation: input.worktreeIsolation ?? null,
  };
}
```

- [ ] Update `SKILL.md` with both invocation forms:

```json
{"budget":"high"}
```

```json
{"budget":{"profile":"high","maxConcurrentAgents":8,"maxAgents":128}}
```

- [ ] Verify/commit:

```bash
npx tsx --test tests/executor/workflow-executor.test.ts
npm run build:executor
git add .claude/workflows/qcet-plan-executor.js .claude/skills/qcet-plan-executor/SKILL.md tests/executor/workflow-executor.test.ts .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): normalize budgets and runtime provenance"
```

---

### Task 2: Fail-Closed Agent Capabilities, Portable Hooks, and Bounded Turns

**Files:** modify `.claude/agents/qcet-recon.md`, `qcet-researcher.md`, `qcet-skeptic.md`, `qcet-builder.md`, `qcet-telemetry-recorder.md`, `.claude/settings.json`, `.claude/hooks/pre-tool-use-ownership-guard`, `tests/executor/hooks.test.ts`; create `tests/executor/agent-config.test.ts`.

**Required policy:**

```text
qcet-recon        maxTurns 15  tools Read/Grep/Glob/Skill, no Bash
qcet-researcher   maxTurns 12  tools WebSearch/WebFetch/Read/Grep/Glob/Skill, no Bash
qcet-skeptic      maxTurns 20  Read/Grep/Glob/Bash/Skill with strict Bash allowlist
qcet-builder      maxTurns 30  current builder tools, WebSearch/WebFetch denied
telemetry         maxTurns 4
```

- [ ] Add failing config tests that parse agent frontmatter and assert the policy above plus `${CLAUDE_PROJECT_DIR}/.claude/hooks/` prefixes for every hook command.

- [ ] Add failing shell-policy tests. Read-only Bash allowlist is limited to:

```text
git status
git diff
git log
git show
git grep
git rev-parse
git ls-files
npm run typecheck
npm run lint
npm test
npm run test
npx tsx --test
```

Block compound/redirection syntax `&&`, `||`, `;`, `|`, `>`, `<`, backticks, `$(` and risky `git diff --ext-diff`, `--no-index`, `--output`. Explicitly test blocking `git add`, `git commit`, `npm install`, `mkdir`, `chmod`, `touch`, inline `node -e`, inline `python -c`.

- [ ] Confirm RED:

```bash
npx tsx --test tests/executor/hooks.test.ts tests/executor/agent-config.test.ts
```

- [ ] Implement `isAllowedReadOnlyShellCommand(command)` in the ownership guard and make read-only Bash deny-by-default.

- [ ] Apply maxTurns/tool changes and portable hook paths.

- [ ] Verify/commit:

```bash
npx tsx --test tests/executor/hooks.test.ts tests/executor/agent-config.test.ts
npm run test:executor
git add .claude/agents .claude/settings.json .claude/hooks/pre-tool-use-ownership-guard tests/executor/hooks.test.ts tests/executor/agent-config.test.ts
git commit -m "fix(executor): harden agent capabilities and hook portability"
```

---

### Task 3: Durable Run-State Primitives and Append-Only Event Ledger

**Files:** create `.claude/hooks/qcet-run-state.cjs`, `.claude/hooks/qcet-run-event`, `tests/executor/run-state.test.ts`, `.claude/executor-runs/README.md`; modify `.claude/settings.json`, `tests/executor/hooks.test.ts`.

**Interfaces:**

```js
sanitizeRunId(value)
getRunDir(projectDir, runId)
atomicWriteJson(filePath, value)
readJson(filePath)
appendEvent(runDir, event)
writeWitness(runDir, relativePath, value)
claimFile(runDir, shardId, relativeFile)
```

- [ ] Write failing tests proving run IDs cannot escape `.claude/executor-runs/`, JSON writes are atomic/valid, event `seq` is strictly increasing, and atomic file claims allow same-owner re-entry but reject a second shard.

- [ ] Confirm RED:

```bash
npx tsx --test tests/executor/run-state.test.ts
```

- [ ] Implement helpers with Node built-ins `fs`, `path`, `crypto`. Run root is exactly:

```text
${CLAUDE_PROJECT_DIR}/.claude/executor-runs/<sanitized-run-id>
```

`appendEvent` writes bounded JSONL records. Claim filenames are SHA-256 hashes of normalized repository-relative paths and use exclusive create (`wx`) for first ownership.

- [ ] Implement `qcet-run-event` to record bounded `SubagentStart`, `SubagentStop`, `PostToolUse`, and `PostToolUseFailure` events only when `QCET_RUN_ID` exists. Never store full prompts, file contents, secrets, or unbounded stdout.

- [ ] Wire the hook without removing the existing SubagentStop evidence gate.

- [ ] Verify/commit:

```bash
npx tsx --test tests/executor/run-state.test.ts tests/executor/hooks.test.ts
npm run test:executor
git add .claude/hooks/qcet-run-state.cjs .claude/hooks/qcet-run-event .claude/settings.json tests/executor/run-state.test.ts tests/executor/hooks.test.ts .claude/executor-runs/README.md
git commit -m "feat(executor): add durable run ledger primitives"
```

---

### Task 4: Continuous Worktree Identity and Runtime File Claims

**Files:** modify `.claude/hooks/pre-tool-use-ownership-guard`, `.claude/hooks/qcet-run-state.cjs`, `tests/executor/hooks.test.ts`; create `tests/executor/worktree-guard.test.ts`.

**Interface:** isolated shard witness lives at `shards/<shardId>/worktree.json` and records expected root, pinned base commit, and shard identity.

- [ ] Add failing tests using temporary git repos for: wrong cwd/root, wrong pinned base ancestry, missing required worktree witness during an executor run, and shard B attempting to mutate a file already claimed by shard A.

- [ ] Confirm RED:

```bash
npx tsx --test tests/executor/hooks.test.ts tests/executor/worktree-guard.test.ts
```

- [ ] Before every builder `Write`, `Edit`, or mutating `Bash`, resolve run/shard, load expected witness, run `git rev-parse --show-toplevel` and `git rev-parse HEAD` via `spawnSync`, verify root/base, enforce owns/antiOwns, then atomically claim the target Write/Edit path.

- [ ] Outside executor runs (`QCET_RUN_ID` absent), preserve current interactive fail-open behavior. Inside an executor run, missing required identity is fail-closed with `WORKTREE_INVALID`.

- [ ] Verify/commit:

```bash
npx tsx --test tests/executor/hooks.test.ts tests/executor/worktree-guard.test.ts
npm run test:executor
git add .claude/hooks/pre-tool-use-ownership-guard .claude/hooks/qcet-run-state.cjs tests/executor/hooks.test.ts tests/executor/worktree-guard.test.ts
git commit -m "fix(executor): enforce continuous worktree and file claims"
```

---

### Task 5: Proportional Execution, Change-Surface Gate, Spawn Gate, and JIT Context

**Files:** modify `.claude/workflows/qcet-plan-executor.js`, `tests/executor/workflow-executor.test.ts`; regenerate bundle.

**Interfaces:**

```js
selectExecutionMode(manifest) -> 'MICRO'|'STANDARD'|'CRITICAL'
computeChangeSurfaceScore(shard) -> number
shouldSpawnAgent({ role, mode, shard, recon }) -> boolean
buildJitShardContext(shard, manifest, evidence) -> object
```

- [ ] Add failing mode tests: MICRO requires exactly one low-risk shard and no auth/RBAC/security/Prisma/migration/shared-contract/dependency signal; any critical risk or sensitive path is CRITICAL; everything else is STANDARD.

- [ ] Add failing score tests using exactly:

```js
score = owns.length * 2
  + requirements.length * 2
  + dependencies.length * 3
  + expectedContracts.length * 3
  + (risk === 'high' ? 5 : 0)
  + (risk === 'critical' ? 10 : 0);
```

Score `> 24` requires calibration split unless unsplittable, in which case force CRITICAL.

- [ ] Add failing spawn-gate tests: MICRO with known local files skips researcher; root shard with complete recon skips reconciliation; CRITICAL always requires independent skeptic; external uncertainty requires researcher.

- [ ] Confirm RED:

```bash
npx tsx --test tests/executor/workflow-executor.test.ts
```

- [ ] Implement helpers above `// WORKFLOW`. JIT context contains only `id`, `objective`, `requirements`, `owns`, `antiOwns`, `dependencies`, `expectedContracts`, `acceptanceCriteria`, `verificationPlan`, `relevantFiles`, `dependencyDeltas`. Full master plan is supplied only through the existing ambiguity fallback.

- [ ] Wire MICRO fast path: builder -> deterministic targeted checks -> one skeptic implementation review -> proof -> delivery gate. No broad integration fan-out unless the shard itself touches a critical/shared contract.

- [ ] Verify/commit:

```bash
npx tsx --test tests/executor/workflow-executor.test.ts
npm run build:executor
git add .claude/workflows/qcet-plan-executor.js tests/executor/workflow-executor.test.ts .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): add proportional execution and spawn gating"
```

---

### Task 6: Lane Scheduler, Critical-Path Reservation, Speculative Read, and Cancellation

**Files:** modify workflow/test; regenerate bundle.

**Interfaces:**

```js
createLaneScheduler({ globalLimit, laneLimits })
scheduler.run(lane, priority, fn)
createCancellationToken() -> { cancel(reason), isCancelled(), reason }
```

- [ ] Add failing tests proving global active agents never exceed limit, ready critical-path WRITE outranks lower-priority speculative READ, idle capacity can be borrowed, equal priority is FIFO, and cancelled queued work never calls its function.

- [ ] Add DAG test `A -> B -> C`: if A fails verification, no new B/C agent starts; descendants return `DEPENDENCY_BLOCKED`.

- [ ] Confirm RED:

```bash
npx tsx --test tests/executor/workflow-executor.test.ts
```

- [ ] Implement logical lanes: calibrate/recon/research/reconcile=`read`; builder/repair=`write`; skeptic/integration/global reviewer=`verify`. Priority order is critical-path WRITE, required VERIFY, required READ, speculative READ.

- [ ] Keep existing agent/token budget checks before queueing. Do not add adaptive concurrency in this task.

- [ ] Preserve early pre-recon as speculative READ; reconciliation invalidates stale evidence when dependency deltas changed assumptions.

- [ ] Verify/commit:

```bash
npx tsx --test tests/executor/workflow-executor.test.ts
npm run build:executor
git add .claude/workflows/qcet-plan-executor.js tests/executor/workflow-executor.test.ts .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): add lane scheduling and fail-fast cancellation"
```

---

### Task 7: Shard Contract and Checkpointed Independent Review

**Files:** modify workflow, `.claude/agents/qcet-skeptic.md`, workflow tests; create `tests/executor/review-policy.test.ts`; regenerate bundle.

**Interfaces:**

```js
buildShardContract(shard, recon)
validateShardContract(contract) -> { valid, errors }
shouldReviewCheckpoint(state) -> { required, reasons }
```

Skeptic modes are exactly `contract`, `implementation`, `integration`.

- [ ] Add failing contract tests. Required non-empty fields: `shardId`, `objective`, `requirements`, `owns`, `acceptanceCriteria`, `verificationPlan`. CRITICAL additionally requires `expectedContracts` and a security/domain verification item.

- [ ] Add failing review-trigger tests. Review is mandatory when risk high/critical, `schema.prisma`/`prisma/migrations` touched, auth/RBAC/permission surface touched, ownership boundary touched, new failing test appears, expected contract changes, or change-surface score is `>= 18`.

- [ ] Confirm RED:

```bash
npx tsx --test tests/executor/review-policy.test.ts tests/executor/workflow-executor.test.ts
```

- [ ] STANDARD runs pre-review when risk high or score >=18; CRITICAL always runs skeptic `contract` review before builder; MICRO skips pre-review but still runs final implementation review.

- [ ] After builder structured output, run deterministic checks then skeptic `implementation` review when triggered. The skeptic must inspect actual repo/diff/tests; builder prose is treated only as claims.

- [ ] Update skeptic instructions with all three modes and the explicit invariant: `Never approve from builder prose alone.`

- [ ] Verify/commit:

```bash
npx tsx --test tests/executor/review-policy.test.ts tests/executor/workflow-executor.test.ts
npm run build:executor
git add .claude/workflows/qcet-plan-executor.js .claude/agents/qcet-skeptic.md tests/executor/review-policy.test.ts tests/executor/workflow-executor.test.ts .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): add checkpointed independent review"
```

---

### Task 8: Proof Bundles, Witness-Derived State, and Deterministic Shard Gate

**Files:** modify `.claude/hooks/qcet-run-state.cjs`, `.claude/hooks/subagent-stop-evidence-gate`, telemetry agent, workflow, hook/workflow tests; create `tests/executor/proof-bundle.test.ts`; regenerate bundle.

**Interfaces:**

```js
validateShardProof(proof, contract) -> { valid, blockers }
deriveShardState(witnesses) -> 'PLANNED'|'WORKTREE_READY'|'IMPLEMENTED'|'PROVEN'|'VERIFIED'|'BLOCKED'
```

Canonical proof fields: `shardId`, `baseCommit`, `checkpointRef`, `touchedFiles`, `requirementsProven`, `checks`, `verification`, `ownership`, `worktree`, `unresolvedFindings`.

- [ ] Add failing tests: proof fails for missing requirement, non-zero required check, failed ownership/worktree status, non-pass independent verification, or unresolved high/critical finding.

- [ ] Add witness-state tests: contract=`PLANNED`; +worktree=`WORKTREE_READY`; +implemented=`IMPLEMENTED`; +valid proof=`PROVEN`; +verified=`VERIFIED`; explicit blocked witness always=`BLOCKED`.

- [ ] Confirm RED:

```bash
npx tsx --test tests/executor/proof-bundle.test.ts tests/executor/hooks.test.ts tests/executor/workflow-executor.test.ts
```

- [ ] Persist bounded command evidence using actual output variable `output`:

```js
{
  command,
  exitCode,
  outputDigest: 'sha256:' + crypto.createHash('sha256').update(output).digest('hex'),
  outputTail: output.split('\n').slice(-40).join('\n'),
}
```

- [ ] Strengthen SubagentStop builder handoff: require changed files, tests run, requirements satisfied, run ID, shard ID. This gate validates handoff completeness only; it never marks VERIFIED.

- [ ] Unblock dependent writes only after `validateShardProof` passes. A skeptic pass with incomplete proof becomes `EVIDENCE_INCOMPLETE`.

- [ ] Verify/commit:

```bash
npx tsx --test tests/executor/proof-bundle.test.ts tests/executor/hooks.test.ts tests/executor/workflow-executor.test.ts
npm run build:executor
git add .claude/hooks/qcet-run-state.cjs .claude/hooks/subagent-stop-evidence-gate .claude/agents/qcet-telemetry-recorder.md .claude/workflows/qcet-plan-executor.js tests/executor/proof-bundle.test.ts tests/executor/hooks.test.ts tests/executor/workflow-executor.test.ts .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): require machine-verifiable shard proof"
```

---

### Task 9: Git Checkpoints, Idempotent Phase Keys, Resume Capsules, and Progress Circuit Breaker

**Files:** create `.claude/hooks/qcet-checkpoint`, `tests/executor/checkpoint.test.ts`, `tests/executor/recovery.test.ts`; modify run-state helper, workflow/tests; regenerate bundle.

**Interfaces:**

```js
computePhaseKey({ runId, shardId, phase, inputStateHash, baseCommit })
buildResumeCapsule(state)
computeProgressSignature(state)
```

Checkpoint protocol input `{ runId, shardId, stage, worktreeRoot }`; output `{ status, ref, commit, tree }`. Refs use `refs/qcet/<sanitized-run>/<sanitized-shard>/<sanitized-stage>`.

- [ ] Add temporary-git-repo test proving checkpoint creates a reachable commit/ref without moving checked-out branch HEAD.

- [ ] Add idempotency tests: identical phase inputs -> same key; any base/phase/input hash change -> different key.

- [ ] Add progress-signature test: fixing finding A while introducing C changes signature even when total count remains 2; identical diff/check/test/finding sets produce the same signature.

- [ ] Confirm RED:

```bash
npx tsx --test tests/executor/checkpoint.test.ts tests/executor/recovery.test.ts tests/executor/workflow-executor.test.ts
```

- [ ] Implement git-plumbing checkpoint hook with sanitized refs and no branch movement.

- [ ] Implement phase states: `COMPLETED` only with matching witness; `FAILED` retry under policy; `UNKNOWN` reconcile/inspect before rerun; `NOT_RUN` execute.

- [ ] Resume Capsule fields are exactly `runId`, `shardId`, `baseCommit`, `checkpointRef`, `objective`, `requirements`, `touchedFiles`, `resolvedFindings`, `remainingFindings`, `failingChecks`, `proofRefs`.

- [ ] Replace issue-count-only stagnation: first identical/no-improvement signature -> one targeted falsifying reverify; second consecutive no-progress -> `REPAIR_STAGNATED`, rollback last accepted checkpoint, block shard.

- [ ] Verify/commit:

```bash
npx tsx --test tests/executor/checkpoint.test.ts tests/executor/recovery.test.ts tests/executor/workflow-executor.test.ts
npm run build:executor
git add .claude/hooks/qcet-checkpoint .claude/hooks/qcet-run-state.cjs .claude/workflows/qcet-plan-executor.js tests/executor/checkpoint.test.ts tests/executor/recovery.test.ts tests/executor/workflow-executor.test.ts .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): add durable checkpoints and evidence-aware recovery"
```

---

### Task 10: Shard, Integration, and Delivery Release Gates

**Files:** modify workflow/tests; create `.claude/hooks/qcet-delivery-proof`, `tests/executor/release-gates.test.ts`; regenerate bundle.

**Interfaces:**

```js
evaluateShardGate(input)
evaluateIntegrationGate(input)
evaluateDeliveryGate(input)
evaluateDeterministicReleaseGate(input)
```

- [ ] Add failing tests proving: Shard Gate blocks incomplete proof; Integration Gate blocks unresolved high/critical finding; Delivery Gate blocks missing pinned source SHA, missing delivery checkpoint/commit, or failed exact-delivery validation; final READY requires all three READY.

- [ ] Confirm RED:

```bash
npx tsx --test tests/executor/release-gates.test.ts tests/executor/workflow-executor.test.ts
```

- [ ] Implement `qcet-delivery-proof` to record `git status --short`, exact `git rev-parse HEAD`, and real exit codes for configured final validation commands at the delivery checkpoint/worktree.

- [ ] Refactor final gate output to:

```js
{
  status: 'READY' | 'BLOCKED',
  shardGate,
  integrationGate,
  deliveryGate,
  blockers,
  deterministicOverride,
}
```

Keep existing blocker wording where regression tests rely on it.

- [ ] Verify/commit:

```bash
npx tsx --test tests/executor/release-gates.test.ts tests/executor/workflow-executor.test.ts
npm run build:executor
git add .claude/workflows/qcet-plan-executor.js .claude/hooks/qcet-delivery-proof tests/executor/release-gates.test.ts tests/executor/workflow-executor.test.ts .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): prove shard integration and delivery readiness"
```

---

### Task 11: Immutable Live Telemetry and Explicit Synthetic/Live Evaluation

**Files:** modify workflow, telemetry agent, `scripts/run-eval-suite.mjs`, `scripts/run-benchmark.mjs`, `package.json`, eval README; create `scripts/lib/live-benchmark.mjs`, `scripts/compare-live-executor-runs.mjs`, `tests/executor/live-benchmark.test.ts`; regenerate bundle.

**Interfaces:**

```js
median(values)
validateLiveRun(payload)
loadRunDirectory(dir)
compareLiveRunSets(baselineRuns, candidateRuns)
```

CLI:

```bash
node scripts/compare-live-executor-runs.mjs --baseline-dir .claude/executor-evals/benchmarks/v15/executor-canary --candidate-dir .claude/executor-evals/benchmarks/v23/executor-canary
```

- [ ] Add failing tests rejecting missing `sourceCommit`, `executorCommit`, `plan`, or `domain`; strict comparison rejects mismatched source commit/plan/domain/runtime fingerprint.

- [ ] Comparison rule: candidate median wall clock `<= baseline * 1.05`; measured token median `<= baseline * 1.10`; missing token measurements return `NOT_MEASURED`, never an estimate.

- [ ] Confirm RED:

```bash
npx tsx --test tests/executor/live-benchmark.test.ts
```

- [ ] Mark synthetic outputs `mode: 'synthetic'` and log prefixes `[synthetic-eval]` / `[synthetic-benchmark]`.

- [ ] Package scripts become:

```json
"eval:synthetic": "node scripts/run-eval-suite.mjs",
"eval:synthetic:benchmark": "node scripts/run-benchmark.mjs",
"eval:live:compare": "node scripts/compare-live-executor-runs.mjs",
"eval:suite": "npm run eval:synthetic",
"eval:benchmark": "npm run eval:synthetic:benchmark"
```

- [ ] Live telemetry stores immutable `.claude/executor-evals/runs/<sanitizedRunId>.json` plus latest snapshot. Include runtime fingerprint, source/executor commits, execution mode, lane limits, wall-clock/calibration/first-builder/critical-path/dependency-wait, agents, repairs, stalls, conflicts, review costs, coverage, and final gate state. Unknown values remain null.

- [ ] Verify/commit:

```bash
npx tsx --test tests/executor/live-benchmark.test.ts
npm run eval:synthetic
npm run eval:synthetic:benchmark
npm run build:executor
git add .claude/workflows/qcet-plan-executor.js .claude/agents/qcet-telemetry-recorder.md scripts package.json tests/executor/live-benchmark.test.ts .claude/executor-evals/README.md .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): separate live evidence from synthetic evaluation"
```

---

### Task 12: Fault Injection, Compatibility Canary, and Deterministic Live-Smoke Fixture

**Files:**
- Create: `tests/executor/fault-injection.test.ts`
- Create: `tests/executor/canary-policy.test.ts`
- Create: `scripts/run-executor-canary.mjs`
- Create: `tests/executor/fixtures/canary/live-smoke-plan.md`
- Create: `tests/executor/fixtures/canary/workspace/value.ts`
- Create: `tests/executor/fixtures/canary/workspace/value.test.ts`
- Modify: `package.json`

**Live-smoke fixture content:**

`value.ts` starts as:

```ts
export function getValue() {
  return 1;
}
```

`value.test.ts` asserts `getValue() === 1` initially. `live-smoke-plan.md` instructs the executor to change `getValue()` to return `2`, update the fixture test to expect `2`, run that targeted test, and change no file outside `tests/executor/fixtures/canary/workspace/**`. This fixture is executed only in a disposable benchmark worktree.

- [ ] Implement deterministic failure fixtures for builder null, malformed schema, worktree mismatch, wrong base, missing/out-of-scope ownership, same-file conflict, test exit 1, skeptic null/crash, agent budget exhaustion, dependency failure, two no-progress repairs, witness persistence failure, incomplete proof, unresolved high integration finding.

- [ ] Every fixture asserts `status != READY`, finite retry/agent count, no accepted out-of-scope mutation, and a machine-readable failure reason.

- [ ] Compatibility canary is required when any of `executorVersion`, `claudeCodeVersion`, `model`, `effort`, agent-config digest, hook-policy digest changes.

- [ ] Add scripts:

```json
"test:executor:faults": "npx tsx --test tests/executor/fault-injection.test.ts",
"executor:canary": "node scripts/run-executor-canary.mjs"
```

- [ ] Verify/commit:

```bash
npm run test:executor:faults
npm run executor:canary
npm run test:executor
git add tests/executor/fault-injection.test.ts tests/executor/canary-policy.test.ts tests/executor/fixtures/canary scripts/run-executor-canary.mjs package.json
git commit -m "test(executor): add fault injection and runtime canaries"
```

---

### Task 13: Shadow Performance Controllers and ROI Analysis

**Files:** modify workflow/package; create `scripts/lib/executor-policy-analysis.mjs`, `scripts/analyze-executor-roi.mjs`, `tests/executor/policy-analysis.test.ts`; regenerate bundle.

**Interfaces:**

```js
recommendConcurrency(metrics, currentConfig)
computeVerifierRoi(records)
recommendPhaseBudget(metrics)
```

All return recommendations only; V2.3 mode is hardcoded `shadow`.

- [ ] Add failing tests: high conflict/stall recommends lower concurrency; large ready queue + low failure/conflict + dependency wait may recommend +1; insufficient samples recommends no change; recommendation stays in `2..16`.

- [ ] Add verifier ROI tests using actual duration/token/finding records. A verifier that caught any critical defect in the sample cannot be recommended for pruning. Insufficient sample count cannot produce a pruning recommendation.

- [ ] Confirm RED:

```bash
npx tsx --test tests/executor/policy-analysis.test.ts
```

- [ ] Add final telemetry field `shadowRecommendations: { concurrency, verifierPolicy, phaseBudget }`; never apply it to the current run.

- [ ] Add package script:

```json
"executor:roi": "node scripts/analyze-executor-roi.mjs"
```

- [ ] Verify/commit:

```bash
npx tsx --test tests/executor/policy-analysis.test.ts
npm run build:executor
git add .claude/workflows/qcet-plan-executor.js scripts/lib/executor-policy-analysis.mjs scripts/analyze-executor-roi.mjs tests/executor/policy-analysis.test.ts package.json .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): add shadow performance policy analysis"
```

---

### Task 14: Full Regression, Live Ultracode Smoke, Comparable Benchmark, and Freeze

**Files:** create `docs/architecture/QCET_PLAN_EXECUTOR_V2_FINAL.md` only after gates pass; update final skill/eval docs; verify bundle.

- [ ] Run deterministic final gate:

```bash
npm run test:executor
npm run test:executor:faults
npm run executor:canary
npm run build:executor
npm run verify
git diff --check
npm run build:executor
git diff --exit-code .claude/dist/qcet-plan-executor.bundle.js
npm run eval:synthetic
npm run eval:synthetic:benchmark
```

All commands must exit 0.

- [ ] Verify harness-only diff:

```bash
V15_BASE_SHA="$(cat /tmp/qcet-v15-base-sha)"
git diff --stat "$V15_BASE_SHA"...HEAD
git status --short
```

No QCET product feature file under `src/` and no Prisma application schema change is allowed.

- [ ] Prepare a disposable live-smoke worktree from the exact current executor commit:

```bash
EXECUTOR_COMMIT="$(git rev-parse HEAD)"
SMOKE_DIR="$(cd .. && pwd)/qcet-v23-live-smoke"
rm -rf "$SMOKE_DIR"
git worktree add --detach "$SMOKE_DIR" "$EXECUTOR_COMMIT"
printf '%s\n' "$EXECUTOR_COMMIT" > /tmp/qcet-v23-smoke-source-sha
```

Run Claude Code from `SMOKE_DIR`, invoke `/qcet-plan-executor` with `planPath` exactly `tests/executor/fixtures/canary/live-smoke-plan.md`, `budget: "high"`, `worktreeIsolation: "auto"`, `domain: "executor-canary"`, `sourceCommit` equal to the contents of `/tmp/qcet-v23-smoke-source-sha`, `executorCommit` equal to the same exact SHA, and a run ID generated by `date -u +v23-smoke-%Y%m%dT%H%M%SZ`.

Required observations in `/workflows` and telemetry: peak agents within configured limit, no permission loop, no worktree escape, independent review runs, proof persists, final gate matches actual validation.

- [ ] After the smoke run, remove the disposable worktree:

```bash
git worktree remove --force "$SMOKE_DIR"
```

- [ ] For performance evidence, store comparable run JSON files in exact directories:

```text
.claude/executor-evals/benchmarks/v15/executor-canary/
.claude/executor-evals/benchmarks/v23/executor-canary/
```

A strict V1.5/V2.3 speed claim is allowed only when both sets contain at least three runs with the same plan/domain/source commit and comparable runtime fingerprint. If that strict V1.5 set cannot be recreated, write `legacy-v15-comparison: unavailable` in the freeze document and do not claim a percentage speedup versus V1.5.

- [ ] When both strict directories are valid, compare with exactly:

```bash
npm run eval:live:compare -- --baseline-dir .claude/executor-evals/benchmarks/v15/executor-canary --candidate-dir .claude/executor-evals/benchmarks/v23/executor-canary
```

Use medians, never fastest-run selection.

- [ ] Freeze criteria:

```text
100% mapped requirement coverage
0 silent READY
0 ownership/worktree escape
0 unresolved critical/high finding at READY
all fault injections fail closed
recovery preserves previously proven work
no correctness regression
strict comparable wall-clock median <= V1.5 median * 1.05 when a strict V1.5 baseline exists
strict comparable measured-token median <= V1.5 median * 1.10, otherwise NOT_MEASURED
```

- [ ] Create `docs/architecture/QCET_PLAN_EXECUTOR_V2_FINAL.md` containing exactly these identity lines near the top:

```text
STATUS: ARCHITECTURE FROZEN
VERSION: V2.3
RUNTIME: Ultracode / Claude Code Dynamic Workflows
ORCHESTRATOR: .claude/workflows/qcet-plan-executor.js
```

Document execution modes, lanes, review pipeline, proof, recovery, release gates, telemetry/eval policy, and post-freeze rule.

- [ ] Update `.claude/skills/qcet-plan-executor/SKILL.md` with V2.3 args, artifacts, modes, `/workflows` inspection, and live telemetry locations.

- [ ] Final verify/commit:

```bash
npm run test:executor
npm run test:executor:faults
npm run executor:canary
npm run build:executor
npm run verify
git diff --check
git status --short
git add .claude docs/architecture tests/executor scripts package.json
git commit -m "docs(executor): freeze QCET Plan Executor v2.3 architecture"
```

---

## Definition of Done

- String `budget: "high"` has real scheduler meaning and all caps are deterministic.
- READ/WRITE/VERIFY lanes preserve a global hard cap and prioritize the critical path.
- MICRO/STANDARD/CRITICAL modes reduce orchestration where it is not needed.
- Read-only agents cannot mutate via general Bash; maxTurns are bounded; hooks are worktree-portable.
- Every builder mutation in an executor run is continuously checked against worktree identity, ownership, antiOwns, and runtime file claims.
- Builder output never self-approves; deterministic checkpoint triggers invoke independent skeptic review.
- Dependency writes unlock only from valid proof bundles.
- Repair stagnation uses evidence signatures and rollback, not issue count alone.
- Durable checkpoints and Resume Capsules permit fresh-agent recovery without discarding proven work.
- READY requires Shard Gate + Integration Gate + Delivery Gate on exact reproducible delivery state.
- Immutable live telemetry is distinct from synthetic evaluation.
- Fault injection cannot yield silent READY, unbounded retry, or untracked out-of-scope mutation.
- Adaptive concurrency/verifier pruning remain shadow-only in V2.3.
- Full executor tests, fault tests, canary, build, typecheck, lint, application tests, and bundle parity pass.
- Live Ultracode smoke completes with correct proof/review/isolation behavior.
- Freeze documentation is committed with `STATUS: ARCHITECTURE FROZEN`.

## Post-Freeze Rule

Do not create V2.4 because a new orchestration idea is interesting. Re-open architecture only for a measured performance bottleneck, correctness/isolation failure, repeated recovery/stall failure, or material Claude Code/Ultracode runtime change. Every post-freeze orchestration change must begin with a failing regression test and ship with comparable evidence showing no correctness regression.
