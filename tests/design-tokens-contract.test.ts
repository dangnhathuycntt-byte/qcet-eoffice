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
