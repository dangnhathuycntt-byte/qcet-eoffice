import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatDocumentDisplayNumber, generateDocumentCode } from "../src/lib/documents/numbering-engine";
import {
  mapDirectiveToSchoolTask,
  executeDirectivePipeline,
  mapUrgencyToTaskPriority,
  parseCollaboratorIds,
} from "../src/lib/documents/directive-pipeline";
import {
  formatDocumentRowForAppendixIV,
  getAppendixIVHeaders,
  generateAppendixIVCsv,
} from "../src/lib/documents/excel-export";
import type { DocumentItem, DocumentDirectiveItem } from "../src/types/document";

describe("E2E Document Lifecycle: Entry -> Endorsement -> Task -> Export", () => {
  test("runs complete cycle without data loss or integrity violation", () => {
    // 1. Vào sổ văn bản đến (Decree 30/2020/ND-CP Appendix IV standard)
    const doc: DocumentItem = {
      id: "doc-e2e-01",
      type: "VAN_BAN_DEN",
      registrationNumber: 105,
      documentYear: 2026,
      registeredDate: "2026-09-07T09:00:00Z",
      originalNumber: "789/SGDĐT",
      issuedDate: "2026-09-06T00:00:00Z",
      issuingAuthority: "Sở Giáo dục và Đào tạo",
      category: "Kế hoạch",
      summary: "Kế hoạch tổ chức thi đua dạy tốt học tốt chào mừng năm học mới",
      urgency: "KHAN",
      securityLevel: "THUONG",
      status: "CHO_PHAN_CONG",
      registeredById: "vt-01",
    };

    // Verify registration display number formatting
    assert.equal(formatDocumentDisplayNumber(doc.type, doc.registrationNumber, doc.documentYear), "105");
    assert.equal(generateDocumentCode(doc.type, doc.documentYear, doc.registrationNumber), "VBDEN-2026-0105");

    // 2. BGH bút phê chỉ đạo
    const directive: DocumentDirectiveItem = {
      id: "dir-e2e-01",
      documentId: doc.id,
      leaderId: "bgh-01",
      leaderName: "Phó Hiệu trưởng phụ trách Đào tạo",
      instruction: "Giao Khoa Cơ khí xây dựng kế hoạch chi tiết tham gia trước 20/09",
      deadline: "2026-09-20T17:00:00Z",
      assignedDeptId: "CK",
      assignedDeptName: "Khoa Cơ Khí",
      collaboratorIds: "ĐT, TCKT",
      isTaskGenerated: true,
    };

    // 3. Đường ống sinh Task tự động (Directive Pipeline)
    const task = mapDirectiveToSchoolTask(doc, directive);
    assert.equal(task.departmentId, "CK");
    assert.equal(task.priority, "HIGH");
    assert.equal(task.dueDate, "2026-09-20T17:00:00Z");
    assert.equal(task.sourceDocumentId, "doc-e2e-01");
    assert.ok(task.title.includes("789/SGDĐT"));
    assert.ok(task.title.includes("105"));
    assert.deepEqual(task.collaboratorDepartmentIds, ["ĐT", "TCKT"]);
    assert.ok(task.description.includes("Phó Hiệu trưởng phụ trách Đào tạo"));
    assert.ok(task.description.includes("Giao Khoa Cơ khí"));

    // 4. Kết xuất dòng Excel phục vụ đóng sổ (Nghị định 30/2020/NĐ-CP Phụ lục IV)
    doc.leadDepartmentName = "Khoa Cơ Khí";
    doc.status = "DANG_XU_LY";
    const excelRow = formatDocumentRowForAppendixIV(doc);
    assert.equal(excelRow[0], "07/09/2026"); // Ngày đến
    assert.equal(excelRow[1], 105); // Số đến
    assert.equal(excelRow[2], "Sở Giáo dục và Đào tạo"); // Tác giả
    assert.equal(excelRow[3], "789/SGDĐT"); // Số ký hiệu
    assert.equal(excelRow[4], "06/09/2026"); // Ngày văn bản
    assert.equal(excelRow[5], "Kế hoạch: Kế hoạch tổ chức thi đua dạy tốt học tốt chào mừng năm học mới"); // Tên loại & trích yếu
    assert.equal(excelRow[6], "Khoa Cơ Khí"); // Đơn vị nhận
  });

  test("runs directive execution pipeline simulation with state mutation", async () => {
    const doc: DocumentItem = {
      id: "doc-e2e-02",
      type: "VAN_BAN_DEN",
      registrationNumber: 106,
      documentYear: 2026,
      registeredDate: "2026-09-07T10:00:00Z",
      originalNumber: "123/BLĐTBXH",
      issuedDate: "2026-09-05T00:00:00Z",
      issuingAuthority: "Bộ Lao động - Thương binh và Xã hội",
      category: "Quyết định",
      summary: "Quyết định phê duyệt danh mục thiết bị đào tạo trọng điểm",
      urgency: "HOA_TOC",
      securityLevel: "THUONG",
      status: "CHO_PHAN_CONG",
      registeredById: "vt-01",
    };

    const directive: DocumentDirectiveItem = {
      id: "dir-e2e-02",
      documentId: doc.id,
      leaderId: "bgh-02",
      leaderName: "Hiệu trưởng",
      instruction: "Khẩn trương rà soát danh mục thiết bị, báo cáo BGH trước 15/09",
      deadline: "2026-09-15T12:00:00Z",
      assignedDeptId: "QLCSVC",
      assignedDeptName: "Phòng Quản lý CSVC",
      isTaskGenerated: false,
    };

    const createdTasks: any[] = [];
    const result = await executeDirectivePipeline(doc, directive, async (payload) => {
      const created = { id: "task-from-doc-106", ...payload };
      createdTasks.push(created);
      return created;
    });

    assert.equal(createdTasks.length, 1);
    assert.equal(result.task.id, "task-from-doc-106");
    assert.equal(result.directive.isTaskGenerated, true);
    assert.equal(result.document.status, "DANG_XU_LY");
    assert.equal(result.document.linkedTaskId, "task-from-doc-106");
    assert.equal(result.task.priority, "URGENT");
  });

  test("validates Appendix IV CSV export integrity and headers compliance", () => {
    const headers = getAppendixIVHeaders("VAN_BAN_DEN");
    assert.equal(headers.length, 9);
    assert.equal(headers[0], "Ngày đến");
    assert.equal(headers[1], "Số đến");
    assert.equal(headers[6], "Đơn vị hoặc người nhận");

    const doc: DocumentItem = {
      id: "doc-csv-01",
      type: "VAN_BAN_DEN",
      registrationNumber: 1,
      documentYear: 2026,
      registeredDate: "2026-01-05T08:00:00Z",
      originalNumber: "01/UBND",
      issuedDate: "2026-01-02T00:00:00Z",
      issuingAuthority: "Ủy ban Nhân dân tỉnh Bình Định",
      category: "Chỉ thị",
      summary: 'V/v tăng cường kỷ cương hành chính, "đổi mới sáng tạo" trong công tác đào tạo',
      urgency: "THUONG",
      securityLevel: "THUONG",
      status: "DA_HOAN_THANH",
      leadDepartmentName: "Phòng TC-HC",
      registeredById: "vt-01",
    };

    const csvContent = generateAppendixIVCsv("VAN_BAN_DEN", 2026, [doc]);
    // Ensure UTF-8 BOM is present
    assert.ok(csvContent.startsWith("﻿"));
    // Ensure double-quote escaping works properly for commas and quotes in summary
    assert.ok(csvContent.includes('""đổi mới sáng tạo""'));
    assert.ok(csvContent.includes("Phòng TC-HC"));
  });
});
