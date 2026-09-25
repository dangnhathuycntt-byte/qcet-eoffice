import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseDocumentTabType,
  parseDocumentUrlFilters,
  serializeDocumentUrlFilters,
  isDocumentFiltered,
  DEFAULT_DOCUMENT_URL_FILTERS,
} from "../src/hooks/use-document-url-filters";

describe("use-document-url-filters", () => {
  describe("parseDocumentTabType", () => {
    test("correctly parses canonical and legacy tab types", () => {
      assert.equal(parseDocumentTabType("inbox"), "inbox");
      assert.equal(parseDocumentTabType("VAN_BAN_DEN"), "inbox");
      assert.equal(parseDocumentTabType("outbox"), "outbox");
      assert.equal(parseDocumentTabType("VAN_BAN_DI"), "outbox");
      assert.equal(parseDocumentTabType("submission"), "submission");
      assert.equal(parseDocumentTabType("pending"), "submission");
      assert.equal(parseDocumentTabType("TO_TRINH_NOI_BO"), "submission");
      assert.equal(parseDocumentTabType("all"), "all");
      assert.equal(parseDocumentTabType("archive"), "all");
      assert.equal(parseDocumentTabType(""), "all");
      assert.equal(parseDocumentTabType(null), "all");
      assert.equal(parseDocumentTabType("unknown_type"), "all");
    });
  });

  describe("parseDocumentUrlFilters", () => {
    test("returns defaults when query params are empty", () => {
      const filters = parseDocumentUrlFilters(new URLSearchParams());
      assert.deepEqual(filters, DEFAULT_DOCUMENT_URL_FILTERS);
    });

    test("parses valid query params properly", () => {
      const params = new URLSearchParams({
        type: "inbox",
        search: "Quyết định",
        status: "CHO_PHAN_CONG",
        urgency: "HOA_TOC",
        leadUnitId: "unit-cntt",
        documentYear: "2026",
        page: "3",
        pageSize: "50",
      });
      const filters = parseDocumentUrlFilters(params);
      assert.equal(filters.type, "inbox");
      assert.equal(filters.search, "Quyết định");
      assert.equal(filters.status, "CHO_PHAN_CONG");
      assert.equal(filters.urgency, "HOA_TOC");
      assert.equal(filters.leadUnitId, "unit-cntt");
      assert.equal(filters.documentYear, 2026);
      assert.equal(filters.page, 3);
      assert.equal(filters.pageSize, 50);
    });

    test("handles fallbacks (tab -> type, q -> search, dept -> leadUnitId, year -> documentYear, limit -> pageSize)", () => {
      const params = new URLSearchParams({
        tab: "outbox",
        q: "Công văn",
        dept: "unit-daotao",
        year: "2025",
        limit: "15",
      });
      const filters = parseDocumentUrlFilters(params);
      assert.equal(filters.type, "outbox");
      assert.equal(filters.search, "Công văn");
      assert.equal(filters.leadUnitId, "unit-daotao");
      assert.equal(filters.documentYear, 2025);
      assert.equal(filters.pageSize, 15);
      assert.equal(filters.page, 1);
    });

    test("handles invalid numbers gracefully", () => {
      const params = new URLSearchParams({
        page: "-5",
        pageSize: "9999",
        documentYear: "1800",
      });
      const filters = parseDocumentUrlFilters(params);
      assert.equal(filters.page, 1);
      assert.equal(filters.pageSize, 20);
      assert.equal(filters.documentYear, undefined);
    });
  });

  describe("serializeDocumentUrlFilters", () => {
    test("returns empty query string when all filters are default", () => {
      const url = serializeDocumentUrlFilters(DEFAULT_DOCUMENT_URL_FILTERS, {
        pathname: "/documents",
      });
      assert.equal(url, "/documents");
    });

    test("serializes only non-default filters", () => {
      const url = serializeDocumentUrlFilters(
        {
          type: "inbox",
          search: "Báo cáo",
          status: "DANG_XU_LY",
          page: 2,
        },
        { pathname: "/documents" }
      );
      assert.ok(url.includes("type=inbox"));
      assert.ok(url.includes("search=B%C3%A1o+c%C3%A1o") || url.includes("search=B%C3%A1o%20c%C3%A1o"));
      assert.ok(url.includes("status=DANG_XU_LY"));
      assert.ok(url.includes("page=2"));
      assert.ok(!url.includes("pageSize="));
      assert.ok(!url.includes("urgency="));
    });

    test("removes undefined / reset documentYear", () => {
      const existing = new URLSearchParams("documentYear=2025&page=2");
      const url = serializeDocumentUrlFilters(
        { documentYear: undefined },
        { pathname: "/documents", existingParams: existing }
      );
      assert.ok(!url.includes("documentYear"));
      assert.ok(url.includes("page=2"));
    });
  });

  describe("isDocumentFiltered", () => {
    test("returns false for default filters", () => {
      assert.equal(isDocumentFiltered(DEFAULT_DOCUMENT_URL_FILTERS), false);
    });

    test("returns true if any filter is active", () => {
      assert.equal(
        isDocumentFiltered({ ...DEFAULT_DOCUMENT_URL_FILTERS, type: "inbox" }),
        true
      );
      assert.equal(
        isDocumentFiltered({ ...DEFAULT_DOCUMENT_URL_FILTERS, search: "test" }),
        true
      );
      assert.equal(
        isDocumentFiltered({ ...DEFAULT_DOCUMENT_URL_FILTERS, status: "CHO_PHAN_CONG" }),
        true
      );
      assert.equal(
        isDocumentFiltered({ ...DEFAULT_DOCUMENT_URL_FILTERS, urgency: "KHAN" }),
        true
      );
      assert.equal(
        isDocumentFiltered({ ...DEFAULT_DOCUMENT_URL_FILTERS, leadUnitId: "unit-1" }),
        true
      );
      assert.equal(
        isDocumentFiltered({ ...DEFAULT_DOCUMENT_URL_FILTERS, documentYear: 2026 }),
        true
      );
    });

    test("returns false if filters match default values with different representation (e.g. ALL / empty)", () => {
      assert.equal(
        isDocumentFiltered({
          ...DEFAULT_DOCUMENT_URL_FILTERS,
          status: "ALL",
          urgency: "ALL",
          leadUnitId: "",
          search: "   ",
        }),
        false
      );
    });
  });
});
