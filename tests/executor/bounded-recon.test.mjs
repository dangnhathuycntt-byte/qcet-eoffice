import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEligibleReconShards } from '../../scripts/lib/dag-scheduler.mjs';

test('bounded-recon: linear DAG (A -> B -> C -> D -> E) with lookaheadDepth=1', () => {
  const manifest = {
    shards: [
      { id: 'A', dependencies: [] },
      { id: 'B', dependencies: ['A'] },
      { id: 'C', dependencies: ['B'] },
      { id: 'D', dependencies: ['C'] },
      { id: 'E', dependencies: ['D'] },
    ],
  };

  const activeIds = new Set();
  const completedIds = new Set();

  // Initial state: only A is ready, B is lookahead 1 hop away
  const initial = computeEligibleReconShards(manifest, activeIds, completedIds, 1);
  assert.equal(initial.has('A'), true, 'A must be eligible (ready shard)');
  assert.equal(initial.has('B'), true, 'B must be eligible (lookahead depth 1)');
  assert.equal(initial.has('C'), false, 'C must NOT be eligible (depth 2)');
  assert.equal(initial.has('D'), false, 'D must NOT be eligible (depth 3)');
  assert.equal(initial.has('E'), false, 'E must NOT be eligible (depth 4)');
  assert.equal(initial.size, 2);

  // A begins active execution: active={A}
  activeIds.add('A');
  const whileAActive = computeEligibleReconShards(manifest, activeIds, completedIds, 1);
  assert.equal(whileAActive.has('A'), true);
  assert.equal(whileAActive.has('B'), true);
  assert.equal(whileAActive.has('C'), false);

  // A completes verified PASS: completed={A}, active={}
  activeIds.delete('A');
  completedIds.add('A');
  const afterAPass = computeEligibleReconShards(manifest, activeIds, completedIds, 1);
  assert.equal(afterAPass.has('A'), false, 'A is completed, excluded from recon');
  assert.equal(afterAPass.has('B'), true, 'B is now ready');
  assert.equal(afterAPass.has('C'), true, 'C is now 1 hop lookahead from B');
  assert.equal(afterAPass.has('D'), false, 'D must NOT be eligible (depth 2 from ready)');
  assert.equal(afterAPass.has('E'), false, 'E must NOT be eligible (depth 3 from ready)');
  assert.equal(afterAPass.size, 2);

  // B begins active execution: active={B}, completed={A}
  activeIds.add('B');
  const whileBActive = computeEligibleReconShards(manifest, activeIds, completedIds, 1);
  assert.equal(whileBActive.has('B'), true);
  assert.equal(whileBActive.has('C'), true);
  assert.equal(whileBActive.has('D'), false);

  // B completes verified PASS: completed={A, B}, active={}
  activeIds.delete('B');
  completedIds.add('B');
  const afterBPass = computeEligibleReconShards(manifest, activeIds, completedIds, 1);
  assert.equal(afterBPass.has('B'), false, 'B is completed');
  assert.equal(afterBPass.has('C'), true, 'C is ready');
  assert.equal(afterBPass.has('D'), true, 'D is 1 hop from C');
  assert.equal(afterBPass.has('E'), false, 'E is 2 hops away');

  // C completes verified PASS: completed={A, B, C}
  completedIds.add('C');
  const afterCPass = computeEligibleReconShards(manifest, activeIds, completedIds, 1);
  assert.equal(afterCPass.has('C'), false);
  assert.equal(afterCPass.has('D'), true, 'D is ready');
  assert.equal(afterCPass.has('E'), true, 'E is 1 hop from D');

  // D completes verified PASS: completed={A, B, C, D}
  completedIds.add('D');
  const afterDPass = computeEligibleReconShards(manifest, activeIds, completedIds, 1);
  assert.equal(afterDPass.has('D'), false);
  assert.equal(afterDPass.has('E'), true, 'E is ready');
  assert.equal(afterDPass.size, 1);

  // E completes: all done
  completedIds.add('E');
  const allDone = computeEligibleReconShards(manifest, activeIds, completedIds, 1);
  assert.equal(allDone.size, 0, 'No shards eligible after all completed');
});

test('bounded-recon: branching DAG (A -> (B, C); B -> D; C -> E) with lookaheadDepth=1', () => {
  const manifest = {
    shards: [
      { id: 'A', dependencies: [] },
      { id: 'B', dependencies: ['A'] },
      { id: 'C', dependencies: ['A'] },
      { id: 'D', dependencies: ['B'] },
      { id: 'E', dependencies: ['C'] },
    ],
  };

  const activeIds = new Set();
  const completedIds = new Set();

  // Initially: A is ready, B and C are 1 hop away from A
  const initial = computeEligibleReconShards(manifest, activeIds, completedIds, 1);
  assert.equal(initial.has('A'), true, 'A is ready');
  assert.equal(initial.has('B'), true, 'B is 1 hop downstream from A');
  assert.equal(initial.has('C'), true, 'C is 1 hop downstream from A');
  assert.equal(initial.has('D'), false, 'D is 2 hops away from A');
  assert.equal(initial.has('E'), false, 'E is 2 hops away from A');
  assert.equal(initial.size, 3);

  // A completes verified PASS
  completedIds.add('A');
  const afterAPass = computeEligibleReconShards(manifest, activeIds, completedIds, 1);
  assert.equal(afterAPass.has('A'), false, 'A is completed');
  assert.equal(afterAPass.has('B'), true, 'B is ready');
  assert.equal(afterAPass.has('C'), true, 'C is ready');
  assert.equal(afterAPass.has('D'), true, 'D is 1 hop from ready B');
  assert.equal(afterAPass.has('E'), true, 'E is 1 hop from ready C');
  assert.equal(afterAPass.size, 4);

  // B completes PASS while C is still running
  completedIds.add('B');
  activeIds.add('C');
  const afterBPass = computeEligibleReconShards(manifest, activeIds, completedIds, 1);
  assert.equal(afterBPass.has('A'), false);
  assert.equal(afterBPass.has('B'), false);
  assert.equal(afterBPass.has('C'), true, 'C is active');
  assert.equal(afterBPass.has('D'), true, 'D is ready (B completed)');
  assert.equal(afterBPass.has('E'), true, 'E is 1 hop from active C');
});

test('bounded-recon: lookaheadDepth=0 only includes ready shards', () => {
  const manifest = {
    shards: [
      { id: 'A', dependencies: [] },
      { id: 'B', dependencies: ['A'] },
      { id: 'C', dependencies: ['B'] },
    ],
  };

  const eligible = computeEligibleReconShards(manifest, new Set(), new Set(), 0);
  assert.equal(eligible.has('A'), true);
  assert.equal(eligible.has('B'), false);
  assert.equal(eligible.has('C'), false);
  assert.equal(eligible.size, 1);
});

test('bounded-recon: handles dependsOn alias and empty manifest cleanly', () => {
  assert.equal(computeEligibleReconShards(null).size, 0);
  assert.equal(computeEligibleReconShards({}).size, 0);

  const manifestWithDependsOn = {
    shards: [
      { id: 'X', dependsOn: [] },
      { id: 'Y', dependsOn: ['X'] },
    ],
  };
  const eligible = computeEligibleReconShards(manifestWithDependsOn, new Set(), new Set(), 1);
  assert.equal(eligible.has('X'), true);
  assert.equal(eligible.has('Y'), true);
});
