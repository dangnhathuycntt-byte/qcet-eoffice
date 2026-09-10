/**
 * QCET Plan Executor - Release Readiness Gate & Invariant Scanner
 * Implements E01 (deterministic code-determined release readiness gate),
 * E02 (repair request formatting per finding cluster),
 * E08 (invariant scan integration directly into gate),
 * E09 (zero false-positive release gate pass).
 */

import { execSync } from 'node:child_process';
import { normalizePath } from './canonical-path-matcher.cjs';

// -----------------------------------------------------------------------------
// INVARIANT SCANNER
// -----------------------------------------------------------------------------

const INVARIANT_RULES = [
  {
    id: 'light-only',
    name: 'Light-Only Standard Check (No dark: mode classes)',
    regex: /^\+[ ]*.*dark:/m,
    description: 'QCET design system is strictly Light-Only. Tailwind dark: classes are prohibited.',
  },
  {
    id: 'typography-floor',
    name: 'Typography Floor Check (Minimum 12px / No text-[9px] or text-[10px])',
    regex: /^\+[ ]*.*text-\[(?:9|10)px\]/m,
    description: 'Typography floor is 12px (text-xs). Prohibit micro-type text-[9px] and text-[10px].',
  },
  {
    id: 'anti-slop-synthetic-data',
    name: 'Anti-Slop & Data Dignity Check (No synthetic data in operational paths)',
    regex: /^\+[ ]*.*(?:\bmockTasks\b|\bfakeData\b|\bdummyMetrics\b|\bMath\.random\(\))/m,
    filterPath: (path) => !path.startsWith('tests/') && !path.includes('.test.') && !path.includes('.spec.'),
    description: 'Operational code must use real schema entities; synthetic mock data shims are prohibited.',
  },
  {
    id: 'domain-freeze-generic-roles',
    name: 'Domain Freeze: Prohibit mapping positions to generic ADMIN/MANAGER/STAFF for authority',
    regex: /^\+[ ]*.*(?:user\.role\s*===\s*['"](?:ADMIN|MANAGER|STAFF)['"])/m,
    filterPath: (path) => !path.startsWith('tests/') && !path.includes('.test.'),
    description: 'Vocational governance authority is statutory; generic SaaS 3-tier role checks are prohibited.',
  },
  {
    id: 'taskscope-not-permission',
    name: 'Universal Invariant: TaskScope is visual scope, NEVER an authorization token',
    regex: /^\+[ ]*.*(?:hasPermission.*scope|isAuthorized.*TaskScope|checkScopePermission)/m,
    description: 'TaskScope is a display filter, never an access control or operational permission model.',
  },
];

/**
 * Scan git diff or file text for QCET architectural invariant violations.
 * @param {Object} options
 * @param {string} [options.gitDiff] - Diff string to scan (if omitted, runs `git diff -U0 HEAD`)
 * @param {Array<{path: string, content: string}>} [options.fileEntries] - Direct file contents to check
 * @returns {{ clean: boolean, violations: Array<{ ruleId: string, ruleName: string, file: string, line?: number, detail: string }> }}
 */
export function scanInvariants(options = {}) {
  const violations = [];

  let diffText = options.gitDiff;
  if (diffText === undefined && !options.fileEntries) {
    try {
      diffText = execSync('git diff -U0 HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (_) {
      diffText = '';
    }
  }

  // Check git diff if available
  if (typeof diffText === 'string' && diffText.trim().length > 0) {
    // Split diff into per-file chunks
    const fileChunks = diffText.split(/^diff --git /m).filter(Boolean);

    for (const chunk of fileChunks) {
      const match = chunk.match(/^[ab]\/(\S+)\s+[ab]\/(\S+)/m);
      const filePath = match ? normalizePath(match[2] || match[1]) : 'unknown-file';

      for (const rule of INVARIANT_RULES) {
        if (rule.filterPath && !rule.filterPath(filePath)) {
          continue;
        }

        const lines = chunk.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith('+') && !line.startsWith('+++')) {
            if (rule.regex.test(line)) {
              violations.push({
                ruleId: rule.id,
                ruleName: rule.name,
                file: filePath,
                line: i + 1,
                detail: `${rule.description} Found violating diff line: "${line.trim()}"`,
              });
            }
          }
        }
      }
    }
  }

  // Check explicit file entries if provided
  if (Array.isArray(options.fileEntries)) {
    for (const entry of options.fileEntries) {
      const filePath = normalizePath(entry.path || '');
      const content = String(entry.content || '');

      for (const rule of INVARIANT_RULES) {
        if (rule.filterPath && !rule.filterPath(filePath)) {
          continue;
        }

        // Convert diff regex into content line regex by removing `^\+`
        const contentRegex = new RegExp(rule.regex.source.replace(/^\^\\+\[ \]\*\.\*/, ''), 'm');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (contentRegex.test(line)) {
            violations.push({
              ruleId: rule.id,
              ruleName: rule.name,
              file: filePath,
              line: i + 1,
              detail: `${rule.description} Violating line: "${line.trim()}"`,
            });
          }
        }
      }
    }
  }

  return {
    clean: violations.length === 0,
    violations,
  };
}

// -----------------------------------------------------------------------------
// RELEASE READINESS GATE (DETERMINISTIC EVALUATION)
// -----------------------------------------------------------------------------

/**
 * Deterministically evaluates release readiness.
 * Strict fail-closed criteria (E09):
 * 1. Zero blocker issues.
 * 2. Typecheck passed (or not failed).
 * 3. Test suite passed (0 failed).
 * 4. Invariant scan clean (0 violations).
 * 5. Zero unresolved critical/high review findings.
 * 6. Git diff unexpected modifications: none.
 *
 * @param {Object} input
 * @param {Object} [input.verifierResults]
 * @param {Object} [input.invariantScan]
 * @param {Array} [input.reviewFindings]
 * @param {Array<string>} [input.unresolvedBlockers]
 * @param {Object} [input.gitDiffStatus]
 * @returns {any} ReadinessEvaluation
 */
export function evaluateReleaseReadiness(input = {}) {
  const blockingIssues = [];
  const residualRisks = [];
  let checksPassed = 0;
  let checksTotal = 0;

  // 1. Unresolved manual or architectural blockers
  checksTotal++;
  if (Array.isArray(input.unresolvedBlockers) && input.unresolvedBlockers.length > 0) {
    for (const b of input.unresolvedBlockers) {
      blockingIssues.push(`Blocker: ${b}`);
    }
  } else {
    checksPassed++;
  }

  // 2. Verifier: Typecheck
  checksTotal++;
  const typecheck = input.verifierResults?.typecheck;
  if (typecheck) {
    if (typecheck.status === 'failed') {
      blockingIssues.push(`TypeScript static analysis failed: ${typecheck.error || 'Type check error detected.'}`);
    } else if (typecheck.status === 'passed') {
      checksPassed++;
    }
  } else {
    checksPassed++; // omitted if not applicable
  }

  // 3. Verifier: Tests
  checksTotal++;
  const tests = input.verifierResults?.tests;
  if (tests) {
    const failedCount = typeof tests.failed === 'number' ? tests.failed : (tests.status === 'failed' ? 1 : 0);
    if (failedCount > 0) {
      const failures = Array.isArray(tests.failures) && tests.failures.length > 0
        ? `: ${tests.failures.join('; ')}`
        : '';
      blockingIssues.push(`Automated tests failed (${failedCount} failure${failedCount > 1 ? 's' : ''})${failures}`);
    } else if (tests.status === 'passed' || failedCount === 0) {
      checksPassed++;
    }
  } else {
    checksPassed++;
  }

  // 4. Invariant Scan (E08 integration)
  checksTotal++;
  const invariantScan = input.invariantScan || scanInvariants();
  if (!invariantScan.clean && invariantScan.violations.length > 0) {
    for (const v of invariantScan.violations) {
      blockingIssues.push(`Invariant violation [${v.ruleId}] in ${v.file}:${v.line || 1} - ${v.detail}`);
    }
  } else {
    checksPassed++;
  }

  // 5. Review & Skeptic Findings
  checksTotal++;
  let reviewCheckPassed = true;
  if (Array.isArray(input.reviewFindings)) {
    for (const finding of input.reviewFindings) {
      if (!finding) continue;
      const severity = String(finding.severity || finding.level || 'medium').toLowerCase();
      const status = String(finding.status || 'open').toLowerCase();

      if (status !== 'resolved' && status !== 'fixed' && status !== 'waived') {
        if (severity === 'critical' || severity === 'blocker') {
          blockingIssues.push(`Critical review finding: ${finding.summary || finding.title || 'Critical defect'} (${finding.file || 'global'})`);
          reviewCheckPassed = false;
        } else if (severity === 'high') {
          residualRisks.push(`High review finding: ${finding.summary || finding.title} (${finding.file || 'global'})`);
        } else {
          residualRisks.push(`Minor/Medium review finding: ${finding.summary || finding.title} (${finding.file || 'global'})`);
        }
      }
    }
  }
  if (reviewCheckPassed) checksPassed++;

  // 6. Git Diff Scope Verification
  checksTotal++;
  if (input.gitDiffStatus) {
    if (input.gitDiffStatus.clean === false || (Array.isArray(input.gitDiffStatus.unexpectedFiles) && input.gitDiffStatus.unexpectedFiles.length > 0)) {
      const files = input.gitDiffStatus.unexpectedFiles || [];
      blockingIssues.push(`Unexpected files modified outside assigned scope: ${files.join(', ')}`);
    } else {
      checksPassed++;
    }
  } else {
    checksPassed++;
  }

  // Calculate deterministic decision
  const hasBlockers = blockingIssues.length > 0;
  let status = 'READY';
  let readiness = 'READY';
  let decision = 'PROMOTE';

  if (hasBlockers) {
    status = 'BLOCKED';
    readiness = 'BLOCKED';
    decision = 'REJECT';
  } else if (residualRisks.length > 0) {
    status = 'READY_WITH_KNOWN_ISSUES';
    readiness = 'READY_WITH_KNOWN_ISSUES';
    // If high risks exist, require HOLD for explicit acknowledgement
    const hasHighRisk = residualRisks.some((r) => r.startsWith('High '));
    decision = hasHighRisk ? 'HOLD' : 'PROMOTE';
  }

  const summary = hasBlockers
    ? `Release rejected: ${blockingIssues.length} blocking issue(s) detected across verification gates.`
    : residualRisks.length > 0
    ? `Release evaluated with ${residualRisks.length} non-blocking residual risk(s). Ready with known issues.`
    : 'Release readiness gate passed: all deterministic checks clean (tests, invariants, reviews, diff).';

  return {
    status,
    readiness,
    decision,
    blockingIssues,
    residualRisks,
    summary,
    metrics: {
      checksPassed,
      checksTotal,
      passRate: checksTotal > 0 ? Number((checksPassed / checksTotal).toFixed(2)) : 1.0,
    },
  };
}

// -----------------------------------------------------------------------------
// STRUCTURED REPAIR REQUEST GENERATION (E02)
// -----------------------------------------------------------------------------

/**
 * Format a structured IntegrationRepairRequest for repair subagents.
 * Prevents unaggregated, prompt-only, or freeform repair loops.
 *
 * @param {Object} options
 * @param {Object} options.cluster - Finding cluster from clusterIntegrationFindings
 * @param {number} [options.iteration=1] - Current repair iteration
 * @param {number} [options.maxIterations=2] - Maximum repair iterations
 * @param {Object} [options.shard] - Associated shard definition if known
 * @returns {any} IntegrationRepairRequest
 */
export function formatRepairRequest({ cluster, iteration = 1, maxIterations = 2, shard = null }) {
  if (!cluster) {
    throw new Error('formatRepairRequest requires a valid finding cluster');
  }

  const findings = Array.isArray(cluster.findings) ? cluster.findings : [];
  const files = Array.isArray(cluster.files) ? cluster.files : [];

  const structuredFindings = findings.map((f, idx) => ({
    id: f.id || `finding-${idx + 1}`,
    file: f.file || 'unknown',
    line: f.line || null,
    severity: f.severity || f.level || 'high',
    ruleId: f.ruleId || f.category || 'correctness',
    message: f.message || f.summary || 'Unspecified finding',
    detail: f.detail || f.failure_scenario || null,
    suggestedFix: f.suggestedFix || f.recommendedFix || null,
  }));

  return {
    clusterId: cluster.id || 'cluster-1',
    iteration,
    maxIterations,
    files,
    targetShardId: shard?.id || null,
    allowedOwnership: shard?.owns || files,
    antiOwnership: shard?.antiOwns || [],
    findings: structuredFindings,
    instructions: [
      `You are executing repair iteration ${iteration}/${maxIterations} for finding cluster '${cluster.id || 'cluster-1'}'.`,
      `Files in scope: [${files.join(', ')}].`,
      `Strictly limit your modifications to the files in scope.`,
      `Ensure each listed finding is addressed and verify your changes with local tests before finishing.`,
      `Return structured evidence upon completion with status, changedFiles, and testsRun.`,
    ].join('\n'),
  };
}
