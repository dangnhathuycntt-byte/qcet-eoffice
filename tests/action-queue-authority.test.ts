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
