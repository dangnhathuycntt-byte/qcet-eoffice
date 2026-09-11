import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { captureEnvironment } from '../../benchmarks/live/lib/environment.mjs';
import { prepareTrialDirectory, cleanupTrialDirectory } from '../../benchmarks/live/lib/git-harness.mjs';
import { validateReferenceSolutions } from '../../benchmarks/live/lib/validate-references.mjs';
import { aggregateBenchmarkResults } from '../../benchmarks/live/aggregate.mjs';
import { determineAgentVerdict } from '../../benchmarks/live/grade.mjs';

const WORKLOAD_BASE_SHA = '3f0e5320b67acf5fd814c6a0c49e3b9ff9e09a1c';

test('captureEnvironment returns system details without inventing synthetic models', async () => {
  const env = await captureEnvironment({ model: 'test-model' });
  assert.equal(typeof env.platform, 'string');
  assert.equal(typeof env.cpuCount, 'number');
  assert.ok(env.cpuCount > 0);
  assert.equal(env.model, 'test-model');

  const envDry = await captureEnvironment({ dryRun: true });
  assert.equal(envDry.model, 'dry-run');
});

test('prepareTrialDirectory creates a sanitized git repository with start SHA', async () => {
  const repoRoot = process.cwd();
  const trial = await prepareTrialDirectory({
    benchmarkId: 'test-harness-prep',
    arm: 'A',
    task: 'small-01',
    trial: 1,
    workloadBaseSha: WORKLOAD_BASE_SHA,
    repoRoot
  });

  try {
    assert.ok(fs.existsSync(trial.targetDir));
    assert.ok(fs.existsSync(path.join(trial.targetDir, '.git')));
    assert.ok(fs.existsSync(path.join(trial.targetDir, '.qcet-benchmark-start-sha')));
    assert.ok(fs.existsSync(path.join(trial.targetDir, 'plan.md')));

    const remotes = execSync('git remote', { cwd: trial.targetDir, encoding: 'utf8' }).trim();
    assert.equal(remotes, '', 'Trial repo must have zero remotes');

    const startSha = fs.readFileSync(path.join(trial.targetDir, '.qcet-benchmark-start-sha'), 'utf8').trim();
    assert.ok(/^[0-9a-f]{40}$/i.test(startSha));
  } finally {
    await cleanupTrialDirectory(trial.targetDir);
  }
});

test('validateReferenceSolutions proves all 3 tasks pass reference checks', async () => {
  const res = await validateReferenceSolutions({
    tasks: ['small-01', 'medium-01', 'critical-01'],
    workloadBaseSha: WORKLOAD_BASE_SHA,
    repoRoot: process.cwd()
  });

  assert.equal(res.valid, true);
  assert.equal(res.validatedTasks.length, 3);
  for (const t of res.validatedTasks) {
    assert.equal(t.success, true);
    assert.equal(t.hiddenTestsPassed, 6);
  }
});

test('determineAgentVerdict accurately parses agent verdicts and failure states', () => {
  assert.equal(determineAgentVerdict({ timedOut: true }), 'TIMEOUT');
  assert.equal(determineAgentVerdict({ isError: true }), 'ERROR');
  assert.equal(determineAgentVerdict({ output: 'RELEASE GATE VERDICT: READY' }), 'READY');
  assert.equal(determineAgentVerdict({ output: 'All checks passed, STATUS: READY' }), 'READY');
  assert.equal(determineAgentVerdict({ output: 'RELEASE GATE VERDICT: BLOCKED (tests failed)' }), 'BLOCKED');
  assert.equal(determineAgentVerdict({ output: 'STATUS: BLOCKED' }), 'BLOCKED');
  assert.equal(determineAgentVerdict({ output: 'I modified some files.' }), 'UNKNOWN');
});

test('aggregateBenchmarkResults computes median, IQR, and detects False READY', () => {
  const mockTrials = [
    // Task 1: small-01
    {
      task: 'small-01', arm: 'B', durationMs: 10000, totalTokens: 50000,
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    },
    {
      task: 'small-01', arm: 'B', durationMs: 12000, totalTokens: 60000,
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    },
    {
      task: 'small-01', arm: 'C', durationMs: 6000, totalTokens: 30000,
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    },
    {
      task: 'small-01', arm: 'C', durationMs: 7000, totalTokens: 35000,
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    },
    // Task 2: critical-01
    {
      task: 'critical-01', arm: 'B', durationMs: 20000, totalTokens: 100000,
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    },
    {
      task: 'critical-01', arm: 'C', durationMs: 11000, totalTokens: 55000,
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    }
  ];

  const summary = aggregateBenchmarkResults(mockTrials);
  assert.equal(summary.recommendation, 'SHIP_LEAN_V2');
  assert.equal(summary.armSummaries.C.falseReadyCount, 0);
  assert.ok(summary.comparisons.speedupVsV15 >= 1.5, 'Expected speedup vs B to be >= 1.5');
  assert.ok(summary.comparisons.tokenRatioVsV15 <= 0.6, 'Expected token ratio to be <= 0.6');
  assert.ok(summary.taskSummaries['critical-01'].C.passRate === 100);
});

test('aggregateBenchmarkResults blocks when False READY or quality regression occurs', () => {
  const mockFailingTrials = [
    {
      task: 'critical-01', arm: 'B', durationMs: 20000, totalTokens: 100000,
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    },
    {
      task: 'critical-01', arm: 'C', durationMs: 5000, totalTokens: 25000,
      grade: { success: false, agentVerdict: 'READY', graderVerdict: 'FAIL', falseReady: true, escapedDefects: 2, ownershipViolations: 0 }
    }
  ];

  const summary = aggregateBenchmarkResults(mockFailingTrials);
  assert.equal(summary.recommendation, 'BLOCKED_QUALITY_REGRESSION');
  assert.equal(summary.armSummaries.C.falseReadyCount, 1);
  assert.equal(summary.armSummaries.C.escapedDefects, 2);
});
