import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Single Font System: Be Vietnam Pro", () => {
  const rootDir = path.resolve(__dirname, "..");
  const layoutPath = path.join(rootDir, "src/app/layout.tsx");
  const globalsCssPath = path.join(rootDir, "src/app/globals.css");
  const tokensPath = path.join(rootDir, "src/lib/tokens.ts");

  test("src/app/layout.tsx only imports Be_Vietnam_Pro from next/font/google", () => {
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");
    assert.ok(
      layoutContent.includes('import { Be_Vietnam_Pro } from "next/font/google";'),
      "Must import only Be_Vietnam_Pro from next/font/google"
    );
    assert.ok(
      !layoutContent.includes("Plus_Jakarta_Sans"),
      "Must not import or reference Plus_Jakarta_Sans in layout.tsx"
    );
    assert.ok(
      !layoutContent.includes("JetBrains_Mono"),
      "Must not import or reference JetBrains_Mono in layout.tsx"
    );
    assert.ok(
      layoutContent.includes('variable: "--font-sans"'),
      "Be_Vietnam_Pro must configure --font-sans"
    );
    assert.ok(
      layoutContent.includes('"800"'),
      "Be_Vietnam_Pro weights must include 800 for bold headings"
    );
  });

  test("src/app/globals.css binds --font-heading to var(--font-sans) and uses system monospace", () => {
    const cssContent = fs.readFileSync(globalsCssPath, "utf-8");
    assert.ok(
      cssContent.includes("--font-heading: var(--font-sans);"),
      "globals.css must define --font-heading: var(--font-sans) for single-font consistency"
    );
    assert.ok(
      cssContent.includes("--font-mono: ui-monospace"),
      "globals.css must define native system monospace stack for --font-mono"
    );
  });

  test("src/lib/tokens.ts defines consistent typography tokens", () => {
    const tokensContent = fs.readFileSync(tokensPath, "utf-8");
    assert.ok(
      tokensContent.includes("Be Vietnam Pro"),
      "tokens.ts must reference Be Vietnam Pro"
    );
    assert.ok(
      !tokensContent.includes("Plus Jakarta Sans"),
      "tokens.ts must not reference Plus Jakarta Sans"
    );
    assert.ok(
      !tokensContent.includes("JetBrains Mono"),
      "tokens.ts must not reference JetBrains Mono"
    );
  });
});
