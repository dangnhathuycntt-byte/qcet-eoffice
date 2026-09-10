/**
 * QCET E-Office Source Code Linter
 * Enforces repository code quality, architectural boundaries, and syntax hygiene.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, "src");

let errorsFound = 0;
let filesScanned = 0;

function logError(filePath, line, message) {
  const relPath = path.relative(ROOT_DIR, filePath);
  console.error(`\x1b[31m[LINT ERROR]\x1b[0m ${relPath}:${line} - ${message}`);
  errorsFound++;
}

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git" || entry.name === "dist") {
        continue;
      }
      scanDirectory(fullPath);
    } else if (entry.isFile() && /\.(ts|tsx|js|mjs|json)$/.test(entry.name)) {
      lintFile(fullPath);
    }
  }
}

function lintFile(filePath) {
  filesScanned++;
  const relPath = path.relative(ROOT_DIR, filePath);
  const ext = path.extname(filePath);

  if (ext === ".json") {
    try {
      JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
      logError(filePath, 1, `Invalid JSON syntax: ${err.message}`);
    }
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  const isClientComponent = /["']use client["']/.test(lines.slice(0, 5).join("\n"));
  const isInsideComponents = relPath.startsWith("src/components");
  const isInsideDomain = relPath.startsWith("src/domain") || relPath.startsWith("src/server/domain");
  const isConfig = relPath.startsWith("src/config");

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;

    // Rule 1: No direct Prisma imports in client components or UI components
    if ((isClientComponent || isInsideComponents) && /from\s+["']@prisma\/client["']/.test(lineText)) {
      logError(filePath, lineNum, "Client/UI components must not import '@prisma/client' directly.");
    }

    // Rule 2: No direct process.env usage in UI components (must use src/config/env.* or runtime config)
    if (isInsideComponents && /process\.env\.[A-Z0-9_]+/.test(lineText) && !lineText.includes("// eslint-disable-next-line")) {
      logError(filePath, lineNum, "Direct process.env access forbidden in UI components. Use src/config/ or runtime config.");
    }

    // Rule 3: No domain logic importing UI components
    if (isInsideDomain && /from\s+["'](@\/components\/|\.\.\/.*components\/)/.test(lineText)) {
      logError(filePath, lineNum, "Domain logic must not import UI components.");
    }

    // Rule 4: No hardcoded live credentials or private keys in source
    if (/-----BEGIN (RSA |EC )?PRIVATE KEY-----/.test(lineText)) {
      logError(filePath, lineNum, "Hardcoded private key detected in source code.");
    }
  });
}

console.log("Starting QCET E-Office Source Quality Linter...");
scanDirectory(SRC_DIR);

// Also scan scripts and config
scanDirectory(path.join(ROOT_DIR, "scripts"));

if (errorsFound > 0) {
  console.error(`\x1b[31mLinting failed with ${errorsFound} error(s) across ${filesScanned} files.\x1b[0m`);
  process.exit(1);
} else {
  console.log(`\x1b[32m[PASS]\x1b[0m All ${filesScanned} source files passed code quality and architectural linting cleanly.`);
}
