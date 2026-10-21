/**
 * Trình xem ảnh toàn màn hình (người dùng yêu cầu 21/10/2026 "nhấn vào thì hiện ảnh to ra cho toàn bộ mọi chỗ có hình ảnh"):
 * tỉ lệ vừa khung, nấc phóng, tên tệp khi tải về, và vùng bấm quanh ảnh mang đủ dữ liệu để xem nối tiếp trong một nhóm.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  IMAGE_ZOOM_MAX,
  ImageViewerTrigger,
  fitImageScale,
  imageDownloadName,
  stepImageZoom,
} from "../src/components/ui/image-viewer";

describe("Tỉ lệ vừa khung", () => {
  test("ảnh lớn thu theo cạnh chạm khung trước", () => {
    assert.equal(fitImageScale({ width: 3840, height: 2160 }, { width: 1312, height: 772 }), 1312 / 3840);
    assert.equal(fitImageScale({ width: 1000, height: 2000 }, { width: 800, height: 500 }), 0.25);
  });

  test("ảnh nhỏ hơn khung giữ cỡ thật, không phóng mờ; kích thước chưa biết thì 1", () => {
    assert.equal(fitImageScale({ width: 200, height: 100 }, { width: 1000, height: 800 }), 1);
    assert.equal(fitImageScale({ width: 0, height: 0 }, { width: 1000, height: 800 }), 1);
    assert.equal(fitImageScale({ width: 500, height: 500 }, { width: 0, height: 0 }), 1);
  });
});

describe("Nấc phóng", () => {
  test("nhân/chia 1,5, trong khoảng vừa màn hình tới 4 lần, về đúng 1 khi thu hết", () => {
    assert.equal(stepImageZoom(1, 1), 1.5);
    assert.equal(stepImageZoom(1.5, 1), 2.25);
    assert.equal(stepImageZoom(3.375, 1), IMAGE_ZOOM_MAX);
    assert.equal(stepImageZoom(IMAGE_ZOOM_MAX, 1), IMAGE_ZOOM_MAX);
    assert.equal(stepImageZoom(1.5, -1), 1);
    assert.equal(stepImageZoom(1, -1), 1);
  });
});

describe("Tên tệp khi tải về", () => {
  test("tên ảnh có đuôi thì giữ; không thì lấy cuối đường dẫn; ảnh cục bộ không tên thì 'hinh-anh'", () => {
    assert.equal(imageDownloadName({ src: "/api/files/x", title: "Ảnh chụp.png" }), "Ảnh chụp.png");
    assert.equal(imageDownloadName({ src: "/api/files/so-do%20lop.jpg?v=2", title: "Hình ảnh" }), "so-do lop.jpg");
    assert.equal(imageDownloadName({ src: "blob:http://localhost/abc", title: "Hình ảnh" }), "hinh-anh");
    assert.equal(imageDownloadName({ src: "data:image/png;base64,AAA", title: "" }), "hinh-anh");
  });
});

describe("Vùng bấm quanh ảnh", () => {
  test("là nút có tên đọc được, mở hộp thoại, mang nguồn và tên ảnh để xem nối tiếp trong nhóm", () => {
    const html = renderToStaticMarkup(
      React.createElement(ImageViewerTrigger, { src: "/api/files/a.png", title: "Sơ đồ phòng" }, React.createElement("img", { src: "/api/files/a.png", alt: "" }))
    );
    // React 19 dựng thêm <link rel="preload"> cho ảnh ở đầu chuỗi; ảnh phải nằm trong nút
    assert.ok(/<button[^>]*>\s*<img /.test(html), html);
    assert.ok(html.includes('aria-label="Xem ảnh lớn: Sơ đồ phòng"'));
    assert.ok(html.includes('aria-haspopup="dialog"'));
    assert.ok(html.includes('data-image-viewer-src="/api/files/a.png"') && html.includes('data-image-viewer-title="Sơ đồ phòng"'));
    assert.ok(html.includes("cursor-zoom-in"));
    assert.ok(!html.includes('role="dialog"'), "chưa bấm thì chưa dựng trình xem");
  });
});
