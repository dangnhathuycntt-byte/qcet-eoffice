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
