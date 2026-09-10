import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getActiveFilterSummary } from "../src/components/workspace/components/active-filter-breadcrumb";

describe("Dashboard Zone & Split-Cockpit Filter Helper", () => {
  test("computes active filter summary correctly", () => {
    const filters = getActiveFilterSummary({
      dept: "CNTT",
      workbox: "URGENT_OVERDUE",
      search: "nghiệm thu",
    });
    assert.equal(filters.length, 3);
    assert.equal(filters[0], "Đơn vị: CNTT");
    assert.equal(filters[1], "Hộp việc: URGENT_OVERDUE");
    assert.equal(filters[2], 'Từ khóa: "nghiệm thu"');
  });

  test("computes empty array when all filters are default", () => {
    const filters = getActiveFilterSummary({
      dept: "ALL",
      workbox: "ALL",
      search: "",
    });
    assert.equal(filters.length, 0);
  });
});
