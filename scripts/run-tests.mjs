import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
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
    include: /security|auth|permission|rbac/,
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
    include: /security|auth|permission|rbac|task-state|domain|workflow|state-machine/,
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
};

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

if (pattern) {
  const result = applyPattern(allFiles, pattern);
  testFiles = result.files;
  concurrency = result.concurrency;
  console.log(`[test-runner] Pattern "${pattern}": ${testFiles.length} / ${allFiles.length} test files (concurrency=${concurrency}).`);
} else {
  testFiles = allFiles;
  concurrency = 1;
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
