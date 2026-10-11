import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  mapDirectiveToSchoolTask,
  mapUrgencyToTaskPriority,
  executeDirectivePipeline,
  parseCollaboratorIds
} from "../src/lib/documents/directive-pipeline";
import { DocumentQuickEntryModal } from "../src/components/documents/document-quick-entry-modal";
import type { DocumentItem, DocumentDirectiveItem } from "../src/types/document";

describe("Document-to-Task Directive Pipeline", () => {
  const sampleDoc: DocumentItem = {
    id: "doc-101",
    type: "VAN_BAN_DEN",
    registrationNumber: 42,
    documentYear: 2026,
    registeredDate: "2026-09-07T08:30:00Z",
    originalNumber: "389/UBND-VX",
    issuedDate: "2026-09-06T00:00:00Z",
    issuingAuthority: "UBND Tỉnh Bình Định",
    category: "Công văn",
    summary: "V/v tăng cường đảm bảo an toàn thông tin và chuyển đổi số quý 4/2026",
    urgency: "HOA_TOC",
    securityLevel: "THUONG",
    status: "CHO_PHAN_CONG",
    registeredById: "vt-01"
  };

  const sampleDirective: DocumentDirectiveItem = {
    id: "dir-01",
    documentId: "doc-101",
    leaderId: "ht-01",
    leaderName: "TS. Lê Hải Đăng (Hiệu trưởng)",
    instruction: "Giao Khoa CNTT chủ trì, phối hợp Phòng Đào tạo rà soát toàn bộ hệ thống trước ngày 15/09",
    deadline: "2026-09-15T17:00:00Z",
    leadUnitId: "k-cntt",
    leadUnitName: "Khoa Công nghệ Thông tin",
    collaboratorIds: JSON.stringify(["DT"]),
    isTaskGenerated: false
  };

  test("correctly maps urgency to task priority", () => {
    assert.equal(mapUrgencyToTaskPriority("HOA_TOC"), "URGENT");
    assert.equal(mapUrgencyToTaskPriority("THUONG_KHAN"), "HIGH");
    assert.equal(mapUrgencyToTaskPriority("KHAN"), "HIGH");
    assert.equal(mapUrgencyToTaskPriority("THUONG"), "NORMAL");
    // Also test backward-compatible lowercase string variants
    assert.equal(mapUrgencyToTaskPriority("flash"), "URGENT");
    assert.equal(mapUrgencyToTaskPriority("top_urgent"), "HIGH");
    assert.equal(mapUrgencyToTaskPriority("urgent"), "HIGH");
    assert.equal(mapUrgencyToTaskPriority("normal"), "NORMAL");
  });

  test("generates valid SchoolTask payload with accurate metadata and backlink", () => {
    const taskPayload = mapDirectiveToSchoolTask(sampleDoc, sampleDirective);

    assert.ok(
      taskPayload.title.includes("[Xử lý VB Đến #42 - 389/UBND-VX]"),
      "Task title must format registrationNumber and originalNumber"
    );
    assert.equal(taskPayload.scope, "SCHOOL");
    assert.equal(taskPayload.leadUnitId, "k-cntt");
    assert.deepEqual(taskPayload.collaboratorDepartmentIds, ["DT"]);
    assert.equal(taskPayload.priority, "URGENT");
    assert.equal(taskPayload.dueDate, "2026-09-15T17:00:00Z");
    assert.ok(taskPayload.description.includes("TS. Lê Hải Đăng (Hiệu trưởng)"));
    assert.ok(taskPayload.description.includes("Giao Khoa CNTT chủ trì"));
    assert.ok(taskPayload.description.includes("ĐƠN VỊ PHỐI HỢP: DT"));
    assert.equal(taskPayload.sourceDocumentId, "doc-101");
    assert.equal(taskPayload.metadata.originalNumber, "389/UBND-VX");
    assert.equal(taskPayload.metadata.issuingAuthority, "UBND Tỉnh Bình Định");
    assert.deepEqual(taskPayload.metadata.collaboratorIds, ["DT"]);
  });

  test("falls back to standard title when registrationNumber is not provided", () => {
    const docWithoutRegNum = { ...sampleDoc, registrationNumber: undefined as any };
    const taskPayload = mapDirectiveToSchoolTask(docWithoutRegNum, sampleDirective);

    assert.ok(
      taskPayload.title.startsWith("[Xử lý VB 389/UBND-VX]"),
      "Fallback title should be used when registrationNumber is absent"
    );
  });

  test("correctly parses collaboratorIds in JSON array and comma-separated formats", () => {
    assert.deepEqual(parseCollaboratorIds(JSON.stringify(["DT", "KHTV"])), ["DT", "KHTV"]);
    assert.deepEqual(parseCollaboratorIds("DT, KHTV, TCHC"), ["DT", "KHTV", "TCHC"]);
    assert.deepEqual(parseCollaboratorIds(""), []);
    assert.deepEqual(parseCollaboratorIds(null), []);

    const directiveWithComma = {
      ...sampleDirective,
      collaboratorIds: "DT, KHTV"
    };
    const task = mapDirectiveToSchoolTask(sampleDoc, directiveWithComma);
    assert.deepEqual(task.collaboratorDepartmentIds, ["DT", "KHTV"]);
    assert.ok(task.description.includes("ĐƠN VỊ PHỐI HỢP: DT, KHTV"));
  });

  test("executes pipeline and marks directive as task-generated with backlink", async () => {
    const createdTasks: any[] = [];
    const mockTaskCreator = async (payload: any) => {
      const created = { id: "task-auto-99", ...payload };
      createdTasks.push(created);
      return created;
    };

    const result = await executeDirectivePipeline(sampleDoc, sampleDirective, mockTaskCreator);

    assert.equal(createdTasks.length, 1);
    assert.equal(result.task.id, "task-auto-99");
    assert.equal(result.directive.isTaskGenerated, true);
    assert.equal(result.document.status, "DANG_XU_LY");
    assert.equal(result.document.linkedTaskId, "task-auto-99");
  });
});

describe("Quick Directive Presets for Leadership", () => {

  test("DocumentQuickEntryModal returns null when isOpen is false", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentQuickEntryModal, {
        isOpen: false,
        onClose: () => {},
      })
    );
    assert.equal(html, "");
  });

  test("DocumentQuickEntryModal mounts Base UI StandardDialog successfully", () => {
    assert.equal(typeof DocumentQuickEntryModal, "function");
    const el = React.createElement(DocumentQuickEntryModal, {
      isOpen: true,
      onClose: () => {},
      departments: [
        { id: "DT", name: "Phòng Đào tạo" },
        { id: "TCHC", name: "Phòng Tổ chức - Hành chính" },
      ],
    });
    assert.ok(React.isValidElement(el));
  });
});

describe("T52 & T53: Directive-to-Task Pipeline & Statutory Presets", () => {
  const dummyDoc: DocumentItem = {
    id: "doc-test-1",
    type: "VAN_BAN_DEN",
    documentYear: 2026,
    originalNumber: "123/UBND",
    registrationNumber: 42,
    registeredDate: "2026-09-02T08:00:00.000Z",
    registeredById: "user-1",
    issuedDate: "2026-09-01T00:00:00.000Z",
    issuingAuthority: "UBND Tỉnh Bình Định",
    category: "Công văn",
    summary: "Triển khai đào tạo nghề chất lượng cao",
    urgency: "HOA_TOC",
    securityLevel: "THUONG",
    status: "CHO_PHAN_CONG",
  };

  const dummyDirective: DocumentDirectiveItem = {
    id: "dir-test-1",
    documentId: "doc-test-1",
    leaderId: "leader-1",
    leaderName: "TS. Nguyễn Văn Hiệu",
    instruction: "Giao P. Đào tạo chủ trì",
    leadUnitId: "p-qldt",
    deadline: "2026-09-15T00:00:00.000Z",
    isTaskGenerated: false,
  };

  test("mapDirectiveToSchoolTask produces valid SchoolTask payload with accurate metadata", () => {
    const payload = mapDirectiveToSchoolTask(dummyDoc, dummyDirective);

    assert.strictEqual(payload.scope, "SCHOOL");
    assert.strictEqual(payload.leadUnitId, "p-qldt");
    assert.strictEqual(payload.priority, "URGENT"); // HOA_TOC -> URGENT
    assert.strictEqual(payload.sourceDocumentId, "doc-test-1");
    assert.strictEqual(payload.metadata.originalNumber, "123/UBND");
    assert.strictEqual(payload.metadata.directiveInstruction, "Giao P. Đào tạo chủ trì");
    assert.ok(payload.title.includes("VB Đến #42"));
    assert.ok(payload.description.includes("UBND Tỉnh Bình Định"));
  });
});
