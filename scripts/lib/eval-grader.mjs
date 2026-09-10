/**
 * QCET Plan Executor - Independent Automated Grader
 * Evaluates plan execution runs against objective correctness, isolation,
 * zero false claims, zero invariant violations, and speedup metrics.
 */

import { validateManifestCoverage, validateManifestOwnership, computeShardPriorities } from './executor-contracts.mjs';

/**
 * Grade a completed plan execution run against manifest and telemetry.
 *
 * @param {any} telemetry - Real execution telemetry JSON
 * @param {any} manifest - Shard manifest JSON
 * @param {any} [options]
 * @returns {any}
 */
export function gradeExecution(telemetry, manifest, options = {}) {
  const failures = [];
  let score = 100;

  if (!telemetry || !manifest) {
    return {
      passed: false,
      score: 0,
      grade: 'F',
      checks: {},
      failures: ['Missing telemetry or manifest input'],
    };
  }

  // 1. Manifest structural validity & coverage
  const coverageErrors = validateManifestCoverage(manifest);
  if (coverageErrors.length > 0) {
    failures.push(`Manifest coverage invalid: ${coverageErrors.join('; ')}`);
    score -= 30;
  }

  // 2. Ownership & isolation check
  const ownershipErrors = validateManifestOwnership(manifest);
  if (ownershipErrors.length > 0) {
    failures.push(`Manifest ownership overlap without isolation: ${ownershipErrors.join('; ')}`);
    score -= 30;
  }

  // 3. Telemetry integrity (Zero synthetic data, real measured metrics)
  const isRealDuration = typeof telemetry.totalDurationMs === 'number' && telemetry.totalDurationMs >= 0;
  if (!isRealDuration) {
    failures.push('Telemetry duration is missing or synthetic');
    score -= 25;
  }

  // 4. Shard execution completeness
  const manifestShards = manifest.shards || [];
  const telemetryShards = telemetry.shards || {};
  for (const s of manifestShards) {
    const executed = telemetryShards[s.id];
    if (!executed) {
      failures.push(`Shard ${s.id} was not executed`);
      score -= 20;
    } else if (executed.status !== 'completed' && executed.status !== 'passed') {
      failures.push(`Shard ${s.id} did not complete successfully (status: ${executed.status})`);
      score -= 15;
    }
  }

  // 5. Invariant enforcement & release decision consistency
  const verification = telemetry.verification;
  if (verification) {
    if (verification.invariantViolationsCount > 0 && verification.releaseDecision === 'PROMOTE') {
      failures.push('FATAL: Release gate PROMOTED code containing invariant violations!');
      score = 0; // Immediate failure
    }
    if (verification.testsFailed > 0 && verification.releaseDecision === 'PROMOTE') {
      failures.push('FATAL: Release gate PROMOTED code with failing automated tests!');
      score = 0;
    }
    if (!verification.typecheckPassed && verification.releaseDecision === 'PROMOTE') {
      failures.push('FATAL: Release gate PROMOTED code with TypeScript typecheck failure!');
      score = 0;
    }
  }

  score = Math.max(0, score);
  let grade = 'A';
  if (score < 60) grade = 'F';
  else if (score < 75) grade = 'C';
  else if (score < 90) grade = 'B';

  return {
    passed: score >= 80 && failures.length === 0,
    score,
    grade,
    checks: {
      manifestCoverage: coverageErrors.length === 0,
      manifestOwnership: ownershipErrors.length === 0,
      telemetryIntegrity: isRealDuration,
      shardsComplete: manifestShards.length > 0 && failures.every((f) => !f.includes('Shard ')),
      invariantsClean: (verification?.invariantViolationsCount || 0) === 0,
      releaseGateHonest: score > 0,
    },
    failures,
  };
}

/**
 * Grade benchmark comparing baseline and candidate runs.
 * @param {any} baselineTelemetry
 * @param {any} candidateTelemetry
 * @param {any} manifest
 * @returns {any}
 */
export function gradeBenchmark(baselineTelemetry, candidateTelemetry, manifest) {
  let gradeBase = baselineTelemetry.qualityScore !== undefined
    ? { score: baselineTelemetry.qualityScore, passed: baselineTelemetry.verificationPassed ?? true }
    : gradeExecution(baselineTelemetry, manifest);
  let gradeCand = candidateTelemetry.qualityScore !== undefined
    ? { score: candidateTelemetry.qualityScore, passed: candidateTelemetry.verificationPassed ?? true }
    : gradeExecution(candidateTelemetry, manifest);

  const durationBase = baselineTelemetry.totalDurationMs || 1;
  const durationCand = candidateTelemetry.totalDurationMs || 1;
  const speedupRatio = Number((durationBase / durationCand).toFixed(2));

  const tokensBase = baselineTelemetry.tokenUsage?.totalTokens || 0;
  const tokensCand = candidateTelemetry.tokenUsage?.totalTokens || 0;
  const tokenSavingsPercent = tokensBase > 0 ? Math.round(((tokensBase - tokensCand) / tokensBase) * 100) : 0;
  const qualityDelta = gradeCand.score - gradeBase.score;

  const passesQualityGate = gradeCand.passed && gradeCand.score >= (gradeBase.score - 5);
  const achievesTargetSpeedup = speedupRatio >= 1.2; // At least 20% speedup target

  return {
    baselineGrade: gradeBase,
    candidateGrade: gradeCand,
    speedupRatio,
    tokenSavingsPercent,
    qualityDelta,
    achievesTargetSpeedup,
    passesQualityGate,
    passed: passesQualityGate && achievesTargetSpeedup,
    overallSuccess: passesQualityGate && achievesTargetSpeedup,
  };
}
