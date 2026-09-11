import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { captureEnvironment } from '../../benchmarks/live/lib/environment.mjs';
import { aggregateBenchmarkResults } from '../../benchmarks/live/aggregate.mjs';
import { runGrader as runSmallGrader } from '../../benchmarks/live/tasks/small-01/grader/verify.mjs';
import { runGrader as runMediumGrader } from '../../benchmarks/live/tasks/medium-01/grader/verify.mjs';
import { runGrader as runCriticalGrader } from '../../benchmarks/live/tasks/critical-01/grader/verify.mjs';

describe('QCET Live Benchmark Suite Harness', () => {
  it('captureEnvironment captures required host fingerprint', async () => {
    const env = await captureEnvironment();
    assert.ok(env.timestamp, 'timestamp must be present');
    assert.ok(env.platform, 'platform must be present');
    assert.ok(env.arch, 'arch must be present');
    assert.ok(typeof env.cpuCount === 'number' && env.cpuCount > 0, 'cpuCount must be > 0');
    assert.ok(env.nodeVersion, 'nodeVersion must be present');
    assert.ok(env.gitSha, 'gitSha must be present');
    assert.ok(env.gitBranch, 'gitBranch must be present');
  });

  it('aggregateBenchmarkResults produces valid decision and confidence intervals', () => {
    const mockResults = [
      {
        trialId: 'A-small-01-r1',
        arm: 'A',
        task: 'small-01',
        trial: 1,
        durationMs: 12000,
        totalTokens: 50000,
        grade: { success: true, escapedDefects: 1, ownershipViolations: 0 }
      },
      {
        trialId: 'B-small-01-r1',
        arm: 'B',
        task: 'small-01',
        trial: 1,
        durationMs: 15000,
        totalTokens: 60000,
        grade: { success: true, escapedDefects: 0, ownershipViolations: 0 }
      },
      {
        trialId: 'C-small-01-r1',
        arm: 'C',
        task: 'small-01',
        trial: 1,
        durationMs: 10000,
        totalTokens: 40000,
        grade: { success: true, escapedDefects: 0, ownershipViolations: 0 }
      }
    ];

    const agg = aggregateBenchmarkResults(mockResults);
    assert.ok(agg.armSummaries.A, 'Arm A summary present');
    assert.ok(agg.armSummaries.B, 'Arm B summary present');
    assert.ok(agg.armSummaries.C, 'Arm C summary present');
    assert.equal(agg.comparisons.speedupVsV15, 1.5, 'Arm C should be 1.5x faster than Arm B');
    assert.equal(agg.comparisons.tokenRatioVsV15, 0.67, 'Arm C should use ~67% tokens of Arm B');
    assert.equal(agg.recommendation, 'SHIP_LEAN_V2');
  });

  it('all 3 task graders instantiate and return deterministic structure', async () => {
    // Check against a mock empty temporary directory
    const tmpDir = path.join('/tmp', `test-grader-sanity-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      const gSmall = await runSmallGrader(tmpDir);
      assert.equal(gSmall.task, 'small-01');
      assert.equal(gSmall.success, false);
      assert.ok(gSmall.escapedDefects > 0);

      const gMedium = await runMediumGrader(tmpDir);
      assert.equal(gMedium.task, 'medium-01');
      assert.equal(gMedium.success, false);
      assert.ok(gMedium.escapedDefects > 0);

      const gCritical = await runCriticalGrader(tmpDir);
      assert.equal(gCritical.task, 'critical-01');
      assert.equal(gCritical.success, false);
      assert.ok(gCritical.escapedDefects > 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
