import { test, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getCategoryBadgeConfig,
  getStatusBadgeConfig,
  CATEGORY_TABS,
  filterTasksForTable,
} from "../src/components/dashboard/cascading-task-table";
import { flattenPersonalTasks } from "../src/components/tasks/cascading-task-table";
import type { SchoolTask } from "../src/types/dashboard";

describe("CascadingTaskTable Helpers", () => {
  test("provides distinct subtle badge styling for categories", () => {
    const attt = getCategoryBadgeConfig("ATTT");
    assert.equal(attt.label, "An toàn thông tin");
    assert.ok(attt.className.includes("text-"));

    const cds = getCategoryBadgeConfig("CHUYEN_DOI_SO");
    assert.equal(cds.label, "Chuyển đổi số");
    assert.ok(cds.className.includes("text-"));

    const cntt = getCategoryBadgeConfig("CNTT");
    assert.equal(cntt.label, "CNTT");

    const tt = getCategoryBadgeConfig("TRUYEN_THONG");
    assert.equal(tt.label, "Truyền thông");

    const tv = getCategoryBadgeConfig("THU_VIEN");
    assert.equal(tv.label, "Thư viện");

    const bc = getCategoryBadgeConfig("BAO_CAO");
    assert.equal(bc.label, "Báo cáo");

    const khac = getCategoryBadgeConfig("KHAC");
    assert.equal(khac.label, "Khác");
  });

  test("provides status badge config with Vietnamese labels", () => {
    const sNew = getStatusBadgeConfig("NEW");
    assert.equal(sNew.label, "Mới");
    assert.ok(
      sNew.className.includes("text-red-") || sNew.className.includes("text-rose-")
    );

    const sInProgress = getStatusBadgeConfig("IN_PROGRESS");
    assert.equal(sInProgress.label, "Đang thực hiện");
    assert.ok(sInProgress.className.includes("text-blue-700"));

    const sReview = getStatusBadgeConfig("NEEDS_REVIEW");
    assert.equal(sReview.label, "Cần chỉnh sửa");
    assert.ok(sReview.className.includes("text-amber-700"));

    const sDone = getStatusBadgeConfig("COMPLETED");
    assert.equal(sDone.label, "Hoàn thành");
    assert.ok(sDone.className.includes("text-emerald-700"));

    const sOverdue = getStatusBadgeConfig("OVERDUE");
    assert.equal(sOverdue.label, "Quá hạn");
    assert.ok(sOverdue.className.includes("text-rose-700"));
  });

  test("CATEGORY_TABS labels contain zero emojis", () => {
    CATEGORY_TABS.forEach((tab) => {
      assert.match(
        tab.label,
        /^[\p{L}\p{N}\s\-\/]+$/u,
        `Tab ${tab.label} must not contain emojis`
      );
    });
  });

  test("CATEGORY_TABS defines all required category filters in proper order", () => {
    const labels = CATEGORY_TABS.map((t) => t.label);
    assert.deepEqual(labels, [
      "Tất cả",
      "Chuyển đổi số",
      "Truyền thông",
      "CNTT",
      "An toàn thông tin",
      "Thư viện",
      "Báo cáo",
    ]);
  });

  test("filterTasksForTable filters by category and search keyword across parent and subtasks", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-1",
        title: "Triển khai SSO tập trung",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadAssigneeName: "Trần Hùng",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-15",
        status: "IN_PROGRESS",
        subTasks: [
          {
            id: "sub-1",
            title: "Cấu hình SAML 2.0",
            assigneeName: "Nguyễn Ngọc Vinh",
            status: "IN_PROGRESS",
            dueDate: "2026-09-10",
            parentSchoolTaskId: "task-1",
            updatedAt: "2026-09-02",
          },
        ],
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 0,
      },
      {
        id: "task-2",
        title: "Báo cáo an toàn thông tin tháng 8",
        category: "ATTT",
        categoryLabel: "An toàn thông tin",
        leadAssigneeName: "Mai Đinh Thị Xuân",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-05",
        status: "COMPLETED",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 100,
      },
    ];

    // Filter by category
    const atttOnly = filterTasksForTable(mockTasks, "ATTT", "");
    assert.equal(atttOnly.length, 1);
    assert.equal(atttOnly[0].id, "task-2");

    // All categories
    const all = filterTasksForTable(mockTasks, "ALL", "");
    assert.equal(all.length, 2);

    // Search by parent title
    const searchSSO = filterTasksForTable(mockTasks, "ALL", "SSO");
    assert.equal(searchSSO.length, 1);
    assert.equal(searchSSO[0].id, "task-1");

    // Search by subtask title
    const searchSAML = filterTasksForTable(mockTasks, "ALL", "SAML");
    assert.equal(searchSAML.length, 1);
    assert.equal(searchSAML[0].id, "task-1");

    // Search by assignee
    const searchVinh = filterTasksForTable(mockTasks, "ALL", "Vinh");
    assert.equal(searchVinh.length, 1);
    assert.equal(searchVinh[0].id, "task-1");

    // Empty search match
    const searchNone = filterTasksForTable(mockTasks, "ALL", "non-existent-xyz");
    assert.equal(searchNone.length, 0);
  });
});

describe("Task 6: Cascading Task Table Single Source of Truth", () => {
  it("neither task table component contains hardcoded personal name checks", () => {
    const tasksTable = path.resolve(__dirname, "../src/components/tasks/cascading-task-table.tsx");
    const dashboardTable = path.resolve(__dirname, "../src/components/dashboard/cascading-task-table.tsx");

    const content1 = fs.readFileSync(tasksTable, "utf-8");
    const content2 = fs.readFileSync(dashboardTable, "utf-8");

    const forbiddenNames = ["Xuân", "Huy", "Linh", "Thanh", "Nam", "Nhung", "Minh", "Hậu", "My"];
    for (const name of forbiddenNames) {
      assert.ok(
        !content1.includes(`"${name}"`) && !content2.includes(`"${name}"`),
        `Component must not filter by personal name '${name}'`
      );
    }
  });

  it("filters tasks by relational departmentId and resolveDepartmentId without name heuristics", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-rel-1",
        title: "Nâng cấp hạ tầng mạng Core",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadAssigneeName: "Nguyễn Văn A",
        departmentId: "CNTT",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-20",
        status: "IN_PROGRESS",
        subTasks: [
          {
            id: "sub-rel-1",
            title: "Cấu hình Switch L3",
            assigneeName: "Kỹ thuật viên 1",
            departmentId: "CNTT",
            status: "IN_PROGRESS",
            dueDate: "2026-09-15",
            parentSchoolTaskId: "task-rel-1",
            updatedAt: "2026-09-02",
          },
        ],
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 50,
      },
      {
        id: "task-rel-2",
        title: "Báo cáo tuyển sinh năm 2026",
        category: "BAO_CAO",
        categoryLabel: "Báo cáo",
        leadAssigneeName: "Trần Thị B",
        departmentId: "DAO_TAO",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-10",
        status: "COMPLETED",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 100,
      },
    ];

    // Filter by departmentId CNTT
    const cnttTasks = filterTasksForTable(mockTasks, "ALL", "", "CNTT");
    assert.equal(cnttTasks.length, 1);
    assert.equal(cnttTasks[0].id, "task-rel-1");

    // Filter by departmentId DAO_TAO
    const daoTaoTasks = filterTasksForTable(mockTasks, "ALL", "", "DAO_TAO");
    assert.equal(daoTaoTasks.length, 1);
    assert.equal(daoTaoTasks[0].id, "task-rel-2");
  });

  it("uses ergonomic '/' table filter shortcut and avoids global ⌘K conflict", () => {
    const tasksTable = path.resolve(__dirname, "../src/components/tasks/cascading-task-table.tsx");
    const content = fs.readFileSync(tasksTable, "utf-8");

    // Must not intercept 'k' key in table (reserved for global search palette)
    assert.ok(
      !content.includes('key.toLowerCase() === "k"'),
      "CascadingTaskTable must not intercept global ⌘K shortcut"
    );
    // Must support '/' shortcut for in-table search
    assert.ok(
      content.includes('e.key === "/"'),
      "CascadingTaskTable should support ergonomic '/' table search shortcut"
    );
  });
});

describe("Personal Scope Subtask First-Class UX Suite (MY_TASKS)", () => {
  it("flattens subtask into first-class row when staff is only assigned to the subtask", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "school-task-99",
        taskCode: "NV-TRUONG-99",
        title: "Kế hoạch nâng cấp mạng hạ tầng cơ sở 2026",
        category: "CNTT",
        categoryLabel: "Công nghệ thông tin",
        progressPercent: 50,
        totalSubTasks: 2,
        completedSubTasks: 0,
        coAssignees: [],
        leadAssigneeName: "Trưởng phòng Đào tạo",
        leadAssigneeId: "manager-01",
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        subTasks: [
          {
            id: "subtask-c1",
            code: "NV-TRUONG-99.01",
            title: "Cấu hình phân đoạn VLAN tầng 2",
            assigneeName: "Nguyễn Văn Chuyên Viên",
            assigneeId: "staff-cv-01",
            status: "IN_PROGRESS",
            dueDate: "2026-09-15",
            department: "Khoa CNTT",
            departmentId: "CNTT",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
          {
            id: "subtask-c2",
            code: "NV-TRUONG-99.02",
            title: "Kiểm thử thông tuyến cáp quang",
            assigneeName: "Cán bộ khác",
            assigneeId: "other-staff",
            status: "NEW",
            dueDate: "2026-09-20",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
        ],
      },
    ];

    // When viewed by "Nguyễn Văn Chuyên Viên"
    const flattened = flattenPersonalTasks(
      mockTasks,
      "Nguyễn Văn Chuyên Viên",
      "staff-cv-01"
    );

    // Should contain 1 first-class item (the subtask)
    assert.equal(flattened.length, 1);
    const item = flattened[0];
    assert.equal(item.id, "subtask-c1");
    assert.equal(item.title, "Cấu hình phân đoạn VLAN tầng 2");
    assert.equal(item.isSubtask, true);
    assert.equal(item.parentSchoolTaskId, "school-task-99");
    assert.equal(item.parentSchoolTaskCode, "NV-TRUONG-99");
    assert.equal(
      item.parentSchoolTaskTitle,
      "Kế hoạch nâng cấp mạng hạ tầng cơ sở 2026"
    );
  });

  it("subtask-inline-row.tsx contains 'Thuộc nhiệm vụ:' badge and direct action controls", () => {
    const subtaskRowPath = path.resolve(
      __dirname,
      "../src/components/tasks/table/components/subtask-inline-row.tsx"
    );
    const content = fs.readFileSync(subtaskRowPath, "utf-8");

    // Must have 'Thuộc nhiệm vụ:' badge
    assert.ok(
      content.includes("Thuộc nhiệm vụ:"),
      "Subtask row should display 'Thuộc nhiệm vụ:' badge for context"
    );

    // Must have direct submission button
    assert.ok(
      content.includes("onOpenSubmitModal"),
      "Subtask row must provide direct submission action"
    );

    // Must have direct status dropdown/actions
    assert.ok(
      content.includes("onStatusChange"),
      "Subtask row must provide direct status change actions"
    );
  });

  it("subtask-row-group.tsx supports scope prop and highlights user subtasks", () => {
    const groupPath = path.resolve(
      __dirname,
      "../src/components/tasks/table/components/subtask-row-group.tsx"
    );
    const content = fs.readFileSync(groupPath, "utf-8");

    assert.ok(
      content.includes("scope?: string"),
      "SubtaskRowGroup must accept scope prop"
    );
    assert.ok(
      content.includes("isUserSubtask"),
      "SubtaskRowGroup must detect subtasks assigned to the user"
    );
  });

  it("workspace components include 'Thuộc nhiệm vụ:' badge on subtask items", () => {
    const focusWsPath = path.resolve(
      __dirname,
      "../src/components/portal/lecturer-focus-workspace.tsx"
    );
    const queuePath = path.resolve(
      __dirname,
      "../src/components/workspace/components/universal-action-queue.tsx"
    );
    const contentFocus = fs.readFileSync(focusWsPath, "utf-8");
    const contentQueue = fs.readFileSync(queuePath, "utf-8");

    assert.ok(
      contentFocus.includes("Thuộc nhiệm vụ:"),
      "Lecturer focus workspace should highlight parent task with 'Thuộc nhiệm vụ:' badge"
    );
    assert.ok(
      contentQueue.includes("Thuộc nhiệm vụ:"),
      "Action queue should highlight parent task with 'Thuộc nhiệm vụ:' badge"
    );
  });

  it("ensures zero decorative emojis in all modified table and workspace components", () => {
    const filesToCheck = [
      "../src/components/tasks/table/components/subtask-inline-row.tsx",
      "../src/components/tasks/table/components/subtask-row-group.tsx",
      "../src/components/tasks/table/modular-cascading-task-table.tsx",
      "../src/components/tasks/cascading-task-table.tsx",
      "../src/components/workspace/unified-adaptive-workspace.tsx",
      "../src/components/workspace/components/universal-action-queue.tsx",
    ];

    const emojiRegex =
      /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(__dirname, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      assert.ok(
        !emojiRegex.test(content),
        `File ${relPath} must not contain any emojis`
      );
    }
  });
});

