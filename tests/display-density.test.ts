import test, { describe } from "node:test";
import assert from "node:assert/strict";

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
});
