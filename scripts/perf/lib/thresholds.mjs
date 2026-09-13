/**
 * S-PERF — canonical CWV threshold loader.
 *
 * The Core Web Vitals budgets are FROZEN in plan contract C16 and are the single
 * canonical numeric source in the application: src/telemetry/web-vitals.ts ->
 * WEB_VITAL_THRESHOLDS. This module READS that file (read-only; src/** is
 * anti-owned by this shard) and parses the literal table, so the perf gate can
 * never drift from the app's own rating logic. It deliberately does NOT restate
 * the numbers — redefining thresholds would fork the canonical source
 * (Universal Invariant: One Capability, One Implementation).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
export const CANONICAL_THRESHOLDS_FILE = path.join(REPO_ROOT, "src", "telemetry", "web-vitals.ts");

/**
 * Parse the WEB_VITAL_THRESHOLDS literal out of the canonical TS source.
 * Shape parsed: `<NAME>: { good: <num>, needsImprovement: <num> }`.
 * @returns {Record<string, {good: number, needsImprovement: number}>}
 */
export function loadCanonicalThresholds() {
  const text = fs.readFileSync(CANONICAL_THRESHOLDS_FILE, "utf8");
  const blockMatch = text.match(/WEB_VITAL_THRESHOLDS[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!blockMatch) {
    throw new Error(
      `canonical thresholds not found in ${path.relative(REPO_ROOT, CANONICAL_THRESHOLDS_FILE)}`
    );
  }
  const table = {};
  const entryRe = /([A-Z][A-Z0-9]*)\s*:\s*\{\s*good:\s*([0-9.]+)\s*,\s*needsImprovement:\s*([0-9.]+)\s*\}/g;
  let m;
  while ((m = entryRe.exec(blockMatch[1])) !== null) {
    table[m[1]] = { good: Number(m[2]), needsImprovement: Number(m[3]) };
  }
  for (const required of ["LCP", "INP", "CLS"]) {
    if (!(required in table)) {
      throw new Error(`canonical thresholds missing required metric ${required}`);
    }
  }
  return table;
}
