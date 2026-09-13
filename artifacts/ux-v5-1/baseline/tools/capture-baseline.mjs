#!/usr/bin/env node
/**
 * WAVE 0 baseline — delegating shim.
 *
 * The canonical capture entry point for shard-baseline is:
 *   node scripts/capture-baseline.mjs [--only=<state>,...]
 *
 * This file exists only so historical references under
 * artifacts/ux-v5-1/baseline/tools/ keep resolving; it delegates to the single
 * canonical implementation (no parallel capture engine — Core Invariant 1).
 *
 * Usage: node artifacts/ux-v5-1/baseline/tools/capture-baseline.mjs [--only=...]
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const canonical = path.resolve(here, "..", "..", "..", "..", "scripts", "capture-baseline.mjs");

await import(pathToFileURL(canonical).href);
