import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const testsDir = path.join(rootDir, "tests");

// Parse --pattern flag from argv
const patternArgIdx = process.argv.indexOf("--pattern");
const pattern = patternArgIdx !== -1 ? process.argv[patternArgIdx + 1] : null;

// Parse --files flag for explicit file list
const filesArgIdx = process.argv.indexOf("--files");
const explicitFiles = filesArgIdx !== -1 ? process.argv.slice(filesArgIdx + 1) : null;

// Parse --base flag for the git diff base (default: main)
const baseArgIdx = process.argv.indexOf("--base");
const diffBase = baseArgIdx !== -1 ? process.argv[baseArgIdx + 1] : "main";

function findTestFiles(dir) {
  const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
  const testFiles = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      const parentDir = entry.parentPath || entry.path || dir;
      const fullPath = path.join(parentDir, entry.name);
      testFiles.push(path.relative(rootDir, fullPath));
    }
  }

  return testFiles.sort();
}

// Pattern-based filter rules
const PATTERN_RULES = {
  smoke: {
    include: /smoke|api-health/,
    exclude: null,
    contentFilter: false,
    concurrency: os.cpus().length,
  },
  unit: {
    include: null,
    exclude: /integration|api[-_]route|prisma|security|auth|smoke|database|server\//,
    contentFilter: true, // exclude files containing readFileSync
    concurrency: os.cpus().length,
  },
  security: {
    include: /security|auth|permission|rbac|rate-limit|ratelimit|middleware|idor/,
    exclude: null,
    contentFilter: false,
    concurrency: os.cpus().length,
  },
  domain: {
    include: /task-state|domain|workflow|state-machine/,
    exclude: null,
    contentFilter: false,
    concurrency: os.cpus().length,
  },
  critical: {
    include: /security|auth|permission|rbac|rate-limit|ratelimit|middleware|idor|task-state|domain|workflow|state-machine/,
    exclude: null,
    contentFilter: false,
    concurrency: os.cpus().length,
  },
  integration: {
    include: /integration|api[-_]route|prisma|database|server\//,
    exclude: null,
    contentFilter: false,
    concurrency: 1,
  },
  changed: {
    include: null,
    exclude: null,
    contentFilter: false,
    concurrency: os.cpus().length,
    dynamic: true, // uses git diff to find affected files
  },
};

/**
 * Map from source path segments to test file patterns.
 * When a source file changes, tests whose path matches any of the
 * associated patterns are selected.
 */
const SOURCE_TO_TEST_MAP = [
  // Component-level mappings
  { src: /src\/components\/tasks\//, test: /task|kanban|cascading/ },
  { src: /src\/components\/dashboard\//, test: /dashboard|workbench/ },
  { src: /src\/components\/calendar\//, test: /calendar/ },
  { src: /src\/components\/layout\//, test: /sidebar|topbar|navigation|layout|app-shell/ },
  { src: /src\/components\/workspace\//, test: /workspace/ },
  { src: /src\/components\/auth\//, test: /auth|login|profile/ },
  { src: /src\/components\/documents\//, test: /document/ },
  // Lib-level mappings
  { src: /src\/lib\/auth/, test: /auth|session|login/ },
  { src: /src\/lib\/navigation\//, test: /navigation|routing|canonical-route/ },
  { src: /src\/lib\/saved-views\//, test: /saved-views/ },
  { src: /src\/lib\/calendar/, test: /calendar/ },
  { src: /src\/lib\/tasks\//, test: /task/ },
  { src: /src\/lib\/work-calendar/, test: /calendar|work-calendar/ },
  { src: /src\/lib\/departments/, test: /department/ },
  { src: /src\/lib\/delegation/, test: /delegation/ },
  { src: /src\/lib\/domain\//, test: /domain/ },
  // Server-level mappings
  { src: /src\/server\//, test: /server\/|api[-_]/ },
  { src: /src\/app\/api\//, test: /api[-_]|server\/api/ },
  // Schema / database
  { src: /prisma\//, test: /prisma|database|schema|seed/ },
  // PWA / service worker
  { src: /src\/lib\/pwa\/|public\/sw/, test: /pwa|service-worker|push/ },
];

function getChangedSourceFiles() {
  try {
    const parts = [];
    // Committed changes on the branch relative to base
    try {
      const branchDiff = execSync(`git diff --name-only ${diffBase}...HEAD 2>/dev/null`, {
        cwd: rootDir,
        encoding: "utf8",
      });
      parts.push(branchDiff);
    } catch {
      // main...HEAD may fail if main doesn't exist locally
    }
    // Committed changes vs base (covers rebased branches where ...HEAD is empty)
    try {
      const directDiff = execSync(`git diff --name-only ${diffBase} 2>/dev/null`, {
        cwd: rootDir,
        encoding: "utf8",
      });
      parts.push(directDiff);
    } catch {
      // fallback: just use working-tree changes
    }
    // Unstaged working tree changes
    try {
      const unstaged = execSync("git diff --name-only 2>/dev/null", { cwd: rootDir, encoding: "utf8" });
      parts.push(unstaged);
    } catch {
      /* ignore */
    }
    // Staged changes
    try {
      const staged = execSync("git diff --cached --name-only 2>/dev/null", { cwd: rootDir, encoding: "utf8" });
      parts.push(staged);
    } catch {
      /* ignore */
    }
    const all = new Set(parts.join("\n").split("\n").filter(Boolean));
    return [...all];
  } catch {
    return [];
  }
}

function findAffectedTests(changedFiles, allTestFiles) {
  const affected = new Set();

  for (const changed of changedFiles) {
    // If a test file itself changed, include it
    if (changed.startsWith("tests/") && changed.endsWith(".test.ts")) {
      const rel = allTestFiles.find((f) => f === changed);
      if (rel) affected.add(rel);
      continue;
    }

    // Map source changes to test patterns
    for (const mapping of SOURCE_TO_TEST_MAP) {
      if (mapping.src.test(changed)) {
        for (const testFile of allTestFiles) {
          if (mapping.test.test(testFile)) {
            affected.add(testFile);
          }
        }
      }
    }
  }

  return [...affected].sort();
}

function fileContainsReadFileSync(relPath) {
  try {
    const content = fs.readFileSync(path.join(rootDir, relPath), "utf8");
    return content.includes("readFileSync");
  } catch {
    return false;
  }
}

function applyPattern(files, pat) {
  const rule = PATTERN_RULES[pat];
  if (!rule) {
    console.error(`[test-runner] Unknown pattern: "${pat}". Valid patterns: ${Object.keys(PATTERN_RULES).join(", ")}`);
    process.exit(1);
  }

  let filtered = files;

  if (rule.include) {
    filtered = filtered.filter((f) => rule.include.test(f));
  }

  if (rule.exclude) {
    filtered = filtered.filter((f) => !rule.exclude.test(f));
  }

  if (rule.contentFilter) {
    filtered = filtered.filter((f) => !fileContainsReadFileSync(f));
  }

  return { files: filtered, concurrency: rule.concurrency };
}

const allFiles = findTestFiles(testsDir);

let testFiles;
let concurrency;

if (explicitFiles && explicitFiles.length > 0) {
  // --files mode: run exactly the specified test files
  testFiles = explicitFiles.filter((f) => fs.existsSync(path.join(rootDir, f)));
  concurrency = os.cpus().length;
  console.log(`[test-runner] Explicit files: ${testFiles.length} test files (concurrency=${concurrency}).`);
} else if (pattern === "changed") {
  // changed mode: find tests affected by git diff
  const changedFiles = getChangedSourceFiles();
  testFiles = findAffectedTests(changedFiles, allFiles);
  concurrency = os.cpus().length;
  console.log(
    `[test-runner] Changed files: ${changedFiles.length} source files → ${testFiles.length} affected test files (base=${diffBase}, concurrency=${concurrency}).`
  );
  if (testFiles.length === 0) {
    console.log("[test-runner] No affected tests found for changed files.");
    process.exit(0);
  }
} else if (pattern) {
  const result = applyPattern(allFiles, pattern);
  testFiles = result.files;
  concurrency = result.concurrency;
  console.log(`[test-runner] Pattern "${pattern}": ${testFiles.length} / ${allFiles.length} test files (concurrency=${concurrency}).`);
} else {
  testFiles = allFiles;
  // Use parallel execution for the full suite too — integration tests are
  // safe because they use an isolated test database.  Fall back to serial
  // only when TEST_SERIAL=1 is set (useful for debugging flaky ordering).
  concurrency = process.env.TEST_SERIAL === "1" ? 1 : Math.max(1, Math.floor(os.cpus().length / 2));
  console.log(`[test-runner] Discovered ${testFiles.length} test files (concurrency=${concurrency}).`);
}

if (testFiles.length === 0) {
  console.log("[test-runner] No test files found.");
  process.exit(0);
}

const tsxBin = path.join(
  rootDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx"
);
const bin = fs.existsSync(tsxBin) ? tsxBin : "tsx";

const testDbUrl = (process.env.DATABASE_URL || "").replace(/\/qcet_eoffice(\?.*)?$/, "/qcet_test$1");

const env = {
  ...process.env,
  TZ: process.env.TZ || "UTC",
  NODE_ENV: "test",
  QCET_ALLOW_DB_TESTS: "1",
  DATABASE_URL: testDbUrl,
};

const result = spawnSync(bin, ["--test", `--test-concurrency=${concurrency}`, ...testFiles], {
  cwd: rootDir,
  stdio: "inherit",
  env,
});

if (result.error) {
  console.error("[test-runner] Execution failed:", result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
