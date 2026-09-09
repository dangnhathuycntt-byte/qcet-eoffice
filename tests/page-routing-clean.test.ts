import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("src/app/page.tsx does not contain AI slop fake comments", () => {
  const pageContent = fs.readFileSync(
    path.join(process.cwd(), "src/app/page.tsx"),
    "utf-8"
  );
  // Must not have the fake AST comment block
  assert.equal(pageContent.includes("// Test AST compatibility markers:"), false);
  assert.equal(pageContent.includes("Legacy AST contract markers"), false);
  assert.equal(pageContent.includes("PortalHubView"), false);
  assert.equal(pageContent.includes('activeZone === "portal"'), false);
});

test("src/components/portal/bento-portal-hub.tsx is minimized and slop-free", () => {
  const bentoContent = fs.readFileSync(
    path.join(process.cwd(), "src/components/portal/bento-portal-hub.tsx"),
    "utf-8"
  );
  // Must be clean minimal placeholder under 60 lines
  const lines = bentoContent.split("\n").length;
  assert.ok(
    lines <= 60,
    `Expected bento-portal-hub.tsx to be <= 60 lines, got ${lines}`
  );
  assert.equal(bentoContent.includes("data-slot=\"bento-portal-hub\""), false);
});
