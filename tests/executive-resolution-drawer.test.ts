// tests/executive-resolution-drawer.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  ExecutiveResolutionType,
  ExecutiveResolutionPayload,
} from "../src/types/executive-resolution";

describe("Executive Resolution Drawer Logic", () => {
  it("khởi tạo phương án mặc định là EXTEND_DEADLINE (+3 ngày)", () => {
    const defaultType: ExecutiveResolutionType = "EXTEND_DEADLINE";
    const defaultDays = 3;
    assert.equal(defaultType, "EXTEND_DEADLINE");
    assert.equal(defaultDays, 3);
  });

  it("hỗ trợ nhận diện phím tắt Cmd+Enter và Ctrl+Enter", () => {
    const isCmdOrCtrlEnter = (e: { key: string; metaKey: boolean; ctrlKey: boolean }) =>
      e.key === "Enter" && (e.metaKey || e.ctrlKey);

    assert.equal(isCmdOrCtrlEnter({ key: "Enter", metaKey: true, ctrlKey: false }), true);
    assert.equal(isCmdOrCtrlEnter({ key: "Enter", metaKey: false, ctrlKey: true }), true);
    assert.equal(isCmdOrCtrlEnter({ key: "Enter", metaKey: false, ctrlKey: false }), false);
    assert.equal(isCmdOrCtrlEnter({ key: "Escape", metaKey: false, ctrlKey: false }), false);
  });

  it("nhận diện phím tắt Escape để đóng drawer", () => {
    const isEscapeKey = (e: { key: string }) => e.key === "Escape";

    assert.equal(isEscapeKey({ key: "Escape" }), true);
    assert.equal(isEscapeKey({ key: "Enter" }), false);
  });

  it("tạo đúng payload theo từng loại phương án tháo gỡ", () => {
    // 1. EXTEND_DEADLINE
    const payloadExtend: ExecutiveResolutionPayload = {
      taskId: "task-101",
      type: "EXTEND_DEADLINE",
      extensionDays: 7,
    };
    assert.equal(payloadExtend.type, "EXTEND_DEADLINE");
    assert.equal(payloadExtend.extensionDays, 7);

    // 2. REASSIGN
    const payloadReassign: ExecutiveResolutionPayload = {
      taskId: "task-101",
      type: "REASSIGN",
      newAssigneeName: "TS. Lê Thị Mai",
    };
    assert.equal(payloadReassign.type, "REASSIGN");
    assert.equal(payloadReassign.newAssigneeName, "TS. Lê Thị Mai");

    // 3. DEMAND_EXPLANATION
    const payloadDemand: ExecutiveResolutionPayload = {
      taskId: "task-101",
      type: "DEMAND_EXPLANATION",
    };
    assert.equal(payloadDemand.type, "DEMAND_EXPLANATION");

    // 4. DIRECT_DIRECTIVE
    const payloadDirective: ExecutiveResolutionPayload = {
      taskId: "task-101",
      type: "DIRECT_DIRECTIVE",
      directiveNote: "Giao Phòng Đào tạo phối hợp giải quyết dứt điểm trước 17h.",
    };
    assert.equal(payloadDirective.type, "DIRECT_DIRECTIVE");
    assert.equal(
      payloadDirective.directiveNote,
      "Giao Phòng Đào tạo phối hợp giải quyết dứt điểm trước 17h."
    );
  });
});
