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
  }

  _getKeyHash(query, scope) {
    return crypto.createHash('sha256').update(`${this.namespace}:${scope}:${query}`).digest('hex').slice(0, 16);
  }

  get(query, scope = 'global') {
    const key = this._getKeyHash(query, scope);
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }
    const filePath = path.join(this.cacheDir, `${key}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.memoryCache.set(key, data.result);
        return data.result;
      } catch {
        return null;
      }
    }
    return null;
  }

  set(query, result, scope = 'global') {
    const key = this._getKeyHash(query, scope);
    this.memoryCache.set(key, result);
    const filePath = path.join(this.cacheDir, `${key}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify({ query, scope, result, timestamp: Date.now() }, null, 2), 'utf8');
    } catch {
      // Ignore disk write errors
    }
  }

  clear() {
    this.memoryCache.clear();
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
  const reqDetails = Array.isArray(shard.requirementDetails)
    ? shard.requirementDetails
    : (shard.requirements || []).map((id) => ({ id, text: `Requirement ${id}` }));

  const impl = state.implementation || {};
  const verif = state.lastVerification || {};
  const recon = state.recon || {};
  const research = state.research || {};

  return {
    shardId: shard.id,
    requirements: shard.requirements || [],
    requirementDetails: reqDetails,
    acceptanceCriteria: shard.acceptanceCriteria || [],
    changedFiles: Array.isArray(impl.changedFiles) ? impl.changedFiles : [],
    contractDelta: Array.isArray(impl.contractDelta)
      ? impl.contractDelta
      : (Array.isArray(recon.contracts) ? recon.contracts : []),
    testEvidence: Array.isArray(impl.testsRun) ? impl.testsRun : [],
    confirmedFindings: Array.isArray(verif.issues) ? verif.issues : [],
    unresolvedRisks: Array.isArray(verif.risks)
      ? verif.risks
      : (Array.isArray(recon.risks) ? recon.risks : []),
    relevantResearchClaims: Array.isArray(research.claims)
      ? research.claims.map((c) => ({
          claim: c.claim || '',
          sourceUrl: c.sourceUrl || c.canonicalUrl || '',
        }))
      : [],
    verificationVerdict: verif.verdict || 'pending',
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

