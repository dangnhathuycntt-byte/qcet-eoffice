import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BudgetTracker,
  DEFAULT_BUDGET_LIMITS,
  ROLE_TURN_LIMITS,
  hasCriticalSecurityFinding,
  extractRootCauseSignature,
  hasIdenticalRootCauseFailure,
  runRepairLoop,
} from '../../scripts/lib/executor-contracts.mjs';

test('budget-enforcement: default limits match Lean V2 specification', () => {
  assert.equal(DEFAULT_BUDGET_LIMITS.maxShardTokens, 80_000);
  assert.equal(DEFAULT_BUDGET_LIMITS.maxRunTokens, 400_000);
  assert.equal(DEFAULT_BUDGET_LIMITS.runBudgetThresholdPct, 0.90);

  assert.equal(ROLE_TURN_LIMITS.builder, 25);
  assert.equal(ROLE_TURN_LIMITS.repair, 20);
  assert.equal(ROLE_TURN_LIMITS.skeptic, 15);
  assert.equal(ROLE_TURN_LIMITS.verifier, 15);
  assert.equal(ROLE_TURN_LIMITS.reconcile, 12);
  assert.equal(ROLE_TURN_LIMITS.recon, 10);
  assert.equal(ROLE_TURN_LIMITS.evaluator, 10);
});

test('budget-enforcement: token exhaustion aborts shard cleanly', async () => {
  const tracker = new BudgetTracker({ maxShardTokens: 50_000, maxRunTokens: 200_000 });
  const shard = { id: 'shard-token-test', owns: ['src/core/**'] };

  tracker.recordUsage({ shardId: shard.id, tokens: 30_000 });
  assert.equal(tracker.isShardExhausted(shard.id), false);

  // Cross shard threshold
  tracker.recordUsage({ shardId: shard.id, tokens: 25_000 });
  assert.equal(tracker.isShardExhausted(shard.id), true);

  let repairCallCount = 0;
  const result = await runRepairLoop({
    shard,
    initialVerification: { verdict: 'fail', issues: [{ title: 'type error', severity: 'medium' }] },
    repairFn: async () => {
      repairCallCount++;
      return { success: true };
    },
    verifyFn: async () => ({ verdict: 'fail' }),
    budgetTracker: tracker,
    maxRounds: 2,
  });

  assert.equal(repairCallCount, 0, 'Repair function must not be invoked when shard budget is exhausted');
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'SHARD_BUDGET_EXHAUSTED');
  assert.ok(result.blocker.includes('Shard token budget exhausted'));
});

test('budget-enforcement: run budget > 90% prevents new shard starts', () => {
  const tracker = new BudgetTracker({ maxRunTokens: 100_000, runBudgetThresholdPct: 0.90 });

  tracker.recordUsage({ shardId: 'shard-1', tokens: 89_000 });
  assert.equal(tracker.isRunThresholdExceeded(), false);
  assert.equal(tracker.canStartNewShard(), true);

  // Reach 91k (> 90%)
  tracker.recordUsage({ shardId: 'shard-1', tokens: 2_000 });
  assert.equal(tracker.isRunThresholdExceeded(), true);
  assert.equal(tracker.canStartNewShard(), false, 'Must prevent starting new shards when run budget > 90%');
});

test('budget-enforcement: 2 consecutive identical failures abort repair loop', async () => {
  const tracker = new BudgetTracker();
  const shard = { id: 'shard-repeat-fail', owns: ['src/api/**'] };

  const identicalIssue = {
    category: 'correctness',
    file: 'src/api/auth.ts',
    title: 'Missing null check in token validation',
    severity: 'high',
  };

  const initialVerification = {
    verdict: 'fail',
    issues: [identicalIssue],
  };

  let repairAttempt = 0;
  const result = await runRepairLoop({
    shard,
    initialVerification,
    repairFn: async ({ round }) => {
      repairAttempt++;
      return {
        status: 'completed',
        summary: `Attempted patch round ${round}`,
      };
    },
    verifyFn: async () => {
      // Returns identical issue on reverify
      return {
        verdict: 'fail',
        issues: [identicalIssue],
      };
    },
    budgetTracker: tracker,
    maxRounds: 3,
  });

  // Repair round 1 runs, reverify returns identical issue -> 2 consecutive identical failures (initial + round 1)
  assert.equal(repairAttempt, 1, 'Should abort immediately after consecutive identical failure without running round 2');
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'CONSECUTIVE_IDENTICAL_FAILURES');
  assert.ok(result.blocker.includes('2 consecutive repair attempts failed for identical root cause'));
});

test('budget-enforcement: critical security finding halts repair immediately', async () => {
  const tracker = new BudgetTracker();
  const shard = { id: 'shard-security-critical', owns: ['src/auth/**'] };

  const criticalSecVerification = {
    verdict: 'fail',
    issues: [
      {
        category: 'auth-security',
        file: 'src/auth/session.ts',
        title: 'Unauthenticated session bypass vulnerability',
        severity: 'critical',
      },
    ],
  };

  assert.equal(hasCriticalSecurityFinding(criticalSecVerification), true);

  let repairInvoked = false;
  const result = await runRepairLoop({
    shard,
    initialVerification: criticalSecVerification,
    repairFn: async () => {
      repairInvoked = true;
      return { success: true };
    },
    verifyFn: async () => ({ verdict: 'pass' }),
    budgetTracker: tracker,
    maxRounds: 2,
  });

  assert.equal(repairInvoked, false, 'Repair must NOT be invoked on critical security finding');
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'CRITICAL_SECURITY_HALT');
  assert.ok(result.blocker.includes('Critical security failure'));
});
