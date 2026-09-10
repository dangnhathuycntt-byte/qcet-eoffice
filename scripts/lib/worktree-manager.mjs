/**
 * QCET Plan Executor - Worktree Lifecycle Manager
 * Implements E04: Safe isolated worktree creation, change extraction,
 * atomic integration back to canonical workspace, and leak-proof cleanup.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { normalizePath } from './canonical-path-matcher.cjs';

/**
 * Get repo root directory.
 * @param {string} [startDir=process.cwd()]
 * @returns {string}
 */
export function getRepoRoot(startDir = process.cwd()) {
  try {
    const root = execSync('git rev-parse --show-toplevel', {
      cwd: startDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return root || startDir;
  } catch (_) {
    return startDir;
  }
}

/**
 * Get the base directory for QCET worktrees.
 * @param {string} [repoRoot]
 * @returns {string}
 */
export function getWorktreesBaseDir(repoRoot = getRepoRoot()) {
  return path.join(repoRoot, '.claude', 'worktrees');
}

/**
 * Sanitize identifier for git branch and path names.
 * @param {string} val
 * @returns {string}
 */
function sanitizeName(val) {
  return String(val || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Create an isolated git worktree for a shard.
 * @param {string} shardId
 * @param {Object} options
 * @param {string} [options.runId] - Unique run ID
 * @param {string} [options.baseRef='HEAD'] - Git ref to branch from
 * @param {string} [options.repoRoot] - Repository root
 * @returns {{ worktreePath: string, branchName: string, shardId: string, runId: string }}
 */
export function createShardWorktree(shardId, options = {}) {
  const repoRoot = options.repoRoot || getRepoRoot();
  const runId = options.runId || `run-${Date.now()}`;
  const baseRef = options.baseRef || 'HEAD';
  const cleanShardId = sanitizeName(shardId);
  const cleanRunId = sanitizeName(runId);

  const branchName = `qcet-wt-${cleanRunId}-${cleanShardId}`;
  const baseDir = getWorktreesBaseDir(repoRoot);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const worktreePath = path.join(baseDir, `qcet-${cleanRunId}-${cleanShardId}`);

  // Ensure clean state if directory already exists
  if (fs.existsSync(worktreePath)) {
    cleanupWorktree(worktreePath, { repoRoot, branchName });
  }

  // Check if branch already exists and delete if stale
  try {
    execSync(`git rev-parse --verify "${branchName}"`, {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    execSync(`git branch -D "${branchName}"`, {
      cwd: repoRoot,
      stdio: 'ignore',
    });
  } catch (_) {}

  // Create the worktree with a fresh branch from baseRef
  execSync(`git worktree add -b "${branchName}" "${worktreePath}" "${baseRef}"`, {
    cwd: repoRoot,
    stdio: 'pipe',
  });

  // Resolve base commit SHA to enable reliable diffs even after commits inside worktree
  let baseCommitSha = '';
  try {
    baseCommitSha = execSync(`git rev-parse "${baseRef}"`, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (_) {}

  // Write metadata file
  try {
    fs.writeFileSync(
      path.join(worktreePath, '.qcet-worktree-meta.json'),
      JSON.stringify({ shardId, runId, branchName, baseRef, baseCommitSha }, null, 2),
      'utf8'
    );
  } catch (_) {}

  return {
    worktreePath,
    branchName,
    shardId,
    runId,
    baseCommitSha,
  };
}

/**
 * Inspect changes made inside an isolated worktree.
 * Automatically commits uncommitted changes inside the worktree if needed.
 * @param {string} worktreePath
 * @param {Object} [options]
 * @param {string} [options.baseRef]
 * @returns {{ changedFiles: string[], patch: string, statusText: string, hasChanges: boolean }}
 */
export function inspectWorktreeDiff(worktreePath, options = {}) {
  if (!fs.existsSync(worktreePath)) {
    throw new Error(`Worktree path does not exist: ${worktreePath}`);
  }

  // Attempt to read metadata
  let meta = null;
  const metaPath = path.join(worktreePath, '.qcet-worktree-meta.json');
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (_) {}
  }

  const baseRef = options.baseRef || meta?.baseCommitSha || 'HEAD';

  // Check status
  const statusOutput = execSync('git status --porcelain', {
    cwd: worktreePath,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

  // If there are uncommitted files, stage and commit them inside worktree
  if (statusOutput.length > 0) {
    execSync('git add -A', { cwd: worktreePath, stdio: 'ignore' });
    execSync('git commit -m "qcet: isolated shard snapshot" --no-verify', {
      cwd: worktreePath,
      stdio: 'ignore',
    });
  }

  // Get full diff from baseRef
  let patch = '';
  try {
    patch = execSync(`git diff ${baseRef} HEAD`, {
      cwd: worktreePath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (_) {
    patch = '';
  }

  // Remove .qcet-worktree-meta.json from patch if present
  if (patch.includes('.qcet-worktree-meta.json')) {
    // Exclude meta file from patch
    try {
      patch = execSync(`git diff ${baseRef} HEAD -- ":(exclude).qcet-worktree-meta.json"`, {
        cwd: worktreePath,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch (_) {}
  }

  // Get list of changed files relative to repo root
  let changedFiles = [];
  try {
    const rawFiles = execSync(`git diff --name-only ${baseRef} HEAD -- ":(exclude).qcet-worktree-meta.json"`, {
      cwd: worktreePath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (rawFiles.length > 0) {
      changedFiles = rawFiles
        .split('\n')
        .map((f) => normalizePath(f.trim()))
        .filter((f) => f && f !== '.qcet-worktree-meta.json');
    }
  } catch (_) {}

  return {
    hasChanges: changedFiles.length > 0 || patch.trim().length > 0,
    changedFiles,
    patch,
    statusText: statusOutput,
  };
}

/**
 * Integrate changes from an isolated worktree back into target repo working directory.
 * Uses atomic patch application with pre-check validation.
 * @param {string} worktreePath
 * @param {Object} [options]
 * @param {string} [options.targetRepoRoot] - Destination repo root (default: current git root)
 * @param {string} [options.baseRef='HEAD']
 * @returns {{ success: boolean, appliedFiles: string[], error?: string }}
 */
export function integrateWorktree(worktreePath, options = {}) {
  const targetRepoRoot = options.targetRepoRoot || getRepoRoot();
  const baseRef = options.baseRef;

  const diffResult = inspectWorktreeDiff(worktreePath, { baseRef });
  if (!diffResult.hasChanges || diffResult.changedFiles.length === 0) {
    return {
      success: true,
      appliedFiles: [],
      error: null,
    };
  }

  const patchFile = path.join(
    getWorktreesBaseDir(targetRepoRoot),
    `temp-patch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.patch`
  );

  try {
    fs.writeFileSync(patchFile, diffResult.patch, 'utf8');

    // Pre-check if patch can apply cleanly
    try {
      execSync(`git apply --check --whitespace=nowarn "${patchFile}"`, {
        cwd: targetRepoRoot,
        stdio: 'pipe',
      });
    } catch (checkErr) {
      const stderr = checkErr.stderr ? checkErr.stderr.toString('utf8') : checkErr.message;
      return {
        success: false,
        appliedFiles: [],
        error: `Patch validation failed (conflict or mismatch): ${stderr}`,
      };
    }

    // Apply the patch to target repo
    execSync(`git apply --whitespace=nowarn "${patchFile}"`, {
      cwd: targetRepoRoot,
      stdio: 'pipe',
    });

    return {
      success: true,
      appliedFiles: diffResult.changedFiles,
      error: null,
    };
  } finally {
    if (fs.existsSync(patchFile)) {
      try {
        fs.unlinkSync(patchFile);
      } catch (_) {}
    }
  }
}

/**
 * Clean up a worktree and its associated branch.
 * @param {string} worktreePath
 * @param {Object} [options]
 * @param {string} [options.repoRoot]
 * @param {string} [options.branchName]
 * @param {boolean} [options.deleteBranch=true]
 * @returns {{ cleaned: boolean, error?: string }}
 */
export function cleanupWorktree(worktreePath, options = {}) {
  const repoRoot = options.repoRoot || getRepoRoot();
  const deleteBranch = options.deleteBranch !== false;
  let branchName = options.branchName;

  try {
    if (!branchName && fs.existsSync(worktreePath)) {
      try {
        branchName = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: worktreePath,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
      } catch (_) {}
    }

    // Remove worktree
    try {
      execSync(`git worktree remove --force "${worktreePath}"`, {
        cwd: repoRoot,
        stdio: 'ignore',
      });
    } catch (_) {}

    // Ensure directory on disk is removed if git worktree remove left it
    if (fs.existsSync(worktreePath)) {
      fs.rmSync(worktreePath, { recursive: true, force: true });
    }

    // Prune worktree metadata
    try {
      execSync('git worktree prune', {
        cwd: repoRoot,
        stdio: 'ignore',
      });
    } catch (_) {}

    // Delete branch if requested
    if (deleteBranch && branchName && branchName.startsWith('qcet-wt-')) {
      try {
        execSync(`git branch -D "${branchName}"`, {
          cwd: repoRoot,
          stdio: 'ignore',
        });
      } catch (_) {}
    }

    return { cleaned: true };
  } catch (err) {
    return { cleaned: false, error: err.message };
  }
}

/**
 * Reap stale or orphaned QCET worktrees.
 * @param {Object} [options]
 * @param {string} [options.repoRoot]
 * @param {number} [options.maxAgeMs=86400000] - Default: 24 hours
 * @param {string} [options.runId] - If given, cleans all worktrees for this run
 * @returns {{ reapedCount: number, reapedPaths: string[] }}
 */
export function reapStaleWorktrees(options = {}) {
  const repoRoot = options.repoRoot || getRepoRoot();
  const maxAgeMs = options.maxAgeMs || 24 * 60 * 60 * 1000;
  const targetRunId = options.runId ? sanitizeName(options.runId) : null;
  const baseDir = getWorktreesBaseDir(repoRoot);

  const reapedPaths = [];

  if (!fs.existsSync(baseDir)) {
    return { reapedCount: 0, reapedPaths };
  }

  const entries = fs.readdirSync(baseDir);
  const now = Date.now();

  for (const entry of entries) {
    if (!entry.startsWith('qcet-')) continue;

    const fullPath = path.join(baseDir, entry);
    let shouldReap = false;

    if (targetRunId && entry.includes(targetRunId)) {
      shouldReap = true;
    } else {
      try {
        const stat = fs.statSync(fullPath);
        const age = now - stat.mtimeMs;
        if (age > maxAgeMs) {
          shouldReap = true;
        }
      } catch (_) {
        shouldReap = true;
      }
    }

    if (shouldReap) {
      cleanupWorktree(fullPath, { repoRoot });
      reapedPaths.push(fullPath);
    }
  }

  return {
    reapedCount: reapedPaths.length,
    reapedPaths,
  };
}
