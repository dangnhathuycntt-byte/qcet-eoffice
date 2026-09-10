/**
 * QCET Plan Executor - Real Telemetry & Verification Measurement
 * Implements E03: Zero synthetic metrics. All durations, test counts, token
 * counters, and file stats reflect real measured execution.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { getRepoRoot } from './worktree-manager.mjs';

/**
 * Execution telemetry collector.
 */
export class ExecutionTelemetry {
  /**
   * @param {string} runId
   * @param {Object} [options]
   * @param {string} [options.repoRoot]
   * @param {string} [options.storageDir]
   */
  constructor(runId, options = {}) {
    this.runId = runId || `run-${Date.now()}`;
    this.repoRoot = options.repoRoot || getRepoRoot();
    this.storageDir =
      options.storageDir ||
      path.join(this.repoRoot, '.superpowers', 'qcet-plan-executor', 'runs', this.runId);

    this.startTime = Date.now();
    this.endTime = null;
    this.totalDurationMs = 0;

    this.phases = {};
    this.shards = {};
    this.verification = null;
    this.gitStats = null;
    this.tokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    this.errors = [];
  }

  /**
   * Start a named execution phase.
   * @param {string} phaseName
   */
  startPhase(phaseName) {
    this.phases[phaseName] = {
      startTime: Date.now(),
      endTime: null,
      durationMs: 0,
      status: 'in_progress',
      metadata: {},
    };
  }

  /**
   * End a named execution phase.
   * @param {string} phaseName
   * @param {Object} [metadata]
   */
  endPhase(phaseName, metadata = {}) {
    const p = this.phases[phaseName];
    if (!p) return;

    p.endTime = Date.now();
    p.durationMs = Math.max(0, p.endTime - p.startTime);
    p.status = metadata.status || 'completed';
    p.metadata = { ...p.metadata, ...metadata };
  }

  /**
   * Record execution stats for a specific shard.
   * @param {string} shardId
   * @param {Object} data
   */
  recordShardExecution(shardId, data = {}) {
    this.shards[shardId] = {
      shardId,
      status: data.status || 'unknown',
      durationMs: typeof data.durationMs === 'number' ? data.durationMs : 0,
      filesTouched: Array.isArray(data.filesTouched) ? data.filesTouched : [],
      promptTokens: data.tokens?.prompt || 0,
      completionTokens: data.tokens?.completion || 0,
      retries: data.retries || 0,
      isolated: Boolean(data.isolated),
      recordedAt: Date.now(),
    };

    if (data.tokens) {
      this.tokenUsage.promptTokens += data.tokens.prompt || 0;
      this.tokenUsage.completionTokens += data.tokens.completion || 0;
      this.tokenUsage.totalTokens += (data.tokens.prompt || 0) + (data.tokens.completion || 0);
    }
  }

  /**
   * Record verifier output with real metrics.
   * @param {Object} data
   */
  recordVerification(data = {}) {
    this.verification = {
      typecheckPassed: Boolean(data.typecheckPassed),
      typecheckDurationMs: data.typecheckDurationMs || 0,
      testsPassed: data.testsPassed || 0,
      testsFailed: data.testsFailed || 0,
      testsTotal: (data.testsPassed || 0) + (data.testsFailed || 0),
      testDurationMs: data.testDurationMs || 0,
      invariantViolationsCount: data.invariantViolationsCount || 0,
      releaseDecision: data.releaseDecision || 'UNKNOWN',
      recordedAt: Date.now(),
    };
  }

  /**
   * Capture real git working directory changes via git status/diff.
   */
  captureGitStats() {
    try {
      const shortstat = execSync('git diff --shortstat HEAD', {
        cwd: this.repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      let filesChanged = 0;
      let insertions = 0;
      let deletions = 0;

      const fileMatch = shortstat.match(/(\d+)\s+file/);
      if (fileMatch) filesChanged = parseInt(fileMatch[1], 10);

      const insMatch = shortstat.match(/(\d+)\s+insertion/);
      if (insMatch) insertions = parseInt(insMatch[1], 10);

      const delMatch = shortstat.match(/(\d+)\s+deletion/);
      if (delMatch) deletions = parseInt(delMatch[1], 10);

      this.gitStats = {
        filesChanged,
        insertions,
        deletions,
        rawShortstat: shortstat,
      };
    } catch (_) {
      this.gitStats = {
        filesChanged: 0,
        insertions: 0,
        deletions: 0,
        rawShortstat: '',
      };
    }
  }

  /**
   * Finish execution measurement.
   */
  finish() {
    this.endTime = Date.now();
    this.totalDurationMs = Math.max(0, this.endTime - this.startTime);
    this.captureGitStats();
  }

  /**
   * Persist telemetry JSON to run storage directory.
   * @returns {string} Path to written telemetry file
   */
  persist() {
    if (!this.endTime) {
      this.finish();
    }

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    const targetFile = path.join(this.storageDir, 'telemetry.json');
    const data = this.toJSON();
    fs.writeFileSync(targetFile, JSON.stringify(data, null, 2), 'utf8');
    return targetFile;
  }

  /**
   * Serialize telemetry to JSON object.
   * @returns {any}
   */
  toJSON() {
    return {
      runId: this.runId,
      startTime: this.startTime,
      endTime: this.endTime,
      totalDurationMs: this.totalDurationMs,
      tokenUsage: this.tokenUsage,
      phases: this.phases,
      shards: this.shards,
      verification: this.verification,
      gitStats: this.gitStats,
      errors: this.errors,
    };
  }
}

/**
 * Load telemetry from disk for a given runId.
 * @param {string} runId
 * @param {Object} [options]
 * @returns {Object|null}
 */
export function loadTelemetry(runId, options = {}) {
  const repoRoot = options.repoRoot || getRepoRoot();
  const targetFile = path.join(
    repoRoot,
    '.superpowers',
    'qcet-plan-executor',
    'runs',
    runId,
    'telemetry.json'
  );

  if (!fs.existsSync(targetFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(targetFile, 'utf8'));
  } catch (_) {
    return null;
  }
}

/**
 * Compare two real execution runs (A vs B) deterministically.
 * @param {Object} runA - Baseline run telemetry
 * @param {Object} runB - Candidate run telemetry
 * @returns {any} Comparison report
 */
export function compareTelemetry(runA, runB) {
  if (!runA || !runB) {
    throw new Error('compareTelemetry requires two valid telemetry objects');
  }

  const durationA = runA.totalDurationMs || 1;
  const durationB = runB.totalDurationMs || 1;

  const durationDiffMs = durationB - durationA;
  const speedupRatio = Number((durationA / durationB).toFixed(2));

  const tokensA = runA.tokenUsage?.totalTokens || 0;
  const tokensB = runB.tokenUsage?.totalTokens || 0;
  const tokenDiff = tokensB - tokensA;

  const shardsCountA = Object.keys(runA.shards || {}).length;
  const shardsCountB = Object.keys(runB.shards || {}).length;

  const testsPassedA = runA.verification?.testsPassed || 0;
  const testsTotalA = runA.verification?.testsTotal || 0;
  const passRateA = testsTotalA > 0 ? testsPassedA / testsTotalA : 0;

  const testsPassedB = runB.verification?.testsPassed || 0;
  const testsTotalB = runB.verification?.testsTotal || 0;
  const passRateB = testsTotalB > 0 ? testsPassedB / testsTotalB : 0;

  return {
    runA: {
      id: runA.runId,
      durationMs: durationA,
      totalTokens: tokensA,
      shardsCount: shardsCountA,
      passRate: Number(passRateA.toFixed(2)),
    },
    runB: {
      id: runB.runId,
      durationMs: durationB,
      totalTokens: tokensB,
      shardsCount: shardsCountB,
      passRate: Number(passRateB.toFixed(2)),
    },
    comparison: {
      durationDiffMs,
      speedupRatio,
      tokenDiff,
      passRateDiff: Number((passRateB - passRateA).toFixed(2)),
      faster: durationB < durationA,
      higherQuality: passRateB >= passRateA && (runB.verification?.invariantViolationsCount || 0) === 0,
    },
  };
}
