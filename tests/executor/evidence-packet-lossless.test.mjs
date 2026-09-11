import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEvidencePacket,
  compressDependencyContext,
  formatVerifierPacket,
  formatRepairPacket,
  formatIntegrationShardSummary,
  ResearchCache,
} from '../../scripts/lib/adaptive-context.mjs';

test('evidence-packet-lossless: critical fields survive compression without data loss', () => {
  const shard = {
    id: 'shard-identity-service',
    title: 'Identity Service Implementation',
    requirements: ['REQ-AUTH-101', 'REQ-AUTH-102', 'REQ-AUTH-103'],
    requirementDetails: [
      { id: 'REQ-AUTH-101', description: 'Authenticate users via token' },
      { id: 'REQ-AUTH-102', description: 'Issue signed JWT claims' },
      { id: 'REQ-AUTH-103', description: 'Enforce RBAC role checking' },
    ],
    acceptanceCriteria: [
      'Token verification rejects expired timestamps with 401',
      'Role hierarchy correctly resolves unit admin permissions',
      'Tampered signature triggers security audit log event',
    ],
    owns: ['src/server/identity/**', 'src/server/session.ts'],
    risk: 'critical',
  };

  const state = {
    shard,
    implementation: {
      changedFiles: [
        'src/server/identity/tokens.ts',
        'src/server/identity/rbac.ts',
        'src/server/session.ts',
      ],
      summary: 'Implemented token verification, claim signing, and RBAC checking.',
      contractDelta: [
        { symbol: 'verifyIdentityToken', change: 'added', file: 'src/server/identity/tokens.ts' },
        { symbol: 'checkRolePermission', change: 'modified', file: 'src/server/identity/rbac.ts' },
      ],
      testsRun: [
        'tests/identity/tokens.test.ts',
        'tests/identity/rbac.test.ts',
      ],
    },
    lastVerification: {
      verdict: 'fail',
      issues: [
        {
          id: 'ISS-AUTH-1',
          severity: 'critical',
          category: 'authorization-bypass',
          file: 'src/server/identity/rbac.ts',
          evidence: 'Missing null check on user role leads to privilege escalation.',
          impact: 'Unauthenticated requests can assume default role.',
          recommendedFix: 'Add explicit null check and throw UnauthorizedError.',
        },
        {
          id: 'ISS-AUTH-2',
          severity: 'high',
          category: 'token-replay',
          file: 'src/server/identity/tokens.ts',
          evidence: 'Nonce validation cache lacks TTL expiration.',
          impact: 'Memory unbounded growth under high load.',
          recommendedFix: 'Use LRU cache with 15m expiration.',
        },
      ],
      risks: [
        'Clock skew greater than 60s will cause spurious token rejections',
        'Redis cache partition may temporarily degrade role lookup speed',
      ],
    },
    research: {
      claims: [
        {
          claim: 'RFC 7519 mandates sub claim string encoding',
          source: 'https://tools.ietf.org/html/rfc7519',
          versionOrDate: 'May 2015',
          applicability: 'direct',
          confidence: 'verified',
        },
      ],
    },
  };

  // 1. Test canonical EvidencePacket
  const packet = createEvidencePacket(shard, state);

  // Requirement IDs preserved
  assert.deepEqual(packet.requirements, shard.requirements);
  assert.equal(packet.requirements.length, 3);
  assert.ok(packet.requirements.includes('REQ-AUTH-101'));
  assert.ok(packet.requirements.includes('REQ-AUTH-102'));
  assert.ok(packet.requirements.includes('REQ-AUTH-103'));

  // Requirement details preserved
  assert.deepEqual(packet.requirementDetails, shard.requirementDetails);

  // Acceptance criteria preserved
  assert.deepEqual(packet.acceptanceCriteria, shard.acceptanceCriteria);

  // Changed files preserved
  assert.deepEqual(packet.changedFiles, state.implementation.changedFiles);
  assert.equal(packet.changedFiles.length, 3);

  // Contract delta preserved
  assert.deepEqual(packet.contractDelta, state.implementation.contractDelta);

  // Tests preserved
  assert.deepEqual(packet.testEvidence, state.implementation.testsRun);

  // Confirmed findings preserved
  assert.deepEqual(packet.confirmedFindings, state.lastVerification.issues);
  assert.equal(packet.confirmedFindings.length, 2);

  // Unresolved risks preserved
  assert.deepEqual(packet.unresolvedRisks, state.lastVerification.risks);

  // Research claims preserved with source normalization
  assert.equal(packet.relevantResearchClaims.length, 1);
  assert.equal(packet.relevantResearchClaims[0].source, 'https://tools.ietf.org/html/rfc7519');
  assert.equal(packet.relevantResearchClaims[0].sourceUrl, 'https://tools.ietf.org/html/rfc7519');
  assert.equal(packet.relevantResearchClaims[0].versionOrDate, 'May 2015');
  assert.equal(packet.relevantResearchClaims[0].applicability, 'direct');
  assert.equal(packet.relevantResearchClaims[0].confidence, 'verified');

  // 2. Test Receiver 1: compressDependencyContext
  const depContexts = compressDependencyContext([state]);
  assert.equal(depContexts.length, 1);
  const depPacket = depContexts[0];
  assert.equal(depPacket.shardId, shard.id);
  assert.deepEqual(depPacket.requirements, shard.requirements);
  assert.deepEqual(depPacket.changedFiles, state.implementation.changedFiles);
  assert.deepEqual(depPacket.contractDelta, state.implementation.contractDelta);
  assert.deepEqual(depPacket.testEvidence, state.implementation.testsRun);
  assert.deepEqual(depPacket.confirmedFindings, state.lastVerification.issues);
  assert.deepEqual(depPacket.unresolvedRisks, state.lastVerification.risks);

  // 3. Test Receiver 2: formatVerifierPacket
  const verifierPacket = formatVerifierPacket(shard, state);
  assert.equal(verifierPacket.shardId, shard.id);
  assert.deepEqual(verifierPacket.requirements, shard.requirements);
  assert.deepEqual(verifierPacket.requirementDetails, shard.requirementDetails);
  assert.deepEqual(verifierPacket.acceptanceCriteria, shard.acceptanceCriteria);
  assert.deepEqual(verifierPacket.ownership, shard.owns);
  assert.deepEqual(verifierPacket.changedFiles, state.implementation.changedFiles);
  assert.equal(verifierPacket.implementationSummary, state.implementation.summary);
  assert.deepEqual(verifierPacket.testEvidence, state.implementation.testsRun);
  assert.deepEqual(verifierPacket.relevantContracts, state.implementation.contractDelta);
  assert.equal(verifierPacket.researchClaims.length, 1);
  assert.equal(verifierPacket.researchClaims[0].claim, 'RFC 7519 mandates sub claim string encoding');

  // 4. Test Receiver 3: formatRepairPacket
  const repairPacket = formatRepairPacket(shard, state);
  assert.equal(repairPacket.shardId, shard.id);
  assert.deepEqual(repairPacket.shardOwnership, shard.owns);
  assert.deepEqual(repairPacket.confirmedFindings, state.lastVerification.issues);
  assert.deepEqual(repairPacket.currentChangedFiles, state.implementation.changedFiles);
  assert.deepEqual(repairPacket.targetedTests, state.implementation.testsRun);
  assert.deepEqual(repairPacket.requirementMapping, shard.requirementDetails);
  assert.deepEqual(repairPacket.unresolvedRisks, state.lastVerification.risks);

  // 5. Test Receiver 4: formatIntegrationShardSummary
  const summary = formatIntegrationShardSummary([state]);
  const shardSummary = summary[shard.id];
  assert.ok(shardSummary, 'Shard should be indexed by shardId');
  assert.equal(shardSummary.verificationVerdict, 'fail');
  assert.deepEqual(shardSummary.changedFiles, state.implementation.changedFiles);
  assert.deepEqual(shardSummary.contractDelta, state.implementation.contractDelta);
  assert.equal(shardSummary.highOrCriticalFindings.length, 2, 'Both critical/high issues preserved');
  assert.equal(shardSummary.highOrCriticalFindings[0].id, 'ISS-AUTH-1');
  assert.equal(shardSummary.highOrCriticalFindings[1].id, 'ISS-AUTH-2');
  assert.equal(shardSummary.highOrCriticalRisks.length, 2, 'Risks preserved');
  assert.equal(shardSummary.testCount, 2);
});

test('evidence-packet-lossless: research claim schema maps source and sourceUrl flexibly', () => {
  // Case A: Only source provided
  const packetA = createEvidencePacket(
    { id: 's1' },
    {
      research: {
        claims: [
          {
            claim: 'Claim A',
            source: 'https://example.com/spec-a',
            versionOrDate: '2026-01-01',
            applicability: 'critical',
            confidence: 0.95,
          },
        ],
      },
    }
  );
  assert.equal(packetA.relevantResearchClaims[0].source, 'https://example.com/spec-a');
  assert.equal(packetA.relevantResearchClaims[0].sourceUrl, 'https://example.com/spec-a');
  assert.equal(packetA.relevantResearchClaims[0].versionOrDate, '2026-01-01');
  assert.equal(packetA.relevantResearchClaims[0].applicability, 'critical');
  assert.equal(packetA.relevantResearchClaims[0].confidence, 0.95);

  // Case B: Only sourceUrl provided
  const packetB = createEvidencePacket(
    { id: 's2' },
    {
      research: {
        claims: [
          {
            claim: 'Claim B',
            sourceUrl: 'https://example.com/spec-b',
            date: '2026-02-01',
            applicability: 'direct',
            confidence: 'high',
          },
        ],
      },
    }
  );
  assert.equal(packetB.relevantResearchClaims[0].source, 'https://example.com/spec-b');
  assert.equal(packetB.relevantResearchClaims[0].sourceUrl, 'https://example.com/spec-b');
  assert.equal(packetB.relevantResearchClaims[0].versionOrDate, '2026-02-01');
  assert.equal(packetB.relevantResearchClaims[0].applicability, 'direct');
  assert.equal(packetB.relevantResearchClaims[0].confidence, 'high');
});

test('evidence-packet-lossless: safe research cache deduplication using compound key and telemetry', () => {
  const cache = new ResearchCache('test-run-intra');
  cache.clear();
  const question = 'Does Next.js 15 route handlers require cookies() to be awaited?';
  const extraContext = {
    sourceContext: 'nextjs-docs,official-migration-guide',
    dependencyVersion: '15.1.0',
  };

  // Initially miss
  assert.equal(cache.get(question, 'global', extraContext), null);
  assert.equal(cache.researchCacheMisses, 1);
  assert.equal(cache.researchCacheHits, 0);

  // Set research result
  const claimPayload = {
    claims: [
      {
        claim: 'In Next.js 15, cookies() returns a Promise that must be awaited.',
        source: 'https://nextjs.org/docs/app/building-your-application/upgrading/version-15',
        versionOrDate: '15.1.0',
        applicability: 'exact',
        confidence: 'verified',
      },
    ],
  };
  cache.set(question, claimPayload, 'global', extraContext);

  // Retrieve same question with identical compound context
  const retrieved = cache.get(question, 'global', extraContext);
  assert.deepEqual(retrieved, claimPayload);
  assert.equal(cache.researchCacheHits, 1);
  assert.equal(cache.researchCacheMisses, 1);

  // Different framework version should not hit the same cache key
  const diffVersionContext = {
    sourceContext: 'nextjs-docs,official-migration-guide',
    dependencyVersion: '14.2.0',
  };
  assert.equal(cache.get(question, 'global', diffVersionContext), null);
  assert.equal(cache.researchCacheHits, 1);
  assert.equal(cache.researchCacheMisses, 2);
});
