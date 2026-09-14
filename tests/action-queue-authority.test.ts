import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  UniversalActionQueue,
  getActionQueueButtonMeta,
} from "../src/components/workspace/components/universal-action-queue";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";
import type { UniversalActionQueueItems } from "../src/components/workspace/types";

describe("UniversalActionQueue Authority Semantics & Action Badges", () => {
  const mockSchoolTask: SchoolTask = {
    id: "TASK-PARENT-100",
    taskCode: "NV-TRUONG-100",
    title: "Xây dựng khung năng lực DACUM toàn trường",
    department: "Phòng Đào tạo",
    departmentCode: "P_DAO_TAO",
    leadDepartment: "Phòng Đào tạo",
    leadDepartmentCode: "P_DAO_TAO",
    leadAssigneeName: "TS. Nguyễn Văn Trưởng",
    coAssignees: [],
    assignedDate: "2026-09-01",
    status: "PENDING_EXECUTIVE_APPROVAL",
    category: "KHAC",
    categoryLabel: "Đào tạo",
    assignedTo: "TS. Nguyễn Văn Trưởng",
    dueDate: "2026-09-20",
    progressPercent: 75,
    subTasks: [],
    totalSubTasks: 0,
    completedSubTasks: 0,
  };

  const mockSubTask: StaffTask = {
    id: "SUBTASK-200",
    parentSchoolTaskId: "TASK-PARENT-100",
    title: "Khảo sát kỹ năng nghề cho Khoa Cơ khí",
    assignedTo: "ThS. Lê Kỹ Sư",
    assigneeName: "ThS. Lê Kỹ Sư",
    status: "NEEDS_REVIEW",
    dueDate: "2026-09-05", // Overdue
    department: "Khoa Cơ khí",
    departmentCode: "K_CO_KHI",
    updatedAt: "2026-09-08T10:00:00Z",
  };

  test("getActionQueueButtonMeta resolves correct labels by scope and action item type", () => {
    const schoolApproval = getActionQueueButtonMeta("school", "approval");
    assert.equal(schoolApproval.label, "Phê duyệt");

    const unitApproval = getActionQueueButtonMeta("unit", "approval");
    assert.equal(unitApproval.label, "Thẩm định L1");

    const staffSubmission = getActionQueueButtonMeta("my", "submission");
    assert.equal(staffSubmission.label, "Nộp minh chứng");
  });

  test("renders executive approval button 'Phê duyệt' and 'Cần duyệt' badge for school scope", () => {
    const actionQueue: UniversalActionQueueItems = {
      pendingApprovals: [
        {
          task: mockSchoolTask,
          parentTaskTitle: mockSchoolTask.title,
          parentTaskCode: mockSchoolTask.taskCode,
          submittedBy: "TS. Nguyễn Văn Trưởng",
          complianceScore: 95,
        },
      ],
      myPendingSubmissions: [],
    };

    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        scope: "school",
        onSelectTask: () => {},
      })
    );

    assert.ok(html.includes("Phê duyệt"), "School scope must display 'Phê duyệt' action");
    assert.ok(html.includes("Chờ BGH phê duyệt"), "Header must indicate Executive review");
    assert.ok(html.includes("Cần duyệt"), "Approval item must show 'Cần duyệt' badge");
  });

  test("renders Unit Head action 'Thẩm định L1', 'Giao việc con' and 'Phân công' badge for unit scope", () => {
    const actionQueue: UniversalActionQueueItems = {
      pendingApprovals: [
        {
          task: mockSubTask,
          parentTaskTitle: mockSchoolTask.title,
          parentTaskCode: mockSchoolTask.taskCode,
          parentTaskId: mockSchoolTask.id,
          submittedBy: "ThS. Lê Kỹ Sư",
          complianceScore: 88,
        },
      ],
      myPendingSubmissions: [],
    };

    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        scope: "unit",
        onSelectTask: () => {},
        onCreateSubtask: () => {},
      })
    );

    assert.ok(html.includes("Thẩm định L1"), "Unit scope must display 'Thẩm định L1' button");
    assert.ok(html.includes("Phân công con") || html.includes("Phân công"), "Unit scope must display 'Phân công' button");
    assert.ok(html.includes("Cần duyệt"), "Approval item must show 'Cần duyệt' badge");
  });

  test("renders submission badge 'Chờ nộp BC' and 'Nộp minh chứng' button for personal scope", () => {
    const actionQueue: UniversalActionQueueItems = {
      pendingApprovals: [],
      myPendingSubmissions: [
        {
          task: mockSubTask,
          parentTaskTitle: mockSchoolTask.title,
          parentTaskCode: mockSchoolTask.taskCode,
          parentTaskId: mockSchoolTask.id,
          dueDate: "2026-09-05",
          isOverdue: true,
        },
      ],
    };

    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        scope: "my",
        onSelectTask: () => {},
      })
    );

    assert.ok(html.includes("Nộp minh chứng"), "Personal scope must display 'Nộp minh chứng' button");
    assert.ok(html.includes("Chờ nộp BC"), "Submission item must show 'Chờ nộp BC' badge");
  });

  test("displays parent task code and title hierarchy with distinct styling", () => {
    const actionQueue: UniversalActionQueueItems = {
      pendingApprovals: [
        {
          task: mockSubTask,
          parentTaskTitle: mockSchoolTask.title,
          parentTaskCode: mockSchoolTask.taskCode,
          parentTaskId: mockSchoolTask.id,
          submittedBy: "ThS. Lê Kỹ Sư",
        },
      ],
      myPendingSubmissions: [],
    };

    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        scope: "unit",
        onSelectTask: () => {},
      })
    );

    assert.ok(html.includes(mockSchoolTask.taskCode!), "Must render parent taskCode in markup");
    assert.ok(html.includes(mockSchoolTask.title), "Must render parent task title in hierarchy");
  });

  test("renders 'Đôn đốc DRI' expedite button for overdue tasks when onRemindDRI is provided", () => {
    const actionQueue: UniversalActionQueueItems = {
      pendingApprovals: [
        {
          task: { ...mockSubTask, dueDate: "2026-09-01" },
          parentTaskTitle: mockSchoolTask.title,
          submittedBy: "ThS. Lê Kỹ Sư",
        },
      ],
      myPendingSubmissions: [],
    };

    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        scope: "unit",
        onSelectTask: () => {},
        onRemindDRI: () => {},
      })
    );

    assert.ok(html.includes("Đôn đốc DRI"), "Must render 'Đôn đốc DRI' button for overdue tasks");
  });

  test("strictly complies with light-only standard (no dark: classes) and zero emojis", () => {
    const actionQueue: UniversalActionQueueItems = {
      pendingApprovals: [
        {
          task: mockSubTask,
          parentTaskTitle: mockSchoolTask.title,
          parentTaskCode: mockSchoolTask.taskCode,
          submittedBy: "ThS. Lê Kỹ Sư",
        },
      ],
      myPendingSubmissions: [
        {
          task: mockSubTask,
          parentTaskTitle: mockSchoolTask.title,
          parentTaskCode: mockSchoolTask.taskCode,
          dueDate: "2026-09-05",
          isOverdue: true,
        },
      ],
    };

    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue,
        scope: "unit",
        onSelectTask: () => {},
        onCreateSubtask: () => {},
        onRemindDRI: () => {},
      })
    );

    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "Action queue markup must contain zero emojis");
    assert.ok(!html.includes("dark:"), "Action queue markup must not contain dark: classes");
  });
});


/* ===== merged from tests/universal-action-queue.test.ts ===== */








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


/* ===== merged from tests/universal-action-queue-semantics.test.ts ===== */




test("action queue determines appropriate action label based on scope and role", () => {
  const schoolApproval = getActionQueueButtonMeta("school", "approval");
  assert.equal(schoolApproval.label, "Phê duyệt");

  const unitApproval = getActionQueueButtonMeta("unit", "approval");
  assert.equal(unitApproval.label, "Thẩm định L1");

  const staffSubmission = getActionQueueButtonMeta("my", "submission");
  assert.equal(staffSubmission.label, "Nộp minh chứng");
});
