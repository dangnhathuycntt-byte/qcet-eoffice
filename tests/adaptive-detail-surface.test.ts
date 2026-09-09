import { test, describe } from "node:test";
import assert from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskDetailSideSheet } from "@/components/dashboard/task-detail-side-sheet";
import { UnifiedAdaptiveWorkspace } from "@/components/workspace/unified-adaptive-workspace";
import { ModularCascadingTaskTable } from "@/components/tasks/table/modular-cascading-task-table";
import {
  parseTaskUrlParams,
  buildTaskUrlQuery,
  syncTaskUrlParams,
} from "@/hooks/use-task-filters";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";

const sampleUser: AuthUser = {
  id: "user-admin-01",
  name: "PGS.TS Nguyễn Văn A",
  email: "nguyenvana@qcet.edu.vn",
  role: "ADMIN",
  roleLabel: "Ban Giám hiệu",
  department: "Ban Giám hiệu",
  departmentCode: "BGH",
};

const staffUser: AuthUser = {
  id: "user-staff-01",
  name: "ThS. Trần Thị B",
  email: "tranthib@qcet.edu.vn",
  role: "STAFF",
  roleLabel: "Giảng viên",
  department: "Khoa Công nghệ Thông tin",
  departmentCode: "K_CNTT",
};

const sampleTasks: SchoolTask[] = [
  {
    id: "task-01",
    code: "NV-2026-09-001",
    title: "Triển khai hệ thống tự đánh giá chương trình đào tạo theo chuẩn AUN-QA",
    description: "Thực hiện rà soát và hoàn thiện hồ sơ tự đánh giá cấp cơ sở.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    category: "CNTT",
    departmentId: "dt-01",
    department: "Phòng Đào tạo & ĐBCL",
    leadAssigneeName: "ThS. Trần Thị B",
    leadAssigneeId: "user-staff-01",
    academicMonth: 9,
    academicYear: "2026-2027",
    progress: 60,
    startDate: "2026-09-01",
    dueDate: "2026-09-30",
    subTasks: [
      {
        id: "subtask-01",
        taskCode: "NV-2026-09-001-01",
        title: "Thu thập minh chứng tiêu chí 1 đến 5",
        status: "COMPLETED",
        priority: "HIGH",
        assignedTo: "user-staff-01",
        assigneeName: "ThS. Trần Thị B",
        dueDate: "2026-09-15",
        progress: 100,
        academicMonth: 9,
        academicYear: "2026-2027",
        parentSchoolTaskId: "task-01",
        updatedAt: "2026-09-01T00:00:00.000Z",
      } as StaffTask,
    ],
  } as unknown as SchoolTask,
  {
    id: "task-02",
    code: "NV-2026-09-002",
    title: "Tổ chức Hội nghị Khoa học Công nghệ và Đổi mới sáng tạo trẻ 2026",
    description: "Công tác tiếp nhận bài báo và tổ chức phản biện độc lập.",
    status: "NEW",
    priority: "NORMAL",
    category: "KHAC",
    departmentId: "khcn-01",
    department: "Phòng KHCN & HTQT",
    leadAssigneeName: "TS. Lê Văn C",
    leadAssigneeId: "user-staff-02",
    academicMonth: 9,
    academicYear: "2026-2027",
    progress: 10,
    startDate: "2026-09-05",
    dueDate: "2026-10-15",
    subTasks: [],
  } as unknown as SchoolTask,
];

describe("Task 4: Full-Width Task Canvas & Adaptive Detail Surface", () => {
  describe("1. Full-Width Task Canvas Structure", () => {
    test("workspace renders full-width task canvas without rigid action queue column by default", () => {
      const html = renderToStaticMarkup(
        React.createElement(UnifiedAdaptiveWorkspace, {
          tasks: sampleTasks,
          user: sampleUser,
          scope: "school",
          enableSplitCockpit: false,
        })
      );

      // Verify canvas container has data-slot="full-width-task-canvas" and 100% width
      assert.ok(
        html.includes('data-slot="full-width-task-canvas"'),
        "Workspace must render full-width task canvas container"
      );
      assert.ok(
        html.includes("w-full"),
        "Canvas container must occupy full width (w-full)"
      );

      // Verify no permanent 60/40 desktop split cockpit
      assert.ok(
        !html.includes('data-slot="split-cockpit-container"'),
        "Default workspace layout must not render rigid split cockpit container"
      );
    });

    test("modular task table renders full-width and receives active row selection", () => {
      const selectedTask = sampleTasks[0];
      const html = renderToStaticMarkup(
        React.createElement(ModularCascadingTaskTable, {
          tasks: sampleTasks,
          selectedTaskId: selectedTask.id,
          defaultExpanded: true,
        })
      );

      // Verify task code and titles are rendered
      assert.ok(
        html.includes("NV-2026-09-001"),
        "Table must render task code"
      );
      assert.ok(
        html.includes(selectedTask.title),
        "Table must render task title"
      );

      // Verify selected row is active
      assert.ok(
        html.includes("bg-primary/[0.04]") || html.includes("bg-slate-50") || html.includes("border-l-4"),
        "Selected task row must have active styling"
      );
    });
  });

  describe("2. Adaptive Detail Surface Presentation", () => {
    test("TaskDetailSideSheet renders responsive side sheet with backdrop when isOpen is true", () => {
      const task = sampleTasks[0];
      const html = renderToStaticMarkup(
        React.createElement(TaskDetailSideSheet, {
          task,
          currentUser: sampleUser as any,
          isOpen: true,
          onClose: () => {},
        })
      );

      // Backdrop overlay
      assert.ok(
        html.includes('data-slot="side-sheet-backdrop"'),
        "Must render backdrop with overlay"
      );

      // Responsive dimensions: Mobile full-width, Tablet 520px, Large Desktop 560px
      assert.ok(
        html.includes("w-full"),
        "Must support full-width on mobile (< 768px)"
      );
      assert.ok(
        html.includes("md:w-[520px]") || html.includes("md:max-w-[520px]"),
        "Must support 520px width on tablet and standard desktop"
      );
      assert.ok(
        html.includes("2xl:w-[560px]") || html.includes("2xl:max-w-[560px]"),
        "Must support 560px width on large desktop"
      );

      // Close button with accessible label
      assert.ok(
        html.includes('aria-label="Đóng bảng chi tiết"') ||
          html.includes('aria-label="Đóng chi tiết nhiệm vụ"'),
        "Must include accessible close button"
      );

      // Task metadata rendering
      assert.ok(html.includes("NV-2026-09-001"), "Must display task code");
      assert.ok(html.includes(task.title), "Must display task title");
    });

    test("TaskDetailSideSheet returns null when isOpen is false", () => {
      const task = sampleTasks[0];
      const html = renderToStaticMarkup(
        React.createElement(TaskDetailSideSheet, {
          task,
          currentUser: sampleUser as any,
          isOpen: false,
          onClose: () => {},
        })
      );

      assert.strictEqual(html, "", "When isOpen is false, sheet must not render");
    });

    test("TaskDetailSideSheet returns null when task is null", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskDetailSideSheet, {
          task: null,
          currentUser: sampleUser as any,
          isOpen: true,
          onClose: () => {},
        })
      );

      assert.strictEqual(html, "", "When task is null, sheet must not render");
    });
  });

  describe("3. Selection and URL State Synchronization", () => {
    test("parseTaskUrlParams correctly extracts taskId parameter", () => {
      const search = "?taskId=NV-2026-09-001&scope=school&view=table";
      const params = parseTaskUrlParams(search);
      assert.strictEqual(params.taskId, "NV-2026-09-001");
      assert.strictEqual(params.scope, "school");
      assert.strictEqual(params.view, "table");
    });

    test("buildTaskUrlQuery serializes taskId correctly into query string", () => {
      const query = buildTaskUrlQuery({
        scope: "school",
        view: "table",
        taskId: "NV-2026-09-001",
      });
      assert.ok(query.includes("taskId=NV-2026-09-001"), "Query string must include taskId");
    });

    test("syncTaskUrlParams sets taskId when selecting task and deletes taskId when closing detail", () => {
      let currentUrl = "";
      const mockRouter = {
        push: (url: string) => {
          currentUrl = url;
        },
        replace: (url: string) => {
          currentUrl = url;
        },
      };

      // Select task
      syncTaskUrlParams(
        {
          scope: "school",
          taskId: "NV-2026-09-001",
        },
        mockRouter as any
      );
      assert.ok(
        currentUrl.includes("taskId=NV-2026-09-001"),
        "URL must include taskId when selecting task"
      );

      // Deselect task (close detail)
      syncTaskUrlParams(
        {
          scope: "school",
          taskId: null,
        },
        mockRouter as any
      );
      assert.ok(
        !currentUrl.includes("taskId="),
        "URL must not include taskId when detail is closed"
      );
    });
  });

  describe("4. Anti-Slop & Light-Only Standard", () => {
    test("TaskDetailSideSheet contains zero dark: classes and no decorative emojis", () => {
      const task = sampleTasks[0];
      const html = renderToStaticMarkup(
        React.createElement(TaskDetailSideSheet, {
          task,
          currentUser: sampleUser as any,
          isOpen: true,
          onClose: () => {},
        })
      );

      assert.ok(
        !html.includes("dark:"),
        "TaskDetailSideSheet must not contain any dark: CSS classes"
      );

      // Verify no decorative emojis in rendered HTML
      const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      assert.strictEqual(
        emojiRegex.test(html),
        false,
        "TaskDetailSideSheet must not contain decorative emojis"
      );
    });

    test("UnifiedAdaptiveWorkspace contains zero dark: classes", () => {
      const html = renderToStaticMarkup(
        React.createElement(UnifiedAdaptiveWorkspace, {
          tasks: sampleTasks,
          user: sampleUser,
          scope: "school",
        })
      );

      assert.ok(
        !html.includes("dark:"),
        "UnifiedAdaptiveWorkspace must not contain any dark: CSS classes"
      );
    });
  });
});
