import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  mapDirectiveToSchoolTask,
  mapUrgencyToTaskPriority,
  executeDirectivePipeline
} from "../src/lib/documents/directive-pipeline";
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
    assignedDeptId: "CNTT",
    assignedDeptName: "Khoa Công Nghệ Thông Tin",
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

    assert.ok(taskPayload.title.includes("389/UBND-VX"), "Task title must include original number");
    assert.equal(taskPayload.scope, "SCHOOL");
    assert.equal(taskPayload.departmentId, "CNTT");
    assert.equal(taskPayload.priority, "URGENT");
    assert.equal(taskPayload.dueDate, "2026-09-15T17:00:00Z");
    assert.ok(taskPayload.description.includes("TS. Lê Hải Đăng (Hiệu trưởng)"));
    assert.ok(taskPayload.description.includes("Giao Khoa CNTT chủ trì"));
    assert.equal(taskPayload.sourceDocumentId, "doc-101");
    assert.equal(taskPayload.metadata.originalNumber, "389/UBND-VX");
    assert.equal(taskPayload.metadata.issuingAuthority, "UBND Tỉnh Bình Định");
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
