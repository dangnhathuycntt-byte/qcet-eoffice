import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPageOffsets,
  clampPage,
  computeRenderWindow,
  currentPageAt,
  layoutPageHeights,
  pageRatioAt,
  scrollOffsetForPage,
} from "../src/lib/documents/pdf-layout";

const A4 = { width: 595, height: 842 };

describe("Hình học trang PDF (dựng theo cửa sổ)", () => {
  test("chiều cao tỉ lệ theo từng trang: dọc, ngang, khổ lạ; chưa đo thì dùng khổ dự phòng", () => {
    const heights = layoutPageHeights([A4, { width: 842, height: 595 }, { width: 300, height: 1200 }, undefined], 600, A4);
    assert.deepEqual(heights, [849, 424, 2400, 849]);
  });

  test("không có khổ dự phòng thì dùng tỉ lệ A4", () => {
    assert.deepEqual(layoutPageHeights([undefined], 595), [842]);
  });

  test("offset cộng khoảng cách giữa các trang, tổng không tính khoảng cách cuối", () => {
    const offsets = buildPageOffsets([100, 200, 50], 10);
    assert.deepEqual(offsets.tops, [0, 110, 320]);
    assert.equal(offsets.total, 370);
    assert.deepEqual(buildPageOffsets([]), { tops: [], total: 0 });
  });

  test("cửa sổ dựng gồm trang giao khung nhìn cộng overscan, bị chặn ở hai đầu", () => {
    const heights = Array(50).fill(100);
    const offsets = buildPageOffsets(heights, 0);
    assert.deepEqual(computeRenderWindow(offsets, heights, 0, 250, 2), { first: 0, last: 4 });
    assert.deepEqual(computeRenderWindow(offsets, heights, 2500, 250, 2), { first: 22, last: 29 });
    assert.deepEqual(computeRenderWindow(offsets, heights, 99999, 250, 2), { first: 47, last: 49 });
    assert.deepEqual(computeRenderWindow(buildPageOffsets([]), [], 0, 100), { first: -1, last: -1 });
  });

  test("PDF 60 trang: chỉ dựng một cửa sổ nhỏ, không dựng toàn bộ", () => {
    const heights = Array(60).fill(849);
    const offsets = buildPageOffsets(heights, 12);
    const win = computeRenderWindow(offsets, heights, 20000, 900, 2);
    assert.ok(win.last - win.first + 1 <= 8, `dựng ${win.last - win.first + 1} trang`);
  });

  test("trang hiện tại là trang chiếm nhiều diện tích khung nhìn nhất", () => {
    const heights = [100, 100, 100];
    const offsets = buildPageOffsets(heights, 0);
    assert.equal(currentPageAt(offsets, heights, 0, 100), 1);
    assert.equal(currentPageAt(offsets, heights, 60, 100), 2);
    assert.equal(currentPageAt(offsets, heights, 140, 100), 2);
    assert.equal(currentPageAt(offsets, heights, 160, 100), 3);
    assert.equal(currentPageAt(buildPageOffsets([]), [], 0, 100), 0);
  });

  test("nhảy trang và phần trang là hai phép ngược nhau", () => {
    const heights = [800, 400, 800];
    const offsets = buildPageOffsets(heights, 12);
    const top = scrollOffsetForPage(offsets, heights, 2, 0.5);
    assert.equal(top, 812 + 200);
    assert.equal(pageRatioAt(offsets, heights, 2, top), 0.5);
    assert.equal(scrollOffsetForPage(offsets, heights, 99, 0), offsets.tops[2]);
    assert.equal(scrollOffsetForPage(offsets, heights, -4, 0), 0);
  });

  test("clampPage chặn ngoài phạm vi và giá trị không hợp lệ", () => {
    assert.equal(clampPage(0, 10), 1);
    assert.equal(clampPage(11, 10), 10);
    assert.equal(clampPage(Number.NaN, 10), 1);
    assert.equal(clampPage(3, 0), 0);
  });
});
