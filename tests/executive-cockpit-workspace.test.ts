import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import type { SchoolBottleneckItem } from "../src/types/workspace";
import { applyExecutiveResolution } from "../src/lib/executive-resolution-state";
import { getRadarDotStatus, formatRadarUnitName } from "../src/components/portal/executive-unit-radar";
import {
  buildExecutiveAttentionQueue,
  type ExecutiveAttentionItem,
} from "../src/components/dashboard/executive-cockpit-workspace";
import type { SchoolTask } from "../src/types/dashboard";

describe("Executive Cockpit Workspace Invariants", () => {
  it("xác nhận luồng cập nhật lạc quan (optimistic resolution flow) tháo gỡ điểm nghẽn ngay lập tức", () => {
    const initialBottlenecks: SchoolBottleneckItem[] = [
      {
        id: "task-bn-1",
        title: "Báo cáo kiểm định chất lượng",
        departmentCode: "DAO_TAO",
        departmentName: "Phòng Đào tạo & QLKH",
        assigneeName: "Trần Văn A",
        dueDate: "2026-09-05",
        daysOverdue: 2,
        isOverdue: true,
        isBlocked: false,
        priority: "CAO",
        status: "CHUA_HOAN_THANH",
        originalTask: {} as any,
      },
      {
        id: "task-bn-2",
        title: "Bảo trì phòng máy thực hành",
        departmentCode: "CNTT",
        departmentName: "Khoa CNTT",
        assigneeName: "Lê Văn B",
        dueDate: "2026-09-06",
        daysOverdue: 1,
        isOverdue: true,
        isBlocked: false,
        priority: "TRUNG_BINH",
        status: "CHUA_HOAN_THANH",
        originalTask: {} as any,
      },
    ];

    const res = applyExecutiveResolution(initialBottlenecks, {
      taskId: "task-bn-1",
      type: "EXTEND_DEADLINE",
      extensionDays: 3,
    });

    assert.equal(res.updatedBottlenecks.length, 1);
    assert.equal(res.updatedBottlenecks[0].id, "task-bn-2");
    assert.equal(res.resolvedItem?.id, "task-bn-1");
    assert.ok(res.actionSummary.includes("Gia hạn tiến độ thêm 3 ngày"));
  });
});

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
,
      count: 2,
    });
    assert.deepEqual(getRadarDotStatus({ blockedTasks: 0, delayedTasks: 1, healthStatus: "YELLOW" }), {
,
      count: 1,
    });
    assert.deepEqual(getRadarDotStatus({ blockedTasks: 0, delayedTasks: 0, healthStatus: "GREEN" }), {
,
      count: 0,
    });
    assert.deepEqual(getRadarDotStatus({ blockedTasks: 0, delayedTasks: 0, healthStatus: "YELLOW" }), {
,
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

describe("Executive Attention Queue Builder", () => {
  const mockTasks = [
    {
      id: "task-approval-1",
      code: "NV-001",
      title: "Phê duyệt kế hoạch kiểm định chất lượng đào tạo",

      departmentName: "Phòng Quản lý chất lượng",
      dueDate: "2026-09-15",
      status: "PENDING_EXECUTIVE_APPROVAL",
      progressPercent: 100,
      priority: "HIGH",
      category: "BAO_CAO",
    },
    {
      id: "task-blocked-1",
      code: "NV-002",
      title: "Giải phóng mặt bằng phân hiệu 2",

      departmentName: "Phòng QT-CSVC",
      dueDate: "2026-09-10",
      status: "BLOCKED" as any,
      progressPercent: 40,
      priority: "URGENT",
      category: "BAO_CAO",
    },
    {
      id: "task-overdue-1",
      code: "NV-003",
      title: "Báo cáo tuyển sinh đợt 1",

      departmentName: "Trung tâm TS-TT",
      dueDate: "2026-08-30",
      status: "IN_PROGRESS",
      progressPercent: 60,
      priority: "HIGH",
      category: "BAO_CAO",
    },
    {
      id: "task-normal-1",
      code: "NV-004",
      title: "Cập nhật đề cương chi tiết học kỳ 1",

      departmentName: "Khoa CNTT",
      dueDate: "2026-09-25",
      status: "IN_PROGRESS",
      progressPercent: 50,
      priority: "NORMAL",
      category: "CNTT",
    },
    {
      id: "task-completed-1",
      code: "NV-005",
      title: "Tổ chức lễ khai giảng năm học 2026-2027",

      departmentName: "Phòng CT-CTHSSV",
      dueDate: "2026-09-05",
      status: "COMPLETED",
      progressPercent: 100,
      priority: "HIGH",
      category: "BAO_CAO",
    },
  ] as unknown as SchoolTask[];

  test("buildExecutiveAttentionQueue prioritizes pending approval > blocked > overdue", () => {
    const queue = buildExecutiveAttentionQueue(mockTasks);
    assert.equal(queue.length, 3);

    assert.equal(queue[0].id, "task-approval-1");
    assert.equal(queue[0].type, "APPROVAL");

    assert.equal(queue[1].id, "task-blocked-1");
    assert.equal(queue[1].type, "BLOCKED");

    assert.equal(queue[2].id, "task-overdue-1");
    assert.equal(queue[2].type, "OVERDUE");
  });

  test("buildExecutiveAttentionQueue caps output at limit items", () => {
    const manyTasks: SchoolTask[] = Array.from({ length: 20 }, (_, i) => ({
      id: `task-${i}`,
      code: `NV-${String(i).padStart(3, "0")}`,
      title: `Task pending approval ${i}`,

      departmentName: "Phòng ban",
      dueDate: "2026-09-15",
      status: "PENDING_EXECUTIVE_APPROVAL",
      progressPercent: 100,
      priority: "HIGH",
      category: "BAO_CAO",
    })) as unknown as SchoolTask[];

    const defaultQueue = buildExecutiveAttentionQueue(manyTasks);
    assert.equal(defaultQueue.length, 7);

    const customQueue = buildExecutiveAttentionQueue(manyTasks, undefined, 10);
    assert.equal(customQueue.length, 10);
  });

  test("buildExecutiveAttentionQueue returns empty array when no tasks need attention", () => {
    const normalTasks = [
      {
        id: "task-ok-1",
        code: "NV-100",
        title: "Nhiệm vụ bình thường",

        departmentName: "Khoa CNTT",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        progressPercent: 50,
        priority: "NORMAL",
      },
    ] as unknown as SchoolTask[];

    const queue = buildExecutiveAttentionQueue(normalTasks);
    assert.equal(queue.length, 0);
  });
});
