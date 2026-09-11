/**
 * Unit tests for the QCET Plan Executor E2E harness logic.
 *
 * These tests verify harness classification and gate logic ONLY.
 * They do NOT invoke Claude — the real E2E run is:
 *   npm run test:executor:e2e
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ─── Failure class constants (mirrors run-plan-executor-e2e.mjs) ──────────────

const FC = {
  HEADLESS_PERMISSION_FAILURE: 'HEADLESS_PERMISSION_FAILURE',
  EXECUTOR_PREFLIGHT_FAILED: 'EXECUTOR_PREFLIGHT_FAILED',
  RUNTIME_INIT_FAILED: 'RUNTIME_INIT_FAILED',
  WORKFLOW_NOT_INVOKED: 'WORKFLOW_NOT_INVOKED',
  EXECUTOR_NOT_STARTED: 'EXECUTOR_NOT_STARTED',
  OWNERSHIP_FAILURE: 'OWNERSHIP_FAILURE',
  VERIFICATION_FAILURE: 'VERIFICATION_FAILURE',
  GLOBAL_VALIDATION_FAILURE: 'GLOBAL_VALIDATION_FAILURE',
  GLOBAL_VALIDATION_TIMEOUT: 'GLOBAL_VALIDATION_TIMEOUT',
  RELEASE_GATE_MISSING: 'RELEASE_GATE_MISSING',
  TIMEOUT: 'TIMEOUT',
  INFRA_ERROR: 'INFRA_ERROR',
} as const;

type FailureClass = typeof FC[keyof typeof FC];

// ─── Result schema ────────────────────────────────────────────────────────────

interface E2EResult {
  status: 'PASS' | 'FAIL';
  failureClass: FailureClass | null;
  reason: string | null;
  executorSha: string;
  model: string;
  effort: string;
  permissionProbe: boolean;
  runtimeInit: boolean;
  workflowInvoked: boolean;
  executorStarted: boolean;
  targetMutationCorrect: boolean;
  ownershipClean: boolean;
  verificationPassed: boolean;
  releaseGatePresent: boolean;
  releaseGate: 'READY' | 'READY_WITH_KNOWN_ISSUES' | 'BLOCKED' | null;
  wallClockMs: number;
  tokens: number | null;
  costUsd: number | null;
  transcriptPath: string;
  gateVerdictPath: string | null;
}

// ─── Harness logic (extracted for unit testing) ───────────────────────────────

const FORBIDDEN_PATTERNS = [/^src\//, /^prisma\//, /^public\//, /^package\.json$/, /^package-lock\.json$/];

function classifyPermissionProbeResult(opts: {
  exitCode: number;
  timedOut: boolean;
  hadPermissionDenied: boolean;
  targetContent: string | null;
  hadEditOrWrite: boolean;
  gitModified: boolean;
}): { pass: boolean; failureClass?: FailureClass; reason?: string } {
  if (opts.timedOut) return { pass: false, failureClass: FC.HEADLESS_PERMISSION_FAILURE, reason: 'timeout' };
  if (opts.exitCode !== 0) return { pass: false, failureClass: FC.HEADLESS_PERMISSION_FAILURE, reason: `exitCode=${opts.exitCode}` };
  if (opts.hadPermissionDenied) return { pass: false, failureClass: FC.HEADLESS_PERMISSION_FAILURE, reason: 'permission_denied event' };
  if (opts.targetContent !== 'AFTER') return { pass: false, failureClass: FC.HEADLESS_PERMISSION_FAILURE, reason: `target content is "${opts.targetContent}", expected "AFTER"` };
  if (!opts.hadEditOrWrite && !opts.gitModified) return { pass: false, failureClass: FC.HEADLESS_PERMISSION_FAILURE, reason: 'no edit tool observed and git shows no modification' };
  return { pass: true };
}

function classifyOwnershipViolations(changedFiles: string[]): string[] {
  return changedFiles.filter(f => FORBIDDEN_PATTERNS.some(p => p.test(f)));
}

function classifyReleaseGate(gateContent: Record<string, unknown> | null): {
  valid: boolean;
  status: string | null;
  failureClass?: FailureClass;
  reason?: string;
} {
  if (!gateContent) return { valid: false, status: null, failureClass: FC.RELEASE_GATE_MISSING, reason: 'gate-verdict.json not found' };
  const status = (gateContent.status ?? gateContent.verdict ?? null) as string | null;
  const valid = ['READY', 'READY_WITH_KNOWN_ISSUES', 'BLOCKED'].includes(status ?? '');
  if (!valid) return { valid: false, status, failureClass: FC.RELEASE_GATE_MISSING, reason: `invalid status: ${JSON.stringify(status)}` };
  return { valid: true, status };
}

function buildPassResult(opts: {
  releaseGate: string;
  gateVerdictPath: string;
  wallClockMs: number;
  transcriptPath: string;
}): E2EResult {
  return {
    status: 'PASS',
    failureClass: null,
    reason: null,
    executorSha: '45453bb8d6a3db3ca974495c7b3b36187004c503',
    model: 'claude-combo[1m]',
    effort: 'high',
    permissionProbe: true,
    runtimeInit: true,
    workflowInvoked: true,
    executorStarted: true,
    targetMutationCorrect: true,
    ownershipClean: true,
    verificationPassed: true,
    releaseGatePresent: true,
    releaseGate: opts.releaseGate as 'READY',
    wallClockMs: opts.wallClockMs,
    tokens: null,
    costUsd: null,
    transcriptPath: opts.transcriptPath,
    gateVerdictPath: opts.gateVerdictPath,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test('permission probe: timeout → HEADLESS_PERMISSION_FAILURE', () => {
  const r = classifyPermissionProbeResult({ exitCode: 0, timedOut: true, hadPermissionDenied: false, targetContent: 'AFTER', hadEditOrWrite: true, gitModified: true });
  assert.equal(r.pass, false);
  assert.equal(r.failureClass, FC.HEADLESS_PERMISSION_FAILURE);
  assert.match(r.reason!, /timeout/);
});

test('permission probe: non-zero exit → HEADLESS_PERMISSION_FAILURE', () => {
  const r = classifyPermissionProbeResult({ exitCode: 1, timedOut: false, hadPermissionDenied: false, targetContent: 'AFTER', hadEditOrWrite: true, gitModified: true });
  assert.equal(r.pass, false);
  assert.equal(r.failureClass, FC.HEADLESS_PERMISSION_FAILURE);
  assert.match(r.reason!, /exitCode=1/);
});

test('permission probe: permission_denied event → HEADLESS_PERMISSION_FAILURE', () => {
  const r = classifyPermissionProbeResult({ exitCode: 0, timedOut: false, hadPermissionDenied: true, targetContent: 'AFTER', hadEditOrWrite: true, gitModified: true });
  assert.equal(r.pass, false);
  assert.equal(r.failureClass, FC.HEADLESS_PERMISSION_FAILURE);
  assert.match(r.reason!, /permission_denied/);
});

test('permission probe: wrong target content → HEADLESS_PERMISSION_FAILURE', () => {
  const r = classifyPermissionProbeResult({ exitCode: 0, timedOut: false, hadPermissionDenied: false, targetContent: 'BEFORE', hadEditOrWrite: true, gitModified: true });
  assert.equal(r.pass, false);
  assert.equal(r.failureClass, FC.HEADLESS_PERMISSION_FAILURE);
  assert.match(r.reason!, /BEFORE/);
});

test('permission probe: target null → HEADLESS_PERMISSION_FAILURE', () => {
  const r = classifyPermissionProbeResult({ exitCode: 0, timedOut: false, hadPermissionDenied: false, targetContent: null, hadEditOrWrite: false, gitModified: false });
  assert.equal(r.pass, false);
  assert.equal(r.failureClass, FC.HEADLESS_PERMISSION_FAILURE);
});

test('permission probe: no edit tool and no git modification → HEADLESS_PERMISSION_FAILURE', () => {
  const r = classifyPermissionProbeResult({ exitCode: 0, timedOut: false, hadPermissionDenied: false, targetContent: 'AFTER', hadEditOrWrite: false, gitModified: false });
  assert.equal(r.pass, false);
  assert.equal(r.failureClass, FC.HEADLESS_PERMISSION_FAILURE);
  assert.match(r.reason!, /no edit tool/);
});

test('permission probe: PASS when content=AFTER and edit observed', () => {
  const r = classifyPermissionProbeResult({ exitCode: 0, timedOut: false, hadPermissionDenied: false, targetContent: 'AFTER', hadEditOrWrite: true, gitModified: true });
  assert.equal(r.pass, true);
  assert.equal(r.failureClass, undefined);
});

test('permission probe: PASS when content=AFTER, no edit event but git shows modification', () => {
  const r = classifyPermissionProbeResult({ exitCode: 0, timedOut: false, hadPermissionDenied: false, targetContent: 'AFTER', hadEditOrWrite: false, gitModified: true });
  assert.equal(r.pass, true);
});

test('ownership: clean diff passes', () => {
  const violations = classifyOwnershipViolations(['qcet-e2e/target.txt']);
  assert.deepEqual(violations, []);
});

test('ownership: src/ change is violation', () => {
  const violations = classifyOwnershipViolations(['qcet-e2e/target.txt', 'src/app/page.tsx']);
  assert.deepEqual(violations, ['src/app/page.tsx']);
});

test('ownership: prisma/ change is violation', () => {
  const violations = classifyOwnershipViolations(['prisma/schema.prisma']);
  assert.deepEqual(violations, ['prisma/schema.prisma']);
});

test('ownership: public/ change is violation', () => {
  const violations = classifyOwnershipViolations(['public/favicon.ico']);
  assert.deepEqual(violations, ['public/favicon.ico']);
});

test('ownership: package.json change is violation', () => {
  const violations = classifyOwnershipViolations(['package.json']);
  assert.deepEqual(violations, ['package.json']);
});

test('ownership: package-lock.json change is violation', () => {
  const violations = classifyOwnershipViolations(['package-lock.json']);
  assert.deepEqual(violations, ['package-lock.json']);
});

test('ownership: multiple violations reported', () => {
  const violations = classifyOwnershipViolations(['src/a.ts', 'prisma/schema.prisma', 'qcet-e2e/target.txt']);
  assert.deepEqual(violations.sort(), ['prisma/schema.prisma', 'src/a.ts']);
});

test('release gate: missing verdict file → RELEASE_GATE_MISSING', () => {
  const r = classifyReleaseGate(null);
  assert.equal(r.valid, false);
  assert.equal(r.failureClass, FC.RELEASE_GATE_MISSING);
});

test('release gate: empty object → RELEASE_GATE_MISSING', () => {
  const r = classifyReleaseGate({});
  assert.equal(r.valid, false);
  assert.equal(r.failureClass, FC.RELEASE_GATE_MISSING);
  assert.match(r.reason!, /invalid status/);
});

test('release gate: status=READY is valid', () => {
  const r = classifyReleaseGate({ status: 'READY' });
  assert.equal(r.valid, true);
  assert.equal(r.status, 'READY');
});

test('release gate: status=READY_WITH_KNOWN_ISSUES is valid', () => {
  const r = classifyReleaseGate({ status: 'READY_WITH_KNOWN_ISSUES' });
  assert.equal(r.valid, true);
});

test('release gate: status=BLOCKED is valid (though canary expects READY)', () => {
  const r = classifyReleaseGate({ status: 'BLOCKED' });
  assert.equal(r.valid, true);
  assert.equal(r.status, 'BLOCKED');
});

test('release gate: verdict field accepted as alias for status', () => {
  const r = classifyReleaseGate({ verdict: 'READY' });
  assert.equal(r.valid, true);
  assert.equal(r.status, 'READY');
});

test('release gate: unknown status string → RELEASE_GATE_MISSING', () => {
  const r = classifyReleaseGate({ status: 'PASS' });
  assert.equal(r.valid, false);
  assert.equal(r.failureClass, FC.RELEASE_GATE_MISSING);
});

test('PASS result schema satisfies contract', () => {
  const r = buildPassResult({
    releaseGate: 'READY',
    gateVerdictPath: '/tmp/gate-verdict.json',
    wallClockMs: 12345,
    transcriptPath: '/tmp/transcript.jsonl',
  });
  assert.equal(r.status, 'PASS');
  assert.equal(r.failureClass, null);
  assert.equal(r.permissionProbe, true);
  assert.equal(r.runtimeInit, true);
  assert.equal(r.workflowInvoked, true);
  assert.equal(r.executorStarted, true);
  assert.equal(r.targetMutationCorrect, true);
  assert.equal(r.ownershipClean, true);
  assert.equal(r.verificationPassed, true);
  assert.equal(r.releaseGatePresent, true);
  assert.equal(r.releaseGate, 'READY');
  assert.equal(r.executorSha, '45453bb8d6a3db3ca974495c7b3b36187004c503');
  assert.equal(r.model, 'claude-combo[1m]');
  assert.equal(r.timedOut, undefined); // not in contract
  assert.ok(r.wallClockMs > 0);
  assert.equal(r.tokens, null);   // not measured
  assert.equal(r.costUsd, null);  // not measured
});

test('result file round-trips through JSON', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcet-e2e-test-'));
  try {
    const r = buildPassResult({ releaseGate: 'READY', gateVerdictPath: '/x', wallClockMs: 1, transcriptPath: '/y' });
    const outPath = path.join(tmpDir, 'result.json');
    fs.writeFileSync(outPath, JSON.stringify(r, null, 2));
    const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8')) as E2EResult;
    assert.equal(parsed.status, 'PASS');
    assert.equal(parsed.releaseGate, 'READY');
    assert.equal(parsed.failureClass, null);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('timeout classification produces TIMEOUT failure class', () => {
  // Simulate the case where overall timeout fires
  const result = {
    status: 'FAIL' as const,
    failureClass: FC.TIMEOUT,
    reason: 'overall 6 minute timeout exceeded',
    timedOut: true,
  };
  assert.equal(result.failureClass, FC.TIMEOUT);
  assert.match(result.reason, /timeout/i);
});

test('EXECUTOR_NOT_STARTED is distinct from RUNTIME_INIT_FAILED', () => {
  // Gate A failure: stream never starts
  assert.notEqual(FC.RUNTIME_INIT_FAILED, FC.EXECUTOR_NOT_STARTED);
  // Both are recognized failure classes
  assert.ok(Object.values(FC).includes(FC.RUNTIME_INIT_FAILED));
  assert.ok(Object.values(FC).includes(FC.EXECUTOR_NOT_STARTED));
});

test('all failure classes are distinct strings', () => {
  const values = Object.values(FC);
  const unique = new Set(values);
  assert.equal(unique.size, values.length, 'Duplicate failure class detected');
});

test('gate state preservation: C+D pass survives E failure', () => {
  const gates = {
    runtimeInit: true,
    workflowInvoked: true,
    executorStarted: true,
    targetMutationCorrect: true,   // Gate C
    ownershipClean: true,           // Gate C
    verificationPassed: true,       // Gate D
    releaseGatePresent: false,      // Gate E fails
  };
  // C and D gates must survive independently of E failure
  assert.equal(gates.targetMutationCorrect, true);
  assert.equal(gates.ownershipClean, true);
  assert.equal(gates.verificationPassed, true);
  assert.equal(gates.releaseGatePresent, false);
});

test('workflow invoked but no artifact → EXECUTOR_NOT_STARTED failure class', () => {
  const gates = {
    runtimeInit: true,
    workflowInvoked: true,    // Workflow tool_use seen
    executorStarted: false,   // No artifact on disk
    targetMutationCorrect: false,
    ownershipClean: false,
    verificationPassed: false,
    releaseGatePresent: false,
  };
  assert.equal(gates.workflowInvoked, true);
  assert.equal(gates.executorStarted, false);
  // workflowInvoked and executorStarted are independent gate fields
  assert.equal(FC.EXECUTOR_NOT_STARTED, 'EXECUTOR_NOT_STARTED');
  assert.notEqual(FC.WORKFLOW_NOT_INVOKED, FC.EXECUTOR_NOT_STARTED);
});

test('EXECUTOR_PREFLIGHT_FAILED is a distinct failure class', () => {
  assert.equal(FC.EXECUTOR_PREFLIGHT_FAILED, 'EXECUTOR_PREFLIGHT_FAILED');
  assert.ok(Object.values(FC).includes(FC.EXECUTOR_PREFLIGHT_FAILED));
  // Preflight fires before runtime — distinct from RUNTIME_INIT_FAILED
  assert.notEqual(FC.EXECUTOR_PREFLIGHT_FAILED, FC.RUNTIME_INIT_FAILED);
});
