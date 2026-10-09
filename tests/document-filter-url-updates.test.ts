import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDocumentFilterUpdate,
  DEFAULT_DOCUMENT_URL_FILTERS,
  isDocumentResultFiltered,
  parseDocumentUrlFilters,
  serializeDocumentUrlFilters,
} from "../src/hooks/use-document-url-filters";

describe("document filter URL updates", () => {
  it("đổi bucket đưa trang về 1", () => {
    const merged = buildDocumentFilterUpdate({ bucket: "pending" }, null);
    assert.equal(merged.page, 1);
  });

  it("xóa năm (documentYear: undefined) vẫn đưa trang về 1", () => {
    const merged = buildDocumentFilterUpdate({ documentYear: undefined }, null);
    assert.equal(merged.page, 1);
    assert.ok("documentYear" in merged);
  });

  it("chuyển trang rõ ràng được giữ nguyên", () => {
    const merged = buildDocumentFilterUpdate({ page: 3 }, null);
    assert.equal(merged.page, 3);
  });

  it("đổi kích thước trang quay về trang 1 để không rơi vào trang ngoài kết quả", () => {
    const merged = buildDocumentFilterUpdate({ pageSize: 50 }, null);
    const url = serializeDocumentUrlFilters(merged, { existingParams: "type=inbox&page=6&search=QCET" });
    const parsed = parseDocumentUrlFilters(url.slice(1));
    assert.equal(parsed.page, 1);
    assert.equal(parsed.pageSize, 50);
    assert.equal(parsed.type, "inbox");
    assert.equal(parsed.search, "QCET");
  });

  it("tắt reset trang theo tùy chọn thì không thêm page", () => {
    const merged = buildDocumentFilterUpdate({ bucket: "done" }, null, false);
    assert.equal(merged.page, undefined);
  });

  it("race debounce: từ khóa gõ trước khi chọn năm không bị mất khi năm được ghi vào URL", () => {
    // Người dùng gõ "QCET" rồi chọn năm trong 300ms: năm phải đi cùng từ khóa, không ghi đè nó
    const merged = buildDocumentFilterUpdate({ documentYear: 2026 }, "QCET");
    const qs = serializeDocumentUrlFilters(merged, {
      existingParams: "",
      defaults: DEFAULT_DOCUMENT_URL_FILTERS,
    });
    const parsed = parseDocumentUrlFilters(qs.slice(1));
    assert.equal(parsed.search, "QCET");
    assert.equal(parsed.documentYear, 2026);
    assert.equal(parsed.page, 1);
  });

  it("race debounce: chọn nhóm rồi từ khóa vẫn còn trong cùng một URL", () => {
    const first = buildDocumentFilterUpdate({ bucket: "pending" }, "ttnb");
    const qs = serializeDocumentUrlFilters(first, {
      existingParams: "",
      defaults: DEFAULT_DOCUMENT_URL_FILTERS,
    });
    const parsed = parseDocumentUrlFilters(qs.slice(1));
    assert.equal(parsed.bucket, "pending");
    assert.equal(parsed.search, "ttnb");
  });

  it("xóa năm trong URL không để lại documentYear", () => {
    const qs = serializeDocumentUrlFilters(
      { documentYear: undefined },
      { existingParams: "documentYear=2025&search=abc", defaults: DEFAULT_DOCUMENT_URL_FILTERS }
    );
    assert.ok(!qs.includes("documentYear"));
    assert.ok(qs.includes("search=abc"));
  });

  it("lọc đơn vị và năm được tính là bộ lọc kết quả; loại sổ và trang thì không", () => {
    const base = DEFAULT_DOCUMENT_URL_FILTERS;
    assert.equal(isDocumentResultFiltered({ ...base, type: "inbox" }), false);
    assert.equal(isDocumentResultFiltered({ ...base, page: 4 }), false);
    assert.equal(isDocumentResultFiltered({ ...base, leadUnitId: "unit-1" }), true);
    assert.equal(isDocumentResultFiltered({ ...base, documentYear: 2026 }), true);
    assert.equal(isDocumentResultFiltered({ ...base, bucket: "done" }), true);
  });
});
