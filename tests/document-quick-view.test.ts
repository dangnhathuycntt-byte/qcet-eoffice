import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentQuickView } from "../src/components/documents/workspace/document-quick-view";
import { DocumentFileViewer } from "../src/components/documents/document-file-viewer";
import { DocumentPdfViewer } from "../src/components/documents/document-pdf-viewer";
import type { OfficialDocument } from "../src/types/document";

const seed: OfficialDocument = {
  id: "doc-1",
  type: "inbox",
  documentNumber: "123/BLĐ",
  registrationNumber: 28,
  issuedDate: "2026-02-27",
  receivedDate: "2026-03-02",
  issuingAuthority: "Sở GD&ĐT",
  summary: "Về việc tổ chức hội nghị",
  urgency: "urgent",
  status: "processing",
  leadDepartment: "Phòng Đào tạo",
  signatory: "",
  attachments: [
    { id: "a1", name: "cong-van.pdf", url: "documents/cong-van.pdf", sizeBytes: 2048 },
    { id: "a2", name: "phu-luc.pdf", url: "documents/phu-luc.pdf", sizeBytes: 1024 },
  ],
  signatures: [{ id: "s1" }],
};

const render = (mode: "pane" | "overlay", extra: Partial<React.ComponentProps<typeof DocumentQuickView>> = {}) =>
  renderToStaticMarkup(
    React.createElement(DocumentQuickView, { docId: "doc-1", fileId: null, seed, mode, onClose: () => {}, onFileChange: () => {}, ...extra }),
  );

describe("Quick View (SSR markup)", () => {
  test("pane desktop là vùng không modal: region có tên, không aria-modal", () => {
    const html = render("pane");
    assert.ok(html.includes('role="region"'));
    assert.ok(html.includes('aria-label="Chi tiết văn bản Số đến 0028"'));
    assert.ok(!html.includes('aria-modal="true"') && !html.includes('role="dialog"'));
    assert.ok(html.includes('data-mode="pane"'));
  });

  test("overlay hẹp là dialog modal toàn màn hình", () => {
    const html = render("overlay");
    assert.ok(html.includes('role="dialog"') && html.includes('aria-modal="true"'));
    assert.ok(html.includes("fixed inset-0"));
  });

  test("dựng ngay tiêu đề, loại, số và trạng thái từ dòng danh sách trong lúc chi tiết còn tải", () => {
    const html = render("pane");
    assert.ok(html.includes("Về việc tổ chức hội nghị"));
    assert.ok(html.includes("Văn bản đến"));
    assert.ok(html.includes("Số đến 0028"));
    assert.ok(html.includes("Đang xử lý"));
  });

  test("header có Mở trang đầy đủ (liên kết thật), menu Thao tác khác và Đóng (SPEC §17.5A)", () => {
    const html = render("pane");
    // Không có ?file= trên URL thì giữ tệp đang xem mặc định (tệp đầu)
    assert.ok(html.includes('href="/documents/incoming/doc-1?file=a1"'));
    assert.ok(html.includes('aria-label="Mở trang đầy đủ"'));
    assert.ok(html.includes('aria-label="Thao tác khác"'));
    assert.ok(html.includes('aria-label="Đóng"'));
    // In phiếu nằm trong menu, không còn là nút icon dễ hiểu nhầm là in PDF
    assert.ok(!html.includes('aria-label="In phiếu văn bản"'));
  });

  test("liên kết trang đầy đủ giữ tệp đang xem theo ?file=", () => {
    const html = render("pane", { fileId: "a2" });
    assert.ok(html.includes('href="/documents/incoming/doc-1?file=a2"'));
  });

  test("xem chữ ký số không còn là nút riêng ở header (nằm trong menu Thao tác khác)", () => {
    assert.ok(!render("pane", { onViewSignature: () => {} }).includes('aria-label="Xem chữ ký số"'));
  });

  test("tiêu đề là h2 16/24px tối đa 2 dòng, focus được bằng chương trình; không còn popover Chi tiết", () => {
    const html = render("pane");
    const title = html.match(/<h2[^>]*data-slot="document-quick-title"[^>]*>/)?.[0] ?? "";
    assert.ok(title.includes('tabindex="-1"'));
    assert.ok(title.includes("text-base") && title.includes("leading-6") && title.includes("line-clamp-2"));
    assert.ok(!html.includes(">Chi tiết<"));
  });

  test("khi chi tiết còn tải, không dựng thao tác nào từ dòng danh sách (SPEC §17.5B)", () => {
    const html = render("pane");
    assert.ok(html.includes('aria-label="Đang tải thông tin xử lý"'));
    for (const action of ["Tạo nhiệm vụ", "Sửa thông tin", "Thêm tệp", "Chi tiết và luân chuyển"]) {
      assert.ok(!html.includes(`>${action}<`), `không có ${action}`);
    }
  });

  test("dòng tên tệp có nút Tệp N có nhãn và bám đầu vùng cuộn", () => {
    const html = render("pane");
    const header = html.match(/<div[^>]*data-slot="document-file-header"[^>]*>/)?.[0] ?? "";
    assert.ok(header.includes("sticky") && header.includes("h-8"));
    assert.ok(html.includes('aria-label="Tệp 2"'));
  });

  test("không có danh sách tệp riêng (trùng nút Tệp N); 1 tệp thì không có nút Tệp N", () => {
    assert.ok(!render("pane").includes('data-slot="attached-files"'));
    const single = renderToStaticMarkup(
      React.createElement(DocumentQuickView, { docId: "doc-1", fileId: null, seed: { ...seed, attachments: [seed.attachments![0]] }, mode: "pane", onClose: () => {}, onFileChange: () => {} }),
    );
    assert.ok(!single.includes('aria-label="Tệp 1"'));
  });

  test("thuộc tính chính là lưới có nhãn: trạng thái, hạn, số ký hiệu, ban hành, cơ quan; 2 cột khi pane rộng", () => {
    const html = render("pane");
    const grid = html.match(/<div[^>]*data-slot="quick-properties"[^>]*>/)?.[0] ?? "";
    assert.ok(grid.includes("@[560px]/doc:grid-cols-2"));
    for (const label of ["Trạng thái", "Số, ký hiệu", "Ban hành", "Cơ quan ban hành"]) assert.ok(html.includes(`>${label}<`), label);
    assert.ok(html.includes(">123/BLĐ<"));
    // header: số đến không dùng font mono cho cả cụm chữ
    assert.ok(!/class="font-mono"> · Số đến/.test(html));
  });

  test("chưa có seed thì hiện trạng thái đang tải, không dựng nhầm nội dung", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentQuickView, { docId: "doc-2", fileId: null, seed: null, mode: "pane", onClose: () => {}, onFileChange: () => {} }),
    );
    assert.ok(html.includes("Đang tải chi tiết văn bản"));
    assert.ok(!html.includes("Về việc tổ chức hội nghị"));
  });

  test("seed của văn bản khác không được dùng làm nội dung", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentQuickView, { docId: "doc-9", fileId: null, seed, mode: "pane", onClose: () => {}, onFileChange: () => {} }),
    );
    assert.ok(!html.includes("Về việc tổ chức hội nghị"));
  });
});

describe("Tệp không xem trước được (Quick View)", () => {
  const files = [
    { id: "goc", name: "Bảng tổng hợp.xlsx", url: "/api/files/goc.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    { id: "scan", name: "ban-scan.pdf", url: "/api/files/scan.pdf", mimeType: "application/pdf" },
  ];
  const renderViewer = (activeFileId: string | null) =>
    renderToStaticMarkup(React.createElement(DocumentFileViewer, { files, activeFileId, stickyHeader: true }));

  test("nêu định dạng, có Tải về và thao tác chuyển tệp; không dựng rail công cụ xem", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentPdfViewer, {
        fileUrl: files[0].url,
        fileName: files[0].name,
        mimeType: files[0].mimeType,
        unsupportedAction: React.createElement("button", null, "Xem ban-scan.pdf"),
      }),
    );
    assert.ok(html.includes('data-slot="file-unsupported"'));
    assert.ok(html.includes("Tệp Excel (.xlsx) chưa xem trước được trong trình duyệt"));
    assert.ok(html.includes("Tải về"));
    assert.ok(html.includes("Xem ban-scan.pdf"));
    assert.ok(!html.includes('data-slot="document-viewer-rail"'));
  });

  test("tệp Word .docx dựng bằng trình xem Word (không còn báo chưa xem trước được)", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentPdfViewer, {
        fileUrl: "/api/files/ke-hoach.docx",
        fileName: "Kế hoạch năm học.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
    assert.ok(!html.includes('data-slot="file-unsupported"'));
    assert.ok(html.includes('aria-label="Phóng to"'), "có thu phóng");
    assert.ok(!html.includes("Tìm trong tệp"), "không có tìm kiếm như PDF");
  });

  test("không chọn tệp: mở bản PDF thay vì bản .xlsx không xem được", () => {
    const html = renderViewer(null);
    assert.ok(!html.includes('data-slot="file-unsupported"'));
    assert.ok(html.includes('data-active-file-id="scan"'));
  });
});
