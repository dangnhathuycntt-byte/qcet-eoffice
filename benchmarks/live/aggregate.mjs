import fs from 'node:fs';
import path from 'node:path';

/**
 * Basic statistical operations: mean, median, quantiles, and IQR.
 */
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  if (sortedArr.length === 1) return sortedArr[0];
  const idx = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const weight = idx - lower;
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

function calculateDistribution(arr) {
  if (!arr.length) {
    return { mean: 0, median: 0, q1: 0, q3: 0, iqr: 0 };
  }
  const s = [...arr].sort((a, b) => a - b);
  const q1 = Math.round(percentile(s, 25));
  const med = Math.round(percentile(s, 50));
  const q3 = Math.round(percentile(s, 75));
  const iqr = q3 - q1;
  return {
    mean: Math.round(mean(s)),
    median: med,
    q1,
    q3,
    iqr
  };
}

/**
 * Aggregate trial results disaggregated per Task x Arm, and overall by Arm.
 * Enforces strict tracking of agentVerdict, graderVerdict, falseReady, timeouts, and defects.
 */
export function aggregateBenchmarkResults(results) {
  const byArm = { A: [], B: [], C: [] };
  const byTaskAndArm = {};

  for (const r of results) {
    if (byArm[r.arm]) {
      byArm[r.arm].push(r);
    }
    if (!byTaskAndArm[r.task]) {
      byTaskAndArm[r.task] = { A: [], B: [], C: [] };
    }
    if (byTaskAndArm[r.task][r.arm]) {
      byTaskAndArm[r.task][r.arm].push(r);
    }
  }

  // Calculate detailed summary per Task x Arm
  const taskSummaries = {};
  for (const [taskName, arms] of Object.entries(byTaskAndArm)) {
    taskSummaries[taskName] = {};
    for (const [armKey, trials] of Object.entries(arms)) {
      const wallClocks = trials.map(t => t.durationMs || 0);
      const tokens = trials.map(t => t.totalTokens || 0);
      const inputTokens = trials.map(t => t.inputTokens ?? t.usage?.input_tokens ?? 0);
      const outputTokens = trials.map(t => t.outputTokens ?? t.usage?.output_tokens ?? 0);
      const cacheCreationTokens = trials.map(t => t.cacheCreationInputTokens ?? t.usage?.cache_creation_input_tokens ?? 0);
      const cacheReadTokens = trials.map(t => t.cacheReadInputTokens ?? t.usage?.cache_read_input_tokens ?? 0);
      const costUsd = trials.map(t => t.totalCostUsd ?? t.usage?.total_cost_usd ?? 0);
      const passed = trials.filter(t => t.grade?.success).length;
      const falseReadyCount = trials.filter(t => t.grade?.falseReady).length;
      const harnessNotInvokedCount = trials.filter(t =>
        t.grade?.agentVerdict === 'HARNESS_NOT_INVOKED' ||
        t.grade?.fidelityReason === 'HARNESS_NOT_INVOKED' ||
        (t.arm !== 'A' && t.grade?.treatmentFidelity === false)
      ).length;
      const harnessLeakageCount = trials.filter(t =>
        t.grade?.agentVerdict === 'HARNESS_LEAKAGE' ||
        t.grade?.fidelityReason === 'HARNESS_LEAKAGE' ||
        (t.arm === 'A' && t.grade?.treatmentFidelity === false)
      ).length;
      const invalidTrialsCount = trials.filter(t =>
        t.grade?.agentVerdict === 'HARNESS_NOT_INVOKED' ||
        t.grade?.agentVerdict === 'HARNESS_LEAKAGE' ||
        t.grade?.fidelityReason === 'HARNESS_NOT_INVOKED' ||
        t.grade?.fidelityReason === 'HARNESS_LEAKAGE' ||
        t.grade?.treatmentFidelity === false
      ).length;
      const timeouts = trials.filter(t => t.timedOut || t.grade?.agentVerdict === 'TIMEOUT').length;
      const crashes = trials.filter(t => t.isError || t.grade?.agentVerdict === 'ERROR').length;
      const escapedDefects = trials.reduce((acc, t) => acc + (t.grade?.escapedDefects || 0), 0);
      const ownershipViolations = trials.reduce((acc, t) => acc + (t.grade?.ownershipViolations || 0), 0);

      taskSummaries[taskName][armKey] = {
        task: taskName,
        arm: armKey,
        totalTrials: trials.length,
        passedTrials: passed,
        passRate: trials.length ? (passed / trials.length) * 100 : 0,
        falseReadyCount,
        harnessNotInvokedCount,
        harnessLeakageCount,
        invalidTrialsCount,
        treatmentFidelityRate: trials.length ? Number((((trials.length - invalidTrialsCount) / trials.length) * 100).toFixed(1)) : 100,
        timeouts,
        crashes,
        escapedDefects,
        ownershipViolations,
        wallClockMs: calculateDistribution(wallClocks),
        tokens: calculateDistribution(tokens),
        inputTokens: calculateDistribution(inputTokens),
        outputTokens: calculateDistribution(outputTokens),
        cacheCreationInputTokens: calculateDistribution(cacheCreationTokens),
        cacheReadInputTokens: calculateDistribution(cacheReadTokens),
        totalCostUsd: calculateDistribution(costUsd)
      };
    }
  }

  // Calculate overall summary per Arm
  const armSummaries = {};
  for (const [armKey, trials] of Object.entries(byArm)) {
    const wallClocks = trials.map(t => t.durationMs || 0);
    const tokens = trials.map(t => t.totalTokens || 0);
    const inputTokens = trials.map(t => t.inputTokens ?? t.usage?.input_tokens ?? 0);
    const outputTokens = trials.map(t => t.outputTokens ?? t.usage?.output_tokens ?? 0);
    const cacheCreationTokens = trials.map(t => t.cacheCreationInputTokens ?? t.usage?.cache_creation_input_tokens ?? 0);
    const cacheReadTokens = trials.map(t => t.cacheReadInputTokens ?? t.usage?.cache_read_input_tokens ?? 0);
    const costUsd = trials.map(t => t.totalCostUsd ?? t.usage?.total_cost_usd ?? 0);
    const passed = trials.filter(t => t.grade?.success).length;
    const falseReadyCount = trials.filter(t => t.grade?.falseReady).length;
    const harnessNotInvokedCount = trials.filter(t =>
      t.grade?.agentVerdict === 'HARNESS_NOT_INVOKED' ||
      t.grade?.fidelityReason === 'HARNESS_NOT_INVOKED' ||
      (t.arm !== 'A' && t.grade?.treatmentFidelity === false)
    ).length;
    const harnessLeakageCount = trials.filter(t =>
      t.grade?.agentVerdict === 'HARNESS_LEAKAGE' ||
      t.grade?.fidelityReason === 'HARNESS_LEAKAGE' ||
      (t.arm === 'A' && t.grade?.treatmentFidelity === false)
    ).length;
    const invalidTrialsCount = trials.filter(t =>
      t.grade?.agentVerdict === 'HARNESS_NOT_INVOKED' ||
      t.grade?.agentVerdict === 'HARNESS_LEAKAGE' ||
      t.grade?.fidelityReason === 'HARNESS_NOT_INVOKED' ||
      t.grade?.fidelityReason === 'HARNESS_LEAKAGE' ||
      t.grade?.treatmentFidelity === false
    ).length;
    const timeouts = trials.filter(t => t.timedOut || t.grade?.agentVerdict === 'TIMEOUT').length;
    const crashes = trials.filter(t => t.isError || t.grade?.agentVerdict === 'ERROR').length;
    const escapedDefects = trials.reduce((acc, t) => acc + (t.grade?.escapedDefects || 0), 0);
    const ownershipViolations = trials.reduce((acc, t) => acc + (t.grade?.ownershipViolations || 0), 0);

    armSummaries[armKey] = {
      arm: armKey,
      totalTrials: trials.length,
      passedTrials: passed,
      passRate: trials.length ? (passed / trials.length) * 100 : 0,
      falseReadyCount,
      harnessNotInvokedCount,
      harnessLeakageCount,
      invalidTrialsCount,
      treatmentFidelityRate: trials.length ? Number((((trials.length - invalidTrialsCount) / trials.length) * 100).toFixed(1)) : 100,
      timeouts,
      crashes,
      escapedDefects,
      ownershipViolations,
      wallClockMs: calculateDistribution(wallClocks),
      tokens: calculateDistribution(tokens),
      inputTokens: calculateDistribution(inputTokens),
      outputTokens: calculateDistribution(outputTokens),
      cacheCreationInputTokens: calculateDistribution(cacheCreationTokens),
      cacheReadInputTokens: calculateDistribution(cacheReadTokens),
      totalCostUsd: calculateDistribution(costUsd)
    };
  }

  // Comparisons based on medians: Arm C (Lean V2) vs Arm B (V1.5 Hardened)
  let speedupVsB = 1.0;
  let tokenRatioVsB = 1.0;
  let cacheReadTokenRatioVsB = 1.0;
  let cacheCreationTokenRatioVsB = 1.0;
  if (armSummaries.B?.wallClockMs.median > 0 && armSummaries.C?.wallClockMs.median > 0) {
    speedupVsB = Number((armSummaries.B.wallClockMs.median / armSummaries.C.wallClockMs.median).toFixed(2));
  }
  if (armSummaries.B?.tokens.median > 0 && armSummaries.C?.tokens.median > 0) {
    tokenRatioVsB = Number((armSummaries.C.tokens.median / armSummaries.B.tokens.median).toFixed(2));
  }
  if (armSummaries.B?.cacheReadInputTokens?.median > 0 && armSummaries.C?.cacheReadInputTokens?.median > 0) {
    cacheReadTokenRatioVsB = Number((armSummaries.C.cacheReadInputTokens.median / armSummaries.B.cacheReadInputTokens.median).toFixed(2));
  }
  if (armSummaries.B?.cacheCreationInputTokens?.median > 0 && armSummaries.C?.cacheCreationInputTokens?.median > 0) {
    cacheCreationTokenRatioVsB = Number((armSummaries.C.cacheCreationInputTokens.median / armSummaries.B.cacheCreationInputTokens.median).toFixed(2));
  }

  // Comparisons based on medians: Arm C (Lean V2) vs Arm A (Pure Ultracode)
  let speedupVsA = 1.0;
  if (armSummaries.A?.wallClockMs.median > 0 && armSummaries.C?.wallClockMs.median > 0) {
    speedupVsA = Number((armSummaries.A.wallClockMs.median / armSummaries.C.wallClockMs.median).toFixed(2));
  }

  // Decision & Quality Gating
  const armC = armSummaries.C || { passRate: 0, falseReadyCount: 0, harnessNotInvokedCount: 0, harnessLeakageCount: 0, invalidTrialsCount: 0, escapedDefects: 0, ownershipViolations: 0 };
  const armB = armSummaries.B || { passRate: 0, falseReadyCount: 0, harnessNotInvokedCount: 0, harnessLeakageCount: 0, invalidTrialsCount: 0, escapedDefects: 0, ownershipViolations: 0 };

  const criticalCPassRate = taskSummaries['critical-01']?.C?.passRate ?? 100;
  const isCQualityPassing =
    armC.passRate >= armB.passRate &&
    armC.falseReadyCount <= armB.falseReadyCount &&
    (armC.harnessNotInvokedCount || 0) === 0 &&
    (armC.harnessLeakageCount || 0) === 0 &&
    (armC.invalidTrialsCount || 0) === 0 &&
    armC.escapedDefects <= armB.escapedDefects &&
    armC.ownershipViolations === 0 &&
    criticalCPassRate === 100;

  const isEfficiencyMet = speedupVsB >= 1.0 || speedupVsA >= 0.9;

  let recommendation = 'INCONCLUSIVE';
  if (isCQualityPassing && isEfficiencyMet) {
    recommendation = 'SHIP_LEAN_V2';
  } else if (!isCQualityPassing) {
    recommendation = 'BLOCKED_QUALITY_REGRESSION';
  } else {
    recommendation = 'BLOCKED_PERFORMANCE_REGRESSION';
  }

  return {
    timestamp: new Date().toISOString(),
    armSummaries,
    taskSummaries,
    comparisons: {
      speedupVsV15: speedupVsB,
      tokenRatioVsV15: tokenRatioVsB,
      cacheReadTokenRatioVsV15: cacheReadTokenRatioVsB,
      cacheCreationTokenRatioVsV15: cacheCreationTokenRatioVsB,
      speedupVsUltracode: speedupVsA
    },
    recommendation,
    rawResultsCount: results.length
  };
}

if (process.argv[1] && process.argv[1].endsWith('aggregate.mjs')) {
  const inputFile = process.argv[2];
  if (!inputFile || !fs.existsSync(inputFile)) {
    console.error('Usage: node aggregate.mjs <results.json>');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const summary = aggregateBenchmarkResults(raw);
  console.log(JSON.stringify(summary, null, 2));
}
