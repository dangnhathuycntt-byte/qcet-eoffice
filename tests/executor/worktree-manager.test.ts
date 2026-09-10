import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  getRepoRoot,
  getWorktreesBaseDir,
  createShardWorktree,
  inspectWorktreeDiff,
  integrateWorktree,
  cleanupWorktree,
  reapStaleWorktrees,
} from '../../scripts/lib/executor-contracts.mjs';

test('worktree-manager: getRepoRoot and getWorktreesBaseDir return valid paths', () => {
  const root = getRepoRoot();
  assert.ok(fs.existsSync(root));
  assert.ok(fs.existsSync(path.join(root, '.git')));

  const wtDir = getWorktreesBaseDir(root);
  assert.ok(wtDir.endsWith(path.join('.claude', 'worktrees')));
});

test('worktree-manager: full lifecycle (create -> modify -> inspect -> integrate -> cleanup)', () => {
  const repoRoot = getRepoRoot();
  const runId = `test-run-${Date.now()}`;
  const shardId = 'shard-sample';

  let wtInfo;
  const testFileRel = `tests/executor/.test-wt-artifact-${Date.now()}.txt`;
  const mainFileAbs = path.join(repoRoot, testFileRel);

  try {
    // 1. Create worktree
    wtInfo = createShardWorktree(shardId, { runId, repoRoot });
    assert.ok(fs.existsSync(wtInfo.worktreePath));
    assert.ok(wtInfo.branchName.includes(shardId));

    // 2. Modify a file inside the worktree
    const wtFileAbs = path.join(wtInfo.worktreePath, testFileRel);
    fs.mkdirSync(path.dirname(wtFileAbs), { recursive: true });
    fs.writeFileSync(wtFileAbs, 'hello from isolated worktree', 'utf8');

    // 3. Inspect diff
    const diff = inspectWorktreeDiff(wtInfo.worktreePath);
    assert.equal(diff.hasChanges, true);
    assert.ok(diff.changedFiles.includes(testFileRel));
    assert.ok(diff.patch.includes('hello from isolated worktree'));

    // 4. Integrate back to main repo
    const intResult = integrateWorktree(wtInfo.worktreePath, { targetRepoRoot: repoRoot });
    assert.equal(intResult.success, true);
    assert.ok(fs.existsSync(mainFileAbs));
    assert.equal(fs.readFileSync(mainFileAbs, 'utf8'), 'hello from isolated worktree');
  } finally {
    // 5. Cleanup main artifact
    if (fs.existsSync(mainFileAbs)) {
      fs.unlinkSync(mainFileAbs);
    }
    // 6. Cleanup worktree
    if (wtInfo) {
      const cleanResult = cleanupWorktree(wtInfo.worktreePath, {
        repoRoot,
        branchName: wtInfo.branchName,
      });
      assert.equal(cleanResult.cleaned, true);
      assert.equal(fs.existsSync(wtInfo.worktreePath), false);
    }
  }
});

test('worktree-manager: reapStaleWorktrees cleans up target run worktrees', () => {
  const repoRoot = getRepoRoot();
  const runId = `stale-run-${Date.now()}`;

  const wtInfo = createShardWorktree('shard-stale', { runId, repoRoot });
  assert.ok(fs.existsSync(wtInfo.worktreePath));

  try {
    const reapResult = reapStaleWorktrees({ repoRoot, runId });
    assert.ok(reapResult.reapedCount >= 1);
    assert.equal(fs.existsSync(wtInfo.worktreePath), false);
  } finally {
    cleanupWorktree(wtInfo.worktreePath, { repoRoot, branchName: wtInfo.branchName });
  }
});
