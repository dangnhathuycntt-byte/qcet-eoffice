/**
 * Thanh định dạng nổi neo theo khung phần chữ được chọn (người dùng báo 22/10/2026: bôi đen chữ bên trái mà thanh nằm
 * lơ lửng bên phải). Khung các khối/điểm ngắt dòng rỗng không được kéo giãn vùng neo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { unionRects } from "../src/lib/selection-rect";

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height });

test("hợp các dòng chữ của vùng chọn qua nhiều mục danh sách", () => {
  assert.deepEqual(unionRects([rect(288, 260, 110, 20), rect(288, 290, 70, 20), rect(288, 320, 8, 20)]), {
    x: 288, y: 260, left: 288, top: 260, right: 398, bottom: 340, width: 110, height: 80,
  });
});

test("bỏ khung rỗng (dòng trống, ký tự rộng 0 của Slate) và trả null khi không còn chữ", () => {
  assert.deepEqual(unionRects([rect(250, 250, 0, 20), rect(300, 260, 40, 20), rect(900, 300, 50, 0)])?.left, 300);
  assert.equal(unionRects([rect(250, 250, 0, 20)]), null);
  assert.equal(unionRects([]), null);
});
