/**
 * QCET Plan Executor - Targeted Test Runner & Verification Deduplicator
 * Implements E06: Deterministic test file discovery for changed files,
 * validation of test file existence, and run-scoped check deduplication.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import { getRepoRoot } from './worktree-manager.mjs';
import { normalizePath } from './canonical-path-matcher.cjs';

/**
 * Recursively find all test files in a directory.
 * @param {string} dir
 * @returns {string[]}
 */
export function findAllTestFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Exclude worktrees, dist, node_modules
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.claude') {
        continue;
      }
      files.push(...findAllTestFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts'))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Discover targeted test files that correspond to changed files and test hints.
 * Guarantees every returned test file actually exists on disk.
 *
 * @param {string[]} changedFiles - Array of file paths
 * @param {Object} [options]
 * @param {string[]} [options.testHints] - Explicit test file hints from shard packet
 * @param {string} [options.rootDir] - Repo root directory
 * @returns {{ testFiles: string[], discoveredCount: number, usedHints: boolean }}
 */
export function discoverTargetedTests(changedFiles = [], options = {}) {
  const rootDir = options.rootDir || getRepoRoot();
  const testHints = Array.isArray(options.testHints) ? options.testHints : [];
  const allKnownTestPaths = findAllTestFiles(path.join(rootDir, 'tests')).map((p) =>
    normalizePath(path.relative(rootDir, p))
  );

  const matchedTests = new Set();

  // 1. Process explicit testHints first
  let usedHints = false;
  for (const hint of testHints) {
    const normHint = normalizePath(hint);
    const absPath = path.isAbsolute(hint) ? hint : path.join(rootDir, normHint);
    if (fs.existsSync(absPath)) {
      matchedTests.add(normHint);
      usedHints = true;
    }
  }

  // 2. Process changed files
  for (const file of changedFiles) {
    if (!file) continue;
    const normFile = normalizePath(file);

    // If the changed file is itself a test file and exists, include it
    if (normFile.endsWith('.test.ts') || normFile.endsWith('.spec.ts')) {
      if (fs.existsSync(path.join(rootDir, normFile))) {
        matchedTests.add(normFile);
        continue;
      }
    }

    // Extract base name without extension
    const baseName = path.basename(normFile, path.extname(normFile)).toLowerCase();
    // Clean suffixes like .service, .controller, .module
    const cleanStem = baseName.replace(/\.(service|controller|module|util|helper)$/, '');

    for (const testRel of allKnownTestPaths) {
      const testBase = path.basename(testRel, path.extname(testRel)).toLowerCase();
      // Check if testBase contains or matches cleanStem
      if (
        testBase === `${cleanStem}.test` ||
        testBase === `${cleanStem}.spec` ||
        testBase.includes(`${cleanStem}-`) ||
        testBase.includes(`-${cleanStem}`) ||
        testBase.includes(cleanStem)
      ) {
        matchedTests.add(testRel);
      }
    }
  }

  const result = Array.from(matchedTests).sort();
  return {
    testFiles: result,
    discoveredCount: result.length,
    usedHints,
  };
}

/**
 * Run a set of test files and return structured results.
 * @param {string[]} testFiles
 * @param {Object} [options]
 * @param {string} [options.rootDir]
 * @param {number} [options.timeout=60000]
 * @returns {{ status: 'passed'|'failed', passed: number, failed: number, durationMs: number, failures: string[] }}
 */
export function runTargetedTests(testFiles, options = {}) {
  const rootDir = options.rootDir || getRepoRoot();
  if (!Array.isArray(testFiles) || testFiles.length === 0) {
    return {
      status: 'passed',
      passed: 0,
      failed: 0,
      durationMs: 0,
      failures: [],
    };
  }

  const startTime = Date.now();
  const testDbUrl = (process.env.DATABASE_URL || '').replace(/\/qcet_eoffice(\?.*)?$/, '/qcet_test$1');

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testDbUrl,
  };

  const res = spawnSync('npx', ['tsx', '--test', '--test-concurrency=1', ...testFiles], {
    cwd: rootDir,
    env,
    encoding: 'utf8',
    timeout: options.timeout || 60000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const durationMs = Date.now() - startTime;
  const stdout = res.stdout || '';
  const stderr = res.stderr || '';

  const passMatches = stdout.match(/^ok\s+\d+/gm) || [];
  const failMatches = stdout.match(/^not ok\s+\d+/gm) || [];

  const passed = passMatches.length;
  const failed = failMatches.length + (res.status !== 0 && failMatches.length === 0 ? 1 : 0);

  const failures = [];
  if (failed > 0) {
    const errorLines = (stdout + '\n' + stderr)
      .split('\n')
      .filter((l) => l.includes('not ok ') || l.includes('AssertionError') || l.includes('Error:'))
      .slice(0, 10);
    failures.push(...errorLines);
  }

  return {
    status: failed === 0 && res.status === 0 ? 'passed' : 'failed',
    passed,
    failed,
    durationMs,
    failures,
  };
}

/**
 * Deduplicated Verification Runner.
 * Caches typecheck and test execution per git state hash to prevent redundant runs.
 */
export class VerificationCache {
  /**
   * @param {string} [runId]
   * @param {Object} [options]
   */
  constructor(runId, options = {}) {
    this.runId = runId || `run-${Date.now()}`;
    this.repoRoot = options.repoRoot || getRepoRoot();
    this.cacheDir = path.join(this.repoRoot, '.superpowers', 'qcet-plan-executor', 'runs', this.runId);
    this.memoryCache = new Map();
  }

  /**
   * Compute a hash representing the current working directory git state.
   * @returns {string}
   */
  getStateHash() {
    try {
      const head = execSync('git rev-parse HEAD', {
        cwd: this.repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      const diffStat = execSync('git diff -U0 HEAD', {
        cwd: this.repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      let hash = 0;
      const str = head + ':' + diffStat;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return `${head.slice(0, 8)}_${Math.abs(hash)}`;
    } catch (_) {
      return `state_${Date.now()}`;
    }
  }

  /**
   * Get cached check result.
   * @param {string} checkName
   * @param {string} [stateHash]
   * @returns {Object|null}
   */
  get(checkName, stateHash = this.getStateHash()) {
    const key = `${checkName}:${stateHash}`;
    return this.memoryCache.get(key) || null;
  }

  /**
   * Store check result in cache.
   * @param {string} checkName
   * @param {Object} result
   * @param {string} [stateHash]
   */
  set(checkName, result, stateHash = this.getStateHash()) {
    const key = `${checkName}:${stateHash}`;
    this.memoryCache.set(key, { ...result, cachedAt: Date.now() });
  }

  /**
   * Run typecheck with deduplication.
   * @returns {any}
   */
  runTypecheck(options = {}) {
    const stateHash = this.getStateHash();
    const cached = this.get('typecheck', stateHash);
    if (cached && options.force !== true) {
      return { ...cached, deduplicated: true };
    }

    const startTime = Date.now();
    const res = spawnSync('npm', ['run', 'typecheck'], {
      cwd: this.repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const durationMs = Date.now() - startTime;

    const result = {
      status: res.status === 0 ? 'passed' : 'failed',
      durationMs,
      error: res.status !== 0 ? (res.stderr || res.stdout || '').slice(0, 1000) : null,
      deduplicated: false,
    };

    this.set('typecheck', result, stateHash);
    return result;
  }
}
