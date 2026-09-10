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

test("BottomSheet SSR rendering prevents hydration mismatch by not outputting closed drawer markup", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");

  // 1. Closed bottom sheet must render empty string in SSR (matches client initial null)
  const closedHtml = renderToStaticMarkup(
    React.createElement(
      BottomSheetModule.BottomSheet,
      { open: false },
      React.createElement(BottomSheetModule.BottomSheetContent, null, "Closed content")
    )
  );
  assert.strictEqual(
    closedHtml,
    "",
    "When open=false, BottomSheet SSR output must be empty to prevent Next.js hydration mismatch"
  );

  // 2. Uncontrolled / default bottom sheet must also render empty string in SSR
  const defaultHtml = renderToStaticMarkup(
    React.createElement(
      BottomSheetModule.BottomSheet,
      null,
      React.createElement(BottomSheetModule.BottomSheetContent, null, "Default content")
    )
  );
  assert.strictEqual(
    defaultHtml,
    "",
    "When open is omitted, BottomSheet SSR output must be empty"
  );

  // 3. Open bottom sheet in test environment renders static content
  const openHtml = renderToStaticMarkup(
    React.createElement(
      BottomSheetModule.BottomSheet,
      { open: true },
      React.createElement(BottomSheetModule.BottomSheetContent, null, "Open content")
    )
  );
  assert.ok(
    openHtml.includes("Open content"),
    "When open=true, BottomSheet SSR renders content for server tests"
  );
});
