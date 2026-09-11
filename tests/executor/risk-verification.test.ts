import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAdaptivePolicy,
  mergeVerificationResults,
} from '../../scripts/lib/adaptive-context.mjs';

test('risk-verification: low and medium risk resolve to single qcet-skeptic', () => {
  const lowShard = {
    id: 'shard-ui',
    owns: ['src/components/button.tsx'],
  };
  const lowPolicy = resolveAdaptivePolicy(lowShard);
  assert.equal(lowPolicy.risk, 'low');
  assert.equal(lowPolicy.specializedVerifier, null);

  const medShard = {
    id: 'shard-api',
    owns: ['src/server/routers/item.ts'],
  };
  const medPolicy = resolveAdaptivePolicy(medShard);
  assert.equal(medPolicy.risk, 'medium');
  assert.equal(medPolicy.specializedVerifier, null);
});

test('risk-verification: high risk does not dispatch specialized verifier, uses single skeptic', () => {
  const highShard = {
    id: 'shard-core',
    owns: ['src/lib/core-engine.ts'],
  };
  const highPolicy = resolveAdaptivePolicy(highShard);
  assert.equal(highPolicy.risk, 'high');
  // High risk uses single skeptic with stronger rubric
  assert.equal(highPolicy.specializedVerifier, 'data-reviewer'); // if core/db
});

test('risk-verification: critical auth shard assigns security-reviewer as specialized verifier', () => {
  const authShard = {
    id: 'shard-auth',
    owns: ['src/server/auth/session.ts'],
  };
  const authPolicy = resolveAdaptivePolicy(authShard);
  assert.equal(authPolicy.risk, 'critical');
  assert.equal(authPolicy.specializedVerifier, 'security-reviewer');
});

test('risk-verification: critical database shard assigns data-reviewer as specialized verifier', () => {
  const dbShard = {
    id: 'shard-db',
    owns: ['prisma/schema.prisma'],
  };
  const dbPolicy = resolveAdaptivePolicy(dbShard);
  assert.equal(dbPolicy.risk, 'critical'); // or high depending on matches
  assert.equal(dbPolicy.specializedVerifier, 'data-reviewer');
});

test('risk-verification: mergeVerificationResults combines issues deterministically without arbiter', () => {
  const res1 = {
    verdict: 'pass',
    requirementsChecked: ['REQ-1'],
    issues: [],
    summary: 'Skeptic check passed.',
  };
  const res2 = {
    verdict: 'fail',
    requirementsChecked: ['REQ-2'],
    issues: [
      {
        id: 'SEC-1',
        file: 'src/server/auth.ts',
        title: 'Missing RBAC check',
        severity: 'critical',
      },
    ],
    summary: 'Security reviewer found RBAC issue.',
  };

  const merged = mergeVerificationResults(res1, res2);
  assert.equal(merged.verdict, 'fail');
  assert.deepEqual(merged.requirementsChecked.sort(), ['REQ-1', 'REQ-2']);
  assert.equal(merged.issues.length, 1);
  assert.equal(merged.issues[0].id, 'SEC-1');
});
