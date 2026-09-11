import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { captureEnvironment } from './lib/environment.mjs';
import { prepareTrialDirectory, cleanupTrialDirectory } from './lib/git-harness.mjs';
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
    harnessShaC: '02d090e8e8e23c9c7def9826b99c815af74ecf42',
    outputDir: path.join(process.cwd(), 'benchmarks', 'live', 'results')
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
    }
  }

  return options;
}

export async function main() {
  const options = parseArgs();
  const repoRoot = process.cwd();
  const benchmarkId = `bench-${Date.now()}`;
  const envInfo = await captureEnvironment();

  console.log('====================================================');
  console.log(' QCET Live Benchmark Suite Runner');
  console.log('====================================================');
  console.log(`Benchmark ID : ${benchmarkId}`);
  console.log(`Dry Run      : ${options.dryRun}`);
  console.log(`Arms         : ${options.arms.join(', ')}`);
  console.log(`Tasks        : ${options.tasks.join(', ')}`);
  console.log(`Trials/Cell  : ${options.trials}`);
  console.log(`Output Dir   : ${options.outputDir}`);
  console.log('----------------------------------------------------');

  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }

  const results = [];
  const tasksBaseDir = path.join(repoRoot, 'benchmarks', 'live', 'tasks');

  for (const arm of options.arms) {
    let harnessSha = null;
    if (arm === 'B') harnessSha = options.harnessShaB;
    if (arm === 'C') harnessSha = options.harnessShaC;

    for (const task of options.tasks) {
      for (let trial = 1; trial <= options.trials; trial++) {
        console.log(`[Running] Arm: ${arm} | Task: ${task} | Trial: ${trial}/${options.trials}`);
        const startTime = Date.now();

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
            durationMs: 0,
            grade: { success: false, escapedDefects: 1, errors: [err.message] }
          });
          continue;
        }

        const { targetDir, trialId } = trialPrep;

        // Execution step:
        // In dryRun mode, we do not invoke Claude API; we execute the grader directly to test harness integrity.
        let executionOutput = '';
        let totalTokens = 0;
        if (!options.dryRun) {
          console.log(`  Executing task workload in ${targetDir}...`);
          try {
            // Live execution via claude prompt if non-dry-run
            // e.g. claude -p "Execute plan.md"
            executionOutput = 'Live execution placeholder';
          } catch (execErr) {
            executionOutput = execErr.message;
          }
        } else {
          executionOutput = 'Dry-run: skipped agent invocation';
        }

        const durationMs = Date.now() - startTime;

        // Run grader
        let gradeResult;
        try {
          gradeResult = await gradeTrial(task, targetDir, tasksBaseDir);
        } catch (gradeErr) {
          gradeResult = {
            success: false,
            task,
            escapedDefects: 1,
            errors: [`Grader failed to execute: ${gradeErr.message}`]
          };
        }

        const trialRecord = {
          trialId,
          arm,
          task,
          trial,
          durationMs,
          totalTokens,
          dryRun: options.dryRun,
          grade: gradeResult
        };

        results.push(trialRecord);
        console.log(`  Result: Success=${gradeResult.success} | Duration=${durationMs}ms | EscapedDefects=${gradeResult.escapedDefects || 0}`);

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

  // Generate Human-Readable Markdown Report
  const mdReportPath = path.join(options.outputDir, `${benchmarkId}.md`);
  const mdContent = `# QCET Live Benchmark Suite Report: ${benchmarkId}

**Date**: ${envInfo.timestamp}
**Platform**: ${envInfo.platform} (${envInfo.arch}, ${envInfo.cpuCount} CPUs)
**Model**: ${envInfo.model} | **Claude Code**: ${envInfo.claudeCodeVersion}
**Dry Run**: ${options.dryRun}

## 1. Decision & Recommendation
**FINAL RECOMMENDATION**: \`${aggregation.recommendation}\`

### Comparative Ratios:
- **Speedup vs V1.5 Hardened (Arm B)**: ${aggregation.comparisons.speedupVsV15}x
- **Token Ratio vs V1.5 Hardened (Arm B)**: ${aggregation.comparisons.tokenRatioVsV15}x
- **Speedup vs Pure Ultracode (Arm A)**: ${aggregation.comparisons.speedupVsUltracode}x

## 2. Arm Summaries

| Arm | Trials | Pass Rate | Wall Clock (Mean ms) | Escaped Defects | Ownership Violations |
|---|---|---|---|---|---|
| **Arm A (Ultracode)** | ${aggregation.armSummaries.A.totalTrials} | ${aggregation.armSummaries.A.passRate.toFixed(1)}% | ${aggregation.armSummaries.A.wallClockMs.mean} | ${aggregation.armSummaries.A.totalEscapedDefects} | ${aggregation.armSummaries.A.totalOwnershipViolations} |
| **Arm B (V1.5 Hardened)** | ${aggregation.armSummaries.B.totalTrials} | ${aggregation.armSummaries.B.passRate.toFixed(1)}% | ${aggregation.armSummaries.B.wallClockMs.mean} | ${aggregation.armSummaries.B.totalEscapedDefects} | ${aggregation.armSummaries.B.totalOwnershipViolations} |
| **Arm C (Lean V2)** | ${aggregation.armSummaries.C.totalTrials} | ${aggregation.armSummaries.C.passRate.toFixed(1)}% | ${aggregation.armSummaries.C.wallClockMs.mean} | ${aggregation.armSummaries.C.totalEscapedDefects} | ${aggregation.armSummaries.C.totalOwnershipViolations} |

## 3. Raw Trial Logs
Written to \`${resultsPath}\`.
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
