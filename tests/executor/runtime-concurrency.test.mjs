import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSemaphore,
  getAgentPriority,
  DagScheduler,
} from '../../scripts/lib/dag-scheduler.mjs';

test('runtime-concurrency: createSemaphore clamps capacity to 1..16 and defaults to 6', () => {
  const defaultSem = createSemaphore();
  assert.equal(defaultSem.capacity, 6);

  const lowSem = createSemaphore(0);
  assert.equal(lowSem.capacity, 1);

  const negSem = createSemaphore(-5);
  assert.equal(negSem.capacity, 1);

  const highSem = createSemaphore(25);
  assert.equal(highSem.capacity, 16);

  const parsedSem = createSemaphore('4');
  assert.equal(parsedSem.capacity, 4);
});

test('runtime-concurrency: createSemaphore enforces peak active <= capacity (concurrency = 2)', async () => {
  const sem = createSemaphore(2);
  let activeWorkers = 0;
  let maxObservedActive = 0;
  const completed = [];

  const tasks = Array.from({ length: 6 }, (_, i) => async () => {
    return sem.withPermit(async () => {
      activeWorkers++;
      if (activeWorkers > maxObservedActive) {
        maxObservedActive = activeWorkers;
      }
      // Simulate async work
      await new Promise((r) => setTimeout(r, 20));
      activeWorkers--;
      completed.push(i);
      return i;
    });
  });

  const results = await Promise.all(tasks.map((t) => t()));
  assert.equal(results.length, 6);
  assert.equal(completed.length, 6);
  assert.ok(maxObservedActive <= 2, `Peak active (${maxObservedActive}) must not exceed 2`);
  assert.equal(sem.getPeakConcurrent(), 2);
  assert.equal(sem.getActiveCount(), 0);
  assert.equal(sem.getQueueLength(), 0);
});

test('runtime-concurrency: concurrency = 1 serializes execution cleanly', async () => {
  const sem = createSemaphore(1);
  let activeWorkers = 0;
  let maxObservedActive = 0;
  const trace = [];

  const tasks = [1, 2, 3, 4].map((id) => () =>
    sem.withPermit(async () => {
      activeWorkers++;
      if (activeWorkers > maxObservedActive) maxObservedActive = activeWorkers;
      trace.push(`start-${id}`);
      await new Promise((r) => setTimeout(r, 10));
      trace.push(`end-${id}`);
      activeWorkers--;
    })
  );

  await Promise.all(tasks.map((t) => t()));
  assert.equal(maxObservedActive, 1, 'Peak concurrent with capacity 1 must be exactly 1');
  assert.equal(trace.length, 8);
  // Strictly serialized: start-X immediately followed by end-X
  for (let i = 0; i < 4; i++) {
    const start = trace[i * 2];
    const end = trace[i * 2 + 1];
    assert.equal(start.replace('start', ''), end.replace('end', ''));
  }
});

test('runtime-concurrency: speculativeReadLimit prevents speculative starvation of builders/verifiers', async () => {
  // Capacity = 4, speculativeLimit = 1
  const sem = createSemaphore(4, { speculativeReadLimit: 1 });
  assert.equal(sem.speculativeLimit, 1);

  let activeSpeculative = 0;
  let peakSpeculative = 0;
  let builderStarted = false;

  // Launch 3 speculative recon tasks (priority 5, isSpeculative: true)
  const specPromise1 = sem.withPermit(
    async () => {
      activeSpeculative++;
      if (activeSpeculative > peakSpeculative) peakSpeculative = activeSpeculative;
      await new Promise((r) => setTimeout(r, 40));
      activeSpeculative--;
      return 'spec-1';
    },
    5,
    true
  );

  // Queue second speculative task - should wait because speculativeLimit is 1
  const specPromise2 = sem.withPermit(
    async () => {
      activeSpeculative++;
      if (activeSpeculative > peakSpeculative) peakSpeculative = activeSpeculative;
      await new Promise((r) => setTimeout(r, 20));
      activeSpeculative--;
      return 'spec-2';
    },
    5,
    true
  );

  // Queue a high-priority builder task (priority 1, not speculative)
  const builderPromise = sem.withPermit(
    async () => {
      builderStarted = true;
      return 'builder-done';
    },
    1,
    false
  );

  // Builder should start immediately despite specPromise2 waiting, because capacity (4) is available
  // and specPromise2 is blocked on speculativeLimit (1).
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(builderStarted, true, 'Builder must not be starved by queued speculative recon');

  const [res1, res2, resB] = await Promise.all([specPromise1, specPromise2, builderPromise]);
  assert.equal(res1, 'spec-1');
  assert.equal(res2, 'spec-2');
  assert.equal(resB, 'builder-done');
  assert.equal(peakSpeculative, 1, 'Active speculative recon must never exceed speculativeLimit');
});

test('runtime-concurrency: priority ordering serves P0 before P1, P2, P3, P4, P5', async () => {
  // Capacity 1 so every acquisition after the first queues up in order of priority
  const sem = createSemaphore(1);
  const acquisitionOrder = [];

  // Block the semaphore first
  const blockerRelease = await sem.acquire(0);

  // Queue up requests of different priorities
  const p5 = sem.withPermit(async () => acquisitionOrder.push('P5-spec-recon'), 5, true);
  const p3 = sem.withPermit(async () => acquisitionOrder.push('P3-reconcile'), 3, false);
  const p1 = sem.withPermit(async () => acquisitionOrder.push('P1-builder'), 1, false);
  const p0 = sem.withPermit(async () => acquisitionOrder.push('P0-release'), 0, false);
  const p2 = sem.withPermit(async () => acquisitionOrder.push('P2-verifier'), 2, false);
  const p4 = sem.withPermit(async () => acquisitionOrder.push('P4-ready-recon'), 4, false);

  // Release the blocker
  blockerRelease();

  await Promise.all([p5, p3, p1, p0, p2, p4]);

  assert.deepEqual(acquisitionOrder, [
    'P0-release',
    'P1-builder',
    'P2-verifier',
    'P3-reconcile',
    'P4-ready-recon',
    'P5-spec-recon',
  ]);
});

test('runtime-concurrency: getAgentPriority resolves correct priority tiers', () => {
  // P0 - Release gate & global verification
  assert.equal(getAgentPriority({ role: 'global-verification' }), 0);
  assert.equal(getAgentPriority({ label: 'final release skeptic' }), 0);

  // P1 - Builder & repair
  assert.equal(getAgentPriority({ role: 'builder' }), 1);
  assert.equal(getAgentPriority({ label: 'shard-1:repair' }), 1);
  assert.equal(getAgentPriority({ phase: 'implementation' }), 1);

  // P2 - Verifier & skeptic
  assert.equal(getAgentPriority({ role: 'verifier' }), 2);
  assert.equal(getAgentPriority({ label: 'shard-1:skeptic' }), 2);
  assert.equal(getAgentPriority({ label: 'integration:reverification' }), 2);

  // P3 - Reconciliation & merge
  assert.equal(getAgentPriority({ role: 'reconcile' }), 3);
  assert.equal(getAgentPriority({ label: 'shard-1:merge' }), 3);

  // P4 - Ready recon
  assert.equal(getAgentPriority({ role: 'recon', isSpeculative: false }), 4);
  assert.equal(getAgentPriority({ label: 'shard-1:pre-recon', isSpeculative: false }), 4);

  // P5 - Speculative recon
  assert.equal(getAgentPriority({ role: 'recon', isSpeculative: true }), 5);
  assert.equal(getAgentPriority({ label: 'shard-1:pre-recon', isSpeculative: true }), 5);

  // Explicit overrides
  assert.equal(getAgentPriority({ priority: 0 }), 0);
  assert.equal(getAgentPriority(2), 2);
});

test('runtime-concurrency: DagScheduler enforces poolCaps on resource pools', async () => {
  const manifest = {
    shards: [
      { id: 'R1', dependencies: [], pool: 'recon' },
      { id: 'R2', dependencies: [], pool: 'recon' },
      { id: 'R3', dependencies: [], pool: 'recon' },
      { id: 'B1', dependencies: [], pool: 'builders' },
      { id: 'B2', dependencies: [], pool: 'builders' },
    ],
  };

  let activeRecon = 0;
  let peakRecon = 0;
  let activeBuilders = 0;
  let peakBuilders = 0;

  const scheduler = new DagScheduler(manifest, {
    concurrency: 4,
    poolCaps: {
      recon: 1, // capped at 1
      builders: 2, // capped at 2
    },
    runShard: async (shard) => {
      if (shard.pool === 'recon') {
        activeRecon++;
        if (activeRecon > peakRecon) peakRecon = activeRecon;
        await new Promise((r) => setTimeout(r, 20));
        activeRecon--;
      } else if (shard.pool === 'builders') {
        activeBuilders++;
        if (activeBuilders > peakBuilders) peakBuilders = activeBuilders;
        await new Promise((r) => setTimeout(r, 20));
        activeBuilders--;
      }
      return { status: 'completed', shardId: shard.id };
    },
  });

  const res = await scheduler.execute();
  assert.equal(res.status, 'completed');
  assert.equal(res.completedCount, 5);
  assert.equal(peakRecon, 1, 'Recon peak must not exceed poolCap of 1');
  assert.ok(peakBuilders <= 2, 'Builders peak must not exceed poolCap of 2');
});
