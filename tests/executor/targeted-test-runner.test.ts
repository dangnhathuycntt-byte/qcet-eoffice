import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findAllTestFiles,
  discoverTargetedTests,
  VerificationCache,
  getRepoRoot,
} from '../../scripts/lib/executor-contracts.mjs';

test('targeted-test-runner: findAllTestFiles returns existing test files in tests/', () => {
  const repoRoot = getRepoRoot();
  const testFiles = findAllTestFiles(`${repoRoot}/tests`);
  assert.ok(testFiles.length > 0);
  assert.ok(testFiles.some((f) => f.includes('session-revocation.test.ts')));
});

test('targeted-test-runner: discoverTargetedTests resolves test files from changed source file', () => {
  const repoRoot = getRepoRoot();
  const discovery = discoverTargetedTests(['src/server/auth/session-revocation.ts'], {
    rootDir: repoRoot,
  });

  assert.ok(discovery.discoveredCount > 0);
  assert.ok(discovery.testFiles.some((f) => f.includes('session-revocation.test.ts')));
});

test('targeted-test-runner: discoverTargetedTests incorporates valid testHints and excludes non-existent files', () => {
  const repoRoot = getRepoRoot();
  const discovery = discoverTargetedTests(['src/some/untested/file.ts'], {
    rootDir: repoRoot,
    testHints: ['tests/security/session-revocation.test.ts', 'tests/non-existent-file.test.ts'],
  });

  assert.ok(discovery.usedHints);
  assert.ok(discovery.testFiles.includes('tests/security/session-revocation.test.ts'));
  // Must NOT include non-existent file
  assert.ok(!discovery.testFiles.includes('tests/non-existent-file.test.ts'));
});

test('targeted-test-runner: discoverTargetedTests directly includes changed test file', () => {
  const repoRoot = getRepoRoot();
  const discovery = discoverTargetedTests(['tests/security/session-revocation.test.ts'], {
    rootDir: repoRoot,
  });

  assert.ok(discovery.testFiles.includes('tests/security/session-revocation.test.ts'));
});

test('targeted-test-runner: VerificationCache deduplicates results for identical git state', () => {
  const cache = new VerificationCache(`cache-test-${Date.now()}`);
  const hash = cache.getStateHash();
  assert.ok(hash);

  assert.equal(cache.get('my-check', hash), null);

  cache.set('my-check', { status: 'passed', verifiedCount: 15 }, hash);

  const cached = cache.get('my-check', hash);
  assert.ok(cached);
  assert.equal(cached.status, 'passed');
  assert.equal(cached.verifiedCount, 15);
});
