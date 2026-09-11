import fs from 'node:fs';
import path from 'node:path';

/**
 * Basic statistical operations: mean, median, standard deviation.
 */
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Compute 95% bootstrap confidence interval (1000 resamples).
 */
function bootstrapCI(arr, samples = 1000, alpha = 0.05) {
  if (!arr.length) return [0, 0];
  if (arr.length === 1) return [arr[0], arr[0]];

  const means = [];
  const n = arr.length;

  for (let i = 0; i < samples; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      const idx = Math.floor(Math.random() * n);
      sum += arr[idx];
    }
    means.push(sum / n);
  }

  means.sort((a, b) => a - b);
  const lowerIdx = Math.floor(samples * (alpha / 2));
  const upperIdx = Math.floor(samples * (1 - alpha / 2));

  return [means[lowerIdx], means[upperIdx]];
}

/**
 * Aggregate trial results across arms and tasks.
 */
export function aggregateBenchmarkResults(results) {
  const byArm = { A: [], B: [], C: [] };

  for (const r of results) {
    if (byArm[r.arm]) {
      byArm[r.arm].push(r);
    }
  }

  const armSummaries = {};
  for (const [armKey, trials] of Object.entries(byArm)) {
    const wallClocks = trials.map(t => t.durationMs || 0);
    const tokens = trials.map(t => t.totalTokens || 0);
    const escapedDefects = trials.reduce((acc, t) => acc + (t.grade?.escapedDefects || 0), 0);
    const ownershipViolations = trials.reduce((acc, t) => acc + (t.grade?.ownershipViolations || 0), 0);
    const passes = trials.filter(t => t.grade?.success).length;

    armSummaries[armKey] = {
      arm: armKey,
      totalTrials: trials.length,
      passedTrials: passes,
      passRate: trials.length ? (passes / trials.length) * 100 : 0,
      wallClockMs: {
        mean: Math.round(mean(wallClocks)),
        median: Math.round(median(wallClocks)),
        ci95: bootstrapCI(wallClocks).map(v => Math.round(v))
      },
      tokens: {
        mean: Math.round(mean(tokens)),
        median: Math.round(median(tokens)),
        ci95: bootstrapCI(tokens).map(v => Math.round(v))
      },
      totalEscapedDefects: escapedDefects,
      totalOwnershipViolations: ownershipViolations
    };
  }

  // Comparisons: Arm C (Lean V2) vs Arm B (V1.5 Hardened)
  let speedupVsB = 1.0;
  let tokenReductionVsB = 1.0;
  if (armSummaries.B.wallClockMs.mean > 0 && armSummaries.C.wallClockMs.mean > 0) {
    speedupVsB = Number((armSummaries.B.wallClockMs.mean / armSummaries.C.wallClockMs.mean).toFixed(2));
  }
  if (armSummaries.B.tokens.mean > 0 && armSummaries.C.tokens.mean > 0) {
    tokenReductionVsB = Number((armSummaries.C.tokens.mean / armSummaries.B.tokens.mean).toFixed(2));
  }

  // Comparisons: Arm C (Lean V2) vs Arm A (Pure Ultracode)
  let speedupVsA = 1.0;
  if (armSummaries.A.wallClockMs.mean > 0 && armSummaries.C.wallClockMs.mean > 0) {
    speedupVsA = Number((armSummaries.A.wallClockMs.mean / armSummaries.C.wallClockMs.mean).toFixed(2));
  }

  // Decision Logic
  const armC = armSummaries.C;
  const isCQualityPassing = armC.totalEscapedDefects === 0 && armC.totalOwnershipViolations === 0;
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
    comparisons: {
      speedupVsV15: speedupVsB,
      tokenRatioVsV15: tokenReductionVsB,
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
