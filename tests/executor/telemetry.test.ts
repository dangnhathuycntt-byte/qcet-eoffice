import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ExecutionTelemetry,
  loadTelemetry,
  compareTelemetry,
  getRepoRoot,
} from '../../scripts/lib/executor-contracts.mjs';

test('telemetry: ExecutionTelemetry tracks phases and real metrics', async () => {
  const runId = `telemetry-test-${Date.now()}`;
  const repoRoot = getRepoRoot();
  const storageDir = path.join(repoRoot, '.superpowers', 'qcet-plan-executor', 'runs', runId);

  const telemetry = new ExecutionTelemetry(runId, { repoRoot, storageDir });

  telemetry.startPhase('recon');
  await new Promise((r) => setTimeout(r, 30));
  telemetry.endPhase('recon', { status: 'completed', targetsFound: 3 });

  telemetry.recordShardExecution('shard-1', {
    durationMs: 120,
    status: 'completed',
    filesTouched: ['src/lib/a.ts'],
    tokens: { prompt: 500, completion: 200 },
  });

  telemetry.recordShardExecution('shard-2', {
    durationMs: 80,
    status: 'completed',
    filesTouched: ['src/lib/b.ts'],
    tokens: { prompt: 300, completion: 150 },
  });

  telemetry.recordVerification({
    typecheckPassed: true,
    testsPassed: 40,
    testsFailed: 0,
    invariantViolationsCount: 0,
    releaseDecision: 'PROMOTE',
  });

  telemetry.finish();
  const filePath = telemetry.persist();

  assert.ok(fs.existsSync(filePath));
  assert.ok(telemetry.totalDurationMs >= 10);
  assert.equal(telemetry.tokenUsage.promptTokens, 800);
  assert.equal(telemetry.tokenUsage.completionTokens, 350);
  assert.equal(telemetry.tokenUsage.totalTokens, 1150);
  assert.equal(telemetry.phases.recon.status, 'completed');
  assert.ok(telemetry.phases.recon.durationMs >= 10);

  // Read back with loadTelemetry
  const loaded = loadTelemetry(runId, { repoRoot });
  assert.ok(loaded);
  assert.equal(loaded.runId, runId);
  assert.equal(loaded.tokenUsage.totalTokens, 1150);

  // Cleanup
  fs.rmSync(storageDir, { recursive: true, force: true });
});

test('telemetry: compareTelemetry calculates speedup and quality differences', () => {
  const runA = {
    runId: 'run-baseline',
    totalDurationMs: 2000,
    tokenUsage: { totalTokens: 10000 },
    shards: { s1: {}, s2: {} },
    verification: { testsPassed: 10, testsTotal: 10, invariantViolationsCount: 0 },
  };

  const runB = {
    runId: 'run-optimized',
    totalDurationMs: 1000,
    tokenUsage: { totalTokens: 6000 },
    shards: { s1: {}, s2: {} },
    verification: { testsPassed: 10, testsTotal: 10, invariantViolationsCount: 0 },
  };

  const comp = compareTelemetry(runA, runB);
  assert.equal(comp.runA.durationMs, 2000);
  assert.equal(comp.runB.durationMs, 1000);
  assert.equal(comp.comparison.durationDiffMs, -1000);
  assert.equal(comp.comparison.speedupRatio, 2.0);
  assert.equal(comp.comparison.tokenDiff, -4000);
  assert.equal(comp.comparison.faster, true);
  assert.equal(comp.comparison.higherQuality, true);
});
