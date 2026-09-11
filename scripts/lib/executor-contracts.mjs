/**
 * QCET Plan Executor - Canonical Schemas, Contracts, and Pure Decision Logic
 * Upholds Universal Invariant 1: One Capability, One Canonical Implementation.
 * Shared across Node tools, test harnesses, and workflow script generators.
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pathMatcher = require('./canonical-path-matcher.cjs');

export const {
  normalizePath,
  stripWildcards,
  globToRegex,
  matchesOwnership,
  pathsOverlap,
  toRepoRelativePath,
  isExternalAbsolutePath,
} = pathMatcher;

// -----------------------------------------------------------------------------
// SCHEMAS
// -----------------------------------------------------------------------------

export const MANIFEST_SCHEMA = {
  type: 'object',
  required: ['summary', 'requirements', 'shards'],
  properties: {
    summary: { type: 'string' },
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'description'],
        properties: {
          id: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    shards: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'objective',
          'owns',
          'antiOwns',
          'dependencies',
          'requirements',
          'acceptanceCriteria',
          'risk',
          'testHints',
        ],
        properties: {
          id: { type: 'string' },
          objective: { type: 'string', minLength: 1 },
          kind: {
            type: 'string',
            enum: ['feature', 'infrastructure', 'validation', 'support', 'exploratory', 'migration'],
          },
          isolation: {
            type: 'string',
            enum: ['none', 'worktree'],
          },
          owns: {
            type: 'array',
            items: { type: 'string' },
          },
          antiOwns: {
            type: 'array',
            items: { type: 'string' },
          },
          dependencies: {
            type: 'array',
            items: { type: 'string' },
          },
          requirements: {
            type: 'array',
            items: { type: 'string' },
          },
          acceptanceCriteria: {
            type: 'array',
            items: { type: 'string' },
          },
          requirementDetails: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'text'],
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
              },
            },
          },
          risk: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
          },
          testHints: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  },
};

export const BUILDER_RESULT_SCHEMA = {
  type: 'object',
  required: ['status', 'changedFiles', 'testsRun', 'requirementsSatisfied'],
  properties: {
    status: {
      type: 'string',
      enum: ['completed', 'failed', 'blocked'],
    },
    changedFiles: {
      type: 'array',
      items: { type: 'string' },
    },
    testsRun: {
      type: 'array',
      items: {
        type: 'object',
        required: ['command', 'status'],
        properties: {
          command: { type: 'string' },
          status: { type: 'string', enum: ['passed', 'failed'] },
          output: { type: 'string' },
        },
      },
    },
    requirementsSatisfied: {
      type: 'array',
      items: { type: 'string' },
    },
    summary: { type: 'string' },
    blockers: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

export const SKEPTIC_RESULT_SCHEMA = {
  type: 'object',
  required: ['verdict', 'issues', 'testsRun', 'requirementsVerified'],
  properties: {
    verdict: {
      type: 'string',
      enum: ['pass', 'fail'],
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'file', 'description', 'evidence'],
        properties: {
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          file: { type: 'string' },
          description: { type: 'string' },
          evidence: { type: 'string' },
          recommendedFix: { type: 'string' },
        },
      },
    },
    testsRun: {
      type: 'array',
      items: {
        type: 'object',
        required: ['command', 'status'],
        properties: {
          command: { type: 'string' },
          status: { type: 'string', enum: ['passed', 'failed'] },
          output: { type: 'string' },
        },
      },
    },
    requirementsVerified: {
      type: 'array',
      items: { type: 'string' },
    },
    summary: { type: 'string' },
  },
};

export const REPAIR_RESULT_SCHEMA = {
  type: 'object',
  required: ['status', 'changedFiles', 'issuesFixed', 'remainingIssues'],
  properties: {
    status: {
      type: 'string',
      enum: ['completed', 'failed', 'blocked'],
    },
    changedFiles: {
      type: 'array',
      items: { type: 'string' },
    },
    issuesFixed: {
      type: 'array',
      items: { type: 'string' },
    },
    remainingIssues: {
      type: 'array',
      items: { type: 'string' },
    },
    summary: { type: 'string' },
  },
};

export const INTEGRATION_REVIEW_SCHEMA = {
  type: 'object',
  required: ['verdict', 'findings', 'contractCompliance'],
  properties: {
    verdict: {
      type: 'string',
      enum: ['pass', 'fail'],
    },
    contractCompliance: {
      type: 'string',
      enum: ['full', 'partial', 'violated'],
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'file', 'description', 'evidence'],
        properties: {
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          file: { type: 'string' },
          description: { type: 'string' },
          evidence: { type: 'string' },
          recommendedFix: { type: 'string' },
        },
      },
    },
    summary: { type: 'string' },
  },
};

export const RELEASE_GATE_SCHEMA = {
  type: 'object',
  required: ['status', 'readiness', 'decision', 'blockingIssues'],
  properties: {
    status: {
      type: 'string',
      enum: ['READY', 'READY_WITH_KNOWN_ISSUES', 'BLOCKED'],
    },
    readiness: {
      type: 'string',
      enum: ['READY', 'READY_WITH_KNOWN_ISSUES', 'BLOCKED'],
    },
    decision: {
      type: 'string',
      enum: ['PROMOTE', 'HOLD', 'REJECT'],
    },
    blockingIssues: {
      type: 'array',
      items: { type: 'string' },
    },
    residualRisks: {
      type: 'array',
      items: { type: 'string' },
    },
    summary: { type: 'string' },
  },
};

export const ACTIVE_SHARDS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    required: ['id', 'owns'],
    properties: {
      id: { type: 'string' },
      owns: { type: 'array', items: { type: 'string' } },
      antiOwns: { type: 'array', items: { type: 'string' } },
      worktreePath: { type: 'string' },
      isolation: { type: 'string', enum: ['none', 'worktree'] },
    },
  },
};

/**
 * Selects targeted integration review dimensions based on actual blast radius,
 * modified files, and risk levels of the plan and execution results.
 *
 * @param {Object} manifest
 * @param {Array<Object>} [allShardResults=[]]
 * @returns {Array<{id: string, charter: string}>}
 */
export function selectIntegrationReviewDimensions(manifest, allShardResults = []) {
  const actualFiles = new Set();
  if (Array.isArray(allShardResults)) {
    for (const r of allShardResults) {
      const changed = r?.implementation?.changedFiles;
      if (Array.isArray(changed)) {
        for (const f of changed) {
          if (f) actualFiles.add(String(f).toLowerCase());
        }
      }
    }
  }

  const allFiles = new Set();
  if (actualFiles.size > 0) {
    for (const f of actualFiles) allFiles.add(f);
  } else {
    if (Array.isArray(allShardResults)) {
      for (const r of allShardResults) {
        const owns = r?.shard?.owns || r?.owns || [];
        for (const f of owns) if (f) allFiles.add(String(f).toLowerCase());
      }
    }
    if (Array.isArray(manifest?.shards)) {
      for (const s of manifest.shards) {
        for (const f of s.owns || []) if (f) allFiles.add(String(f).toLowerCase());
      }
    }
  }

  const fileList = Array.from(allFiles);
  const shards = Array.isArray(manifest?.shards) ? manifest.shards : [];
  const maxRisk = shards.reduce((acc, s) => {
    const r = String(s.risk || 'medium').toLowerCase();
    if (r === 'critical') return 'critical';
    if (r === 'high' && acc !== 'critical') return 'high';
    return acc;
  }, 'low');

  const isUiOnly =
    fileList.length > 0 &&
    fileList.every(
      (f) =>
        (f.includes('component') ||
          f.includes('src/app/') ||
          f.includes('ui') ||
          f.endsWith('.tsx') ||
          f.endsWith('.css')) &&
        !f.includes('/api/') &&
        !f.includes('prisma') &&
        !f.includes('/auth/')
    );

  const hasAuthOrApi = fileList.some((f) => f.includes('/auth/') || f.includes('/api/') || f.includes('/server/'));
  const hasPrismaOrMigration = fileList.some(
    (f) => f.includes('prisma') || f.includes('migration') || f.includes('/db/')
  );

  const ALL_DIMENSIONS = {
    contracts: {
      id: 'contracts',
      charter:
        'Cross-module API/type/schema/contracts consistency, stale adapters, import drift, caller/consumer mismatch.',
    },
    authorization: {
      id: 'authorization',
      charter:
        'Authorization, permission boundaries, server-side enforcement, trust boundaries, data exposure.',
    },
    semantics: {
      id: 'semantics',
      charter:
        'Duplicated business semantics, competing sources of truth, duplicated UI meaning, inconsistent status/count logic.',
    },
    regression: {
      id: 'regression',
      charter:
        'Regression risk, missing tests, integration behavior, accessibility/performance regressions where relevant.',
    },
    'data-integrity': {
      id: 'data-integrity',
      charter:
        'Database schema consistency, transaction atomicity, migration safety, foreign key and constraint integrity.',
    },
    'ux-accessibility': {
      id: 'ux-accessibility',
      charter:
        'UI ergonomics, light-only design compliance, accessibility, touch target sizing, empty/loading states.',
    },
  };

  if (isUiOnly && maxRisk !== 'critical') {
    return [ALL_DIMENSIONS.semantics, ALL_DIMENSIONS.regression, ALL_DIMENSIONS['ux-accessibility']];
  }

  if (hasPrismaOrMigration && !hasAuthOrApi && maxRisk !== 'critical') {
    return [ALL_DIMENSIONS.contracts, ALL_DIMENSIONS['data-integrity'], ALL_DIMENSIONS.regression];
  }

  if (hasAuthOrApi && !hasPrismaOrMigration && maxRisk !== 'critical') {
    return [ALL_DIMENSIONS.contracts, ALL_DIMENSIONS.authorization, ALL_DIMENSIONS.regression];
  }

  // Cross-cutting, high-risk, or comprehensive blast radius: full review panel
  return [
    ALL_DIMENSIONS.contracts,
    ALL_DIMENSIONS.authorization,
    ALL_DIMENSIONS.semantics,
    ALL_DIMENSIONS.regression,
    ALL_DIMENSIONS['data-integrity'],
  ];
}

// -----------------------------------------------------------------------------
// PURE CONTRACT DECISION FUNCTIONS
// -----------------------------------------------------------------------------

export function validateManifestCoverage(manifest) {
  const errors = [];
  if (!manifest) {
    return ['Manifest is empty or undefined'];
  }

  const requirements = Array.isArray(manifest.requirements) ? manifest.requirements : [];
  const shards = Array.isArray(manifest.shards) ? manifest.shards : [];

  if (requirements.length === 0) {
    errors.push('Manifest contains no requirements');
  }

  if (shards.length === 0) {
    return ['Manifest contains no shards'];
  }

  const allReqIds = [];
  const seenReqIds = new Set();
  const duplicateReqIds = new Set();

  for (const req of requirements) {
    const id = typeof req === 'string' ? req.trim() : req?.id?.trim();
    if (!id) {
      errors.push('Manifest requirement has missing or empty id');
      continue;
    }
    if (seenReqIds.has(id)) {
      duplicateReqIds.add(id);
    }
    seenReqIds.add(id);
    allReqIds.push(id);
  }

  if (duplicateReqIds.size > 0) {
    errors.push(`Duplicate requirement IDs in manifest: ${[...duplicateReqIds].join(', ')}`);
  }

  const seenShardIds = new Set();
  const duplicateShardIds = new Set();

  for (const shard of shards) {
    const shardId = shard.id?.trim();
    if (!shardId) {
      errors.push('Manifest shard has missing or empty id');
      continue;
    }
    if (seenShardIds.has(shardId)) {
      duplicateShardIds.add(shardId);
    }
    seenShardIds.add(shardId);

    if (!shard.objective || typeof shard.objective !== 'string' || shard.objective.trim() === '') {
      errors.push(`Shard '${shardId}' has an empty or missing objective`);
    }

    const isInfra = shard.kind === 'infrastructure' || shard.kind === 'support';
    const shardReqs = (shard.requirements || [])
      .map((r) => (typeof r === 'string' ? r.trim() : String(r).trim()))
      .filter(Boolean);

    if (!isInfra && shardReqs.length === 0) {
      errors.push(`Non-infrastructure shard '${shardId}' has zero mapped requirements`);
    }
  }

  if (duplicateShardIds.size > 0) {
    errors.push(`Duplicate shard IDs in manifest: ${[...duplicateShardIds].join(', ')}`);
  }

  const allReqSet = new Set(allReqIds);
  const claimedReqSet = new Set();
  const unknownReqIds = new Set();

  for (const shard of shards) {
    const shardId = shard.id?.trim() || 'unknown';
    const shardReqs = (shard.requirements || [])
      .map((r) => (typeof r === 'string' ? r.trim() : String(r).trim()))
      .filter(Boolean);

    const shardSeenReqs = new Set();
    for (const reqId of shardReqs) {
      if (shardSeenReqs.has(reqId)) {
        errors.push(`Shard '${shardId}' contains duplicate requirement ID '${reqId}'`);
      }
      shardSeenReqs.add(reqId);

      if (!allReqSet.has(reqId)) {
        unknownReqIds.add(reqId);
      }
      claimedReqSet.add(reqId);
    }
  }

  const missingReqIds = allReqIds.filter((id) => !claimedReqSet.has(id));

  if (missingReqIds.length > 0) {
    errors.push(`Unclaimed plan requirements (missing coverage): ${missingReqIds.join(', ')}`);
  }

  if (unknownReqIds.size > 0) {
    errors.push(`Unknown requirement IDs claimed by shards: ${[...unknownReqIds].join(', ')}`);
  }

  return errors;
}

export function validateManifestOwnership(manifest) {
  const errors = [];
  if (!manifest || !Array.isArray(manifest.shards)) return errors;

  const shards = manifest.shards;
  for (let i = 0; i < shards.length; i++) {
    const shardA = shards[i];
    const ownsA = shardA.owns || [];

    for (let j = i + 1; j < shards.length; j++) {
      const shardB = shards[j];
      const ownsB = shardB.owns || [];

      for (const pathA of ownsA) {
        for (const pathB of ownsB) {
          if (pathsOverlap(pathA, pathB)) {
            const isIsolatedA = shardA.isolation === 'worktree' || shardA.isolated === true;
            const isIsolatedB = shardB.isolation === 'worktree' || shardB.isolated === true;
            if (isIsolatedA || isIsolatedB) {
              continue;
            }
            errors.push(
              `Mutable ownership overlap between shard '${shardA.id}' and shard '${shardB.id}': ` +
              `'${pathA}' overlaps with '${pathB}'`
            );
          }
        }
      }
    }
  }

  return errors;
}

export function computeShardPriorities(manifest) {
  const priorityMap = new Map();
  if (!manifest || !Array.isArray(manifest.shards)) return priorityMap;

  const shards = manifest.shards;
  const dependentsMap = new Map();
  for (const s of shards) {
    dependentsMap.set(s.id, new Set());
  }

  for (const s of shards) {
    const deps = Array.isArray(s.dependencies) ? s.dependencies : (Array.isArray(s.dependsOn) ? s.dependsOn : []);
    for (const depId of deps) {
      if (dependentsMap.has(depId)) {
        dependentsMap.get(depId).add(s.id);
      }
    }
  }

  // Memoized critical path length calculator
  const memoPath = new Map();
  function getCriticalPathLength(shardId) {
    if (memoPath.has(shardId)) return memoPath.get(shardId);
    const children = dependentsMap.get(shardId);
    if (!children || children.size === 0) {
      memoPath.set(shardId, 1);
      return 1;
    }
    let maxChild = 0;
    for (const childId of children) {
      maxChild = Math.max(maxChild, getCriticalPathLength(childId));
    }
    const len = 1 + maxChild;
    memoPath.set(shardId, len);
    return len;
  }

  for (const s of shards) {
    const visited = new Set();
    const queue = [...(dependentsMap.get(s.id) || [])];
    for (const d of queue) visited.add(d);

    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const nextDeps = dependentsMap.get(curr);
      if (nextDeps) {
        for (const nextId of nextDeps) {
          if (!visited.has(nextId)) {
            visited.add(nextId);
            queue.push(nextId);
          }
        }
      }
    }
    const transitiveDownstream = visited.size;
    const downstreamUnblockValue = (dependentsMap.get(s.id) || new Set()).size;
    const criticalPathLength = getCriticalPathLength(s.id);

    const risk = String(s.risk || 'medium').toLowerCase();
    let riskWeight = 2;
    if (risk === 'critical') riskWeight = 4;
    else if (risk === 'high') riskWeight = 3;
    else if (risk === 'low') riskWeight = 1;

    const reqCount = Array.isArray(s.requirements) ? s.requirements.length : 0;
    const ownsCount = Array.isArray(s.owns) ? s.owns.length : 0;
    const acCount = Array.isArray(s.acceptanceCriteria) ? s.acceptanceCriteria.length : 0;
    const workCount = reqCount + ownsCount + acCount;

    const priority =
      criticalPathLength * 20 +
      transitiveDownstream * 10 +
      downstreamUnblockValue * 5 +
      riskWeight * 3 +
      workCount;

    priorityMap.set(s.id, {
      priority,
      criticalPathLength,
      transitiveDownstream,
      downstreamUnblockValue,
      riskWeight,
      workCount,
    });
  }

  return priorityMap;
}

export function shouldIsolateShard(shard, manifest, isolationConfig = 'auto') {
  if (isolationConfig === 'always' || isolationConfig === true) {
    return true;
  }
  if (isolationConfig === 'never' || isolationConfig === false) {
    return false;
  }
  if (!shard) return false;
  if (shard.isolation === 'none' || shard.isolated === false) {
    return false;
  }
  if (shard.isolation === 'worktree' || shard.isolated === true) {
    return true;
  }
  const kind = String(shard.kind || '').toLowerCase();
  if (kind === 'exploratory' || kind === 'migration') {
    return true;
  }
  if (manifest && Array.isArray(manifest.shards)) {
    const shardOwns = Array.isArray(shard.owns) ? shard.owns : [];
    for (const other of manifest.shards) {
      if (!other || other.id === shard.id) continue;
      const otherOwns = Array.isArray(other.owns) ? other.owns : [];
      for (const pA of shardOwns) {
        for (const pB of otherOwns) {
          if (pathsOverlap(pA, pB)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

export function clusterIntegrationFindings(findings) {
  if (!Array.isArray(findings) || findings.length === 0) return [];

  const validFindings = findings.filter(Boolean);
  const fileFindings = [];
  const globalFindings = [];

  for (const f of validFindings) {
    const file = typeof f.file === 'string' ? f.file.trim() : '';
    if (!file || file.toLowerCase() === 'none' || file.toLowerCase() === 'unknown') {
      globalFindings.push(f);
    } else {
      fileFindings.push(f);
    }
  }

  const n = fileFindings.length;
  const adj = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (pathsOverlap(fileFindings[i].file, fileFindings[j].file)) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  const visited = new Set();
  const clusters = [];

  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue;
    const component = [];
    const queue = [i];
    visited.add(i);

    while (queue.length > 0) {
      const u = queue.shift();
      component.push(fileFindings[u]);
      for (const v of adj[u]) {
        if (!visited.has(v)) {
          visited.add(v);
          queue.push(v);
        }
      }
    }

    const files = [...new Set(component.map((f) => f.file))];
    clusters.push({
      id: `cluster-${clusters.length + 1}`,
      files,
      findings: component,
    });
  }

  if (globalFindings.length > 0) {
    const extractedFiles = [];
    const pathRegex = /(?:[a-zA-Z0-9_\-./]+\/[a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/g;
    for (const gf of globalFindings) {
      const text = `${gf.file || ''} ${gf.evidence || ''} ${gf.recommendedFix || ''}`;
      const matches = text.match(pathRegex) || [];
      for (const m of matches) {
        if (!m.startsWith('http') && !m.includes('//')) {
          extractedFiles.push(normalizePath(m));
        }
      }
    }
    const dedupedFiles = [...new Set(extractedFiles.filter(Boolean))];
    clusters.push({
      id: 'cluster-global',
      files: dedupedFiles,
      findings: globalFindings,
    });
  }

  return clusters;
}

export function buildShardPacket(shard, manifest) {
  if (!shard) return null;

  const manifestReqs = Array.isArray(manifest?.requirements) ? manifest.requirements : [];
  const manifestReqMap = new Map();
  for (const req of manifestReqs) {
    if (typeof req === 'string') {
      const str = req.trim();
      manifestReqMap.set(str, str);
      const match = str.match(/^([A-Za-z0-9_-]+)[:\s\-\.](.*)$/);
      if (match) {
        const parsedId = match[1].trim();
        const parsedText = match[2].trim() || str;
        manifestReqMap.set(parsedId, parsedText);
      }
    } else if (req && typeof req === 'object') {
      const id = req.id ? String(req.id).trim() : '';
      const text =
        typeof req.description === 'string'
          ? req.description.trim()
          : typeof req.text === 'string'
          ? req.text.trim()
          : '';
      if (id) {
        manifestReqMap.set(id, text || id);
      }
    }
  }

  let resolvedReqDetails = Array.isArray(shard.requirementDetails) ? [...shard.requirementDetails] : [];
  const shardReqIds = Array.isArray(shard.requirements) ? shard.requirements : [];

  if (resolvedReqDetails.length === 0 && shardReqIds.length > 0) {
    for (const rid of shardReqIds) {
      const ridStr = String(rid).trim();
      const text = manifestReqMap.get(ridStr) || `Requirement ${ridStr}`;
      resolvedReqDetails.push({
        id: ridStr,
        text,
      });
    }
  }

  return {
    id: shard.id,
    objective: shard.objective,
    kind: shard.kind || 'feature',
    isolation: shard.isolation || (shard.isolated ? 'worktree' : 'none'),
    owns: Array.isArray(shard.owns) ? shard.owns : [],
    antiOwns: Array.isArray(shard.antiOwns) ? shard.antiOwns : [],
    dependencies: Array.isArray(shard.dependencies) ? shard.dependencies : [],
    requirements: shardReqIds,
    requirementDetails: resolvedReqDetails,
    acceptanceCriteria: Array.isArray(shard.acceptanceCriteria) ? shard.acceptanceCriteria : [],
    risk: shard.risk || 'medium',
    testHints: Array.isArray(shard.testHints) ? shard.testHints : [],
  };
}

export function evaluateDeterministicReleaseGate({
  manifest,
  allShardResults = [],
  integrationSynthesis = { findings: [] },
  integrationRepair = null,
  validation = null,
  finalVerdict = null,
}) {
  const deterministicBlockers = [];

  // 1. Shard execution checks
  if (!Array.isArray(allShardResults) || allShardResults.length === 0) {
    deterministicBlockers.push('No shard execution results available.');
  } else {
    for (const res of allShardResults) {
      if (!res) {
        deterministicBlockers.push('One or more shards produced null execution results.');
        continue;
      }
      const shardId = res.shard?.id || 'unknown-shard';
      const verdict = res.lastVerification?.verdict;
      if (verdict === 'blocked' || verdict === 'BLOCKED' || verdict === 'fail' || verdict === 'FAIL') {
        deterministicBlockers.push(`Shard '${shardId}' verification failed (${verdict}).`);
      }
      if (res.repaired && res.repairResult && res.repairResult.success === false) {
        deterministicBlockers.push(`Shard '${shardId}' repair failed to resolve defects.`);
      }
    }
  }

  // 2. Integration review defects
  const synthFindings = Array.isArray(integrationSynthesis?.findings) ? integrationSynthesis.findings : [];
  const criticalIntegrationDefects = synthFindings.filter((d) => {
    const s = String(d?.severity || '').toUpperCase();
    return s === 'CRITICAL' || s === 'HIGH';
  });
  if (criticalIntegrationDefects.length > 0) {
    const isRepairVerified =
      Boolean(integrationRepair) &&
      integrationRepair.status === 'completed' &&
      integrationRepair.verified === true &&
      (!Array.isArray(integrationRepair.remainingDefects) ||
        integrationRepair.remainingDefects.filter((def) => {
          const s = String(def?.severity || (typeof def === 'string' ? def : '')).toUpperCase();
          return s === 'CRITICAL' || s === 'HIGH' || typeof def === 'string';
        }).length === 0);

    if (!isRepairVerified) {
      deterministicBlockers.push(
        `${criticalIntegrationDefects.length} critical/high integration defect(s) remain unresolved or unverified after repair.`
      );
    }
  }

  // 3. Global validation checks (typecheck, tests, build)
  if (!validation) {
    deterministicBlockers.push('Global validation evidence is missing.');
  } else {
    if (validation.status === 'fail' || validation.status === 'failed' || validation.overallStatus === 'failed') {
      deterministicBlockers.push('Global validation status is failed.');
    }
    if (Array.isArray(validation.blockers) && validation.blockers.length > 0) {
      for (const b of validation.blockers) {
        deterministicBlockers.push(`Global validation blocker: ${typeof b === 'string' ? b : JSON.stringify(b)}`);
      }
    }
    if (Array.isArray(validation.checks)) {
      for (const check of validation.checks) {
        if (check.status === 'failed' && !check.preExisting) {
          deterministicBlockers.push(`Validation check '${check.name || check.command}' failed.`);
        }
      }
    }
  }

  // 4. Requirement coverage check
  if (manifest?.requirements?.length > 0) {
    const totalReqs = manifest.requirements.length;
    const coveredReqs = new Set();
    for (const res of allShardResults) {
      const v = res?.lastVerification?.verdict || res?.lastVerification?.status;
      if (res && (v === 'pass' || v === 'passed')) {
        for (const req of (res.shard?.requirements || res.requirementsCovered || [])) {
          coveredReqs.add(req);
        }
      }
    }
    const missingReqs = manifest.requirements.filter((r) => !coveredReqs.has(r.id));
    if (missingReqs.length > 0) {
      deterministicBlockers.push(
        `${missingReqs.length}/${totalReqs} requirements missing successful shard implementation: ${missingReqs.map((r) => r.id).join(', ')}`
      );
    }
  }

  // Deterministic decision:
  if (deterministicBlockers.length > 0) {
    return {
      status: 'BLOCKED',
      ready: false,
      deterministicOverride: true,
      blockers: deterministicBlockers,
      rationale: `Deterministic code evaluation blocked release: ${deterministicBlockers.length} failure(s) detected.`,
      agentVerdict: finalVerdict?.status || finalVerdict?.verdict || 'UNKNOWN',
    };
  }

  // If code passes, check agent verdict
  const agentStatus = finalVerdict?.status || finalVerdict?.verdict || 'READY';
  if (agentStatus === 'BLOCKED') {
    return {
      status: 'BLOCKED',
      ready: false,
      deterministicOverride: false,
      blockers: Array.isArray(finalVerdict?.blockers) && finalVerdict.blockers.length > 0
        ? finalVerdict.blockers
        : [finalVerdict?.rationale || 'Agent skeptic refuted readiness.'],
      rationale: finalVerdict?.rationale || 'Agent skeptic refuted readiness.',
      agentVerdict: agentStatus,
    };
  }

  if (agentStatus === 'READY_WITH_KNOWN_ISSUES' || agentStatus === 'READY WITH KNOWN ISSUES') {
    return {
      status: 'READY_WITH_KNOWN_ISSUES',
      ready: true,
      deterministicOverride: false,
      blockers: [],
      rationale: finalVerdict?.rationale || 'Ready with documented non-blocking residual issues.',
      agentVerdict: agentStatus,
    };
  }

  return {
    status: 'READY',
    ready: true,
    deterministicOverride: false,
    blockers: [],
    rationale: finalVerdict?.rationale || 'All deterministic checks passed and independent release skeptic confirmed readiness.',
    agentVerdict: agentStatus,
  };
}

export function buildRunTelemetry({
  manifest,
  allShardResults = [],
  integrationSynthesis = { findings: [] },
  integrationRepair = null,
  validation = null,
  finalVerdict = null,
  startTime = null,
  endTime = null,
  calibrationStartTime = null,
  calibrationEndTime = null,
  wallClockMs = 0,
  calibrationDurationMs = 0,
  agentsCount = 0,
  totalAgents = 0,
  totalAgentCalls = 0,
  peakConcurrent = 1,
  peakConcurrentAgents = 1,
  tokensTotal = null,
  planPath = '',
  timestamp = '2026-09-10T00:00:00.000Z',
  runId = '',
  researchCacheHits = 0,
  researchCacheMisses = 0,
  reconCalls = 0,
  researchCalls = 0,
  builderCalls = 0,
  verifierCalls = 0,
  arbiterCalls = 0,
  repairCalls = 0,
  integrationReviewerCalls = 0,
  preReconScheduled = 0,
  preReconAvoided = 0,
  highRiskArbiterAvoided = 0,
  highRiskFastPathCount = 0,
  arbiterInvocations = 0,
  arbiterAvoided = 0,
}) {
  const requirementsTotal = Array.isArray(manifest?.requirements)
    ? manifest.requirements.length
    : 0;

  const coveredReqSet = new Set();
  let ownershipViolations = 0;
  let verificationFindings = 0;
  let repairRounds = 0;
  let blockedShards = 0;

  const shardsSummary = [];

  for (const res of allShardResults) {
    const shard = res?.shard || {};
    const shardReqs = Array.isArray(shard.requirements) ? shard.requirements : [];
    const isPass = res?.lastVerification?.verdict === 'pass';
    const isBlocked = res?.lastVerification?.verdict === 'blocked' || res?.lastVerification?.verdict === 'fail';

    if (isPass) {
      for (const r of shardReqs) coveredReqSet.add(r);
    }
    if (isBlocked && !isPass) {
      blockedShards++;
    }

    const initialIssues = Array.isArray(res?.initialVerification?.issues)
      ? res.initialVerification.issues
      : (Array.isArray(res?.lastVerification?.issues) ? res.lastVerification.issues : []);
    const lastIssues = Array.isArray(res?.lastVerification?.issues) ? res.lastVerification.issues : [];

    const shardDefectCount = Math.max(initialIssues.length, lastIssues.length);
    verificationFindings += shardDefectCount;

    const seenViolationKeys = new Set();
    for (const iss of [...initialIssues, ...lastIssues]) {
      if (iss?.category === 'ownership-violation') {
        const key = `${iss.file || ''}-${iss.id || ''}`;
        if (!seenViolationKeys.has(key)) {
          seenViolationKeys.add(key);
          ownershipViolations++;
        }
      }
    }

    const shardRepairs = typeof res?.repairRound === 'number' ? res.repairRound : 0;
    repairRounds += shardRepairs;

    shardsSummary.push({
      id: shard.id || 'unknown',
      requirements: shardReqs.length,
      risk: shard.risk || 'medium',
      repairRounds: shardRepairs,
      verdict: res?.lastVerification?.verdict || 'unknown',
    });
  }

  const synthFindings = Array.isArray(integrationSynthesis?.findings)
    ? integrationSynthesis.findings
    : [];
  const findingsConfirmed = verificationFindings + synthFindings.length;
  if (integrationRepair) {
    repairRounds += 1;
  }

  const requirementsCovered = coveredReqSet.size;
  const hasFailStatus = validation?.status === 'fail' || validation?.status === 'failed' || validation?.verdict === 'fail' || validation?.verdict === 'failed' || validation?.overallStatus === 'failed';
  const hasExplicitPassStatus = validation?.status === 'pass' || validation?.status === 'passed' || validation?.verdict === 'pass' || validation?.verdict === 'passed' || validation?.overallStatus === 'passed';
  const hasBlockers = Array.isArray(validation?.blockers) && validation.blockers.length > 0;
  const hasFailedChecks = Array.isArray(validation?.checks) && validation.checks.some((c) => c.status === 'failed' && !c.preExisting);

  const globalPass = hasExplicitPassStatus && !hasFailStatus && !hasBlockers && !hasFailedChecks;
  const globalValidation = globalPass ? 'pass' : 'fail';
  const buildCheck = Array.isArray(validation?.checks)
    ? validation.checks.find((c) => c.name?.toLowerCase()?.includes('build') || c.command?.toLowerCase()?.includes('build'))
    : null;
  let rawBuildStatus = buildCheck ? buildCheck.status : (validation?.buildStatus || (globalPass ? 'passed' : 'failed'));
  if (rawBuildStatus === 'not-applicable') {
    rawBuildStatus = 'skipped';
  }
  const buildStatus = rawBuildStatus;
  let finalStatus = finalVerdict?.status || finalVerdict?.verdict || (globalPass && blockedShards === 0 ? 'READY' : 'BLOCKED');
  if (finalStatus === 'READY WITH KNOWN ISSUES') {
    finalStatus = 'READY_WITH_KNOWN_ISSUES';
  }

  const resolvedAgentsCount = totalAgentCalls || totalAgents || agentsCount || 0;
  const tokens = typeof tokensTotal === 'number' && tokensTotal > 0 ? tokensTotal : null;

  const wallClock = typeof wallClockMs === 'number' && wallClockMs > 0
    ? Math.round(wallClockMs)
    : (typeof endTime === 'number' && typeof startTime === 'number' && startTime > 0 && endTime >= startTime
        ? Math.round(endTime - startTime)
        : null);

  const calibrationDuration = typeof calibrationDurationMs === 'number' && calibrationDurationMs > 0
    ? Math.round(calibrationDurationMs)
    : (typeof calibrationEndTime === 'number' && typeof calibrationStartTime === 'number' && calibrationStartTime > 0 && calibrationEndTime >= calibrationStartTime
        ? Math.round(calibrationEndTime - calibrationStartTime)
        : null);

  const timeToFirstBuilder = null;
  const criticalPathDuration = null;
  const avgDependencyWait = null;

  const requirementCoveragePct = requirementsTotal > 0
    ? Number(((requirementsCovered / requirementsTotal) * 100).toFixed(1))
    : 100.0;

  const resolvedRunId = runId || `run-eval-v1.4-${manifest?.shards?.[0]?.id?.split('-')?.[0] || 'core'}-exec`;

  const unresolvedShardFindings = allShardResults.reduce((acc, res) => {
    return acc + (Array.isArray(res?.lastVerification?.issues) ? res.lastVerification.issues.length : 0);
  }, 0);
  const unresolvedIntegration = (integrationRepair && integrationRepair.status === 'completed')
    ? 0
    : synthFindings.length;
  const unresolvedFindings = unresolvedShardFindings + unresolvedIntegration + (finalStatus === 'BLOCKED' ? 1 : 0);

  const resolvedPeakConcurrent = peakConcurrent || peakConcurrentAgents || 1;

  return {
    runId: resolvedRunId,
    timestamp,
    planPath,
    version: '1.4.0',
    metrics: {
      wallClockMs: wallClock,
      calibrationDurationMs: calibrationDuration,
      timeToFirstBuilderMs: timeToFirstBuilder,
      criticalPathDurationMs: criticalPathDuration,
      avgDependencyWaitMs: avgDependencyWait,
      tokensTotal: tokens,
      agentsCount: resolvedAgentsCount,
      totalAgentCalls: resolvedAgentsCount,
      peakConcurrent: resolvedPeakConcurrent,
      peakConcurrentAgents: resolvedPeakConcurrent,
      shardsTotal: shardsSummary.length,
      requirementsTotal,
      requirementsCovered,
      requirementCoveragePct,
      findingsConfirmed,
      unresolvedFindings,
      ownershipViolations,
      repairRounds,
      globalValidation,
      buildStatus,
      finalStatus,
      researchCacheHits: researchCacheHits || 0,
      researchCacheMisses: researchCacheMisses || 0,
      reconCalls: reconCalls || 0,
      researchCalls: researchCalls || 0,
      builderCalls: builderCalls || 0,
      verifierCalls: verifierCalls || 0,
      arbiterCalls: arbiterCalls || 0,
      repairCalls: repairCalls || 0,
      integrationReviewerCalls: integrationReviewerCalls || 0,
      preReconScheduled: preReconScheduled || 0,
      preReconAvoided: preReconAvoided || 0,
      highRiskArbiterAvoided: highRiskArbiterAvoided || highRiskFastPathCount || 0,
      highRiskFastPathCount: highRiskFastPathCount || highRiskArbiterAvoided || 0,
      arbiterInvocations: arbiterInvocations || arbiterCalls || 0,
      arbiterAvoided: arbiterAvoided || 0,
    },
    shards: shardsSummary,
  };
}

export {
  scanInvariants,
  evaluateReleaseReadiness,
  formatRepairRequest,
} from './release-readiness-gate.mjs';

export {
  getRepoRoot,
  getWorktreesBaseDir,
  createShardWorktree,
  inspectWorktreeDiff,
  integrateWorktree,
  cleanupWorktree,
  reapStaleWorktrees,
} from './worktree-manager.mjs';

export {
  ExecutionTelemetry,
  loadTelemetry,
  compareTelemetry,
} from './telemetry.mjs';

export {
  findAllTestFiles,
  discoverTargetedTests,
  runTargetedTests,
  VerificationCache,
} from './targeted-test-runner.mjs';

export {
  gradeExecution,
  gradeBenchmark,
} from './eval-grader.mjs';

export {
  ResearchCache,
  resolveAdaptivePolicy,
  resolveVerificationStrategy,
  evaluateVerificationPanelOutcome,
  buildAdaptiveContextPacket,
  createEvidencePacket,
  compressDependencyContext,
  formatVerifierPacket,
  formatRepairPacket,
  formatIntegrationShardSummary,
} from './adaptive-context.mjs';

export {
  detectCycles,
  topologicalSort,
  DagScheduler,
  computeEligibleReconShards,
  createSemaphore,
  getAgentPriority,
} from './dag-scheduler.mjs';

export {
  ROLE_TURN_LIMITS,
  DEFAULT_BUDGET_LIMITS,
  BudgetTracker,
  hasCriticalSecurityFinding,
  extractRootCauseSignature,
  hasIdenticalRootCauseFailure,
  runRepairLoop,
} from './budget-policy.mjs';
