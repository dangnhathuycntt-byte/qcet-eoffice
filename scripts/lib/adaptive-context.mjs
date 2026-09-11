/**
 * QCET Plan Executor - Adaptive Policy, Context Compression & Research Reuse (T08)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Cache for recon and research queries across the plan execution run.
 */
export class ResearchCache {
  constructor(namespace = 'default', options = {}) {
    this.namespace = namespace;
    this.repoRoot = options.repoRoot || process.cwd();
    this.cacheDir = path.join(this.repoRoot, '.superpowers', 'qcet-plan-executor', 'cache', 'research');
    fs.mkdirSync(this.cacheDir, { recursive: true });
    this.memoryCache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get researchCacheHits() {
    return this.hits;
  }

  get researchCacheMisses() {
    return this.misses;
  }

  buildKey(query, scopeOrContext = 'global', extraContext = {}) {
    let scope = 'global';
    let sourceContext = '';
    let dependencyVersion = '';

    if (typeof scopeOrContext === 'string') {
      scope = scopeOrContext;
      if (typeof extraContext === 'object' && extraContext !== null) {
        sourceContext = extraContext.sourceContext || extraContext.source || extraContext.sourceOrVersionContext || '';
        dependencyVersion = extraContext.dependencyVersion || extraContext.frameworkVersion || extraContext.version || '';
      }
    } else if (typeof scopeOrContext === 'object' && scopeOrContext !== null) {
      scope = scopeOrContext.scope || 'global';
      sourceContext = scopeOrContext.sourceContext || scopeOrContext.source || scopeOrContext.sourceOrVersionContext || '';
      dependencyVersion = scopeOrContext.dependencyVersion || scopeOrContext.frameworkVersion || scopeOrContext.version || '';
    }

    return `${this.namespace}:${scope}:${query}:${sourceContext}:${dependencyVersion}`;
  }

  _getKeyHash(query, scopeOrContext = 'global', extraContext = {}) {
    const rawKey = this.buildKey(query, scopeOrContext, extraContext);
    return crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 16);
  }

  get(query, scopeOrContext = 'global', extraContext = {}) {
    const key = this._getKeyHash(query, scopeOrContext, extraContext);
    if (this.memoryCache.has(key)) {
      this.hits++;
      return this.memoryCache.get(key);
    }
    const filePath = path.join(this.cacheDir, `${key}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.memoryCache.set(key, data.result);
        this.hits++;
        return data.result;
      } catch {
        this.misses++;
        return null;
      }
    }
    this.misses++;
    return null;
  }

  set(query, result, scopeOrContext = 'global', extraContext = {}) {
    const key = this._getKeyHash(query, scopeOrContext, extraContext);
    this.memoryCache.set(key, result);
    const filePath = path.join(this.cacheDir, `${key}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify({ query, key, result, timestamp: Date.now() }, null, 2), 'utf8');
    } catch {
      // Ignore disk write errors
    }
  }

  clear() {
    this.memoryCache.clear();
    this.hits = 0;
    this.misses = 0;
    try {
      fs.rmSync(this.cacheDir, { recursive: true, force: true });
      fs.mkdirSync(this.cacheDir, { recursive: true });
    } catch {
      // Ignore cleanup error
    }
  }
}

/**
 * Categorizes shard risk and resolves execution policy.
 * @param {Object} shard
 * @returns {Object} Policy configuration
 */
export function resolveAdaptivePolicy(shard) {
  const files = shard.owns || [];
  let risk = 'low';
  const lenses = new Set(['correctness']);

  const isAuthOrSecurity = files.some((f) =>
    /auth|crypto|session|permission|rbac|jwt|secret/i.test(f)
  );
  const isDatabaseOrCore = files.some((f) =>
    /prisma|schema|database|db|migration|core/i.test(f)
  );
  const isRouterOrApi = files.some((f) =>
    /api|routers|trpc|server/i.test(f)
  );
  const isUiOrComponent = files.some((f) =>
    /components|views|ui|styles|pages/i.test(f)
  );

  if (isAuthOrSecurity) {
    risk = 'critical';
    lenses.add('security');
    lenses.add('data-integrity');
  } else if (isDatabaseOrCore) {
    risk = 'high';
    lenses.add('data-integrity');
  } else if (isRouterOrApi) {
    risk = 'medium';
    lenses.add('security');
  }

  if (isUiOrComponent) {
    lenses.add('ux');
  }

  // Model effort mapping
  let effort = 'low';
  if (risk === 'critical') {
    effort = 'xhigh';
  } else if (risk === 'high') {
    effort = 'high';
  } else if (risk === 'medium') {
    effort = 'medium';
  }

  return {
    risk,
    effort,
    lenses: Array.from(lenses),
    requireAdversarialVerification: risk === 'critical' || risk === 'high',
    recommendedIsolation: shard.isolation === 'worktree' || risk === 'critical' ? 'worktree' : 'in_place',
  };
}

/**
 * Builds a compressed context packet containing only relevant interfaces,
 * symbols and types instead of full source files.
 *
 * @param {Object} shard
 * @param {Object} [options]
 * @returns {Object} Compressed context
 */
export function buildAdaptiveContextPacket(shard, options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const files = shard.owns || [];
  const extractedSignatures = {};
  let originalBytes = 0;
  let compressedBytes = 0;

  for (const relFile of files) {
    let content = null;
    if (options.fileContents && options.fileContents[relFile]) {
      content = options.fileContents[relFile];
    } else {
      const fullPath = path.join(repoRoot, relFile);
      if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
        try {
          content = fs.readFileSync(fullPath, 'utf8');
        } catch {
          // Ignore read errors
        }
      }
    }

    if (!content) continue;

    try {
      originalBytes += Buffer.byteLength(content, 'utf8');

      // Extract exports, types, interfaces, and function signatures
      const lines = content.split('\n');
      const signatureLines = [];
      let inDocBlock = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('/**')) inDocBlock = true;
        if (inDocBlock) {
          signatureLines.push(line);
          if (trimmed.endsWith('*/')) inDocBlock = false;
          continue;
        }

        if (
          trimmed.startsWith('export ') ||
          trimmed.startsWith('import ') ||
          trimmed.startsWith('interface ') ||
          trimmed.startsWith('type ') ||
          trimmed.startsWith('class ') ||
          trimmed.startsWith('const ') && trimmed.includes('=') && !trimmed.includes('{')
        ) {
          signatureLines.push(line);
        } else if (/^(async\s+)?function\s+/.test(trimmed)) {
          signatureLines.push(line.replace(/\{.*$/, ';'));
        }
      }

      const compressedText = signatureLines.join('\n');
      compressedBytes += Buffer.byteLength(compressedText, 'utf8');
      extractedSignatures[relFile] = compressedText;
    } catch {
      // Ignore read errors
    }
  }

  const tokenSavingsPercent = originalBytes > 0
    ? Math.round(((originalBytes - compressedBytes) / originalBytes) * 100)
    : 0;

  return {
    shardId: shard.id,
    signatures: extractedSignatures,
    originalBytes,
    compressedBytes,
    tokenSavingsPercent,
  };
}

/**
 * Creates a canonical, compact EvidencePacket containing only the factual evidence
 * required by downstream agents, avoiding full uncompressed dump propagation.
 *
 * @param {Object} shard
 * @param {Object} [state]
 * @returns {Object} Canonical EvidencePacket
 */
export function createEvidencePacket(shard, state = {}) {
  const reqDetails = Array.isArray(shard?.requirementDetails)
    ? shard.requirementDetails
    : (Array.isArray(state?.requirementDetails)
        ? state.requirementDetails
        : (shard?.requirements || state?.requirements || []).map((id) => ({ id, text: `Requirement ${id}` })));

  const impl = state?.implementation || {};
  const verif = state?.lastVerification || {};
  const recon = state?.recon || {};
  const research = state?.research || {};

  const changedFiles = Array.isArray(impl.changedFiles)
    ? impl.changedFiles
    : (Array.isArray(state?.changedFiles) ? state.changedFiles : []);

  const contractDelta = Array.isArray(impl.contractDelta)
    ? impl.contractDelta
    : (Array.isArray(state?.contractDelta)
        ? state.contractDelta
        : (Array.isArray(recon.contracts) ? recon.contracts : []));

  const testEvidence = Array.isArray(impl.testsRun)
    ? impl.testsRun
    : (Array.isArray(impl.tests)
        ? impl.tests
        : (Array.isArray(state?.testsRun)
            ? state.testsRun
            : (Array.isArray(state?.tests)
                ? state.tests
                : (Array.isArray(state?.testEvidence) ? state.testEvidence : []))));

  const confirmedFindings = Array.isArray(verif.issues)
    ? verif.issues
    : (Array.isArray(state?.confirmedFindings)
        ? state.confirmedFindings
        : (Array.isArray(state?.issues) ? state.issues : []));

  const unresolvedRisks = Array.isArray(verif.risks)
    ? verif.risks
    : (Array.isArray(recon.risks)
        ? recon.risks
        : (Array.isArray(impl.risks)
            ? impl.risks
            : (Array.isArray(state?.unresolvedRisks)
                ? state.unresolvedRisks
                : (Array.isArray(state?.risks) ? state.risks : []))));

  const rawClaims = Array.isArray(research.claims)
    ? research.claims
    : (Array.isArray(state?.relevantResearchClaims)
        ? state.relevantResearchClaims
        : (Array.isArray(state?.claims) ? state.claims : []));

  const relevantResearchClaims = rawClaims.map((c) => ({
    claim: c.claim || '',
    source: c.source || c.sourceUrl || c.canonicalUrl || '',
    sourceUrl: c.sourceUrl || c.source || c.canonicalUrl || '',
    versionOrDate: c.versionOrDate || c.date || c.version || '',
    applicability: c.applicability || '',
    confidence: typeof c.confidence === 'number' ? c.confidence : (c.confidence ? String(c.confidence) : 'medium'),
  }));

  const verificationVerdict = verif.verdict || state?.verificationVerdict || state?.verdict || 'pending';

  return {
    shardId: shard?.id || state?.shardId || 'unknown',
    requirements: shard?.requirements || state?.requirements || [],
    requirementDetails: reqDetails,
    acceptanceCriteria: shard?.acceptanceCriteria || state?.acceptanceCriteria || [],
    ownership: shard?.owns || state?.ownership || state?.owns || [],
    owns: shard?.owns || state?.ownership || state?.owns || [],
    changedFiles,
    contractDelta,
    testEvidence,
    confirmedFindings,
    unresolvedRisks,
    relevantResearchClaims,
    verificationVerdict,
  };
}

/**
 * Compresses an array of dependency execution results into compact EvidencePackets.
 *
 * @param {Array<Object>} dependencyResults
 * @returns {Array<Object>} Array of compact EvidencePackets
 */
export function compressDependencyContext(dependencyResults = []) {
  if (!Array.isArray(dependencyResults)) return [];
  return dependencyResults
    .filter(Boolean)
    .map((res) => {
      const shard = res.shard || { id: res.shardId || 'unknown' };
      return createEvidencePacket(shard, res);
    });
}

/**
 * Receiver 2: Formats compact verifier packet without raw recon prose.
 * Eliminates currentState, implementationNotes, raw file lists.
 *
 * @param {Object} shardPacket
 * @param {Object} [state]
 * @returns {Object}
 */
export function formatVerifierPacket(shardPacket, state = {}) {
  const packet = createEvidencePacket(shardPacket, state);
  const impl = state.implementation || {};
  return {
    shardId: shardPacket.id,
    title: shardPacket.title || shardPacket.id,
    requirements: packet.requirements,
    requirementDetails: packet.requirementDetails,
    acceptanceCriteria: packet.acceptanceCriteria,
    ownership: shardPacket.owns || packet.owns || [],
    changedFiles: packet.changedFiles,
    implementationSummary: impl.summary || impl.notes || 'Implementation completed.',
    testEvidence: packet.testEvidence,
    relevantContracts: packet.contractDelta,
    researchClaims: packet.relevantResearchClaims,
  };
}

/**
 * Receiver 3: Formats compact repair agent packet.
 *
 * @param {Object} shardPacket
 * @param {Object} [state]
 * @returns {Object}
 */
export function formatRepairPacket(shardPacket, state = {}) {
  const packet = createEvidencePacket(shardPacket, state);
  const verif = state.lastVerification || {};
  return {
    shardId: shardPacket.id,
    shardOwnership: shardPacket.owns || packet.owns || [],
    confirmedFindings: packet.confirmedFindings.length > 0 ? packet.confirmedFindings : (verif.issues || []),
    currentChangedFiles: packet.changedFiles,
    targetedTests: packet.testEvidence,
    requirementMapping: packet.requirementDetails,
    unresolvedRisks: packet.unresolvedRisks,
  };
}

/**
 * Receiver 4: Formats compact shard summary for integration review.
 *
 * @param {Object|Array<Object>} allShardResults
 * @returns {Object}
 */
export function formatIntegrationShardSummary(allShardResults = {}) {
  const summary = {};
  const entries = Array.isArray(allShardResults)
    ? allShardResults.map((s) => [s?.shard?.id || s?.shardId || s?.id, s])
    : Object.entries(allShardResults || {});

  for (const [shardId, res] of entries) {
    if (!res) continue;
    const shard = res.shard || { id: shardId };
    const packet = createEvidencePacket(shard, res);
    const highOrCriticalIssues = (packet.confirmedFindings || []).filter(
      (i) => i.severity === 'high' || i.severity === 'critical'
    );
    const highOrCriticalRisks = (packet.unresolvedRisks || []).filter((r) => {
      if (!r) return false;
      if (typeof r === 'string') {
        return !/\[?(?:low|info|trivial)\]?/i.test(r);
      }
      if (typeof r === 'object') {
        return r.severity === 'high' || r.severity === 'critical' || r.level === 'high' || r.level === 'critical' || (!r.severity && !r.level);
      }
      return true;
    });

    summary[shardId] = {
      shardId,
      verificationVerdict: packet.verificationVerdict,
      changedFiles: packet.changedFiles,
      contractDelta: packet.contractDelta,
      highOrCriticalFindings: highOrCriticalIssues,
      highOrCriticalRisks: highOrCriticalRisks,
      testCount: packet.testEvidence.length,
    };
  }
  return summary;
}

