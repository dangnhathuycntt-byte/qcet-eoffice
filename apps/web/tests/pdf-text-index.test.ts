import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { findHits, findHitsInPage, hasSearchableText, highlightItemHtml, toSearchQuery } from "../src/lib/documents/pdf-text-index";

describe("Chỉ mục văn bản PDF (tìm kiếm tách khỏi việc dựng trang)", () => {
  test("từ khóa dưới 2 ký tự bị bỏ; chuẩn hóa chữ thường và NFC", () => {
    assert.equal(toSearchQuery(" a "), "");
    assert.equal(toSearchQuery("  Quyết Định "), "quyết định");
    assert.equal(toSearchQuery("Quyết".normalize("NFD")), "quyết");
  });

  test("tìm theo thứ tự trang/đoạn/lần xuất hiện, kể cả trang chưa dựng", () => {
    const pages = [["Kế hoạch năm học", "kế hoạch chi tiết kế hoạch"], undefined, ["Không liên quan"], ["KẾ HOẠCH"]];
    const hits = findHits(pages, "kế hoạch");
    assert.deepEqual(hits, [
      { page: 1, item: 0, nth: 0 },
      { page: 1, item: 1, nth: 0 },
      { page: 1, item: 1, nth: 1 },
      { page: 4, item: 0, nth: 0 },
    ]);
  });

  test("không có từ khóa hoặc không khớp thì trả mảng rỗng", () => {
    assert.deepEqual(findHits([["abc"]], ""), []);
    assert.deepEqual(findHitsInPage(1, ["abc"], "xyz"), []);
  });

  test("tô sáng bọc <mark>, đánh dấu kết quả đang chọn và thoát HTML", () => {
    const html = highlightItemHtml("a<b> kế hoạch & kế hoạch", "kế hoạch", 1);
    assert.ok(html.startsWith("a&lt;b&gt; "));
    assert.equal((html.match(/<mark /g) ?? []).length, 2);
    assert.equal((html.match(/data-active="1"/g) ?? []).length, 1);
    assert.ok(html.includes("&amp;"));
    assert.equal(highlightItemHtml("<script>", "kế", null), "&lt;script&gt;");
  });

  test("bản scan không có lớp chữ được nhận ra để báo đúng lý do (SPEC §17.6)", () => {
    assert.equal(hasSearchableText([[], ["  ", ""], []]), false);
    assert.equal(hasSearchableText([]), false);
    assert.equal(hasSearchableText([[], ["Quyết định"]]), true);
  });
});
