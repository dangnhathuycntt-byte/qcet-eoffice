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

const { evaluateDeterministicReleaseGate, computeCanonicalVerificationPassed, buildGateArtifact } = sandbox;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function passingShard(id: string, reqs: string[] = []) {
  return { shard: { id, requirements: reqs }, lastVerification: { verdict: 'pass' } };
}

function makeManifest(shardIds: string[], reqIds: string[] = []) {
  return {
    shards: shardIds.map((id) => ({ id })),
    requirements: reqIds.map((id) => ({ id })),
  };
}

const passingValidation = { status: 'pass', checks: [{ name: 'typecheck', status: 'passed' }] };

// ─── Existing regression tests ─────────────────────────────────────────────────

test('release-gate: passes and returns READY when all conditions met', () => {
  const manifest = {
    requirements: [{ id: 'REQ-1' }, { id: 'REQ-2' }],
  };
  const allShardResults = [
    {
      shard: { id: 'shard-1', requirements: ['REQ-1'] },
      lastVerification: { verdict: 'pass' },
    },
    {
      shard: { id: 'shard-2', requirements: ['REQ-2'] },
      lastVerification: { verdict: 'pass' },
    },
  ];
  const validation = {
    status: 'pass',
    checks: [{ name: 'typecheck', status: 'passed' }],
  };

  const gate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults,
    validation,
    finalVerdict: { status: 'READY' },
  });

  assert.equal(gate.status, 'READY');
  assert.equal(gate.ready, true);
  assert.equal(gate.blockers.length, 0);
});

test('release-gate: blocks if shard verification failed or blocked', () => {
  const manifest = { requirements: [{ id: 'REQ-1' }] };
  const allShardResults = [
    {
      shard: { id: 'shard-1', requirements: ['REQ-1'] },
      lastVerification: { verdict: 'fail' },
    },
  ];
  const validation = { status: 'pass' };

  const gate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults,
    validation,
  });

  assert.equal(gate.status, 'BLOCKED');
  assert.equal(gate.ready, false);
  assert.ok(gate.blockers.some((b: string) => b.includes('shard-1')));
});

test('release-gate: blocks if requirement coverage is incomplete', () => {
  const manifest = { requirements: [{ id: 'REQ-1' }, { id: 'REQ-2' }] };
  const allShardResults = [
    {
      shard: { id: 'shard-1', requirements: ['REQ-1'] },
      lastVerification: { verdict: 'pass' },
    },
  ];
  const validation = { status: 'pass' };

  const gate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults,
    validation,
  });

  assert.equal(gate.status, 'BLOCKED');
  assert.ok(gate.blockers.some((b: string) => b.includes('REQ-2')));
});

test('release-gate: allows preExisting failure with baseline evidence', () => {
  const manifest = { requirements: [{ id: 'REQ-1' }] };
  const allShardResults = [
    {
      shard: { id: 'shard-1', requirements: ['REQ-1'] },
      lastVerification: { verdict: 'pass' },
    },
  ];
  const validation = {
    status: 'pass',
    checks: [
      {
        name: 'legacy-lint',
        status: 'failed',
        preExisting: true,
        baselineEvidence: 'Present on commit af9f55b4 before run started',
      },
    ],
  };

  const gate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults,
    validation,
    finalVerdict: { status: 'READY' },
  });

  assert.equal(gate.status, 'READY');
  assert.equal(gate.ready, true);
});

test('release-gate: blocks preExisting failure without baseline evidence', () => {
  const manifest = { requirements: [{ id: 'REQ-1' }] };
  const allShardResults = [
    {
      shard: { id: 'shard-1', requirements: ['REQ-1'] },
      lastVerification: { verdict: 'pass' },
    },
  ];
  const validation = {
    status: 'pass',
    checks: [
      {
        name: 'unsubstantiated-lint',
        status: 'failed',
        preExisting: true,
        // missing baselineEvidence!
      },
    ],
  };

  const gate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults,
    validation,
    finalVerdict: { status: 'READY' },
  });

  assert.equal(gate.status, 'BLOCKED');
  assert.ok(gate.blockers.some((b: string) => b.includes('baseline evidence')));
});

test('release-gate: blocks if ownership or worktree violation recorded', () => {
  const manifest = { requirements: [{ id: 'REQ-1' }] };
  const allShardResults = [
    {
      shard: { id: 'shard-1', requirements: ['REQ-1'] },
      lastVerification: { verdict: 'pass' },
      ownershipViolation: 'Attempted to edit outside owns: src/foo.ts',
    },
  ];
  const validation = { status: 'pass' };

  const gate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults,
    validation,
  });

  assert.equal(gate.status, 'BLOCKED');
  assert.ok(gate.blockers.some((b: string) => b.includes('ownership violation')));
});

// ─── Phase 4: New invariant enforcement tests ──────────────────────────────────

// Test 14: missing required shard result → verificationPassed=false → BLOCKED
test('gate invariant: missing required shard result → BLOCKED', () => {
  const manifest = makeManifest(['s1', 's2']);
  const allShardResults = [passingShard('s1')]; // s2 is missing
  const gate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults,
    validation: passingValidation,
    finalVerdict: { status: 'READY' },
  });
  assert.equal(gate.status, 'BLOCKED');
  assert.equal(gate.ready, false);
});

// Test 15: null shard result → BLOCKED
test('gate invariant: null required shard result → BLOCKED', () => {
  const manifest = makeManifest(['s1']);
  const allShardResults = [null];
  const gate = evaluateDeterministicReleaseGate({
    manifest: { ...manifest, requirements: [] },
    allShardResults,
    validation: passingValidation,
    finalVerdict: { status: 'READY' },
  });
  assert.equal(gate.status, 'BLOCKED');
  assert.equal(gate.ready, false);
});

// Test 16: missing lastVerification → BLOCKED
test('gate invariant: shard missing lastVerification → BLOCKED', () => {
  const manifest = { shards: [{ id: 's1' }], requirements: [] };
  const allShardResults = [{ shard: { id: 's1', requirements: [] } }]; // no lastVerification
  const gate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults,
    validation: passingValidation,
    finalVerdict: { status: 'READY' },
  });
  assert.equal(gate.status, 'BLOCKED');
  assert.equal(gate.ready, false);
  assert.ok(gate.blockers.some((b: string) => b.includes('no verification record')));
});

// Test 17: lastVerification=fail → BLOCKED
test('gate invariant: lastVerification=fail → BLOCKED', () => {
  const manifest = { shards: [{ id: 's1' }], requirements: [] };
  const allShardResults = [{ shard: { id: 's1', requirements: [] }, lastVerification: { verdict: 'fail' } }];
  const gate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults,
    validation: passingValidation,
    finalVerdict: { status: 'READY' },
  });
  assert.equal(gate.status, 'BLOCKED');
  assert.equal(gate.ready, false);
});

// Test 18: lastVerification=blocked → BLOCKED
test('gate invariant: lastVerification=blocked → BLOCKED', () => {
  const manifest = { shards: [{ id: 's1' }], requirements: [] };
  const allShardResults = [{ shard: { id: 's1', requirements: [] }, lastVerification: { verdict: 'blocked' } }];
  const gate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults,
    validation: passingValidation,
    finalVerdict: { status: 'READY' },
  });
  assert.equal(gate.status, 'BLOCKED');
  assert.equal(gate.ready, false);
  assert.ok(gate.blockers.some((b: string) => b.includes('s1')));
});

// Test 19: all required shard verification pass → verificationPassed=true
test('gate invariant: all required shards pass → verificationPassed=true', () => {
  const manifest = makeManifest(['s1', 's2']);
  const allShardResults = [passingShard('s1'), passingShard('s2')];
  const passed = computeCanonicalVerificationPassed(manifest, allShardResults);
  assert.equal(passed, true);
});

// Test 20: Global Validation PASS cannot override failed shard verification
test('gate invariant: global validation PASS cannot override failed shard', () => {
  const manifest = { shards: [{ id: 's1' }], requirements: [] };
  const allShardResults = [{ shard: { id: 's1', requirements: [] }, lastVerification: { verdict: 'blocked' } }];
  const gate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults,
    validation: passingValidation,
    integrationRepair: { status: 'completed' }, // repair completed
    finalVerdict: { status: 'READY' },
  });
  // Must still be BLOCKED — integration repair + global validation cannot substitute
  assert.equal(gate.status, 'BLOCKED');
  assert.equal(gate.ready, false);
});

// Test 21: final skeptic READY cannot override failed shard verification
test('gate invariant: final skeptic READY cannot override failed shard', () => {
  const manifest = { shards: [{ id: 's1' }], requirements: [] };
  const allShardResults = [{ shard: { id: 's1', requirements: [] }, lastVerification: { verdict: 'fail' } }];
  const gate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults,
    validation: passingValidation,
    finalVerdict: { status: 'READY', rationale: 'skeptic says ready', blockers: [] },
  });
  assert.equal(gate.status, 'BLOCKED');
});

// Test 22: READY implies verificationPassed=true
test('gate artifact: READY implies verificationPassed=true', () => {
  const manifest = makeManifest(['s1']);
  const allShardResults = [passingShard('s1')];
  const artifact = buildGateArtifact('run-1', manifest, allShardResults, { status: 'READY', blockers: [] }, {});
  assert.equal(artifact.status, 'READY');
  assert.equal(artifact.verificationPassed, true);
  assert.equal(artifact.ready, true);
});

// Test 23: READY_WITH_KNOWN_ISSUES implies verificationPassed=true
test('gate artifact: READY_WITH_KNOWN_ISSUES implies verificationPassed=true', () => {
  const manifest = makeManifest(['s1']);
  const allShardResults = [passingShard('s1')];
  const artifact = buildGateArtifact('run-2', manifest, allShardResults,
    { status: 'READY_WITH_KNOWN_ISSUES', blockers: [] }, {});
  assert.equal(artifact.status, 'READY_WITH_KNOWN_ISSUES');
  assert.equal(artifact.verificationPassed, true);
  assert.equal(artifact.ready, true);
});

// Test 24: gate-verdict cannot persist READY when verificationPassed=false
test('gate artifact: cannot persist READY when verificationPassed=false', () => {
  const manifest = makeManifest(['s1']);
  const allShardResults = [{ shard: { id: 's1', requirements: [] }, lastVerification: { verdict: 'blocked' } }];
  const artifact = buildGateArtifact('run-3', manifest, allShardResults,
    { status: 'READY', blockers: [] }, {});
  assert.equal(artifact.verificationPassed, false);
  assert.equal(artifact.status, 'BLOCKED'); // invariant enforced
  assert.equal(artifact.ready, false);
  assert.ok(artifact.blockers.includes('INTERNAL_RELEASE_GATE_INVARIANT_VIOLATION'));
});

// Test 24b: gate-verdict cannot persist READY_WITH_KNOWN_ISSUES when verificationPassed=false
test('gate artifact: cannot persist READY_WITH_KNOWN_ISSUES when verificationPassed=false', () => {
  const manifest = makeManifest(['s1']);
  const allShardResults = [{ shard: { id: 's1', requirements: [] }, lastVerification: { verdict: 'fail' } }];
  const artifact = buildGateArtifact('run-4', manifest, allShardResults,
    { status: 'READY_WITH_KNOWN_ISSUES', blockers: [] }, {});
  assert.equal(artifact.verificationPassed, false);
  assert.equal(artifact.status, 'BLOCKED');
  assert.equal(artifact.ready, false);
});

// Test 25: canonical artifact path behavior still works (buildGateVerdictPath)
test('gate path: buildGateVerdictPath produces canonical path for valid runId', () => {
  const { buildGateVerdictPath } = sandbox;
  const p = buildGateVerdictPath('abc-123_XYZ');
  assert.equal(p, 'qcet-executor-runs/abc-123_XYZ/gate-verdict.json');
});

test('gate path: buildGateVerdictPath throws for invalid runId', () => {
  const { buildGateVerdictPath } = sandbox;
  assert.throws(() => buildGateVerdictPath('../../evil'), /Invalid executor runId/);
  assert.throws(() => buildGateVerdictPath(''), /Invalid executor runId/);
  assert.throws(() => buildGateVerdictPath('has space'), /Invalid executor runId/);
});
