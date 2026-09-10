import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scanInvariants,
  evaluateReleaseReadiness,
  formatRepairRequest,
} from '../../scripts/lib/executor-contracts.mjs';

test('release-readiness: scanInvariants detects dark: mode classes in diff', () => {
  const fakeDiff = `
diff --git a/src/components/button.tsx b/src/components/button.tsx
--- a/src/components/button.tsx
+++ b/src/components/button.tsx
@@ -10,1 +10,1 @@
+ <button className="bg-white dark:bg-black text-black">Click</button>
`;
  const result = scanInvariants({ gitDiff: fakeDiff });
  assert.equal(result.clean, false);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].ruleId, 'light-only');
  assert.equal(result.violations[0].file, 'src/components/button.tsx');
});

test('release-readiness: scanInvariants detects text-[9px] and text-[10px]', () => {
  const fakeDiff = `
diff --git a/src/components/badge.tsx b/src/components/badge.tsx
--- a/src/components/badge.tsx
+++ b/src/components/badge.tsx
@@ -5,1 +5,1 @@
+ <span className="text-[9px] font-bold">New</span>
`;
  const result = scanInvariants({ gitDiff: fakeDiff });
  assert.equal(result.clean, false);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].ruleId, 'typography-floor');
});

test('release-readiness: scanInvariants detects synthetic data in operational paths but ignores tests', () => {
  const operationalDiff = `
diff --git a/src/lib/services/tasks.ts b/src/lib/services/tasks.ts
--- a/src/lib/services/tasks.ts
+++ b/src/lib/services/tasks.ts
@@ -12,1 +12,1 @@
+ const tasks = mockTasks || [];
`;
  const opResult = scanInvariants({ gitDiff: operationalDiff });
  assert.equal(opResult.clean, false);
  assert.equal(opResult.violations.length, 1);
  assert.equal(opResult.violations[0].ruleId, 'anti-slop-synthetic-data');

  const testDiff = `
diff --git a/tests/unit/tasks.test.ts b/tests/unit/tasks.test.ts
--- a/tests/unit/tasks.test.ts
+++ b/tests/unit/tasks.test.ts
@@ -12,1 +12,1 @@
+ const tasks = mockTasks || [];
`;
  const testResult = scanInvariants({ gitDiff: testDiff });
  assert.equal(testResult.clean, true);
  assert.equal(testResult.violations.length, 0);
});

test('release-readiness: evaluateReleaseReadiness rejects on typecheck failure', () => {
  const result = evaluateReleaseReadiness({
    verifierResults: {
      typecheck: { status: 'failed', error: 'TS2322: Type mismatch' },
      tests: { status: 'passed', failed: 0 },
    },
    invariantScan: { clean: true, violations: [] },
  });

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.decision, 'REJECT');
  assert.ok(result.blockingIssues.some((b: any) => b.includes('TypeScript static analysis failed')));
});

test('release-readiness: evaluateReleaseReadiness rejects on test failures', () => {
  const result = evaluateReleaseReadiness({
    verifierResults: {
      typecheck: { status: 'passed' },
      tests: { status: 'failed', failed: 2, failures: ['test A', 'test B'] },
    },
    invariantScan: { clean: true, violations: [] },
  });

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.decision, 'REJECT');
  assert.ok(result.blockingIssues.some((b: any) => b.includes('Automated tests failed (2 failures)')));
});

test('release-readiness: evaluateReleaseReadiness rejects on invariant violations', () => {
  const result = evaluateReleaseReadiness({
    verifierResults: {
      typecheck: { status: 'passed' },
      tests: { status: 'passed', failed: 0 },
    },
    invariantScan: {
      clean: false,
      violations: [
        {
          ruleId: 'light-only',
          ruleName: 'Light-Only Check',
          file: 'src/app/page.tsx',
          detail: 'dark: class used',
        },
      ],
    },
  });

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.decision, 'REJECT');
  assert.ok(result.blockingIssues.some((b: any) => b.includes('Invariant violation [light-only]')));
});

test('release-readiness: evaluateReleaseReadiness rejects on critical review finding', () => {
  const result = evaluateReleaseReadiness({
    verifierResults: {
      typecheck: { status: 'passed' },
      tests: { status: 'passed', failed: 0 },
    },
    invariantScan: { clean: true, violations: [] },
    reviewFindings: [
      {
        severity: 'critical',
        status: 'open',
        summary: 'SQL injection possible in unescaped query parameter',
        file: 'src/server/db.ts',
      },
    ],
  });

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.decision, 'REJECT');
  assert.ok(result.blockingIssues.some((b: any) => b.includes('Critical review finding')));
});

test('release-readiness: evaluateReleaseReadiness promotes when all checks pass clean', () => {
  const result = evaluateReleaseReadiness({
    verifierResults: {
      typecheck: { status: 'passed' },
      tests: { status: 'passed', failed: 0 },
    },
    invariantScan: { clean: true, violations: [] },
    reviewFindings: [],
  });

  assert.equal(result.status, 'READY');
  assert.equal(result.decision, 'PROMOTE');
  assert.equal(result.blockingIssues.length, 0);
  assert.equal(result.residualRisks.length, 0);
});

test('release-readiness: formatRepairRequest produces structured payload', () => {
  const cluster = {
    id: 'cluster-auth',
    files: ['src/server/auth/session.ts', 'src/server/auth/token.ts'],
    findings: [
      {
        id: 'f-1',
        file: 'src/server/auth/session.ts',
        line: 45,
        severity: 'high',
        summary: 'Session token expiration not enforced on refresh',
      },
    ],
  };

  const request = formatRepairRequest({
    cluster,
    iteration: 1,
    maxIterations: 2,
    shard: {
      id: 'shard-auth',
      owns: ['src/server/auth/**'],
      antiOwns: ['src/server/db/**'],
    },
  });

  assert.equal(request.clusterId, 'cluster-auth');
  assert.equal(request.iteration, 1);
  assert.equal(request.maxIterations, 2);
  assert.deepEqual(request.files, ['src/server/auth/session.ts', 'src/server/auth/token.ts']);
  assert.equal(request.targetShardId, 'shard-auth');
  assert.equal(request.findings.length, 1);
  assert.equal(request.findings[0].severity, 'high');
  assert.ok(request.instructions.includes('repair iteration 1/2'));
});
