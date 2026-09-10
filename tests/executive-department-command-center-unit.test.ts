import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { SchoolTask } from "@/types/dashboard";
import type {
  ExecutiveDepartmentSummary,
  ExecutiveTriageFilter,
} from "@/types/executive-command";
import { computeExecutiveDepartmentSummaries } from "@/lib/tasks/executive-department-aggregator";
import {
  filterExecutiveDepartmentSummaries,
  getTriageFilterCounts,
  getRAGBadgeConfig,
  getPriorityBadgeConfig,
} from "@/components/tasks/executive-department-command-center";

describe("Executive Department Command Center Unit & Triage Tests", () => {
  const mockTasks: SchoolTask[] = [
    {
      id: "task-cntt-overdue",
      title: "Kiểm định ngành CNTT",
      category: "BAO_CAO",
      categoryLabel: "Đào tạo",
      leadAssigneeName: "Khoa CNTT",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-08-25", // Overdue -> RED
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 2,
      completedSubTasks: 0,
      progressPercent: 20,
    },
    {
      id: "task-dien-due-soon",
      title: "Hội thảo Điện tử vi mô",
      category: "CNTT",
      categoryLabel: "Khoa học",
      leadAssigneeName: "Khoa Điện - Điện tử",
      coAssignees: [],
      assignedDate: "2026-08-15",
      dueDate: "2026-09-08", // Due soon -> AMBER
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 1,
      completedSubTasks: 0,
      progressPercent: 50,
    },
    {
      id: "task-ck-approval",
      title: "Nghiệm thu máy tiện cơ khí",
      category: "KHAC",
      categoryLabel: "Kỹ thuật",
      leadAssigneeName: "Khoa Cơ khí",
      coAssignees: [],
      assignedDate: "2026-08-10",
      dueDate: "2026-09-15",
      status: "PENDING_EXECUTIVE_APPROVAL",
      subTasks: [],
      totalSubTasks: 2,
      completedSubTasks: 2,
      progressPercent: 100,
    },
  ];

  const summaries = computeExecutiveDepartmentSummaries(mockTasks, "2026-09-06");

  test("tính toán chính xác số lượng cho 3 lăng kính Triage Bar", () => {
    const counts = getTriageFilterCounts(summaries);
    assert.equal(counts.all, 12, "Tất cả đơn vị phải là 12");
    assert.ok(counts.bottlenecks >= 1, "Phải có ít nhất 1 đơn vị nghẽn (CNTT quá hạn)");
    assert.ok(counts.pendingApproval >= 1, "Phải có ít nhất 1 đơn vị chờ duyệt (Cơ khí)");
  });

  test("filterExecutiveDepartmentSummaries: lọc 'ALL' trả về đủ 12 đơn vị", () => {
    const filtered = filterExecutiveDepartmentSummaries(summaries, "ALL");
    assert.equal(filtered.length, 12);
  });

  test("filterExecutiveDepartmentSummaries: lọc 'BOTTLENECKS' chỉ trả về đơn vị có nguy cơ/quá hạn", () => {
    const filtered = filterExecutiveDepartmentSummaries(summaries, "BOTTLENECKS");
    assert.ok(filtered.length > 0);
    for (const item of filtered) {
      const isBottleneck =
        item.ragStatus === "RED" || item.metrics.overdue > 0;
      assert.ok(
        isBottleneck,
        `Đơn vị ${item.departmentId} trong danh sách nghẽn phải có RAG RED hoặc overdue > 0`
      );
    }
    const hasCntt = filtered.some((item) => item.departmentId === "KHOA_CNTT");
    assert.ok(hasCntt, "Khoa CNTT phải nằm trong nhóm BOTTLENECKS");
  });

  test("filterExecutiveDepartmentSummaries: lọc 'PENDING_APPROVAL' chỉ trả về đơn vị có việc chờ duyệt", () => {
    const filtered = filterExecutiveDepartmentSummaries(summaries, "PENDING_APPROVAL");
    assert.ok(filtered.length > 0);
    for (const item of filtered) {
      assert.ok(
        item.pendingApprovalCount > 0,
        `Đơn vị ${item.departmentId} phải có pendingApprovalCount > 0`
      );
    }
    const hasCk = filtered.some((item) => item.departmentId === "KHOA_CK");
    assert.ok(hasCk, "Khoa Cơ khí phải nằm trong nhóm PENDING_APPROVAL");
  });

  test("getRAGBadgeConfig trả về cấu hình ngữ nghĩa chuẩn cho RED, AMBER, GREEN", () => {
    const red = getRAGBadgeConfig("RED");
    assert.equal(red.label, "Báo động trễ");
    assert.ok(red.className.includes("destructive") || red.className.includes("rose"));

    const amber = getRAGBadgeConfig("AMBER");
    assert.equal(amber.label, "Cần chú ý");
    assert.ok(amber.className.includes("amber"));

    const green = getRAGBadgeConfig("GREEN");
    assert.equal(green.label, "Đúng hạn");
    assert.ok(green.className.includes("emerald") || green.className.includes("success"));
  });

  test("getPriorityBadgeConfig chuyển đổi độ ưu tiên đúng nhãn tiếng Việt", () => {
    const high = getPriorityBadgeConfig("HIGH");
    assert.equal(high.label, "Ưu tiên cao");

    const medium = getPriorityBadgeConfig("MEDIUM");
    assert.equal(medium.label, "Trung bình");

    const low = getPriorityBadgeConfig("LOW");
    assert.equal(low.label, "Tiêu chuẩn");
  });
});

describe("Executive Department Command Center Source Anti-Slop Audit", () => {
  const componentPath = path.join(
    process.cwd(),
    "src/components/tasks/executive-department-command-center.tsx"
  );

  test("File tồn tại và khai báo 'use client'", () => {
    assert.ok(fs.existsSync(componentPath), "Component file must exist");
    const content = fs.readFileSync(componentPath, "utf-8");
    assert.ok(
      content.trimStart().startsWith('"use client"'),
      'Must start with "use client"'
    );
  });

  test("Export ExecutiveDepartmentCommandCenter và DepartmentCommandCard", () => {
    const content = fs.readFileSync(componentPath, "utf-8");
    assert.ok(
      content.includes("export function ExecutiveDepartmentCommandCenter"),
      "Must export ExecutiveDepartmentCommandCenter"
    );
    assert.ok(
      content.includes("DepartmentCommandCard"),
      "Must define or export DepartmentCommandCard"
    );
  });

  test("0% decorative emojis trong toàn bộ component file", () => {
    const emojiRegex =
      /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const content = fs.readFileSync(componentPath, "utf-8");
    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      assert.ok(
        !emojiRegex.test(line),
        `Found decorative emoji at line ${idx + 1}: ${line}`
      );
    });
  });

  test("100% Lucide React icons sử dụng strokeWidth={1.5}", () => {
    const content = fs.readFileSync(componentPath, "utf-8");
    assert.ok(
      content.includes("strokeWidth={1.5}"),
      "All icons must have strokeWidth={1.5}"
    );

    // Ensure no strokeWidth={2} or default 2
    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      if (line.includes("<") && /<[A-Z][a-zA-Z0-9]+.*strokeWidth=/.test(line)) {
        assert.ok(
          line.includes("strokeWidth={1.5}") || line.includes('strokeWidth="1.5"'),
          `Icon without strokeWidth={1.5} at line ${idx + 1}: ${line}`
        );
      }
    });
  });

  test("Tất cả con số, tỷ lệ % và số liệu sử dụng font-mono tabular-nums", () => {
    const content = fs.readFileSync(componentPath, "utf-8");
    assert.ok(content.includes("font-mono"), "Must use font-mono");
    assert.ok(content.includes("tabular-nums"), "Must use tabular-nums");
  });

  test("Có đủ 3 tabs Triage theo đúng yêu cầu nghiệp vụ", () => {
    const content = fs.readFileSync(componentPath, "utf-8");
    assert.ok(
      content.includes("Tất cả đơn vị"),
      "Must contain tab 'Tất cả đơn vị'"
    );
    assert.ok(
      content.includes("Điểm nghẽn cần BGH chỉ đạo"),
      "Must contain tab 'Điểm nghẽn cần BGH chỉ đạo'"
    );
    assert.ok(
      content.includes("Chờ BGH ký duyệt"),
      "Must contain tab 'Chờ BGH ký duyệt'"
    );
  });

  test("Thẻ đơn vị có nút hành động 'Soi chi tiết việc đơn vị' với ChevronRight", () => {
    const content = fs.readFileSync(componentPath, "utf-8");
    assert.ok(
      content.includes("Soi chi tiết việc đơn vị"),
      "Must include button text 'Soi chi tiết việc đơn vị'"
    );
    assert.ok(
      content.includes("ChevronRight"),
      "Must use ChevronRight icon for action footer"
    );
  });

  test("Không chứa ký tự thay thế hỏng (replacement character)", () => {
    const content = fs.readFileSync(componentPath, "utf-8");
    assert.ok(!content.includes("�"), "Must not contain replacement character");
  });
});
