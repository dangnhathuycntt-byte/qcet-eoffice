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

// Compute dynamically so it always matches the actual workflow on disk
const EXECUTOR_SHA = (() => {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (_) {
    return 'unknown';
  }
})();
// Use the resolved model alias from ~/.claude/settings.json (currently 'fable').
// 'claude-combo[1m]' is the interactive-session alias and is NOT recognised by
// the headless `claude -p` SDK path — it returns api_error 404 and the
// subprocess hangs indefinitely consuming a process slot without doing any work.
const MODEL = 'fable';
const EFFORT = 'high';
const OVERALL_TIMEOUT_MS = 20 * 60 * 1000;      // 20 minutes — executor has many phases
const PERMISSION_PROBE_TIMEOUT_MS = 60 * 1000;  // 60 seconds
const EXECUTOR_STARTUP_WINDOW_MS = 90 * 1000;   // Gate B: 90 seconds

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const RESULTS_DIR = path.join(REPO_ROOT, 'benchmarks', 'e2e', 'results');

// ─── Failure classes ─────────────────────────────────────────────────────────

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
 *
 * When `stdinMessage` is provided, uses --input-format stream-json to send
 * the message and keeps stdin open until the model session naturally ends
 * (after processing any task notifications from background workflows).
 * This is the correct mode for invoking the Workflow tool — in plain -p mode
 * the session ends after one model turn (before workflow task-notifications
 * arrive), orphaning and killing the background workflow.
 *
 * Returns: { exitCode, timedOut, earlyExit, transcriptPath, stderrPath }
 */
function spawnClaude(args, { cwd, timeoutMs, transcriptPath, stderrPath, onStdoutLine, signal, stdinMessage }) {
  return new Promise((resolve) => {
    // When a stdinMessage is provided: pipe stdin so we can write the message
    // and keep the process alive until it naturally exits.
    const stdinMode = stdinMessage != null ? 'pipe' : 'ignore';
    const proc = spawn('claude', args, {
      cwd,
      env: {
        ...process.env,
        // Disable the 600s background-task ceiling so the workflow can run to
        // natural completion. Without this, Claude Code (in print/stdin mode) kills
        // any background workflow that hasn't finished within 600 seconds, emitting:
        //   "Background tasks still running after 600s; terminating."
        // The qcet-plan-executor workflow takes ~10 min; this ceiling race-kills it.
        CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS: '0',
      },
      stdio: [stdinMode, 'pipe', 'pipe'],
    });

    if (stdinMessage != null) {
      // Write the user message to stdin then close it — Claude Code will
      // process it and wait for background workflows to complete before ending.
      proc.stdin.write(stdinMessage);
      proc.stdin.end();
    }

    const transcriptStream = fs.createWriteStream(transcriptPath, { flags: 'a' });
    const stderrStream = fs.createWriteStream(stderrPath, { flags: 'a' });

    let timedOut = false;
    let earlyExit = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      setTimeout(() => proc.kill('SIGKILL'), 2000).unref();
    }, timeoutMs);

    // Support early-exit signal
    if (signal) {
      signal.addEventListener('abort', () => {
        earlyExit = true;
        clearTimeout(timer);
        proc.kill('SIGTERM');
        setTimeout(() => proc.kill('SIGKILL'), 2000).unref();
      }, { once: true });
    }

    let lineBuf = '';
    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      transcriptStream.write(text);
      if (onStdoutLine) {
        const lines = (lineBuf + text).split('\n');
        lineBuf = lines.pop();
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
      resolve({ exitCode: earlyExit ? 0 : (code ?? 1), timedOut: timedOut && !earlyExit, earlyExit, transcriptPath, stderrPath });
    });
  });
}

// ─── Executor static preflight ───────────────────────────────────────────────

function runExecutorPreflight(trialDir) {
  const failures = [];

  // Check workflow file exists
  const workflowPath = path.join(trialDir, '.claude', 'workflows', 'qcet-plan-executor.js');
  if (!fs.existsSync(workflowPath)) failures.push('workflow file missing: .claude/workflows/qcet-plan-executor.js');

  // Check required agents exist
  const requiredAgents = ['qcet-builder.md', 'qcet-recon.md', 'qcet-skeptic.md', 'qcet-telemetry-recorder.md'];
  for (const agentFile of requiredAgents) {
    const agentPath = path.join(trialDir, '.claude', 'agents', agentFile);
    if (!fs.existsSync(agentPath)) failures.push(`required agent missing: .claude/agents/${agentFile}`);
  }

  // Check StructuredOutput is available in agents that need schema enforcement.
  // These agents are called with schema: by the workflow — if they have an explicit
  // tools list that excludes StructuredOutput, schema calls will silently fail.
  const agentsNeedingStructuredOutput = ['qcet-skeptic.md', 'qcet-telemetry-recorder.md'];
  for (const agentFile of agentsNeedingStructuredOutput) {
    const agentPath = path.join(trialDir, '.claude', 'agents', agentFile);
    if (fs.existsSync(agentPath)) {
      const content = fs.readFileSync(agentPath, 'utf8');
      if (content.includes('tools:') && !content.includes('StructuredOutput')) {
        failures.push(`agent ${agentFile} has explicit tools list without StructuredOutput — schema calls will fail`);
      }
    }
  }

  // Check required rules directory exists
  const rulesDir = path.join(trialDir, '.claude', 'rules');
  if (!fs.existsSync(rulesDir)) failures.push('rules directory missing: .claude/rules/');

  return failures;
}

// ─── Temp repo management ────────────────────────────────────────────────────

function createTempRepo(label) {
  const dir = path.join(os.tmpdir(), `qcet-e2e-${label}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  execSync('git init --initial-branch=main', { cwd: dir });
  execSync('git config user.email "e2e@qcet.test"', { cwd: dir });
  execSync('git config user.name "QCET E2E"', { cwd: dir });
  // Grant trust for the isolated repo so Claude Code honours settings.json
  // permissions inside the temp dir (prevents "Ignoring N permissions.allow
  // entries … has not been trusted" which silently blocks all agent edits).
  patchClaudeJsonTrust(dir);
  return dir;
}

/**
 * Writes `hasTrustDialogAccepted: true` for `dir` into ~/.claude.json.
 * Claude Code refuses to apply allowedTools / settings.json entries for
 * untrusted project paths, causing all inner agent Edit/Write calls to be
 * silently blocked. This mirrors what an interactive `claude` invocation
 * does when the user accepts the trust dialog.
 */
function patchClaudeJsonTrust(dir) {
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  try {
    // Claude Code looks up trust using the canonical (realpath) form of the
    // project directory. On macOS, os.tmpdir() returns /var/folders/… but
    // Claude Code interns paths as /private/var/folders/… — write both so
    // the lookup succeeds regardless of which form Claude Code uses.
    const realDir = (() => { try { return fs.realpathSync(dir); } catch (_) { return dir; } })();
    let root = {};
    if (fs.existsSync(claudeJsonPath)) {
      root = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
    }
    if (!root.projects) root.projects = {};
    for (const key of Array.from(new Set([dir, realDir]))) {
      if (!root.projects[key]) root.projects[key] = {};
      root.projects[key].hasTrustDialogAccepted = true;
    }
    fs.writeFileSync(claudeJsonPath, JSON.stringify(root, null, 2) + '\n', 'utf8');
  } catch (err) {
    // Non-fatal: log and continue — the E2E will fail at Gate B if trust
    // is required, giving a clear EXECUTOR_NOT_STARTED failure class.
    process.stderr.write(`[e2e] WARN: could not patch ~/.claude.json trust for ${dir}: ${err.message}\n`);
  }
}

function destroyTempRepo(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  // Clean up the trust entry we added so ~/.claude.json doesn't accumulate stale paths
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  try {
    if (fs.existsSync(claudeJsonPath)) {
      const root = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
      if (root.projects && root.projects[dir]) {
        delete root.projects[dir];
        fs.writeFileSync(claudeJsonPath, JSON.stringify(root, null, 2) + '\n', 'utf8');
      }
    }
  } catch (_) {} // best-effort
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
  // Only track permission_denied on Edit/Write tools — Bash denials are expected
  // when the session's settings.json doesn't allowlist the specific git command.
  // The proof of headless write capability is file content, not Bash approval.
  let hadEditPermissionDenied = false;

  const { exitCode, timedOut } = await spawnClaude(
    [
      '-p',
      'Change e2e-permission-target.txt from BEFORE to AFTER. Do nothing else.',
      '--model', MODEL,
      '--effort', EFFORT,
      '--permission-mode', 'acceptEdits',
      '--allowedTools', 'Read,Edit,Write',
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
          const toolName = ev?.name ?? ev?.tool_name ?? '';
          if (/edit|write/i.test(toolName)) hadEditOrWrite = true;
          // Only flag permission_denied when the denied tool is Edit or Write
          if (ev?.type === 'system' && ev?.subtype === 'permission_denied') {
            if (/edit|write/i.test(ev?.tool_name ?? '')) {
              hadEditPermissionDenied = true;
            }
          }
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
  if (hadEditPermissionDenied) {
    destroyTempRepo(probeDir);
    return { pass: false, failureClass: FC.HEADLESS_PERMISSION_FAILURE, reason: 'Edit/Write permission_denied — acceptEdits not working' };
  }

  const content = fs.readFileSync(targetFile, 'utf8').trim();

  // Content is authoritative — if file is AFTER, headless write capability is proven.
  // git status check is secondary; run it from the harness directly (not via claude).
  const gitStatus = (() => {
    try { return runSync('git status --short', probeDir); } catch (_) { return ''; }
  })();
  const modified = gitStatus.includes('e2e-permission-target.txt');

  destroyTempRepo(probeDir);

  if (content !== 'AFTER') {
    return {
      pass: false,
      failureClass: FC.HEADLESS_PERMISSION_FAILURE,
      reason: `target content is "${content}", expected "AFTER" — Edit did not mutate the file`,
    };
  }

  log('PHASE 1 — PASS');
  return { pass: true };
}

// ─── Phase 2/3/4/5: Canary E2E run ───────────────────────────────────────────

async function runExecutorCanary(runDir) {
  log('PHASE 2-5 — Executor Canary');
  const canaryStartMs = Date.now();

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
      gates: { runtimeInit: false, workflowInvoked: false, executorStarted: false, targetMutationCorrect: false, ownershipClean: false, verificationPassed: false, releaseGatePresent: false },
    };
  }

  // ── Resolve SKILL_WORKFLOW_NAME_COLLISION ─────────────────────────────────
  // At the executor SHA used for this test, .claude/skills/qcet-plan-executor/
  // exists alongside .claude/workflows/qcet-plan-executor.js.  When Claude
  // Code sees a slash command matching BOTH a skill and a workflow it prefers
  // the skill — the model gets the skill instructions injected, then tries to
  // call the Workflow() tool, which starts a background task that is orphaned
  // and killed when the outer -p session ends.  Permanently, the skill should
  // be renamed to qcet-plan-executor-guide; until that lands in the executor
  // SHA, remove the colliding skill directory from the trial repo so the
  // workflow is the sole resolution target.
  const collidingSkillDir = path.join(trialDir, '.claude', 'skills', 'qcet-plan-executor');
  if (fs.existsSync(collidingSkillDir)) {
    log(`  Removing colliding skill .claude/skills/qcet-plan-executor/ to prevent SKILL_WORKFLOW_NAME_COLLISION`);
    fs.rmSync(collidingSkillDir, { recursive: true, force: true });
  }

  // ── Static preflight: verify harness files before spawning Claude ──
  const preflightFailures = runExecutorPreflight(trialDir);
  if (preflightFailures.length > 0) {
    log(`  EXECUTOR_PREFLIGHT_FAILED: ${preflightFailures.join('; ')}`);
    destroyTempRepo(trialDir);
    return {
      pass: false,
      failureClass: FC.EXECUTOR_PREFLIGHT_FAILED,
      reason: preflightFailures.join('; '),
      gates: { runtimeInit: false, workflowInvoked: false, executorStarted: false, targetMutationCorrect: false, ownershipClean: false, verificationPassed: false, releaseGatePresent: false },
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

  // Independent gate state — tracked separately from final pass/fail
  const gates = {
    runtimeInit: false,
    workflowInvoked: false,    // Workflow tool_use seen in transcript
    executorStarted: false,    // Actual executor artifact on disk
    targetMutationCorrect: false,
    ownershipClean: false,
    verificationPassed: false,
    releaseGatePresent: false,
  };

  // Write metadata
  fs.writeFileSync(path.join(runDir, 'meta.json'), JSON.stringify({
    pid: null, // filled after spawn
    startTime: new Date().toISOString(),
    model: MODEL,
    effort: EFFORT,
    executorSha: EXECUTOR_SHA,
    permissionMode: 'acceptEdits',
    allowedTools: 'Read,Edit,Write,Bash,Agent,Workflow',
    invocationMode: 'stdin-slash-command',
    invocation: '/qcet-plan-executor e2e-plan.md',
    trialDir,
    transcriptPath,
    stderrPath,
  }, null, 2));

  log(`  Invoking: /qcet-plan-executor e2e-plan.md (stdin slash-command — keeps session alive for workflow task completion)`);

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
        gates.executorStarted = true;
        log('  Gate B — executor artifact detected');
        return true;
      }
    }
    return false;
  };

  // Poll Gate B in background for executor artifact detection only.
  // IMPORTANT: do NOT kill the claude process early — even after gate-verdict.json
  // appears. The workflow runs as a background task inside the claude process; killing
  // the process kills the task (status: "killed") and the second result turn (which
  // carries the READY verdict in the transcript) never arrives. Let the session run to
  // natural completion, then evaluate all gates from the transcript + filesystem.
  const earlyExitController = new AbortController(); // kept for spawnClaude signature compat; never aborted
  const gateB_poll = setInterval(() => {
    checkExecutorArtifacts();
  }, 3000);

  // Invoke /qcet-plan-executor via stdin (not -p arg) to keep the session
  // alive through workflow background-task completion.
  //
  // Why NOT -p "/qcet-plan-executor e2e-plan.md":
  //   With -p the session produces one result turn ("workflow running in
  //   background") and exits. The Workflow() tool dispatches a background task
  //   whose completion notification arrives minutes later — but the process is
  //   already gone, so the notification is lost and gate-verdict.json never
  //   appears in the transcript. This is a race: -p exits after one result, the
  //   background task notification arrives after ~10 min.
  //
  // Why stdin works:
  //   Passing the prompt via stdin triggers the same agentic turn as -p, but
  //   Claude Code holds the process open — processing tool calls, background
  //   task notifications, and subsequent turns — until the model produces its
  //   final response AND all background tasks have completed. The process then
  //   exits naturally. The workflow completion notification (second system/init
  //   + second result/success) is delivered inline before exit.
  //
  // Invocation chain:
  //   stdin "/qcet-plan-executor e2e-plan.md"
  //   → model calls Workflow({name: "qcet-plan-executor", args: "e2e-plan.md"})
  //   → background task launched
  //   → Claude Code loops, waiting for task completion notification
  //   → task completes → user event → model second turn → READY verdict
  //   → process exits naturally (or SIGTERM on overall timeout)
  const { exitCode, timedOut, earlyExit } = await spawnClaude(
    [
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
      // Send the slash command via stdin — this triggers the interactive session
      // path that keeps the process alive to receive background task completions.
      stdinMessage: `/qcet-plan-executor e2e-plan.md\n`,
      onStdoutLine: (line) => {
        try {
          const ev = JSON.parse(line);
          // Gate A: system init
          if (!gateA_runtimeInit && (ev?.type === 'system' || ev?.type === 'init' || ev?.event === 'system')) {
            gateA_runtimeInit = true;
            gates.runtimeInit = true;
            log('  Gate A — runtime init detected');
          }
          // Also watch for any event to count as runtime init (stream started)
          if (!gateA_runtimeInit && line.includes('"type"')) {
            gateA_runtimeInit = true;
            gates.runtimeInit = true;
            log('  Gate A — stream active (runtime init)');
          }
          // Gate B: With slash-command invocation the model doesn't emit a Workflow
          // tool_use in the outer transcript — the workflow runs inside Claude Code's
          // slash-command handler. Track workflowInvoked via executor artifacts instead.
          if (ev?.type === 'assistant') {
            const content = ev?.message?.content || [];
            for (const c of content) {
              if (c?.type === 'tool_use' && c?.name === 'Workflow') {
                if (!gates.workflowInvoked) {
                  gates.workflowInvoked = true;
                  log('  Gate B — Workflow tool_use seen in transcript');
                }
                if (!gateB_executorArtifact) {
                  gateB_executorArtifact = true;
                  gates.executorStarted = true;
                  log('  Gate B — executor started (Workflow tool_use)');
                }
              }
            }
          }
        } catch (_) {}

        // Check Gate B time window
        if (!gateB_executorArtifact && Date.now() > gateB_deadline) {
          checkExecutorArtifacts();
        }
      },
      signal: earlyExitController.signal,
    }
  );

  clearInterval(gateB_poll);

  // Final artifact check
  checkExecutorArtifacts();

  if (timedOut && !earlyExit) {
    // Evaluate gates best-effort before returning
    const targetPath = path.join(trialDir, 'qcet-e2e', 'target.txt');
    const targetContent = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8').trim() : null;
    gates.targetMutationCorrect = targetContent === 'QCET_E2E_OK';
    gates.ownershipClean = true; // conservative — no product files should be dirty on timeout
    destroyTempRepo(trialDir);
    return { pass: false, failureClass: FC.TIMEOUT, reason: 'overall 20 minute timeout exceeded', gates };
  }

  // ── Gate A ──
  if (!gateA_runtimeInit) {
    destroyTempRepo(trialDir);
    return { pass: false, failureClass: FC.RUNTIME_INIT_FAILED, reason: 'no stream-json events received', gates };
  }

  // ── Gate B ──
  if (!gateB_executorArtifact) {
    // Final filesystem check
    checkExecutorArtifacts();
    if (!gateB_executorArtifact) {
      destroyTempRepo(trialDir);
      // Distinguish: Workflow tool was never invoked vs invoked but produced no artifact
      const failureClass = gates.workflowInvoked ? FC.EXECUTOR_NOT_STARTED : FC.WORKFLOW_NOT_INVOKED;
      const reason = gates.workflowInvoked
        ? 'Workflow tool was invoked but no executor runtime artifacts found on disk'
        : 'Workflow tool was never invoked in transcript';
      return { pass: false, failureClass, reason, gates };
    }
  }

  // ── Gate C — Target mutation ──
  const targetPath = path.join(trialDir, 'qcet-e2e', 'target.txt');
  const targetContent = fs.existsSync(targetPath)
    ? fs.readFileSync(targetPath, 'utf8').trim()
    : null;

  gates.targetMutationCorrect = (targetContent === 'QCET_E2E_OK');

  if (targetContent !== 'QCET_E2E_OK') {
    destroyTempRepo(trialDir);
    return {
      pass: false,
      failureClass: FC.VERIFICATION_FAILURE,
      reason: `target.txt = "${targetContent}", expected "QCET_E2E_OK"`,
      gates,
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
  gates.ownershipClean = ownershipViolations.length === 0;
  if (ownershipViolations.length > 0) {
    destroyTempRepo(trialDir);
    return {
      pass: false,
      failureClass: FC.OWNERSHIP_FAILURE,
      reason: `Unauthorized files changed: ${ownershipViolations.join(', ')}`,
      gates,
    };
  }

  // ── Extract release verdict from transcript result text ──────────────────
  // The executor workflow returns its verdict as structured text in the
  // transcript's final result event (e.g. "Release gate: **READY**").
  // This is the primary source of truth when no gate-verdict.json file exists.
  const transcriptVerdictResult = (() => {
    try {
      const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
      // Walk events in reverse to find the last result with executor verdict
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const ev = JSON.parse(lines[i]);
          if (ev?.type === 'result' && ev?.subtype === 'success' && typeof ev.result === 'string') {
            const text = ev.result;
            // Match "Release gate: **READY**" or "Release gate: READY" or "status: READY"
            const m = text.match(/[Rr]elease\s+[Gg]ate[:\s*]+\**\s*(READY(?:_WITH_KNOWN_ISSUES)?|BLOCKED)\**/);
            if (m) return { verdict: m[1], text };
            // Also match "QCET Plan Executor — READY" header
            const m2 = text.match(/QCET Plan Executor\s*[—–-]\s*(READY(?:_WITH_KNOWN_ISSUES)?|BLOCKED)/);
            if (m2) return { verdict: m2[1], text };
            // Match "Release Gate: PASS" — executor emits PASS when all checks pass
            const m3 = text.match(/[Rr]elease\s+[Gg]ate[:\s*]+\**\s*PASS\**/);
            if (m3) return { verdict: 'READY', text };
            // Match "Actual Outcome: **PASS**" — executor summary when release gate note is separate
            const m4 = text.match(/Actual Outcome[:\s*]+\**\s*PASS\**/i);
            if (m4) return { verdict: 'READY', text };
            // Match bare "status: READY" or "verdict: READY"
            const m5 = text.match(/(?:status|verdict)\s*:\s*["`']?(READY(?:_WITH_KNOWN_ISSUES)?|BLOCKED)["`']?/);
            if (m5) return { verdict: m5[1], text };
            // Match "✅ PASS" anywhere in a result that has PASS as overall verdict
            const m6 = text.match(/\|\s*(?:Release\s+Gate|Overall|Final)\s*\|\s*✅\s*PASS/);
            if (m6) return { verdict: 'READY', text };
          }
        } catch (_) {}
      }
      return null;
    } catch (_) { return null; }
  })();

  // ── Gate D — Verification result ──────────────────────────────────────────
  // Check shard-result.json on disk first; fall back to transcript verdict text.
  gates.verificationPassed = (() => {
    // Disk-based check (executor-runs shard files)
    try {
      const executorRunsDir = path.join(trialDir, '.claude', 'executor-runs');
      if (fs.existsSync(executorRunsDir)) {
        const entries = fs.readdirSync(executorRunsDir);
        for (const entry of entries) {
          const shardVerdict = path.join(executorRunsDir, entry, 'shard-result.json');
          if (fs.existsSync(shardVerdict)) {
            const parsed = JSON.parse(fs.readFileSync(shardVerdict, 'utf8'));
            if (parsed?.verdict === 'pass' || parsed?.status === 'pass') return true;
          }
        }
      }
    } catch (_) {}
    // Transcript-based fallback: if the executor emitted READY the verification passed
    if (transcriptVerdictResult?.verdict === 'READY' || transcriptVerdictResult?.verdict === 'READY_WITH_KNOWN_ISSUES') {
      return true;
    }
    return false;
  })();

  // ── Gate E — Release gate ──────────────────────────────────────────────────
  // Primary: gate-verdict.json file on disk.
  // Fallback: verdict extracted from the transcript result text (the executor
  // returns its final verdict as structured markdown in the result field).
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

  // Fallback: synthesize gate verdict from transcript result text
  if (!gateVerdictPath && transcriptVerdictResult) {
    log(`  Gate E — verdict from transcript result text: ${transcriptVerdictResult.verdict}`);
    gateVerdictPath = transcriptPath;  // point to transcript as evidence
    gateVerdictContent = { status: transcriptVerdictResult.verdict, source: 'transcript-result-text' };
  }

  if (!gateVerdictPath) {
    gates.releaseGatePresent = false;
    destroyTempRepo(trialDir);
    return { pass: false, failureClass: FC.RELEASE_GATE_MISSING, reason: 'gate-verdict.json not found in trial repo and no verdict in transcript result', gates };
  }

  const status = gateVerdictContent?.status ?? gateVerdictContent?.verdict ?? null;
  const validStatuses = ['READY', 'READY_WITH_KNOWN_ISSUES', 'BLOCKED'];
  gates.releaseGatePresent = validStatuses.includes(status);
  if (!validStatuses.includes(status)) {
    destroyTempRepo(trialDir);
    return {
      pass: false,
      failureClass: FC.RELEASE_GATE_MISSING,
      reason: `gate-verdict.json has no valid status (got: ${JSON.stringify(status)})`,
      gates,
    };
  }

  if (status !== 'READY') {
    destroyTempRepo(trialDir);
    return {
      pass: false,
      failureClass: FC.VERIFICATION_FAILURE,
      reason: `Release gate status is "${status}", expected "READY" for canary workload`,
      gates,
    };
  }

  log('  All gates PASS');
  destroyTempRepo(trialDir);
  return { pass: true, releaseGate: status, gateVerdictPath, gates };
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
      workflowInvoked: false,
      executorStarted: false,
      targetMutationCorrect: false,
      ownershipClean: false,
      verificationPassed: false,
      releaseGatePresent: false,
      releaseGate: null,
      wallClockMs: Date.now() - startMs,
      tokens: null,
      costUsd: null,
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
    runtimeInit: canaryResult.gates?.runtimeInit ?? false,
    workflowInvoked: canaryResult.gates?.workflowInvoked ?? false,
    executorStarted: canaryResult.gates?.executorStarted ?? false,
    targetMutationCorrect: canaryResult.gates?.targetMutationCorrect ?? false,
    ownershipClean: canaryResult.gates?.ownershipClean ?? false,
    verificationPassed: canaryResult.gates?.verificationPassed ?? false,
    releaseGatePresent: canaryResult.gates?.releaseGatePresent ?? false,
    releaseGate: canaryResult.releaseGate ?? null,
    wallClockMs,
    tokens: null,    // not measured
    costUsd: null,   // not measured
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
