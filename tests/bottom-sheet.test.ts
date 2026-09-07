import { test } from "node:test";
import assert from "node:assert/strict";
import * as BottomSheetModule from "../src/components/ui/bottom-sheet";

test("BottomSheet exports all expected primitive components", () => {
  assert.ok(BottomSheetModule.BottomSheet, "Must export BottomSheet");
  assert.ok(BottomSheetModule.BottomSheetTrigger, "Must export BottomSheetTrigger");
  assert.ok(BottomSheetModule.BottomSheetContent, "Must export BottomSheetContent");
  assert.ok(BottomSheetModule.BottomSheetHeader, "Must export BottomSheetHeader");
  assert.ok(BottomSheetModule.BottomSheetTitle, "Must export BottomSheetTitle");
  assert.ok(BottomSheetModule.BottomSheetDescription, "Must export BottomSheetDescription");
  assert.ok(BottomSheetModule.BottomSheetFooter, "Must export BottomSheetFooter");
  assert.ok(BottomSheetModule.BottomSheetClose, "Must export BottomSheetClose");
  assert.ok(BottomSheetModule.BottomSheetOverlay, "Must export BottomSheetOverlay");
  assert.ok(BottomSheetModule.BottomSheetPortal, "Must export BottomSheetPortal");
});
