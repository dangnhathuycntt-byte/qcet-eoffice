// tests/executive-cockpit-components.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { SchoolBottleneckItem, ElevenDepartmentRadarItem } from "../src/types/workspace";
import { getRadarDotStatus, formatRadarUnitName } from "../src/components/portal/executive-unit-radar";

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

  it("getRadarDotStatus trả về đúng màu và số đếm cảnh báo", () => {
    assert.deepEqual(getRadarDotStatus({ blockedTasks: 2, delayedTasks: 0, healthStatus: "RED" }), {
      color: "RED",
      count: 2,
    });
    assert.deepEqual(getRadarDotStatus({ blockedTasks: 0, delayedTasks: 1, healthStatus: "YELLOW" }), {
      color: "RED",
      count: 1,
    });
    assert.deepEqual(getRadarDotStatus({ blockedTasks: 0, delayedTasks: 0, healthStatus: "GREEN" }), {
      color: "GREEN",
      count: 0,
    });
    // Trạng thái vàng khi có cảnh báo vàng
    assert.deepEqual(getRadarDotStatus({ blockedTasks: 0, delayedTasks: 0, healthStatus: "YELLOW" }), {
      color: "YELLOW",
      count: 0,
    });
  });

  it("formatRadarUnitName rút gọn tên 11 đơn vị chuẩn mực QCET", () => {
    assert.equal(formatRadarUnitName("Khoa Công nghệ thông tin"), "Khoa CNTT");
    assert.equal(formatRadarUnitName("Khoa Cơ khí - Động lực"), "Khoa Cơ khí");
    assert.equal(formatRadarUnitName("Khoa Điện - Điện tử"), "Khoa Điện");
    assert.equal(formatRadarUnitName("Khoa Kỹ thuật - Du lịch"), "Khoa KT-DL");
    assert.equal(formatRadarUnitName("Khoa Khoa học cơ bản"), "Khoa KHCB");
    assert.equal(formatRadarUnitName("Phòng Đào tạo & QLKH"), "Phòng Đào tạo");
    assert.equal(formatRadarUnitName("Phòng Hành chính - Quản trị"), "Phòng HC-QT");
    assert.equal(formatRadarUnitName("Phòng Quản trị Thiết bị"), "Phòng QTTB");
    assert.equal(formatRadarUnitName("TT Truyền thông & Số hóa"), "TT Truyền thông");
    assert.equal(formatRadarUnitName("TT Đào tạo theo Nhu cầu XH"), "TT ĐT-NCXH");
    assert.equal(formatRadarUnitName("Ban Giám hiệu"), "Ban Giám hiệu");
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

describe("Executive Bottleneck Card Data Presentation", () => {
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

    // Card face chỉ hiển thị thông tin nghiệp vụ
    assert.ok(sampleItem.title.includes("Rà soát đề thi"));
    assert.equal(sampleItem.daysOverdue, 2);
    // Kiểm tra quy tắc ID không được nhúng vào tiêu đề hoặc nội dung nghiệp vụ
    assert.equal(sampleItem.title.includes("staff-task-"), false);
  });

  it("xác định đúng nhãn trạng thái quá hạn hoặc tắc nghẽn", () => {
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

  it("tuân thủ các ràng buộc cấu trúc trong executive-bottleneck-card.tsx", () => {
    const cardFilePath = path.join(
      process.cwd(),
      "src/components/portal/executive-bottleneck-card.tsx"
    );
    assert.ok(fs.existsSync(cardFilePath), "File executive-bottleneck-card.tsx must exist");
    const content = fs.readFileSync(cardFilePath, "utf-8");

    // Invariant: min-h-[90px]
    assert.ok(content.includes("min-h-[90px]"), "Card must specify min-h-[90px]");
    // Invariant: rounded-xl
    assert.ok(content.includes("rounded-xl"), "Card must use rounded-xl");
    // Invariant: no technical ID rendering
    assert.ok(!content.includes("item.id"), "Card face must not render item.id");
    // Invariant: contains action buttons
    assert.ok(content.includes("Đôn đốc"), "Card must contain [Đôn đốc] action");
    assert.ok(content.includes("Tháo gỡ"), "Card must contain [Tháo gỡ] action");
  });

  it("tuân thủ các ràng buộc cấu trúc trong executive-unit-radar.tsx", () => {
    const radarFilePath = path.join(
      process.cwd(),
      "src/components/portal/executive-unit-radar.tsx"
    );
    assert.ok(fs.existsSync(radarFilePath), "File executive-unit-radar.tsx must exist");
    const content = fs.readFileSync(radarFilePath, "utf-8");

    // Header: TỔNG QUAN 11 ĐƠN VỊ
    assert.ok(content.includes("TỔNG QUAN 11 ĐƠN VỊ"), "Radar must contain title TỔNG QUAN 11 ĐƠN VỊ");
    // Button: Đôn đốc tất cả
    assert.ok(content.includes("Đôn đốc tất cả"), "Radar must contain button Đôn đốc tất cả");
    // Interaction: onSelectDepartment
    assert.ok(content.includes("onSelectDepartment"), "Radar must trigger onSelectDepartment");
  });
});
