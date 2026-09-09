import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Typography Tokens & Font Pairing Contract", () => {
  const rootDir = process.cwd();
  const layoutPath = path.resolve(rootDir, "src/app/layout.tsx");
  const globalsCssPath = path.resolve(rootDir, "src/app/globals.css");

  test("src/app/layout.tsx imports Be_Vietnam_Pro and Plus_Jakarta_Sans with vietnamese subsets", () => {
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");

    // 1. Imports check
    assert.match(
      layoutContent,
      /import\s+{[^}]*Be_Vietnam_Pro[^}]*Plus_Jakarta_Sans[^}]*}\s+from\s+["']next\/font\/google["']|import\s+{[^}]*Plus_Jakarta_Sans[^}]*Be_Vietnam_Pro[^}]*}\s+from\s+["']next\/font\/google["']/,
      "layout.tsx must import both Be_Vietnam_Pro and Plus_Jakarta_Sans from next/font/google"
    );

    // 2. fontSans configuration check
    assert.match(
      layoutContent,
      /variable:\s*["']--font-sans["']/,
      "layout.tsx must configure --font-sans variable"
    );
    assert.match(
      layoutContent,
      /subsets:\s*\[[^\]]*["']vietnamese["'][^\]]*\]/,
      "layout.tsx must include vietnamese subset for fonts"
    );

    // 3. fontHeading configuration check
    assert.match(
      layoutContent,
      /variable:\s*["']--font-heading["']/,
      "layout.tsx must configure --font-heading variable"
    );
    assert.match(
      layoutContent,
      /const\s+fontHeading\s*=\s*Plus_Jakarta_Sans\(\s*{[\s\S]*?variable:\s*["']--font-heading["'][\s\S]*?}\s*\)/,
      "layout.tsx must create fontHeading using Plus_Jakarta_Sans with --font-heading variable"
    );

    // 4. fontHeading weights and subsets
    assert.match(
      layoutContent,
      /fontHeading[\s\S]*?subsets:\s*\[[^\]]*["']vietnamese["'][^\]]*\]/,
      "fontHeading must include vietnamese subset"
    );
    assert.match(
      layoutContent,
      /fontHeading[\s\S]*?weight:\s*\[[^\]]*["']600["'][^\]]*["']700["']/,
      "fontHeading must include weights ['600', '700']"
    );

    // 5. html tag contains fontHeading.variable
    assert.match(
      layoutContent,
      /<html[\s\S]*?className=\{[`'"][^`'"]*fontHeading\.variable/,
      "html element must include fontHeading.variable in className"
    );
  });

  test("src/app/globals.css binds --font-heading in @theme inline and defines high contrast --muted-foreground", () => {
    const cssContent = fs.readFileSync(globalsCssPath, "utf-8");

    // Extract @theme inline block
    const themeInlineMatch = cssContent.match(/@theme\s+inline\s*{([^}]+)}/);
    assert.ok(themeInlineMatch, "globals.css must contain @theme inline block");
    const themeInline = themeInlineMatch[1];

    // Check --font-heading binding
    assert.match(
      themeInline,
      /--font-heading:\s*var\(--font-heading\);/,
      "@theme inline must bind --font-heading to var(--font-heading)"
    );

    // Check high-contrast --muted-foreground token (WCAG AA compliant <= 0.40 in light mode)
    const lightMutedFgMatch = cssContent.match(/:root\s*{[\s\S]*?--muted-foreground:\s*oklch\(\s*([\d.]+)/);
    assert.ok(lightMutedFgMatch, ":root must define --muted-foreground using oklch");
    const lightMutedLightness = parseFloat(lightMutedFgMatch[1]);
    assert.ok(
      lightMutedLightness <= 0.40,
      `Light mode --muted-foreground lightness (${lightMutedLightness}) should be <= 0.40 for high contrast WCAG AA compliance`
    );
  });

  test("src/app/globals.css enforces pure light-only tokens and has no .dark block", () => {
    const cssContent = fs.readFileSync(globalsCssPath, "utf-8");
    assert.ok(
      !cssContent.includes(".dark {") && !cssContent.includes(".dark{"),
      "globals.css must not contain .dark theme token block"
    );
    assert.ok(
      cssContent.includes("@custom-variant dark (&:not(*));"),
      "globals.css must neutralize dark variant with (&:not(*))"
    );
  });
});
