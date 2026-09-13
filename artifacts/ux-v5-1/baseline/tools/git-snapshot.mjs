#!/usr/bin/env node
/**
 * WAVE 0 baseline — immutable git snapshot generator (shard-baseline owned).
 *
 * Writes artifacts/ux-v5-1/baseline/git-snapshot.txt from the LIVE working tree:
 * branch, HEAD SHA, `git log -5 --oneline`, node/npm versions, the full
 * `git status --porcelain` list, and a PRESERVE-ONLY section naming every dirty
 * path that this lane does NOT own (which must never be reverted or reformatted).
 *
 * Usage: node artifacts/ux-v5-1/baseline/tools/git-snapshot.mjs
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "..", "..", "..", "..");
const OUT = path.resolve(here, "..", "git-snapshot.txt");

const sh = (cmd) => execSync(cmd, { cwd: REPO_ROOT, encoding: "utf8" }).replace(/\n+$/, "");

const branch = sh("git branch --show-current");
const head = sh("git rev-parse HEAD");
const log5 = sh("git log -5 --oneline");
const nodeV = process.version;
const npmV = sh("npm --version");
const porcelain = sh("git status --porcelain --untracked-files=all");

// Paths owned by THIS lane (shard-baseline). Everything else in the dirty tree
// is unrelated work that must be preserved verbatim.
const OWNED_PREFIXES = [
  "artifacts/ux-v5-1/",
  "docs/agent-work/audits/ux-v5-1-baseline.md",
  "docs/agent-work/handoffs/BASELINE.md",
  "scripts/capture-baseline.mjs",
];

const lines = porcelain.split("\n").filter(Boolean);
const isOwned = (p) => OWNED_PREFIXES.some((pre) => p === pre || p.startsWith(pre));
const preserve = lines.filter((l) => !isOwned(l.slice(3).trim()));

const out = [
  "WAVE 0 — IMMUTABLE BASELINE SNAPSHOT (verbatim)",
  `Captured: ${new Date().toISOString()} (before any UX V5.1 code mutation)`,
  `Repo: ${REPO_ROOT}`,
  "",
  "$ git branch --show-current",
  branch,
  "",
  "$ git rev-parse HEAD",
  head,
  "",
  "$ git log -5 --oneline",
  log5,
  "",
  "$ node --version",
  nodeV,
  "",
  "$ npm --version",
  npmV,
  "",
  "$ git status --porcelain --untracked-files=all",
  ...lines,
  "",
  "UNRELATED DIRTY FILES — PRESERVE-ONLY (must not be reverted, reformatted, or overwritten by this lane):",
  ...(preserve.length ? preserve.map((l) => `  ${l}`) : ["  (none)"]),
  "",
  `PRESERVE-ONLY count: ${preserve.length}`,
  `TOTAL dirty entries: ${lines.length}`,
  "",
];

fs.writeFileSync(OUT, out.join("\n"));
console.log(`Wrote ${OUT}`);
console.log(`dirty=${lines.length} preserveOnly=${preserve.length}`);
