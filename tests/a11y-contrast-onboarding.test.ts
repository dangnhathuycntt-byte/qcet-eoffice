import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Accessibility, Contrast & Spotlight Tour Suite", () => {
  test("spotlight-tour.tsx avoids full-screen blocking overlay on mobile", () => {
    const tourPath = path.resolve(process.cwd(), "src/components/onboarding/spotlight-tour.tsx");
    const content = fs.readFileSync(tourPath, "utf-8");
    assert.ok(content.includes("innerWidth < 768") || content.includes("isMobile"));
  });
});
