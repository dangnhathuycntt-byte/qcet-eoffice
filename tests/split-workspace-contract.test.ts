import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import postcss from "postcss";

// Khung workspace phải giữ cùng giá trị ở CSS module (Task Detail) và ở utility của Sổ văn bản.
const css = postcss.parse(readFileSync(path.resolve("src/components/workspace/split-workspace.module.css"), "utf8"));
const registry = readFileSync(path.resolve("src/components/documents/document-registry-view.tsx"), "utf8");

function declarations(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  css.walkRules((rule) => {
    if (rule.selector !== selector) return;
    rule.walkDecls((decl) => {
      out[decl.prop] = decl.value;
    });
  });
  return out;
}

test("khung workspace dùng chung khớp giữa CSS module và Sổ văn bản", () => {
  const split = declarations(".splitWorkspace");
  assert.equal(split.display, "grid");
  assert.equal(split["grid-template-columns"], "minmax(0, 1fr)");
  assert.equal(split["grid-template-rows"], "minmax(0, 1fr)");
  assert.equal(split.gap, "calc(var(--spacing) * 1.5)");
  assert.equal(split.padding, "calc(var(--spacing) * 2)");
  assert.match(registry, /grid-cols-\[minmax\(0,1fr\)\]/);
  assert.match(registry, /grid-rows-\[minmax\(0,1fr\)\]/);
  assert.match(registry, /gap-1\.5/, "gap 6px = calc(var(--spacing) * 1.5)");
  assert.match(registry, /\bp-2\b/, "padding 8px = calc(var(--spacing) * 2)");
});

test("thẻ workspace: bo xl, viền mảnh, nền card, cuộn trong thẻ", () => {
  const card = declarations(".card");
  assert.equal(card["border-radius"], "var(--radius-xl)");
  assert.equal(card.border, "1px solid var(--border)");
  assert.equal(card.background, "var(--card)");
  assert.equal(card.overflow, "hidden");
  assert.equal(card.display, "flex");
  assert.equal(card["flex-direction"], "column");
  assert.match(registry, /rounded-xl/);
  assert.match(registry, /border border-border/);
  assert.match(registry, /bg-card/);
  assert.match(registry, /overflow-hidden/);
  assert.match(registry, /@container/);
});

test("SHELL_CHROME của ngưỡng pane khớp khung CSS thực: padding 2 × 8px + gap 6px (SPEC §17.7)", async () => {
  const { SHELL_CHROME } = await import("../src/lib/documents/document-pane-layout");
  const split = declarations(".splitWorkspace");
  const spacing = 4;
  const padding = Number(/\* (\d+(?:\.\d+)?)\)/.exec(split.padding)?.[1]) * spacing;
  const gap = Number(/\* (\d+(?:\.\d+)?)\)/.exec(split.gap)?.[1]) * spacing;
  assert.equal(SHELL_CHROME, padding * 2 + gap);
});
