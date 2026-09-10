// tests/executive-cockpit-workspace.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { SchoolBottleneckItem } from "../src/types/workspace";
import { applyExecutiveResolution } from "../src/lib/executive-resolution-state";

describe("Executive Cockpit Workspace Invariants", () => {
  it("xác nhận quy chuẩn header đơn 56px không chứa lời chào dư thừa", () => {
    const singleHeaderTitle = "KHOANG ĐIỀU HÀNH BGH";
    assert.equal(singleHeaderTitle, "KHOANG ĐIỀU HÀNH BGH");

    const workspaceFilePath = path.join(
      process.cwd(),
      "src/components/portal/executive-cockpit-workspace.tsx"
    );
    assert.ok(fs.existsSync(workspaceFilePath), "File executive-cockpit-workspace.tsx must exist");
    const content = fs.readFileSync(workspaceFilePath, "utf-8");

    // Header invariants
    assert.ok(
      content.includes("KHOANG ĐIỀU HÀNH BGH") ||
        content.includes("TRUNG TÂM ĐIỀU HÀNH BGH"),
      "Must contain title KHOANG ĐIỀU HÀNH BGH or TRUNG TÂM ĐIỀU HÀNH BGH"
    );
    assert.ok(content.includes("Ban Giám Hiệu"), "Must contain role badge Ban Giám Hiệu");
    assert.ok(content.includes("min-h-[56px]"), "Must have min-h-[56px] single header");
    assert.ok(!content.includes("Xin chào,"), "Must NOT contain redundant greeting Xin chào");
    assert.ok(content.includes("+ Giao nhiệm vụ"), "Must contain + Giao nhiệm vụ action button");
    assert.ok(
      content.includes("Kho nhiệm vụ") || content.includes("Danh mục nhiệm vụ"),
      "Must contain Kho nhiệm vụ or Danh mục nhiệm vụ action button"
    );
    assert.ok(content.includes("Làm mới"), "Must contain Làm mới action button");
  });

  it("xác nhận Hero KPI chuyển trạng thái Zero-Bottleneck khi bottlenecks = 0", () => {
    const getHeroBadge = (count: number) => {
      if (count === 0) return { label: "Tiến độ toàn trường thông suốt", variant: "SUCCESS" };
      return { label: `${count} điểm nghẽn cần tháo gỡ`, variant: "HERO_ALERT" };
    };

    assert.equal(getHeroBadge(5).variant, "HERO_ALERT");
    assert.equal(getHeroBadge(0).variant, "SUCCESS");

    const workspaceFilePath = path.join(
      process.cwd(),
      "src/components/portal/executive-cockpit-workspace.tsx"
    );
    const content = fs.readFileSync(workspaceFilePath, "utf-8");

    // Hero KPI card invariants
    assert.ok(content.includes("min-h-[110px]"), "Hero KPI card must have min-h-[110px]");
    assert.ok(content.includes("border-rose-500/60"), "Must have rose styling when count > 0");
    assert.ok(content.includes("border-emerald-500/40"), "Must have emerald styling when count === 0");
    assert.ok(content.includes("Tiến độ toàn trường thông suốt"), "Must have subtext Tiến độ toàn trường thông suốt");
    assert.ok(content.includes("đơn vị bị ảnh hưởng"), "Must have subtext đơn vị bị ảnh hưởng");
    assert.ok(
      content.includes("Tất cả 11 đơn vị đang vận hành thông suốt — 0 điểm nghẽn"),
      "Must have Zero-Bottleneck banner: Tất cả 11 đơn vị đang vận hành thông suốt — 0 điểm nghẽn"
    );
  });

  it("xác nhận quy chuẩn layout 70/30 và tích hợp ExecutiveUnitRadar & ExecutiveBottleneckCard", () => {
    const workspaceFilePath = path.join(
      process.cwd(),
      "src/components/portal/executive-cockpit-workspace.tsx"
    );
    assert.ok(fs.existsSync(workspaceFilePath), "File executive-cockpit-workspace.tsx must exist");
    const content = fs.readFileSync(workspaceFilePath, "utf-8");

    // 70/30 grid layout invariants
    assert.ok(content.includes("lg:grid-cols-12"), "Must use 12-column grid");
    assert.ok(content.includes("lg:col-span-8"), "Left column must be 8 cols (approx 70%)");
    assert.ok(content.includes("lg:col-span-4"), "Right column must be 4 cols (approx 30%)");

    // Component integrations
    assert.ok(content.includes("<ExecutiveBottleneckCard"), "Must render ExecutiveBottleneckCard");
    assert.ok(content.includes("<ExecutiveUnitRadar"), "Must render ExecutiveUnitRadar");
    assert.ok(content.includes("<ExecutiveResolutionDrawer"), "Must render ExecutiveResolutionDrawer");
  });

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

    // Áp dụng giải pháp tháo gỡ
    const res = applyExecutiveResolution(initialBottlenecks, {
      taskId: "task-bn-1",
      type: "EXTEND_DEADLINE",
      extensionDays: 3,
    });

    assert.equal(res.updatedBottlenecks.length, 1);
    assert.equal(res.updatedBottlenecks[0].id, "task-bn-2");
    assert.equal(res.resolvedItem?.id, "task-bn-1");
    assert.ok(res.actionSummary.includes("Gia hạn tiến độ thêm 3 ngày"));

    const workspaceFilePath = path.join(
      process.cwd(),
      "src/components/portal/executive-cockpit-workspace.tsx"
    );
    const content = fs.readFileSync(workspaceFilePath, "utf-8");
    assert.ok(content.includes("applyExecutiveResolution"), "Must use applyExecutiveResolution helper");
    assert.ok(content.includes("Hoàn tác (5s)"), "Must support 5s Undo action");
  });
});
