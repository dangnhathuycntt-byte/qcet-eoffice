import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentQuickView } from "../src/components/documents/workspace/document-quick-view";
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

  test("có nút Mở trang đầy đủ (liên kết thật), In và Đóng", () => {
    const html = render("pane");
    // Không có ?file= trên URL thì giữ tệp đang xem mặc định (tệp đầu)
    assert.ok(html.includes('href="/documents/incoming/doc-1?file=a1"'));
    assert.ok(html.includes('aria-label="Mở trang đầy đủ"'));
    assert.ok(html.includes('aria-label="In phiếu văn bản"'));
    assert.ok(html.includes('aria-label="Đóng"'));
  });

  test("liên kết trang đầy đủ giữ tệp đang xem theo ?file=", () => {
    const html = render("pane", { fileId: "a2" });
    assert.ok(html.includes('href="/documents/incoming/doc-1?file=a2"'));
  });

  test("nút xem chữ ký số chỉ hiện khi văn bản đã ký và có xử lý", () => {
    assert.ok(!render("pane").includes("Xem chữ ký số"));
    assert.ok(render("pane", { onViewSignature: () => {} }).includes('aria-label="Xem chữ ký số"'));
  });

  test("danh sách tệp đính kèm có khi ≥ 2 tệp, bị bỏ khi chỉ có 1", () => {
    assert.ok(render("pane").includes('data-slot="attached-files"'));
    const single = renderToStaticMarkup(
      React.createElement(DocumentQuickView, { docId: "doc-1", fileId: null, seed: { ...seed, attachments: [seed.attachments![0]] }, mode: "pane", onClose: () => {}, onFileChange: () => {} }),
    );
    assert.ok(!single.includes("Tệp đính kèm"));
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
