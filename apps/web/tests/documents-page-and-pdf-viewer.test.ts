import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentPdfViewer } from "../src/components/documents/document-pdf-viewer";
import DocumentsPage, { metadata } from "@/app/documents/page";

describe("DocumentPdfViewer Component", () => {
  test("PDF dựng bằng canvas phía client (không iframe), có rail công cụ với tên tệp và nút tải về", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentPdfViewer, {
        fileUrl: "/mock-files/123_LDTBXH.pdf",
        fileName: "123_LDTBXH.pdf",
      })
    );

    // "Mở tab mới" và "Tải về" gộp trong menu của nút Tải về (D11): liên kết chỉ có khi menu mở
    assert.ok(html.includes('aria-label="Công cụ xem 123_LDTBXH.pdf"'), "Rail công cụ mang tên tệp");
    // pdf.js chỉ chạy ở trình duyệt: SSR chỉ có trạng thái đang tải, không nhúng iframe/object (X-Frame-Options: DENY)
    assert.ok(!/<(iframe|object|embed)\b/.test(html), "Không nhúng PDF bằng iframe/object/embed");
    assert.ok(html.includes("Đang tải trình xem tệp"), "Hiện trạng thái đang tải trình xem");
    assert.ok(html.includes('aria-label="Tải về"'), "Có nút tải về trên rail");
  });

  test("renders empty state when fileUrl is absent", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentPdfViewer, {
        fileUrl: null,
      })
    );

    assert.ok(
      html.includes("Không có tệp") ||
      html.includes("Chưa có bản scan") ||
      html.includes("Chưa có tệp PDF"),
      "Must render clean empty state message"
    );
  });
});

describe("Documents Landing Page (/documents)", () => {
  test("Metadata title and description match QCET specification", () => {
    assert.ok(metadata, "Metadata must be exported from page");
    assert.ok(
      typeof metadata.title === "string" && metadata.title.includes("Văn bản & Quản lý Công văn"),
      "Page title must include 'Văn bản & Quản lý Công văn'"
    );
    assert.ok(
      typeof metadata.description === "string" && metadata.description.length > 0,
      "Page description must be non-empty"
    );
  });

  test("DocumentsPage component is a valid callable function", async () => {
    assert.strictEqual(typeof DocumentsPage, "function");
    // DocumentsPage is an async Server Component with server-side auth guard (cookies/headers)
    try {
      await DocumentsPage();
    } catch (err: any) {
      // Expected NEXT_REDIRECT or request-scope error when invoked outside Next.js server context
      assert.ok(
        err?.message?.includes("NEXT_REDIRECT") ||
        err?.message?.includes("request scope") ||
        err?.message?.includes("cookies") ||
        err?.digest?.startsWith("NEXT_REDIRECT"),
        "Server component enforces request-scope security"
      );
    }
  });
});
