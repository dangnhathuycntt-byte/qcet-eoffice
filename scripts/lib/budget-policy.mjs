/**
 * QCET Plan Executor - Hard Budget and Early Termination Policy
 *
 * Implements Lean V2 budget governance:
 * - Hard turn caps per role/phase
 * - Hard token budgets per shard (default 80k) and per run (default 400k)
 * - Early termination on critical security findings
 * - Early termination on 2 consecutive identical root-cause repair failures
 * - Gating against new shard builder attempts when run budget > 90%
 */

export const ROLE_TURN_LIMITS = Object.freeze({
  builder: 25,
  repair: 20,
  skeptic: 15,
  verifier: 15,
  reconcile: 12,
  recon: 10,
  evaluator: 10,
});

export const DEFAULT_BUDGET_LIMITS = Object.freeze({
  maxShardTokens: 80_000,
  maxRunTokens: 400_000,
  runBudgetThresholdPct: 0.90,
  roleTurnLimits: ROLE_TURN_LIMITS,
});

export class BudgetTracker {
  constructor(options = {}) {
    this.maxShardTokens = Number(options.maxShardTokens ?? DEFAULT_BUDGET_LIMITS.maxShardTokens);
    this.maxRunTokens = Number(options.maxRunTokens ?? DEFAULT_BUDGET_LIMITS.maxRunTokens);
    this.runBudgetThresholdPct = Number(
      options.runBudgetThresholdPct ?? DEFAULT_BUDGET_LIMITS.runBudgetThresholdPct
    );
    this.roleTurnLimits = { ...ROLE_TURN_LIMITS, ...(options.roleTurnLimits || {}) };

    this.tokensSpentTotal = 0;
    this.tokensSpentByShard = new Map();
    this.tokensSpentByAgent = new Map();
    this.turnsByAgent = new Map();
  }

  recordUsage({ shardId, agentId, role, turns = 0, tokens = 0 }) {
    const t = Number(tokens) || 0;
    this.tokensSpentTotal += t;

    if (shardId) {
      const currentShardTokens = this.tokensSpentByShard.get(shardId) || 0;
      this.tokensSpentByShard.set(shardId, currentShardTokens + t);
    }

    if (agentId) {
      const currentAgentTokens = this.tokensSpentByAgent.get(agentId) || 0;
      this.tokensSpentByAgent.set(agentId, currentAgentTokens + t);

      const currentAgentTurns = this.turnsByAgent.get(agentId) || 0;
      this.turnsByAgent.set(agentId, currentAgentTurns + (Number(turns) || 0));
    }
  }

  getShardTokens(shardId) {
    return this.tokensSpentByShard.get(shardId) || 0;
  }

  getTotalTokens() {
    return this.tokensSpentTotal;
  }

  isShardExhausted(shardId) {
    if (!shardId) return false;
    return this.getShardTokens(shardId) >= this.maxShardTokens;
  }

  isRunExhausted() {
    return this.tokensSpentTotal >= this.maxRunTokens;
  }

  isRunThresholdExceeded(thresholdPct = this.runBudgetThresholdPct) {
    return this.tokensSpentTotal >= this.maxRunTokens * thresholdPct;
  }

  canStartNewShard() {
    return !this.isRunThresholdExceeded() && !this.isRunExhausted();
  }

  getRoleTurnLimit(role) {
    return this.roleTurnLimits[role] ?? 25;
  }

  isTurnLimitExceeded(role, turns) {
    const limit = this.getRoleTurnLimit(role);
    return turns > limit;
  }
}

/**
 * Detects if a verification result contains a critical security finding.
 */
export function hasCriticalSecurityFinding(verification) {
  if (!verification || !Array.isArray(verification.issues)) return false;
  return verification.issues.some((issue) => {
    if (!issue) return false;
    const severity = String(issue.severity || '').toLowerCase();
    const category = String(issue.category || '').toLowerCase();
    const title = String(issue.title || issue.description || issue.id || '').toLowerCase();

    const isCritical = severity === 'critical' || issue.isSecurityCritical === true;
    const isSecurityRelated =
      category.includes('security') ||
      category.includes('auth') ||
      category.includes('rbac') ||
      title.includes('unauthenticated') ||
      title.includes('unauthorized') ||
      title.includes('secret leak');

    return isCritical && isSecurityRelated;
  });
}

/**
 * Extracts a deterministic signature for an issue or failure root cause.
 */
export function extractRootCauseSignature(failure) {
  if (!failure) return '';
  if (typeof failure === 'string') return failure.trim().toLowerCase();

  if (failure.rootCause) {
    return String(failure.rootCause).trim().toLowerCase();
  }

  if (Array.isArray(failure.issues) && failure.issues.length > 0) {
    return failure.issues
      .map((i) => `${i.category || ''}:${i.file || ''}:${i.title || i.id || ''}`)
      .sort()
      .join('|')
      .toLowerCase();
  }

  if (failure.blocker || failure.error || failure.message) {
    return String(failure.blocker || failure.error || failure.message).trim().toLowerCase();
  }

  return JSON.stringify(failure);
}

/**
 * Returns true if the last 2 failures share the exact same root cause signature.
 */
export function hasIdenticalRootCauseFailure(failures) {
  if (!Array.isArray(failures) || failures.length < 2) return false;
  const f1 = failures[failures.length - 2];
  const f2 = failures[failures.length - 1];
  const sig1 = extractRootCauseSignature(f1);
  const sig2 = extractRootCauseSignature(f2);
  return Boolean(sig1 && sig2 && sig1 === sig2);
}

/**
 * Canonical repair loop with hard budgets and deterministic early termination.
 */
export async function runRepairLoop({
  shard,
  initialVerification,
  repairFn,
  verifyFn,
  budgetTracker,
  maxRounds = 2,
  log = console.log,
}) {
  const shardId = shard?.id || 'unknown-shard';

  // 1. Critical security finding check -> halt immediately
  if (hasCriticalSecurityFinding(initialVerification)) {
    log(`[budget-policy] Shard '${shardId}' halted: critical security finding detected. Skipping repair loop.`);
    return {
      status: 'blocked',
      reason: 'CRITICAL_SECURITY_HALT',
      blocker: `Critical security failure detected in verification. Shard marked BLOCKED(security).`,
      shardId,
      repairRounds: 0,
      lastVerification: initialVerification,
    };
  }

  let currentVerification = initialVerification;
  let repairRound = 0;
  const failureHistory = [initialVerification];

  while (repairRound < maxRounds) {
    repairRound++;

    // 2. Shard budget check before invoking repair
    if (budgetTracker && budgetTracker.isShardExhausted(shardId)) {
      log(`[budget-policy] Shard '${shardId}' token budget exhausted (${budgetTracker.getShardTokens(shardId)} >= ${budgetTracker.maxShardTokens}). Halting repair.`);
      return {
        status: 'blocked',
        reason: 'SHARD_BUDGET_EXHAUSTED',
        blocker: `Shard token budget exhausted (${budgetTracker.getShardTokens(shardId)} >= ${budgetTracker.maxShardTokens}).`,
        shardId,
        repairRounds: repairRound - 1,
        lastVerification: currentVerification,
      };
    }

    log(`[budget-policy] Executing repair round ${repairRound} for shard '${shardId}'`);
    const repairResult = await repairFn({ shard, round: repairRound, previousVerification: currentVerification });

    if (!repairResult || repairResult.status === 'blocked' || repairResult.success === false) {
      failureHistory.push(repairResult || { blocker: 'Repair returned failure or null' });
      if (hasIdenticalRootCauseFailure(failureHistory)) {
        log(`[budget-policy] Shard '${shardId}' aborted: 2 consecutive repair attempts failed for the same root cause.`);
        return {
          status: 'blocked',
          reason: 'CONSECUTIVE_IDENTICAL_FAILURES',
          blocker: `2 consecutive repair attempts failed for identical root cause: ${extractRootCauseSignature(repairResult)}`,
          shardId,
          repairRounds: repairRound,
          lastVerification: currentVerification,
        };
      }
    }

    // Reverification
    currentVerification = await verifyFn({ shard, round: repairRound, repairResult });
    if (currentVerification?.verdict === 'pass') {
      return {
        status: 'repaired',
        repairRounds: repairRound,
        lastVerification: currentVerification,
      };
    }

    failureHistory.push(currentVerification);

    // 3. Early termination: check for 2 consecutive identical root-cause failures
    if (hasIdenticalRootCauseFailure(failureHistory)) {
      log(`[budget-policy] Shard '${shardId}' aborted: 2 consecutive verification failures for the same root cause.`);
      return {
        status: 'blocked',
        reason: 'CONSECUTIVE_IDENTICAL_FAILURES',
        blocker: `2 consecutive repair attempts failed for identical root cause: ${extractRootCauseSignature(currentVerification)}`,
        shardId,
        repairRounds: repairRound,
        lastVerification: currentVerification,
      };
    }
  }

  return {
    status: 'failed',
    reason: 'MAX_REPAIR_ROUNDS_EXCEEDED',
    blocker: `Repair loop completed ${repairRound} rounds without achieving pass verdict.`,
    shardId,
    repairRounds: repairRound,
    lastVerification: currentVerification,
  };
}
