import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  QUICK_DIRECTIVE_PRESETS,
  applyPresetToDirective,
  DirectiveActionPanel
} from "../src/components/documents/directive-action-panel";
import {
  DocumentQuickEntryModal
} from "../src/components/documents/document-quick-entry-modal";
import type { DocumentItem } from "../src/types/document";

const sampleDoc: DocumentItem = {
  id: "doc-test-1",
  type: "VAN_BAN_DEN",
  registrationNumber: 42,
  documentYear: 2026,
  registeredDate: "2026-09-07T08:30:00Z",
  originalNumber: "125/TCGDNN-VP",
  issuedDate: "2026-09-05T00:00:00Z",
  issuingAuthority: "Tổng cục Giáo dục Nghề nghiệp",
  category: "Công văn",
  summary: "Về việc báo cáo kế hoạch đào tạo nghề trọng điểm quý IV/2026",
  urgency: "KHAN",
  securityLevel: "THUONG",
  status: "CHO_PHAN_CONG",
  registeredById: "user-vt-1",
  registeredByName: "Văn thư Nguyễn Văn An",
};

describe("Quick Directive Presets for Leadership", () => {
  test("contains standard academic and operational presets", () => {
    assert.ok(QUICK_DIRECTIVE_PRESETS.length >= 3);
    const trainingPreset = QUICK_DIRECTIVE_PRESETS.find(p => p.id === "giao-dao-tao");
    assert.ok(trainingPreset, "Must have preset for Training Dept");
    assert.equal(trainingPreset?.defaultDeptId, "DT");

    const adminPreset = QUICK_DIRECTIVE_PRESETS.find(p => p.id === "giao-tc-hc");
    assert.ok(adminPreset, "Must have preset for TCHC Dept");
    assert.equal(adminPreset?.defaultDeptId, "TCHC");

    const financePreset = QUICK_DIRECTIVE_PRESETS.find(p => p.id === "giao-kh-tc");
    assert.ok(financePreset, "Must have preset for KHTC Dept");
    assert.equal(financePreset?.defaultDeptId, "KHTC");
  });

  test("applies preset and sets deadline offset accurately", () => {
    const result = applyPresetToDirective("giao-dao-tao", "2026-09-07T00:00:00Z");
    assert.equal(result.assignedDeptId, "DT");
    assert.ok(result.instruction.includes("Phòng Đào tạo"));
    assert.ok(result.deadline);

    // Verify calculated date is after base date
    const baseDate = new Date("2026-09-07T00:00:00Z");
    const deadlineDate = new Date(result.deadline!);
    assert.ok(deadlineDate.getTime() > baseDate.getTime(), "Deadline must be later than base date");
  });

  test("applies default deadline offset when baseDate is omitted", () => {
    const result = applyPresetToDirective("giao-tc-hc");
    assert.equal(result.assignedDeptId, "TCHC");
    assert.ok(result.instruction.includes("Phòng Tổ chức - Hành chính") || result.instruction.includes("Hành chính"));
    assert.ok(result.deadline);
  });

  test("DirectiveActionPanel renders preset chips and form controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(DirectiveActionPanel, {
        document: sampleDoc,
        departments: [
          { id: "DT", name: "Phòng Đào tạo" },
          { id: "TCHC", name: "Phòng Tổ chức - Hành chính" },
          { id: "KHTC", name: "Phòng Kế hoạch - Tài chính" },
          { id: "CNTT", name: "Khoa Công nghệ Thông tin" },
        ],
      })
    );

    assert.ok(html.includes("Bút phê"), "Must render directive title");
    assert.ok(html.includes("125/TCGDNN-VP"), "Must render document number");
    assert.ok(html.includes("Giao P. Đào tạo") || html.includes("giao-dao-tao"), "Must render preset chips");
    assert.ok(html.includes("Đơn vị chủ trì"), "Must render assigned department label");
    assert.ok(html.includes("Hạn xử lý") || html.includes("Hạn báo cáo"), "Must render deadline controls");
    assert.ok(html.includes("+1 ngày") || html.includes("+3 ngày"), "Must render quick deadline buttons");
    assert.ok(html.includes("textarea") || html.includes("instruction"), "Must render instruction textarea");
  });

  test("DocumentQuickEntryModal returns null when isOpen is false", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentQuickEntryModal, {
        isOpen: false,
        onClose: () => {},
      })
    );
    assert.equal(html, "");
  });

  test("DocumentQuickEntryModal renders fast entry form when isOpen is true", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentQuickEntryModal, {
        isOpen: true,
        onClose: () => {},
        departments: [
          { id: "DT", name: "Phòng Đào tạo" },
          { id: "TCHC", name: "Phòng Tổ chức - Hành chính" },
        ],
      })
    );

    assert.ok(html.includes("Vào sổ văn bản") || html.includes("Đăng ký văn bản"), "Must render modal title");
    assert.ok(html.includes("Văn bản đến"), "Must render incoming document option");
    assert.ok(html.includes("Văn bản đi"), "Must render outgoing document option");
    assert.ok(html.includes("Số ký hiệu"), "Must render original number field");
    assert.ok(html.includes("Cơ quan ban hành"), "Must render issuing authority field");
    assert.ok(html.includes("Trích yếu"), "Must render summary field");
    assert.ok(html.includes("Mức độ khẩn") || html.includes("Độ khẩn"), "Must render urgency field");
    assert.ok(html.includes("Đơn vị xử lý") || html.includes("Đơn vị chủ trì") || html.includes("Đơn vị soạn thảo"), "Must render department field");
  });
});
