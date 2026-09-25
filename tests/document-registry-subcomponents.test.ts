import test from "node:test";
import assert from "node:assert/strict";
import {
  DocumentFilterBar,
  URGENCY_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  DEFAULT_YEAR_OPTIONS,
} from "../src/components/documents/registry/document-filter-bar";
import {
  DocumentStatsSummary,
} from "../src/components/documents/registry/document-stats-summary";
import {
  DocumentTable,
} from "../src/components/documents/registry/document-table";
import {
  DocumentCardList,
} from "../src/components/documents/registry/document-card-list";
import {
  DocumentPagination,
  getPageNumbers,
} from "../src/components/documents/registry/document-pagination";

test("Document Registry Sub-components: Exports & Contracts", async (t) => {
  await t.test("document-filter-bar exports standard options and component function", () => {
    assert.strictEqual(typeof DocumentFilterBar, "function");
    assert.ok(Array.isArray(URGENCY_FILTER_OPTIONS));
    assert.ok(Array.isArray(STATUS_FILTER_OPTIONS));
    assert.ok(Array.isArray(DEFAULT_YEAR_OPTIONS));

    assert.ok(URGENCY_FILTER_OPTIONS.some((o) => o.value === "ALL"));
    assert.ok(URGENCY_FILTER_OPTIONS.some((o) => o.value === "urgent"));
    assert.ok(URGENCY_FILTER_OPTIONS.some((o) => o.value === "flash"));

    assert.ok(STATUS_FILTER_OPTIONS.some((o) => o.value === "ALL"));
    assert.ok(STATUS_FILTER_OPTIONS.some((o) => o.value === "pending_assignment"));
    assert.ok(STATUS_FILTER_OPTIONS.some((o) => o.value === "completed"));
  });

  await t.test("document-stats-summary exports component function", () => {
    assert.strictEqual(typeof DocumentStatsSummary, "function");
  });

  await t.test("document-table exports component function", () => {
    assert.strictEqual(typeof DocumentTable, "function");
  });

  await t.test("document-card-list exports component function", () => {
    assert.strictEqual(typeof DocumentCardList, "function");
  });

  await t.test("document-pagination exports component and getPageNumbers helper", () => {
    assert.ok(DocumentPagination !== null && (typeof DocumentPagination === "function" || typeof DocumentPagination === "object"));
    assert.strictEqual(typeof getPageNumbers, "function");

    // Test getPageNumbers logic
    assert.deepStrictEqual(getPageNumbers(1, 3), [1, 2, 3]);
    assert.deepStrictEqual(getPageNumbers(1, 5), [1, 2, 3, 4, 5]);
    assert.deepStrictEqual(getPageNumbers(1, 10), [1, 2, "...", 10]);
    assert.deepStrictEqual(getPageNumbers(5, 10), [1, "...", 4, 5, 6, "...", 10]);
    assert.deepStrictEqual(getPageNumbers(10, 10), [1, "...", 9, 10]);
  });
});
