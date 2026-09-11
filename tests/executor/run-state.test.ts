import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// We import the CJS module under test
import runState from '../../.claude/hooks/qcet-run-state.cjs';

const {
  sanitizeRunId,
  getRunDir,
  atomicWriteJson,
  readJson,
  writeWitness,
  claimFile,
} = runState;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const testRunsBase = path.join(rootDir, '.claude', 'executor-runs');

test('run-state: sanitizeRunId strips path traversal and invalid characters', () => {
  assert.equal(sanitizeRunId('valid-run-123_abc'), 'valid-run-123_abc');
  assert.equal(sanitizeRunId('../../escape/attempt'), 'escape-attempt');
  assert.equal(sanitizeRunId('/root/traversal/..'), 'root-traversal');
  assert.equal(sanitizeRunId('foo\\bar/baz'), 'foo-bar-baz');
  assert.equal(sanitizeRunId('run$@#!%*()'), 'run');
  assert.throws(() => sanitizeRunId(''), /Invalid run ID/);
  assert.throws(() => sanitizeRunId('../..'), /Invalid run ID/);
});

test('run-state: getRunDir never escapes .claude/executor-runs/', () => {
  const safeDir = getRunDir(rootDir, 'run-2026-09-11-test');
  const expectedPrefix = path.resolve(rootDir, '.claude', 'executor-runs');
  assert.ok(safeDir.startsWith(expectedPrefix));
  assert.equal(path.dirname(safeDir), expectedPrefix);

  const maliciousDir = getRunDir(rootDir, '../../../../etc/passwd');
  assert.ok(maliciousDir.startsWith(expectedPrefix));
  assert.equal(path.dirname(maliciousDir), expectedPrefix);
});

test('run-state: atomicWriteJson and readJson write atomically and read correctly', () => {
  const testDir = path.join(testRunsBase, 'test-atomic-' + Date.now());
  const filePath = path.join(testDir, 'meta.json');
  try {
    const data = { version: '2.3', active: true, count: 42 };
    atomicWriteJson(filePath, data);

    assert.ok(fs.existsSync(filePath));
    const loaded = readJson(filePath);
    assert.deepEqual(loaded, data);

    // Update atomically
    atomicWriteJson(filePath, { ...data, count: 43 });
    assert.deepEqual(readJson(filePath), { version: '2.3', active: true, count: 43 });
  } finally {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
});

test('run-state: appendEvent is removed in Lean V2 to prevent event firehose overhead', () => {
  assert.equal(
    (runState as any).appendEvent,
    undefined,
    'appendEvent must not be exported in Lean V2'
  );
});

test('run-state: writeWitness writes structured shard witness atomically', () => {
  const runId = 'test-witness-' + Date.now();
  const runDir = getRunDir(rootDir, runId);

  try {
    const witness = {
      root: '/Users/test/repo',
      baseRef: 'abc1234',
      shardId: 'shard-auth',
    };
    const witnessPath = writeWitness(runDir, 'shards/shard-auth/worktree.json', witness);
    assert.ok(fs.existsSync(witnessPath));
    assert.deepEqual(readJson(witnessPath), witness);
  } finally {
    if (fs.existsSync(runDir)) {
      fs.rmSync(runDir, { recursive: true, force: true });
    }
  }
});

test('run-state: claimFile allows same-owner re-entry but rejects a second shard', () => {
  const runId = 'test-claim-' + Date.now();
  const runDir = getRunDir(rootDir, runId);

  try {
    const file = 'src/server/auth/session.ts';

    // Shard A first claim
    const claim1 = claimFile(runDir, 'shard-A', file);
    assert.equal(claim1.success, true);
    assert.equal(claim1.alreadyClaimed, false);
    assert.equal(claim1.shardId, 'shard-A');

    // Shard A re-entry (same shard claims again) -> allowed
    const claim2 = claimFile(runDir, 'shard-A', file);
    assert.equal(claim2.success, true);
    assert.equal(claim2.alreadyClaimed, true);
    assert.equal(claim2.shardId, 'shard-A');

    // Shard B claims the same file -> rejected!
    const claim3 = claimFile(runDir, 'shard-B', file);
    assert.equal(claim3.success, false);
    assert.equal(claim3.ownerShardId, 'shard-A');
    assert.equal(claim3.error, 'ALREADY_CLAIMED');
  } finally {
    if (fs.existsSync(runDir)) {
      fs.rmSync(runDir, { recursive: true, force: true });
    }
  }
});
