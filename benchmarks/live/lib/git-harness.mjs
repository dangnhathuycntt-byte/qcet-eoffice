import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Execute command synchronously in a specific directory.
 */
function run(cmd, cwd, options = {}) {
  return execSync(cmd, {
    cwd,
    encoding: 'utf8',
    stdio: options.silent ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'inherit'],
    ...options
  }).trim();
}

/**
 * Prepare an isolated trial directory with workload base SHA,
 * harness overlay (if Arm B or C), and task setup patch.
 */
export async function prepareTrialDirectory({
  benchmarkId,
  arm,
  task,
  trial,
  workloadBaseSha,
  harnessSha,
  repoRoot = process.cwd(),
  benchmarksBaseDir = '/tmp/qcet-live-bench'
}) {
  const trialId = `${arm}-${task}-r${trial}`;
  const targetDir = path.join(benchmarksBaseDir, benchmarkId, trialId);

  // 1. Clean up targetDir if it already exists
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  // 2. Clone locally from repoRoot at workloadBaseSha into targetDir
  // Using git worktree or shallow clone
  run(`git clone --no-checkout "${repoRoot}" "${targetDir}"`, repoRoot, { silent: true });
  run(`git checkout --force "${workloadBaseSha}"`, targetDir, { silent: true });

  // 3. Harness Overlay
  if (arm === 'B' || arm === 'C') {
    if (!harnessSha) {
      throw new Error(`Arm ${arm} requires a valid harnessSha`);
    }
    // Checkout .claude and executor scripts from harnessSha
    try {
      run(`git checkout "${harnessSha}" -- .claude/`, targetDir, { silent: true });
    } catch (_) {}
    try {
      run(`git checkout "${harnessSha}" -- scripts/build-executor-bundle.mjs scripts/run-executor-tests.mjs`, targetDir, { silent: true });
    } catch (_) {}
  } else if (arm === 'A') {
    // Pure Ultracode: remove QCET executor skills and rules to ensure pure native behavior
    const executorSkill = path.join(targetDir, '.claude', 'skills', 'qcet-plan-executor');
    if (fs.existsSync(executorSkill)) {
      fs.rmSync(executorSkill, { recursive: true, force: true });
    }
  }

  // 4. Apply Task setup.patch if present and contains valid patch headers
  const taskDir = path.join(repoRoot, 'benchmarks', 'live', 'tasks', task);
  const patchPath = path.join(taskDir, 'setup.patch');
  if (fs.existsSync(patchPath) && fs.statSync(patchPath).size > 0) {
    const patchContent = fs.readFileSync(patchPath, 'utf8');
    if (patchContent.includes('diff --git') || patchContent.includes('--- a/')) {
      run(`git apply --whitespace=nowarn "${patchPath}"`, targetDir, { silent: true });
    }
  }

  // 5. Copy task plan.md into trial directory
  const planPath = path.join(taskDir, 'plan.md');
  if (fs.existsSync(planPath)) {
    fs.copyFileSync(planPath, path.join(targetDir, 'plan.md'));
  }

  return {
    trialId,
    targetDir,
    workloadBaseSha,
    harnessSha: arm === 'A' ? 'native' : harnessSha
  };
}

/**
 * Remove trial directory to release disk space.
 */
export async function cleanupTrialDirectory(targetDir) {
  if (targetDir && fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
}
