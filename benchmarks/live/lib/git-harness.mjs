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
 * Prepare an isolated, sanitized trial repository.
 * Invariants enforced:
 * - Product snapshot is extracted via git archive so trial has NO remotes and NO access to benchmark branch history/graders.
 * - Single synthetic initial commit is created in a fresh git repository.
 * - Arm overlay (.claude/) and plan.md are committed BEFORE timing starts.
 * - BENCHMARK_START_SHA is recorded so graders diff against benchmark-start, not dirty uncommitted setup state.
 * - node_modules is symlinked so TypeScript, TSX, and runtime dependencies execute without overhead.
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

  // 2. Extract clean product snapshot from workloadBaseSha via git archive
  const gitDir = path.join(repoRoot, '.git');
  run(`git --git-dir="${gitDir}" archive "${workloadBaseSha}" | tar -x -C "${targetDir}"`, repoRoot, { silent: true });

  // 3. Symlink node_modules from repoRoot for rapid execution without downloading packages
  const rootNodeModules = path.join(repoRoot, 'node_modules');
  if (fs.existsSync(rootNodeModules)) {
    try {
      fs.symlinkSync(rootNodeModules, path.join(targetDir, 'node_modules'), 'junction');
    } catch (_) {}
  }

  // 4. Initialize fresh git repository with clean baseline commit (zero foreign history/refs)
  run('git init', targetDir, { silent: true });
  run('git config user.name "QCET Benchmark Baseline"', targetDir, { silent: true });
  run('git config user.email "benchmark@qcet.local"', targetDir, { silent: true });
  run('git add -A && git commit -m "chore(baseline): initial product baseline"', targetDir, { silent: true });

  // 5. Harness Overlay
  if (arm === 'B' || arm === 'C') {
    if (!harnessSha) {
      throw new Error(`Arm ${arm} requires a valid harnessSha`);
    }
    // Overlay .claude/ and executor scripts from harnessSha
    try {
      run(`git --git-dir="${gitDir}" archive "${harnessSha}" .claude | tar -x -C "${targetDir}"`, repoRoot, { silent: true });
    } catch (_) {}
    try {
      run(`git --git-dir="${gitDir}" archive "${harnessSha}" scripts/build-executor-bundle.mjs scripts/run-executor-tests.mjs | tar -x -C "${targetDir}"`, repoRoot, { silent: true });
    } catch (_) {}
  } else if (arm === 'A') {
    // Pure Ultracode: remove QCET executor skill and rules to ensure pure native behavior
    const executorSkill = path.join(targetDir, '.claude', 'skills', 'qcet-plan-executor');
    if (fs.existsSync(executorSkill)) {
      fs.rmSync(executorSkill, { recursive: true, force: true });
    }
  }

  // 6. Apply Task setup.patch if present and contains valid patch headers
  const taskDir = path.join(repoRoot, 'benchmarks', 'live', 'tasks', task);
  const patchPath = path.join(taskDir, 'setup.patch');
  if (fs.existsSync(patchPath) && fs.statSync(patchPath).size > 0) {
    const patchContent = fs.readFileSync(patchPath, 'utf8');
    if (patchContent.includes('diff --git') || patchContent.includes('--- a/')) {
      run(`git apply --whitespace=nowarn "${patchPath}"`, targetDir, { silent: true });
    }
  }

  // 7. Copy task plan.md into trial directory
  const planPath = path.join(taskDir, 'plan.md');
  if (fs.existsSync(planPath)) {
    fs.copyFileSync(planPath, path.join(targetDir, 'plan.md'));
  }

  // 8. Commit setup baseline to record BENCHMARK_START_SHA
  // Any files modified or created after this point will belong strictly to the agent under evaluation
  run('git add -A && git commit -m "chore(benchmark): benchmark start baseline"', targetDir, { silent: true });
  const benchmarkStartSha = run('git rev-parse HEAD', targetDir, { silent: true });
  fs.writeFileSync(path.join(targetDir, '.qcet-benchmark-start-sha'), benchmarkStartSha, 'utf8');

  return {
    trialId,
    targetDir,
    workloadBaseSha,
    harnessSha: arm === 'A' ? 'native' : harnessSha,
    benchmarkStartSha
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
