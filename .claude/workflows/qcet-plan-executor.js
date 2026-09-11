export const meta = {
  name: 'qcet-plan-executor',
  description: 'Execute a QCET implementation plan with sharded parallel implementation, adversarial verification, bounded repair, integration review, and global proof',
  phases: [
    { title: 'Calibrate' },
    { title: 'Recon' },
    { title: 'Implement' },
    { title: 'Verify' },
    { title: 'Repair' },
    { title: 'Integration Review' },
    { title: 'Integration Repair' },
    { title: 'Global Validation' },
    { title: 'Release Gate' },
  ],
};


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
            enum: ['feature', 'infrastructure', 'validation'],
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

          planAnchors: {
            type: 'array',
            items: { type: 'string' },
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


export const RECON_SCHEMA = {
  type: 'object',
  required: [
    'status',
    'currentState',
    'relevantFiles',
    'contracts',
    'implementationNotes',
    'risks',
  ],
  properties: {
    status: {
      type: 'string',
      enum: ['ready', 'blocked'],
    },

    currentState: { type: 'string' },

    relevantFiles: {
      type: 'array',
      items: { type: 'string' },
    },

    contracts: {
      type: 'array',
      items: { type: 'string' },
    },

    implementationNotes: {
      type: 'array',
      items: { type: 'string' },
    },

    risks: {
      type: 'array',
      items: { type: 'string' },
    },

    blocker: { type: 'string' },

    externalResearch: {
      type: 'object',
      required: ['needed'],
      properties: {
        needed: { type: 'boolean' },
        reason: { type: 'string' },
        questions: {
          type: 'array',
          items: { type: 'string' },
        },
        preferredSourceTypes: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  },
};


export const RESEARCH_SCHEMA = {
  type: 'object',
  required: ['claims', 'unresolved'],
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'claim',
          'sourceType',
          'source',
          'versionOrDate',
          'applicability',
          'confidence',
        ],
        properties: {
          claim: { type: 'string' },
          sourceType: {
            type: 'string',
            enum: [
              'official-doc',
              'upstream-repo',
              'issue-tracker',
              'standards-body',
              'vendor-primary',
              'secondary',
              'unverified',
            ],
          },
          source: { type: 'string' },
          versionOrDate: { type: 'string' },
          applicability: { type: 'string' },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low', 'unverified'],
          },
        },
      },
    },
    unresolved: {
      type: 'array',
      items: {
        type: 'object',
        required: ['question', 'reason'],
        properties: {
          question: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
};


export const RECONCILE_SCHEMA = {
  type: 'object',
  required: [
    'status',
    'upstreamChangesDetected',
    'reconciledNotes',
    'invalidatedAssumptions',
    'summary',
  ],
  properties: {
    status: {
      type: 'string',
      enum: ['ready', 'blocked'],
    },
    upstreamChangesDetected: { type: 'boolean' },
    reconciledNotes: {
      type: 'array',
      items: { type: 'string' },
    },
    invalidatedAssumptions: {
      type: 'array',
      items: { type: 'string' },
    },
    summary: { type: 'string' },
    blocker: { type: 'string' },
  },
};


export const IMPLEMENT_SCHEMA = {
  type: 'object',
  required: [
    'status',
    'changedFiles',
    'summary',
    'requirementsSatisfied',
    'testsRun',
    'risks',
  ],
  properties: {
    status: {
      type: 'string',
      enum: ['completed', 'blocked'],
    },

    changedFiles: {
      type: 'array',
      items: { type: 'string' },
    },

    summary: { type: 'string' },

    requirementsSatisfied: {
      type: 'array',
      items: { type: 'string' },
    },

    testsRun: {
      type: 'array',
      items: {
        type: 'object',
        required: ['command', 'status', 'evidence'],
        properties: {
          command: { type: 'string' },
          status: {
            type: 'string',
            enum: ['passed', 'failed', 'not-run'],
          },
          evidence: { type: 'string' },
        },
      },
    },

    risks: {
      type: 'array',
      items: { type: 'string' },
    },

    blocker: { type: 'string' },

    resolvedIssueIds: {
      type: 'array',
      items: { type: 'string' },
    },

    remainingIssueIds: {
      type: 'array',
      items: { type: 'string' },
    },

    progressSummary: { type: 'string' },
  },
};


export const REPAIR_SCHEMA = {
  type: 'object',
  required: [
    'status',
    'changedFiles',
    'summary',
    'resolvedIssueIds',
    'testsRun',
    'risks',
  ],
  properties: {
    status: {
      type: 'string',
      enum: ['completed', 'blocked'],
    },

    changedFiles: {
      type: 'array',
      items: { type: 'string' },
    },

    summary: { type: 'string' },

    resolvedIssueIds: {
      type: 'array',
      items: { type: 'string' },
    },

    remainingIssueIds: {
      type: 'array',
      items: { type: 'string' },
    },

    requirementsSatisfied: {
      type: 'array',
      items: { type: 'string' },
    },

    progressSummary: { type: 'string' },

    testsRun: {
      type: 'array',
      items: {
        type: 'object',
        required: ['command', 'status', 'evidence'],
        properties: {
          command: { type: 'string' },
          status: {
            type: 'string',
            enum: ['passed', 'failed', 'not-run'],
          },
          evidence: { type: 'string' },
        },
      },
    },

    risks: {
      type: 'array',
      items: { type: 'string' },
    },

    blocker: { type: 'string' },
  },
};


export const VERIFY_SCHEMA = {
  type: 'object',
  required: [
    'verdict',
    'requirementsChecked',
    'issues',
    'summary',
  ],
  properties: {
    verdict: {
      type: 'string',
      enum: ['pass', 'fail', 'blocked'],
    },

    requirementsChecked: {
      type: 'array',
      items: { type: 'string' },
    },

    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'severity',
          'category',
          'file',
          'evidence',
          'impact',
          'recommendedFix',
        ],
        properties: {
          id: { type: 'string' },

          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
          },
          category: { type: 'string' },
          file: { type: 'string' },
          evidence: { type: 'string' },
          impact: { type: 'string' },
          recommendedFix: { type: 'string' },
        },
      },
    },

    summary: { type: 'string' },
  },
};


const INTEGRATION_FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings', 'summary'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'severity',
          'category',
          'file',
          'evidence',
          'impact',
          'recommendedFix',
        ],
        properties: {
          id: { type: 'string' },

          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
          },

          category: { type: 'string' },
          file: { type: 'string' },
          evidence: { type: 'string' },
          impact: { type: 'string' },
          recommendedFix: { type: 'string' },
        },
      },
    },

    summary: { type: 'string' },
  },
};


const INTEGRATION_VERDICT_SCHEMA = {
  type: 'object',
  required: ['passed', 'remainingIssues', 'summary'],
  properties: {
    passed: { type: 'boolean' },

    remainingIssues: {
      type: 'array',
      items: { type: 'string' },
    },

    summary: { type: 'string' },
  },
};


const GLOBAL_VALIDATION_SCHEMA = {
  type: 'object',
  required: [
    'status',
    'checks',
    'requirementCoverage',
    'preExistingFailures',
    'summary',
  ],
  properties: {
    status: {
      type: 'string',
      enum: ['pass', 'fail', 'blocked'],
    },

    checks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'command', 'status', 'evidence'],
        properties: {
          name: { type: 'string' },
          command: { type: 'string' },

          status: {
            type: 'string',
            enum: ['passed', 'failed', 'not-applicable'],
          },

          evidence: { type: 'string' },
        },
      },
    },

    requirementCoverage: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'status', 'evidence'],
        properties: {
          id: { type: 'string' },

          status: {
            type: 'string',
            enum: ['satisfied', 'failed', 'uncertain'],
          },

          evidence: { type: 'string' },
        },
      },
    },

    preExistingFailures: {
      type: 'array',
      items: { type: 'string' },
    },

    summary: { type: 'string' },
  },
};


const FINAL_SCHEMA = {
  type: 'object',
  required: ['status', 'reasons', 'unresolvedRisks'],
  properties: {
    status: {
      type: 'string',
      enum: [
        'READY',
        'READY_WITH_KNOWN_ISSUES',
        'BLOCKED',
      ],
    },

    reasons: {
      type: 'array',
      items: { type: 'string' },
    },

    unresolvedRisks: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};


// -----------------------------------------------------------------------------
// DETERMINISTIC UTILITIES & INVARIANTS (Canonical Module)
// Pure JavaScript implementation compliant with Workflow runtime sandbox
// -----------------------------------------------------------------------------

export function normalizePath(p, repoRoot = (typeof process !== 'undefined' && process.cwd ? process.cwd() : '')) {
  if (!p || typeof p !== 'string') return '';
  let normalized = p.replace(/\\/g, '/').trim();
  while (normalized.includes('//')) {
    normalized = normalized.replace(/\/\//g, '/');
  }
  normalized = normalized.replace(/^\.\//, '');
  if (repoRoot) {
    let normRoot = repoRoot.replace(/\\/g, '/').trim();
    while (normRoot.includes('//')) {
      normRoot = normRoot.replace(/\/\//g, '/');
    }
    if (normRoot.endsWith('/')) normRoot = normRoot.slice(0, -1);
    if (normalized.startsWith(normRoot + '/')) {
      normalized = normalized.slice(normRoot.length + 1);
    } else if (normalized === normRoot) {
      normalized = '';
    }
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function stripWildcards(pattern) {
  if (!pattern) return '';
  const norm = normalizePath(pattern);
  const idx = norm.search(/[\*\?\[\{]/);
  if (idx === -1) return norm;
  const prefix = norm.slice(0, idx);
  const lastSlash = prefix.lastIndexOf('/');
  return lastSlash === -1 ? '' : prefix.slice(0, lastSlash);
}

export function globToRegex(globPattern) {
  const norm = normalizePath(globPattern);
  if (!norm) return /^$/;

  let regexStr = '^';
  let i = 0;
  const len = norm.length;

  while (i < len) {
    const c = norm[i];
    if (c === '*' && norm[i + 1] === '*') {
      if (norm[i + 2] === '/') {
        regexStr += '(?:.+/)?';
        i += 3;
      } else {
        regexStr += '.*';
        i += 2;
      }
    } else if (c === '*') {
      regexStr += '[^/]*';
      i++;
    } else if (c === '?') {
      regexStr += '[^/]';
      i++;
    } else if (['.', '(', ')', '+', '|', '^', '$', '[', ']', '{', '}', '\\'].includes(c)) {
      regexStr += '\\' + c;
      i++;
    } else {
      regexStr += c;
      i++;
    }
  }

  regexStr += '$';
  return new RegExp(regexStr);
}

export function isExternalAbsolutePath(targetPath, repoRoot) {
  if (!targetPath || typeof targetPath !== 'string') return false;
  const isAbs = targetPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(targetPath);
  if (!isAbs) return false;
  if (!repoRoot || typeof repoRoot !== 'string') return false;
  const normTarget = normalizePath(targetPath);
  const normRoot = normalizePath(repoRoot);
  return !normTarget.startsWith(normRoot);
}

export function matchesOwnership(filePath, pattern) {
  const normFile = normalizePath(filePath);
  const normPattern = normalizePath(pattern);

  if (!normFile || !normPattern) return false;

  if (normFile === normPattern) return true;

  if (!normPattern.includes('*') && !normPattern.includes('?')) {
    if (normFile.startsWith(normPattern + '/')) return true;
  }

  const regex = globToRegex(normPattern);
  return regex.test(normFile);
}

export function pathsOverlap(patternA, patternB) {
  const normA = normalizePath(patternA);
  const normB = normalizePath(patternB);

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const hasWildcardA = /[\*\?\[\{]/.test(normA);
  const hasWildcardB = /[\*\?\[\{]/.test(normB);

  if (!hasWildcardA && !hasWildcardB) {
    return normA === normB || normA.startsWith(normB + '/') || normB.startsWith(normA + '/');
  }

  if (!hasWildcardA && hasWildcardB) {
    return matchesOwnership(normA, normB) || stripWildcards(normB) === '' || normA.startsWith(stripWildcards(normB) + '/');
  }
  if (hasWildcardA && !hasWildcardB) {
    return matchesOwnership(normB, normA) || stripWildcards(normA) === '' || normB.startsWith(stripWildcards(normA) + '/');
  }

  const regexA = globToRegex(normA);
  const regexB = globToRegex(normB);

  const prefixA = stripWildcards(normA);
  const prefixB = stripWildcards(normB);

  if (prefixA && prefixB) {
    if (!prefixA.startsWith(prefixB) && !prefixB.startsWith(prefixA)) {
      return false;
    }
  }

  if (prefixA && regexB.test(prefixA)) return true;
  if (prefixB && regexA.test(prefixB)) return true;

  return true;
}

export function toRepoRelativePath(targetPath, repoRoot = (typeof process !== 'undefined' && process.cwd ? process.cwd() : '')) {
  if (!targetPath) return '';
  let norm = normalizePath(targetPath, repoRoot);
  if (repoRoot) {
    const normRoot = normalizePath(repoRoot, '');
    if (norm.startsWith(normRoot + '/')) {
      norm = norm.slice(normRoot.length + 1);
    } else if (norm === normRoot) {
      norm = '';
    }
  }
  const wtMatch = norm.match(/^(?:\.\/)?(?:\.claude\/worktrees\/[^/]+\/)(.*)$/);
  if (wtMatch) {
    norm = wtMatch[1];
  }
  return norm.replace(/^\/+/, '');
}

export function getActiveShardsFilePaths() {
  const sessionScope = (typeof process !== 'undefined' && (process.env?.QCET_SESSION_ID || process.env?.CLAUDE_CONVERSATION_ID)) || '';
  const customFile = (typeof process !== 'undefined' && process.env?.QCET_ACTIVE_SHARDS_FILE) || null;
  const paths = [
    customFile,
    sessionScope ? `/tmp/qcet-active-shards-${sessionScope}.json` : null,
    '/tmp/qcet-active-shards.json',
  ].filter(Boolean);
  return [...new Set(paths)];
}

export function syncActiveShardBoundaries(shardsPayload, phaseName = 'Calibrate') {
  // If running in Node.js environment (e.g. tests), synchronize synchronously to disk
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const fs = process.getBuiltinModule ? process.getBuiltinModule('node:fs') : (typeof require !== 'undefined' ? require('fs') : null);
      const path = process.getBuiltinModule ? process.getBuiltinModule('node:path') : (typeof require !== 'undefined' ? require('path') : null);
      if (fs && path) {
        const targetFiles = getActiveShardsFilePaths();
        const jsonContent = JSON.stringify(shardsPayload, null, 2);
        for (const filePath of targetFiles) {
          try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, jsonContent, 'utf8');
          } catch (_) {}
        }
      }
    } catch (_) {}
  }
  // In pure workflow sandbox, active shard boundaries are synced via callAgent in Calibrate phase
  return true;
}

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

  // Check duplicate requirement IDs in manifest
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
    errors.push(
      `Duplicate requirement IDs in manifest: ${[...duplicateReqIds].join(', ')}`
    );
  }

  // Check duplicate shard IDs, empty objectives, and non-infra shards with 0 requirements
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

    // Empty objective check
    if (!shard.objective || typeof shard.objective !== 'string' || shard.objective.trim() === '') {
      errors.push(`Shard '${shardId}' has an empty or missing objective`);
    }

    // Non-infrastructure shards with zero mapped requirements
    const isInfra = shard.kind === 'infrastructure' || shard.kind === 'support';
    const shardReqs = (shard.requirements || [])
      .map((r) => (typeof r === 'string' ? r.trim() : String(r).trim()))
      .filter(Boolean);

    if (!isInfra && shardReqs.length === 0) {
      errors.push(
        `Non-infrastructure shard '${shardId}' has zero mapped requirements`
      );
    }
  }

  if (duplicateShardIds.size > 0) {
    errors.push(
      `Duplicate shard IDs in manifest: ${[...duplicateShardIds].join(', ')}`
    );
  }

  // Claimed requirement coverage check (must be exact match: allReqIds === union(shards[].requirements))
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
        errors.push(
          `Shard '${shardId}' contains duplicate requirement ID '${reqId}'`
        );
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
    errors.push(
      `Unclaimed plan requirements (missing coverage): ${missingReqIds.join(', ')}`
    );
  }

  if (unknownReqIds.size > 0) {
    errors.push(
      `Unknown requirement IDs claimed by shards: ${[...unknownReqIds].join(', ')}`
    );
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
            const isIsolatedA = shardA.isolation === 'worktree' || shardA.isolated === true || shardA.kind === 'exploratory' || shardA.kind === 'migration';
            const isIsolatedB = shardB.isolation === 'worktree' || shardB.isolated === true || shardB.kind === 'exploratory' || shardB.kind === 'migration';
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

export function createConcurrencyLimiter(maxConcurrent = Infinity) {
  const parsed = Number(maxConcurrent);
  const limit = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : Infinity;
  let active = 0;
  const queue = [];

  const drain = () => {
    while (active < limit && queue.length > 0) {
      const next = queue.shift();
      active++;
      Promise.resolve()
        .then(next.task)
        .then(next.resolve, next.reject)
        .finally(() => {
          active--;
          drain();
        });
    }
  };

  return (task) =>
    new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      drain();
    });
}

export function selectIntegrationReviewDimensionIds(shardSummary = []) {
  const summaries = Array.isArray(shardSummary) ? shardSummary : [];
  const risks = summaries.map((item) => String(item?.risk || 'low').toLowerCase());
  const hasHighRisk = risks.some((risk) => risk === 'high' || risk === 'critical');
  const hasMediumRisk = risks.some((risk) => risk === 'medium');
  const authSurface = summaries.some((item) => {
    const haystack = JSON.stringify({
      files: item?.changedFiles || [],
      requirements: item?.requirements || [],
      id: item?.id || '',
    }).toLowerCase();
    return /auth|permission|rbac|session|security|token|role/.test(haystack);
  });

  if (hasHighRisk || authSurface) {
    return ['contracts', 'authorization', 'semantics', 'regression'];
  }
  if (hasMediumRisk || summaries.length > 2) {
    return ['contracts', 'semantics', 'regression'];
  }
  return ['contracts', 'regression'];
}

export function computeCriticalPathDurationMs(manifest, shardDurations = {}) {
  const shards = Array.isArray(manifest?.shards) ? manifest.shards : [];
  const byId = new Map(shards.map((shard) => [shard.id, shard]));
  const memo = new Map();
  const visiting = new Set();

  const durationOf = (id) => {
    const value = Number(shardDurations?.[id]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  const longestTo = (id) => {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const shard = byId.get(id);
    const deps = Array.isArray(shard?.dependencies) ? shard.dependencies : [];
    let upstream = 0;
    for (const depId of deps) {
      upstream = Math.max(upstream, longestTo(depId));
    }
    visiting.delete(id);
    const total = upstream + durationOf(id);
    memo.set(id, total);
    return total;
  };

  let critical = 0;
  for (const shard of shards) {
    critical = Math.max(critical, longestTo(shard.id));
  }
  return critical > 0 ? Math.round(critical) : null;
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
  const criticalIntegrationDefects = synthFindings.filter((d) =>
    ['critical', 'high'].includes(String(d?.severity || '').toLowerCase())
  );
  if (criticalIntegrationDefects.length > 0) {
    if (!integrationRepair || integrationRepair.status !== 'completed') {
      deterministicBlockers.push(
        `${criticalIntegrationDefects.length} critical/high integration defect(s) remain unresolved.`
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
  wallClockMs = 0,
  calibrationDurationMs = 0,
  agentsCount = 0,
  totalAgents = 0,
  peakConcurrent = 1,
  tokensTotal = null,
  timeToFirstBuilderMs = null,
  criticalPathDurationMs = null,
  avgDependencyWaitMs = null,
  domain = 'general',
  executorVersion = 'v1.5',
  planPath = '',
  timestamp = '2026-09-10T00:00:00.000Z',
  runId = '',
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
  // Aggregate both shard-level confirmed defects and integration-level confirmed defects
  const findingsConfirmed = verificationFindings + synthFindings.length;
  if (integrationRepair) {
    repairRounds += 1;
  }

  const requirementsCovered = coveredReqSet.size;
  // Grounded globalPass definition
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

  const resolvedAgentsCount = Math.max(1, totalAgents || agentsCount || 1);
  // Grounded tokens: do not fabricate tokens when unmeasured
  const tokens = typeof tokensTotal === 'number' && tokensTotal > 0 ? tokensTotal : null;

  const wallClock = typeof wallClockMs === 'number' && wallClockMs > 0 ? Math.round(wallClockMs) : null;
  const calibrationDuration = typeof calibrationDurationMs === 'number' && calibrationDurationMs > 0 ? Math.round(calibrationDurationMs) : null;
  const timeToFirstBuilder = typeof timeToFirstBuilderMs === 'number' && timeToFirstBuilderMs >= 0 ? Math.round(timeToFirstBuilderMs) : null;
  const criticalPathDuration = typeof criticalPathDurationMs === 'number' && criticalPathDurationMs >= 0 ? Math.round(criticalPathDurationMs) : null;
  const avgDependencyWait = typeof avgDependencyWaitMs === 'number' && avgDependencyWaitMs >= 0 ? Math.round(avgDependencyWaitMs) : null;

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

  let gateTelemetry = { totalInvocations: 0, bounceBackCount: 0, cutoffBypassCount: 0, bypassedAgents: [] };
  try {
    const sessionScope = process.env.QCET_SESSION_ID || process.env.CLAUDE_CONVERSATION_ID || '';
    const candidateFiles = [
      process.env.QCET_GATE_TELEMETRY_FILE,
      sessionScope ? path.join('/tmp', `qcet-gate-telemetry-${sessionScope}.json`) : null,
      path.join('/tmp', 'qcet-gate-telemetry.json'),
    ].filter(Boolean);
    for (const f of candidateFiles) {
      if (fs.existsSync(f)) {
        const raw = fs.readFileSync(f, 'utf8');
        gateTelemetry = JSON.parse(raw);
        break;
      }
    }
  } catch (_) {}

  const structuredOutputRetryRate = gateTelemetry.totalInvocations > 0
    ? Number((gateTelemetry.bounceBackCount / gateTelemetry.totalInvocations).toFixed(3))
    : 0.0;

  const run = {
    runId: resolvedRunId,
    plan: planPath || 'docs/plans/active/plan.md',
    timestamp,
    executorVersion,
    domain,
    description: `QCET Plan Executor ${executorVersion} execution run for ${planPath || 'manifest'}`,
    wallClockMs: wallClock,
    calibrationDurationMs: calibrationDuration,
    shards: Array.isArray(manifest?.shards) ? manifest.shards.length : 0,
    agents: resolvedAgentsCount,
    peakConcurrent: Math.max(1, peakConcurrent),
    tokens,
    requirementsTotal,
    requirementsCovered,
    ownershipViolations,
    verificationFindings,
    findingsConfirmed,
    repairRounds,
    blockedShards,
    globalValidation,
    buildStatus,
    finalStatus,
    metrics: {
      correctness: {
        requirementCoveragePct,
        unresolvedFindings,
        outOfScopeEdits: ownershipViolations,
        globalValidation,
        buildStatus,
      },
      speed: {
        wallClockMs: wallClock,
        calibrationDurationMs: calibrationDuration,
        timeToFirstBuilderMs: timeToFirstBuilder,
        criticalPathDurationMs: criticalPathDuration,
        avgDependencyWaitMs: avgDependencyWait,
      },
      efficiency: {
        totalAgents: resolvedAgentsCount,
        tokens,
        tokensPerVerifiedRequirement: tokens !== null && requirementsCovered > 0 ? Math.round(tokens / requirementsCovered) : null,
        verifierTokenCost: tokens !== null ? Math.round(tokens * 0.24) : null,
        researchEscalationRate: 0.0,
      },
      reliability: {
        nullAgentRate: 0.0,
        structuredOutputRetryRate,
        cutoffBypasses: gateTelemetry.cutoffBypassCount || 0,
        workflowReruns: 0,
        noProgressRepairRate: 0.0,
      },
    },
    shardsSummary,
  };

  const baseline = {
    runId: 'run-baseline-ux-consolidation-01',
    wallClockMs: 462000,
    tokens: 894000,
    calibrationDurationMs: 42000,
    agents: 46,
    repairRounds: 4,
    requirementsCovered: 36,
  };

  const hasRealMeasurements = typeof run.wallClockMs === 'number' && typeof run.tokens === 'number';
  const deltaWallClockMs = typeof run.wallClockMs === 'number' ? run.wallClockMs - baseline.wallClockMs : null;
  const deltaWallClockPct = typeof run.wallClockMs === 'number'
    ? Number((((run.wallClockMs - baseline.wallClockMs) / baseline.wallClockMs) * 100).toFixed(2))
    : null;
  const deltaTokens = typeof run.tokens === 'number' ? run.tokens - baseline.tokens : null;
  const deltaTokensPct = typeof run.tokens === 'number'
    ? Number((((run.tokens - baseline.tokens) / baseline.tokens) * 100).toFixed(2))
    : null;
  const deltaCalibrationDurationMs = typeof run.calibrationDurationMs === 'number'
    ? run.calibrationDurationMs - baseline.calibrationDurationMs
    : null;
  const deltaAgents = run.agents - baseline.agents;
  const deltaRepairRounds = run.repairRounds - baseline.repairRounds;

  let wallClockTol = 5.0;
  let tokensTol = 10.0;
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const fs = require('fs');
      const path = require('path');
      const baselineFile = path.join(process.cwd(), '.claude', 'executor-evals', 'baseline.json');
      if (fs.existsSync(baselineFile)) {
        const bData = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
        if (bData?.regressionThresholds?.boundedPerformanceBudgets) {
          const budgets = bData.regressionThresholds.boundedPerformanceBudgets;
          if (typeof budgets.wallClockRegressionTolerancePct === 'number') {
            wallClockTol = budgets.wallClockRegressionTolerancePct;
          }
          if (typeof budgets.tokensRegressionTolerancePct === 'number') {
            tokensTol = budgets.tokensRegressionTolerancePct;
          }
        }
      }
    } catch (_) {}
  }

  const regressionFlags = {
    wallClockRegressed: deltaWallClockPct !== null ? deltaWallClockPct > wallClockTol : false,
    tokensBudgetExceeded: deltaTokensPct !== null ? deltaTokensPct > tokensTol : false,
    uncoveredRequirements: run.requirementsCovered < run.requirementsTotal,
    scopeViolations: run.ownershipViolations > 0,
    correctnessRegressed: run.globalValidation !== 'pass' || run.finalStatus === 'BLOCKED' || ((run.metrics?.correctness?.unresolvedFindings || 0) > 0),
  };

  let verdict = 'PASS';
  let verdictRationale = 'All regression flags false, zero-tolerance invariants pass.';

  if (
    regressionFlags.wallClockRegressed ||
    regressionFlags.tokensBudgetExceeded ||
    regressionFlags.uncoveredRequirements ||
    regressionFlags.scopeViolations ||
    regressionFlags.correctnessRegressed
  ) {
    verdict = 'REGRESSION_DETECTED';
    verdictRationale = 'Execution triggered regression flags or failed correctness gates.';
  } else if (hasRealMeasurements && ((deltaWallClockPct !== null && deltaWallClockPct <= -5.0) || (deltaTokensPct !== null && deltaTokensPct <= -5.0))) {
    verdict = 'IMPROVEMENT';
    verdictRationale = `Requirement coverage preserved (${requirementCoveragePct}%), 0 ownership violations, ` +
      `${deltaWallClockPct !== null && deltaWallClockPct <= 0 ? Math.abs(deltaWallClockPct) + '% wall-clock reduction' : ''}` +
      `${deltaTokensPct !== null && deltaTokensPct <= 0 ? ', ' + Math.abs(deltaTokensPct) + '% token efficiency gain' : ''}.`;
  } else if (!hasRealMeasurements) {
    verdict = 'PASS';
    verdictRationale = 'Correctness gates passed (performance metrics unmeasured/inconclusive).';
  }

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    templateVersion: '1.0.0',
    description: 'Standard reproducible evaluation telemetry for QCET Plan Executor',
    run,
    comparison: {
      baselineRunId: baseline.runId,
      deltaWallClockMs,
      deltaWallClockPct,
      deltaTokens,
      deltaTokensPct,
      deltaCalibrationDurationMs,
      deltaAgents,
      deltaRepairRounds,
      regressionFlags,
      verdict,
      verdictRationale,
    },
  };
}

export function buildShardPacket(shard, manifest) {
  if (!shard) return null;

  // Build lookup map from manifest.requirements for deterministic backfill
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
        manifestReqMap.set(id, text || `Requirement ${id}`);
      }
    }
  }

  // Requirement details: use shard.requirementDetails if provided and valid;
  // backfill requirement text from manifest.requirements if an item has an empty or whitespace-only text property.
  let requirementDetails = Array.isArray(shard.requirementDetails)
    ? shard.requirementDetails
        .filter((r) => r && typeof r === 'object' && (r.id || r.text))
        .map((r) => {
          const id = String(r.id || '').trim();
          let text =
            typeof r.text === 'string'
              ? r.text.trim()
              : typeof r.description === 'string'
              ? r.description.trim()
              : '';
          if (!text && id && manifestReqMap.has(id)) {
            text = manifestReqMap.get(id);
          }
          if (!text && id) {
            text = `Requirement ${id}`;
          }
          return { id, text };
        })
        .filter((r) => r.id)
    : [];

  // If requirementDetails is empty or missing requirements, backfill deterministically from shard.requirements
  const existingDetailIds = new Set(requirementDetails.map((r) => r.id));
  if (Array.isArray(shard.requirements)) {
    for (const reqId of shard.requirements) {
      const id = typeof reqId === 'string' ? reqId.trim() : String(reqId).trim();
      if (id && !existingDetailIds.has(id)) {
        requirementDetails.push({
          id,
          text: manifestReqMap.get(id) || `Requirement ${id}`,
        });
        existingDetailIds.add(id);
      }
    }
  }

  return {
    id: shard.id,
    objective: shard.objective || '',
    kind: shard.kind || 'feature',
    requirementDetails,
    planAnchors: Array.isArray(shard.planAnchors) ? shard.planAnchors : [],
    owns: Array.isArray(shard.owns) ? shard.owns : [],
    antiOwns: Array.isArray(shard.antiOwns) ? shard.antiOwns : [],
    dependencies: Array.isArray(shard.dependencies) ? shard.dependencies : [],
    requirements: Array.isArray(shard.requirements) ? shard.requirements : [],
    acceptanceCriteria: Array.isArray(shard.acceptanceCriteria) ? shard.acceptanceCriteria : [],
    risk: shard.risk || 'medium',
    testHints: Array.isArray(shard.testHints) ? shard.testHints : [],
  };
}

export function validateResearchEscalation(externalResearch, shardPacket) {
  if (!externalResearch || !externalResearch.needed) {
    return {
      allowed: false,
      reason: 'Research not requested',
      questions: [],
      rejectedQuestions: [],
    };
  }

  const rawQuestions = Array.isArray(externalResearch.questions)
    ? externalResearch.questions
    : [];
  const questions = rawQuestions
    .map((q) => (typeof q === 'string' ? q.trim() : ''))
    .filter(Boolean);

  if (questions.length === 0) {
    return {
      allowed: false,
      reason: 'No research questions provided in escalation request',
      questions: [],
      rejectedQuestions: [],
    };
  }

  // Strictly forbid web searches for local codebase queries:
  // - local filesystem paths (src/, app/, prisma/, etc.)
  // - code file extensions (.ts, .tsx, .js, .json, etc.)
  // - internal QCET business logic, call graphs, internal models, or local tests
  const internalPatterns = [
    /\b(src|app|components|lib|prisma|tests|\.claude|workflows)\//i,
    /(?<!\b(?:next|node|react|vue|nuxt|express|ember|electron))\.(ts|tsx|js|jsx|prisma|json|css|md)\b/i,
    /\b(qcet|internal|local|codebase|repo|repository|call\s*graph|callers|consumers)\b/i,
  ];

  // Check against shard ownership paths as well
  const shardPaths = [
    ...(shardPacket?.owns || []),
    ...(shardPacket?.antiOwns || []),
  ];

  const approvedQuestions = [];
  const rejectedQuestions = [];

  for (const q of questions) {
    const matchesPattern = internalPatterns.some((p) => p.test(q));
    const matchesShardPath = shardPaths.some((p) => {
      const clean = stripWildcards(normalizePath(p));
      return clean && q.toLowerCase().includes(clean.toLowerCase());
    });

    if (matchesPattern || matchesShardPath) {
      rejectedQuestions.push(q);
    } else {
      approvedQuestions.push(q);
    }
  }

  if (approvedQuestions.length === 0) {
    return {
      allowed: false,
      reason: `All research questions were rejected as internal codebase queries: ${rejectedQuestions.join('; ')}`,
      questions: [],
      rejectedQuestions,
    };
  }

  return {
    allowed: true,
    reason: externalResearch.reason || 'External research approved for upstream/spec inquiry',
    questions: approvedQuestions,
    rejectedQuestions,
    preferredSourceTypes: Array.isArray(externalResearch.preferredSourceTypes)
      ? externalResearch.preferredSourceTypes
      : ['official-doc', 'upstream-repo'],
  };
}


// -----------------------------------------------------------------------------
// STANDARDIZED COHORT PROMPT PREFIXES (PROMPT CACHE OPTIMIZATION)
// -----------------------------------------------------------------------------

export const RECON_STATIC_PREFIX = `You are the QCET Specialized Reconnaissance Agent (qcet-recon).
Your sole responsibility is read-only repository reconnaissance, caller/contract analysis, test discovery, and uncertainty classification before implementation begins.

CORE MANDATE & INVARIANTS:
1. Strictly read-only: do NOT modify files (Write, Edit, NotebookEdit are forbidden).
2. Repository evidence first: base every conclusion on actual codebase inspection.
3. Server truth wins: server database schema and authenticated sessions are authoritative.
4. Never invent operational data or mock structures.
5. Invariant adherence: uphold Core System Invariants (00-core.md) and Domain Freeze Rules (05-domain-freeze.md).
6. Scope boundary: investigate ONLY what is needed for the assigned shard. Do NOT deeply audit or redesign areas owned by other shards.
7. External research escalation rules:
   - Local codebase queries (file paths, call graphs, internal models, local tests) MUST NEVER use web research.
   - Web research is strictly gated to approved external domains (official framework docs, library specs, RFCs, W3C/WCAG standards, statutory regulations).
   - If external research is needed, specify needed: true, reason, questions, and preferredSourceTypes in externalResearch.
8. Rely primarily on the self-contained JIT Shard Packet.`;

export const BUILDER_STATIC_PREFIX = `You are the QCET Specialized Implementation Builder Agent (qcet-builder).
Your sole responsibility is surgical, high-precision implementation strictly within your assigned file ownership, adhering unconditionally to QCET architectural invariants.

CORE MANDATE & INVARIANTS:
1. One capability, one canonical implementation: never create parallel engines or secondary shims.
2. Role is not scope: role represents authority; scope represents visual dataset filtering.
3. Server truth wins: authenticated server state and schema are authoritative over client assumptions.
4. Never invent operational data or fake business metrics.
5. Preserve unrelated changes: keep edits strictly confined to assigned files.
6. Never weaken security to pass tests.
7. WebSearch is disabled: rely on repository truth, canonical architecture, and provided research evidence.
8. Follow YAGNI: prefer surgical edits over large rewrites.
9. Add or update targeted tests for changed behavior. Run ONLY relevant targeted checks. Do NOT run the full repository test suite.
10. Return complete structured implementation evidence with actual test outputs.`;

export const REPAIR_STATIC_PREFIX = `You are the QCET Specialized Implementation Builder Agent (qcet-builder) responsible for repairing confirmed defects.
Your sole responsibility is surgical resolution of confirmed findings strictly within assigned file ownership.

CORE MANDATE & INVARIANTS:
1. Fix ONLY confirmed verification findings.
2. Stay strictly inside this shard's declared ownership (owns). Do NOT modify antiOwns or files owned by other shards.
3. Do not broaden scope or introduce secondary abstractions.
4. Do not revert unrelated user or agent changes.
5. Add/update targeted tests for the repair. Run ONLY relevant targeted checks.
6. Report complete set of currently modified files in changedFiles (omit reverted files).
7. Track repair convergence deterministically:
   - resolvedIssueIds: issue IDs confirmed fixed in this round.
   - remainingIssueIds: issue IDs not yet resolved.
   - progressSummary: concrete progress made toward resolution.
8. If a finding requires touching another shard's file, do NOT violate ownership. Report as blocked/cross-shard.`;

export const SKEPTIC_STATIC_PREFIX = `You are the QCET Specialized Adversarial Skeptic Agent (qcet-skeptic).
You did NOT implement this shard. Your sole responsibility is independent, read-only adversarial verification, probing boundaries, testing negative assertions, and refuting unverified claims.

CORE MANDATE & INVARIANTS:
1. Strictly read-only: file modifications are forbidden.
2. Adversarial stance: your job is NOT to approve; your job is to TRY TO PROVE IT WRONG.
3. Inspect actual repository files and actual git diff. Do NOT trust the implementer's summary.
4. Verify every acceptance criterion and mapped requirement.
5. Probe edge cases: empty, null, boundary values, concurrent operations, and error handling.
6. Verify security and authorization: server-side RBAC and session checks.
7. Verify that targeted tests actually exercise the changed behavior and assert expected outcomes.
8. Strictly enforce file ownership: any modified file outside shard.owns is an automatic failure.
9. Report issues only with concrete repository evidence. Distinguish real regressions from pre-existing issues.`;

export const RESEARCHER_STATIC_PREFIX = `You are the QCET Specialized External Research Agent (qcet-researcher).
Your sole responsibility is gathering verified external facts from official documentation, library specifications, and upstream release notes.

CORE MANDATE & INVARIANTS:
1. Read-only external research: file modifications are strictly prohibited.
2. WebSearch and WebFetch are enabled for external upstream inquiry only.
3. Official and primary sources first: prioritize vendor documentation, library RFCs, and upstream issue trackers over community blogs or secondary summaries.
4. Source-backed claims: every claim must cite source, sourceType, versionOrDate, applicability, and confidence.
5. Mark failed or inconclusive searches as confidence: 'unverified' rather than assuming validity.
6. Never research internal QCET code or files on the web. Local codebase truth comes from the repository.
7. External patterns must never override QCET canonical architecture or project invariants.`;

export const RECONCILE_STATIC_PREFIX = `You are the QCET Specialized Pre-Implementation Reconciliation Agent (qcet-recon).
Your goal is to reconcile a shard's pre-recon assumptions against completed upstream dependency deltas (git diff, exported types, API signatures, changed files) before implementation begins.

Inspect the actual repository and upstream changed files.
Verify whether upstream changes invalidated any pre-recon assumptions, modified contracts, or introduced unexpected blockers.
Do NOT modify files.
Return structured reconciliation evidence adhering strictly to schema.`;


// -----------------------------------------------------------------------------
// WORKFLOW
// -----------------------------------------------------------------------------

const rawArgs = typeof args !== 'undefined' ? args : {};
let planPath = null;
let planContent = null;
let budgetConfig = null;
let worktreeIsolation = 'auto';
let domainConfig = 'general';
let maxRepairRounds = 2;

if (typeof rawArgs === 'string') {
  const trimmed = rawArgs.trim().replace(/^['"]|['"]$/g, '');
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.plan === 'string' && (parsed.plan.endsWith('.md') || parsed.plan.includes('/'))) {
        planPath = parsed.plan;
      } else if (parsed.planPath) {
        planPath = parsed.planPath;
      } else if (parsed.plan) {
        planContent = parsed.plan;
      }
      budgetConfig = parsed.budget || null;
      worktreeIsolation = parsed.worktreeIsolation !== undefined ? parsed.worktreeIsolation : 'auto';
      domainConfig = parsed.domain || 'general';
      maxRepairRounds = typeof parsed.maxRepairRounds === 'number' ? parsed.maxRepairRounds : 2;
    } catch (_) {
      planPath = trimmed;
    }
  } else {
    planPath = trimmed;
  }
} else if (typeof rawArgs === 'object' && rawArgs !== null) {
  if (typeof rawArgs.plan === 'string' && (rawArgs.plan.endsWith('.md') || rawArgs.plan.includes('/'))) {
    planPath = rawArgs.plan;
  } else if (rawArgs.planPath) {
    planPath = rawArgs.planPath;
  } else if (rawArgs.plan) {
    planContent = rawArgs.plan;
  }
  budgetConfig = rawArgs.budget || null;
  worktreeIsolation = rawArgs.worktreeIsolation !== undefined ? rawArgs.worktreeIsolation : 'auto';
  domainConfig = rawArgs.domain || 'general';
  maxRepairRounds = typeof rawArgs.maxRepairRounds === 'number' ? rawArgs.maxRepairRounds : 2;
}

if (!planPath && !planContent) {
  return {
    status: 'BLOCKED',
    reason: 'Provide args.planPath or args.plan',
  };
}

const planReference = planPath
  ? `
Read the implementation plan from this exact file:

${planPath}
`
  : `
The implementation plan is provided below:

${planContent}
`;

const ambiguityFallback = planPath
  ? `\nAMBIGUITY FALLBACK:\nIf and only if this shard packet is genuinely ambiguous, you may inspect the original master plan at:\n${planPath}\n`
  : '';

// Concurrency & wall-clock tracking for evaluation telemetry
const workflowStartedAtMs = typeof rawArgs?.startTime === 'number' && rawArgs.startTime > 0
  ? rawArgs.startTime
  : Date.now();
const calibrationStartedAtMs = Date.now();
let calibrationDurationMs = typeof rawArgs?.calibrationDurationMs === 'number' ? rawArgs.calibrationDurationMs : 0;
let activeAgents = 0;
let peakConcurrent = 0;
let totalAgentsCount = 0;
let firstBuilderStartedAtMs = null;
const dependencyWaitDurationsMs = [];

const configuredMaxConcurrent = Number(budgetConfig?.maxConcurrentAgents ?? budgetConfig?.maxConcurrent ?? 8);
const maxConcurrentAgents = Number.isFinite(configuredMaxConcurrent) && configuredMaxConcurrent > 0
  ? Math.floor(configuredMaxConcurrent)
  : 8;
const configuredMaxAgents = Number(budgetConfig?.maxAgents);
const maxAgents = Number.isFinite(configuredMaxAgents) && configuredMaxAgents > 0
  ? Math.floor(configuredMaxAgents)
  : Infinity;
const runWithAgentSlot = createConcurrencyLimiter(maxConcurrentAgents);

const rawAgent = agent;
const callAgent = async (prompt, options) => {
  if (totalAgentsCount >= maxAgents) {
    log(`WARNING: Agent budget exhausted (${maxAgents}). Returning null from callAgent.`);
    return null;
  }
  if (typeof budget !== 'undefined' && budget?.total && budget.remaining() <= 0) {
    log('WARNING: Token budget exhausted. Returning null from callAgent.');
    return null;
  }
  totalAgentsCount++;
  return runWithAgentSlot(async () => {
    activeAgents++;
    if (options?.phase === 'Implement' && firstBuilderStartedAtMs === null) {
      firstBuilderStartedAtMs = Date.now();
    }
    if (activeAgents > peakConcurrent) {
      peakConcurrent = activeAgents;
    }
    try {
      return await rawAgent(prompt, options);
    } finally {
      activeAgents--;
    }
  });
};


  // ===========================================================================
  // PHASE 1 — FAST PARALLEL CALIBRATION
  // ===========================================================================

  phase('Calibrate');

  log(
    'Fast parallel calibration: plan decomposition + repository boundary mapping.'
  );

  const calibrationViews = await parallel([

    () =>
      callAgent(
        `
You are the QCET PLAN DECOMPOSER.

${planReference}

Focus primarily on the PLAN.

Do NOT deeply audit the repository.
Do NOT modify files.

Extract:

- every material requirement
- candidate independent implementation shards
- real dependencies
- acceptance criteria
- likely ownership boundaries
- risk
- targeted test expectations

Prefer meaningful independent shards.

Do NOT invent dependencies merely to create sequencing.

Return a proposed structured execution manifest.
`,
        {
          phase: 'Calibrate',
          label: 'plan-decomposer',
          schema: MANIFEST_SCHEMA,
        }
      ),


    () =>
      callAgent(
        `
You are the QCET REPOSITORY BOUNDARY MAPPER.

${planReference}

Inspect ONLY enough repository structure to establish safe execution boundaries.

Do NOT perform a deep subsystem audit.
Do NOT modify files.

Identify:

- relevant modules/directories
- shared contracts/types
- mutable file ownership boundaries
- coupling between plan areas
- files that must not be edited concurrently
- relevant tests
- real dependency edges

Your goal is MAXIMUM SAFE PARALLELISM.

Prefer disjoint ownership by construction.

Return a proposed structured execution manifest grounded in repository evidence.
`,
        {
          phase: 'Calibrate',
          label: 'repo-boundary-mapper',
          schema: MANIFEST_SCHEMA,
        }
      ),
  ]);


  const validCalibrationViews =
    calibrationViews.filter(Boolean);


  if (validCalibrationViews.length === 0) {
    return {
      status: 'BLOCKED',
      reason: 'All calibration agents failed.',
    };
  }


  const manifest = await callAgent(
    `
You are the QCET EXECUTION MANIFEST SYNTHESIZER.

Independent calibration results:

${JSON.stringify(validCalibrationViews, null, 2)}

Produce ONE final execution manifest.

Rules:

1. Cover every material plan requirement.

2. For each shard, synthesize a self-contained JIT shard packet:
   - id, objective, kind ('feature' | 'infrastructure' | 'validation')
   - requirementDetails: array of { id, text } extracting the exact requirement ID and verbatim requirement description from the plan so downstream workers avoid re-reading the monolithic master plan
   - planAnchors: array of section names or headings in the plan corresponding to this shard
   - owns: exact file paths or glob patterns
   - antiOwns: paths forbidden to modify
   - dependencies: real blocking shard IDs only
   - requirements: array of requirement IDs mapped to this shard
   - acceptanceCriteria: list of concrete verifiable criteria
   - risk: 'low' | 'medium' | 'high' | 'critical'
   - testHints: targeted test commands or files

3. Maximize SAFE parallelism.

4. Dependencies represent REAL blocking dependencies only.

5. One mutable file/module has ONE implementation owner at a time.

6. If candidate shards overlap mutable files:
   - merge them, or
   - create the minimum necessary dependency edge.

7. Do NOT globally sequence tasks merely because they belong to
   different conceptual phases.

8. Prefer explicit dependency edges over broad wave barriers.

9. Keep shards meaningful but independently executable.

10. Shared foundational contracts block ONLY consumers that genuinely
   cannot proceed without them.

11. Use repository evidence to resolve questionable ownership.

IMPORTANT:

Scheduling is driven purely via shard.dependencies.
Dependencies must represent actual blocking relationships only.
Do NOT use wave numbers or artificial broad phase sequencing.
Every mutable file must have exactly one owner.
Ensure requirementDetails contains the exact requirement description for every claimed requirement.

Return only the final structured manifest.
`,
    {
      phase: 'Calibrate',
      label: 'manifest-synthesizer',
      schema: MANIFEST_SCHEMA,
    }
  );

  calibrationDurationMs = typeof rawArgs?.calibrationDurationMs === 'number' && rawArgs.calibrationDurationMs > 0
    ? rawArgs.calibrationDurationMs
    : Math.max(0, Date.now() - calibrationStartedAtMs);
  log('Calibration phase completed.');


  if (!manifest || !manifest.shards?.length) {
    return {
      status: 'BLOCKED',
      reason: 'Calibration returned no executable shards',
      manifest,
    };
  }


  // ===========================================================================
  // DETERMINISTIC MANIFEST GATE
  // ===========================================================================

  const coverageErrors = validateManifestCoverage(manifest);
  const ownershipErrors = validateManifestOwnership(manifest);
  const manifestErrors = [...coverageErrors, ...ownershipErrors];

  if (manifestErrors.length > 0) {
    log(
      `Deterministic manifest validation failed with ${manifestErrors.length} error(s).`
    );

    return {
      status: 'BLOCKED',
      reason: 'Deterministic manifest validation failed',
      errors: manifestErrors,
      manifest,
    };
  }


  log(
    `Manifest passed deterministic validation: ${manifest.requirements.length} requirements (100% covered), ` +
    `${manifest.shards.length} execution shards, 0 ownership overlaps.`
  );

  // Synchronize active shard boundaries to /tmp/qcet-active-shards.json (and session-scoped paths)
  // so pre-tool-use-ownership-guard enforces ownership for builder subagents
  const activeShardsPayload = manifest.shards.map((s) => ({
    id: s.id,
    agentId: `${s.id}:implement`,
    owns: s.owns || [],
    antiOwns: s.antiOwns || [],
  }));

  try {
    syncActiveShardBoundaries(activeShardsPayload, 'Calibrate');
  } catch (syncErr) {
    log(`CRITICAL: Shard boundary synchronization failed: ${syncErr?.message || syncErr}`);
    return {
      status: 'BLOCKED',
      reason: `Shard boundary synchronization failed: ${syncErr?.message || syncErr}`,
      manifest,
    };
  }

  try {
    await callAgent(
      `You are the QCET Shard Boundary Synchronizer.
Write the following JSON active shard boundaries directly to the file:
/tmp/qcet-active-shards.json

SHARD BOUNDARIES PAYLOAD:
${JSON.stringify(activeShardsPayload, null, 2)}

Write the file accurately.`,
      {
        agent: 'qcet-telemetry-recorder',
        agentType: 'qcet-telemetry-recorder',
        agentId: 'shard-synchronizer',
        phase: 'Calibrate',
        label: 'shard-synchronizer',
        schema: {
          type: 'object',
          required: ['status', 'path'],
          properties: {
            status: { type: 'string', enum: ['persisted', 'failed'] },
            path: { type: 'string' },
          },
        },
      }
    );
  } catch (_) {}


  // ===========================================================================
  // SHARD HELPERS
  // ===========================================================================

  async function verifyShard(state, round) {

    if (
      !state.implementation ||
      state.implementation.status === 'blocked'
    ) {
      return {
        ...state,
        lastVerification: {
          verdict: 'blocked',
          requirementsChecked: [],
          issues: [],
          summary: 'Implementation blocked before verification.',
        },
      };
    }


    const shardPacket = state.shardPacket || buildShardPacket(state.shard, manifest);
    const risk = String(shardPacket?.risk || 'medium').toLowerCase();

    let verification = null;

    if (risk === 'high' || risk === 'critical') {
      log(
        `Shard ${shardPacket.id} is ${risk.toUpperCase()} risk: dispatching parallel multi-skeptic panel + arbiter synthesis.`
      );

      const panelResults = await parallel([
        // Skeptic 1: Functional specifications, contracts, callers, and regressions
        () =>
          callAgent(
            `${SKEPTIC_STATIC_PREFIX}

PANEL AUDIT FOCUS: SKEPTIC 1 — SPECIFICATION, CONTRACTS & REGRESSIONS
Your specific focus:
- Acceptance criteria and mapped requirements compliance.
- Public API signatures, TypeScript contracts, Prisma model interactions.
- Caller and consumer drift across adjacent modules.
- Regression hazards and integration side-effects.
- Verify tests actually exercise the changed behavior.

JIT SHARD PACKET:
${JSON.stringify(shardPacket, null, 2)}

RECON EVIDENCE:
${JSON.stringify(state.recon, null, 2)}

RESEARCH EVIDENCE:
${JSON.stringify(state.research || null, 2)}

IMPLEMENTATION CLAIM:
${JSON.stringify(state.implementation, null, 2)}

Verification round: ${round}
${ambiguityFallback}`,
            {
              agent: 'qcet-skeptic',
              agentType: 'qcet-skeptic',
              phase: 'Verify',
              label: `${shardPacket.id}:verify-${round}-spec`,
              schema: VERIFY_SCHEMA,
            }
          ),

        // Skeptic 2: Security boundaries, negative assertions, data integrity
        () =>
          callAgent(
            `${SKEPTIC_STATIC_PREFIX}

PANEL AUDIT FOCUS: SKEPTIC 2 — SECURITY, AUTHORIZATION & BOUNDARIES
Your specific focus:
- Server-side authorization, RBAC, session verification, and trust boundaries.
- Negative assertions: invalid, null, malformed, empty, or unauthorized inputs.
- Data integrity: transaction boundaries, concurrency, and persistence correctness.
- Test validity: ensure tests assert failure on broken invariants.

JIT SHARD PACKET:
${JSON.stringify(shardPacket, null, 2)}

RECON EVIDENCE:
${JSON.stringify(state.recon, null, 2)}

RESEARCH EVIDENCE:
${JSON.stringify(state.research || null, 2)}

IMPLEMENTATION CLAIM:
${JSON.stringify(state.implementation, null, 2)}

Verification round: ${round}
${ambiguityFallback}`,
            {
              agent: 'qcet-skeptic',
              agentType: 'qcet-skeptic',
              phase: 'Verify',
              label: `${shardPacket.id}:verify-${round}-security`,
              schema: VERIFY_SCHEMA,
            }
          ),
      ]);

      const [specVerifier, securityVerifier] = panelResults;

      const arbiterPrompt = `${SKEPTIC_STATIC_PREFIX}

You are the QCET ADVERSARIAL VERIFICATION ARBITER for shard ${shardPacket.id}.
Two independent skeptics audited this ${risk.toUpperCase()} risk implementation:

SKEPTIC 1 (SPECIFICATION & CONTRACTS):
${JSON.stringify(specVerifier, null, 2)}

SKEPTIC 2 (SECURITY & BOUNDARIES):
${JSON.stringify(securityVerifier, null, 2)}

JIT SHARD PACKET:
${JSON.stringify(shardPacket, null, 2)}

IMPLEMENTATION CLAIM:
${JSON.stringify(state.implementation, null, 2)}

Verification round: ${round}

YOUR MANDATE:
Synthesize an authoritative, consolidated verification verdict.

CRITICAL INVARIANTS:
1. Prioritize concrete repository evidence over synthetic consensus: do NOT dismiss a true defect merely because only one skeptic discovered it. If an issue is supported by real repository evidence, it MUST be included.
2. Refute only clear false positives or deduplicate findings describing the same root cause.
3. If ANY confirmed defect or invariant violation remains, verdict MUST be 'fail'.
4. If both skeptics passed with zero defects and repository evidence confirms correctness, verdict is 'pass'.
${ambiguityFallback}`;

      verification = await callAgent(arbiterPrompt, {
        agent: 'qcet-skeptic',
        agentType: 'qcet-skeptic',
        phase: 'Verify',
        label: `${shardPacket.id}:verify-${round}-arbiter`,
        schema: VERIFY_SCHEMA,
      });

    } else if (risk === 'medium') {
      verification = await callAgent(
        `${SKEPTIC_STATIC_PREFIX}

VERIFICATION FOCUS: MEDIUM RISK TIER
Perform thorough contract inspection, check all callers/consumers, verify regression risks, and probe boundary conditions.

JIT SHARD PACKET:
${JSON.stringify(shardPacket, null, 2)}

RECON EVIDENCE:
${JSON.stringify(state.recon, null, 2)}

RESEARCH EVIDENCE:
${JSON.stringify(state.research || null, 2)}

IMPLEMENTATION CLAIM:
${JSON.stringify(state.implementation, null, 2)}

Verification round: ${round}
${ambiguityFallback}`,
        {
          agent: 'qcet-skeptic',
          agentType: 'qcet-skeptic',
          phase: 'Verify',
          label: `${shardPacket.id}:verify-${round}`,
          schema: VERIFY_SCHEMA,
        }
      );
    } else {
      verification = await callAgent(
        `${SKEPTIC_STATIC_PREFIX}

VERIFICATION FOCUS: LOW RISK TIER
Focus on targeted code correctness, acceptance criteria, and verifying that targeted tests pass.

JIT SHARD PACKET:
${JSON.stringify(shardPacket, null, 2)}

RECON EVIDENCE:
${JSON.stringify(state.recon, null, 2)}

RESEARCH EVIDENCE:
${JSON.stringify(state.research || null, 2)}

IMPLEMENTATION CLAIM:
${JSON.stringify(state.implementation, null, 2)}

Verification round: ${round}
${ambiguityFallback}`,
        {
          agent: 'qcet-skeptic',
          agentType: 'qcet-skeptic',
          phase: 'Verify',
          label: `${shardPacket.id}:verify-${round}`,
          schema: VERIFY_SCHEMA,
        }
      );
    }


    const activeVerification = verification || {
      verdict: 'fail',
      requirementsChecked: [],
      issues: [
        {
          id: `${shardPacket.id}-ISS-1`,
          severity: 'critical',
          category: 'verifier-failure',
          file: 'none',
          evidence: 'Verifier agent returned no usable result.',
          impact: 'Cannot verify shard implementation.',
          recommendedFix: 'Re-run verification.',
        },
      ],
      summary: 'Verifier agent returned no result.',
    };

    // Ensure activeVerification has at least one issue if verdict is fail
    if (
      activeVerification.verdict === 'fail' &&
      (!activeVerification.issues || activeVerification.issues.length === 0)
    ) {
      activeVerification.issues = [
        {
          id: `${shardPacket.id}-ISS-1`,
          severity: 'high',
          category: 'unspecified-verification-failure',
          file: 'none',
          evidence: activeVerification.summary || 'Verifier gave fail verdict without specific issue items.',
          impact: 'Verification failed.',
          recommendedFix: 'Investigate verification summary and re-run verification.',
        },
      ];
    }

    // Normalize verification issues to ensure every issue has a deterministic ID
    if (activeVerification.issues && Array.isArray(activeVerification.issues)) {
      activeVerification.issues = activeVerification.issues.map((issue, idx) => ({
        ...issue,
        id:
          issue.id && typeof issue.id === 'string' && issue.id.trim()
            ? issue.id.trim()
            : `${shardPacket.id}-ISS-${idx + 1}`,
      }));
    }

    // Post-implementation ownership verification: check implementation.changedFiles against shard.owns
    const changedFiles = (state.implementation?.changedFiles || []).filter(
      (file) => typeof file === 'string' && file.trim() !== ''
    );
    const shardOwns = shardPacket.owns || [];
    const shardAntiOwns = shardPacket.antiOwns || [];
    const outOfScopeFiles = changedFiles.filter(
      (file) =>
        !shardOwns.some((pattern) => matchesOwnership(file, pattern)) ||
        shardAntiOwns.some((pattern) => matchesOwnership(file, pattern))
    );

    if (outOfScopeFiles.length > 0) {
      log(
        `Shard ${shardPacket.id} committed out-of-scope edits: ` +
        outOfScopeFiles.join(', ')
      );

      activeVerification.verdict = 'fail';

      const scopeIssues = outOfScopeFiles.map((file, idx) => ({
        id: `${shardPacket.id}-SCOPE-${idx + 1}`,
        severity: 'critical',
        category: 'ownership-violation',
        file,
        evidence: `File '${file}' was modified but is outside declared shard ownership: ${JSON.stringify(shardOwns)}`,
        impact: 'Out-of-scope file modification violates shard boundary and parallel execution safety.',
        recommendedFix: 'Revert changes to this out-of-scope file or coordinate ownership transfer in the plan.',
      }));

      activeVerification.issues = [
        ...scopeIssues,
        ...(activeVerification.issues || []),
      ];

      activeVerification.summary =
        (activeVerification.summary ? activeVerification.summary + '\n' : '') +
        `[CRITICAL OWNERSHIP VIOLATION] Out-of-scope files modified: ${outOfScopeFiles.join(', ')}.`;
    }


    return {
      ...state,
      shardPacket,
      initialVerification: state.initialVerification || activeVerification,
      lastVerification: activeVerification,
    };
  }


  async function repairShard(state, round) {

    if (state.lastVerification?.verdict !== 'fail') {
      return state;
    }

    const shardPacket = state.shardPacket || buildShardPacket(state.shard, manifest);

    const repairPrompt = `${REPAIR_STATIC_PREFIX}

JIT SHARD PACKET:
${JSON.stringify(shardPacket, null, 2)}

CONFIRMED VERIFICATION FINDINGS:
${JSON.stringify(state.lastVerification, null, 2)}

Repair round: ${round}
${ambiguityFallback}`;

    const repairOptions = {
      agent: 'qcet-builder',
      agentType: 'qcet-builder',
      agentId: `${shardPacket.id}:repair-${round}`,
      phase: 'Repair',
      label: `${shardPacket.id}:repair-${round}`,
      schema: REPAIR_SCHEMA,
    };

    if (shouldIsolateShard(state.shard, manifest, worktreeIsolation)) {
      log(`Shard ${state.shard.id} repair invoked with adaptive worktree isolation.`);
      repairOptions.isolation = 'worktree';
    }

    const repair = await callAgent(
      repairPrompt,
      repairOptions
    );

    if (!repair) {
      log(`Shard ${state.shard.id} repair round ${round} returned null/failed.`);
      return {
        ...state,
        repairRound: round,
        lastRepair: { status: 'blocked', summary: 'Repair agent returned null or failed.' },
        implementation: {
          ...state.implementation,
          status: 'blocked',
          blocker: 'Repair agent returned null or failed.',
        },
      };
    }

    const resolvedIds = Array.isArray(repair?.resolvedIssueIds) ? repair.resolvedIssueIds : [];
    const remainingIds = Array.isArray(repair?.remainingIssueIds) ? repair.remainingIssueIds : [];
    const progressText = repair?.progressSummary || repair?.summary || 'none';

    log(
      `Shard ${state.shard.id} repair round ${round} convergence: ` +
      `resolved=[${resolvedIds.join(', ')}], ` +
      `remaining=[${remainingIds.join(', ')}], ` +
      `progress=${progressText}`
    );


    return {
      ...state,
      repairRound: round,
      lastRepair: repair,
      implementation: {
        ...state.implementation,
        changedFiles:
          repair?.changedFiles &&
          Array.isArray(repair.changedFiles) &&
          repair.changedFiles.length > 0
            ? repair.changedFiles
            : state.implementation.changedFiles,
        summary:
          state.implementation.summary +
          `\nRepair round ${round}: ${repair?.summary || repair?.progressSummary || ''}`,
        testsRun: [
          ...(state.implementation.testsRun || []),
          ...(repair?.testsRun || []),
        ],
        risks: [
          ...(state.implementation.risks || []),
          ...(repair?.risks || []),
        ],
        status:
          repair?.status === 'blocked'
            ? 'blocked'
            : state.implementation.status,
        resolvedIssueIds: repair?.resolvedIssueIds || [],
        remainingIssueIds: repair?.remainingIssueIds || [],
        progressSummary: repair?.progressSummary || '',
      },
    };
  }


  async function reverifyIfRepaired(state, round) {

    if (state.repairRound !== round) {
      return state;
    }

    return verifyShard(state, round + 1);
  }


  // ===========================================================================
  // DEPENDENCY-READY DAG SCHEDULER
  // ===========================================================================
  //
  // NO GLOBAL WAVE BARRIERS.
  //
  // Root shards start immediately.
  //
  // A dependent shard starts AS SOON AS ITS OWN dependencies pass
  // independent verification.
  //
  // Unrelated slow shards do not block it.
  //
  // Each shard independently runs:
  //
  // RECON → IMPLEMENT → VERIFY → REPAIR <= 2 → REVERIFY
  //
  // ===========================================================================

  log('Starting dependency-ready DAG scheduler.');


  const shardById = new Map(
    manifest.shards.map(
      (shard) => [shard.id, shard]
    )
  );


  // ---------------------------------------------------------------------------
  // VALIDATE DAG
  // ---------------------------------------------------------------------------

  const dagErrors = [];


  for (const shard of manifest.shards) {

    for (const dependencyId of shard.dependencies || []) {

      if (!shardById.has(dependencyId)) {
        dagErrors.push(
          `${shard.id} depends on missing shard ${dependencyId}`
        );
      }


      if (dependencyId === shard.id) {
        dagErrors.push(
          `${shard.id} depends on itself`
        );
      }
    }
  }


  const visiting = new Set();
  const visited = new Set();


  function visitShard(id, path = []) {

    if (visiting.has(id)) {
      dagErrors.push(
        `Dependency cycle: ${[...path, id].join(' -> ')}`
      );

      return;
    }


    if (visited.has(id)) {
      return;
    }


    const shard = shardById.get(id);

    if (!shard) {
      return;
    }


    visiting.add(id);


    for (const dependencyId of shard.dependencies || []) {

      if (shardById.has(dependencyId)) {

        visitShard(
          dependencyId,
          [...path, id]
        );
      }
    }


    visiting.delete(id);
    visited.add(id);
  }


  for (const shard of manifest.shards) {
    visitShard(shard.id);
  }


  if (dagErrors.length > 0) {

    return {
      status: 'BLOCKED',
      reason: 'Invalid execution DAG',
      errors: dagErrors,
      manifest,
    };
  }


  // ---------------------------------------------------------------------------
  // DECOUPLED READ GATE: PRE-RECON & CONDITIONAL RESEARCH
  // ---------------------------------------------------------------------------

  const preReconPromises = new Map();

  function schedulePreRecon(shard) {
    if (!shard) return Promise.resolve(null);
    if (preReconPromises.has(shard.id)) {
      return preReconPromises.get(shard.id);
    }

    const promise = (async () => {
      const shardPacket = buildShardPacket(shard, manifest);

      const reconPrompt = `${RECON_STATIC_PREFIX}

JIT SHARD PACKET:
${JSON.stringify(shardPacket, null, 2)}

DECLARED UPSTREAM DEPENDENCIES (IN-FLIGHT):
${JSON.stringify(shard.dependencies || [], null, 2)}

PRE-RECON RECONNAISSANCE:
Inspect domain boundaries, existing callers, and files relevant to this shard's objective.
Focus on existing repository structure, contracts, and constraints.
Upstream dependencies are executing in parallel; new exported signatures will be verified during the pre-implementation reconciliation stage.
${ambiguityFallback}`;

      const recon = await callAgent(reconPrompt, {
        agent: 'qcet-recon',
        agentType: 'qcet-recon',
        phase: 'Recon',
        label: `${shardPacket.id}:pre-recon`,
        schema: RECON_SCHEMA,
      });

      if (!recon || recon.status === 'blocked') {
        return {
          shard,
          shardPacket,
          recon: recon || {
            status: 'blocked',
            currentState: '',
            relevantFiles: [],
            contracts: [],
            implementationNotes: [],
            risks: ['Pre-recon agent returned no usable result.'],
            blocker: 'Pre-recon failed.',
          },
          research: null,
        };
      }

      // Conditional external research during pre-recon
      let researchEvidence = null;
      const escalation = validateResearchEscalation(recon.externalResearch, shardPacket);

      if (escalation.allowed) {
        log(
          `Shard ${shardPacket.id} requested external research: ` +
          `${escalation.questions.length} question(s) approved, ` +
          `${escalation.rejectedQuestions.length} internal question(s) rejected.`
        );

        const researchPrompt = `${RESEARCHER_STATIC_PREFIX}

RESEARCH QUESTIONS:
${JSON.stringify(escalation.questions, null, 2)}

RESEARCH REASON & PREFERRED SOURCES:
${JSON.stringify(
  {
    reason: escalation.reason,
    preferredSourceTypes: escalation.preferredSourceTypes,
  },
  null,
  2
)}

SHARD CONTEXT:
${JSON.stringify(
  {
    id: shardPacket.id,
    objective: shardPacket.objective,
  },
  null,
  2
)}`;

        const researcherResult = await callAgent(researchPrompt, {
          agent: 'qcet-researcher',
          agentType: 'qcet-researcher',
          phase: 'Recon',
          label: `${shardPacket.id}:research`,
          schema: RESEARCH_SCHEMA,
        });

        researchEvidence = researcherResult || {
          claims: escalation.questions.map((q) => ({
            claim: `External research for query "${q}" yielded no conclusive evidence.`,
            sourceType: 'unverified',
            source: 'none',
            versionOrDate: 'unknown',
            applicability: 'uncertain',
            confidence: 'unverified',
          })),
          unresolved: escalation.questions.map((q) => ({
            question: q,
            reason: 'Researcher agent failed or returned no usable result.',
          })),
        };
      } else if (escalation.rejectedQuestions && escalation.rejectedQuestions.length > 0) {
        log(
          `Shard ${shardPacket.id} external research request rejected: ` +
          `${escalation.reason}`
        );
      }

      return {
        shard,
        shardPacket,
        recon,
        research: researchEvidence,
      };
    })();

    preReconPromises.set(shard.id, promise);
    return promise;
  }


  // ---------------------------------------------------------------------------
  // RUN SHARD WITH PRE-IMPLEMENTATION RECONCILIATION
  // ---------------------------------------------------------------------------

  async function runShardWithReconciliation(
    shard,
    preRecon,
    dependencyResults
  ) {
    const shardPacket = preRecon.shardPacket || buildShardPacket(shard, manifest);
    const recon = preRecon.recon;
    const researchEvidence = preRecon.research;

    const dependencyEvidence = dependencyResults.map((result) => ({
      shard: result?.shard?.id,
      verification: result?.lastVerification?.verdict || 'unknown',
      changedFiles: result?.implementation?.changedFiles || [],
      summary: result?.implementation?.summary || '',
      requirementsSatisfied: result?.implementation?.requirementsSatisfied || [],
    }));

    // =========================================================================
    // PRE-IMPLEMENTATION RECONCILIATION STAGE (qcet-recon)
    // =========================================================================
    let reconciliation = null;
    if (shard.dependencies && shard.dependencies.length > 0) {
      const reconcilePrompt = `${RECONCILE_STATIC_PREFIX}

JIT SHARD PACKET:
${JSON.stringify(shardPacket, null, 2)}

PRE-RECON EVIDENCE:
${JSON.stringify(recon, null, 2)}
${researchEvidence ? `\nRESEARCH EVIDENCE:\n${JSON.stringify(researchEvidence, null, 2)}\n` : ''}
COMPLETED UPSTREAM DEPENDENCY DELTAS:
${JSON.stringify(dependencyEvidence, null, 2)}

Inspect the actual repository, git diff, and completed upstream deltas.
Reconcile pre-recon assumptions against actual upstream changes before implementation starts.
${ambiguityFallback}`;

      reconciliation = await callAgent(reconcilePrompt, {
        agent: 'qcet-recon',
        agentType: 'qcet-recon',
        phase: 'Recon',
        label: `${shardPacket.id}:reconcile`,
        schema: RECONCILE_SCHEMA,
      });

      if (!reconciliation || reconciliation.status === 'blocked') {
        log(
          `Shard ${shard.id} blocked during reconciliation: ` +
          `${reconciliation?.blocker || reconciliation?.summary || 'Reconciliation blocked'}`
        );
        return {
          shard,
          shardPacket,
          recon,
          research: researchEvidence,
          reconciliation: reconciliation || {
            status: 'blocked',
            upstreamChangesDetected: false,
            reconciledNotes: [],
            invalidatedAssumptions: ['Reconciliation agent returned no usable result.'],
            summary: 'Reconciliation failed or blocked.',
            blocker: 'Reconciliation failed.',
          },
          implementation: {
            status: 'blocked',
            changedFiles: [],
            summary: reconciliation?.blocker || reconciliation?.summary || 'Reconciliation failed or blocked.',
            requirementsSatisfied: [],
            testsRun: [],
            risks: reconciliation?.invalidatedAssumptions || [],
            blocker: reconciliation?.blocker || 'Reconciliation failed or blocked.',
          },
          lastVerification: {
            verdict: 'blocked',
            requirementsChecked: [],
            issues: [],
            summary: `Shard blocked during pre-implementation reconciliation: ${reconciliation?.blocker || 'Upstream contract invalidation'}`,
          },
        };
      }

      log(
        `Shard ${shardPacket.id} reconciled upstream changes: ` +
        `detected=${reconciliation.upstreamChangesDetected}, notes=${reconciliation.reconciledNotes?.length || 0}`
      );
    } else {
      reconciliation = {
        status: 'ready',
        upstreamChangesDetected: false,
        reconciledNotes: ['Root shard with no upstream dependencies.'],
        invalidatedAssumptions: [],
        summary: 'No upstream dependencies to reconcile.',
      };
    }

    // =========================================================================
    // IMPLEMENT (qcet-builder)
    // =========================================================================
    const implementationPrompt = `${BUILDER_STATIC_PREFIX}

JIT SHARD PACKET:
${JSON.stringify(shardPacket, null, 2)}

RECON EVIDENCE:
${JSON.stringify(recon, null, 2)}
${researchEvidence ? `\nRESEARCH EVIDENCE:\n${JSON.stringify(researchEvidence, null, 2)}\n` : ''}
RECONCILIATION EVIDENCE:
${JSON.stringify(reconciliation, null, 2)}

DEPENDENCY EVIDENCE:
${JSON.stringify(dependencyEvidence, null, 2)}
${ambiguityFallback}`;

    const builderOptions = {
      agent: 'qcet-builder',
      agentType: 'qcet-builder',
      agentId: `${shardPacket.id}:implement`,
      phase: 'Implement',
      label: `${shardPacket.id}:implement`,
      schema: IMPLEMENT_SCHEMA,
    };

    if (shouldIsolateShard(shard, manifest, worktreeIsolation)) {
      log(`Shard ${shard.id} invoked with adaptive git worktree isolation.`);
      builderOptions.isolation = 'worktree';
    }

    const shardExecutionStartedAtMs = Date.now();
    const implementation = await callAgent(
      implementationPrompt,
      builderOptions
    );

    if (!implementation) {
      log(`Shard ${shard.id} builder returned null or failed.`);
      return {
        shard,
        shardPacket,
        recon,
        research: researchEvidence,
        reconciliation,
        implementation: {
          status: 'blocked',
          summary: 'Builder agent returned null or failed.',
          changedFiles: [],
          blocker: 'Builder agent returned null or failed.',
        },
        initialVerification: {
          verdict: 'blocked',
          issues: [{ id: 'builder-null', severity: 'CRITICAL', summary: 'Builder failed to return output.' }],
        },
        lastVerification: {
          verdict: 'blocked',
          issues: [{ id: 'builder-null', severity: 'CRITICAL', summary: 'Builder failed to return output.' }],
        },
      };
    }

    let state = {
      shard,
      shardPacket,
      recon,
      research: researchEvidence,
      reconciliation,
      implementation,
    };

    // =========================================================================
    // VERIFY
    // =========================================================================
    state = await verifyShard(state, 0);

    // =========================================================================
    // REPAIR ROUND 1
    // =========================================================================
    if (state.lastVerification?.verdict === 'fail' && maxRepairRounds >= 1) {
      const initialIssuesCount = state.lastVerification?.issues?.length || 0;
      state = await repairShard(state, 1);
      state = await reverifyIfRepaired(state, 1);

      // =======================================================================
      // REPAIR ROUND 2 (EARLY TERMINATION ON NO PROGRESS)
      // =======================================================================
      if (state.lastVerification?.verdict === 'fail' && maxRepairRounds >= 2) {
        const round1IssuesCount = state.lastVerification?.issues?.length || 0;
        if (round1IssuesCount >= initialIssuesCount) {
          log(
            `Shard ${shard.id} repair round 1 yielded no reduction in confirmed issues ` +
            `(${round1IssuesCount} remaining >= ${initialIssuesCount} previous). ` +
            `Terminating repair early to prevent no-progress loop.`
          );
          state.repairStagnated = true;
        } else {
          log(
            `Shard ${shard.id} repair round 1 reduced confirmed issues ` +
            `(${round1IssuesCount} < ${initialIssuesCount}). ` +
            `Proceeding to repair round 2.`
          );
          state = await repairShard(state, 2);
          state = await reverifyIfRepaired(state, 2);

          if (state.lastVerification?.verdict === 'fail') {
            const round2IssuesCount = state.lastVerification?.issues?.length || 0;
            if (round2IssuesCount >= round1IssuesCount) {
              log(
                `Shard ${shard.id} repair round 2 yielded no reduction in confirmed issues ` +
                `(${round2IssuesCount} remaining >= ${round1IssuesCount} previous).`
              );
              state.repairStagnated = true;
            }
          }
        }
      }
    }

    state.timing = {
      durationMs: Math.max(0, Date.now() - shardExecutionStartedAtMs),
    };
    return state;
  }


  // ===========================================================================
  // DEPENDENCY-READY DAG SCHEDULER
  // ---------------------------------------------------------------------------

  function blockedByDependency(
    shard,
    dependencyId,
    preRecon
  ) {
    return {
      shard,
      shardPacket: preRecon?.shardPacket || buildShardPacket(shard, manifest),
      recon: preRecon?.recon || {
        status: 'blocked',
        currentState: '',
        relevantFiles: [],
        contracts: [],
        implementationNotes: [],
        risks: [
          'Required dependency did not pass independent verification.'
        ],
        blocker:
          `Dependency ${dependencyId} unresolved.`,
      },
      research: preRecon?.research || null,
      implementation: {
        status: 'blocked',
        changedFiles: [],
        summary:
          'Implementation did not start because a dependency is unresolved.',
        requirementsSatisfied: [],
        testsRun: [],
        risks: [
          'Blocked by unresolved dependency.'
        ],
        blocker:
          `Dependency ${dependencyId} unresolved.`,
      },
      lastVerification: {
        verdict: 'blocked',
        requirementsChecked: [],
        issues: [],
        summary:
          'Shard blocked by unresolved dependency.',
      },
    };
  }


  // ---------------------------------------------------------------------------
  // PROMISE DAG (DECOUPLED WRITE GATE)
  // ---------------------------------------------------------------------------

  const shardPromises = new Map();

  function scheduleShard(shard) {
    if (!shard) return Promise.resolve(null);
    if (shardPromises.has(shard.id)) {
      return shardPromises.get(shard.id);
    }

    // Ensure pre-recon is launched immediately on this shard
    const preReconPromise = schedulePreRecon(shard);

    // Strict write gate: wait for all dependencies to pass independent verification
    const dependencyPromises = (shard.dependencies || []).map((dependencyId) =>
      scheduleShard(shardById.get(dependencyId))
    );

    const dependencyWaitStartedAtMs = Date.now();
    const promise = Promise.all(dependencyPromises)
      .then(async (dependencyResults) => {
        if (dependencyPromises.length > 0) {
          dependencyWaitDurationsMs.push(Math.max(0, Date.now() - dependencyWaitStartedAtMs));
        }
        const badDependency = dependencyResults.find(
          (result) =>
            !result ||
            result.lastVerification?.verdict !== 'pass'
        );

        if (badDependency) {
          const preRecon = await preReconPromise;
          return blockedByDependency(
            shard,
            badDependency?.shard?.id || 'unknown',
            preRecon
          );
        }

        const preRecon = await preReconPromise;
        if (!preRecon || !preRecon.recon || preRecon.recon.status === 'blocked') {
          return {
            shard,
            shardPacket: preRecon?.shardPacket || buildShardPacket(shard, manifest),
            recon: preRecon?.recon || {
              status: 'blocked',
              currentState: '',
              relevantFiles: [],
              contracts: [],
              implementationNotes: [],
              risks: ['Pre-recon failed or returned blocked status.'],
              blocker: 'Pre-recon blocked.',
            },
            research: preRecon?.research || null,
            implementation: {
              status: 'blocked',
              changedFiles: [],
              summary: preRecon?.recon?.blocker || 'Pre-recon blocked.',
              requirementsSatisfied: [],
              testsRun: [],
              risks: preRecon?.recon?.risks || [],
              blocker: preRecon?.recon?.blocker || 'Pre-recon blocked.',
            },
            lastVerification: {
              verdict: 'blocked',
              requirementsChecked: [],
              issues: [],
              summary: 'Shard blocked during pre-reconnaissance.',
            },
          };
        }

        log(
          `Shard ${shard.id} write gate unblocked; proceeding to reconciliation and implementation.`
        );

        return runShardWithReconciliation(
          shard,
          preRecon,
          dependencyResults
        );
      })
      .catch((error) => ({
        shard,
        recon: {
          status: 'blocked',
          currentState: '',
          relevantFiles: [],
          contracts: [],
          implementationNotes: [],
          risks: [`Workflow execution error: ${String(error)}`],
          blocker: String(error),
        },
        implementation: {
          status: 'blocked',
          changedFiles: [],
          summary: 'Shard pipeline failed.',
          requirementsSatisfied: [],
          testsRun: [],
          risks: [String(error)],
          blocker: String(error),
        },
        lastVerification: {
          verdict: 'blocked',
          requirementsChecked: [],
          issues: [],
          summary: `Shard execution failed: ${String(error)}`,
        },
      }));

    shardPromises.set(shard.id, promise);
    return promise;
  }


  // ---------------------------------------------------------------------------
  // CRITICAL-PATH SCHEDULING: PRIORITIZE SHARDS BY DOWNSTREAM LEVERAGE & RISK
  // ---------------------------------------------------------------------------

  const shardPriorities = computeShardPriorities(manifest);
  const prioritizedShards = [...manifest.shards].sort((a, b) => {
    const prioA = shardPriorities.get(a.id)?.priority ?? 0;
    const prioB = shardPriorities.get(b.id)?.priority ?? 0;
    if (prioB !== prioA) return prioB - prioA;
    return a.id.localeCompare(b.id);
  });

  log(
    `Critical-path scheduler initialized for ${prioritizedShards.length} shards ` +
    `in priority order: ${prioritizedShards.map((s) => `${s.id} (P${shardPriorities.get(s.id)?.priority ?? 0})`).join(', ')}`
  );

  // Decoupled Read Gate: launch pre-recon for all shards immediately
  for (const shard of prioritizedShards) {
    schedulePreRecon(shard);
  }

  // Strict Write Gate: schedule builder execution awaiting dependencies
  for (const shard of prioritizedShards) {
    scheduleShard(shard);
  }


  // All runnable branches are already active before this barrier.

  const allShardResults =
    await Promise.all(
      manifest.shards.map(
        (shard) =>
          shardPromises.get(
            shard.id
          )
      )
    );


  const failedShards =
    allShardResults.filter(
      (result) =>
        result?.lastVerification?.verdict !==
        'pass'
    );


  log(
    `Shard execution complete: ` +
    `${allShardResults.length - failedShards.length} verified, ` +
    `${failedShards.length} unresolved.`
  );


  // ===========================================================================
  // CROSS-SHARD INTEGRATION REVIEW
  // ===========================================================================

  phase('Integration Review');


  const shardSummary = allShardResults.map((result) => ({
    id: result.shard.id,
    risk: result.shard.risk,
    requirements: result.shard.requirements,
    changedFiles:
      result.implementation?.changedFiles || [],
    verification:
      result.lastVerification?.verdict || 'unknown',
    unresolvedIssues:
      result.lastVerification?.issues || [],
  }));


  const allReviewDimensions = [
    {
      id: 'contracts',
      charter:
        'Cross-module API/type/schema/contracts consistency, stale adapters, import drift, caller/consumer mismatch.',
    },
    {
      id: 'authorization',
      charter:
        'Authorization, permission boundaries, server-side enforcement, trust boundaries, data exposure.',
    },
    {
      id: 'semantics',
      charter:
        'Duplicated business semantics, competing sources of truth, duplicated UI meaning, inconsistent status/count logic.',
    },
    {
      id: 'regression',
      charter:
        'Regression risk, missing tests, integration behavior, accessibility/performance regressions where relevant.',
    },
  ];

  const selectedReviewDimensionIds = selectIntegrationReviewDimensionIds(shardSummary);
  const reviewDimensions = allReviewDimensions.filter((dimension) =>
    selectedReviewDimensionIds.includes(dimension.id)
  );
  log(`Adaptive integration review selected: ${selectedReviewDimensionIds.join(', ')}`);


  const integrationReviews = await parallel(
    reviewDimensions.map((dimension) => () =>
      callAgent(
        `
You are an independent cross-shard QCET integration reviewer.

REVIEW DIMENSION:
${dimension.id}

CHARTER:
${dimension.charter}

SHARD EXECUTION SUMMARY:
${JSON.stringify(shardSummary, null, 2)}

Inspect the ACTUAL integrated repository state and git diff.

Do not modify files.

Do not repeat low-value style review.

Look specifically for defects created by interaction between shards.

Every finding must contain concrete evidence.

Do not report speculative issues.
`,
        {
          agent: 'qcet-skeptic',
          agentType: 'qcet-skeptic',
          phase: 'Integration Review',
          label: `integration:${dimension.id}`,
          schema: INTEGRATION_FINDINGS_SCHEMA,
        }
      )
    )
  );


  const validIntegrationReviews =
    integrationReviews.filter(Boolean);


  // ===========================================================================
  // ADVERSARIAL INTEGRATION SYNTHESIS
  // ===========================================================================

  const integrationSynthesis = await callAgent(
    `
You are the QCET integration skeptic.

Independent reviewers produced these findings:

${JSON.stringify(validIntegrationReviews, null, 2)}

Inspect the ACTUAL repository.

Your job is to REFUTE false positives and retain only real,
actionable cross-shard defects.

Deduplicate findings describing the same root cause.

Do not modify files.

Return only confirmed findings and a concise summary.
`,
    {
      agent: 'qcet-skeptic',
      agentType: 'qcet-skeptic',
      phase: 'Integration Review',
      label: 'integration:skeptic',
      schema: INTEGRATION_FINDINGS_SCHEMA,
    }
  );


  // ===========================================================================
  // PARALLEL INTEGRATION REPAIR CLUSTERS
  // ===========================================================================

  let integrationRepair = null;

  if (integrationSynthesis && integrationSynthesis.findings && integrationSynthesis.findings.length > 0) {
    phase('Integration Repair');

    const clusters = clusterIntegrationFindings(integrationSynthesis.findings);
    log(
      `Partitioned ${integrationSynthesis.findings.length} integration findings into ` +
      `${clusters.length} conflict cluster(s) for repair.`
    );

    const fileSpecificClusters = clusters.filter(
      (c) => Array.isArray(c.files) && c.files.length > 0 && c.id !== 'cluster-global'
    );
    const globalClusters = clusters.filter(
      (c) => !Array.isArray(c.files) || c.files.length === 0 || c.id === 'cluster-global'
    );

    const allClusterRepairs = [];

    if (clusters.length === 1) {
      const cluster = clusters[0];
      const isGlobal = cluster.files.length === 0 || cluster.id === 'cluster-global';
      const clusterShardsPayload = [
        {
          id: cluster.id || 'cluster-1',
          agentId: 'integration:repair-cluster-1',
          owns: !isGlobal ? cluster.files : ['**/*'],
          antiOwns: [],
        },
      ];
      try {
        syncActiveShardBoundaries(clusterShardsPayload, 'Integration Repair');
      } catch (syncErr) {
        log(`Warning: Failed to sync boundaries for cluster-1: ${syncErr?.message || syncErr}`);
      }

      const scopeNotice = isGlobal
        ? `AFFECTED SCOPE: Cross-cutting / Global findings.\nTouch only files strictly required to remediate the confirmed findings.`
        : `AFFECTED FILES WHITELIST:\n${JSON.stringify(cluster.files, null, 2)}\nTouch ONLY the files in the affected files whitelist or directly necessary callers.`;

      const rep = await callAgent(
        `
You are the QCET integration repair owner.

CONFIRMED CROSS-SHARD FINDINGS (CLUSTER 1 of 1):

${JSON.stringify({ findings: cluster.findings }, null, 2)}

${scopeNotice}

Inspect the actual repository and fix ONLY these confirmed integration defects.

Rules:

- preserve the plan's intended architecture
- avoid unrelated refactoring
- do not revert unrelated changes
- resolve contract mismatches centrally
- remove duplicate semantics rather than creating another adapter
- run targeted validation for the fixes
- do not run the full global suite yet

Return structured implementation evidence.
`,
        {
          agent: 'qcet-builder',
          agentType: 'qcet-builder',
          agentId: 'integration:repair-cluster-1',
          phase: 'Integration Repair',
          label: 'integration:repair-cluster-1',
          schema: REPAIR_SCHEMA,
        }
      );
      allClusterRepairs.push(rep || { status: 'blocked', blocker: 'Integration repair cluster 1 returned null or failed.' });
    } else {
      // Step 1: Run disjoint file-specific clusters concurrently with antiOwns populated
      if (fileSpecificClusters.length > 0) {
        const fileClustersPayload = fileSpecificClusters.map((c, idx) => {
          const otherFiles = fileSpecificClusters
            .filter((_, oIdx) => oIdx !== idx)
            .flatMap((oc) => oc.files || []);
          return {
            id: c.id || `cluster-${idx + 1}`,
            agentId: `integration:repair-cluster-${idx + 1}`,
            owns: c.files,
            antiOwns: [...new Set(otherFiles)],
          };
        });
        try {
          syncActiveShardBoundaries(fileClustersPayload, 'Integration Repair - Concurrent');
        } catch (syncErr) {
          log(`Warning: Failed to sync concurrent cluster boundaries: ${syncErr?.message || syncErr}`);
        }

        const clusterRepairs = await parallel(
          fileSpecificClusters.map((cluster, idx) => () => {
            const otherFiles = fileSpecificClusters
              .filter((_, oIdx) => oIdx !== idx)
              .flatMap((oc) => oc.files || []);
            const antiOwns = [...new Set(otherFiles)];

            return callAgent(
              `
You are the QCET integration repair owner for DISJOINT CLUSTER ${idx + 1} of ${fileSpecificClusters.length}.

CONFIRMED CROSS-SHARD FINDINGS FOR THIS CLUSTER:

${JSON.stringify({ findings: cluster.findings }, null, 2)}

STRICT AFFECTED FILES WHITELIST:
${JSON.stringify(cluster.files, null, 2)}

FORBIDDEN FILES (ANTI-OWNS - OWNED BY OTHER CONCURRENT CLUSTERS):
${JSON.stringify(antiOwns, null, 2)}

CRITICAL INVARIANT:
This is a disjoint repair cluster running concurrently with other repair clusters.
Do NOT modify files outside your assigned cluster files whitelist. Touch ONLY the files in the affected files whitelist.

Inspect the actual repository and fix ONLY these confirmed integration defects.

Rules:

- preserve the plan's intended architecture
- avoid unrelated refactoring
- do not revert unrelated changes
- resolve contract mismatches centrally
- remove duplicate semantics rather than creating another adapter
- run targeted validation for the fixes
- do not run the full global suite yet

Return structured implementation evidence.
`,
              {
                agent: 'qcet-builder',
                agentType: 'qcet-builder',
                agentId: `integration:repair-cluster-${idx + 1}`,
                phase: 'Integration Repair',
                label: `integration:repair-cluster-${idx + 1}`,
                schema: REPAIR_SCHEMA,
              }
            );
          })
        );
        allClusterRepairs.push(...clusterRepairs.map((cr, i) => cr || { status: 'blocked', blocker: `Disjoint cluster ${i + 1} repair returned null or failed.` }));
      }

      // Step 2: Execute global clusters sequentially AFTER disjoint file-specific clusters
      if (globalClusters.length > 0) {
        log(
          `Executing ${globalClusters.length} global repair cluster(s) sequentially after disjoint clusters.`
        );
        for (let gIdx = 0; gIdx < globalClusters.length; gIdx++) {
          const gCluster = globalClusters[gIdx];
          const globalId = gCluster.id || `cluster-global-${gIdx + 1}`;
          const globalPayload = [
            {
              id: globalId,
              agentId: `integration:repair-${globalId}`,
              owns: ['**/*'],
              antiOwns: [],
            },
          ];
          try {
            syncActiveShardBoundaries(globalPayload, 'Integration Repair - Global');
          } catch (syncErr) {
            log(`Warning: Failed to sync global repair boundaries: ${syncErr?.message || syncErr}`);
          }

          const gRepair = await callAgent(
            `
You are the QCET integration repair owner for GLOBAL / CROSS-CUTTING REPAIR ${gIdx + 1} of ${globalClusters.length}.

CONFIRMED CROSS-SHARD FINDINGS FOR THIS CLUSTER:

${JSON.stringify({ findings: gCluster.findings }, null, 2)}

AFFECTED SCOPE: Cross-cutting / Global findings.
Touch only files strictly required to remediate the confirmed findings.

Inspect the actual repository and fix ONLY these confirmed integration defects.

Rules:

- preserve the plan's intended architecture
- avoid unrelated refactoring
- do not revert unrelated changes
- resolve contract mismatches centrally
- remove duplicate semantics rather than creating another adapter
- run targeted validation for the fixes
- do not run the full global suite yet

Return structured implementation evidence.
`,
            {
              agent: 'qcet-builder',
              agentType: 'qcet-builder',
              agentId: `integration:repair-${globalId}`,
              phase: 'Integration Repair',
              label: `integration:repair-${globalId}`,
              schema: REPAIR_SCHEMA,
            }
          );
          allClusterRepairs.push(gRepair || { status: 'blocked', blocker: `Global cluster ${gIdx + 1} repair returned null or failed.` });
        }
      }
    }

    // Consolidate cluster repair results
    const validRepairs = allClusterRepairs.filter((r) => r && r.status !== 'blocked');
    const allChangedFiles = Array.from(
      new Set(allClusterRepairs.flatMap((r) => r?.changedFiles || []))
    );
    const allResolvedIssues = Array.from(
      new Set(allClusterRepairs.flatMap((r) => r?.resolvedIssueIds || r?.requirementsSatisfied || []))
    );
    const allRequirements = Array.from(
      new Set(allClusterRepairs.flatMap((r) => r?.requirementsSatisfied || []))
    );
    const allTestsRun = allClusterRepairs.flatMap((r) => r?.testsRun || []);
    const allRisks = allClusterRepairs.flatMap((r) => r?.risks || []);
    const anyBlocked = allClusterRepairs.some((r) => !r || r.status === 'blocked' || r.status === 'failed');

    integrationRepair = {
      status: anyBlocked ? 'blocked' : 'completed',
      changedFiles: allChangedFiles,
      summary: `Repair completed across ${clusters.length} cluster(s). ` +
        validRepairs.map((r, i) => `[Cluster ${i + 1}: ${r.summary || r.status}]`).join(' '),
      resolvedIssueIds: allResolvedIssues,
      requirementsSatisfied: allRequirements,
      testsRun: allTestsRun,
      risks: allRisks,
      blocker: validRepairs.find((r) => r.blocker)?.blocker,
    };
  }


  // ===========================================================================
  // GLOBAL VALIDATION
  // ===========================================================================

  phase('Global Validation');

  log('Running integrated repository proof gate.');


  const validation = await callAgent(
    `
You are the QCET global validation agent.

PLAN REQUIREMENTS:
${JSON.stringify(manifest.requirements, null, 2)}

SHARD RESULTS:
${JSON.stringify(shardSummary, null, 2)}

INTEGRATION REVIEW:
${JSON.stringify(integrationSynthesis, null, 2)}

INTEGRATION REPAIR:
${JSON.stringify(integrationRepair, null, 2)}

Validate the ACTUAL integrated repository state.

Run all relevant project checks that exist, including where applicable:

- git status / git diff inspection
- formatter check
- lint
- TypeScript/typecheck
- targeted unit tests
- relevant integration/API/component tests
- build (NOTE: If dev server is active on port 3001, do NOT execute 'next build' or 'npm run build' as enforced by QCET Rule 1 / guard-next-build hook; rely on 'npm run typecheck' and test suites for verification)
- repository-required validation scripts

Verify every original plan requirement against repository evidence.

Do not modify files except when a validation tool itself creates normal
temporary/build artifacts.

A failure may be called "pre-existing" ONLY if evidence proves it existed
independently of this implementation.

Do not hide failed checks.

Return structured proof.
`,
    {
      agent: 'qcet-skeptic',
      agentType: 'qcet-skeptic',
      phase: 'Global Validation',
      label: 'QCET global proof',
      schema: GLOBAL_VALIDATION_SCHEMA,
    }
  );


  // ===========================================================================
  // FINAL INDEPENDENT RELEASE GATE
  // ===========================================================================

  phase('Release Gate');


  const finalVerdict = await callAgent(
    `
You are the final independent QCET release gate.

You did not implement the changes.

GLOBAL VALIDATION:
${JSON.stringify(validation, null, 2)}

SHARD STATUS:
${JSON.stringify(shardSummary, null, 2)}

INTEGRATION:
${JSON.stringify(integrationSynthesis, null, 2)}

Inspect the ACTUAL repository and relevant diff.

Try to REFUTE readiness.

READY requires:
- relevant plan requirements satisfied
- no unresolved critical/high correctness defect
- relevant validation passes
- no unexplained contract drift
- no hidden implementation blocker

READY_WITH_KNOWN_ISSUES is allowed only for explicitly documented,
non-blocking residual issues.

BLOCKED means correctness/readiness cannot be demonstrated.

Do not modify files.

Return exactly the structured release verdict.
`,
    {
      agent: 'qcet-skeptic',
      agentType: 'qcet-skeptic',
      phase: 'Release Gate',
      label: 'final release skeptic',
      schema: FINAL_SCHEMA,
    }
  );

  const deterministicGate = evaluateDeterministicReleaseGate({
    manifest,
    allShardResults,
    integrationSynthesis,
    integrationRepair,
    validation,
    finalVerdict,
  });

  if (deterministicGate.status === 'BLOCKED') {
    log(
      `DETERMINISTIC RELEASE GATE BLOCKED: ${deterministicGate.rationale} ` +
      `Blockers: [${deterministicGate.blockers.join('; ')}]`
    );
    finalVerdict = {
      status: 'BLOCKED',
      rationale: deterministicGate.rationale,
      blockers: deterministicGate.blockers,
      deterministicOverride: true,
      agentVerdict: deterministicGate.agentVerdict,
    };
  } else if (deterministicGate.status === 'READY_WITH_KNOWN_ISSUES') {
    finalVerdict = {
      status: 'READY_WITH_KNOWN_ISSUES',
      rationale: deterministicGate.rationale,
      blockers: deterministicGate.blockers,
      deterministicOverride: deterministicGate.deterministicOverride,
      agentVerdict: deterministicGate.agentVerdict,
    };
  } else {
    finalVerdict = {
      status: 'READY',
      rationale: deterministicGate.rationale,
      blockers: [],
      deterministicOverride: deterministicGate.deterministicOverride,
      agentVerdict: deterministicGate.agentVerdict,
    };
  }


  // ===========================================================================
  // CAPTURE & PERSIST EVALUATION RUN TELEMETRY
  // ===========================================================================

  const wallClockMs = typeof rawArgs?.wallClockMs === 'number' && rawArgs.wallClockMs > 0
    ? rawArgs.wallClockMs
    : Math.max(0, Date.now() - workflowStartedAtMs);
  const timeToFirstBuilderMs = firstBuilderStartedAtMs === null
    ? null
    : Math.max(0, firstBuilderStartedAtMs - workflowStartedAtMs);
  const avgDependencyWaitMs = dependencyWaitDurationsMs.length > 0
    ? dependencyWaitDurationsMs.reduce((sum, value) => sum + value, 0) / dependencyWaitDurationsMs.length
    : 0;
  const shardDurations = Object.fromEntries(
    allShardResults.map((result) => [result?.shard?.id, result?.timing?.durationMs || 0]).filter(([id]) => id)
  );
  const criticalPathDurationMs = computeCriticalPathDurationMs(manifest, shardDurations);
  const runTelemetry = buildRunTelemetry({
    planPath,
    manifest,
    allShardResults,
    integrationSynthesis,
    integrationRepair,
    validation,
    finalVerdict,
    wallClockMs,
    calibrationDurationMs,
    agentsCount: totalAgentsCount,
    totalAgents: totalAgentsCount,
    peakConcurrent,
    timeToFirstBuilderMs,
    criticalPathDurationMs,
    avgDependencyWaitMs,
    domain: domainConfig,
    executorVersion: 'v1.5',
    timestamp: typeof args?.timestamp === 'string' ? args.timestamp : undefined,
    runId: typeof args?.runId === 'string' ? args.runId : undefined,
  });

  log(`Run telemetry generated: wallClockMs=${wallClockMs}, peakConcurrent=${peakConcurrent}, agents=${totalAgentsCount}`);

  try {
    log('Persisting run evaluation telemetry to .claude/executor-evals/run-telemetry.json');
    await callAgent(
      `You are the QCET EVALUATION TELEMETRY RECORDER.
Write the following JSON telemetry data directly to the file:
.claude/executor-evals/run-telemetry.json

TELEMETRY PAYLOAD:
${JSON.stringify(runTelemetry, null, 2)}

You own .claude/executor-evals/run-telemetry.json. Write the file accurately without modifying any other files.`,
      {
        agent: 'qcet-telemetry-recorder',
        agentType: 'qcet-telemetry-recorder',
        agentId: 'telemetry-recorder',
        phase: 'Release Gate',
        label: 'telemetry-recorder',
        schema: {
          type: 'object',
          required: ['status', 'path'],
          properties: {
            status: { type: 'string', enum: ['persisted', 'failed'] },
            path: { type: 'string' },
            message: { type: 'string' },
          },
        },
      }
    );
  } catch (telemetryError) {
    log(`Failed to persist evaluation telemetry: ${String(telemetryError)}`);
  }


  // ===========================================================================
  // RETURN STRUCTURED RESULT
  // ===========================================================================

  return {
    workflow: 'qcet-plan-executor',

    manifest: {
      summary: manifest.summary,
      requirements: manifest.requirements.length,
      shards: manifest.shards.length,
      scheduling: 'critical-path',
    },

    shards: allShardResults.map((result) => ({
      id: result.shard.id,
      risk: result.shard.risk,

      verification:
        result.lastVerification?.verdict || 'unknown',

      changedFiles:
        result.implementation?.changedFiles || [],

      unresolvedIssues:
        result.lastVerification?.issues || [],

      repairStagnated:
        Boolean(result.repairStagnated),
    })),

    integration: {
      findings: integrationSynthesis?.findings || [],
      repairPerformed: Boolean(integrationRepair),
    },

    validation,

    final: finalVerdict,

    telemetry: runTelemetry,
  };