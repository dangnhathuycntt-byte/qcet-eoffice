import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectCycles,
  topologicalSort,
  DagScheduler,
  computeShardPriorities,
  computeEligibleReconShards,
} from '../../scripts/lib/dag-scheduler.mjs';

test('dag-scheduler: detectCycles detects cycle in dependencies', () => {
  const cyclicShards = [
    { id: 'A', dependencies: ['C'] },
    { id: 'B', dependencies: ['A'] },
    { id: 'C', dependencies: ['B'] },
  ];

  const cycle = detectCycles(cyclicShards);
  assert.ok(cycle);
  assert.ok(cycle.includes('A'));
  assert.ok(cycle.includes('B'));
  assert.ok(cycle.includes('C'));

  const acyclicShards = [
    { id: 'A', dependencies: [] },
    { id: 'B', dependencies: ['A'] },
    { id: 'C', dependencies: ['A'] },
    { id: 'D', dependencies: ['B', 'C'] },
  ];

  assert.equal(detectCycles(acyclicShards), null);
});

test('dag-scheduler: topologicalSort returns valid ordering', () => {
  const shards = [
    { id: 'D', dependencies: ['B', 'C'] },
    { id: 'B', dependencies: ['A'] },
    { id: 'C', dependencies: ['A'] },
    { id: 'A', dependencies: [] },
  ];

  const order = topologicalSort(shards);
  assert.equal(order[0], 'A');
  assert.ok(order.indexOf('B') > order.indexOf('A'));
  assert.ok(order.indexOf('C') > order.indexOf('A'));
  assert.equal(order[order.length - 1], 'D');
});

test('dag-scheduler: computeShardPriorities ranks bottlenecks higher', () => {
  const shards = [
    { id: 'leaf-1', dependencies: [] },
    { id: 'bottleneck', dependencies: [] },
    { id: 'child-1', dependencies: ['bottleneck'] },
    { id: 'child-2', dependencies: ['bottleneck'] },
    { id: 'grandchild', dependencies: ['child-1'] },
  ];

  const priorities = computeShardPriorities({ shards });
  assert.ok(priorities.get('bottleneck').priority > priorities.get('leaf-1').priority, 'bottleneck should have higher priority than independent leaf');
  assert.ok(priorities.get('child-1').priority > priorities.get('child-2').priority, 'shard unblocking grandchild should rank higher than leaf child');
});

test('dag-scheduler: computeEligibleReconShards bounds pre-recon lookahead', () => {
  const manifest = {
    shards: [
      { id: 'A', dependencies: [] },
      { id: 'B', dependencies: [] },
      { id: 'C', dependencies: ['A'] },
      { id: 'D', dependencies: ['C'] },
      { id: 'E', dependencies: ['D'] },
      { id: 'F', dependencies: ['E'] },
    ],
  };

  const activeIds = new Set(['A']);
  const completedIds = new Set();

  // With depth 1, only ready shards (A, B) and direct dependents (C) are eligible
  const depth1Eligible = computeEligibleReconShards(manifest, activeIds, completedIds, 1);
  assert.ok(depth1Eligible.has('A'));
  assert.ok(depth1Eligible.has('B'));
  assert.ok(depth1Eligible.has('C'));
  assert.equal(depth1Eligible.has('D'), false, 'D is 2 hops away, should not be reconned yet');
  assert.equal(depth1Eligible.has('E'), false, 'E is 3 hops away, should not be reconned yet');
  assert.equal(depth1Eligible.has('F'), false, 'F is 4 hops away, should not be reconned yet');

  // Once C completes, D becomes ready, and its direct dependent E becomes eligible (depth 1)
  completedIds.add('A');
  completedIds.add('C');
  activeIds.delete('A');
  const afterCEligible = computeEligibleReconShards(manifest, activeIds, completedIds, 1);
  assert.ok(afterCEligible.has('D'), 'D is ready and eligible');
  assert.ok(afterCEligible.has('E'), 'E is 1 hop away from ready shard D');
  assert.equal(afterCEligible.has('F'), false, 'F is 2 hops away from ready shard D');
});

test('dag-scheduler: DagScheduler dynamically unblocks and executes tasks concurrently', async () => {
  const manifest = {
    shards: [
      { id: 'A', dependencies: [], risk: 'high' },
      { id: 'B', dependencies: ['A'], risk: 'medium' },
      { id: 'C', dependencies: ['A'], risk: 'low' },
      { id: 'D', dependencies: ['B', 'C'], risk: 'critical' },
    ],
  };

  const executedOrder = [];
  const scheduler = new DagScheduler(manifest, {
    concurrency: 2,
    runShard: async (s) => {
      await new Promise((r) => setTimeout(r, 20));
      executedOrder.push(s.id);
      return { shardId: s.id, done: true };
    },
  });

  const result = await scheduler.execute();
  assert.equal(result.status, 'completed');
  assert.equal(result.completedCount, 4);
  assert.equal(executedOrder[0], 'A');
  assert.equal(executedOrder[3], 'D');
  assert.ok(executedOrder.includes('B'));
  assert.ok(executedOrder.includes('C'));
  assert.equal(result.timeline.length, 4);
});

test('dag-scheduler: dependency pass gate - failed shard prevents downstream shards from executing', async () => {
  const manifest = {
    shards: [
      { id: 'A', dependencies: [] },
      { id: 'B', dependencies: ['A'] },
    ],
  };

  let shardBExecuted = false;
  const scheduler = new DagScheduler(manifest, {
    concurrency: 2,
    runShard: async (s) => {
      if (s.id === 'A') {
        // Implementation may have completed, but verification status is failed
        return { status: 'failed', shardId: 'A' };
      }
      if (s.id === 'B') {
        shardBExecuted = true;
        return { status: 'completed', shardId: 'B' };
      }
      return { status: 'completed', shardId: s.id };
    },
  });

  await assert.rejects(
    async () => {
      await scheduler.execute();
    },
    /deadlock|blocked/i
  );

  assert.equal(shardBExecuted, false, 'Shard B must never execute when dependency A failed verification');
});

