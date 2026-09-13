import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  normalizePath,
  stripWildcards,
  globToRegex,
  matchesOwnership,
  pathsOverlap,
  toRepoRelativePath,
  isExternalAbsolutePath,
} = require('../.claude/hooks/path-matcher.cjs');

test('path-matcher: normalizePath strips cwd, leading dots, and worktree prefix', () => {
  const cwd = '/Users/test/repo';
  assert.equal(normalizePath('./src/app.ts', cwd), 'src/app.ts');
  assert.equal(normalizePath('/Users/test/repo/src/app.ts', cwd), 'src/app.ts');
  assert.equal(normalizePath('.claude/worktrees/shard-1/src/app.ts', cwd), 'src/app.ts');
  assert.equal(normalizePath('/Users/test/repo/.claude/worktrees/shard-1/src/app.ts', cwd), 'src/app.ts');
  assert.equal(normalizePath('src//components///Button.tsx', cwd), 'src/components/Button.tsx');
});

test('path-matcher: E07 fix - external absolute paths NEVER match repo-relative patterns', () => {
  const cwd = '/Users/test/repo';

  // External absolute path containing /src/app.ts
  const externalPath1 = '/tmp/other-workspace/src/app.ts';
  const externalPath2 = '/Users/other-user/project/src/app.ts';
  const externalPath3 = '/var/data/src/utils/math.ts';

  // Repo-relative patterns
  assert.equal(matchesOwnership(externalPath1, 'src/app.ts', cwd), false);
  assert.equal(matchesOwnership(externalPath1, 'src/**', cwd), false);
  assert.equal(matchesOwnership(externalPath2, 'src/app.ts', cwd), false);
  assert.equal(matchesOwnership(externalPath3, 'src/utils/math.ts', cwd), false);
  assert.equal(matchesOwnership(externalPath3, 'src/**', cwd), false);

  // External absolute path inside another repository's worktree:
  const externalWorktreePath = '/tmp/other/.claude/worktrees/x/src/owned.ts';
  assert.equal(isExternalAbsolutePath(externalWorktreePath, cwd), true);
  assert.equal(matchesOwnership(externalWorktreePath, 'src/**', cwd), false);
  assert.equal(matchesOwnership(externalWorktreePath, 'src/owned.ts', cwd), false);
  assert.equal(toRepoRelativePath(externalWorktreePath, cwd), externalWorktreePath);

  // But internal worktree path MUST match
  const internalWorktreePath = '/Users/test/repo/.claude/worktrees/shard-1/src/owned.ts';
  assert.equal(isExternalAbsolutePath(internalWorktreePath, cwd), false);
  assert.equal(matchesOwnership(internalWorktreePath, 'src/**', cwd), true);
  assert.equal(matchesOwnership(internalWorktreePath, 'src/owned.ts', cwd), true);
  assert.equal(toRepoRelativePath(internalWorktreePath, cwd), 'src/owned.ts');

  // But internal path MUST match
  const internalPath = '/Users/test/repo/src/app.ts';
  assert.equal(matchesOwnership(internalPath, 'src/app.ts', cwd), true);
  assert.equal(matchesOwnership(internalPath, 'src/**', cwd), true);
  assert.equal(matchesOwnership('src/app.ts', 'src/**', cwd), true);
  assert.equal(matchesOwnership('src/app.ts', 'src/app.ts', cwd), true);
});

test('path-matcher: glob matching and directory boundaries', () => {
  const cwd = '/Users/test/repo';

  // Single star does not match multi-level deep paths
  assert.equal(matchesOwnership('src/foo.ts', 'src/*', cwd), true);
  assert.equal(matchesOwnership('src/nested/foo.ts', 'src/*', cwd), false);

  // Double star matches multi-level deep paths
  assert.equal(matchesOwnership('src/nested/foo.ts', 'src/**', cwd), true);
  assert.equal(matchesOwnership('src/nested/deep/foo.ts', 'src/**', cwd), true);

  // Directory prefix without wildcard matches all children
  assert.equal(matchesOwnership('src/components/Button.tsx', 'src/components', cwd), true);
  assert.equal(matchesOwnership('src/components', 'src/components', cwd), true);
  assert.equal(matchesOwnership('src/components-other/Button.tsx', 'src/components', cwd), false);
});

test('path-matcher: pathsOverlap detects overlaps and prevents false positives', () => {
  const cwd = '/Users/test/repo';

  // Exact matches overlap
  assert.equal(pathsOverlap('src/app.ts', 'src/app.ts', cwd), true);

  // Glob containment overlaps
  assert.equal(pathsOverlap('src/**', 'src/app.ts', cwd), true);
  assert.equal(pathsOverlap('src/app.ts', 'src/**', cwd), true);
  assert.equal(pathsOverlap('src/*', 'src/foo.ts', cwd), true);

  // Disjoint paths do NOT overlap
  assert.equal(pathsOverlap('src/domain/**', 'src/ui/**', cwd), false);
  assert.equal(pathsOverlap('src/domain/task.ts', 'src/domain/user.ts', cwd), false);
  assert.equal(pathsOverlap('tests/domain/**', 'src/domain/**', cwd), false);
});

test('path-matcher: toRepoRelativePath handles worktrees and repo root', () => {
  const cwd = '/Users/test/repo';

  assert.equal(toRepoRelativePath('/Users/test/repo/src/app.ts', cwd), 'src/app.ts');
  assert.equal(toRepoRelativePath('/Users/test/repo/.claude/worktrees/wt-1/src/app.ts', cwd), 'src/app.ts');
  assert.equal(toRepoRelativePath('src/app.ts', cwd), 'src/app.ts');

  // External path remains absolute and does not pretend to be repo-relative
  const external = '/tmp/outside/file.txt';
  assert.equal(toRepoRelativePath(external, cwd), '/tmp/outside/file.txt');
});
