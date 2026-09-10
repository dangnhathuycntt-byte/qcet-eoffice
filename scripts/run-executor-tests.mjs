#!/usr/bin/env node
/**
 * QCET Plan Executor - Test Suite Runner
 * Runs all unit tests under tests/executor/
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const executorTestsDir = path.join(rootDir, 'tests', 'executor');

function findTestFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.js') || entry.name.endsWith('.test.mjs'))) {
      const parentDir = entry.parentPath || entry.path || dir;
      files.push(path.relative(rootDir, path.join(parentDir, entry.name)));
    }
  }
  return files.sort();
}

const testFiles = findTestFiles(executorTestsDir);
console.log(`[executor-test-runner] Discovered ${testFiles.length} executor test files.`);

if (testFiles.length === 0) {
  console.log('[executor-test-runner] No executor test files found.');
  process.exit(0);
}

const tsxBin = path.join(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
);
const bin = fs.existsSync(tsxBin) ? tsxBin : 'tsx';

const result = spawnSync(bin, ['--test', ...testFiles], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
  },
});

if (result.error) {
  console.error('[executor-test-runner] Execution failed:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
