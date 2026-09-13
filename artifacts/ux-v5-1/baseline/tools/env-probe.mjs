/**
 * W0 baseline — DATABASE_URL disposal probe.
 *
 * Purpose: prove (before running any full `npm test`) that the resolved
 * DATABASE_URL is a disposable local test database, per shard-baseline W0.
 *
 * This mirrors the exact rewrite performed by scripts/run-tests.mjs (line 47):
 *   testDbUrl = DATABASE_URL.replace(/\/qcet_eoffice(\?.*)?$/, "/qcet_test$1")
 * and the four guards enforced by tests/security/me-context-api.test.ts:
 *   QCET_ALLOW_DB_TESTS === '1' && NODE_ENV === 'test'
 *   && host is localhost/127.0.0.1 && dbName endsWith '_test' or 'test'.
 *
 * Read-only: loads env and prints. Writes nothing.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

// artifacts/ux-v5-1/baseline/tools/env-probe.mjs -> repo root is 5 levels up.
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..", "..");

loadEnvConfig(repoRoot);

function parseDb(url) {
  try {
    const u = new URL(url);
    return { host: u.hostname, port: u.port, dbname: u.pathname.replace(/^\//, ""), search: u.search };
  } catch {
    return { host: "", port: "", dbname: "", search: "" };
  }
}

const rawUrl = process.env.DATABASE_URL || "";
const resolved = parseDb(rawUrl);

// run-tests.mjs rewrite: /qcet_eoffice -> /qcet_test
const testUrl = rawUrl.replace(/\/qcet_eoffice(\?.*)?$/, "/qcet_test$1");
const testResolved = parseDb(testUrl);

const isLocal = ["localhost", "127.0.0.1"].includes(resolved.host);
const isTestDbName = resolved.dbname.endsWith("_test") || resolved.dbname.endsWith("test");
const isTestDbNameAfterRewrite = testResolved.dbname.endsWith("_test") || testResolved.dbname.endsWith("test");

const report = {
  repoRoot,
  databaseUrlSet: Boolean(rawUrl),
  devDatabaseUrl: { host: resolved.host, port: resolved.port, dbname: resolved.dbname },
  devDbIsDisposable: isLocal && isTestDbName,
  rewrittenTestDatabaseUrl: { host: testResolved.host, port: testResolved.port, dbname: testResolved.dbname, search: testResolved.search },
  testDbIsDisposable: ["localhost", "127.0.0.1"].includes(testResolved.host) && isTestDbNameAfterRewrite,
  guards: {
    qcetAllowDbTests: process.env.QCET_ALLOW_DB_TESTS ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    note: "npm test sets QCET_ALLOW_DB_TESTS=1 and NODE_ENV=test via scripts/run-tests.mjs",
  },
  verdict:
    isLocal && isTestDbName
      ? "DEV DATABASE_URL is itself a disposable test DB."
      : isLocal && isTestDbNameAfterRewrite
        ? "DEV DATABASE_URL points at the working DB (qcet_eoffice, NOT disposable); `npm test` rewrites it to the disposable local DB qcet_test. No test run touches the dev DB."
        : "WARNING: could not prove a disposable test database.",
};

console.log(JSON.stringify(report, null, 2));
