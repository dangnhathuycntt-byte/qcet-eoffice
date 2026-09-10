import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectCycles,
  topologicalSort,
  DagScheduler,
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
