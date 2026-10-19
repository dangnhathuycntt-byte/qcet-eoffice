import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { badgeVariants } from "../src/components/ui/badge";

describe("Design Tokens Contract (Light-Only)", () => {

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
