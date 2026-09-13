#!/usr/bin/env node
/**
 * S-PERF — targeted test invocation.
 *
 * The canonical runner scripts/run-tests.mjs discovers tests/**\/*.test.ts and
 * runs the WHOLE suite; it takes no file filter. This thin wrapper reuses the
 * EXACT env derivation from run-tests.mjs (TZ, NODE_ENV=test,
 * QCET_ALLOW_DB_TESTS=1, and the /qcet_eoffice -> /qcet_test rewrite) but runs
 * only the files passed on the command line, so S-PERF can verify its targeted
 * surface without executing the full repository suite.
 *
 * It is NOT a second test framework: same tsx --test engine, same env, only an
 * argv filter differs.
 *
 * Usage:
 *   node scripts/perf/run-targeted-tests.mjs tests/app-shell-performance.test.ts [...]
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
nextEnv.loadEnvConfig(rootDir);

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/perf/run-targeted-tests.mjs <test-file> [...]");
  process.exit(2);
}
for (const f of files) {
  if (!fs.existsSync(path.join(rootDir, f))) {
    console.error(`test file not found: ${f}`);
    process.exit(2);
  }
}

const tsxBin = path.join(rootDir, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
const bin = fs.existsSync(tsxBin) ? tsxBin : "tsx";
const testDbUrl = (process.env.DATABASE_URL || "").replace(/\/qcet_eoffice(\?.*)?$/, "/qcet_test$1");

const result = spawnSync(bin, ["--test", "--test-concurrency=1", ...files], {
  cwd: rootDir,
  stdio: "inherit",
  env: {
    ...process.env,
    TZ: process.env.TZ || "UTC",
    NODE_ENV: "test",
    QCET_ALLOW_DB_TESTS: "1",
    DATABASE_URL: testDbUrl,
  },
});

if (result.error) {
  console.error("[run-targeted-tests] execution failed:", result.error);
  process.exit(1);
}
process.exit(result.status ?? 0);
