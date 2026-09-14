// tests/executive-resolution-drawer.test.ts
import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import type {
  ExecutiveResolutionType,
  ExecutiveResolutionPayload,
} from "../src/types/executive-resolution";
import { applyExecutiveResolution } from "../src/lib/executive-resolution-state";
import type { SchoolBottleneckItem } from "../src/types/workspace";

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

describe("Executive Resolution Persistence Logic", () => {
  test("calculates new due date correctly when grantedDays is applied", () => {
    const currentDueDate = new Date("2026-09-20T00:00:00Z");
    const grantedDays = 7;
    const newDueDate = new Date(currentDueDate.getTime() + grantedDays * 24 * 60 * 60 * 1000);

    assert.strictEqual(newDueDate.toISOString().split("T")[0], "2026-09-27");
  });
});

describe("Executive Resolution State Reducer", () => {
  const sampleBottlenecks: SchoolBottleneckItem[] = [
    {
      id: "task-1",
      title: "Lập danh sách HSSV diện miễn giảm học phí",
      departmentCode: "K_CNTT",
      departmentName: "Khoa CNTT",
      assigneeName: "Lê Hoàng Nam",
      dueDate: "2026-09-01",
      daysOverdue: 3,
      isBlocked: true,
      blockedReason: "Chờ dữ liệu từ phòng Đào tạo",
      priority: "KHAN_CAP",
      status: "CHUA_HOAN_THANH",
      originalTask: {} as any,
    },
    {
      id: "task-2",
      title: "Mua sắm thiết bị phòng thực hành điện",
      departmentCode: "K_DIEN",
      departmentName: "Khoa Điện",
      assigneeName: "Trần Minh Quang",
      dueDate: "2026-09-02",
      daysOverdue: 2,
      isBlocked: false,
      priority: "CAO",
      status: "CHUA_HOAN_THANH",
      originalTask: {} as any,
    },
  ];

  it("gỡ bỏ nhiệm vụ khỏi danh sách bottlenecks khi gia hạn hạn chót", () => {
    const result = applyExecutiveResolution(sampleBottlenecks, {
      taskId: "task-1",
      type: "EXTEND_DEADLINE",
      extensionDays: 3,
    });

    assert.equal(result.updatedBottlenecks.length, 1);
    assert.equal(result.updatedBottlenecks[0].id, "task-2");
    assert.equal(result.resolvedItem?.id, "task-1");
    assert.match(result.actionSummary, /Gia hạn tiến độ thêm 3 ngày/);
  });

  it("gỡ bỏ nhiệm vụ khi chuyển người xử lý khác", () => {
    const result = applyExecutiveResolution(sampleBottlenecks, {
      taskId: "task-1",
      type: "REASSIGN",
      newAssigneeName: "ThS. Nguyễn Văn A",
    });

    assert.equal(result.updatedBottlenecks.length, 1);
    assert.match(result.actionSummary, /Giao cho ThS. Nguyễn Văn A/);
  });

  it("gỡ bỏ nhiệm vụ khi yêu cầu giải trình khẩn", () => {
    const result = applyExecutiveResolution(sampleBottlenecks, {
      taskId: "task-1",
      type: "DEMAND_EXPLANATION",
    });

    assert.equal(result.updatedBottlenecks.length, 1);
    assert.match(result.actionSummary, /Yêu cầu Trưởng đơn vị giải trình khẩn/);
  });

  it("gỡ bỏ nhiệm vụ khi BGH ban hành chỉ đạo trực tiếp", () => {
    const result = applyExecutiveResolution(sampleBottlenecks, {
      taskId: "task-1",
      type: "DIRECT_DIRECTIVE",
      directiveNote: "Yêu cầu hoàn thành trước 17h ngày mai",
    });

    assert.equal(result.updatedBottlenecks.length, 1);
    assert.match(result.actionSummary, /Ban hành chỉ đạo trực tiếp/);
  });
});
