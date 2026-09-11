#!/usr/bin/env node
/**
 * QCET Plan Executor — E2E Integration Harness
 *
 * Tests the complete executor transport chain:
 *   CLI → command discovery → permission → saved workflow → lifecycle gates → release gate
 *
 * This is a binary integration test (PASS / one precise FAIL class).
 * No A/B/C comparison. No statistics. No token optimization.
 *
 * Usage:
 *   node benchmarks/e2e/run-plan-executor-e2e.mjs
 *   npm run test:executor:e2e
 */

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ─── Config ──────────────────────────────────────────────────────────────────

const EXECUTOR_SHA = '45453bb8d6a3db3ca974495c7b3b36187004c503';
const MODEL = 'claude-combo[1m]';
const EFFORT = 'high';
const OVERALL_TIMEOUT_MS = 6 * 60 * 1000;       // 6 minutes hard cap
const PERMISSION_PROBE_TIMEOUT_MS = 60 * 1000;  // 60 seconds
const EXECUTOR_STARTUP_WINDOW_MS = 60 * 1000;    // Gate B: 1 minute

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const RESULTS_DIR = path.join(REPO_ROOT, 'benchmarks', 'e2e', 'results');

// ─── Failure classes ─────────────────────────────────────────────────────────

const FC = {
  HEADLESS_PERMISSION_FAILURE: 'HEADLESS_PERMISSION_FAILURE',
  RUNTIME_INIT_FAILED: 'RUNTIME_INIT_FAILED',
  EXECUTOR_NOT_STARTED: 'EXECUTOR_NOT_STARTED',
  OWNERSHIP_FAILURE: 'OWNERSHIP_FAILURE',
  VERIFICATION_FAILURE: 'VERIFICATION_FAILURE',
  RELEASE_GATE_MISSING: 'RELEASE_GATE_MISSING',
  TIMEOUT: 'TIMEOUT',
  INFRA_ERROR: 'INFRA_ERROR',
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function log(msg) {
  process.stdout.write(`[e2e] ${msg}\n`);
}

function runSync(cmd, cwd = REPO_ROOT) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function mkRunId() {
  const ts = Date.now();
  return `e2e-${ts}`;
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

/**
 * Spawn claude CLI and stream stdout/stderr into files.
 * Returns: { exitCode, timedOut, transcriptPath, stderrPath }
 */
function spawnClaude(args, { cwd, timeoutMs, transcriptPath, stderrPath, onStdoutLine }) {
  return new Promise((resolve) => {
    const proc = spawn('claude', args, {
      cwd,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const transcriptStream = fs.createWriteStream(transcriptPath, { flags: 'a' });
    const stderrStream = fs.createWriteStream(stderrPath, { flags: 'a' });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      setTimeout(() => proc.kill('SIGKILL'), 2000).unref();
    }, timeoutMs);

    let stderrBuf = '';
    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      transcriptStream.write(text);
      if (onStdoutLine) {
        const lines = (stderrBuf + text).split('\n');
        stderrBuf = lines.pop();
        for (const line of lines) {
          onStdoutLine(line);
        }
      }
    });
    proc.stderr.on('data', (chunk) => {
      stderrStream.write(chunk);
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      transcriptStream.end();
      stderrStream.end();
      resolve({ exitCode: code ?? 1, timedOut, transcriptPath, stderrPath });
    });
  });
}

// ─── Temp repo management ────────────────────────────────────────────────────

function createTempRepo(label) {
  const dir = path.join(os.tmpdir(), `qcet-e2e-${label}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  execSync('git init --initial-branch=main', { cwd: dir });
  execSync('git config user.email "e2e@qcet.test"', { cwd: dir });
  execSync('git config user.name "QCET E2E"', { cwd: dir });
  return dir;
}

function destroyTempRepo(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

// ─── Phase 0: Environment capture ────────────────────────────────────────────

function captureEnv() {
  const claudeVersion = (() => {
    try { return runSync('claude --version'); } catch (_) { return 'unknown'; }
  })();
  return {
    timestamp: new Date().toISOString(),
    model: MODEL,
    effort: EFFORT,
    executorSha: EXECUTOR_SHA,
    claudeVersion,
    platform: process.platform,
    nodeVersion: process.version,
  };
}

// ─── Phase 1: Permission Probe ─────────────────────────────────────────���─────

async function runPermissionProbe(runDir) {
  log('PHASE 1 — Permission Probe');
  const probeDir = createTempRepo('probe');
  const targetFile = path.join(probeDir, 'e2e-permission-target.txt');
  fs.writeFileSync(targetFile, 'BEFORE\n');
  execSync('git add . && git commit -m "init"', { cwd: probeDir });

  const transcriptPath = path.join(runDir, 'probe-transcript.jsonl');
  const stderrPath = path.join(runDir, 'probe-stderr.log');

  let hadEditOrWrite = false;
  let hadPermissionDenied = false;

  const { exitCode, timedOut } = await spawnClaude(
    [
      '-p',
      'Change e2e-permission-target.txt from BEFORE to AFTER. Then run git status --short. Do nothing else.',
      '--model', MODEL,
      '--effort', EFFORT,
      '--permission-mode', 'acceptEdits',
      '--allowedTools', 'Read,Edit,Write,Bash(git status *)',
      '--output-format', 'stream-json',
      '--verbose',
      '--no-session-persistence',
    ],
    {
      cwd: probeDir,
      timeoutMs: PERMISSION_PROBE_TIMEOUT_MS,
      transcriptPath,
      stderrPath,
      onStdoutLine: (line) => {
        try {
          const ev = JSON.parse(line);
          const toolName = ev?.name ?? ev?.tool_name ?? ev?.type ?? '';
          if (/edit|write/i.test(toolName)) hadEditOrWrite = true;
          if (/permission_denied/i.test(JSON.stringify(ev))) hadPermissionDenied = true;
        } catch (_) {}
      },
    }
  );

  if (timedOut) {
    destroyTempRepo(probeDir);
    return { pass: false, failureClass: FC.HEADLESS_PERMISSION_FAILURE, reason: 'timeout' };
  }
  if (exitCode !== 0) {
    destroyTempRepo(probeDir);
    return { pass: false, failureClass: FC.HEADLESS_PERMISSION_FAILURE, reason: `exitCode=${exitCode}` };
  }
  if (hadPermissionDenied) {
    destroyTempRepo(probeDir);
    return { pass: false, failureClass: FC.HEADLESS_PERMISSION_FAILURE, reason: 'permission_denied event' };
  }

  const content = fs.readFileSync(targetFile, 'utf8').trim();
  if (content !== 'AFTER') {
    destroyTempRepo(probeDir);
    return {
      pass: false,
      failureClass: FC.HEADLESS_PERMISSION_FAILURE,
      reason: `target content is "${content}", expected "AFTER"`,
    };
  }

  // Verify git sees the modification
  const gitStatus = (() => {
    try { return runSync('git status --short', probeDir); } catch (_) { return ''; }
  })();
  const modified = gitStatus.includes('e2e-permission-target.txt');

  destroyTempRepo(probeDir);

  if (!modified && !hadEditOrWrite) {
    return { pass: false, failureClass: FC.HEADLESS_PERMISSION_FAILURE, reason: 'no edit tool observed and git shows no modification' };
  }

  log('PHASE 1 — PASS');
  return { pass: true };
}

// ─── Phase 2/3/4/5: Canary E2E run ───────────────────────────────────────────

async function runExecutorCanary(runDir) {
  log('PHASE 2-5 — Executor Canary');

  // Set up isolated trial repo
  const trialDir = createTempRepo('canary');

  // Copy harness from executor SHA
  log(`  Overlaying harness from ${EXECUTOR_SHA}…`);
  const gitDir = (() => {
    const gf = path.join(REPO_ROOT, '.git');
    const stat = fs.statSync(gf);
    if (stat.isFile()) {
      // worktree .git file — parse gitdir
      const content = fs.readFileSync(gf, 'utf8').trim();
      const m = content.match(/^gitdir:\s*(.+)$/);
      return m ? path.resolve(path.dirname(gf), m[1]) : gf;
    }
    return gf;
  })();

  try {
    execSync(
      `git --git-dir="${gitDir}" archive "${EXECUTOR_SHA}" .claude | tar -x -C "${trialDir}"`,
      { cwd: REPO_ROOT }
    );
  } catch (err) {
    destroyTempRepo(trialDir);
    return {
      pass: false,
      failureClass: FC.INFRA_ERROR,
      reason: `Failed to overlay harness: ${err.message}`,
    };
  }

  // Create fixture: qcet-e2e/target.txt
  const fixtureDir = path.join(trialDir, 'qcet-e2e');
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(path.join(fixtureDir, 'target.txt'), 'QCET_E2E_PENDING\n');

  // Create canary plan
  const planContent = `# QCET Executor E2E Canary

## Objective

Change exactly one fixture file and prove the complete QCET executor lifecycle.

## Requirements

R1. Change \`qcet-e2e/target.txt\` from:

QCET_E2E_PENDING

to exactly:

QCET_E2E_OK

R2. Do not modify product source code.

R3. Do not modify Prisma/schema/auth/API/UI files.

R4. Verify the final file contains exactly \`QCET_E2E_OK\`.

## Ownership

Shard: e2e-canary

owns:
- qcet-e2e/target.txt

antiOwns:
- src/**
- prisma/**
- public/**
- package.json
- package-lock.json

risk:
low

## Test

Run:

grep -qx 'QCET_E2E_OK' qcet-e2e/target.txt

## Acceptance Criteria

- target.txt contains exactly QCET_E2E_OK
- no product file changed
- verification passes
- release gate emits a deterministic verdict
`;
  fs.writeFileSync(path.join(trialDir, 'e2e-plan.md'), planContent);

  // Initial commit
  execSync('git add -A && git commit -m "e2e canary scaffold"', { cwd: trialDir });

  const transcriptPath = path.join(runDir, 'transcript.jsonl');
  const stderrPath = path.join(runDir, 'stderr.log');

  // ── Gate tracking ──
  let gateA_runtimeInit = false;
  let gateB_executorArtifact = false;
  const gateB_deadline = Date.now() + EXECUTOR_STARTUP_WINDOW_MS;
  let terminated = false;
  let terminationReason = null;

  // Write metadata
  fs.writeFileSync(path.join(runDir, 'meta.json'), JSON.stringify({
    pid: null, // filled after spawn
    startTime: new Date().toISOString(),
    model: MODEL,
    effort: EFFORT,
    executorSha: EXECUTOR_SHA,
    permissionMode: 'acceptEdits',
    allowedTools: 'Read,Edit,Write,Bash,Agent,Workflow',
    invocationMode: 'saved-workflow-command',
    invocation: '/qcet-plan-executor e2e-plan.md',
    trialDir,
    transcriptPath,
    stderrPath,
  }, null, 2));

  log(`  Invoking: /qcet-plan-executor e2e-plan.md`);

  const checkExecutorArtifacts = () => {
    if (gateB_executorArtifact) return true;
    const candidates = [
      path.join(trialDir, '.claude', 'executor-runs'),
      path.join(trialDir, 'run-ledger.jsonl'),
      path.join(trialDir, '.qcet-executor-run'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        gateB_executorArtifact = true;
        log('  Gate B — executor artifact detected');
        return true;
      }
    }
    return false;
  };

  // Poll Gate B in background
  const gateB_poll = setInterval(() => {
    checkExecutorArtifacts();
  }, 2000);

  const { exitCode, timedOut } = await spawnClaude(
    [
      '-p',
      '/qcet-plan-executor e2e-plan.md',
      '--model', MODEL,
      '--effort', EFFORT,
      '--permission-mode', 'acceptEdits',
      '--allowedTools', 'Read,Edit,Write,Bash,Agent,Workflow',
      '--output-format', 'stream-json',
      '--verbose',
      '--no-session-persistence',
    ],
    {
      cwd: trialDir,
      timeoutMs: OVERALL_TIMEOUT_MS,
      transcriptPath,
      stderrPath,
      onStdoutLine: (line) => {
        try {
          const ev = JSON.parse(line);
          // Gate A: system init
          if (!gateA_runtimeInit && (ev?.type === 'system' || ev?.type === 'init' || ev?.event === 'system')) {
            gateA_runtimeInit = true;
            log('  Gate A — runtime init detected');
          }
          // Also watch for any event to count as runtime init (stream started)
          if (!gateA_runtimeInit && line.includes('"type"')) {
            gateA_runtimeInit = true;
            log('  Gate A — stream active (runtime init)');
          }
        } catch (_) {}

        // Check Gate B time window
        if (!gateB_executorArtifact && Date.now() > gateB_deadline) {
          checkExecutorArtifacts();
        }
      },
    }
  );

  clearInterval(gateB_poll);

  // Final artifact check
  checkExecutorArtifacts();

  if (timedOut) {
    destroyTempRepo(trialDir);
    return { pass: false, failureClass: FC.TIMEOUT, reason: 'overall 6 minute timeout exceeded' };
  }

  // ── Gate A ──
  if (!gateA_runtimeInit) {
    destroyTempRepo(trialDir);
    return { pass: false, failureClass: FC.RUNTIME_INIT_FAILED, reason: 'no stream-json events received' };
  }

  // ── Gate B ──
  if (!gateB_executorArtifact) {
    // Final filesystem check
    checkExecutorArtifacts();
    if (!gateB_executorArtifact) {
      destroyTempRepo(trialDir);
      return { pass: false, failureClass: FC.EXECUTOR_NOT_STARTED, reason: 'no executor runtime artifacts found' };
    }
  }

  // ── Gate C — Target mutation ──
  const targetPath = path.join(trialDir, 'qcet-e2e', 'target.txt');
  const targetContent = fs.existsSync(targetPath)
    ? fs.readFileSync(targetPath, 'utf8').trim()
    : null;

  if (targetContent !== 'QCET_E2E_OK') {
    destroyTempRepo(trialDir);
    return {
      pass: false,
      failureClass: FC.VERIFICATION_FAILURE,
      reason: `target.txt = "${targetContent}", expected "QCET_E2E_OK"`,
    };
  }

  // ── Gate C — Ownership check ──
  const diffOutput = (() => {
    try {
      return runSync('git diff --name-only HEAD', trialDir);
    } catch (_) {
      return runSync('git status --short', trialDir);
    }
  })();

  const forbiddenPatterns = [/^src\//, /^prisma\//, /^public\//, /^package\.json$/, /^package-lock\.json$/];
  const changedLines = diffOutput.split('\n').filter(Boolean);
  const ownershipViolations = changedLines.filter(f =>
    forbiddenPatterns.some(p => p.test(f))
  );
  if (ownershipViolations.length > 0) {
    destroyTempRepo(trialDir);
    return {
      pass: false,
      failureClass: FC.OWNERSHIP_FAILURE,
      reason: `Unauthorized files changed: ${ownershipViolations.join(', ')}`,
    };
  }

  // ── Gate D/E — Release gate ──
  const possibleGateFiles = [
    path.join(trialDir, 'gate-verdict.json'),
    path.join(trialDir, '.claude', 'executor-runs', 'gate-verdict.json'),
  ];
  // Also search dynamically
  const gateSearch = (() => {
    try {
      return runSync('find . -name "gate-verdict.json" -maxdepth 5 2>/dev/null | head -3', trialDir);
    } catch (_) { return ''; }
  })();
  if (gateSearch) {
    for (const line of gateSearch.split('\n').filter(Boolean)) {
      possibleGateFiles.push(path.join(trialDir, line.replace(/^\.\//, '')));
    }
  }

  let gateVerdictPath = null;
  let gateVerdictContent = null;
  for (const gf of possibleGateFiles) {
    if (fs.existsSync(gf)) {
      gateVerdictPath = gf;
      try { gateVerdictContent = JSON.parse(fs.readFileSync(gf, 'utf8')); } catch (_) {}
      break;
    }
  }

  if (!gateVerdictPath) {
    destroyTempRepo(trialDir);
    return { pass: false, failureClass: FC.RELEASE_GATE_MISSING, reason: 'gate-verdict.json not found in trial repo' };
  }

  const status = gateVerdictContent?.status ?? gateVerdictContent?.verdict ?? null;
  const validStatuses = ['READY', 'READY_WITH_KNOWN_ISSUES', 'BLOCKED'];
  if (!validStatuses.includes(status)) {
    destroyTempRepo(trialDir);
    return {
      pass: false,
      failureClass: FC.RELEASE_GATE_MISSING,
      reason: `gate-verdict.json has no valid status (got: ${JSON.stringify(status)})`,
    };
  }

  if (status !== 'READY') {
    destroyTempRepo(trialDir);
    return {
      pass: false,
      failureClass: FC.VERIFICATION_FAILURE,
      reason: `Release gate status is "${status}", expected "READY" for canary workload`,
    };
  }

  log('  All gates PASS');
  destroyTempRepo(trialDir);
  return { pass: true, releaseGate: status, gateVerdictPath };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const runId = mkRunId();
  const runDir = path.join(RESULTS_DIR, runId);
  ensureDir(runDir);

  log(`Run ID: ${runId}`);
  log(`Results: ${runDir}`);

  const env = captureEnv();
  const startMs = Date.now();

  // ── Phase 1: Permission Probe ──
  const probeResult = await runPermissionProbe(runDir);
  if (!probeResult.pass) {
    const result = {
      status: 'FAIL',
      failureClass: probeResult.failureClass,
      reason: probeResult.reason,
      executorSha: EXECUTOR_SHA,
      model: MODEL,
      effort: EFFORT,
      permissionProbe: false,
      runtimeInit: false,
      executorStarted: false,
      targetMutationCorrect: false,
      ownershipClean: false,
      verificationPassed: false,
      releaseGate: null,
      wallClockMs: Date.now() - startMs,
      tokens: 0,
      costUsd: 0,
      transcriptPath: path.join(runDir, 'probe-transcript.jsonl'),
      gateVerdictPath: null,
    };
    fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2));
    process.stdout.write(`\nQCET_EXECUTOR_E2E_FAIL\nfailureClass: ${result.failureClass}\nreason: ${result.reason}\n`);
    process.exitCode = 1;
    return;
  }

  // ── Phase 2-5: Canary E2E ──
  const canaryResult = await runExecutorCanary(runDir);

  const wallClockMs = Date.now() - startMs;
  const result = {
    status: canaryResult.pass ? 'PASS' : 'FAIL',
    failureClass: canaryResult.pass ? null : canaryResult.failureClass,
    reason: canaryResult.reason ?? null,
    executorSha: EXECUTOR_SHA,
    model: MODEL,
    effort: EFFORT,
    permissionProbe: true,
    runtimeInit: canaryResult.pass || canaryResult.failureClass !== FC.RUNTIME_INIT_FAILED,
    executorStarted: canaryResult.pass || ![FC.EXECUTOR_NOT_STARTED, FC.RUNTIME_INIT_FAILED].includes(canaryResult.failureClass),
    targetMutationCorrect: canaryResult.pass,
    ownershipClean: canaryResult.pass || canaryResult.failureClass !== FC.OWNERSHIP_FAILURE,
    verificationPassed: canaryResult.pass,
    releaseGate: canaryResult.releaseGate ?? null,
    wallClockMs,
    tokens: 0,
    costUsd: 0,
    transcriptPath: path.join(runDir, 'transcript.jsonl'),
    gateVerdictPath: canaryResult.gateVerdictPath ?? null,
  };

  fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2));

  if (canaryResult.pass) {
    process.stdout.write(`\nQCET_EXECUTOR_E2E_PASS\nrunId: ${runId}\nwallClockMs: ${wallClockMs}\n`);
    process.exitCode = 0;
  } else {
    process.stdout.write(
      `\nQCET_EXECUTOR_E2E_FAIL\nfailureClass: ${result.failureClass}\nreason: ${result.reason}\nrunId: ${runId}\n`
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  process.stderr.write(`[e2e] Fatal: ${err.stack || err.message}\n`);
  process.exitCode = 1;
});
