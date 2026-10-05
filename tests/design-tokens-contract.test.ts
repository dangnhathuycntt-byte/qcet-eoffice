import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { QCET_TOKENS, DESIGN_TOKENS } from "../src/lib/tokens";
import { badgeVariants } from "../src/components/ui/badge";

describe("Design Tokens Contract (Light-Only)", () => {
  it("ensures QCET_TOKENS statusColors contains zero dark: classes", () => {
    Object.entries(QCET_TOKENS.statusColors).forEach(([key, config]) => {
      assert.ok(
        !config.classes.includes("dark:"),
        `QCET_TOKENS.statusColors.${key}.classes must not contain 'dark:' (found: ${config.classes})`
      );
      assert.ok(
        !config.text.includes("dark:"),
        `QCET_TOKENS.statusColors.${key}.text must not contain 'dark:' (found: ${config.text})`
      );
    });
  });

  it("ensures QCET_TOKENS.colors.dark aliases or mirrors light mode tokens", () => {
    assert.deepEqual(QCET_TOKENS.colors.dark, QCET_TOKENS.colors.light);
  });

  it("ensures DESIGN_TOKENS.dark mirrors DESIGN_TOKENS.light", () => {
    assert.deepEqual(DESIGN_TOKENS.dark, DESIGN_TOKENS.light);
  });

  it("ensures badgeVariants contains zero dark: classes across all status variants", () => {
    const variants = [
      "default",
      "secondary",
      "destructive",
      "outline",
      "ghost",
      "link",
      "sapphire",
      "emerald",
      "amber",
      "rose",
      "violet",
      "success",
      "progress",
      "warning",
    ] as const;

    for (const variant of variants) {
      const classStr = badgeVariants({ variant });
      assert.ok(
        !classStr.includes("dark:"),
        `badgeVariants({ variant: '${variant}' }) must not contain 'dark:' (found: ${classStr})`
      );
    }
  });

  it("ensures no token string in QCET_TOKENS contains 'dark:'", () => {
    function findDarkStrings(obj: unknown, path = "QCET_TOKENS"): string[] {
      const results: string[] = [];
      if (typeof obj === "string") {
        if (obj.includes("dark:")) {
          results.push(`${path}: ${obj}`);
        }
      } else if (obj && typeof obj === "object") {
        for (const [key, value] of Object.entries(obj)) {
          results.push(...findDarkStrings(value, `${path}.${key}`));
        }
      }
      return results;
    }

    const darkTokens = findDarkStrings(QCET_TOKENS);
    assert.deepEqual(darkTokens, [], `Found dark: tokens in QCET_TOKENS: ${darkTokens.join(", ")}`);
  });
});

describe("Non-text contrast (WCAG 1.4.11)", () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  it("--control-edge đạt 3:1 trên trắng và trên nền ô #F2F4F7", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/app/globals.css", "utf8");
    const edge = css.match(/--control-edge:\s*(#[0-9A-Fa-f]{6})/)?.[1];
    assert.ok(edge, "thiếu --control-edge");
    assert.ok(ratio(edge, "#FFFFFF") >= 3);
    assert.ok(ratio(edge, "#F2F4F7") >= 3);
  });
});
