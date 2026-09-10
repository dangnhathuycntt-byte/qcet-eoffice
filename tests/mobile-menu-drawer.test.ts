import { test } from "node:test";
import assert from "node:assert/strict";
import { MobileMenuDrawer } from "../src/components/layout/mobile-menu-drawer";

test("MobileMenuDrawer is defined and is a valid React component", () => {
  assert.equal(typeof MobileMenuDrawer, "function");
});
