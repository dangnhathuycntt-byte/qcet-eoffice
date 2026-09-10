import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateManifestCoverage,
  validateManifestOwnership,
  computeShardPriorities,
  clusterIntegrationFindings,
  buildShardPacket,
  shouldIsolateShard,
} from '../../scripts/lib/executor-contracts.mjs';

test('contracts: validateManifestCoverage detects missing and duplicate requirements', () => {
  const invalidManifest = {
    requirements: [
      { id: 'REQ-1', description: 'First req' },
      { id: 'REQ-1', description: 'Duplicate req' },
      { id: 'REQ-2', description: 'Second req' },
    ],
    shards: [
      {
        id: 'shard-1',
        objective: 'Objective 1',
        requirements: ['REQ-1', 'REQ-3'], // REQ-3 is unknown
        owns: ['src/a.ts'],
      },
    ],
  };

  const errors = validateManifestCoverage(invalidManifest);
  assert.ok(errors.some((e) => e.includes('Duplicate requirement IDs in manifest: REQ-1')));
  assert.ok(errors.some((e) => e.includes('Unclaimed plan requirements (missing coverage): REQ-2')));
  assert.ok(errors.some((e) => e.includes('Unknown requirement IDs claimed by shards: REQ-3')));
});

test('contracts: validateManifestCoverage passes for clean complete manifest', () => {
  const cleanManifest = {
    requirements: [
      { id: 'REQ-1', description: 'First' },
      { id: 'REQ-2', description: 'Second' },
    ],
    shards: [
      {
        id: 'shard-1',
        objective: 'First objective',
        requirements: ['REQ-1'],
        owns: ['src/a.ts'],
      },
      {
        id: 'shard-2',
        objective: 'Second objective',
        requirements: ['REQ-2'],
        owns: ['src/b.ts'],
      },
    ],
  };

  const errors = validateManifestCoverage(cleanManifest);
  assert.deepEqual(errors, []);
});

test('contracts: validateManifestOwnership catches overlapping ownership between unisolated shards', () => {
  const manifestWithOverlap = {
    shards: [
      { id: 'shard-1', owns: ['src/shared/**'], isolation: 'none' },
      { id: 'shard-2', owns: ['src/shared/utils.ts'], isolation: 'none' },
    ],
  };

  const errors = validateManifestOwnership(manifestWithOverlap);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes("Mutable ownership overlap between shard 'shard-1' and shard 'shard-2'"));
});

test('contracts: validateManifestOwnership permits overlap when isolated via worktree', () => {
  const manifestWithWorktree = {
    shards: [
      { id: 'shard-1', owns: ['src/shared/**'], isolation: 'worktree' },
      { id: 'shard-2', owns: ['src/shared/utils.ts'], isolation: 'none' },
    ],
  };

  const errors = validateManifestOwnership(manifestWithWorktree);
  assert.deepEqual(errors, []);
});

test('contracts: computeShardPriorities correctly ranks dependencies', () => {
  const manifest = {
    shards: [
      { id: 'shard-leaf', dependencies: ['shard-core'], risk: 'low', requirements: ['R1'], owns: ['O1'] },
      { id: 'shard-core', dependencies: [], risk: 'critical', requirements: ['R2', 'R3'], owns: ['O2'] },
    ],
  };

  const priorities = computeShardPriorities(manifest);
  const corePriority = priorities.get('shard-core');
  const leafPriority = priorities.get('shard-leaf');

  assert.ok(corePriority.priority > leafPriority.priority, 'Core shard with dependents must have higher priority');
  assert.equal(corePriority.transitiveDownstream, 1);
  assert.equal(leafPriority.transitiveDownstream, 0);
});

test('contracts: clusterIntegrationFindings groups overlapping files', () => {
  const findings = [
    { severity: 'high', file: 'src/domain/task.ts', description: 'Bug 1', evidence: 'E1' },
    { severity: 'medium', file: 'src/domain/task.ts', description: 'Bug 2', evidence: 'E2' },
    { severity: 'low', file: 'src/ui/dashboard.tsx', description: 'Bug 3', evidence: 'E3' },
  ];

  const clusters = clusterIntegrationFindings(findings);
  assert.equal(clusters.length, 2);
  const taskCluster = clusters.find((c) => c.files.includes('src/domain/task.ts'));
  assert.ok(taskCluster);
  assert.equal(taskCluster.findings.length, 2);
});

test('contracts: buildShardPacket backfills requirement descriptions from manifest', () => {
  const manifest = {
    requirements: [
      { id: 'REQ-AUTH', description: 'Implement token validation' },
    ],
  };
  const shard = {
    id: 'shard-auth',
    objective: 'Implement auth',
    requirements: ['REQ-AUTH'],
    owns: ['src/auth/**'],
  };

  const packet = buildShardPacket(shard, manifest);
  assert.ok(packet);
  assert.equal(packet.id, 'shard-auth');
  assert.equal(packet.requirementDetails.length, 1);
  assert.equal(packet.requirementDetails[0].id, 'REQ-AUTH');
  assert.equal(packet.requirementDetails[0].text, 'Implement token validation');
});
