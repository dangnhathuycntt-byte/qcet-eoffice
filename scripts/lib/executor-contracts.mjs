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
    if (Array.isArray(s.dependencies)) {
      for (const depId of s.dependencies) {
        if (dependentsMap.has(depId)) {
          dependentsMap.get(depId).add(s.id);
        }
      }
    }
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

    const risk = String(s.risk || 'medium').toLowerCase();
    let riskWeight = 2;
    if (risk === 'critical') riskWeight = 4;
    else if (risk === 'high') riskWeight = 3;
    else if (risk === 'low') riskWeight = 1;

    const reqCount = Array.isArray(s.requirements) ? s.requirements.length : 0;
    const ownsCount = Array.isArray(s.owns) ? s.owns.length : 0;
    const acCount = Array.isArray(s.acceptanceCriteria) ? s.acceptanceCriteria.length : 0;
    const workCount = reqCount + ownsCount + acCount;

    const priority = (transitiveDownstream * 10) + (riskWeight * 3) + workCount;

    priorityMap.set(s.id, {
      priority,
      transitiveDownstream,
      riskWeight,
      workCount,
    });
  }

  return priorityMap;
}

export function shouldIsolateShard(shard, manifest) {
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
  buildAdaptiveContextPacket,
} from './adaptive-context.mjs';

export {
  detectCycles,
  topologicalSort,
  DagScheduler,
} from './dag-scheduler.mjs';





