import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const workflowPath = path.resolve(process.cwd(), '.claude/workflows/qcet-plan-executor.js');
const src = fs.readFileSync(workflowPath, 'utf8');
const helpersPart = src.split('// WORKFLOW')[0].replace(/^export\s+/gm, '');
const sandbox: Record<string, any> = { console, process };
vm.createContext(sandbox);
vm.runInContext(helpersPart, sandbox);

const {
  shouldIsolateShard,
  evaluateDeterministicReleaseGate,
  buildRunTelemetry,
  validateResearchEscalation,
  createConcurrencyLimiter,
  selectIntegrationReviewDimensionIds,
  computeCriticalPathDurationMs,
  BUDGET_PROFILES,
  FAILURE_REASONS,
  normalizeBudgetConfig,
  normalizeFailureReason,
  buildRuntimeFingerprint,
} = sandbox;

test('workflow-executor: shouldIsolateShard adheres to isolationConfig modes', () => {
  const shardNormal = { id: 'shard-1', owns: ['lib/auth/**'] };
  const shardIsolated = { id: 'shard-2', owns: ['lib/user/**'], isolated: true };
  const manifest = {
    shards: [shardNormal, shardIsolated],
  };

  // 'never' mode: always false
  assert.equal(shouldIsolateShard(shardIsolated, manifest, 'never'), false);
  assert.equal(shouldIsolateShard(shardNormal, manifest, 'never'), false);

  // 'always' mode: always true
  assert.equal(shouldIsolateShard(shardNormal, manifest, 'always'), true);
  assert.equal(shouldIsolateShard(shardIsolated, manifest, 'always'), true);

  // 'auto' mode: checks shard.isolated or overlap
  assert.equal(shouldIsolateShard(shardIsolated, manifest, 'auto'), true);
  assert.equal(shouldIsolateShard(shardNormal, manifest, 'auto'), false);
});

test('workflow-executor: evaluateDeterministicReleaseGate catches verification blockers and failures', () => {
  const manifest = {
    requirements: [
      { id: 'REQ-1', text: 'Auth flow' },
      { id: 'REQ-2', text: 'Token cache' },
    ],
  };

  // Scenario 1: All clean
  const cleanGate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults: [
      {
        shard: { id: 's1', requirements: ['REQ-1', 'REQ-2'] },
        lastVerification: { verdict: 'pass', issues: [] },
      },
    ],
    integrationSynthesis: { findings: [] },
    integrationRepair: null,
    validation: { status: 'passed', blockers: [], checks: [{ name: 'typecheck', status: 'passed' }] },
    finalVerdict: { status: 'READY', blockers: [] },
  });

  assert.equal(cleanGate.status, 'READY');
  assert.equal(cleanGate.blockers.length, 0);

  // Scenario 2: Validation check failed
  const failedValidationGate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults: [
      {
        shard: { id: 's1', requirements: ['REQ-1', 'REQ-2'] },
        lastVerification: { verdict: 'pass', issues: [] },
      },
    ],
    integrationSynthesis: { findings: [] },
    integrationRepair: null,
    validation: { status: 'failed', blockers: ['Type error in auth.ts'], checks: [{ name: 'typecheck', status: 'failed' }] },
    finalVerdict: { status: 'READY', blockers: [] }, // Agent said READY, but gate must block!
  });

  assert.equal(failedValidationGate.status, 'BLOCKED');
  assert.equal(failedValidationGate.deterministicOverride, true);
  assert.ok(failedValidationGate.blockers.some((b: string) => b.includes('Global validation status is failed')));
  assert.ok(failedValidationGate.blockers.some((b: string) => b.includes('Type error in auth.ts')));

  // Scenario 3: Missing requirements
  const missingReqGate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults: [
      {
        shard: { id: 's1', requirements: ['REQ-1'] },
        lastVerification: { verdict: 'pass', issues: [] },
      },
    ],
    integrationSynthesis: { findings: [] },
    integrationRepair: null,
    validation: { status: 'passed', blockers: [], checks: [] },
    finalVerdict: { status: 'READY', blockers: [] },
  });

  assert.equal(missingReqGate.status, 'BLOCKED');
  assert.equal(missingReqGate.deterministicOverride, true);
  assert.ok(missingReqGate.blockers.some((b: string) => b.includes('requirements missing successful shard implementation')));
});

test('workflow-executor: buildRunTelemetry does not fabricate tokens or durations when unmeasured', () => {
  const telemetry = buildRunTelemetry({
    planPath: 'test-plan.md',
    manifest: {
      requirements: [{ id: 'REQ-1', text: 'Auth flow' }],
      shards: [{ id: 'shard-1', owns: ['lib/auth/**'] }],
    },
    allShardResults: [
      {
        shard: { id: 'shard-1', requirements: ['REQ-1'] },
        lastVerification: { verdict: 'pass' },
      },
    ],
    integrationSynthesis: { findings: [] },
    integrationRepair: null,
    validation: { status: 'passed' },
    finalVerdict: { status: 'READY' },
    // Notice: wallClockMs and tokensTotal are omitted
    agentsCount: 5,
  });

  assert.equal(telemetry.run.tokens, null);
  assert.equal(telemetry.run.metrics.efficiency.tokens, null);
  assert.equal(telemetry.run.metrics.efficiency.tokensPerVerifiedRequirement, null);
  assert.equal(telemetry.comparison.deltaTokens, null);
  assert.equal(telemetry.comparison.deltaTokensPct, null);
  assert.equal(telemetry.comparison.verdict, 'PASS');
});

test('workflow-executor: validateResearchEscalation rejects local codebase queries', () => {
  const shardPacket = {
    id: 'shard-auth',
    owns: ['src/lib/auth/**'],
    antiOwns: ['src/lib/db/**'],
  };

  // Reject local files and internal search queries
  const rejected = validateResearchEscalation(
    {
      needed: true,
      reason: 'Check local code',
      questions: ['What does src/lib/auth/session.ts do?', 'How does internal QCET auth work?'],
    },
    shardPacket
  );
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.questions.length, 0);

  // Accept pure external RFC/spec queries
  const accepted = validateResearchEscalation(
    {
      needed: true,
      reason: 'Check RFC 7519 JWT specification',
      questions: ['What is the registered exp claim behavior in RFC 7519?'],
    },
    shardPacket
  );
  assert.equal(accepted.allowed, true);
  assert.equal(accepted.questions.length, 1);
});


test('workflow-executor: lowercase high integration severity blocks release', () => {
  const gate = evaluateDeterministicReleaseGate({
    manifest: { requirements: [{ id: 'REQ-1' }] },
    allShardResults: [
      { shard: { id: 's1', requirements: ['REQ-1'] }, lastVerification: { verdict: 'pass', issues: [] } },
    ],
    integrationSynthesis: {
      findings: [
        { id: 'INT-1', severity: 'high', category: 'contracts', file: 'src/a.ts', evidence: 'broken', impact: 'runtime', recommendedFix: 'fix' },
      ],
    },
    integrationRepair: null,
    validation: { status: 'passed', checks: [] },
    finalVerdict: { status: 'READY' },
  });

  assert.equal(gate.status, 'BLOCKED');
  assert.ok(gate.blockers.some((b: string) => b.includes('critical/high integration defect')));
});

test('workflow-executor: concurrency limiter caps simultaneous agent work', async () => {
  const limit = createConcurrencyLimiter(2);
  let active = 0;
  let peak = 0;
  const tasks = Array.from({ length: 6 }, (_, i) =>
    limit(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;
      return i;
    })
  );
  const results = await Promise.all(tasks);
  assert.deepEqual(results, [0, 1, 2, 3, 4, 5]);
  assert.equal(peak, 2);
});

test('workflow-executor: buildRunTelemetry preserves measured scheduler timings', () => {
  const telemetry = buildRunTelemetry({
    planPath: 'test-plan.md',
    manifest: { requirements: [], shards: [] },
    allShardResults: [],
    integrationSynthesis: { findings: [] },
    validation: { status: 'passed', checks: [] },
    finalVerdict: { status: 'READY' },
    wallClockMs: 1500,
    calibrationDurationMs: 200,
    timeToFirstBuilderMs: 250,
    criticalPathDurationMs: 900,
    avgDependencyWaitMs: 80,
    domain: 'ux',
    executorVersion: 'v1.5',
  });

  assert.equal(telemetry.run.metrics.speed.timeToFirstBuilderMs, 250);
  assert.equal(telemetry.run.metrics.speed.criticalPathDurationMs, 900);
  assert.equal(telemetry.run.metrics.speed.avgDependencyWaitMs, 80);
  assert.equal(telemetry.run.domain, 'ux');
  assert.equal(telemetry.run.executorVersion, 'v1.5');
});

test('workflow-executor: integration review dimensions adapt to risk', () => {
  assert.equal(
    Array.from(selectIntegrationReviewDimensionIds([
      { id: 's1', risk: 'low', changedFiles: ['src/ui/a.tsx'] },
      { id: 's2', risk: 'low', changedFiles: ['src/ui/b.tsx'] },
    ])).join(','),
    'contracts,regression'
  );

  assert.equal(
    Array.from(selectIntegrationReviewDimensionIds([
      { id: 's1', risk: 'critical', changedFiles: ['src/server/auth/session.ts'] },
    ])).join(','),
    'contracts,authorization,semantics,regression'
  );
});

test('workflow-executor: critical path sums the longest dependency chain', () => {
  const duration = computeCriticalPathDurationMs(
    {
      shards: [
        { id: 'a', dependencies: [] },
        { id: 'b', dependencies: ['a'] },
        { id: 'c', dependencies: ['a'] },
        { id: 'd', dependencies: ['b', 'c'] },
      ],
    },
    { a: 100, b: 200, c: 500, d: 50 }
  );
  assert.equal(duration, 650);
});

test('workflow-executor: normalizeBudgetConfig resolves presets and clamps limits', () => {
  // Preset 'high'
  const high = normalizeBudgetConfig('high');
  assert.equal(high.profile, 'high');
  assert.equal(high.maxConcurrentAgents, 8);
  assert.equal(high.maxAgents, 128);
  assert.deepEqual({ ...high.laneLimits }, { read: 3, write: 3, verify: 2, gitControl: 1 });

  // Preset 'medium'
  const medium = normalizeBudgetConfig('medium');
  assert.equal(medium.profile, 'medium');
  assert.equal(medium.maxConcurrentAgents, 6);
  assert.equal(medium.maxAgents, 72);

  // Preset 'low'
  const low = normalizeBudgetConfig('low');
  assert.equal(low.profile, 'low');
  assert.equal(low.maxConcurrentAgents, 4);
  assert.equal(low.maxAgents, 40);

  // Object overrides
  const overridden = normalizeBudgetConfig({
    profile: 'high',
    maxConcurrentAgents: 10,
    maxAgents: 200,
    laneLimits: { read: 4, write: 4, verify: 3, gitControl: 1 },
  });
  assert.equal(overridden.profile, 'high');
  assert.equal(overridden.maxConcurrentAgents, 10);
  assert.equal(overridden.maxAgents, 200);
  assert.equal(overridden.laneLimits.read, 4);

  // Clamping concurrency: 99 clamps to 16
  const clampedHigh = normalizeBudgetConfig({ maxConcurrentAgents: 99 });
  assert.equal(clampedHigh.maxConcurrentAgents, 16);

  // Clamping agents: 5000 clamps to 1000
  const clampedAgents = normalizeBudgetConfig({ maxAgents: 5000 });
  assert.equal(clampedAgents.maxAgents, 1000);

  // Lane clamping: every lane clamped to 1..maxConcurrentAgents
  const clampedLanes = normalizeBudgetConfig({
    maxConcurrentAgents: 4,
    laneLimits: { read: 10, write: 0, verify: 5, gitControl: 0 },
  });
  assert.equal(clampedLanes.laneLimits.read, 4);
  assert.equal(clampedLanes.laneLimits.write, 1);
  assert.equal(clampedLanes.laneLimits.verify, 4);
  assert.equal(clampedLanes.laneLimits.gitControl, 1);

  // Unknown profile 'turbo' throws
  assert.throws(() => {
    normalizeBudgetConfig('turbo');
  }, /unknown budget profile/i);

  assert.throws(() => {
    normalizeBudgetConfig({ profile: 'turbo' });
  }, /unknown budget profile/i);
});

test('workflow-executor: normalizeFailureReason canonicalizes failure reasons', () => {
  const expectedReasons = [
    'DEPENDENCY_BLOCKED', 'WORKTREE_INVALID', 'OWNERSHIP_CONFLICT',
    'RUNTIME_FILE_CONFLICT', 'AGENT_BUDGET_EXHAUSTED',
    'TURN_BUDGET_EXHAUSTED', 'TOKEN_BUDGET_EXHAUSTED',
    'WALLCLOCK_TIMEOUT', 'AGENT_STALLED', 'NETWORK_INTERRUPTED',
    'SCHEMA_INVALID', 'VERIFICATION_FAILED', 'REPAIR_STAGNATED',
    'TOOL_FAILURE', 'RUNTIME_FAILURE', 'EVIDENCE_INCOMPLETE',
  ];

  for (const reason of expectedReasons) {
    assert.ok(FAILURE_REASONS.has(reason), `FAILURE_REASONS must contain ${reason}`);
    assert.equal(normalizeFailureReason(reason), reason);
  }

  // Unknown reasons normalize to RUNTIME_FAILURE
  assert.equal(normalizeFailureReason('UNKNOWN_ERROR'), 'RUNTIME_FAILURE');
  assert.equal(normalizeFailureReason(''), 'RUNTIME_FAILURE');
  assert.equal(normalizeFailureReason(null), 'RUNTIME_FAILURE');
  assert.equal(normalizeFailureReason(undefined), 'RUNTIME_FAILURE');
});

test('workflow-executor: buildRuntimeFingerprint formats serializable provenance', () => {
  const empty = buildRuntimeFingerprint();
  assert.equal(empty.executorVersion, 'v2.3');
  assert.equal(empty.claudeCodeVersion, null);
  assert.equal(empty.model, null);
  assert.equal(empty.effort, null);
  assert.equal(empty.nodeVersion, null);
  assert.equal(empty.npmVersion, null);
  assert.equal(empty.os, null);
  assert.equal(empty.arch, null);
  assert.equal(empty.budgetProfile, null);
  assert.equal(empty.maxConcurrentAgents, null);
  assert.equal(empty.maxAgents, null);
  assert.equal(empty.sourceCommit, null);
  assert.equal(empty.worktreeIsolation, null);

  const populated = buildRuntimeFingerprint({
    executorVersion: 'v2.3',
    claudeCodeVersion: '1.0.0',
    model: 'claude-3-5-sonnet',
    effort: 'high',
    nodeVersion: 'v20.0.0',
    npmVersion: '10.0.0',
    os: 'darwin',
    arch: 'arm64',
    budgetProfile: 'high',
    maxConcurrentAgents: 8,
    maxAgents: 128,
    sourceCommit: 'abcdef123',
    worktreeIsolation: 'auto',
  });
  assert.equal(populated.budgetProfile, 'high');
  assert.equal(populated.maxConcurrentAgents, 8);
  assert.equal(populated.sourceCommit, 'abcdef123');
});
