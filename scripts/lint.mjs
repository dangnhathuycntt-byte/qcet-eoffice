/**
 * QCET E-Office Source Code Linter
 *
 * Enforces repository code quality, architectural boundaries, and syntax hygiene,
 * plus design-system conformance for UI source files.
 *
 * Design rules exist because DESIGN.md is a contract, not a description. A rule
 * that is not checked is a preference; the rules below are the checkable minimum.
 *
 * Findings already present in the codebase are recorded in
 * `scripts/design-lint-baseline.json` so this gate fails on NEW drift only.
 * Regenerate the baseline deliberately with `node scripts/lint.mjs --update-baseline`.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, "src");
const SCRIPTS_DIR = path.join(ROOT_DIR, "scripts");
const BASELINE_PATH = path.join(SCRIPTS_DIR, "design-lint-baseline.json");
const UPDATE_BASELINE = process.argv.includes("--update-baseline");

let errorsFound = 0;
let filesScanned = 0;

/** Architectural findings — never baselined, always fatal. */
function logError(filePath, line, message) {
  const relPath = path.relative(ROOT_DIR, filePath);
  console.error(`\x1b[31m[LINT ERROR]\x1b[0m ${relPath}:${line} - ${message}`);
  errorsFound++;
}

// ---------------------------------------------------------------------------
// Design-system rules
// ---------------------------------------------------------------------------

/** Emoji pictographs. Deliberately excludes dingbats (U+2700–U+27BF) so that
 *  ✓ and ✗ remain usable as glyphs. */
const EMOJI_RE = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/u;

/** Raw neutral color families. Every one of these has a semantic token
 *  (background / foreground / muted / border) that should be used instead. */
const RAW_NEUTRAL_RE =
  /\b(?:bg|text|border|ring|ring-offset|divide|from|to|via|outline|placeholder|caret|accent|decoration|fill|stroke)-(?:slate|gray|grey|zinc|neutral|stone)-\d{2,3}(?:\/\d{1,3})?\b/;

/** Comment-only lines describe rules; they must never trip them. */
function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

const DESIGN_RULES = [
  {
    id: "no-dark-variant",
    message:
      "Dark-mode variant class. QCET E-Office is Light-Only by construction (@custom-variant dark). Remove the `dark:` class.",
    // Requires a class context: `dark:` preceded by a quote/backtick/space and
    // followed by a utility. Avoids false positives on comments ("zero dark:
    // classes") and JS object keys (`dark: LIGHT_COLORS`).
    test: (line) => /["'`\s]dark:[a-z[]/.test(line),
  },
  {
    id: "no-emoji",
    message:
      "Emoji in interface source. Use a Lucide icon with strokeWidth={1.5} instead.",
    test: (line) => EMOJI_RE.test(line),
  },
  {
    id: "icon-stroke-width",
    message:
      "Lucide icon strokeWidth must be 1.5. Pass `strokeWidth={1.5}` explicitly.",
    test: (line) =>
      /strokeWidth=\{(?!1\.5\b)[\d.]+\}/.test(line) || /strokeWidth="(?!1\.5")[\d.]+"/.test(line),
  },
  {
    id: "no-uppercase-heading",
    message:
      "Uppercase + wide tracking on a Vietnamese heading. Diacritics compress on accented capitals; use sentence case.",
    test: (line) => /\buppercase\b/.test(line) && /\btracking-wid(?:e|er|est)\b/.test(line),
  },
  {
    id: "no-icon-box",
    message:
      "Icon wrapped in a rounded muted box. Render the icon bare at size-4 text-muted-foreground.",
    test: (line) =>
      /bg-muted\/\d+/.test(line) &&
      /rounded-(?:md|lg|xl)\b/.test(line) &&
      /items-center/.test(line) &&
      /justify-center/.test(line),
  },
  {
    id: "no-raw-neutral-palette",
    message:
      "Raw neutral palette color. Use a semantic token (bg-background, text-foreground, text-muted-foreground, border-border).",
    test: (line) => RAW_NEUTRAL_RE.test(line),
  },
  {
    id: "no-arbitrary-color-value",
    message:
      "Hardcoded color in a Tailwind arbitrary value. Use a design token or a CSS custom property.",
    test: (line) => /\[(?:#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/.test(line),
  },
  {
    id: "no-card-accent-bar",
    message:
      "Colored top accent bar on a card. Use hierarchy from type and spacing instead.",
    test: (line) => /\b(?:h-\[2px\]|h-\[3px\]|h-\[4px\]|border-t-4|border-t-2)\b/.test(line),
  },
  {
    id: "focus-ring-width",
    message:
      "Focus ring must be ring-2 (found ring-1). Every interactive element needs the standard focus indicator.",
    test: (line) => /focus-visible:ring-1\b/.test(line),
  },
];

/**
 * Findings subject to baseline suppression.
 * Key is `ruleId|file|trimmed source line`, which survives line-number shifts:
 * editing the line changes the key, so the finding re-surfaces as new drift.
 */
const designFindings = [];
const baselineKeys = new Set();

function baselineKey(ruleId, relPath, lineText) {
  return `${ruleId}|${relPath}|${lineText.trim()}`;
}

function reportDesign(rule, filePath, relPath, lineText) {
  designFindings.push({
    key: baselineKey(rule.id, relPath, lineText),
    ruleId: rule.id,
    relPath,
    lineText: lineText.trim(),
    message: rule.message,
    line: designFindings.length + 1,
  });
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    const entries = Array.isArray(raw?.entries) ? raw.entries : [];
    for (const entry of entries) {
      if (entry?.ruleId && entry?.file && typeof entry?.text === "string") {
        baselineKeys.add(`${entry.ruleId}|${entry.file}|${entry.text}`);
      }
    }
  } catch (err) {
    console.error(
      `\x1b[33m[LINT WARN]\x1b[0m Could not read design lint baseline: ${err.message}`
    );
  }
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

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
  const isDesignSource = relPath.startsWith("src/");

  const isClientComponent = /["']use client["']/.test(lines.slice(0, 5).join("\n"));
  const isInsideComponents = relPath.startsWith("src/components");
  const isInsideDomain = relPath.startsWith("src/domain") || relPath.startsWith("src/server/domain");

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

    // Rules 5+: design-system conformance, UI source only
    if (isDesignSource && !isCommentLine(lineText)) {
      for (const rule of DESIGN_RULES) {
        if (rule.test(lineText)) reportDesign(rule, filePath, relPath, lineText);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

loadBaseline();

console.log("Starting QCET E-Office Source Quality Linter...");
scanDirectory(SRC_DIR);
scanDirectory(SCRIPTS_DIR);

const newFindings = designFindings.filter((f) => !baselineKeys.has(f.key));
const knownFindings = designFindings.length - newFindings.length;

if (UPDATE_BASELINE) {
  const payload = {
    $comment:
      "Design-system debt accepted as of the last baseline update. CI fails on entries NOT listed here. Regenerate deliberately with `node scripts/lint.mjs --update-baseline`.",
    entries: [
      ...new Set(designFindings.map((f) => f.key)),
    ]
      .sort()
      .map((key) => {
        const [ruleId, file, ...rest] = key.split("|");
        return { ruleId, file, text: rest.join("|") };
      }),
  };
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `\x1b[33m[BASELINE]\x1b[0m Wrote ${payload.entries.length} design finding(s) to ${path.relative(ROOT_DIR, BASELINE_PATH)}.`
  );
  console.log(
    `\x1b[33m[BASELINE]\x1b[0m Review this file — every entry is accepted design-system debt.`
  );
  // A deliberate baseline update records debt; it is not itself a failure.
  // Architectural errors still fail — those are never baselinable.
  if (errorsFound > 0) {
    console.error("");
    console.error(`\x1b[31mLinting failed with ${errorsFound} error(s) across ${filesScanned} files.\x1b[0m`);
    process.exit(1);
  }
  console.log(`\x1b[32m[PASS]\x1b[0m Baseline updated across ${filesScanned} files.`);
  process.exit(0);
}

if (newFindings.length > 0) {
  console.error("");
  for (const f of newFindings) {
    console.error(
      `\x1b[31m[DESIGN]\x1b[0m ${f.relPath} - ${f.ruleId}: ${f.message}`
    );
    console.error(`         \x1b[2m> ${f.lineText}\x1b[0m`);
  }
  errorsFound += newFindings.length;
}

if (knownFindings > 0) {
  console.log(
    `\x1b[33m[DEBT]\x1b[0m ${knownFindings} baselined design finding(s) suppressed (see ${path.relative(ROOT_DIR, BASELINE_PATH)}).`
  );
}

if (errorsFound > 0) {
  console.error("");
  console.error(`\x1b[31mLinting failed with ${errorsFound} error(s) across ${filesScanned} files.\x1b[0m`);
  process.exit(1);
} else {
  console.log(`\x1b[32m[PASS]\x1b[0m All ${filesScanned} source files passed code quality and architectural linting cleanly.`);
}
