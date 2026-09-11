import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import runState from '../../.claude/hooks/qcet-run-state.cjs';

const { getRunDir, writeWitness } = runState;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const ownershipGuard = path.join(rootDir, '.claude', 'hooks', 'pre-tool-use-ownership-guard');

function runHook(hookPath: string, stdinJson: Record<string, any>, env: Record<string, any> = {}) {
  const res = spawnSync('node', [hookPath], {
    cwd: stdinJson.cwd || rootDir,
    input: JSON.stringify(stdinJson),
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });
  return {
    status: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
  };
}

function initTempGitRepo(): { dir: string; headCommit: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcet-git-test-'));
  spawnSync('git', ['init'], { cwd: tmpDir });
  spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: tmpDir });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpDir });
  fs.writeFileSync(path.join(tmpDir, 'init.txt'), 'init');
  spawnSync('git', ['add', '.'], { cwd: tmpDir });
  spawnSync('git', ['commit', '-m', 'initial commit'], { cwd: tmpDir });
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: tmpDir, encoding: 'utf8' }).stdout.trim();
  return { dir: tmpDir, headCommit: commit };
}

test('worktree-guard: missing required worktree witness during executor run exits with WORKTREE_INVALID', () => {
  const repo = initTempGitRepo();
  const runId = 'test-run-missing-witness-' + Date.now();
  const shardId = 'shard-missing';

  try {
    const res = runHook(ownershipGuard, {
      tool_name: 'Write',
      agent_type: 'qcet-builder',
      subagent_label: 'builder:shard-missing',
      cwd: repo.dir,
      tool_input: { file_path: path.join(repo.dir, 'src/test.ts'), content: 'code' },
    }, {
      QCET_RUN_ID: runId,
      CLAUDE_PROJECT_DIR: rootDir,
      QCET_ACTIVE_SHARDS: JSON.stringify([{ id: shardId, owns: ['src/**'], antiOwns: [] }]),
    });

    assert.equal(res.status, 2);
    assert.ok(res.stderr.includes('WORKTREE_INVALID'), `Expected WORKTREE_INVALID in: ${res.stderr}`);
    assert.ok(res.stderr.includes('witness'), `Expected witness mention in: ${res.stderr}`);
  } finally {
    fs.rmSync(repo.dir, { recursive: true, force: true });
    const runDir = path.join(rootDir, '.claude', 'executor-runs', runId);
    if (fs.existsSync(runDir)) fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('worktree-guard: wrong cwd root fails with WORKTREE_INVALID', () => {
  const repo = initTempGitRepo();
  const otherRepo = initTempGitRepo();
  const runId = 'test-run-wrong-root-' + Date.now();
  const shardId = 'shard-root';
  const runDir = getRunDir(rootDir, runId);

  try {
    writeWitness(runDir, `shards/${shardId}/worktree.json`, {
      root: repo.dir,
      baseCommit: repo.headCommit,
      shardId,
    });

    // Calling hook with cwd pointing to otherRepo
    const res = runHook(ownershipGuard, {
      tool_name: 'Write',
      agent_type: 'qcet-builder',
      subagent_label: `builder:${shardId}`,
      cwd: otherRepo.dir,
      tool_input: { file_path: path.join(otherRepo.dir, 'src/test.ts'), content: 'code' },
    }, {
      QCET_RUN_ID: runId,
      CLAUDE_PROJECT_DIR: rootDir,
      QCET_ACTIVE_SHARDS: JSON.stringify([{ id: shardId, owns: ['src/**'], antiOwns: [] }]),
    });

    assert.equal(res.status, 2);
    assert.ok(res.stderr.includes('WORKTREE_INVALID'));
    assert.ok(res.stderr.includes('root mismatch'));
  } finally {
    fs.rmSync(repo.dir, { recursive: true, force: true });
    fs.rmSync(otherRepo.dir, { recursive: true, force: true });
    if (fs.existsSync(runDir)) fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('worktree-guard: wrong pinned base ancestry fails with WORKTREE_INVALID', () => {
  const repo = initTempGitRepo();
  const runId = 'test-run-wrong-ancestry-' + Date.now();
  const shardId = 'shard-ancestry';
  const runDir = getRunDir(rootDir, runId);

  try {
    // Fabricated commit SHA that is not in repo history
    const fakeCommit = '0000000000000000000000000000000000000000';
    writeWitness(runDir, `shards/${shardId}/worktree.json`, {
      root: repo.dir,
      baseCommit: fakeCommit,
      shardId,
    });

    const res = runHook(ownershipGuard, {
      tool_name: 'Write',
      agent_type: 'qcet-builder',
      subagent_label: `builder:${shardId}`,
      cwd: repo.dir,
      tool_input: { file_path: path.join(repo.dir, 'src/test.ts'), content: 'code' },
    }, {
      QCET_RUN_ID: runId,
      CLAUDE_PROJECT_DIR: rootDir,
      QCET_ACTIVE_SHARDS: JSON.stringify([{ id: shardId, owns: ['src/**'], antiOwns: [] }]),
    });

    assert.equal(res.status, 2);
    assert.ok(res.stderr.includes('WORKTREE_INVALID'));
    assert.ok(res.stderr.includes('ancestry mismatch'));
  } finally {
    fs.rmSync(repo.dir, { recursive: true, force: true });
    if (fs.existsSync(runDir)) fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('worktree-guard: shard B attempting to mutate a file claimed by shard A is blocked', () => {
  const repo = initTempGitRepo();
  const runId = 'test-run-claim-conflict-' + Date.now();
  const runDir = getRunDir(rootDir, runId);
  const shardA = 'shard-A';
  const shardB = 'shard-B';

  try {
    writeWitness(runDir, `shards/${shardA}/worktree.json`, {
      root: repo.dir,
      baseCommit: repo.headCommit,
      shardId: shardA,
    });
    writeWitness(runDir, `shards/${shardB}/worktree.json`, {
      root: repo.dir,
      baseCommit: repo.headCommit,
      shardId: shardB,
    });

    const targetFile = path.join(repo.dir, 'src/shared.ts');

    // Shard A modifies first -> claims it
    const resA = runHook(ownershipGuard, {
      tool_name: 'Write',
      agent_type: 'qcet-builder',
      subagent_label: `builder:${shardA}`,
      cwd: repo.dir,
      tool_input: { file_path: targetFile, content: 'code A' },
    }, {
      QCET_RUN_ID: runId,
      CLAUDE_PROJECT_DIR: rootDir,
      QCET_ACTIVE_SHARDS: JSON.stringify([
        { id: shardA, owns: ['src/**'], antiOwns: [] },
        { id: shardB, owns: ['src/**'], antiOwns: [] },
      ]),
    });
    assert.equal(resA.status, 0);

    // Shard B modifies the same file -> rejected due to claim by shard A
    const resB = runHook(ownershipGuard, {
      tool_name: 'Write',
      agent_type: 'qcet-builder',
      subagent_label: `builder:${shardB}`,
      cwd: repo.dir,
      tool_input: { file_path: targetFile, content: 'code B' },
    }, {
      QCET_RUN_ID: runId,
      CLAUDE_PROJECT_DIR: rootDir,
      QCET_ACTIVE_SHARDS: JSON.stringify([
        { id: shardA, owns: ['src/**'], antiOwns: [] },
        { id: shardB, owns: ['src/**'], antiOwns: [] },
      ]),
    });
    assert.equal(resB.status, 2);
    assert.ok(resB.stderr.includes('already claimed'));
  } finally {
    fs.rmSync(repo.dir, { recursive: true, force: true });
    if (fs.existsSync(runDir)) fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('worktree-guard: outside executor run (QCET_RUN_ID absent), unmapped agent preserves fail-open behavior', () => {
  const repo = initTempGitRepo();
  try {
    const res = runHook(ownershipGuard, {
      tool_name: 'Write',
      agent_type: 'claude',
      cwd: repo.dir,
      tool_input: { file_path: path.join(repo.dir, 'test.ts'), content: 'console.log(1);' },
    }, {
      CLAUDE_PROJECT_DIR: rootDir,
    });
    // In interactive/manual session without QCET_RUN_ID and not a builder, exits 0
    assert.equal(res.status, 0);
  } finally {
    fs.rmSync(repo.dir, { recursive: true, force: true });
  }
});
