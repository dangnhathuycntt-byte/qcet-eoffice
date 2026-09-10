import fs from "node:fs";
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

const testFiles = findTestFiles(testsDir);

console.log(`[test-runner] Discovered ${testFiles.length} test files.`);

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
  NODE_ENV: "test",
  QCET_ALLOW_DB_TESTS: "1",
  DATABASE_URL: testDbUrl,
};

const result = spawnSync(bin, ["--test", "--test-concurrency=1", ...testFiles], {
  cwd: rootDir,
  stdio: "inherit",
  env,
});

if (result.error) {
  console.error("[test-runner] Execution failed:", result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
