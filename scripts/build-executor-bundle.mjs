#!/usr/bin/env node
/**
 * QCET Plan Executor - Canonical Workflow Bundle Builder
 * Generates standalone, pure-JavaScript workflow scripts that execute
 * within the Workflow tool sandbox (no Node fs/import dependencies at script top level).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const canonicalMatcherPath = path.join(rootDir, 'scripts', 'lib', 'canonical-path-matcher.cjs');
const workflowSourcePath = path.join(rootDir, '.claude', 'workflows', 'qcet-plan-executor.js');
const distDir = path.join(rootDir, '.claude', 'dist');
const bundledWorkflowPath = path.join(distDir, 'qcet-plan-executor.bundle.js');

console.log('[build-executor-bundle] Bundling standalone workflow script...');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 1. Read canonical path matcher and extract pure JS functions
const matcherSource = fs.readFileSync(canonicalMatcherPath, 'utf8');
// Strip module.exports and require('path') from the inline bundle
const cleanMatcher = matcherSource
  .replace(/const path = require\(['"]path['"]\);/g, '')
  .replace(/module\.exports\s*=\s*\{[\s\S]*?\};/g, '');

// 2. Read workflow source
let wfSource = fs.readFileSync(workflowSourcePath, 'utf8');

// Replace static import statements and Node require blocks with self-contained JS
wfSource = wfSource.replace(
  /\/\/ -----------------------------------------------------------------------------\s*\/\/ DETERMINISTIC UTILITIES & INVARIANTS \(Canonical Module\)[\s\S]*?export const \{\s*normalizePath,[\s\S]*?\} = pathMatcher;/m,
  `// -----------------------------------------------------------------------------\n// DETERMINISTIC INLINED CANONICAL PATH MATCHER\n// -----------------------------------------------------------------------------\n${cleanMatcher}`
);

// Strip any remaining Node import statements (import fs, import path, createRequire)
wfSource = wfSource.replace(/^import\s+fs\s+from\s+['"]node:fs['"];?\s*$/gm, '');
wfSource = wfSource.replace(/^import\s+path\s+from\s+['"]node:path['"];?\s*$/gm, '');
wfSource = wfSource.replace(/^import\s+\{\s*createRequire\s*\}\s+from\s+['"]node:module['"];?\s*$/gm, '');

// Save bundled workflow
fs.writeFileSync(bundledWorkflowPath, wfSource, 'utf8');
console.log(`[build-executor-bundle] Successfully generated bundled workflow at ${path.relative(rootDir, bundledWorkflowPath)} (${fs.statSync(bundledWorkflowPath).size} bytes).`);
