import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { captureEnvironment } from '../../benchmarks/live/lib/environment.mjs';
import { prepareTrialDirectory, cleanupTrialDirectory, archiveHarnessOrThrow, verifyHarnessOverlay } from '../../benchmarks/live/lib/git-harness.mjs';
import { validateReferenceSolutions } from '../../benchmarks/live/lib/validate-references.mjs';
import { aggregateBenchmarkResults } from '../../benchmarks/live/aggregate.mjs';
import { determineAgentVerdict, verifyTreatmentFidelity } from '../../benchmarks/live/grade.mjs';
import { verifyCliCapabilities, normalizeEffort, VALID_EFFORT_LEVELS, DEFAULT_TASK_TIMEOUTS_MS, resolveTaskTimeoutMs } from '../../benchmarks/live/run-benchmark-suite.mjs';

const WORKLOAD_BASE_SHA = '3f0e5320b67acf5fd814c6a0c49e3b9ff9e09a1c';
const HARNESS_SHA_C = '45453bb8d6a3db3ca974495c7b3b36187004c503';

test('canonical Arm C executor SHA is pinned to Lean V2 ownership-guard candidate', async () => {
  const CANONICAL_ARM_C_SHA = '45453bb8d6a3db3ca974495c7b3b36187004c503';
  assert.equal(HARNESS_SHA_C, CANONICAL_ARM_C_SHA);

  const env = await captureEnvironment();
  assert.equal(env.executorCSha, CANONICAL_ARM_C_SHA);

  const summary = aggregateBenchmarkResults([]);
  assert.equal(summary.provenance.executorCSha, CANONICAL_ARM_C_SHA);
});

test('captureEnvironment returns system details and full provenance without inventing synthetic models', async () => {
  const env = await captureEnvironment({ model: 'test-model' });
  assert.equal(typeof env.platform, 'string');
  assert.equal(typeof env.cpuCount, 'number');
  assert.ok(env.cpuCount > 0);
  assert.equal(env.model, 'test-model');
  assert.equal(env.workloadBaseSha, WORKLOAD_BASE_SHA);
  assert.equal(env.workloadBaseTag, 'benchmark/workload-base-3f0e5320');
  assert.equal(env.executorBSha, '3f5e804c5bf55c88634535971d605f40b1b8713d');
  assert.equal(env.executorCSha, HARNESS_SHA_C);
  assert.ok(typeof env.claudeVersion === 'string');

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

  // Fragile free-text rejection: contradictory phrases and negation should NEVER yield READY
  assert.equal(determineAgentVerdict({ output: 'Not READY' }), 'BLOCKED');
  assert.equal(determineAgentVerdict({ output: 'System is NOT READY for deployment' }), 'BLOCKED');
  assert.equal(determineAgentVerdict({ output: 'The service is not ready yet' }), 'BLOCKED');
  assert.equal(determineAgentVerdict({ output: 'We failed to be READY on time' }), 'BLOCKED');
  assert.equal(determineAgentVerdict({ output: 'Unresolved blockers: READY' }), 'BLOCKED');
  assert.equal(determineAgentVerdict({ output: 'Blockers: remain unresolved. STATUS: READY' }), 'BLOCKED');

  // Structured JSON schema output parsing
  assert.equal(determineAgentVerdict({ output: JSON.stringify({ benchmarkVerdict: 'READY' }) }), 'READY');
  assert.equal(determineAgentVerdict({ output: JSON.stringify({ benchmarkVerdict: 'BLOCKED' }) }), 'BLOCKED');
  assert.equal(determineAgentVerdict({ output: 'Log output:\n{"benchmarkVerdict":"READY"}\nDone.' }), 'READY');
  assert.equal(determineAgentVerdict({ output: 'Log output:\n{"benchmarkVerdict":"BLOCKED"}\nDone.' }), 'BLOCKED');

  // Structured disk verdict: gate-verdict.json takes precedence (Arm B/C direct check)
  const tempDir = fs.mkdtempSync(path.join('/tmp', 'test-verdict-'));
  try {
    fs.writeFileSync(path.join(tempDir, 'gate-verdict.json'), JSON.stringify({
      verdict: 'READY',
      runtimeFingerprint: 'qcet-lean-v2-native'
    }));
    assert.equal(determineAgentVerdict({ output: 'Unstructured text' }, tempDir), 'READY');
    assert.equal(determineAgentVerdict({ output: 'STATUS: BLOCKED' }, tempDir), 'READY');

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

    // Arm A with gate-verdict.json -> HARNESS_LEAKAGE
    fs.writeFileSync(path.join(tempDir, 'gate-verdict.json'), JSON.stringify({ verdict: 'READY' }));
    const resALeakVerdict = verifyTreatmentFidelity('A', tempDir);
    assert.equal(resALeakVerdict.valid, false);
    assert.equal(resALeakVerdict.reason, 'HARNESS_LEAKAGE');
    fs.rmSync(path.join(tempDir, 'gate-verdict.json'), { force: true });

    // Arm A with run-ledger.jsonl -> HARNESS_LEAKAGE
    fs.mkdirSync(path.join(tempDir, '.claude', 'dist'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.claude', 'dist', 'run-ledger.jsonl'), '{"type":"run_start"}\n');
    const resALeakLedger = verifyTreatmentFidelity('A', tempDir);
    assert.equal(resALeakLedger.valid, false);
    assert.equal(resALeakLedger.reason, 'HARNESS_LEAKAGE');
    fs.rmSync(path.join(tempDir, '.claude'), { recursive: true, force: true });

    // Arm A with run-telemetry.json -> HARNESS_LEAKAGE
    fs.mkdirSync(path.join(tempDir, '.claude', 'executor-evals'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.claude', 'executor-evals', 'run-telemetry.json'), '{}');
    const resAContaminated = verifyTreatmentFidelity('A', tempDir);
    assert.equal(resAContaminated.valid, false);
    assert.equal(resAContaminated.reason, 'HARNESS_LEAKAGE');
    fs.rmSync(path.join(tempDir, '.claude'), { recursive: true, force: true });

    // Helper: write a minimal transcript with a valid Skill invocation for qcet-plan-executor.
    // Tier-1 requires a JSONL file with a tool_use block: name="Skill", input.skill contains "qcet-plan-executor".
    const transcriptPath = path.join(tempDir, 'transcript.jsonl');
    const skillInvocationLine = JSON.stringify({
      content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'qcet-plan-executor' } }]
    });
    fs.writeFileSync(transcriptPath, skillInvocationLine + '\n');

    // Arm B without V1.5 evidence and no transcript -> invalid (HARNESS_NOT_INVOKED)
    const resBMissing = verifyTreatmentFidelity('B', tempDir);
    assert.equal(resBMissing.valid, false);
    assert.equal(resBMissing.reason, 'HARNESS_NOT_INVOKED');

    // Arm B with run-ledger.jsonl + valid transcript -> valid (both tiers satisfied)
    fs.mkdirSync(path.join(tempDir, '.claude', 'dist'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.claude', 'dist', 'run-ledger.jsonl'), '{"type":"run_start"}\n');
    const resBLedgerValid = verifyTreatmentFidelity({ arm: 'B', trialDir: tempDir, transcriptPath });
    assert.equal(resBLedgerValid.valid, true);
    fs.rmSync(path.join(tempDir, '.claude'), { recursive: true, force: true });

    // Arm B with run-telemetry.json + valid transcript -> valid (both tiers satisfied)
    fs.mkdirSync(path.join(tempDir, '.claude', 'executor-evals'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.claude', 'executor-evals', 'run-telemetry.json'), JSON.stringify({
      verdict: 'READY',
      engineVersion: '1.5.0'
    }));
    const resBValid = verifyTreatmentFidelity({ arm: 'B', trialDir: tempDir, transcriptPath });
    assert.equal(resBValid.valid, true);
    fs.rmSync(path.join(tempDir, '.claude'), { recursive: true, force: true });

    // Arm C without gate-verdict.json or ledger and no transcript -> invalid (HARNESS_NOT_INVOKED)
    const resCMissing = verifyTreatmentFidelity('C', tempDir);
    assert.equal(resCMissing.valid, false);
    assert.equal(resCMissing.reason, 'HARNESS_NOT_INVOKED');

    // Arm C with run-ledger.jsonl + valid transcript -> valid (both tiers satisfied)
    fs.mkdirSync(path.join(tempDir, '.claude', 'dist'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.claude', 'dist', 'run-ledger.jsonl'), '{"type":"run_start"}\n');
    const resCLedgerValid = verifyTreatmentFidelity({ arm: 'C', trialDir: tempDir, transcriptPath });
    assert.equal(resCLedgerValid.valid, true);
    fs.rmSync(path.join(tempDir, '.claude'), { recursive: true, force: true });

    // Arm C with gate-verdict.json + valid transcript -> valid (both tiers satisfied)
    fs.writeFileSync(path.join(tempDir, 'gate-verdict.json'), JSON.stringify({
      verdict: 'READY',
      runtimeFingerprint: 'qcet-lean-v2-native'
    }));
    const resCValid = verifyTreatmentFidelity({ arm: 'C', trialDir: tempDir, transcriptPath });
    assert.equal(resCValid.valid, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('verifyHarnessOverlay and archiveHarnessOrThrow fail closed on missing required files', () => {
  const tempDir = fs.mkdtempSync(path.join('/tmp', 'test-overlay-verify-'));
  try {
    // Missing workflows/qcet-plan-executor.js -> throws
    assert.throws(() => {
      verifyHarnessOverlay(tempDir, 'B');
    }, /Required harness file missing/);

    // Create minimal mock harness files
    fs.mkdirSync(path.join(tempDir, '.claude', 'workflows'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, '.claude', 'skills', 'qcet-plan-executor'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.claude', 'workflows', 'qcet-plan-executor.js'), '// workflow');
    fs.writeFileSync(path.join(tempDir, '.claude', 'settings.json'), '{}');

    // Missing skill.json for Arm B -> throws
    assert.throws(() => {
      verifyHarnessOverlay(tempDir, 'B');
    }, /Required file missing: \.claude\/skills\/qcet-plan-executor\/skill\.json/);

    // Create skill.json
    fs.writeFileSync(path.join(tempDir, '.claude', 'skills', 'qcet-plan-executor', 'skill.json'), '{"name":"qcet-plan-executor"}');

    // Arm B now passes
    assert.equal(verifyHarnessOverlay(tempDir, 'B'), true);

    // Arm C without .claude/rules/00-core.md -> throws
    assert.throws(() => {
      verifyHarnessOverlay(tempDir, 'C');
    }, /Required rules missing: \.claude\/rules\/00-core\.md/);

    // Arm C with .claude/rules/00-core.md not matching Lean V2 -> throws
    fs.mkdirSync(path.join(tempDir, '.claude', 'rules'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.claude', 'rules', '00-core.md'), '# Invalid Rules');
    assert.throws(() => {
      verifyHarnessOverlay(tempDir, 'C');
    }, /does not match Lean V2 invariants/);

    // Arm C with matching Lean V2 00-core.md -> passes
    fs.writeFileSync(path.join(tempDir, '.claude', 'rules', '00-core.md'), '# Core System Invariants\n1. One Capability, One Implementation');
    assert.equal(verifyHarnessOverlay(tempDir, 'C'), true);
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

test('CLI capability preflight requires explicit model pinning in live mode', async () => {
  await assert.rejects(async () => {
    await verifyCliCapabilities({ dryRun: false, effort: 'high', model: '' });
  }, /Live benchmark execution requires an explicit --model parameter/);

  await assert.rejects(async () => {
    await verifyCliCapabilities({ dryRun: false, effort: 'high', model: 'unknown' });
  }, /Live benchmark execution requires an explicit --model parameter/);
});

test('task timeouts are tuned per-task (20m, 50m, 90m) and support custom overrides', () => {
  assert.equal(DEFAULT_TASK_TIMEOUTS_MS['small-01'], 20 * 60 * 1000);
  assert.equal(DEFAULT_TASK_TIMEOUTS_MS['medium-01'], 50 * 60 * 1000);
  assert.equal(DEFAULT_TASK_TIMEOUTS_MS['critical-01'], 90 * 60 * 1000);

  assert.equal(resolveTaskTimeoutMs('small-01'), 1200000);
  assert.equal(resolveTaskTimeoutMs('medium-01'), 3000000);
  assert.equal(resolveTaskTimeoutMs('critical-01'), 5400000);
  assert.equal(resolveTaskTimeoutMs('nonexistent-task'), 1800000);

  // Per-task override
  assert.equal(resolveTaskTimeoutMs('small-01', { taskTimeouts: { 'small-01': 99999 } }), 99999);

  // Global custom fallback override
  assert.equal(resolveTaskTimeoutMs('small-01', { customTimeoutMs: 77777 }), 77777);
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

test('aggregateBenchmarkResults enforces 100% treatment fidelity and accounts for cache tokens', () => {
  // Test normalizeEffort
  assert.equal(normalizeEffort('ultracode'), 'high');
  assert.equal(normalizeEffort('invalid-level'), 'high');
  assert.equal(normalizeEffort('low'), 'low');
  assert.equal(normalizeEffort('medium'), 'medium');
  assert.equal(normalizeEffort('high'), 'high');
  assert.equal(normalizeEffort('xhigh'), 'xhigh');
  assert.equal(normalizeEffort('max'), 'max');

  // Trials with usage object instead of top-level token fields
  const trialsWithUsage = [
    {
      task: 'critical-01', arm: 'B', durationMs: 15000, totalTokens: 80000,
      usage: {
        input_tokens: 40000, output_tokens: 10000,
        cache_creation_input_tokens: 15000, cache_read_input_tokens: 15000,
        total_tokens: 80000, total_cost_usd: 0.25
      },
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    },
    {
      task: 'critical-01', arm: 'C', durationMs: 8000, totalTokens: 40000,
      usage: {
        input_tokens: 20000, output_tokens: 5000,
        cache_creation_input_tokens: 7500, cache_read_input_tokens: 7500,
        total_tokens: 40000, total_cost_usd: 0.12
      },
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    }
  ];

  const summary = aggregateBenchmarkResults(trialsWithUsage);
  assert.ok(summary.provenance);
  assert.equal(summary.provenance.workloadBaseSha, WORKLOAD_BASE_SHA);
  assert.equal(summary.provenance.workloadBaseTag, 'benchmark/workload-base-3f0e5320');
  assert.equal(summary.provenance.executorBSha, '3f5e804c5bf55c88634535971d605f40b1b8713d');
  assert.equal(summary.provenance.executorCSha, HARNESS_SHA_C);
  assert.equal(summary.armSummaries.C.cacheCreationInputTokens.median, 7500);
  assert.equal(summary.armSummaries.C.cacheReadInputTokens.median, 7500);
  assert.equal(summary.armSummaries.B.cacheCreationInputTokens.median, 15000);
  assert.equal(summary.armSummaries.B.cacheReadInputTokens.median, 15000);
  assert.equal(summary.comparisons.cacheReadTokenRatioVsV15, 0.5);
  assert.equal(summary.comparisons.cacheCreationTokenRatioVsV15, 0.5);
  assert.equal(summary.armSummaries.C.invalidTrialsCount, 0);
  assert.equal(summary.armSummaries.C.treatmentFidelityRate, 100);
  assert.equal(summary.recommendation, 'SHIP_LEAN_V2');

  // Arm C with HARNESS_NOT_INVOKED must block SHIP_LEAN_V2 (requires 100% treatment fidelity)
  const trialsWithFidelityFailure = [
    {
      task: 'critical-01', arm: 'B', durationMs: 15000, totalTokens: 80000,
      grade: { success: true, agentVerdict: 'READY', graderVerdict: 'PASS', falseReady: false, escapedDefects: 0, ownershipViolations: 0 }
    },
    {
      task: 'critical-01', arm: 'C', durationMs: 8000, totalTokens: 40000,
      grade: {
        success: false, agentVerdict: 'HARNESS_NOT_INVOKED', graderVerdict: 'FAIL',
        falseReady: false, treatmentFidelity: false, fidelityReason: 'HARNESS_NOT_INVOKED',
        escapedDefects: 0, ownershipViolations: 0
      }
    }
  ];

  const fidelitySummary = aggregateBenchmarkResults(trialsWithFidelityFailure);
  assert.equal(fidelitySummary.armSummaries.C.harnessNotInvokedCount, 1);
  assert.equal(fidelitySummary.armSummaries.C.invalidTrialsCount, 1);
  assert.equal(fidelitySummary.armSummaries.C.treatmentFidelityRate, 0);
  assert.equal(fidelitySummary.recommendation, 'BLOCKED_QUALITY_REGRESSION');

  // Arm A with HARNESS_LEAKAGE counts as invalid trial
  const armALeakageTrials = [
    {
      task: 'critical-01', arm: 'A', durationMs: 10000, totalTokens: 50000,
      grade: {
        success: false, agentVerdict: 'HARNESS_LEAKAGE', graderVerdict: 'FAIL',
        falseReady: false, treatmentFidelity: false, fidelityReason: 'HARNESS_LEAKAGE',
        escapedDefects: 0, ownershipViolations: 0
      }
    }
  ];
  const armASummary = aggregateBenchmarkResults(armALeakageTrials);
  assert.equal(armASummary.armSummaries.A.harnessLeakageCount, 1);
  assert.equal(armASummary.armSummaries.A.invalidTrialsCount, 1);
});

