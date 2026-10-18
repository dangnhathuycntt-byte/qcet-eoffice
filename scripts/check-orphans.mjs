/**
 * Chặn file mồ côi: file trong `apps/<app>/src/` (ngoài `src/app/` và file cấp cao nhất) và
 * `packages/<tên>/src/` mà không route, layout hay script nào import tới (trực tiếp hoặc gián tiếp).
 *
 * File chỉ được test import vẫn tính là mồ côi: test không làm code sống lại,
 * và agent đọc thấy file cũ sẽ chép theo nó thay vì dùng bản đang chạy.
 *
 * Mồ côi có sẵn nằm ở `scripts/orphan-baseline.json`; gate chỉ fail khi có
 * mồ côi mới. Xóa xong file cũ thì chạy `--update-baseline` để thu nhỏ danh sách.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, "scripts", "orphan-baseline.json");
const UPDATE_BASELINE = process.argv.includes("--update-baseline");
const CHECKED = /^(apps\/[^/]+\/src\/(components|hooks|lib|types|server|domain|contracts|features|config|context|storage|telemetry)|packages\/[^/]+\/src)\//;
const APP_SRC = /^apps\/([^/]+)\/src\//;
const PACKAGE_SRC = /^packages\/[^/]+\/src\//;
const CODE = /\.(tsx?|mjs|cjs|js)$/;
const IS_TEST = (f) => /^(tests|e2e|apps\/[^/]+\/tests)\//.test(f) || /(^|\/)__tests__\//.test(f) || /\.(test|spec)\.[^.]+$/.test(f);

// Mỗi app phân giải `@/` theo tsconfig của nó; file ngoài apps/ theo tsconfig gốc.
const compilerFor = new Map();
function compilerOf(file) {
  const app = file.match(/^apps\/([^/]+)\//)?.[1];
  const dir = app ? path.join(ROOT, "apps", app) : ROOT;
  if (!compilerFor.has(dir)) {
    const { options } = ts.parseJsonConfigFileContent(
      ts.readConfigFile(path.join(dir, "tsconfig.json"), ts.sys.readFile).config,
      ts.sys,
      dir,
    );
    compilerFor.set(dir, { options, host: ts.createCompilerHost(options) });
  }
  return compilerFor.get(dir);
}

const files = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && CODE.test(f) && !f.endsWith(".d.ts") && !f.startsWith(".design-sync/") && fs.existsSync(f));

function importsOf(file) {
  const { importedFiles } = ts.preProcessFile(fs.readFileSync(file, "utf8"), true, true);
  const { options, host } = compilerOf(file);
  const out = [];
  for (const { fileName } of importedFiles) {
    const resolved = ts.resolveModuleName(fileName, path.join(ROOT, file), options, host).resolvedModule;
    if (!resolved || resolved.isExternalLibraryImport) continue;
    const rel = path.relative(ROOT, resolved.resolvedFileName);
    if (!rel.startsWith("..")) out.push(rel);
  }
  return out;
}

// Gốc: mọi file trong apps/<app>/src/app, file cấp cao nhất của src mỗi app (middleware, auth, instrumentation…),
// và code ngoài src của app (scripts, prisma, next.config). Mã nguồn package (packages/*/src) không phải gốc.
const roots = files.filter(
  (f) =>
    !IS_TEST(f) &&
    !PACKAGE_SRC.test(f) &&
    (/^apps\/[^/]+\/src\/app\//.test(f) || /^apps\/[^/]+\/src\/[^/]+$/.test(f) || !APP_SRC.test(f)),
);
const reachable = new Set();
const stack = [...roots];
while (stack.length) {
  const file = stack.pop();
  if (reachable.has(file)) continue;
  reachable.add(file);
  stack.push(...importsOf(file));
}

const orphans = files.filter((f) => CHECKED.test(f) && !IS_TEST(f) && !reachable.has(f)).sort();

if (UPDATE_BASELINE) {
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(orphans, null, 2)}\n`);
  console.log(`check-orphans: baseline ghi ${orphans.length} file.`);
  process.exit(0);
}

const baseline = new Set(fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) : []);
const fresh = orphans.filter((f) => !baseline.has(f));
const stale = [...baseline].filter((f) => !orphans.includes(f));

if (stale.length) {
  console.log(
    `check-orphans: ${stale.length} mục baseline đã được xóa hoặc dùng lại; chạy \`node scripts/check-orphans.mjs --update-baseline\`.`,
  );
}
if (fresh.length) {
  console.error("check-orphans: file không route/layout nào import tới (xóa, hoặc nối vào chỗ dùng):");
  for (const f of fresh) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`check-orphans: ok (${orphans.length} mồ côi cũ trong baseline).`);
