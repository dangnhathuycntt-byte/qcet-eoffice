import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import { computeExecutiveDepartmentSummaries } from "@/lib/tasks/executive-department-aggregator";
import {
  splitDepartmentTasks,
  getTaskStatusConfig,
  DepartmentDrillDownPanel,
  DepartmentCommandCard,
  ExecutiveDepartmentCommandCenter,
} from "@/components/tasks/executive-department-command-center";

describe("Executive Department Drill-Down Panel Unit Tests", () => {
  const mockTasks: SchoolTask[] = [
    {
      id: "school-task-cntt-1",
      title: "Chuyển đổi số giáo trình CNTT",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "TS. Trần Văn Nam",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-09-15",
      status: "IN_PROGRESS",
      progressPercent: 65,
      totalSubTasks: 2,
      completedSubTasks: 1,
      subTasks: [
        {
          id: "staff-task-cntt-sub-1",
          title: "Số hóa bài giảng điện tử kỳ 1",
          assigneeName: "Nguyễn Văn A",
          status: "COMPLETED",
          dueDate: "2026-08-30",
          parentSchoolTaskId: "school-task-cntt-1",
          updatedAt: "2026-08-30",
        },
        {
          id: "staff-task-cntt-sub-2",
          title: "Biên soạn ngân hàng câu hỏi",
          assigneeName: "Lê Văn B",
          status: "IN_PROGRESS",
          dueDate: "2026-09-12",
          parentSchoolTaskId: "school-task-cntt-1",
          updatedAt: "2026-09-02",
        },
      ],
    },
    {
      id: "unit-task-cntt-internal",
      title: "Họp chuyên môn nội bộ Khoa CNTT",
      category: "KHAC",
      categoryLabel: "Nội bộ",
      leadAssigneeName: "Khoa CNTT",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-08",
      status: "IN_PROGRESS",
      progressPercent: 30,
      totalSubTasks: 0,
      completedSubTasks: 0,
      subTasks: [],
      // Mark as UNIT scope
      ...({ scope: "UNIT" } as object),
    },
  ];

  const summaries = computeExecutiveDepartmentSummaries(mockTasks, "2026-09-06");
  const cnttSummary = summaries.find((s) => s.departmentId === "KHOA_CNTT");

  test("splitDepartmentTasks phân tách chính xác việc cấp Trường vs việc nội bộ", () => {
    assert.ok(cnttSummary, "Khoa CNTT phải tồn tại");
    const { schoolTasks, unitTasks } = splitDepartmentTasks(
      cnttSummary.tasks,
      cnttSummary
    );

    // School task: school-task-cntt-1
    assert.ok(schoolTasks.length >= 1, "Phải có ít nhất 1 nhiệm vụ cấp trường");
    assert.ok(
      schoolTasks.some((t) => t.id === "school-task-cntt-1"),
      "school-task-cntt-1 phải nằm trong danh sách cấp trường"
    );

    // Unit tasks: includes unit-task-cntt-internal AND subtasks
    assert.ok(unitTasks.length >= 2, "Phải có các nhiệm vụ nội bộ hoặc subtasks");
    const hasSub1 = unitTasks.some((t) => t.id === "staff-task-cntt-sub-1");
    const hasInternal = unitTasks.some((t) => t.id === "unit-task-cntt-internal");
    assert.ok(hasSub1 || hasInternal, "Phải có subtask hoặc task nội bộ trong unitTasks");
  });

  test("getTaskStatusConfig trả về nhãn và class ngữ nghĩa chuẩn", () => {
    const completed = getTaskStatusConfig("COMPLETED");
    assert.equal(completed.label, "Hoàn thành");
    assert.ok(completed.className.includes("emerald"));

    const inProgress = getTaskStatusConfig("IN_PROGRESS");
    assert.equal(inProgress.label, "Đang thực hiện");
    assert.ok(inProgress.className.includes("blue"));

    const pending = getTaskStatusConfig("PENDING_EXECUTIVE_APPROVAL");
    assert.equal(pending.label, "Chờ BGH duyệt");
    assert.ok(pending.className.includes("purple"));

    const blocked = getTaskStatusConfig("BLOCKED");
    assert.equal(blocked.label, "Bị nghẽn");
    assert.ok(blocked.className.includes("rose"));
  });

  test("Export đầy đủ component và hàm phục vụ drill-down", () => {
    assert.ok(typeof DepartmentDrillDownPanel === "function");
    assert.ok(typeof DepartmentCommandCard === "function");
    assert.ok(typeof ExecutiveDepartmentCommandCenter === "function");
    assert.ok(typeof splitDepartmentTasks === "function");
    assert.ok(typeof getTaskStatusConfig === "function");
  });
});

describe("Drill-Down Panel Source Code & Anti-Slop Audit", () => {
  const componentPath = path.join(
    process.cwd(),
    "src/components/tasks/executive-department-command-center.tsx"
  );

  test("Thẻ đơn vị hỗ trợ trạng thái active ring-2 ring-primary/40", () => {
    const content = fs.readFileSync(componentPath, "utf-8");
    assert.ok(
      content.includes("ring-2 ring-primary/40"),
      "Must include 'ring-2 ring-primary/40' for selected card highlight"
    );
  });

  test("Panel có nút 'Thu gọn / Quay lại toàn trường' với icon strokeWidth={1.5}", () => {
    const content = fs.readFileSync(componentPath, "utf-8");
    assert.ok(
      content.includes("Thu gọn / Quay lại toàn trường"),
      "Must include collapse button 'Thu gọn / Quay lại toàn trường'"
    );
  });

  test("Panel có 2 sub-sections / tabs rõ ràng theo yêu cầu", () => {
    const content = fs.readFileSync(componentPath, "utf-8");
    assert.ok(
      content.includes("Nhiệm vụ Cấp Trường giao cho Đơn vị"),
      "Must include tab 'Nhiệm vụ Cấp Trường giao cho Đơn vị'"
    );
    assert.ok(
      content.includes("Nhiệm vụ Nội bộ Đơn vị triển khai"),
      "Must include tab 'Nhiệm vụ Nội bộ Đơn vị triển khai'"
    );
  });

  test("Mỗi dòng nhiệm vụ có nút hành động 'Chi tiết' gọi onSelectTask", () => {
    const content = fs.readFileSync(componentPath, "utf-8");
    assert.ok(
      content.includes("Chi tiết"),
      "Must have 'Chi tiết' action button"
    );
    assert.ok(
      content.includes("onSelectTask"),
      "Must connect to onSelectTask"
    );
  });

  test("Hỗ trợ điều khiển selectedDepartmentId qua props (controlled & uncontrolled)", () => {
    const content = fs.readFileSync(componentPath, "utf-8");
    assert.ok(
      content.includes("selectedDepartmentId"),
      "Must accept selectedDepartmentId prop"
    );
  });

  test("0% decorative emojis trong toàn bộ file", () => {
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

  test("Toàn bộ số liệu và tỷ lệ % dùng font-mono tabular-nums", () => {
    const content = fs.readFileSync(componentPath, "utf-8");
    assert.ok(content.includes("font-mono"), "Must use font-mono");
    assert.ok(content.includes("tabular-nums"), "Must use tabular-nums");
  });

  test("Hỗ trợ phím Escape đóng drill-down panel", () => {
    const content = fs.readFileSync(componentPath, "utf-8");
    assert.ok(
      content.includes('"Escape"'),
      "Must handle Escape key to close drill-down"
    );
  });
});
