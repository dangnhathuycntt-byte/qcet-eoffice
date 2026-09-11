# QCET Plan Executor V2.3 Final Implementation Plan

> **Execution runtime:** Ultracode / Claude Code Dynamic Workflows. Execute this plan through the QCET Plan Executor itself. Do not introduce Superpowers, Agent Teams, or a second orchestrator into the runtime path. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing V1.5 QCET Plan Executor into the V2.3 freeze candidate: faster plan execution, independent mid-run review, continuous worktree/ownership safety, durable proof/recovery, and comparable live performance evidence.

**Architecture:** Preserve `.claude/workflows/qcet-plan-executor.js` as the single standalone Dynamic Workflow orchestrator. Put filesystem durability and enforcement in Node hooks/helpers because the workflow runtime has no direct filesystem/shell access and cannot load modules. Use deterministic execution modes, logical scheduler lanes, checkpoint-triggered independent review, witness/proof artifacts, bounded recovery, and deterministic three-stage release gating.

**Tech Stack:** Claude Code Dynamic Workflows, JavaScript, Node.js 20+, TypeScript tests via `tsx`, Git worktrees/refs, existing QCET hooks/agents, npm scripts.

**Spec:** `docs/superpowers/specs/2026-09-11-qcet-plan-executor-v23-design.md`

## Global Constraints

- Preserve the existing standalone `.claude/workflows/qcet-plan-executor.js`; do not add runtime `import()`/module loading.
- The workflow coordinates agents only; hooks/agents perform filesystem and shell work.
- Keep Next.js application/product code untouched. This plan changes only executor/harness/tests/docs/bundle/eval assets.
- Do not add Agent Teams, swarm consensus, Redis, Temporal, vector memory, a second orchestrator, or LLM-controlled scheduling/concurrency.
- Hard runtime caps: clamp executor concurrency to `<= 16` and total agent calls to `<= 1000`.
- Builder output never self-approves. Only independent verification plus deterministic gates may prove completion.
- Synthetic evaluation must be explicitly labeled synthetic and must never be reported as live performance evidence.
- All code changes follow TDD: failing targeted test first, minimal implementation, passing targeted test, then commit.
- Regenerate `.claude/dist/qcet-plan-executor.bundle.js` after every task that changes the workflow script; the final task verifies bundle parity.

---

## Dependency Map

```text
Task 0 Baseline
  |
  +--> Task 1 Budget + Runtime Provenance
  |
  +--> Task 2 Agent/Hook Capability Hardening
  |
  +--> Task 3 Durable Run-State Primitives
           |
           +--> Task 4 Continuous Worktree + Runtime Claims
           |
           +--> Task 5 Execution Modes + Change Surface + Spawn Gate
                    |
                    +--> Task 6 Lane Scheduler + Critical-Path Reservations
                    |
                    +--> Task 7 Shard Contract + Mid-Run Review Pipeline
                              |
                              +--> Task 8 Proof Bundle + Witness State + Shard Gate
                                        |
                                        +--> Task 9 Checkpoints + Idempotency + Recovery
                                        |
                                        +--> Task 10 Integration/Delivery Gates + HEAD Reproof

Task 1 + Task 3 --> Task 11 Telemetry + Live/Synthetic Eval Separation
Task 4 + Task 7 + Task 8 + Task 9 + Task 10 --> Task 12 Fault Injection + Canary Suite
Task 6 + Task 11 --> Task 13 Shadow Performance Controllers
Tasks 1-13 --> Task 14 Full Regression + Live Benchmark + Freeze
```

**Parallel execution rule:** Tasks 1, 2, and 3 may run in parallel because they own different primary files. After Task 3, Tasks 4 and 5 may run in parallel only if their workflow edits are staged through separate worktrees and integrated sequentially. All later workflow-heavy tasks should integrate one at a time to avoid merge churn in the standalone workflow file.

---

### Task 0: Establish a Clean V1.5 Baseline

**Files:**
- Read only: `.claude/workflows/qcet-plan-executor.js`
- Read only: `.claude/hooks/*`
- Read only: `.claude/agents/*`
- Read only: `tests/executor/*`
- Read only: `package.json`

**Interfaces:**
- Consumes: branch `fix/qcet-plan-executor-v1.5-hardening`
- Produces: exact baseline commit SHA and passing V1.5 test/build evidence

- [ ] **Step 1: Verify branch and capture source SHA**

```bash
git switch fix/qcet-plan-executor-v1.5-hardening
git status --short
git rev-parse HEAD
```

Expected: clean working tree. Record the 40-character SHA as `V15_BASE_SHA` in the execution log.

- [ ] **Step 2: Install exact dependencies**

```bash
npm ci
```

Expected: exit 0.

- [ ] **Step 3: Run the executor regression suite**

```bash
npm run test:executor
```

Expected: all executor tests pass. Any pre-existing failure blocks this plan until classified.

- [ ] **Step 4: Build the current executor bundle**

```bash
npm run build:executor
git diff --exit-code .claude/dist/qcet-plan-executor.bundle.js
```

Expected: build succeeds and generated bundle matches the committed V1.5 workflow.

- [ ] **Step 5: Do not commit**

This task establishes evidence only.

---

### Task 1: Canonical Budget Profiles, Failure Reasons, and Runtime Provenance

**Files:**
- Modify: `.claude/workflows/qcet-plan-executor.js`
- Modify: `.claude/skills/qcet-plan-executor/SKILL.md`
- Modify: `tests/executor/workflow-executor.test.ts`
- Regenerate: `.claude/dist/qcet-plan-executor.bundle.js`

**Interfaces:**
- Produces: `normalizeBudgetConfig(input)`, `normalizeFailureReason(value)`, `buildRuntimeFingerprint(input)`
- `normalizeBudgetConfig(input)` returns `{ profile, maxConcurrentAgents, maxAgents, laneLimits }`
- `buildRuntimeFingerprint(input)` returns stable serializable runtime provenance used by later telemetry/live comparison

- [ ] **Step 1: Add failing tests for budget normalization**

Add tests that require:

```ts
assert.deepEqual(normalizeBudgetConfig('high'), {
  profile: 'high',
  maxConcurrentAgents: 8,
  maxAgents: 128,
  laneLimits: { read: 3, write: 3, verify: 2, gitControl: 1 },
});

assert.equal(normalizeBudgetConfig({ profile: 'medium', maxConcurrentAgents: 99 }).maxConcurrentAgents, 16);
assert.equal(normalizeBudgetConfig({ profile: 'high', maxAgents: 5000 }).maxAgents, 1000);
assert.throws(() => normalizeBudgetConfig('turbo'), /Unknown budget profile/);
```

- [ ] **Step 2: Add failing tests for failure taxonomy**

The canonical set is:

```js
const FAILURE_REASONS = new Set([
  'DEPENDENCY_BLOCKED',
  'WORKTREE_INVALID',
  'OWNERSHIP_CONFLICT',
  'RUNTIME_FILE_CONFLICT',
  'AGENT_BUDGET_EXHAUSTED',
  'TURN_BUDGET_EXHAUSTED',
  'TOKEN_BUDGET_EXHAUSTED',
  'WALLCLOCK_TIMEOUT',
  'AGENT_STALLED',
  'NETWORK_INTERRUPTED',
  'SCHEMA_INVALID',
  'VERIFICATION_FAILED',
  'REPAIR_STAGNATED',
  'TOOL_FAILURE',
  'RUNTIME_FAILURE',
  'EVIDENCE_INCOMPLETE',
]);
```

Unknown values normalize to `RUNTIME_FAILURE`; known values remain unchanged.

- [ ] **Step 3: Run targeted tests and confirm RED**

```bash
npx tsx --test tests/executor/workflow-executor.test.ts
```

Expected: failures because the three helpers are missing.

- [ ] **Step 4: Implement `normalizeBudgetConfig` before the `// WORKFLOW` marker**

Use these presets:

```js
const BUDGET_PROFILES = {
  low: {
    maxConcurrentAgents: 4,
    maxAgents: 40,
    laneLimits: { read: 2, write: 1, verify: 1, gitControl: 1 },
  },
  medium: {
    maxConcurrentAgents: 6,
    maxAgents: 72,
    laneLimits: { read: 2, write: 2, verify: 2, gitControl: 1 },
  },
  high: {
    maxConcurrentAgents: 8,
    maxAgents: 128,
    laneLimits: { read: 3, write: 3, verify: 2, gitControl: 1 },
  },
};
```

Rules:

```js
function normalizeBudgetConfig(input) {
  const raw = typeof input === 'string' ? { profile: input } : (input || {});
  const profile = raw.profile || 'high';
  const preset = BUDGET_PROFILES[profile];
  if (!preset) throw new Error(`Unknown budget profile: ${profile}`);

  const clampInt = (value, fallback, max) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(max, Math.floor(n));
  };

  return {
    profile,
    maxConcurrentAgents: clampInt(raw.maxConcurrentAgents ?? raw.maxConcurrent, preset.maxConcurrentAgents, 16),
    maxAgents: clampInt(raw.maxAgents, preset.maxAgents, 1000),
    laneLimits: {
      ...preset.laneLimits,
      ...(raw.laneLimits || {}),
    },
  };
}
```

Clamp each lane limit to at least 1 and at most the normalized global concurrency.

- [ ] **Step 5: Implement runtime fingerprint**

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

Never invent values that the runtime did not supply.

- [ ] **Step 6: Wire normalized budget into the workflow**

Replace direct optional-property reads from `budgetConfig` with one normalized object. If normalization throws, return `BLOCKED` with `failureReason: 'SCHEMA_INVALID'`.

- [ ] **Step 7: Update skill usage docs**

Document both supported forms:

```json
{"budget":"high"}
```

and:

```json
{
  "budget": {
    "profile": "high",
    "maxConcurrentAgents": 8,
    "maxAgents": 128
  }
}
```

- [ ] **Step 8: Verify and commit**

```bash
npx tsx --test tests/executor/workflow-executor.test.ts
npm run build:executor
git add .claude/workflows/qcet-plan-executor.js .claude/skills/qcet-plan-executor/SKILL.md tests/executor/workflow-executor.test.ts .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): normalize budgets and runtime provenance"
```

---

### Task 2: Fail-Closed Agent Capabilities, Portable Hooks, and Bounded Turns

**Files:**
- Modify: `.claude/agents/qcet-recon.md`
- Modify: `.claude/agents/qcet-researcher.md`
- Modify: `.claude/agents/qcet-skeptic.md`
- Modify: `.claude/agents/qcet-builder.md`
- Modify: `.claude/agents/qcet-telemetry-recorder.md`
- Modify: `.claude/settings.json`
- Modify: `.claude/hooks/pre-tool-use-ownership-guard`
- Modify: `tests/executor/hooks.test.ts`
- Create: `tests/executor/agent-config.test.ts`

**Interfaces:**
- Produces: bounded agent turn policy and strict read-only shell policy
- Hook commands use `${CLAUDE_PROJECT_DIR}` rather than `./`

- [ ] **Step 1: Add failing agent-config tests**

Require:

```text
qcet-recon        maxTurns 15, no Bash, includes Read/Grep/Glob/Skill
qcet-researcher   maxTurns 12, no Bash, includes WebSearch/WebFetch/Read/Grep/Glob/Skill
qcet-skeptic      maxTurns 20, Bash permitted only because the hook allowlist constrains it
qcet-builder      maxTurns 30
telemetry         maxTurns 4
```

Also assert every hook command in `.claude/settings.json` starts with `${CLAUDE_PROJECT_DIR}/.claude/hooks/`.

- [ ] **Step 2: Add failing read-only Bash allowlist tests**

Allowed for skeptic/verifier roles:

```text
git status --short
git diff -- src/app.ts
git log -n 5 --oneline
git show HEAD:src/app.ts
git grep TaskStatus
git rev-parse HEAD
git ls-files src
npm run typecheck
npm run lint
npm test -- tests/unit/auth.test.ts
npm run test -- tests/unit/auth.test.ts
npx tsx --test tests/executor/hooks.test.ts
```

Blocked:

```text
git add .
git commit -m x
npm install
mkdir tmp
chmod +x file
touch file
git status && touch file
git diff --no-index a b
git diff --ext-diff
node -e "require('fs').writeFileSync('x','y')"
python -c "open('x','w').write('y')"
echo x > file
```

- [ ] **Step 3: Run targeted tests and confirm RED**

```bash
npx tsx --test tests/executor/hooks.test.ts tests/executor/agent-config.test.ts
```

- [ ] **Step 4: Replace blacklist semantics for read-only Bash with an allowlist**

In `pre-tool-use-ownership-guard`, add:

```js
function isAllowedReadOnlyShellCommand(command) {
  const text = String(command || '').trim();
  if (!text) return false;
  if (/[;&|><`\n]|\$\(/.test(text)) return false;
  if (/--(?:ext-diff|no-index|output)\b/i.test(text)) return false;

  return [
    /^git status(?:\s|$)/,
    /^git diff(?:\s|$)/,
    /^git log(?:\s|$)/,
    /^git show(?:\s|$)/,
    /^git grep(?:\s|$)/,
    /^git rev-parse(?:\s|$)/,
    /^git ls-files(?:\s|$)/,
    /^npm run typecheck(?:\s|$)/,
    /^npm run lint(?:\s|$)/,
    /^npm test(?:\s|$)/,
    /^npm run test(?:\s|$)/,
    /^npx tsx --test(?:\s|$)/,
  ].some((pattern) => pattern.test(text));
}
```

If the role is read-only and Bash is invoked, deny unless this function returns true.

- [ ] **Step 5: Harden agent frontmatter and portable hooks**

Use the exact maxTurns/tool policy above and replace hook commands with `${CLAUDE_PROJECT_DIR}/.claude/hooks/<hook-name>`.

- [ ] **Step 6: Verify and commit**

```bash
npx tsx --test tests/executor/hooks.test.ts tests/executor/agent-config.test.ts
npm run test:executor
git add .claude/agents .claude/settings.json .claude/hooks/pre-tool-use-ownership-guard tests/executor/hooks.test.ts tests/executor/agent-config.test.ts
git commit -m "fix(executor): harden agent capabilities and hook portability"
```

---

### Task 3: Durable Run-State Primitives and Append-Only Event Ledger

**Files:**
- Create: `.claude/hooks/qcet-run-state.cjs`
- Create: `.claude/hooks/qcet-run-event`
- Modify: `.claude/settings.json`
- Create: `tests/executor/run-state.test.ts`
- Modify: `tests/executor/hooks.test.ts`
- Create: `.claude/executor-runs/README.md`

**Interfaces:**
- `sanitizeRunId(value): string`
- `getRunDir(projectDir, runId): string`
- `atomicWriteJson(filePath, value): void`
- `readJson(filePath): any | null`
- `appendEvent(runDir, event): object`
- `writeWitness(runDir, relativePath, value): string`
- `claimFile(runDir, shardId, relativeFile): { ok: boolean, owner: string }`

- [ ] **Step 1: Write failing helper tests**

Test that `sanitizeRunId('../../evil')` produces a safe basename with no slash or `..` traversal, `atomicWriteJson` leaves valid JSON, and `appendEvent` creates monotonically increasing integer `seq` values.

- [ ] **Step 2: Add failing atomic claim tests**

```ts
const first = claimFile(runDir, 'shard-a', 'src/a.ts');
assert.equal(first.ok, true);
const same = claimFile(runDir, 'shard-a', 'src/a.ts');
assert.equal(same.ok, true);
const conflict = claimFile(runDir, 'shard-b', 'src/a.ts');
assert.equal(conflict.ok, false);
assert.equal(conflict.owner, 'shard-a');
```

- [ ] **Step 3: Run tests and confirm RED**

```bash
npx tsx --test tests/executor/run-state.test.ts
```

- [ ] **Step 4: Implement `qcet-run-state.cjs`**

Use only Node built-ins `fs`, `path`, and `crypto`. Run directories must resolve below:

```text
${CLAUDE_PROJECT_DIR}/.claude/executor-runs/<sanitizedRunId>
```

`appendEvent` writes one JSON object per line to `events.jsonl` with `{ seq, ts, type, ...payload }`. Serialize appends by opening with append mode; sequence is derived from a small `sequence.json` updated through temp-file + rename.

`claimFile` stores one JSON file per normalized repository-relative path hash under `claims/`; creation must be exclusive (`flag: 'wx'`) so concurrent claim attempts cannot both win.

- [ ] **Step 5: Implement generic hook event recorder**

`qcet-run-event` reads hook JSON from stdin. If `QCET_RUN_ID` is absent it exits 0. When present it appends bounded events for `SubagentStart`, `SubagentStop`, `PostToolUse`, and `PostToolUseFailure`; never store entire prompts, file contents, secrets, or unbounded stdout.

- [ ] **Step 6: Wire lifecycle events in settings**

Add the recorder to `SubagentStart`, `SubagentStop`, `PostToolUse`, and `PostToolUseFailure`. Keep the existing evidence gate on `SubagentStop`.

- [ ] **Step 7: Verify and commit**

```bash
npx tsx --test tests/executor/run-state.test.ts tests/executor/hooks.test.ts
npm run test:executor
git add .claude/hooks/qcet-run-state.cjs .claude/hooks/qcet-run-event .claude/settings.json tests/executor/run-state.test.ts tests/executor/hooks.test.ts .claude/executor-runs/README.md
git commit -m "feat(executor): add durable run ledger primitives"
```

---

### Task 4: Continuous Worktree Identity Guard and Runtime File Claims

**Files:**
- Modify: `.claude/hooks/pre-tool-use-ownership-guard`
- Modify: `.claude/hooks/qcet-run-state.cjs`
- Modify: `tests/executor/hooks.test.ts`
- Create: `tests/executor/worktree-guard.test.ts`

**Interfaces:**
- `resolveExpectedExecutionIdentity(runDir, shardId)` reads `shards/<shardId>/worktree.json`
- Mutating builder tools are allowed only when actual git root/worktree identity matches the witness
- Valid Write/Edit mutations atomically claim their repository-relative path

- [ ] **Step 1: Add failing worktree mismatch tests**

Create a temporary git repository plus a fake expected worktree witness. Assert that a builder `Write` is blocked with `WORKTREE_INVALID` when actual cwd/root does not equal the expected root.

- [ ] **Step 2: Add failing runtime file-conflict test**

Shard A claims `src/shared.ts`. Shard B attempts `Edit` on the same path. Expect exit 2 and `RUNTIME_FILE_CONFLICT` in the reason.

- [ ] **Step 3: Run targeted tests and confirm RED**

```bash
npx tsx --test tests/executor/hooks.test.ts tests/executor/worktree-guard.test.ts
```

- [ ] **Step 4: Extend the PreToolUse guard**

For builder `Write`, `Edit`, or mutating `Bash`:

1. resolve run and shard;
2. load expected worktree witness when the shard is isolated;
3. run `git rev-parse --show-toplevel` and `git rev-parse HEAD` from the hook process cwd using `spawnSync`;
4. compare normalized roots;
5. verify expected pinned base is an ancestor when a base is recorded;
6. verify ownership/antiOwns;
7. claim the target file for Write/Edit;
8. block on any mismatch/conflict before the tool executes.

Do not silently allow a builder when executor run state exists but its required shard/worktree identity cannot be resolved.

- [ ] **Step 5: Preserve interactive fail-open behavior outside executor runs**

If `QCET_RUN_ID` is absent, existing non-executor interactive behavior remains unchanged.

- [ ] **Step 6: Verify and commit**

```bash
npx tsx --test tests/executor/hooks.test.ts tests/executor/worktree-guard.test.ts
npm run test:executor
git add .claude/hooks/pre-tool-use-ownership-guard .claude/hooks/qcet-run-state.cjs tests/executor/hooks.test.ts tests/executor/worktree-guard.test.ts
git commit -m "fix(executor): enforce continuous worktree and file claims"
```

---

### Task 5: Execution Modes, Change-Surface Gate, Spawn Gate, and JIT Context

**Files:**
- Modify: `.claude/workflows/qcet-plan-executor.js`
- Modify: `tests/executor/workflow-executor.test.ts`
- Regenerate: `.claude/dist/qcet-plan-executor.bundle.js`

**Interfaces:**
- `selectExecutionMode(manifest): 'MICRO'|'STANDARD'|'CRITICAL'`
- `computeChangeSurfaceScore(shard): number`
- `shouldSpawnAgent({ role, mode, shard, recon }): boolean`
- `buildJitShardContext(shard, manifest, evidence): object`

- [ ] **Step 1: Add failing mode-selection tests**

Require `MICRO` only for a single low-risk shard without auth/security/database/migration/shared-contract signals. Any `critical` risk or paths matching `/auth|rbac|permission|prisma|migration|schema\.prisma/i` must select `CRITICAL`. All other work selects `STANDARD`.

- [ ] **Step 2: Add failing change-surface tests**

Use a deterministic score:

```js
score =
  owns.length * 2 +
  requirements.length * 2 +
  dependencies.length * 3 +
  expectedContracts.length * 3 +
  (risk === 'high' ? 5 : 0) +
  (risk === 'critical' ? 10 : 0);
```

If a shard score exceeds `24`, calibration must split it unless its ownership cannot be safely divided; unsplittable oversized shards are forced `CRITICAL`.

- [ ] **Step 3: Add failing spawn-gate tests**

Examples:

```text
MICRO low-risk known local files -> no external researcher
root shard with complete recon -> no reconciliation agent
CRITICAL auth shard -> skeptic required
external uncertainty present -> researcher required
```

- [ ] **Step 4: Run targeted test and confirm RED**

```bash
npx tsx --test tests/executor/workflow-executor.test.ts
```

- [ ] **Step 5: Implement the four helpers**

Keep them above the `// WORKFLOW` marker so tests can load them using the existing VM strategy.

`buildJitShardContext` must include only:

```js
{
  id,
  objective,
  requirements,
  owns,
  antiOwns,
  dependencies,
  expectedContracts,
  acceptanceCriteria,
  verificationPlan,
  relevantFiles,
  dependencyDeltas,
}
```

Do not attach the full master plan unless the shard is explicitly ambiguous.

- [ ] **Step 6: Wire MICRO fast path and change-surface enforcement**

MICRO skips broad integration dimensions and unnecessary recon/research but still requires targeted tests, one independent skeptic verification, proof, and deterministic delivery gate.

- [ ] **Step 7: Verify and commit**

```bash
npx tsx --test tests/executor/workflow-executor.test.ts
npm run build:executor
git add .claude/workflows/qcet-plan-executor.js tests/executor/workflow-executor.test.ts .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): add proportional execution and spawn gating"
```

---

### Task 6: Lane Scheduler, Critical-Path Reservations, Speculative Read, and Cancellation

**Files:**
- Modify: `.claude/workflows/qcet-plan-executor.js`
- Modify: `tests/executor/workflow-executor.test.ts`
- Regenerate: `.claude/dist/qcet-plan-executor.bundle.js`

**Interfaces:**
- `createLaneScheduler({ globalLimit, laneLimits })`
- `scheduler.run(lane, priority, fn)`
- lanes: `read`, `write`, `verify`
- git-control filesystem mutations are delegated to hooks/agents and serialized by the corresponding worker protocol; no direct workflow filesystem action
- `createCancellationToken()` with `.cancel(reason)`, `.isCancelled()`, `.reason`

- [ ] **Step 1: Add failing lane scheduler tests**

Test that:

- global active count never exceeds 8 for the high profile;
- write work starts before lower-priority queued speculative read when both are ready;
- idle lane capacity can be borrowed without exceeding global limit;
- cancelled queued work never invokes its function.

- [ ] **Step 2: Add failing descendant-cancellation test**

Given DAG `A -> B -> C`, if A verification fails, speculative B/C work may finish if already complete but no new B/C agents may start; B and C finalize with `DEPENDENCY_BLOCKED`.

- [ ] **Step 3: Run targeted tests and confirm RED**

```bash
npx tsx --test tests/executor/workflow-executor.test.ts
```

- [ ] **Step 4: Implement lane scheduler**

Use deterministic FIFO inside equal priority. Priority comes from existing critical-path priority plus lane class:

```text
ready WRITE on critical path > required VERIFY > required READ > speculative READ
```

Do not implement heuristic/adaptive concurrency here.

- [ ] **Step 5: Route agent calls by lane**

```text
Calibrate/recon/research/reconcile -> read
builder/repair -> write
skeptic/integration/global reviewers -> verify
```

Preserve existing total-agent and token budget checks before queueing.

- [ ] **Step 6: Add speculative-read invalidation**

Pre-recon may start before dependencies finish. If upstream dependency deltas invalidate the evidence, reconciliation marks the speculative result stale and rebuilds the JIT context rather than trusting stale assumptions.

- [ ] **Step 7: Verify and commit**

```bash
npx tsx --test tests/executor/workflow-executor.test.ts
npm run build:executor
git add .claude/workflows/qcet-plan-executor.js tests/executor/workflow-executor.test.ts .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): add lane scheduling and fail-fast cancellation"
```

---

### Task 7: Shard Contract, Review Trigger Engine, and Mid-Run Independent Review

**Files:**
- Modify: `.claude/workflows/qcet-plan-executor.js`
- Modify: `.claude/agents/qcet-skeptic.md`
- Modify: `tests/executor/workflow-executor.test.ts`
- Create: `tests/executor/review-policy.test.ts`
- Regenerate: `.claude/dist/qcet-plan-executor.bundle.js`

**Interfaces:**
- `buildShardContract(shard, recon): object`
- `validateShardContract(contract): { valid, errors }`
- `shouldReviewCheckpoint(state): { required, reasons }`
- skeptic modes: `contract`, `implementation`, `integration`

- [ ] **Step 1: Add failing contract validation tests**

A valid contract requires non-empty:

```text
shardId
objective
requirements
owns
acceptanceCriteria
verificationPlan
```

`CRITICAL` additionally requires `expectedContracts` and a security/domain verification item.

- [ ] **Step 2: Add failing review-trigger tests**

Require immediate checkpoint review when any is true:

```text
risk high/critical
schema.prisma or prisma/migrations touched
auth/rbac/permission surface touched
ownership boundary touched
new failing tests detected
expected contract changed
changeSurfaceScore >= 18
```

Low-risk UI shards below threshold review only at shard completion.

- [ ] **Step 3: Run targeted tests and confirm RED**

```bash
npx tsx --test tests/executor/review-policy.test.ts tests/executor/workflow-executor.test.ts
```

- [ ] **Step 4: Implement contract pre-review**

For STANDARD: contract review runs when risk is high or change surface >= 18.
For CRITICAL: always run `qcet-skeptic` with `reviewMode: 'contract'` before builder launch.
For MICRO: skip pre-review but keep final independent implementation review.

- [ ] **Step 5: Implement checkpoint review**

After a builder returns structured implementation evidence, evaluate `shouldReviewCheckpoint`. If required, run deterministic checks first, then call skeptic in `implementation` mode. Builder summary is passed only as a claim set; the skeptic prompt explicitly requires reading actual git diff/repository/test output.

- [ ] **Step 6: Update skeptic instructions**

Add the three modes and the invariant:

```text
Never approve from builder prose alone. Inspect actual repository state, actual diff, actual tests, and mapped requirement evidence.
```

- [ ] **Step 7: Verify and commit**

```bash
npx tsx --test tests/executor/review-policy.test.ts tests/executor/workflow-executor.test.ts
npm run build:executor
git add .claude/workflows/qcet-plan-executor.js .claude/agents/qcet-skeptic.md tests/executor/review-policy.test.ts tests/executor/workflow-executor.test.ts .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): add checkpointed independent review pipeline"
```

---

### Task 8: Proof Bundles, Witness-Derived State, and Deterministic Shard Gate

**Files:**
- Modify: `.claude/hooks/qcet-run-state.cjs`
- Modify: `.claude/hooks/subagent-stop-evidence-gate`
- Modify: `.claude/agents/qcet-telemetry-recorder.md`
- Modify: `.claude/workflows/qcet-plan-executor.js`
- Create: `tests/executor/proof-bundle.test.ts`
- Modify: `tests/executor/hooks.test.ts`
- Modify: `tests/executor/workflow-executor.test.ts`
- Regenerate: `.claude/dist/qcet-plan-executor.bundle.js`

**Interfaces:**
- `validateShardProof(proof, contract): { valid, blockers }`
- `deriveShardState(witnesses): 'PLANNED'|'WORKTREE_READY'|'IMPLEMENTED'|'PROVEN'|'VERIFIED'|'BLOCKED'`
- canonical proof fields: `shardId`, `baseCommit`, `checkpointRef`, `touchedFiles`, `requirementsProven`, `checks`, `verification`, `ownership`, `worktree`, `unresolvedFindings`

- [ ] **Step 1: Write failing proof-validation tests**

A proof fails when:

- a contract requirement is missing from `requirementsProven`;
- any required check has non-zero exit code;
- ownership/worktree status is not `pass`;
- verification is not `pass`;
- unresolved `high` or `critical` finding exists.

- [ ] **Step 2: Write failing witness-state tests**

```text
contract only -> PLANNED
+ worktree witness -> WORKTREE_READY
+ implemented witness -> IMPLEMENTED
+ valid proof -> PROVEN
+ verified witness -> VERIFIED
blocked witness at any point -> BLOCKED
```

- [ ] **Step 3: Run tests and confirm RED**

```bash
npx tsx --test tests/executor/proof-bundle.test.ts tests/executor/hooks.test.ts tests/executor/workflow-executor.test.ts
```

- [ ] **Step 4: Implement proof validator and witness writer**

Use bounded command evidence:

```js
{
  command: 'npm test -- tests/unit/auth.test.ts',
  exitCode: 0,
  outputDigest: 'sha256:<hex>',
  outputTail: '<last bounded lines>',
}
```

Do not persist unlimited stdout.

- [ ] **Step 5: Strengthen SubagentStop evidence gate**

For builder success, require structured evidence to contain changed files, tests run, requirements satisfied, and executor run/shard identity. The gate does not declare the shard verified; it only proves the builder returned a complete handoff.

- [ ] **Step 6: Add deterministic shard gate**

The workflow may unblock dependent writes only when `validateShardProof(...)` passes. A skeptic `pass` without complete proof is `EVIDENCE_INCOMPLETE`, not success.

- [ ] **Step 7: Verify and commit**

```bash
npx tsx --test tests/executor/proof-bundle.test.ts tests/executor/hooks.test.ts tests/executor/workflow-executor.test.ts
npm run build:executor
git add .claude/hooks/qcet-run-state.cjs .claude/hooks/subagent-stop-evidence-gate .claude/agents/qcet-telemetry-recorder.md .claude/workflows/qcet-plan-executor.js tests/executor/proof-bundle.test.ts tests/executor/hooks.test.ts tests/executor/workflow-executor.test.ts .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): require machine-verifiable shard proof"
```

---

### Task 9: Git Checkpoints, Idempotent Phase Keys, Resume Capsules, and Progress Circuit Breaker V2

**Files:**
- Create: `.claude/hooks/qcet-checkpoint`
- Modify: `.claude/hooks/qcet-run-state.cjs`
- Modify: `.claude/workflows/qcet-plan-executor.js`
- Create: `tests/executor/checkpoint.test.ts`
- Create: `tests/executor/recovery.test.ts`
- Modify: `tests/executor/workflow-executor.test.ts`
- Regenerate: `.claude/dist/qcet-plan-executor.bundle.js`

**Interfaces:**
- checkpoint command protocol input: `{ runId, shardId, stage, worktreeRoot }`
- checkpoint output: `{ status, ref, commit, tree }`
- `computePhaseKey({ runId, shardId, phase, inputStateHash, baseCommit }): string`
- `buildResumeCapsule(state): object`
- `computeProgressSignature(state): string`

- [ ] **Step 1: Add failing checkpoint tests**

Create a temporary git repository, modify a file, invoke `qcet-checkpoint`, and assert a ref matching:

```text
refs/qcet/<runId>/<shardId>/<stage>
```

points at a reachable checkpoint commit without changing the checked-out branch HEAD.

- [ ] **Step 2: Add failing idempotency tests**

The same phase inputs produce the same key. Changing base commit, phase, or input-state hash changes the key.

- [ ] **Step 3: Add failing progress-signature tests**

A repair that resolves finding `A` but introduces `C` must produce a different signature even if total issue count stays 2. Identical diff/checks/finding sets produce the same signature.

- [ ] **Step 4: Run tests and confirm RED**

```bash
npx tsx --test tests/executor/checkpoint.test.ts tests/executor/recovery.test.ts tests/executor/workflow-executor.test.ts
```

- [ ] **Step 5: Implement checkpoint hook**

Use Git plumbing to create a recoverable commit/ref from the worktree state without moving the user branch. Ref names and run/shard/stage segments must be sanitized.

- [ ] **Step 6: Implement phase reuse policy in the workflow**

Represent phase state as:

```text
COMPLETED -> reuse only when matching witnessed artifact exists
FAILED -> retry if budget allows
UNKNOWN -> inspect/reconcile before rerun
NOT_RUN -> execute
```

Do not claim exactly-once external effects when evidence is missing.

- [ ] **Step 7: Implement Resume Capsule**

Return only:

```js
{
  runId,
  shardId,
  baseCommit,
  checkpointRef,
  objective,
  requirements,
  touchedFiles,
  resolvedFindings,
  remainingFindings,
  failingChecks,
  proofRefs,
}
```

A replacement agent receives this capsule plus the current shard contract/JIT context.

- [ ] **Step 8: Replace issue-count-only repair stagnation with progress signatures**

Policy:

```text
first no-progress cycle -> run one targeted falsifying diagnostic/reverify
second consecutive no-progress cycle -> mark REPAIR_STAGNATED, rollback to last accepted checkpoint, block shard
```

- [ ] **Step 9: Verify and commit**

```bash
npx tsx --test tests/executor/checkpoint.test.ts tests/executor/recovery.test.ts tests/executor/workflow-executor.test.ts
npm run build:executor
git add .claude/hooks/qcet-checkpoint .claude/hooks/qcet-run-state.cjs .claude/workflows/qcet-plan-executor.js tests/executor/checkpoint.test.ts tests/executor/recovery.test.ts tests/executor/workflow-executor.test.ts .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): add durable checkpoints and evidence-aware recovery"
```

---

### Task 10: Three-Stage Release Gates and Reproducible Delivery HEAD

**Files:**
- Modify: `.claude/workflows/qcet-plan-executor.js`
- Create: `.claude/hooks/qcet-delivery-proof`
- Create: `tests/executor/release-gates.test.ts`
- Modify: `tests/executor/workflow-executor.test.ts`
- Regenerate: `.claude/dist/qcet-plan-executor.bundle.js`

**Interfaces:**
- `evaluateShardGate(input)`
- `evaluateIntegrationGate(input)`
- `evaluateDeliveryGate(input)`
- `evaluateDeterministicReleaseGate(input)` becomes the final composition of all three gates

- [ ] **Step 1: Write failing gate tests**

Require:

```text
Shard Gate blocks incomplete proof.
Integration Gate blocks unresolved high/critical integration findings.
Delivery Gate blocks missing pinned source SHA.
Delivery Gate blocks missing delivery commit/checkpoint.
Delivery Gate blocks failed revalidation of exact delivery HEAD.
Final READY requires all three gates READY.
```

- [ ] **Step 2: Run tests and confirm RED**

```bash
npx tsx --test tests/executor/release-gates.test.ts tests/executor/workflow-executor.test.ts
```

- [ ] **Step 3: Implement `qcet-delivery-proof`**

The hook/worker action receives an exact delivery worktree root and runs:

```text
git status --short
git rev-parse HEAD
```

It records exact HEAD/checkpoint identity and executes the configured final validation command set. The proof reports real exit codes; it cannot return `pass` if any required command failed.

- [ ] **Step 4: Refactor the deterministic release gate**

Keep backwards-compatible blocker messages where current tests depend on them, but add explicit stage output:

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

- [ ] **Step 5: Verify and commit**

```bash
npx tsx --test tests/executor/release-gates.test.ts tests/executor/workflow-executor.test.ts
npm run build:executor
git add .claude/workflows/qcet-plan-executor.js .claude/hooks/qcet-delivery-proof tests/executor/release-gates.test.ts tests/executor/workflow-executor.test.ts .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): prove shard integration and delivery readiness"
```

---

### Task 11: Immutable Live Telemetry and Explicit Synthetic/Live Evaluation

**Files:**
- Modify: `.claude/workflows/qcet-plan-executor.js`
- Modify: `.claude/agents/qcet-telemetry-recorder.md`
- Modify: `scripts/run-eval-suite.mjs`
- Modify: `scripts/run-benchmark.mjs`
- Create: `scripts/lib/live-benchmark.mjs`
- Create: `scripts/compare-live-executor-runs.mjs`
- Create: `tests/executor/live-benchmark.test.ts`
- Modify: `package.json`
- Modify: `.claude/executor-evals/README.md`
- Regenerate: `.claude/dist/qcet-plan-executor.bundle.js`

**Interfaces:**
- live per-run path: `.claude/executor-evals/runs/<runId>.json`
- `validateLiveRun(payload)`
- `compareLiveRunSets(baselineRuns, candidateRuns)`
- `median(values)`

- [ ] **Step 1: Add failing live-benchmark tests**

Require rejection when `sourceCommit`, `executorCommit`, `plan`, or `domain` is missing. Require strict compare to reject mismatched source commit/plan/domain.

Performance rule for comparable runs:

```text
candidate median wall-clock <= baseline median * 1.05
candidate measured tokens <= baseline median * 1.10
```

Token comparison returns `NOT_MEASURED` when either side lacks measured token values; never estimate tokens.

- [ ] **Step 2: Run test and confirm RED**

```bash
npx tsx --test tests/executor/live-benchmark.test.ts
```

- [ ] **Step 3: Relabel synthetic scripts**

`run-eval-suite.mjs` output must contain `mode: 'synthetic'` and log prefix `[synthetic-eval]`.

`run-benchmark.mjs` output must contain `mode: 'synthetic'` and log prefix `[synthetic-benchmark]`.

- [ ] **Step 4: Add package scripts**

```json
"eval:synthetic": "node scripts/run-eval-suite.mjs",
"eval:synthetic:benchmark": "node scripts/run-benchmark.mjs",
"eval:live:compare": "node scripts/compare-live-executor-runs.mjs",
"eval:suite": "npm run eval:synthetic",
"eval:benchmark": "npm run eval:synthetic:benchmark"
```

- [ ] **Step 5: Extend telemetry provenance**

Store runtime fingerprint, source commit, executor commit, execution mode, lane limits, agent counts, wall clock, calibration, time-to-first-builder, critical path, dependency wait, repair rounds, stalls, conflicts, review costs, requirement coverage, and final gate state. Unknown measurements remain `null`.

- [ ] **Step 6: Persist immutable run telemetry plus latest snapshot**

Telemetry recorder writes:

```text
.claude/executor-evals/runs/<runId>.json
.claude/executor-evals/run-telemetry.json
```

It must reject path traversal in `runId`.

- [ ] **Step 7: Verify and commit**

```bash
npx tsx --test tests/executor/live-benchmark.test.ts
npm run eval:synthetic
npm run eval:synthetic:benchmark
npm run build:executor
git add .claude/workflows/qcet-plan-executor.js .claude/agents/qcet-telemetry-recorder.md scripts package.json tests/executor/live-benchmark.test.ts .claude/executor-evals/README.md .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): separate live evidence from synthetic evaluation"
```

---

### Task 12: Fault-Injection and Compatibility Canary Suite

**Files:**
- Create: `tests/executor/fault-injection.test.ts`
- Create: `tests/executor/canary-policy.test.ts`
- Create: `scripts/run-executor-canary.mjs`
- Modify: `package.json`

**Interfaces:**
- `npm run test:executor:faults`
- `npm run executor:canary`

- [ ] **Step 1: Implement deterministic injected failure fixtures**

Cover all of:

```text
builder null
malformed builder schema
worktree root mismatch
wrong/stale base commit
missing ownership
out-of-scope ownership
same-file runtime conflict
targeted test exit 1
skeptic null/crash
agent budget exhaustion
dependency failure with descendants
repair no-progress twice
witness persistence failure
incomplete proof bundle
unresolved high integration finding
```

- [ ] **Step 2: Assert fail-closed invariants**

Every fixture must assert:

```text
final status != READY
finite retry/agent count
no out-of-scope mutation accepted
machine-readable failureReason present
```

- [ ] **Step 3: Build compatibility canary policy**

A canary run set is required when any recorded fingerprint field changes among:

```text
executorVersion
claudeCodeVersion
model
effort
agent config digest
hook policy digest
```

Canary fixtures include MICRO, dependency STANDARD, conflict, repair, and CRITICAL/auth-like manifests.

- [ ] **Step 4: Add scripts**

```json
"test:executor:faults": "npx tsx --test tests/executor/fault-injection.test.ts",
"executor:canary": "node scripts/run-executor-canary.mjs"
```

- [ ] **Step 5: Verify and commit**

```bash
npm run test:executor:faults
npm run executor:canary
npm run test:executor
git add tests/executor/fault-injection.test.ts tests/executor/canary-policy.test.ts scripts/run-executor-canary.mjs package.json
git commit -m "test(executor): add fault injection and runtime canaries"
```

---

### Task 13: Shadow Performance Controllers and ROI Telemetry

**Files:**
- Modify: `.claude/workflows/qcet-plan-executor.js`
- Create: `scripts/lib/executor-policy-analysis.mjs`
- Create: `scripts/analyze-executor-roi.mjs`
- Create: `tests/executor/policy-analysis.test.ts`
- Modify: `package.json`
- Regenerate: `.claude/dist/qcet-plan-executor.bundle.js`

**Interfaces:**
- `recommendConcurrency(metrics, currentConfig)` returns recommendation only
- `computeVerifierRoi(records)` returns evidence summaries only
- `recommendPhaseBudget(metrics)` returns recommendation only
- all three remain `mode: 'shadow'` in V2.3

- [ ] **Step 1: Add failing deterministic recommendation tests**

Examples:

```text
high conflict/stall rate -> recommend lower concurrency
large ready queue + low failure/conflict + dependency wait dominating -> may recommend +1 within hard cap
insufficient samples -> recommend no change
```

No recommendation may exceed 16 or fall below 2.

- [ ] **Step 2: Add verifier ROI tests**

Given records with duration/token cost and confirmed findings, compute counts/rates without automatically changing production verification policy.

- [ ] **Step 3: Run test and confirm RED**

```bash
npx tsx --test tests/executor/policy-analysis.test.ts
```

- [ ] **Step 4: Implement shadow-only workflow telemetry**

At finalization, compute and store:

```js
shadowRecommendations: {
  concurrency: {...},
  verifierPolicy: {...},
  phaseBudget: {...},
}
```

Do not apply these recommendations to the current run.

- [ ] **Step 5: Add offline ROI analyzer**

```json
"executor:roi": "node scripts/analyze-executor-roi.mjs"
```

It reads immutable live telemetry and prints sample counts, medians, confirmed finding yield, review cost, stalls/conflicts, and recommendation confidence. It must refuse to recommend pruning a verifier when sample size is below the configured minimum or any critical defect was caught by that verifier in the sample.

- [ ] **Step 6: Verify and commit**

```bash
npx tsx --test tests/executor/policy-analysis.test.ts
npm run build:executor
git add .claude/workflows/qcet-plan-executor.js scripts/lib/executor-policy-analysis.mjs scripts/analyze-executor-roi.mjs tests/executor/policy-analysis.test.ts package.json .claude/dist/qcet-plan-executor.bundle.js
git commit -m "feat(executor): add shadow performance policy analysis"
```

---

### Task 14: Full Regression, Live Ultracode Benchmark, and Architecture Freeze

**Files:**
- Modify after evidence only: `.claude/skills/qcet-plan-executor/SKILL.md`
- Create after pass: `docs/architecture/QCET_PLAN_EXECUTOR_V2_FINAL.md`
- Modify after pass: `.claude/executor-evals/README.md`
- Verify: `.claude/dist/qcet-plan-executor.bundle.js`

**Interfaces:**
- Produces: final freeze decision and documented V2.3 runtime contract

- [ ] **Step 1: Run complete deterministic verification**

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

Every command must exit 0.

- [ ] **Step 2: Verify harness-only diff**

```bash
git status --short
git diff --stat V15_BASE_SHA...HEAD
```

Expected: only `.claude/`, `tests/executor/`, executor-specific `scripts/`, `package.json`, and executor/design docs. No QCET application feature files under `src/`, Prisma product schema, or unrelated tests may be changed.

- [ ] **Step 3: Run live smoke plan through Ultracode**

Use structured invocation containing:

```json
{
  "planPath": "<representative executor-safe plan>",
  "budget": "high",
  "worktreeIsolation": "auto",
  "domain": "executor-canary",
  "sourceCommit": "<exact 40-char source SHA>",
  "executorCommit": "<exact 40-char executor SHA>",
  "runId": "v23-smoke-<unique>"
}
```

Inspect `/workflows` and immutable telemetry. Required smoke properties:

```text
no runaway agent fanout
peak agents <= configured limit
no permission loop
no worktree escape
independent checkpoint review runs when triggered
proof bundles persist
final gate state matches actual validation
```

- [ ] **Step 4: Run comparable live benchmark sets**

For each available representative domain (`ux`, `business-domain`, `data-architecture`), run at least 3 candidate V2.3 runs from the exact same source commit/plan/runtime profile. Use median wall-clock; never select the fastest run.

If a reproducible V1.5 run can be executed on the same source commit/plan/runtime profile, compare strictly with:

```bash
npm run eval:live:compare -- --baseline <baseline-run-files> --candidate <candidate-run-files>
```

If historical V1.5 data lacks pinned source/runtime provenance, label it `legacy-unpinned` and do not claim strict A/B speed improvement from it.

- [ ] **Step 5: Enforce final freeze criteria**

All must hold:

```text
100% mapped requirement coverage
0 silent READY
0 ownership/worktree escape
0 unresolved critical/high finding at READY
fault injection fails closed
recovery does not discard proven work
candidate median wall-clock <= comparable V1.5 * 1.05
measured candidate tokens <= comparable V1.5 * 1.10, or NOT_MEASURED
no correctness regression
```

Performance being faster is preferred; `<= +5%` is the maximum acceptable regression only when correctness/reliability materially improves and the comparison is strict/comparable.

- [ ] **Step 6: Write the final architecture freeze document**

`docs/architecture/QCET_PLAN_EXECUTOR_V2_FINAL.md` must state:

```text
STATUS: ARCHITECTURE FROZEN
VERSION: V2.3
RUNTIME: Ultracode / Claude Code Dynamic Workflows
ORCHESTRATOR: .claude/workflows/qcet-plan-executor.js
```

Document execution modes, scheduler lanes, review pipeline, proof model, recovery model, release gates, telemetry/eval policy, and the rule that future orchestration changes require a measured bottleneck, correctness/reliability failure, or material runtime change plus regression evidence.

- [ ] **Step 7: Update skill docs to final invocation contract**

Document V2.3 args, execution modes, artifacts, and how to inspect `/workflows` plus `.claude/executor-evals/runs/`.

- [ ] **Step 8: Final verification and commit**

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

V2.3 is complete only when all statements below are true:

- `budget: "high"` maps to a real bounded scheduler profile.
- Runtime concurrency is globally clamped and split into logical READ/WRITE/VERIFY lanes.
- Critical-path builders cannot be starved by speculative recon work.
- MICRO/STANDARD/CRITICAL modes deterministically reduce unnecessary orchestration.
- Recon/research/read-only roles cannot mutate through general Bash.
- Hook paths work from worktrees through `${CLAUDE_PROJECT_DIR}`.
- Every builder mutation is continuously checked against worktree identity and shard ownership.
- Runtime same-file conflicts are blocked before mutation.
- Builder completion is not equivalent to verification.
- Required shards receive independent contract/implementation review at deterministic checkpoints.
- Every dependency unlock is backed by a valid Shard Proof.
- Repair stagnation uses evidence signatures, not issue count alone.
- Accepted work has recoverable git checkpoints and structured Resume Capsules.
- Release readiness is proven by Shard Gate + Integration Gate + Delivery Gate.
- Exact source and delivery commits are recorded for live runs.
- Immutable live telemetry is separate from synthetic evaluation.
- Fault injection cannot yield silent READY or unbounded retry.
- Adaptive concurrency/verifier pruning remain shadow-only until live evidence explicitly promotes them.
- Full executor tests, fault tests, canary, build, typecheck, lint, application tests, and bundle parity pass.
- Live Ultracode smoke runs complete without worktree escape, permission loops, null-agent cascades, or missing proof.
- `docs/architecture/QCET_PLAN_EXECUTOR_V2_FINAL.md` is committed with `STATUS: ARCHITECTURE FROZEN`.

## Post-Freeze Change Rule

Do not create V2.4 because a new orchestration idea appears interesting. Re-open the architecture only when at least one is demonstrated with evidence:

1. a measured speed/token/queue bottleneck;
2. a correctness or isolation failure;
3. a repeated recovery/stall failure;
4. a material Claude Code/Ultracode runtime change.

Any post-freeze orchestration change must ship with a failing regression test first and comparable live evidence showing no correctness regression.
