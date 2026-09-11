import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ResearchCache,
  resolveAdaptivePolicy,
  buildAdaptiveContextPacket,
  createEvidencePacket,
  compressDependencyContext,
  formatVerifierPacket,
  formatRepairPacket,
  formatIntegrationShardSummary,
} from '../../scripts/lib/adaptive-context.mjs';
import { selectIntegrationReviewDimensions } from '../../scripts/lib/executor-contracts.mjs';

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

test('adaptive-context: createEvidencePacket formats compact canonical evidence', () => {
  const shard = {
    id: 'shard-user-auth',
    requirements: ['REQ-01', 'REQ-02'],
    acceptanceCriteria: ['Valid JWT passes', 'Invalid token returns 401'],
  };

  const state = {
    implementation: {
      changedFiles: ['src/server/auth.ts'],
      contractDelta: [{ symbol: 'validateToken', change: 'added' }],
      testsRun: ['tests/auth.test.ts'],
    },
    lastVerification: {
      verdict: 'PASSED',
      issues: [],
      risks: ['Token replay risk mitigated by nonce'],
    },
    research: {
      claims: [{ claim: 'JWT expires in 15m', sourceUrl: 'https://jwt.io' }],
    },
  };

  const packet = createEvidencePacket(shard, state);
  assert.equal(packet.shardId, 'shard-user-auth');
  assert.deepEqual(packet.requirements, ['REQ-01', 'REQ-02']);
  assert.deepEqual(packet.changedFiles, ['src/server/auth.ts']);
  assert.equal(packet.verificationVerdict, 'PASSED');
  assert.equal(packet.relevantResearchClaims.length, 1);
  assert.equal(packet.relevantResearchClaims[0].sourceUrl, 'https://jwt.io');

  // Verify compression across dependencies
  const compressedDeps = compressDependencyContext([state]);
  assert.equal(compressedDeps.length, 1);
  assert.equal(compressedDeps[0].verificationVerdict, 'PASSED');
});

test('adaptive-context: selectIntegrationReviewDimensions adapts review lenses to blast radius', () => {
  // UI-only case
  const uiManifest = {
    shards: [
      { id: 'shard-ui', owns: ['src/components/button.tsx', 'src/components/card.tsx'], risk: 'low' },
    ],
  };
  const uiDims = selectIntegrationReviewDimensions(uiManifest).map((d) => d.id);
  assert.ok(uiDims.includes('semantics'));
  assert.ok(uiDims.includes('regression'));
  assert.equal(uiDims.includes('authorization'), false, 'UI-only should not run auth review');
  assert.equal(uiDims.includes('migration-safety'), false, 'UI-only should not run migration review');

  // Auth/API case
  const authManifest = {
    shards: [
      { id: 'shard-api', owns: ['src/app/api/auth/route.ts', 'src/server/auth/session.ts'], risk: 'high' },
    ],
  };
  const authDims = selectIntegrationReviewDimensions(authManifest).map((d) => d.id);
  assert.ok(authDims.includes('contracts'));
  assert.ok(authDims.includes('authorization'));
  assert.ok(authDims.includes('regression'));

  // Prisma migration case
  const prismaManifest = {
    shards: [
      { id: 'shard-db', owns: ['prisma/schema.prisma', 'prisma/migrations/01_init/migration.sql'], risk: 'medium' },
    ],
  };
  const prismaDims = selectIntegrationReviewDimensions(prismaManifest).map((d) => d.id);
  assert.ok(prismaDims.includes('contracts'));
  assert.ok(prismaDims.includes('data-integrity'));
  assert.ok(prismaDims.includes('regression'));
  assert.equal(prismaDims.includes('authorization'), false);

  // Critical cross-cutting case
  const criticalManifest = {
    shards: [
      { id: 'shard-core', owns: ['src/lib/core.ts', 'prisma/schema.prisma'], risk: 'critical' },
    ],
  };
  const criticalDims = selectIntegrationReviewDimensions(criticalManifest).map((d) => d.id);
  assert.equal(criticalDims.length, 5, 'Critical risk requires all 5 core integration review dimensions');
});

test('adaptive-context: receiver formats provide tailored, minimal evidence', () => {
  const shard = {
    id: 'shard-billing',
    requirements: ['REQ-BILL-01'],
    acceptanceCriteria: ['Invoice PDF generates on settlement'],
    owns: ['src/billing/invoice.ts'],
  };

  const state = {
    implementation: {
      changedFiles: ['src/billing/invoice.ts'],
      summary: 'Added invoice PDF generation using PDFKit.',
      contractDelta: [{ symbol: 'generateInvoicePdf', change: 'added' }],
      testsRun: ['tests/billing/invoice.test.ts'],
    },
    lastVerification: {
      verdict: 'fail',
      issues: [
        { id: 'ISS-1', severity: 'high', file: 'src/billing/invoice.ts', evidence: 'Missing tax calculation' },
      ],
      risks: ['Currency exchange API timeout'],
    },
  };

  // Verifier packet: objective diffs, tests, contracts, zero recon rambling
  const vPacket = formatVerifierPacket(shard, state);
  assert.equal(vPacket.shardId, 'shard-billing');
  assert.deepEqual(vPacket.changedFiles, ['src/billing/invoice.ts']);
  assert.equal(vPacket.implementationSummary, 'Added invoice PDF generation using PDFKit.');
  assert.equal(vPacket.currentState, undefined);
  assert.equal(vPacket.recon, undefined);

  // Repair packet: findings, changed files, target tests
  const rPacket = formatRepairPacket(shard, state);
  assert.equal(rPacket.shardId, 'shard-billing');
  assert.equal(rPacket.confirmedFindings.length, 1);
  assert.equal(rPacket.confirmedFindings[0].id, 'ISS-1');
  assert.deepEqual(rPacket.targetedTests, ['tests/billing/invoice.test.ts']);

  // Integration summary: high/critical findings and contract deltas
  const summary = formatIntegrationShardSummary({ 'shard-billing': state });
  assert.ok(summary['shard-billing']);
  assert.equal(summary['shard-billing'].highOrCriticalFindings.length, 1);
  assert.equal(summary['shard-billing'].highOrCriticalRisks.length, 1);

  // Integration summary: case-insensitivity and alias-awareness (severity vs level)
  const caseAndAliasState = {
    implementation: { changedFiles: [] },
    lastVerification: {
      issues: [
        { id: 'ISS-2', severity: 'HIGH', file: 'a.ts' },
        { id: 'ISS-3', level: 'critical', file: 'b.ts' },
        { id: 'ISS-4', severity: 'Low', file: 'c.ts' },
      ],
    },
  };
  const caseSummary = formatIntegrationShardSummary({ 'shard-alias': caseAndAliasState });
  assert.equal(caseSummary['shard-alias'].highOrCriticalFindings.length, 2);
  assert.deepEqual(
    caseSummary['shard-alias'].highOrCriticalFindings.map((f) => f.id),
    ['ISS-2', 'ISS-3']
  );
});

test('adaptive-context: ResearchCache isolates cache namespaces across different runs', () => {
  const run1Cache = new ResearchCache(`run-1-${Date.now()}`);
  const run2Cache = new ResearchCache(`run-2-${Date.now()}`);

  run1Cache.set('How to configure CORS?', { answer: 'Use cors middleware' });

  assert.ok(run1Cache.get('How to configure CORS?'));
  assert.equal(run2Cache.get('How to configure CORS?'), null);
});

