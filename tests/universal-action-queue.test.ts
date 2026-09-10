import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UniversalActionQueue } from "../src/components/workspace/components/universal-action-queue";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";
import type { UniversalActionQueueItems } from "../src/components/workspace/types";

describe("UniversalActionQueue Component", () => {
  const mockTask: SchoolTask = {
    id: "TASK-1",
    taskCode: "NV-01",
    title: "Nghiệm thu Đề cương bài giảng",
    department: "Khoa CNTT",
    departmentCode: "K_CNTT",
    leadDepartment: "Khoa CNTT",
    leadDepartmentCode: "K_CNTT",
    leadAssigneeName: "ThS. Lê Văn Phó",
    coAssignees: [],
    assignedDate: "2026-09-01",
    status: "PENDING_EXECUTIVE_APPROVAL",
    category: "CNTT",
    categoryLabel: "Công nghệ thông tin",
    assignedTo: "ThS. Lê Văn Phó",
    dueDate: "2026-09-15",
    progressPercent: 85,
    subTasks: [],
    totalSubTasks: 0,
    completedSubTasks: 0,
  };

  const mockStaffTask: StaffTask = {
    id: "ST-1",
    parentSchoolTaskId: "TASK-1",
    title: "Biên soạn đề cương chi tiết môn AI",
    assignedTo: "GV. Trần Thị B",
    assigneeName: "GV. Trần Thị B",
    status: "IN_PROGRESS",
    dueDate: "2026-09-07",
    department: "Khoa CNTT",
    departmentCode: "K_CNTT",
    updatedAt: "2026-09-08T08:00:00Z",
  };

  const actionQueue: UniversalActionQueueItems = {
    pendingApprovals: [
      {
        task: mockTask,
        parentTaskTitle: mockTask.title,
        submittedBy: "ThS. Lê Văn Phó",
        submittedAt: "2026-09-08T08:00:00Z",
        complianceScore: 92,
      },
    ],
    myPendingSubmissions: [
      {
        task: mockStaffTask,
        parentTaskTitle: mockTask.title,
        dueDate: "2026-09-07",
        isOverdue: true,
      },
    ],
  };

  test("renders approval in-tray card when pendingApprovals exist", () => {
    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        onSelectTask: () => {},
      })
    );

    assert.ok(html.includes("Hàng đợi thẩm định"), "Should render approval header");
    assert.ok(html.includes("Nghiệm thu Đề cương bài giảng"), "Should render task title");
    assert.ok(html.includes("ThS. Lê Văn Phó"), "Should render submitter name");
    assert.ok(html.includes('data-slot="universal-action-queue"'));
  });

  test("zero emojis in rendered markup", () => {
    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        onSelectTask: () => {},
      })
    );
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "Markup must be 100% free of emojis");
  });

  test("zero dark theme classes in rendered markup", () => {
    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        onSelectTask: () => {},
      })
    );
    assert.ok(!html.includes("dark:"), "Must follow light-only standard without dark: variants");
  });

  test("renders empty state when actionQueue has no items", () => {
    const emptyQueue: UniversalActionQueueItems = {
      pendingApprovals: [],
      myPendingSubmissions: [],
    };

    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue: emptyQueue,
        onSelectTask: () => {},
      })
    );

    assert.ok(
      html.includes("Không có nhiệm vụ cần xử lý gấp") || html.includes("Không có tác vụ nào cần xử lý khẩn cấp"),
      "Must render empty state message"
    );
    assert.ok(html.includes('data-slot="universal-action-queue"'));
  });

  test("renders critical deadline warning banner when overdue > 0", () => {
    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        onSelectTask: () => {},
      })
    );

    assert.ok(html.includes("Cảnh báo hạn chót khẩn cấp") || html.includes("quá hạn"), "Shows deadline warning banner");
    assert.ok(html.includes("font-mono"), "Uses font-mono for numbers");
    assert.ok(html.includes("tabular-nums"), "Uses tabular-nums for numbers");
  });

  test("renders contextual buttons for school scope: Phê duyệt", () => {
    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        scope: "school",
        onSelectTask: () => {},
      })
    );

    assert.ok(html.includes("Phê duyệt") || html.includes("Duyệt nhanh"), "Should render 'Phê duyệt' button for school scope");
  });

  test("renders contextual buttons for unit scope: Phân công", () => {
    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        scope: "unit",
        onSelectTask: () => {},
      })
    );

    assert.ok(html.includes("Phân công") || html.includes("Giao việc") || html.includes("Thẩm định"), "Should render contextual unit action button");
  });

  test("renders contextual buttons for my scope: Nộp minh chứng or Cập nhật", () => {
    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        scope: "my",
        onSelectTask: () => {},
      })
    );

    assert.ok(html.includes("Nộp minh chứng") || html.includes("Cập nhật"), "Should render personal action button");
  });

  test("renders collapsible tray toggle when items count > 3", () => {
    const manyApprovals = Array.from({ length: 5 }).map((_, i) => ({
      task: {
        ...mockTask,
        id: `TASK-${i + 1}`,
        title: `Nhiệm vụ kiểm định số ${i + 1}`,
      },
      parentTaskTitle: `Nhiệm vụ kiểm định số ${i + 1}`,
      submittedBy: `Cán bộ ${i + 1}`,
      submittedAt: "2026-09-08T08:00:00Z",
    }));

    const queueWithManyItems: UniversalActionQueueItems = {
      pendingApprovals: manyApprovals,
      myPendingSubmissions: [],
    };

    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue: queueWithManyItems,
        onSelectTask: () => {},
      })
    );

    assert.ok(
      html.includes("Xem thêm") || html.includes("Thu gọn"),
      "Should render collapsible tray control when count > 3"
    );
    assert.ok(
      html.includes('aria-expanded="false"'),
      "Should specify aria-expanded for screen readers on collapsible toggle"
    );
  });

  test("a11y and ergonomic enhancements on warning banner and action buttons", () => {
    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        scope: "school",
        onSelectTask: () => {},
      })
    );

    // Overdue banner accessibility
    assert.ok(html.includes('role="alert"'), "Banner must have role=alert for urgent notifications");
    assert.ok(html.includes('aria-live="polite"'), "Banner must have aria-live=polite");

    // Action button touch target ergonomics
    assert.ok(html.includes("min-h-[44px]") || html.includes("min-h-[30px]"), "Action buttons must meet minimum touch target height");
  });
});
