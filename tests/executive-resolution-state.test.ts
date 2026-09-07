// tests/executive-resolution-state.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyExecutiveResolution } from "../src/lib/executive-resolution-state";
import type { SchoolBottleneckItem } from "../src/types/workspace";

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
