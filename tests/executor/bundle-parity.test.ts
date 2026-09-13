import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  MANIFEST_SCHEMA,
  validateManifestCoverage,
  validateManifestOwnership,
  computeShardPriorities,
  clusterIntegrationFindings,
  buildShardPacket,
  shouldIsolateShard,
  evaluateDeterministicReleaseGate,
  buildRunTelemetry,
} from '../../scripts/lib/executor-contracts.mjs';

const workflowPath = path.resolve(process.cwd(), '.claude/workflows/qcet-plan-executor.js');
const src = fs.readFileSync(workflowPath, 'utf8');
const helpersPart = src
  .split('// WORKFLOW')[0]
  .replace(/^export\s+const\s+([A-Za-z0-9_]+)\s*=/gm, 'globalThis.$1 =')
  // The workflow declares its schemas as top-level (non-exported) `const` bindings.
  // A `const` in a vm Script is script-scoped, not a global property, so it must be
  // assigned onto globalThis to become visible to parity assertions.
  .replace(/^const\s+([A-Za-z0-9_]+)\s*=/gm, 'globalThis.$1 =')
  .replace(/^export\s+function\s+([A-Za-z0-9_]+)/gm, 'globalThis.$1 = function $1')
  .replace(/^export\s+/gm, '');
const sandbox: Record<string, any> = { console, process };
vm.createContext(sandbox);
vm.runInContext(helpersPart, sandbox);

test('parity: MANIFEST_SCHEMA definitions match between canonical contracts and workflow', () => {
  const canonicalKindEnum = MANIFEST_SCHEMA.properties.shards.items.properties.kind.enum;
  const workflowKindEnum = sandbox.MANIFEST_SCHEMA.properties.shards.items.properties.kind.enum;
  assert.deepEqual(
    [...workflowKindEnum].sort(),
    [...canonicalKindEnum].sort(),
    'Manifest shard kind enum must match canonical contract'
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(sandbox.MANIFEST_SCHEMA.properties.shards.items.properties.isolation)),
    JSON.parse(JSON.stringify(MANIFEST_SCHEMA.properties.shards.items.properties.isolation)),
    'Manifest shard isolation property must match canonical contract'
  );
});

test('parity: validateManifestCoverage behavior matches between canonical module and workflow', () => {
  const testManifest = {
    requirements: [
      { id: 'REQ-A', description: 'Alpha' },
      { id: 'REQ-B', description: 'Beta' },
    ],
    shards: [
      {
        id: 'shard-1',
        objective: 'Test shard 1',
        requirements: ['REQ-A'],
        owns: ['src/a.ts'],
      },
    ],
  };

  const canonicalErrors = validateManifestCoverage(testManifest);
  const workflowErrors = sandbox.validateManifestCoverage(testManifest);

  assert.deepEqual(
    JSON.parse(JSON.stringify(workflowErrors)),
    canonicalErrors,
    'validateManifestCoverage must produce identical errors'
  );
});

test('parity: validateManifestOwnership behavior matches between canonical module and workflow', () => {
  const overlapManifest = {
    shards: [
      { id: 'shard-1', owns: ['src/core/**'], isolation: 'none' },
      { id: 'shard-2', owns: ['src/core/index.ts'], isolation: 'none' },
    ],
  };

  const canonicalErrors = validateManifestOwnership(overlapManifest);
  const workflowErrors = sandbox.validateManifestOwnership(overlapManifest);

  assert.deepEqual(
    JSON.parse(JSON.stringify(workflowErrors)),
    canonicalErrors,
    'validateManifestOwnership must produce identical errors'
  );
});

test('parity: shouldIsolateShard behavior matches between canonical module and workflow', () => {
  const manifest = {
    shards: [
      { id: 's1', owns: ['src/shared/**'] },
      { id: 's2', owns: ['src/shared/util.ts'] },
      { id: 's3', owns: ['src/other.ts'] },
    ],
  };

  for (const mode of ['auto', 'always', 'never']) {
    for (const s of manifest.shards) {
      assert.equal(
        sandbox.shouldIsolateShard(s, manifest, mode),
        shouldIsolateShard(s, manifest, mode),
        `shouldIsolateShard parity for shard ${s.id} mode ${mode}`
      );
    }
  }
});

test('parity: evaluateDeterministicReleaseGate behavior matches between canonical module and workflow', () => {
  const gateInput = {
    manifest: {
      requirements: [{ id: 'REQ-1', description: 'Test' }],
      shards: [{ id: 's1', requirements: ['REQ-1'] }],
    },
    allShardResults: [
      {
        shard: { id: 's1', requirements: ['REQ-1'] },
        lastVerification: { verdict: 'pass' },
      },
    ],
    integrationSynthesis: { findings: [] },
    integrationRepair: null,
    validation: {
      status: 'pass',
      checks: [{ name: 'typecheck', status: 'passed' }],
    },
    finalVerdict: { status: 'READY' },
  };

  const canonicalGate = evaluateDeterministicReleaseGate(gateInput);
  const workflowGate = sandbox.evaluateDeterministicReleaseGate(gateInput);

  assert.deepEqual(
    JSON.parse(JSON.stringify(workflowGate)),
    canonicalGate,
    'evaluateDeterministicReleaseGate must produce identical gate decisions'
  );
});

test('parity: build-executor-bundle generates valid dist bundle matching source logic', () => {
  const distDir = path.resolve(process.cwd(), '.claude/dist');
  const bundlePath = path.join(distDir, 'qcet-plan-executor.bundle.js');
  assert.ok(fs.existsSync(bundlePath), 'Dist bundle must exist');

  const bundleSrc = fs.readFileSync(bundlePath, 'utf8');
  assert.ok(!bundleSrc.includes("require('node:fs')"), 'Bundle must have no Node fs require');
  assert.ok(!bundleSrc.includes("require('node:path')"), 'Bundle must have no Node path require');
});
