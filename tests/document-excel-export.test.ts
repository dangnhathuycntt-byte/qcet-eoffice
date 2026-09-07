import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import {
  getAppendixIVHeaders,
  formatDocumentRowForAppendixIV,
  generateAppendixIVCsv,
} from "../src/lib/documents/excel-export";
import { GET as exportExcelRoute } from "../src/app/api/documents/export-excel/route";
import type { DocumentItem } from "../src/types/document";

describe("Appendix IV (ND 30/2020) Excel Exporter", () => {
  test("returns 9 mandatory columns for incoming document registry (Sổ đến)", () => {
    const headers = getAppendixIVHeaders("VAN_BAN_DEN");
    assert.equal(headers.length, 9);
    assert.equal(headers[0], "Ngày đến");
    assert.equal(headers[1], "Số đến");
    assert.equal(headers[2], "Tác giả");
    assert.equal(headers[3], "Số và ký hiệu văn bản đến");
    assert.equal(headers[4], "Ngày tháng văn bản");
    assert.equal(headers[5], "Tên loại và trích yếu nội dung văn bản");
    assert.equal(headers[6], "Đơn vị hoặc người nhận");
    assert.equal(headers[7], "Ký nhận");
    assert.equal(headers[8], "Ghi chú");
  });

  test("returns 10 mandatory columns for outgoing document registry (Sổ đi)", () => {
    const headers = getAppendixIVHeaders("VAN_BAN_DI");
    assert.equal(headers.length, 10);
    assert.equal(headers[0], "Số và ký hiệu");
    assert.equal(headers[1], "Ngày tháng văn bản");
    assert.equal(headers[2], "Tên loại và trích yếu nội dung văn bản");
    assert.equal(headers[3], "Người ký");
    assert.equal(headers[4], "Đơn vị soạn thảo");
    assert.equal(headers[5], "Nơi nhận");
    assert.equal(headers[6], "Số lượng bản");
    assert.equal(headers[7], "Đơn vị hoặc người nhận bản lưu");
    assert.equal(headers[8], "Ký nhận");
    assert.equal(headers[9], "Ghi chú");
  });

  test("formats incoming document row accurately", () => {
    const doc: DocumentItem = {
      id: "doc-1",
      type: "VAN_BAN_DEN",
      registrationNumber: 15,
      documentYear: 2026,
      registeredDate: "2026-09-07T08:00:00Z",
      originalNumber: "12/UBND",
      issuedDate: "2026-09-05T00:00:00Z",
      issuingAuthority: "UBND Tỉnh Bình Định",
      category: "Công văn",
      summary: "Triển khai nhiệm vụ an toàn mạng",
      urgency: "THUONG",
      securityLevel: "THUONG",
      leadDepartmentName: "Khoa CNTT",
      status: "DANG_XU_LY",
      registeredById: "u1",
    };

    const row = formatDocumentRowForAppendixIV(doc);
    assert.equal(row[0], "07/09/2026"); // Ngày đến
    assert.equal(row[1], 15);           // Số đến
    assert.equal(row[2], "UBND Tỉnh Bình Định"); // Tác giả
    assert.equal(row[3], "12/UBND");    // Số và ký hiệu
    assert.equal(row[4], "05/09/2026"); // Ngày tháng văn bản
    assert.equal(row[5], "Công văn: Triển khai nhiệm vụ an toàn mạng");
    assert.equal(row[6], "Khoa CNTT");  // Đơn vị nhận
    assert.equal(row[7], "");           // Ký nhận
    assert.equal(row[8], "");           // Ghi chú
  });

  test("formats outgoing document row accurately", () => {
    const doc: DocumentItem = {
      id: "doc-2",
      type: "VAN_BAN_DI",
      registrationNumber: 42,
      documentYear: 2026,
      registeredDate: "2026-09-07T09:00:00Z",
      originalNumber: "42/TB-CĐKTCN",
      issuedDate: "2026-09-06T00:00:00Z",
      issuingAuthority: "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
      category: "Thông báo",
      summary: "Thông báo lịch nghỉ lễ Quốc khánh",
      urgency: "THUONG",
      securityLevel: "THUONG",
      status: "DA_HOAN_THANH",
      signerName: "TS. Nguyễn Văn A - Hiệu trưởng",
      draftingDeptName: "Phòng Đào tạo",
      recipientList: "Toàn thể CB, GV, NV",
      distributedCopies: 3,
      notes: "Đã gửi qua email trường",
      registeredById: "u1",
    };

    const row = formatDocumentRowForAppendixIV(doc);
    assert.equal(row[0], "42/TB-CĐKTCN"); // Số và ký hiệu
    assert.equal(row[1], "06/09/2026");   // Ngày tháng văn bản
    assert.equal(row[2], "Thông báo: Thông báo lịch nghỉ lễ Quốc khánh");
    assert.equal(row[3], "TS. Nguyễn Văn A - Hiệu trưởng"); // Người ký
    assert.equal(row[4], "Phòng Đào tạo"); // Đơn vị soạn thảo
    assert.equal(row[5], "Toàn thể CB, GV, NV"); // Nơi nhận
    assert.equal(row[6], 3); // Số lượng bản
    assert.equal(row[7], "Văn thư trường"); // Đơn vị hoặc người nhận bản lưu
    assert.equal(row[8], ""); // Ký nhận
    assert.equal(row[9], "Đã gửi qua email trường"); // Ghi chú
  });

  test("generateAppendixIVCsv prepends UTF-8 BOM and escapes commas/quotes/newlines", () => {
    const docWithSpecialChars: DocumentItem = {
      id: "doc-3",
      type: "VAN_BAN_DEN",
      registrationNumber: 1,
      documentYear: 2026,
      registeredDate: "2026-01-10T08:00:00Z",
      originalNumber: "99/QD-UBND",
      issuedDate: "2026-01-08T00:00:00Z",
      issuingAuthority: "UBND, Tỉnh Bình Định", // Has comma
      category: "Quyết định",
      summary: 'Phê duyệt kế hoạch "Nâng cao chất lượng đào tạo, nghề"\nNăm học 2026', // Quotes and newline
      urgency: "THUONG",
      securityLevel: "THUONG",
      leadDepartmentName: "Khoa Cơ khí",
      status: "CHO_PHAN_CONG",
      registeredById: "u1",
    };

    const csv = generateAppendixIVCsv("VAN_BAN_DEN", 2026, [docWithSpecialChars]);

    // Check UTF-8 BOM
    assert.ok(csv.startsWith("﻿"), "CSV must begin with UTF-8 BOM for Excel compatibility");

    // Check header line is present
    assert.ok(csv.includes("Ngày đến,Số đến,Tác giả,Số và ký hiệu văn bản đến"));

    // Check escaping:
    // Comma in issuingAuthority escaped by quotes
    assert.ok(csv.includes('"UBND, Tỉnh Bình Định"'));
    // Quotes inside summary doubled: ""Nâng cao chất lượng đào tạo, nghề""
    assert.ok(csv.includes('""Nâng cao chất lượng đào tạo, nghề""'));
  });
});

describe("GET /api/documents/export-excel Route Integration", () => {
  let testDocId: string;

  before(async () => {
    const user = await prisma.user.findFirst();
    assert.ok(user, "User must exist");
    const dept = await prisma.department.findFirst();

    // Create a sample incoming document for 2026 export test
    const created = await prisma.document.create({
      data: {
        type: "VAN_BAN_DEN",
        registrationNumber: 9999,
        documentYear: 2026,
        registeredDate: new Date("2026-09-07T08:00:00Z"),
        originalNumber: "TEST-9999/UBND",
        issuedDate: new Date("2026-09-05T00:00:00Z"),
        issuingAuthority: "UBND Tỉnh Bình Định",
        category: "Công văn",
        summary: "Văn bản thử nghiệm xuất sổ Excel Phụ lục IV",
        urgency: "THUONG",
        securityLevel: "THUONG",
        leadDepartmentId: dept?.id || null,
        status: "CHO_PHAN_CONG",
        registeredById: user.id,
      },
    });
    testDocId = created.id;
  });

  after(async () => {
    if (testDocId) {
      await prisma.document.delete({ where: { id: testDocId } }).catch(() => {});
    }
  });

  test("exports incoming document registry as CSV with proper headers and content", async () => {
    const req = new NextRequest("http://localhost:3000/api/documents/export-excel?type=VAN_BAN_DEN&year=2026");
    const res = await exportExcelRoute(req);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "text/csv; charset=utf-8");
    const disposition = res.headers.get("content-disposition");
    assert.ok(disposition?.includes("attachment"), "Must have attachment disposition");
    assert.ok(disposition?.includes("so-van-ban-den-2026.csv"), "Filename must reflect type and year");

    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf[0], 0xef, "First byte must be 0xEF for UTF-8 BOM");
    assert.equal(buf[1], 0xbb, "Second byte must be 0xBB for UTF-8 BOM");
    assert.equal(buf[2], 0xbf, "Third byte must be 0xBF for UTF-8 BOM");

    const text = buf.toString("utf-8");
    assert.ok(text.startsWith("﻿"), "Response body must start with UTF-8 BOM");
    assert.ok(text.includes("Ngày đến"));
    assert.ok(text.includes("TEST-9999/UBND"));
  });

  test("exports outgoing document registry as CSV with proper headers", async () => {
    const req = new NextRequest("http://localhost:3000/api/documents/export-excel?type=VAN_BAN_DI&year=2026");
    const res = await exportExcelRoute(req);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "text/csv; charset=utf-8");
    const disposition = res.headers.get("content-disposition");
    assert.ok(disposition?.includes("attachment"));
    assert.ok(disposition?.includes("so-van-ban-di-2026.csv"));

    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf[0], 0xef);
    assert.equal(buf[1], 0xbb);
    assert.equal(buf[2], 0xbf);

    const text = buf.toString("utf-8");
    assert.ok(text.startsWith("﻿"));
    assert.ok(text.includes("Số và ký hiệu"));
    assert.ok(text.includes("Người ký"));
  });

  test("rejects invalid document type", async () => {
    const req = new NextRequest("http://localhost:3000/api/documents/export-excel?type=INVALID_TYPE");
    const res = await exportExcelRoute(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
  });
});
