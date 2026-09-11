import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { gradeBenchmark } from '../../scripts/lib/eval-grader.mjs';

const repoRoot = process.cwd();
const reportPath = path.join(repoRoot, '.superpowers', 'qcet-plan-executor', 'evals', 'benchmark-B0-vs-B1.json');

test('benchmark-reporting: gradeBenchmark fails honestly when speed target is not met', () => {
  const baseline = {
    totalDurationMs: 100,
    qualityScore: 100,
    verificationPassed: true,
  };
  const candidate = {
    totalDurationMs: 95, // only ~1.05x speedup, below 1.2x target
    qualityScore: 100,
    verificationPassed: true,
  };

  const result = gradeBenchmark(baseline, candidate);
  assert.equal(result.speedupRatio, 1.05);
  assert.equal(result.achievesTargetSpeedup, false);
  assert.equal(result.passesQualityGate, true);
  assert.equal(result.passed, false);
  assert.equal(result.overallSuccess, false);
});

test('benchmark-reporting: gradeBenchmark keeps measuredTokens null when token telemetry is missing', () => {
  const baseline = {
    totalDurationMs: 120,
    totalContextBytes: 50000,
    qualityScore: 100,
    verificationPassed: true,
  };
  const candidate = {
    totalDurationMs: 80,
    totalContextBytes: 10000,
    qualityScore: 100,
    verificationPassed: true,
  };

  const result = gradeBenchmark(baseline, candidate);
  assert.equal(result.measuredTokens, null);
  assert.equal(result.tokenSavingsPercent, null);
  assert.equal(result.contextSavingsPercent, 80);
});

test('benchmark-reporting: gradeBenchmark calculates measuredTokens only when real telemetry provided', () => {
  const baseline = {
    totalDurationMs: 200,
    tokenUsage: { totalTokens: 1000 },
    qualityScore: 100,
    verificationPassed: true,
  };
  const candidate = {
    totalDurationMs: 100,
    tokenUsage: { totalTokens: 600 },
    qualityScore: 100,
    verificationPassed: true,
  };

  const result = gradeBenchmark(baseline, candidate);
  assert.deepEqual(result.measuredTokens, { baseline: 1000, candidate: 600 });
  assert.equal(result.tokenSavingsPercent, 40);
  assert.equal(result.achievesTargetSpeedup, true);
  assert.equal(result.passed, true);
});

test('benchmark-reporting: CLI execution outputs FAILED, sets exit code 1, and writes truthful report on failure', () => {
  const scriptPath = path.join(repoRoot, 'scripts', 'run-benchmark.mjs');
  const run = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, QCET_BENCHMARK_TARGET_SPEEDUP: '999.0' },
  });

  // 1. Output must say FAILED if speed target is not met
  assert.match(run.stdout, /Benchmark Passed:\s+FAILED/);
  assert.doesNotMatch(run.stdout, /Benchmark Passed:\s+PASSED/);

  // 2. Process exit code must be non-zero (1)
  assert.equal(run.status, 1);

  // 3. Report must still be written to disk
  assert.ok(fs.existsSync(reportPath), 'Report file must exist after benchmark execution');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

  // 4. Benchmark type must be truthful (not REAL_EXECUTION)
  assert.equal(report.benchmarkType, 'LOCAL_HARNESS_BENCHMARK');
  assert.notEqual(report.benchmarkType, 'REAL_EXECUTION');

  // 5. Measured tokens must remain null without live token telemetry
  assert.equal(report.baselineB0.measuredTokens, null);
  assert.equal(report.optimizedB1.measuredTokens, null);

  // 6. Metrics classes must be separated
  assert.ok(report.baselineB0.observedLocalMetrics, 'baselineB0 must have observedLocalMetrics');
  assert.ok(report.baselineB0.estimatedStructuralMetrics, 'baselineB0 must have estimatedStructuralMetrics');
  assert.equal(typeof report.baselineB0.observedLocalMetrics.totalWallClockMs, 'number');
  assert.equal(typeof report.baselineB0.observedLocalMetrics.totalContextBytes, 'number');
  assert.equal(typeof report.baselineB0.observedLocalMetrics.schedulerMakespanMs, 'number');
  assert.equal(typeof report.baselineB0.observedLocalMetrics.localExtractionDurationMs, 'number');
  assert.equal(typeof report.baselineB0.estimatedStructuralMetrics.expectedAgentCalls, 'number');
  assert.equal(typeof report.baselineB0.estimatedStructuralMetrics.theoreticalVerifierCalls, 'number');

  assert.ok(report.optimizedB1.observedLocalMetrics, 'optimizedB1 must have observedLocalMetrics');
  assert.ok(report.optimizedB1.estimatedStructuralMetrics, 'optimizedB1 must have estimatedStructuralMetrics');
  assert.equal(typeof report.optimizedB1.observedLocalMetrics.totalWallClockMs, 'number');
  assert.equal(typeof report.optimizedB1.observedLocalMetrics.totalContextBytes, 'number');
  assert.equal(typeof report.optimizedB1.observedLocalMetrics.schedulerMakespanMs, 'number');
  assert.equal(typeof report.optimizedB1.observedLocalMetrics.localExtractionDurationMs, 'number');
  assert.equal(typeof report.optimizedB1.estimatedStructuralMetrics.expectedAgentCalls, 'number');
  assert.equal(typeof report.optimizedB1.estimatedStructuralMetrics.theoreticalVerifierCalls, 'number');

  // 7. Gate results
  assert.equal(report.gains.benchmarkPassed, false);
});

test('benchmark-reporting: CLI execution outputs PASSED and exits 0 when target is achieved', () => {
  const scriptPath = path.join(repoRoot, 'scripts', 'run-benchmark.mjs');
  const run = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, QCET_BENCHMARK_TARGET_SPEEDUP: '0.01' },
  });

  assert.match(run.stdout, /Benchmark Passed:\s+PASSED/);
  assert.equal(run.status, 0);

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.gains.benchmarkPassed, true);
});
