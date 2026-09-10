import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  gradeExecution,
  gradeBenchmark,
  getRepoRoot,
} from '../../scripts/lib/executor-contracts.mjs';

function loadFixture(filename: string) {
  const filePath = path.join(getRepoRoot(), 'tests/fixtures/eval-cases', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('eval-grader: grades clean execution with full score', () => {
  const manifest = loadFixture('case-2-parallel-disjoint.json');
  const telemetry = {
    runId: 'eval-clean-run',
    totalDurationMs: 1500,
    shards: {
      'shard-user-service': { status: 'completed' },
      'shard-document-router': { status: 'completed' },
    },
    verification: {
      typecheckPassed: true,
      testsPassed: 20,
      testsFailed: 0,
      invariantViolationsCount: 0,
      releaseDecision: 'PROMOTE',
    },
  };

  const result = gradeExecution(telemetry, manifest);
  assert.equal(result.passed, true);
  assert.equal(result.score, 100);
  assert.equal(result.grade, 'A');
  assert.equal(result.checks.manifestCoverage, true);
  assert.equal(result.checks.manifestOwnership, true);
});

test('eval-grader: catches fatal error if release gate promotes code with invariant violations', () => {
  const manifest = loadFixture('case-1-single-shard.json');
  const telemetry = {
    runId: 'eval-bad-promotion',
    totalDurationMs: 1200,
    shards: {
      'shard-auth-helper': { status: 'completed' },
    },
    verification: {
      typecheckPassed: true,
      testsPassed: 10,
      testsFailed: 0,
      invariantViolationsCount: 2, // Dark mode violation!
      releaseDecision: 'PROMOTE', // Disallowed promotion!
    },
  };

  const result = gradeExecution(telemetry, manifest);
  assert.equal(result.passed, false);
  assert.equal(result.score, 0);
  assert.equal(result.grade, 'F');
  assert.ok(result.failures.some((f) => f.includes('FATAL: Release gate PROMOTED')));
});

test('eval-grader: passes if release gate correctly rejects code with invariant violations', () => {
  const manifest = loadFixture('case-4-invariant-violation.json');
  const telemetry = {
    runId: 'eval-rejected-run',
    totalDurationMs: 1200,
    shards: {
      'shard-bad-ui': { status: 'completed' },
    },
    verification: {
      typecheckPassed: true,
      testsPassed: 5,
      testsFailed: 0,
      invariantViolationsCount: 3,
      releaseDecision: 'REJECT', // Honest rejection!
    },
  };

  const result = gradeExecution(telemetry, manifest);
  assert.equal(result.checks.releaseGateHonest, true);
});

test('eval-grader: gradeBenchmark validates speedup and quality parity', () => {
  const manifest = loadFixture('case-2-parallel-disjoint.json');
  const baseline = {
    runId: 'base',
    totalDurationMs: 3000,
    shards: {
      'shard-user-service': { status: 'completed' },
      'shard-document-router': { status: 'completed' },
    },
    verification: {
      typecheckPassed: true,
      testsPassed: 10,
      testsFailed: 0,
      invariantViolationsCount: 0,
      releaseDecision: 'PROMOTE',
    },
  };

  const candidate = {
    runId: 'cand',
    totalDurationMs: 1500, // 2x faster
    shards: {
      'shard-user-service': { status: 'completed' },
      'shard-document-router': { status: 'completed' },
    },
    verification: {
      typecheckPassed: true,
      testsPassed: 10,
      testsFailed: 0,
      invariantViolationsCount: 0,
      releaseDecision: 'PROMOTE',
    },
  };

  const benchmark = gradeBenchmark(baseline, candidate, manifest);
  assert.equal(benchmark.speedupRatio, 2.0);
  assert.equal(benchmark.achievesTargetSpeedup, true);
  assert.equal(benchmark.passesQualityGate, true);
  assert.equal(benchmark.overallSuccess, true);
});
