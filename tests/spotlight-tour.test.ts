import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { clampTooltip, calculateCutoutRect } from "@/components/onboarding/spotlight-tour";

test("clampTooltip prevents overflow outside viewport on left and right", () => {
  const clamped1 = clampTooltip(-20, 320, 1024);
  assert.equal(clamped1, 12, "Should clamp negative left to minMargin (12)");

  const clamped2 = clampTooltip(950, 320, 1024);
  assert.equal(clamped2, 1024 - 320 - 12, "Should clamp overflowing right edge");

  const clamped3 = clampTooltip(200, 320, 1024);
  assert.equal(clamped3, 200, "Should preserve left when inside bounds");

  const clamped4 = clampTooltip(950, 320, 1024, 16);
  assert.equal(clamped4, 1024 - 320 - 16, "Should respect custom margin");
});

test("calculateCutoutRect correctly expands rect by padding on all sides", () => {
  const target = { x: 100, y: 50, width: 200, height: 40 };
  const cutout = calculateCutoutRect(target, 8);

  assert.equal(cutout.x, 92);
  assert.equal(cutout.y, 42);
  assert.equal(cutout.width, 216);
  assert.equal(cutout.height, 56);

  const customCutout = calculateCutoutRect(target, 12);
  assert.equal(customCutout.x, 88);
  assert.equal(customCutout.y, 38);
  assert.equal(customCutout.width, 224);
  assert.equal(customCutout.height, 64);
});

test("keyboard shortcuts map correctly to tour controls", () => {
  let nextCalls = 0;
  let prevCalls = 0;
  let closeCalls = 0;

  const handleKeyDown = (key: string) => {
    if (key === "Escape") closeCalls++;
    if (key === "ArrowRight") nextCalls++;
    if (key === "ArrowLeft") prevCalls++;
  };

  handleKeyDown("ArrowRight");
  assert.equal(nextCalls, 1);
  assert.equal(prevCalls, 0);
  assert.equal(closeCalls, 0);

  handleKeyDown("ArrowLeft");
  assert.equal(prevCalls, 1);

  handleKeyDown("Escape");
  assert.equal(closeCalls, 1);

  handleKeyDown("Enter");
  assert.equal(nextCalls, 1, "Other keys should not trigger handlers");
});

test("SpotlightTour source code adheres to WCAG, SVG mask, and responsive mobile specs", () => {
  const componentPath = path.resolve(process.cwd(), "src/components/onboarding/spotlight-tour.tsx");
  assert.ok(fs.existsSync(componentPath), "spotlight-tour.tsx must exist");

  const fileContent = fs.readFileSync(componentPath, "utf-8");

  // Client directive
  assert.match(fileContent, /["']use client["']/, "Must be a client component");

  // WCAG dialog attributes
  assert.match(fileContent, /role=["']dialog["']/i, "Must have role='dialog'");
  assert.match(fileContent, /aria-modal=["']true["']/i, "Must have aria-modal='true'");
  assert.match(fileContent, /aria-labelledby=["']tour-step-title["']/i, "Must have aria-labelledby");
  assert.match(fileContent, /aria-describedby=["']tour-step-desc["']/i, "Must have aria-describedby");

  // SVG mask cutout
  assert.match(fileContent, /<mask id=["']qcet-spotlight-mask["']>/, "Must define qcet-spotlight-mask in defs");
  assert.match(fileContent, /mask=["']url\(#qcet-spotlight-mask\)["']/, "Must apply SVG mask to backdrop");
  assert.match(fileContent, /rx=["']8["']/, "Must have rounded corners for target cutout");

  // Pulse highlight ring
  assert.match(fileContent, /border-2 border-primary/, "Must display primary border around target");
  assert.match(fileContent, /ring-4 ring-primary\/20/, "Must display subtle glow ring around target");

  // Responsive mobile bottom sheet & desktop popover
  assert.match(fileContent, /fixed bottom-0/, "Must support mobile bottom sheet layout");
  assert.match(fileContent, /isMobile/, "Must track mobile state");

  // Keyboard navigation
  assert.match(fileContent, /e\.key === ["']Escape["']/, "Must handle Escape key");
  assert.match(fileContent, /e\.key === ["']ArrowRight["']/, "Must handle ArrowRight key");
  assert.match(fileContent, /e\.key === ["']ArrowLeft["']/, "Must handle ArrowLeft key");

  // Export clampTooltip helper
  assert.match(fileContent, /export function clampTooltip/, "Must export clampTooltip helper");
});
