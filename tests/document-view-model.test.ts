import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fromDocumentItem, fromOfficialDocument, getDocumentKind, getFullPageHref } from "../src/lib/documents/document-view-model";
import type { DocumentItem, OfficialDocument } from "../src/types/document";

const attachment = (id: string, name: string, isOriginal = false) => ({
  id,
  documentId: "d",
  fileName: name,
  fileUrl: `documents/${name}`,
  fileSize: 2048,
  mimeType: "application/pdf",
  isOriginal,
});

const base = {
  id: "d1",
  registrationNumber: 28,
  documentYear: 2026,
  registeredDate: "2026-03-02T00:00:00.000Z",
  originalNumber: "123/BLĐ",
  issuedDate: "2026-02-27T00:00:00.000Z",
  issuingAuthority: "Sở GD&ĐT",
  category: "CONG_VAN",
  summary: "Về việc tổ chức hội nghị",
  urgency: "KHAN",
  securityLevel: "THUONG",
  dueDate: "2026-03-20T00:00:00.000Z",
  status: "DANG_XU_LY",
  registeredById: "u1",
} as const;

describe("View model văn bản (Quick View / Full Page)", () => {
  test("loại văn bản từ mọi dạng giá trị type", () => {
    assert.equal(getDocumentKind("VAN_BAN_DEN"), "incoming");
    assert.equal(getDocumentKind("outbox"), "outgoing");
    assert.equal(getDocumentKind("TO_TRINH_NOI_BO"), "submission");
    assert.equal(getDocumentKind(undefined), "incoming");
  });

  test("văn bản đến từ API: nhãn số, bước, mức khẩn, hạn, metadata", () => {
    const vm = fromDocumentItem({ ...base, type: "VAN_BAN_DEN", leadUnitName: "Phòng Đào tạo", signerName: "Nguyễn A", signerTitle: "Hiệu trưởng", attachments: [] } as unknown as DocumentItem, "2026-03-18");
    assert.equal(vm.kind, "incoming");
    assert.equal(vm.numberLabel, "Số đến 0028");
    assert.equal(vm.step.kind, "progress");
    assert.deepEqual(vm.urgency, { label: "Khẩn", tone: "warning" });
    assert.equal(vm.dueNote?.text, "Còn 2 ngày");
    assert.equal(vm.documentNumber, "123/BLĐ");
    const rows = Object.fromEntries(vm.detailRows.map((r) => [r.label, r.value]));
    assert.equal(rows["Cơ quan ban hành"], "Sở GD&ĐT");
    assert.equal(rows["Người ký"], "Nguyễn A (Hiệu trưởng)");
    assert.equal(rows["Ngày ban hành"], "27/02/2026");
    assert.equal(rows["Ngày đến"], "02/03/2026");
    assert.equal(rows["Chủ trì"], "Phòng Đào tạo");
  });

  test("văn bản đi: số đi/ký hiệu từ workflow, không có hạn, hàng thuộc tính theo loại", () => {
    const vm = fromDocumentItem(
      { ...base, type: "VAN_BAN_DI", outgoingWorkflow: { status: "ISSUED", outgoingNumber: 45, codeNotation: "CĐKT", issuedDate: "2026-03-10T00:00:00Z", draftingDeptName: "Phòng TCHC" }, securityLevel: "MAT" } as unknown as DocumentItem,
      "2026-03-18",
    );
    assert.equal(vm.kind, "outgoing");
    assert.equal(vm.numberLabel, "45/CĐKT");
    assert.equal(vm.step.label, "Đã phát hành");
    assert.equal(vm.dueNote, null);
    const rows = Object.fromEntries(vm.detailRows.map((r) => [r.label, r.value]));
    assert.equal(rows["Soạn thảo"], "Phòng TCHC");
    assert.equal(rows["Độ mật"], "Mật");
    assert.equal(rows["Ngày ban hành"], "10/03/2026");
  });

  test("văn bản đi chưa cấp số", () => {
    const vm = fromDocumentItem({ ...base, type: "VAN_BAN_DI", outgoingWorkflow: { status: "DRAFT" } } as unknown as DocumentItem);
    assert.equal(vm.numberLabel, "Chưa cấp số");
    assert.equal(vm.documentNumber, null);
  });

  test("tờ trình dùng nhãn Số, không có 'Ngày đến'", () => {
    const vm = fromDocumentItem({ ...base, type: "TO_TRINH_NOI_BO" } as unknown as DocumentItem);
    assert.equal(vm.typeLabel, "Tờ trình");
    assert.equal(vm.numberLabel, "Số 0028");
    assert.ok(!vm.detailRows.some((r) => r.label === "Ngày đến"));
  });

  test("tệp: bản gốc đứng đầu, giữ thứ tự còn lại, mọi nguồn cùng một thứ tự", () => {
    const vm = fromDocumentItem({ ...base, type: "VAN_BAN_DEN", attachments: [attachment("a2", "b.pdf"), attachment("a1", "a.pdf", true), attachment("a3", "c.pdf")] } as unknown as DocumentItem);
    assert.deepEqual(vm.files.map((f) => f.id), ["a1", "a2", "a3"]);
    assert.equal(vm.files[0].sizeBytes, 2048);
  });

  test("nhiệm vụ liên kết: có chi tiết khi API trả, chỉ id khi thiếu", () => {
    const full = fromDocumentItem({ ...base, type: "VAN_BAN_DEN", linkedTaskId: "t1", linkedTask: { id: "t1", code: "NV-1", title: "Việc A", status: "IN_PROGRESS", progressPercent: 40 } } as unknown as DocumentItem);
    assert.equal(full.linkedTask?.title, "Việc A");
    const partial = fromDocumentItem({ ...base, type: "VAN_BAN_DEN", linkedTaskId: "t2" } as unknown as DocumentItem);
    assert.deepEqual(partial.linkedTask, { id: "t2" });
    assert.equal(fromDocumentItem({ ...base, type: "VAN_BAN_DEN" } as unknown as DocumentItem).linkedTask, null);
  });

  test("dòng danh sách (OfficialDocument) dựng được tiêu đề ngay khi chi tiết còn tải", () => {
    const doc: OfficialDocument = {
      id: "d1",
      type: "inbox",
      documentNumber: "123/BLĐ",
      registrationNumber: 28,
      issuedDate: "2026-02-27",
      receivedDate: "2026-03-02",
      issuingAuthority: "Sở",
      summary: "Trích yếu",
      urgency: "urgent",
      status: "processing",
      leadDepartment: "Phòng A",
      signatory: "",
      attachments: [{ id: "a1", name: "x.pdf", url: "documents/x.pdf", sizeBytes: 10 }],
    };
    const vm = fromOfficialDocument(doc, "2026-03-18");
    assert.equal(vm.numberLabel, "Số đến 0028");
    assert.equal(vm.title, "Trích yếu");
    assert.deepEqual(vm.files.map((f) => f.id), ["a1"]);
    assert.ok(vm.detailRows.some((r) => r.label === "Chủ trì" && r.value === "Phòng A"));
  });

  test("đường dẫn trang đầy đủ theo loại, giữ ?file=", () => {
    assert.equal(getFullPageHref("incoming", "d1"), "/documents/incoming/d1");
    assert.equal(getFullPageHref("outgoing", "d1", "f 1"), "/documents/outgoing/d1?file=f%201");
    assert.equal(getFullPageHref("submission", "d1", "f"), "/documents/d1?file=f");
  });
});
