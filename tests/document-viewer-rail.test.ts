import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentFilesRail, DocumentViewerRail, FilesMenu, type RailFile } from "../src/components/documents/document-viewer-rail";
import { MAX_FILES_AS_TICKS } from "../src/lib/documents/file-viewer-state";

const makeFiles = (n: number): RailFile[] => Array.from({ length: n }, (_, i) => ({ id: `f${i + 1}`, name: `tep-${i + 1}.pdf`, detail: `${i + 2} trang` }));

function renderRail(fileCount: number, extra: Partial<React.ComponentProps<typeof DocumentViewerRail>> = {}) {
  const list = makeFiles(fileCount);
  const files =
    fileCount > 1
      ? React.createElement(
          React.Fragment,
          null,
          fileCount <= MAX_FILES_AS_TICKS ? React.createElement(DocumentFilesRail, { files: list, activeId: "f2", onSelect: () => {} }) : null,
          React.createElement(FilesMenu, { files: list, activeId: "f2", onSelect: () => {} }),
        )
      : undefined;
  return renderToStaticMarkup(
    React.createElement(DocumentViewerRail, {
      fileUrl: "/api/files/x.pdf",
      fileName: "tep-1.pdf",
      kind: "pdf",
      zoom: 100,
      onZoomChange: () => {},
      onDownload: () => {},
      search: { query: "", onQueryChange: () => {}, total: 0, active: 0, onActiveChange: () => {} },
      pages: { current: 3, total: 12, onGoto: () => {} },
      onFullscreen: () => {},
      files,
      ...extra,
    }),
  );
}

describe("Rail công cụ trình xem tệp (44px, dọc)", () => {
  test("là toolbar dọc 44px có đủ nhóm: thu phóng, trang, tìm, toàn màn hình, tải về", () => {
    const html = renderRail(1);
    assert.ok(html.includes('role="toolbar"') && html.includes('aria-orientation="vertical"'));
    assert.ok(html.includes("w-11"), "rộng 44px");
    for (const label of ["Phóng to", "Thu nhỏ", "Vừa chiều rộng", "Tìm trong tệp", "Xem toàn màn hình", "Tải về", "Trang trước", "Trang sau"]) {
      assert.ok(html.includes(`aria-label="${label}"`), `thiếu ${label}`);
    }
    assert.ok(html.includes("Trang 3 trên 12"), "hiện trang hiện tại / tổng");
  });

  test("Tệp N có nhãn cho dòng tên tệp: chữ \"Tệp 5\" nhìn thấy, popover không vượt mép màn hình", () => {
    const html = renderToStaticMarkup(React.createElement(FilesMenu, { files: makeFiles(5), activeId: "f2", onSelect: () => {}, variant: "labelled" }));
    assert.ok(html.includes('aria-label="Tệp 5"'));
    assert.ok(html.includes(">Tệp 5<"));
  });

  test("1 tệp: không có nhóm tệp", () => {
    const html = renderRail(1);
    assert.ok(!html.includes("Tệp đính kèm"));
    assert.ok(!html.includes('aria-label="Tệp 1"'));
  });

  for (const count of [5, 12]) {
    test(`${count} tệp: có nút "Tệp ${count}"${count <= MAX_FILES_AS_TICKS ? " và vạch từng tệp" : ", không có vạch"}`, () => {
      const html = renderRail(count);
      assert.ok(html.includes(`aria-label="Tệp ${count}"`));
      const ticks = (html.match(/aria-label="Xem tệp /g) ?? []).length;
      assert.equal(ticks, count <= MAX_FILES_AS_TICKS ? count : 0);
    });
  }

  test("tệp đang xem được đánh dấu aria-current trong vạch", () => {
    const html = renderRail(5);
    const current = html.match(/aria-label="Xem tệp tep-2\.pdf"[^>]*aria-current="true"/);
    assert.ok(current, "vạch của tệp thứ 2 có aria-current");
    assert.equal((html.match(/aria-current="true"/g) ?? []).length, 1);
  });

  test("ảnh chỉ có thu phóng; loại khác không có thu phóng, tìm kiếm, trang", () => {
    const image = renderRail(1, { kind: "image", pages: undefined });
    assert.ok(image.includes('aria-label="Phóng to"') && !image.includes("Tìm trong tệp"));
    // Tệp không xem trước được: không dựng rail (tải về nằm trong thông báo, chọn tệp ở nút "Tệp N")
    assert.equal(renderRail(3, { kind: "other", pages: undefined }), "");
    // Full Page vẫn giữ nhóm bổ sung (mở panel thông tin), không có công cụ xem
    const withExtra = renderRail(3, { kind: "other", pages: undefined, extra: React.createElement("button", { "aria-label": "Thông tin" }) });
    assert.ok(withExtra.includes('aria-label="Thông tin"'));
    for (const tool of ["Phóng to", "Tìm trong tệp", "Tải về", "Xem toàn màn hình"]) assert.ok(!withExtra.includes(tool), tool);
  });

  test("nhóm Trang ẩn ở pane hẹp (container query) nhưng vẫn có trong markup", () => {
    assert.ok(renderRail(1).includes("@lg/doc:flex"));
  });

  test("nhãn thu phóng nói rõ là tỷ lệ so với vừa chiều rộng (SPEC §17.6)", () => {
    const fit = renderRail(1);
    assert.ok(fit.includes('aria-label="Thu phóng 100%, vừa chiều rộng"'));
    assert.ok(fit.includes(">Vừa<") && fit.includes(">rộng<"));
    const zoomed = renderRail(1, { zoom: 115 });
    assert.ok(zoomed.includes('aria-label="Thu phóng 115% so với vừa chiều rộng"'));
    assert.ok(zoomed.includes("Tỷ lệ so với vừa chiều rộng"));
  });

  test("số trang một dòng (3/12); tệp một trang không có nhóm Trang", () => {
    const html = renderRail(1);
    assert.match(html, /<span class="whitespace-nowrap"><span class="text-foreground">3<\/span>\/12<\/span>/);
    const single = renderRail(1, { pages: { current: 1, total: 1, onGoto: () => {} } });
    assert.ok(!single.includes("Trang trước") && !single.includes("Điều hướng trang"));
  });

  test("rail bám ngay dưới dòng tên tệp khi dòng đó bám đầu vùng cuộn", () => {
    assert.ok(renderRail(1).includes("top-[var(--viewer-sticky-top,0px)]"));
  });

  test("không có nút toàn màn hình khi không hỗ trợ", () => {
    assert.ok(!renderRail(1, { onFullscreen: undefined }).includes("toàn màn hình"));
  });
});
