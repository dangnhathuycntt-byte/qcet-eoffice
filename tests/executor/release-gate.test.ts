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

const { evaluateDeterministicReleaseGate } = sandbox;

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
