import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import {
  StaffFocusView,
  extractStaffTasks,
  categorizeStaffTasks,
  getStaffHeroStats,
  type StaffFocusViewProps,
  type StaffTaskWithContext,
} from "../src/components/dashboard/roles/staff-focus-view";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";

// -- Mock Fixtures -----------------------------------------------------------

const mockStaffUser: AuthUser = {
  id: "user-staff-vinh",
  name: "Nguyễn Ngọc Vinh",
  email: "vinhnn@cdktcnqn.edu.vn",
  role: "STAFF",
  roleLabel: "Chuyên viên CNTT (Nguyễn Ngọc Vinh)",
  department: "Khoa Công nghệ thông tin",
  departmentCode: "CNTT",
};

const mockOtherUser: AuthUser = {
  id: "user-staff-hoa",
  name: "Lê Thị Hoa",
  email: "hoalt@cdktcnqn.edu.vn",
  role: "STAFF",
  roleLabel: "Chuyên viên Đào tạo (Lê Thị Hoa)",
  department: "Phòng Đào tạo & QLKH",
  departmentCode: "DAO_TAO",
};

const REFERENCE_DATE = "2026-09-07";

const mockSchoolTasks: SchoolTask[] = [
  {
    id: "school-task-1",
    title: "Nâng cấp Hạ tầng Số và Cổng thông tin Đào tạo",
    category: "CNTT",
    categoryLabel: "Công nghệ thông tin",
    leadAssigneeName: "Trần Hùng",
    leadDepartment: "Phòng Đào tạo & QLKH",
    leadDepartmentCode: "DAO_TAO",
    coAssignees: ["Nguyễn Ngọc Vinh"],
    assignedDate: "2026-09-01",
    dueDate: "2026-09-30",
    status: "IN_PROGRESS",
    progressPercent: 40,
    totalSubTasks: 3,
    completedSubTasks: 1,
    subTasks: [
      {
        id: "sub-urgent-1",
        title: "Cấu hình phân quyền CSDL cho giảng viên",
        assigneeName: "Nguyễn Ngọc Vinh",
        assigneeId: "user-staff-vinh",
        status: "IN_PROGRESS",
        dueDate: "2026-09-05", // Overdue relative to 2026-09-07
        parentSchoolTaskId: "school-task-1",
        updatedAt: "2026-09-05",
        departmentCode: "CNTT",
      },
      {
        id: "sub-today-2",
        title: "Kiểm tra kết nối máy chủ đào tạo trực tuyến",
        assigneeName: "Nguyễn Ngọc Vinh",
        assigneeId: "user-staff-vinh",
        status: "IN_PROGRESS",
        dueDate: "2026-09-07", // Due today
        parentSchoolTaskId: "school-task-1",
        updatedAt: "2026-09-06",
        departmentCode: "CNTT",
      },
      {
        id: "sub-other-staff",
        title: "Soạn thảo biểu mẫu khảo sát sinh viên",
        assigneeName: "Lê Thị Hoa",
        assigneeId: "user-staff-hoa",
        status: "IN_PROGRESS",
        dueDate: "2026-09-10",
        parentSchoolTaskId: "school-task-1",
        updatedAt: "2026-09-06",
        departmentCode: "DAO_TAO",
      },
    ],
  },
  {
    id: "school-task-2",
    title: "Triển khai Hệ thống Bảo mật & Giám sát ATTT",
    category: "ATTT",
    categoryLabel: "An toàn thông tin",
    leadAssigneeName: "Nguyễn Ngọc Vinh",
    leadDepartment: "Khoa Công nghệ thông tin",
    leadDepartmentCode: "CNTT",
    coAssignees: [],
    assignedDate: "2026-09-02",
    dueDate: "2026-09-20",
    status: "IN_PROGRESS",
    progressPercent: 50,
    totalSubTasks: 2,
    completedSubTasks: 0,
    subTasks: [
      {
        id: "sub-week-3",
        title: "Cập nhật chứng chỉ số SSL máy chủ nội bộ",
        assigneeName: "Nguyễn Ngọc Vinh",
        assigneeId: "user-staff-vinh",
        status: "IN_PROGRESS",
        dueDate: "2026-09-11", // Within 7 days of 2026-09-07
        parentSchoolTaskId: "school-task-2",
        updatedAt: "2026-09-06",
        departmentCode: "CNTT",
      },
      {
        id: "sub-review-4",
        title: "Báo cáo rà soát lỗ hổng cổng thông tin quý 3",
        assigneeName: "Nguyễn Ngọc Vinh",
        assigneeId: "user-staff-vinh",
        status: "NEEDS_REVIEW", // Submitted / awaiting review
        dueDate: "2026-09-08",
        parentSchoolTaskId: "school-task-2",
        updatedAt: "2026-09-07",
        departmentCode: "CNTT",
        deliverables: [
          {
            id: "del-1",
            name: "Bao-cao-lo-hong-ATTT-Q3.pdf",
            submittedAt: "2026-09-07",
          },
        ],
      },
    ],
  },
  {
    id: "school-task-3",
    title: "Tập huấn Ứng dụng AI trong Soạn bài giảng",
    category: "CHUYEN_DOI_SO",
    categoryLabel: "Chuyển đổi số",
    leadAssigneeName: "Lê Thị Hoa",
    coAssignees: [],
    assignedDate: "2026-08-20",
    dueDate: "2026-09-05",
    status: "COMPLETED",
    progressPercent: 100,
    totalSubTasks: 1,
    completedSubTasks: 1,
    subTasks: [
      {
        id: "sub-done-5",
        title: "Biên tập tài liệu hướng dẫn AI cho giảng viên",
        assigneeName: "Nguyễn Ngọc Vinh",
        assigneeId: "user-staff-vinh",
        status: "COMPLETED",
        dueDate: "2026-09-04",
        parentSchoolTaskId: "school-task-3",
        updatedAt: "2026-09-04",
        departmentCode: "CNTT",
      },
    ],
  },
];

// -- Unit Tests: Extraction & Categorization ----------------------------------

describe("StaffFocusView Helpers", () => {
  test("extractStaffTasks filters only subtasks assigned to current staff user", () => {
    const staffTasks = extractStaffTasks(mockSchoolTasks, mockStaffUser);
    assert.equal(staffTasks.length, 5);

    // Ensure other user's subtasks are excluded
    const hasOtherUserTask = staffTasks.some((t) => t.id === "sub-other-staff");
    assert.equal(hasOtherUserTask, false);

    // Verifies parent context attached
    const taskUrgent = staffTasks.find((t) => t.id === "sub-urgent-1");
    assert.ok(taskUrgent);
    assert.equal(taskUrgent.parentTaskTitle, "Nâng cấp Hạ tầng Số và Cổng thông tin Đào tạo");
    assert.equal(taskUrgent.parentTaskCategory, "CNTT");
    assert.equal(taskUrgent.parentCategoryLabel, "Công nghệ thông tin");
  });

  test("extractStaffTasks correctly handles empty tasks list", () => {
    const result = extractStaffTasks([], mockStaffUser);
    assert.deepEqual(result, []);
  });

  test("categorizeStaffTasks classifies tasks into 3 distinct operational tiers", () => {
    const staffTasks = extractStaffTasks(mockSchoolTasks, mockStaffUser);
    const categorized = categorizeStaffTasks(staffTasks, REFERENCE_DATE);

    // Tier 1: Urgent & Today (sub-urgent-1 [overdue] + sub-today-2 [due today])
    assert.equal(categorized.urgentToday.length, 2);
    assert.ok(categorized.urgentToday.some((t) => t.id === "sub-urgent-1"));
    assert.ok(categorized.urgentToday.some((t) => t.id === "sub-today-2"));

    // Tier 2: Sắp tới hạn / This Week (sub-week-3 [due 2026-09-11])
    assert.equal(categorized.thisWeek.length, 1);
    assert.ok(categorized.thisWeek.some((t) => t.id === "sub-week-3"));

    // Tier 3: Đang chờ duyệt / Awaiting Review (sub-review-4 [status: NEEDS_REVIEW])
    assert.equal(categorized.awaitingReview.length, 1);
    assert.ok(categorized.awaitingReview.some((t) => t.id === "sub-review-4"));

    // Completed tasks (sub-done-5)
    assert.equal(categorized.completed.length, 1);
    assert.ok(categorized.completed.some((t) => t.id === "sub-done-5"));
  });

  test("getStaffHeroStats computes accurate summary counts", () => {
    const staffTasks = extractStaffTasks(mockSchoolTasks, mockStaffUser);
    const categorized = categorizeStaffTasks(staffTasks, REFERENCE_DATE);
    const stats = getStaffHeroStats(categorized);

    // urgentToday: 2, awaitingReview: 1, completed: 1, thisWeek: 1
    assert.equal(stats.urgentTodayCount, 2);
    assert.equal(stats.awaitingReviewCount, 1);
    assert.equal(stats.completedCount, 1);
    assert.equal(stats.totalPending, 3); // urgentToday (2) + thisWeek (1)
  });
});

// -- Component Render Tests ---------------------------------------------------

describe("StaffFocusView Component", () => {
  test("renders Daily Hero Card with personalized greeting and metric pills", () => {
    const html = renderToStaticMarkup(
      React.createElement(StaffFocusView, {
        tasks: mockSchoolTasks,
        user: mockStaffUser,
        onSelectTask: () => {},
        onStatusChange: () => {},
        onOpenSubmitModal: () => {},
        todayDate: REFERENCE_DATE,
      })
    );

    // Greeting must include user's name
    assert.ok(
      html.includes("Nguyễn Ngọc Vinh"),
      "Hero card should include staff user's name"
    );

    // Number of urgent/pending tasks must be rendered
    assert.ok(
      html.includes("hôm nay bạn có"),
      "Hero card should have daily focus headline"
    );

    // Must render metric pills
    assert.ok(
      html.includes("Quá hạn &amp; Hôm nay") || html.includes("Quá hạn & Hôm nay"),
      "Should render urgent/today pill label"
    );
    assert.ok(
      html.includes("Đang chờ duyệt"),
      "Should render awaiting approval pill"
    );
    assert.ok(
      html.includes("Hoàn thành"),
      "Should render completed pill"
    );

    // Must have action-centric quick submit CTA
    assert.ok(
      html.includes("Báo cáo tiến độ") || html.includes("Nộp minh chứng"),
      "Hero card must include quick submit CTA"
    );
  });

  test("renders 3-tier task list sections with distinct tier headings", () => {
    const html = renderToStaticMarkup(
      React.createElement(StaffFocusView, {
        tasks: mockSchoolTasks,
        user: mockStaffUser,
        onSelectTask: () => {},
        onStatusChange: () => {},
        onOpenSubmitModal: () => {},
        todayDate: REFERENCE_DATE,
      })
    );

    // Tier 1 heading
    assert.ok(
      html.includes("Khẩn cấp &amp; Hôm nay") || html.includes("Khẩn cấp & Hôm nay") || html.includes("Cần xử lý ngay"),
      "Must render Tier 1 Urgent/Today section"
    );

    // Tier 2 heading
    assert.ok(
      html.includes("Sắp tới hạn") || html.includes("Trong tuần này"),
      "Must render Tier 2 Upcoming section"
    );

    // Tier 3 heading
    assert.ok(
      html.includes("Đang chờ duyệt") || html.includes("Đã nộp chờ duyệt"),
      "Must render Tier 3 Awaiting Review section"
    );

    // Task titles must be present
    assert.ok(html.includes("Cấu hình phân quyền CSDL cho giảng viên"));
    assert.ok(html.includes("Kiểm tra kết nối máy chủ đào tạo trực tuyến"));
    assert.ok(html.includes("Cập nhật chứng chỉ số SSL máy chủ nội bộ"));
    assert.ok(html.includes("Báo cáo rà soát lỗ hổng cổng thông tin quý 3"));
  });

  test("task card provides 1-click 'Nộp minh chứng' button", () => {
    const html = renderToStaticMarkup(
      React.createElement(StaffFocusView, {
        tasks: mockSchoolTasks,
        user: mockStaffUser,
        onSelectTask: () => {},
        onStatusChange: () => {},
        onOpenSubmitModal: () => {},
        todayDate: REFERENCE_DATE,
      })
    );

    assert.ok(
      html.includes("Nộp minh chứng"),
      "Task cards must include 1-click 'Nộp minh chứng' button"
    );
  });

  test("renders positive empty state when user has zero urgent/overdue tasks", () => {
    // Only completed tasks for this user
    const completedOnlyTasks: SchoolTask[] = [
      {
        id: "school-task-done",
        title: "Nhiệm vụ đã hoàn thành",
        category: "KHAC",
        categoryLabel: "Khác",
        leadAssigneeName: "Nguyễn Ngọc Vinh",
        coAssignees: [],
        assignedDate: "2026-08-01",
        dueDate: "2026-08-10",
        status: "COMPLETED",
        progressPercent: 100,
        totalSubTasks: 1,
        completedSubTasks: 1,
        subTasks: [
          {
            id: "sub-completed-only",
            title: "Công việc đã hoàn tất",
            assigneeName: "Nguyễn Ngọc Vinh",
            assigneeId: "user-staff-vinh",
            status: "COMPLETED",
            dueDate: "2026-08-05",
            parentSchoolTaskId: "school-task-done",
            updatedAt: "2026-08-05",
          },
        ],
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(StaffFocusView, {
        tasks: completedOnlyTasks,
        user: mockStaffUser,
        onSelectTask: () => {},
        onStatusChange: () => {},
        onOpenSubmitModal: () => {},
        todayDate: REFERENCE_DATE,
      })
    );

    // Positive reassurance messaging
    assert.ok(
      html.includes("Tuyệt vời") ||
      html.includes("Không có nhiệm vụ nào quá hạn") ||
      html.includes("hoàn tất"),
      "Must render positive empty state messaging"
    );
  });

  test("renders clean empty state when user has zero tasks assigned", () => {
    const html = renderToStaticMarkup(
      React.createElement(StaffFocusView, {
        tasks: [],
        user: mockStaffUser,
        onSelectTask: () => {},
        onStatusChange: () => {},
        onOpenSubmitModal: () => {},
        todayDate: REFERENCE_DATE,
      })
    );

    assert.ok(
      html.includes("Chưa có nhiệm vụ") || html.includes("chưa có nhiệm vụ"),
      "Must render clear empty state when no tasks are assigned"
    );
  });
});

// -- Anti-Slop & Quality Discipline Tests -------------------------------------

describe("StaffFocusView Anti-Slop & Design Token Conformance", () => {
  const componentPath = path.join(
    process.cwd(),
    "src/components/dashboard/roles/staff-focus-view.tsx"
  );

  test("anti-slop: 0% emojis in source code", () => {
    assert.ok(fs.existsSync(componentPath), "Component file must exist");
    const content = fs.readFileSync(componentPath, "utf-8");

    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const lines = content.split("\n");
    const violations: string[] = [];

    lines.forEach((line, idx) => {
      if (emojiRegex.test(line)) {
        violations.push(`Line ${idx + 1}: ${line.trim()}`);
      }
    });

    assert.strictEqual(
      violations.length,
      0,
      `Found emojis in staff-focus-view.tsx:\n${violations.join("\n")}`
    );
  });

  test("anti-slop: utilizes tabular-nums for numeric figures and dates", () => {
    assert.ok(fs.existsSync(componentPath), "Component file must exist");
    const content = fs.readFileSync(componentPath, "utf-8");

    assert.ok(
      content.includes("tabular-nums"),
      "Component must use tabular-nums for numeric precision"
    );
  });

  test("anti-slop: Lucide icon stroke widths strictly adhere to 1.5 standard", () => {
    assert.ok(fs.existsSync(componentPath), "Component file must exist");
    const content = fs.readFileSync(componentPath, "utf-8");

    if (content.includes('from "lucide-react"')) {
      assert.ok(
        content.includes("strokeWidth={1.5}") || content.includes('strokeWidth="1.5"'),
        "Lucide icons must have strokeWidth 1.5"
      );
    }
  });

  test("styling: uses Tailwind v4 semantic tokens and font classes", () => {
    assert.ok(fs.existsSync(componentPath), "Component file must exist");
    const content = fs.readFileSync(componentPath, "utf-8");

    assert.ok(
      content.includes("font-heading") || content.includes("font-mono"),
      "Component must use project font tokens (font-heading, font-mono)"
    );
    assert.ok(
      content.includes("bg-background") || content.includes("bg-card") || content.includes("border-border"),
      "Component must use semantic Tailwind tokens"
    );
  });
});
