import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ResearchCache,
  resolveAdaptivePolicy,
  buildAdaptiveContextPacket,
} from '../../scripts/lib/adaptive-context.mjs';

test('adaptive-context: ResearchCache stores, retrieves, and isolates namespaces', () => {
  const cacheA = new ResearchCache('run-A');
  const cacheB = new ResearchCache('run-B');

  cacheA.set('schema-query', { tables: ['User', 'Task'] });
  assert.deepEqual(cacheA.get('schema-query'), { tables: ['User', 'Task'] });

  // Different namespace should not see cacheA's value
  assert.equal(cacheB.get('schema-query'), null);

  // Clear cache
  cacheA.clear();
  assert.equal(cacheA.get('schema-query'), null);
});

test('adaptive-context: resolveAdaptivePolicy selects correct risk, effort, and lenses', () => {
  // Critical auth shard
  const authShard = {
    id: 'shard-auth',
    owns: ['src/server/auth.ts', 'src/server/session.ts'],
  };
  const authPolicy = resolveAdaptivePolicy(authShard);
  assert.equal(authPolicy.risk, 'critical');
  assert.equal(authPolicy.effort, 'xhigh');
  assert.ok(authPolicy.lenses.includes('security'));
  assert.ok(authPolicy.lenses.includes('data-integrity'));
  assert.equal(authPolicy.requireAdversarialVerification, true);
  assert.equal(authPolicy.recommendedIsolation, 'worktree');

  // Low risk UI shard
  const uiShard = {
    id: 'shard-ui',
    owns: ['src/components/button.tsx', 'src/components/badge.tsx'],
  };
  const uiPolicy = resolveAdaptivePolicy(uiShard);
  assert.equal(uiPolicy.risk, 'low');
  assert.equal(uiPolicy.effort, 'low');
  assert.ok(uiPolicy.lenses.includes('ux'));
  assert.equal(uiPolicy.requireAdversarialVerification, false);
});

test('adaptive-context: buildAdaptiveContextPacket extracts signatures and calculates token savings', () => {
  const tmpFile = path.resolve(process.cwd(), 'tests/executor/fixtures/sample-source.ts');
  fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
  fs.writeFileSync(
    tmpFile,
    `
export interface UserContext {
  userId: string;
  role: string;
}

export type Permission = 'read' | 'write' | 'admin';

export function calculateAccess(ctx: UserContext): boolean {
  // Heavy implementation body that shouldn't clog context
  const a = 1 + 2;
  const b = a * 3;
  const c = b - 4;
  console.log(a, b, c);
  return true;
}
`,
    'utf8'
  );

  const shard = {
    id: 'shard-test',
    owns: ['tests/executor/fixtures/sample-source.ts'],
  };

  const packet = buildAdaptiveContextPacket(shard, { repoRoot: process.cwd() });
  assert.equal(packet.shardId, 'shard-test');
  assert.ok(packet.originalBytes > 0);
  assert.ok(packet.compressedBytes < packet.originalBytes);
  assert.ok(packet.tokenSavingsPercent > 0);
  assert.ok(packet.signatures['tests/executor/fixtures/sample-source.ts'].includes('export interface UserContext'));

  // Cleanup
  fs.rmSync(tmpFile, { force: true });
});
