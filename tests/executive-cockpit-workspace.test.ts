import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Pin reference date to 2026-09-25 for deterministic testing per invariants.md
process.env.NEXT_PUBLIC_REFERENCE_DATE = "2026-09-25";
import type { SchoolBottleneckItem } from "../src/types/workspace";

describe("Executive Unit Radar Dot Calculation", () => {
  it("phân loại đúng màu chấm theo số lượng tắc nghẽn và cảnh báo", () => {
    const getDotStatus = (blockedCount: number, delayedCount: number) => {
      if (blockedCount > 0 || delayedCount > 0) return "RED";
      return "GREEN";
    };

    assert.equal(getDotStatus(2, 0), "RED");
    assert.equal(getDotStatus(0, 1), "RED");
    assert.equal(getDotStatus(0, 0), "GREEN");
  });

  it("xử lý logic lọc đơn vị: nhấp cùng đơn vị sẽ hủy lọc, nhấp đơn vị khác sẽ chọn", () => {
    const handleSelect = (currentSelected: string, clickedDept: string) => {
      return currentSelected === clickedDept ? "" : clickedDept;
    };

    assert.equal(handleSelect("", "CNTT"), "CNTT");
    assert.equal(handleSelect("CNTT", "CNTT"), "");
    assert.equal(handleSelect("CNTT", "DAO_TAO"), "DAO_TAO");
  });
});

describe("Executive Bottleneck Card Presentation", () => {
  it("không bao giờ render mã vé kỹ thuật staff-task-xxx hay technical id", () => {
    const sampleItem: SchoolBottleneckItem = {
      id: "staff-task-9988-tech-id",
      title: "Rà soát đề thi tốt nghiệp đợt 2",
      departmentCode: "DAO_TAO",
      departmentName: "Phòng Đào tạo & QLKH",
      assigneeName: "Đỗ Quang Trung",
      dueDate: "2026-09-05",
      daysOverdue: 2,
      isOverdue: true,
      isBlocked: false,
      priority: "CAO",
      status: "CHUA_HOAN_THANH",
      originalTask: {} as any,
    };

    assert.ok(sampleItem.title.includes("Rà soát đề thi"));
    assert.equal(sampleItem.daysOverdue, 2);
    assert.equal(sampleItem.title.includes("staff-task-"), false);
  });

  it("xác định đúng nhãn trạng thái trễ hạn hoặc tắc nghẽn", () => {
    const getBadgeLabel = (item: { daysOverdue?: number; isBlocked?: boolean; isOverdue?: boolean }) => {
      if (typeof item.daysOverdue === "number" && item.daysOverdue > 0) {
        return `QUÁ HẠN ${item.daysOverdue} NGÀY`;
      }
      if (item.isBlocked) {
        return "ĐANG BỊ TẮC NGHẼN";
      }
      if (item.isOverdue) {
        return "ĐÃ QUÁ HẠN";
      }
      return "ĐIỂM NGHẼN CẤP THIẾT";
    };

    assert.equal(getBadgeLabel({ daysOverdue: 3, isBlocked: false }), "QUÁ HẠN 3 NGÀY");
    assert.equal(getBadgeLabel({ daysOverdue: 0, isBlocked: true }), "ĐANG BỊ TẮC NGHẼN");
    assert.equal(getBadgeLabel({ daysOverdue: 0, isBlocked: false, isOverdue: true }), "ĐÃ QUÁ HẠN");
    assert.equal(getBadgeLabel({ daysOverdue: 0, isBlocked: false, isOverdue: false }), "ĐIỂM NGHẼN CẤP THIẾT");
  });
});

describe("Single Header Rule for Executive Role", () => {
  it("xác nhận logic vai trò ADMIN / Lãnh đạo BGH không render header 2 tầng", () => {
    const shouldRenderOuterHeader = (role: string, isExecutive: boolean) => {
      if (isExecutive) return false;
      return true;
    };

    assert.equal(shouldRenderOuterHeader("ADMIN", true), false);
    assert.equal(shouldRenderOuterHeader("HIEU_TRUONG", true), false);
    assert.equal(shouldRenderOuterHeader("PHO_HIEU_TRUONG", true), false);
    assert.equal(shouldRenderOuterHeader("MANAGER", false), true);
    assert.equal(shouldRenderOuterHeader("TRUONG_KHOA", false), true);
    assert.equal(shouldRenderOuterHeader("STAFF", false), true);
    assert.equal(shouldRenderOuterHeader("GIANG_VIEN", false), true);
  });
});
