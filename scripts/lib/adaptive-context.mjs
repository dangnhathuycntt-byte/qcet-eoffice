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

  let specializedVerifier = null;

  if (isAuthOrSecurity) {
    risk = 'critical';
    lenses.add('security');
    lenses.add('data-integrity');
    specializedVerifier = 'security-reviewer';
  } else if (isDatabaseOrCore) {
    risk = files.some((f) => /prisma|schema|migration/i.test(f)) ? 'critical' : 'high';
    lenses.add('data-integrity');
    specializedVerifier = 'data-reviewer';
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
    specializedVerifier,
  };
}

/**
 * Deterministically merges verification results from independent verifiers without requiring an arbiter agent.
 * @param {Object} res1
 * @param {Object} res2
 * @returns {Object} Merged verification result
 */
export function mergeVerificationResults(res1, res2) {
  if (!res1 && !res2) {
    return {
      verdict: 'fail',
      requirementsChecked: [],
      issues: [{ id: 'merge-null', severity: 'critical', summary: 'Both verifiers returned null.' }],
      summary: 'Verification failed: both verifiers failed to return output.',
    };
  }
  if (!res1) return res2;
  if (!res2) return res1;

  const v1 = String(res1.verdict || 'fail').toLowerCase();
  const v2 = String(res2.verdict || 'fail').toLowerCase();

  let finalVerdict = 'pass';
  if (v1 === 'blocked' || v2 === 'blocked') {
    finalVerdict = 'blocked';
  } else if (v1 === 'fail' || v2 === 'fail') {
    finalVerdict = 'fail';
  }

  const reqs = Array.from(new Set([...(res1.requirementsChecked || []), ...(res2.requirementsChecked || [])]));
  const seenIssues = new Set();
  const issues = [];

  for (const issue of [...(res1.issues || []), ...(res2.issues || [])]) {
    if (!issue) continue;
    const key = `${issue.file || ''}:${issue.title || issue.description || issue.id || ''}`.toLowerCase();
    if (!seenIssues.has(key)) {
      seenIssues.add(key);
      issues.push(issue);
    }
  }

  if (issues.length > 0 && finalVerdict === 'pass') {
    finalVerdict = 'fail';
  }

  return {
    verdict: finalVerdict,
    requirementsChecked: reqs,
    issues,
    summary: `Merged verifier verdicts: [verifier1=${v1}, verifier2=${v2}]. Issues: ${issues.length}.`,
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
    const fullPath = path.join(repoRoot, relFile);
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      continue;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
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
