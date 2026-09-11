import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { captureEnvironment } from '../../benchmarks/live/lib/environment.mjs';
import { prepareTrialDirectory, cleanupTrialDirectory, archiveHarnessOrThrow } from '../../benchmarks/live/lib/git-harness.mjs';
import { validateReferenceSolutions } from '../../benchmarks/live/lib/validate-references.mjs';
import { aggregateBenchmarkResults } from '../../benchmarks/live/aggregate.mjs';
import { determineAgentVerdict, verifyTreatmentFidelity } from '../../benchmarks/live/grade.mjs';
import { verifyCliCapabilities, VALID_EFFORT_LEVELS } from '../../benchmarks/live/run-benchmark-suite.mjs';

const WORKLOAD_BASE_SHA = '3f0e5320b67acf5fd814c6a0c49e3b9ff9e09a1c';
const HARNESS_SHA_C = '02d090e8e8e23c9c7def9826b99c815af74ecf42';

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

test('determineAgentVerdict accurately parses agent verdicts and avoids fragile free-text false positives', (t) => {
  assert.equal(determineAgentVerdict({ timedOut: true }), 'TIMEOUT');
  assert.equal(determineAgentVerdict({ isError: true }), 'ERROR');
  assert.equal(determineAgentVerdict({ output: 'RELEASE GATE VERDICT: READY' }), 'READY');
  assert.equal(determineAgentVerdict({ output: 'All checks passed, STATUS: READY' }), 'READY');
  assert.equal(determineAgentVerdict({ output: 'RELEASE GATE VERDICT: BLOCKED (tests failed)' }), 'BLOCKED');
  assert.equal(determineAgentVerdict({ output: 'STATUS: BLOCKED' }), 'BLOCKED');
  assert.equal(determineAgentVerdict({ output: 'I modified some files.' }), 'UNKNOWN');

  // Fragile free-text rejection: negation should NEVER yield READY
  assert.equal(determineAgentVerdict({ output: 'System is NOT READY for deployment' }), 'BLOCKED');
  assert.equal(determineAgentVerdict({ output: 'The service is not ready yet' }), 'BLOCKED');
  assert.equal(determineAgentVerdict({ output: 'We failed to be READY on time' }), 'BLOCKED');

  // Structured disk verdict: gate-verdict.json takes precedence
  const tempDir = fs.mkdtempSync(path.join('/tmp', 'test-verdict-'));
  try {
    fs.writeFileSync(path.join(tempDir, 'gate-verdict.json'), JSON.stringify({
      verdict: 'READY',
      runtimeFingerprint: 'qcet-lean-v2-native'
    }));
    assert.equal(determineAgentVerdict({ output: 'Unstructured text' }, tempDir), 'READY');

    fs.writeFileSync(path.join(tempDir, 'gate-verdict.json'), JSON.stringify({
      verdict: 'BLOCKED',
      runtimeFingerprint: 'qcet-lean-v2-native'
    }));
    assert.equal(determineAgentVerdict({ output: 'STATUS: READY' }, tempDir), 'BLOCKED');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('verifyTreatmentFidelity validates Arm A, Arm B, and Arm C invariants', () => {
  const tempDir = fs.mkdtempSync(path.join('/tmp', 'test-fidelity-'));
  try {
    // Arm A without executor artifacts -> valid
    const resAValid = verifyTreatmentFidelity('A', tempDir);
    assert.equal(resAValid.valid, true);

    // Arm A with executor artifacts -> contaminated
    fs.mkdirSync(path.join(tempDir, '.claude', 'executor-evals'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.claude', 'executor-evals', 'run-telemetry.json'), '{}');
    const resAContaminated = verifyTreatmentFidelity('A', tempDir);
    assert.equal(resAContaminated.valid, false);
    assert.equal(resAContaminated.reason, 'CONTAMINATED_ARM_A');

    // Clean up
    fs.rmSync(path.join(tempDir, '.claude'), { recursive: true, force: true });

    // Arm B without run-telemetry.json -> invalid (HARNESS_NOT_INVOKED)
    const resBMissing = verifyTreatmentFidelity('B', tempDir);
    assert.equal(resBMissing.valid, false);
    assert.equal(resBMissing.reason, 'HARNESS_NOT_INVOKED');

    // Arm B with run-telemetry.json -> valid
    fs.mkdirSync(path.join(tempDir, '.claude', 'executor-evals'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.claude', 'executor-evals', 'run-telemetry.json'), JSON.stringify({
      verdict: 'READY',
      engineVersion: '1.5.0'
    }));
    const resBValid = verifyTreatmentFidelity('B', tempDir);
    assert.equal(resBValid.valid, true);

    // Arm C without gate-verdict.json -> invalid (HARNESS_NOT_INVOKED)
    const resCMissing = verifyTreatmentFidelity('C', tempDir);
    assert.equal(resCMissing.valid, false);
    assert.equal(resCMissing.reason, 'HARNESS_NOT_INVOKED');

    // Arm C with gate-verdict.json + runtimeFingerprint -> valid
    fs.writeFileSync(path.join(tempDir, 'gate-verdict.json'), JSON.stringify({
      verdict: 'READY',
      runtimeFingerprint: 'qcet-lean-v2-native'
    }));
    const resCValid = verifyTreatmentFidelity('C', tempDir);
    assert.equal(resCValid.valid, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('archiveHarnessOrThrow fails closed on nonexistent SHA or missing files', () => {
  const tempDir = fs.mkdtempSync(path.join('/tmp', 'test-archive-'));
  const repoRoot = process.cwd();
  const gitDir = path.join(repoRoot, '.git');
  try {
    assert.throws(() => {
      archiveHarnessOrThrow({
        gitDir,
        harnessSha: '0000000000000000000000000000000000000000',
        targetDir: tempDir,
        repoRoot,
        arm: 'C'
      });
    }, /does not exist in git repository/);

    // Extracting valid Arm C pinned SHA succeeds and places required files
    archiveHarnessOrThrow({
      gitDir,
      harnessSha: HARNESS_SHA_C,
      targetDir: tempDir,
      repoRoot,
      arm: 'C'
    });

    assert.ok(fs.existsSync(path.join(tempDir, '.claude', 'workflows', 'qcet-plan-executor.js')));
    assert.ok(
      fs.existsSync(path.join(tempDir, '.claude', 'skills', 'qcet-plan-executor', 'SKILL.md')) ||
      fs.existsSync(path.join(tempDir, '.claude', 'skills', 'qcet-plan-executor', 'skill.json'))
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('CLI capability preflight checks allowed effort levels and rejects ultracode', async () => {
  assert.deepEqual(VALID_EFFORT_LEVELS, ['low', 'medium', 'high', 'xhigh', 'max']);
  assert.ok(!VALID_EFFORT_LEVELS.includes('ultracode'));

  const dryResult = await verifyCliCapabilities({ dryRun: true });
  assert.equal(dryResult.verified, true);
  assert.equal(dryResult.mode, 'dry-run');

  await assert.rejects(async () => {
    await verifyCliCapabilities({ dryRun: false, effort: 'ultracode' });
  }, /Invalid effort level/);
});

test('aggregateBenchmarkResults computes median, IQR, and detects False READY', () => {
  const mockTrials = [
    // Task 1: small-01
    {
      task: 'small-01', arm: 'B', durationMs: 10000, totalTokens: 50000,
      inputTokens: 30000, outputTokens: 10000, cacheCreationInputTokens: 5000, cacheReadInputTokens: 5000, totalCostUsd: 0.15,
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    },
    {
      task: 'small-01', arm: 'B', durationMs: 12000, totalTokens: 60000,
      inputTokens: 35000, outputTokens: 12000, cacheCreationInputTokens: 6000, cacheReadInputTokens: 7000, totalCostUsd: 0.18,
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    },
    {
      task: 'small-01', arm: 'C', durationMs: 6000, totalTokens: 30000,
      inputTokens: 18000, outputTokens: 6000, cacheCreationInputTokens: 3000, cacheReadInputTokens: 3000, totalCostUsd: 0.08,
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    },
    {
      task: 'small-01', arm: 'C', durationMs: 7000, totalTokens: 35000,
      inputTokens: 20000, outputTokens: 7000, cacheCreationInputTokens: 4000, cacheReadInputTokens: 4000, totalCostUsd: 0.09,
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    },
    // Task 2: critical-01
    {
      task: 'critical-01', arm: 'B', durationMs: 20000, totalTokens: 100000,
      inputTokens: 60000, outputTokens: 20000, cacheCreationInputTokens: 10000, cacheReadInputTokens: 10000, totalCostUsd: 0.30,
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    },
    {
      task: 'critical-01', arm: 'C', durationMs: 11000, totalTokens: 55000,
      inputTokens: 33000, outputTokens: 11000, cacheCreationInputTokens: 5500, cacheReadInputTokens: 5500, totalCostUsd: 0.15,
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    }
  ];

  const summary = aggregateBenchmarkResults(mockTrials);
  assert.equal(summary.recommendation, 'SHIP_LEAN_V2');
  assert.equal(summary.armSummaries.C.falseReadyCount, 0);
  assert.ok(summary.comparisons.speedupVsV15 >= 1.5, 'Expected speedup vs B to be >= 1.5');
  assert.ok(summary.comparisons.tokenRatioVsV15 <= 0.6, 'Expected token ratio to be <= 0.6');
  assert.ok(summary.taskSummaries['critical-01'].C.passRate === 100);

  // Assert multi-token metrics and cost metrics are tracked
  assert.equal(typeof summary.armSummaries.C.inputTokens.median, 'number');
  assert.equal(typeof summary.armSummaries.C.outputTokens.median, 'number');
  assert.equal(typeof summary.armSummaries.C.cacheCreationInputTokens.median, 'number');
  assert.equal(typeof summary.armSummaries.C.cacheReadInputTokens.median, 'number');
  assert.equal(typeof summary.armSummaries.C.totalCostUsd.median, 'number');
  assert.equal(summary.armSummaries.C.harnessNotInvokedCount, 0);
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
