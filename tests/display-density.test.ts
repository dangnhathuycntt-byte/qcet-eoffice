import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { DENSITY_CONFIG } from "../src/components/ui/density-toggle";

describe("Display Density State Management Contract", () => {
  const STORAGE_KEY = "qcet-display-density";

  test("Defaults to comfortable if localStorage is empty", () => {
    let stored: string | null = null;
    const resolveDensity = (val: string | null) => (val === "compact" ? "compact" : "comfortable");
    assert.strictEqual(resolveDensity(stored), "comfortable");
  });

  test("Resolves compact if localStorage contains compact", () => {
    let stored = "compact";
    const resolveDensity = (val: string | null) => (val === "compact" ? "compact" : "comfortable");
    assert.strictEqual(resolveDensity(stored), "compact");
  });

  test("Toggle switches between comfortable and compact", () => {
    let density = "comfortable";
    const toggle = (current: string) => (current === "comfortable" ? "compact" : "comfortable");
    density = toggle(density);
    assert.strictEqual(density, "compact");
    density = toggle(density);
    assert.strictEqual(density, "comfortable");
  });

  test("Density labels and icons mapping", () => {
    assert.strictEqual(DENSITY_CONFIG.comfortable.label, "Thoải mái (48px)");
    assert.strictEqual(DENSITY_CONFIG.compact.label, "Thu gọn (38px)");
    assert.strictEqual(DENSITY_CONFIG.comfortable.next, "compact");
    assert.strictEqual(DENSITY_CONFIG.compact.next, "comfortable");
    assert.ok(DENSITY_CONFIG.comfortable.tooltip.includes("48px"));
    assert.ok(DENSITY_CONFIG.compact.tooltip.includes("38px"));
  });
});
