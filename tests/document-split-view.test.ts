import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentSplitView } from "../src/components/documents/document-split-view";
import { DocumentPdfViewer } from "../src/components/documents/document-pdf-viewer";
import DocumentsPage, { metadata } from "@/app/documents/page";
import type { DocumentItem } from "../src/types/document";

describe("Document Split-View UI Component", () => {
  const sampleIncomingDoc: DocumentItem = {
    id: "doc-1",
    type: "VAN_BAN_DEN",
    registrationNumber: 28,
    documentYear: 2026,
    registeredDate: "2026-09-07T08:00:00Z",
    originalNumber: "123/LĐTBXH",
    issuedDate: "2026-09-04T00:00:00Z",
    issuingAuthority: "Bộ Lao động - Thương binh và Xã hội",
    category: "Quyết định",
    summary: "Ban hành danh mục ngành nghề đào tạo trọng điểm",
    urgency: "THUONG_KHAN",
    securityLevel: "THUONG",
    status: "CHO_PHAN_CONG",
    registeredById: "vt-1",
    registeredByName: "Văn thư Nguyễn Văn An",
    dueDate: "2026-09-15T17:00:00Z",
    leadUnitId: "p-qldt",
    leadUnitName: "Phòng Đào tạo",
    attachments: [
      {
        id: "att-1",
        documentId: "doc-1",
        fileName: "123_LDTBXH_Signed.pdf",
        fileUrl: "/mock-files/123_LDTBXH.pdf",
        fileSize: 1024000,
        mimeType: "application/pdf",
        isOriginal: true,
      },
      {
        id: "att-2",
        documentId: "doc-1",
        fileName: "PhuLuc_KemTheo.pdf",
        fileUrl: "/mock-files/PhuLuc_KemTheo.pdf",
        fileSize: 512000,
        mimeType: "application/pdf",
        isOriginal: false,
      },
    ],
    directives: [
      {
        id: "dir-1",
        documentId: "doc-1",
        leaderId: "ld-1",
        leaderName: "TS. Lê Doãn Cường",
        instruction: "Giao Phòng Đào tạo chủ trì, rà soát chương trình đào tạo trọng điểm",
        deadline: "2026-09-12T17:00:00Z",
        leadUnitId: "p-qldt",
        leadUnitName: "Phòng Đào tạo",
        isTaskGenerated: true,
      },
    ],
  };

  const sampleOutgoingDoc: DocumentItem = {
    id: "doc-2",
    type: "VAN_BAN_DI",
    registrationNumber: 154,
    documentYear: 2026,
    registeredDate: "2026-09-07T09:00:00Z",
    originalNumber: "154/CĐKTCN-ĐT",
    issuedDate: "2026-09-07T00:00:00Z",
    issuingAuthority: "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
    category: "Công văn",
    summary: "V/v Triển khai công tác tuyển sinh và đào tạo năm học 2026 - 2027",
    urgency: "HOA_TOC",
    securityLevel: "MAT",
    status: "DA_HOAN_THANH",
    registeredById: "vt-2",
    signerName: "ThS. Đặng Văn Thông",
    signerTitle: "Phó Hiệu trưởng",
    leadUnitName: "Phòng Tuyển sinh & Hướng nghiệp",
    recipientList: "Các phòng, khoa, trung tâm thuộc trường",
    distributedCopies: 25,
    attachments: [],
  };

  test("renders both PDF preview area and document metadata area in split layout", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentSplitView, { document: sampleIncomingDoc })
    );

    assert.ok(html.includes("123/LĐTBXH"), "Must render original number");
    assert.ok(html.includes("Bộ Lao động - Thương binh và Xã hội"), "Must render issuing authority");
    assert.ok(html.includes("123_LDTBXH_Signed.pdf"), "Must render attachment filename");
    assert.ok(html.includes("grid") || html.includes("flex"), "Must use responsive split layout");
  });

  test("renders ND 30/2020/ND-CP legal fields: registration number, year, category, urgency and status badges", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentSplitView, { document: sampleIncomingDoc })
    );

    assert.ok(html.includes("28") || html.includes("#28"), "Must show registration number");
    assert.ok(html.includes("Quyết định"), "Must show category");
    assert.ok(html.includes("Thượng khẩn") || html.includes("THUONG_KHAN"), "Must show urgency badge");
    assert.ok(html.includes("Chờ phân công") || html.includes("CHO_PHAN_CONG"), "Must show status badge");
    assert.ok(html.includes("Phòng Đào tạo"), "Must show lead department");
  });

  test("renders leadership directives history and linked task indicator", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentSplitView, { document: sampleIncomingDoc })
    );

    assert.ok(html.includes("TS. Lê Doãn Cường"), "Must show leader name");
    assert.ok(html.includes("Giao Phòng Đào tạo chủ trì"), "Must show directive instruction");
    assert.ok(html.includes("Nhiệm vụ") || html.includes("Task"), "Must indicate task generation status");
  });

  test("renders multiple attachments selector when document has several attachments", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentSplitView, { document: sampleIncomingDoc })
    );

    assert.ok(html.includes("123_LDTBXH_Signed.pdf"), "Must render primary attachment");
    assert.ok(html.includes("PhuLuc_KemTheo.pdf"), "Must render secondary attachment");
  });

  test("renders outgoing document specific fields (signer, drafting department, recipients)", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentSplitView, { document: sampleOutgoingDoc })
    );

    assert.ok(html.includes("154/CĐKTCN-ĐT"), "Must show outgoing document number");
    assert.ok(html.includes("ThS. Đặng Văn Thông"), "Must show signer name");
    assert.ok(html.includes("Phó Hiệu trưởng"), "Must show signer title");
    assert.ok(
      html.includes("Phòng Tuyển sinh") && html.includes("Hướng nghiệp"),
      "Must show drafting department"
    );
    assert.ok(html.includes("Hỏa tốc") || html.includes("HOA_TOC"), "Must show urgency");
    assert.ok(html.includes("Mật") || html.includes("MAT"), "Must show security level");
  });

  test("renders empty state when document has no attachments", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentSplitView, { document: sampleOutgoingDoc })
    );

    assert.ok(
      html.includes("Không có tệp") ||
      html.includes("Chưa có bản scan") ||
      html.includes("Chưa đính kèm"),
      "Must show empty attachment state"
    );
  });
});

describe("DocumentPdfViewer Component", () => {
  test("renders iframe/object preview with fileUrl and toolbar controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentPdfViewer, {
        fileUrl: "/mock-files/123_LDTBXH.pdf",
        fileName: "123_LDTBXH.pdf",
        fileSize: 1024000,
      })
    );

    assert.ok(html.includes("/mock-files/123_LDTBXH.pdf"), "Must include fileUrl in preview");
    assert.ok(html.includes("123_LDTBXH.pdf"), "Must include fileName");
    assert.ok(html.includes("iframe") || html.includes("object") || html.includes("embed"), "Must use iframe/object/embed element");
    assert.ok(html.includes("Tải về") || html.includes("Download") || html.includes("download"), "Must include download action");
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

  test("DocumentsPage component is a valid callable function returning JSX", () => {
    assert.strictEqual(typeof DocumentsPage, "function");
    const element = DocumentsPage();
    assert.ok(element, "DocumentsPage must return JSX element");
  });
});
