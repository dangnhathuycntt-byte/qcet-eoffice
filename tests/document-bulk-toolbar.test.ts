import test from "node:test";
import assert from "node:assert/strict";
import { DocumentBulkToolbar } from "../src/components/documents/registry/document-bulk-toolbar";
import * as registryExports from "../src/components/documents/registry";

test("Document Bulk Toolbar: Exports & Contract Invariants", async (t) => {
  await t.test("exports DocumentBulkToolbar component function from registry module", () => {
    assert.strictEqual(typeof DocumentBulkToolbar, "function");
    assert.strictEqual(typeof registryExports.DocumentBulkToolbar, "function");
  });

  await t.test("Component function is defined with displayName or name", () => {
    assert.strictEqual(DocumentBulkToolbar.name, "DocumentBulkToolbar");
  });
});
