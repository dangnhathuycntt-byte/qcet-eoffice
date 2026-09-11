import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { captureEnvironment } from './lib/environment.mjs';
import { prepareTrialDirectory, cleanupTrialDirectory } from './lib/git-harness.mjs';
import { validateReferenceSolutions } from './lib/validate-references.mjs';
import { gradeTrial } from './grade.mjs';
import { aggregateBenchmarkResults } from './aggregate.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    arms: ['A', 'B', 'C'],
    tasks: ['small-01', 'medium-01', 'critical-01'],
    trials: 1,
    keepTrials: false,
    workloadBaseSha: '3f0e5320b67acf5fd814c6a0c49e3b9ff9e09a1c',
    harnessShaB: '3f5e804c5bf55c88634535971d605f40b1b8713d',
    harnessShaC: '9f90ca70bc8601c902781d4a8ec9ec5908ecfeee',
    outputDir: path.join(process.cwd(), 'benchmarks', 'live', 'results'),
    model: process.env.QCET_BENCHMARK_MODEL || '',
    effort: 'ultracode',
    timeoutMs: 600000,
    dangerouslySkipPermissions: false,
    skipPreflight: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--keep-trials') {
      options.keepTrials = true;
    } else if (arg === '--trials' && args[i + 1]) {
      options.trials = parseInt(args[++i], 10);
    } else if (arg === '--arms' && args[i + 1]) {
      options.arms = args[++i].split(',').map(s => s.trim().toUpperCase());
    } else if (arg === '--tasks' && args[i + 1]) {
      options.tasks = args[++i].split(',').map(s => s.trim());
    } else if (arg === '--output-dir' && args[i + 1]) {
      options.outputDir = args[++i];
    } else if (arg === '--model' && args[i + 1]) {
      options.model = args[++i];
    } else if (arg === '--effort' && args[i + 1]) {
      options.effort = args[++i];
    } else if (arg === '--timeout-ms' && args[i + 1]) {
      options.timeoutMs = parseInt(args[++i], 10);
    } else if (arg === '--dangerously-skip-permissions') {
      options.dangerouslySkipPermissions = true;
    } else if (arg === '--skip-preflight') {
      options.skipPreflight = true;
    }
  }

  return options;
}

/**
 * Execute agent trial in the isolated workspace.
 */
async function executeAgentTrial({ targetDir, arm, task, options }) {
  if (options.dryRun) {
    return {
      output: 'Dry-run: skipped agent invocation',
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      timedOut: false,
      isError: false
    };
  }

  const prompt = arm === 'A'
    ? 'Execute the implementation plan in plan.md. Write minimal, correct code and ensure all tests pass.'
    : 'Execute the implementation plan in plan.md using the QCET Plan Executor. Follow all QCET rules, invariants, and policies.';

  const cliArgs = [
    '-p',
    prompt,
    '--output-format', 'json',
    '--no-session-persistence'
  ];

  if (options.model && options.model !== 'unknown') {
    cliArgs.push('--model', options.model);
  }
  if (options.effort) {
    cliArgs.push('--effort', options.effort);
  }
  if (options.dangerouslySkipPermissions) {
    cliArgs.push('--dangerously-skip-permissions');
  }

  const startTime = Date.now();
  try {
    const res = spawnSync('claude', cliArgs, {
      cwd: targetDir,
      encoding: 'utf8',
      timeout: options.timeoutMs,
      maxBuffer: 50 * 1024 * 1024
    });

    const durationMs = Date.now() - startTime;
    const timedOut = Boolean(res.error && res.error.code === 'ETIMEDOUT');

    if (res.error && !timedOut) {
      return {
        output: res.error.message,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        timedOut: false,
        isError: true
      };
    }

    let json = null;
    try {
      json = JSON.parse(res.stdout || '{}');
    } catch (_) {}

    const inputTokens = json?.usage?.input_tokens || 0;
    const outputTokens = json?.usage?.output_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    const outputText = json?.result || res.stdout || '';

    return {
      output: outputText,
      totalTokens,
      inputTokens,
      outputTokens,
      durationMs,
      timedOut,
      isError: Boolean(res.status !== 0 || json?.is_error)
    };
  } catch (err) {
    return {
      output: err.message,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - startTime,
      timedOut: false,
      isError: true
    };
  }
}

/**
 * Return counterbalanced order of arms for a given trial index.
 * Latin square rotation:
 * trial 1: A, B, C
 * trial 2: B, C, A
 * trial 3: C, A, B
 */
function getCounterbalancedArms(arms, trialIndex) {
  const n = arms.length;
  const shift = (trialIndex - 1) % n;
  return [...arms.slice(shift), ...arms.slice(0, shift)];
}

export async function main() {
  const options = parseArgs();
  const repoRoot = process.cwd();
  const benchmarkId = `bench-${Date.now()}`;
  const envInfo = await captureEnvironment(options);

  console.log('====================================================');
  console.log(' QCET Live Benchmark Suite Runner');
  console.log('====================================================');
  console.log(`Benchmark ID : ${benchmarkId}`);
  console.log(`Dry Run      : ${options.dryRun}`);
  console.log(`Arms         : ${options.arms.join(', ')}`);
  console.log(`Tasks        : ${options.tasks.join(', ')}`);
  console.log(`Trials/Cell  : ${options.trials}`);
  console.log(`Timeout (ms) : ${options.timeoutMs}`);
  console.log(`Output Dir   : ${options.outputDir}`);
  console.log('----------------------------------------------------');

  // Preflight validation: verify all reference solutions against graders
  if (!options.skipPreflight) {
    console.log('[Preflight] Verifying reference solutions against graders...');
    try {
      const preflight = await validateReferenceSolutions({
        tasks: options.tasks,
        workloadBaseSha: options.workloadBaseSha,
        repoRoot
      });
      console.log(`[Preflight] Passed for ${preflight.validatedTasks.length} tasks.`);
    } catch (preflightErr) {
      console.error(`[Preflight FAILED] ${preflightErr.message}`);
      process.exit(1);
    }
  }

  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }

  const results = [];
  const tasksBaseDir = path.join(repoRoot, 'benchmarks', 'live', 'tasks');

  for (const task of options.tasks) {
    for (let trial = 1; trial <= options.trials; trial++) {
      const orderedArms = getCounterbalancedArms(options.arms, trial);

      for (const arm of orderedArms) {
        console.log(`[Running] Task: ${task} | Arm: ${arm} | Trial: ${trial}/${options.trials}`);

        let harnessSha = null;
        if (arm === 'B') harnessSha = options.harnessShaB;
        if (arm === 'C') harnessSha = options.harnessShaC;

        const prepStart = Date.now();
        let trialPrep;
        try {
          trialPrep = await prepareTrialDirectory({
            benchmarkId,
            arm,
            task,
            trial,
            workloadBaseSha: options.workloadBaseSha,
            harnessSha,
            repoRoot
          });
        } catch (err) {
          console.error(`  [Prep Failed] ${err.message}`);
          results.push({
            arm,
            task,
            trial,
            error: err.message,
            timing: { prepMs: Date.now() - prepStart, agentWallClockMs: 0, graderMs: 0, totalTrialMs: Date.now() - prepStart },
            durationMs: 0,
            totalTokens: 0,
            timedOut: false,
            isError: true,
            grade: { success: false, escapedDefects: 1, errors: [err.message] }
          });
          continue;
        }

        const prepMs = Date.now() - prepStart;
        const { targetDir, trialId } = trialPrep;

        // Execute agent
        const execution = await executeAgentTrial({
          targetDir,
          arm,
          task,
          options
        });

        // Grade trial
        const gradeStart = Date.now();
        let gradeResult;
        try {
          gradeResult = await gradeTrial(task, targetDir, tasksBaseDir, execution);
        } catch (gradeErr) {
          gradeResult = {
            success: false,
            task,
            escapedDefects: 1,
            agentVerdict: 'ERROR',
            graderVerdict: 'FAIL',
            falseReady: false,
            errors: [`Grader failed to execute: ${gradeErr.message}`]
          };
        }
        const graderMs = Date.now() - gradeStart;
        const totalTrialMs = prepMs + execution.durationMs + graderMs;

        const trialRecord = {
          trialId,
          arm,
          task,
          trial,
          timing: {
            prepMs,
            agentWallClockMs: execution.durationMs,
            graderMs,
            totalTrialMs
          },
          durationMs: execution.durationMs,
          totalTokens: execution.totalTokens,
          inputTokens: execution.inputTokens,
          outputTokens: execution.outputTokens,
          timedOut: execution.timedOut,
          isError: execution.isError,
          dryRun: options.dryRun,
          grade: gradeResult
        };

        results.push(trialRecord);
        console.log(
          `  Result: Success=${gradeResult.success} | AgentVerdict=${gradeResult.agentVerdict} | FalseReady=${gradeResult.falseReady} | AgentMs=${execution.durationMs}ms | Tokens=${execution.totalTokens}`
        );

        if (!options.keepTrials) {
          await cleanupTrialDirectory(targetDir);
        }
      }
    }
  }

  // Aggregate results
  const aggregation = aggregateBenchmarkResults(results);
  const finalReport = {
    benchmarkId,
    environment: envInfo,
    options,
    summary: aggregation,
    trials: results
  };

  const resultsPath = path.join(options.outputDir, `${benchmarkId}.json`);
  fs.writeFileSync(resultsPath, JSON.stringify(finalReport, null, 2), 'utf8');

  // Generate Markdown report
  const mdReportPath = path.join(options.outputDir, `${benchmarkId}.md`);
  const armC = aggregation.armSummaries.C || { totalTrials: 0, passRate: 0, wallClockMs: { median: 0, iqr: 0 }, tokens: { median: 0 }, falseReadyCount: 0, escapedDefects: 0 };
  const armB = aggregation.armSummaries.B || { totalTrials: 0, passRate: 0, wallClockMs: { median: 0, iqr: 0 }, tokens: { median: 0 }, falseReadyCount: 0, escapedDefects: 0 };
  const armA = aggregation.armSummaries.A || { totalTrials: 0, passRate: 0, wallClockMs: { median: 0, iqr: 0 }, tokens: { median: 0 }, falseReadyCount: 0, escapedDefects: 0 };

  const mdContent = `# QCET Live Benchmark Suite Report: ${benchmarkId}

**Date**: ${envInfo.timestamp}
**Platform**: ${envInfo.platform} (${envInfo.arch}, ${envInfo.cpuCount} CPUs)
**Model**: ${envInfo.model} | **Claude Code**: ${envInfo.claudeCodeVersion}
**Dry Run**: ${options.dryRun}

## 1. Decision & Recommendation
**FINAL RECOMMENDATION**: \`${aggregation.recommendation}\`

### Comparative Ratios (Median-Based):
- **Speedup vs V1.5 Hardened (Arm B)**: ${aggregation.comparisons.speedupVsV15}x
- **Token Ratio vs V1.5 Hardened (Arm B)**: ${aggregation.comparisons.tokenRatioVsV15}x
- **Speedup vs Pure Ultracode (Arm A)**: ${aggregation.comparisons.speedupVsUltracode}x

## 2. Overall Arm Summaries

| Arm | Trials | Pass Rate | Median Wall Clock (IQR ms) | Median Tokens | False READY | Escaped Defects |
|---|---|---|---|---|---|---|
| **Arm A (Ultracode)** | ${armA.totalTrials} | ${armA.passRate.toFixed(1)}% | ${armA.wallClockMs.median} (IQR: ${armA.wallClockMs.iqr}) | ${armA.tokens.median} | ${armA.falseReadyCount} | ${armA.escapedDefects} |
| **Arm B (V1.5 Hardened)** | ${armB.totalTrials} | ${armB.passRate.toFixed(1)}% | ${armB.wallClockMs.median} (IQR: ${armB.wallClockMs.iqr}) | ${armB.tokens.median} | ${armB.falseReadyCount} | ${armB.escapedDefects} |
| **Arm C (Lean V2)** | ${armC.totalTrials} | ${armC.passRate.toFixed(1)}% | ${armC.wallClockMs.median} (IQR: ${armC.wallClockMs.iqr}) | ${armC.tokens.median} | ${armC.falseReadyCount} | ${armC.escapedDefects} |

## 3. Disaggregated Task Summaries

${Object.entries(aggregation.taskSummaries).map(([taskName, arms]) => `
### Task: ${taskName}
| Arm | Pass Rate | Median ms | False READY | Escaped Defects |
|---|---|---|---|---|
| A | ${arms.A?.passRate?.toFixed(1) ?? 'N/A'}% | ${arms.A?.wallClockMs?.median ?? 'N/A'} | ${arms.A?.falseReadyCount ?? 0} | ${arms.A?.escapedDefects ?? 0} |
| B | ${arms.B?.passRate?.toFixed(1) ?? 'N/A'}% | ${arms.B?.wallClockMs?.median ?? 'N/A'} | ${arms.B?.falseReadyCount ?? 0} | ${arms.B?.escapedDefects ?? 0} |
| C | ${arms.C?.passRate?.toFixed(1) ?? 'N/A'}% | ${arms.C?.wallClockMs?.median ?? 'N/A'} | ${arms.C?.falseReadyCount ?? 0} | ${arms.C?.escapedDefects ?? 0} |
`).join('\n')}

## 4. Raw Trial Logs
Full structured data written to \`${resultsPath}\`.
`;

  fs.writeFileSync(mdReportPath, mdContent, 'utf8');

  console.log('====================================================');
  console.log(` Benchmark Run Completed: ${aggregation.recommendation}`);
  console.log(` Results JSON : ${resultsPath}`);
  console.log(` Markdown Doc : ${mdReportPath}`);
  console.log('====================================================');
}

if (process.argv[1] && process.argv[1].endsWith('run-benchmark-suite.mjs')) {
  main().catch(err => {
    console.error('Benchmark suite execution failed:', err);
    process.exit(1);
  });
}
