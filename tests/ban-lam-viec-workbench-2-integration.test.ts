import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// 1. Time & Reference Date Engine
import {
  getSystemReferenceDate as getAcademicReferenceDate,
  isTaskPastDue as isTaskPastDueAcademic,
} from "../src/lib/academic-calendar";
import {
  getSystemReferenceDate as getHubReferenceDate,
  getSystemReferenceDateStr as getHubReferenceDateStr,
  isTaskPastDue as isTaskPastDueHub,
} from "../src/lib/unified-task-hub";

// 2. Scope Unification
import {
  scopeToWorkspaceScope,
  workspaceScopeToTaskScope,
  workspaceScopeToUrlParam,
  urlParamToWorkspaceScope,
  parseScopeParam,
  scopeToParam,
  getDefaultScopeForRole,
} from "../src/lib/unified-task-hub";

// 3. Pipeline Filtering Consistency
import { filterTasksHub } from "../src/lib/unified-task-hub";
import type { SchoolTask } from "../src/types/dashboard";

// 4. Authority Semantics in Action Queue
import {
  getActionQueueButtonMeta,
  UniversalActionQueue,
} from "../src/components/workspace/components/universal-action-queue";

// 5. Compact Table View in DepartmentProgressMatrix
import {
  DepartmentProgressMatrix,
  sortDepartmentsByOverdue,
} from "../src/components/dashboard/department-progress-matrix";
import type { DepartmentHealthSummary } from "../src/lib/executive-matrix-aggregator";

// 6. Split-Cockpit Layout & ActiveFilterBreadcrumb
import {
  getActiveFilterSummary,
  ActiveFilterBreadcrumb,
} from "../src/components/workspace/components/active-filter-breadcrumb";
import { UnifiedAdaptiveWorkspace } from "../src/components/workspace/unified-adaptive-workspace";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";

describe("Task 7: Xác Thực Hệ Thống Toàn Diện & Chống Regression (Workbench 2.0)", () => {
  const payload = getMockDashboardPayload();
  const tasks = payload.tasks;
  const adminUser = DEFAULT_DEMO_USERS[0];
  const managerUser = DEFAULT_DEMO_USERS[1];
  const staffUser = DEFAULT_DEMO_USERS[2];

  // --------------------------------------------------------------------------
  // Area 1: Reference Date Engine Integration (2026-09-09 baseline)
  // --------------------------------------------------------------------------
  describe("1. Reference Date Engine Integration", () => {
    test("getSystemReferenceDate in academic-calendar returns 2026-09-09 default", () => {
      const refDate = getAcademicReferenceDate();
      assert.equal(refDate, "2026-09-09", "Academic reference date baseline must be 2026-09-09");
    });

    test("isTaskPastDue reliably determines past due status against reference date 2026-09-09", () => {
      const baseline = "2026-09-09";
      // Prior day -> overdue
      assert.equal(isTaskPastDueAcademic("2026-09-08", baseline), true);
      assert.equal(isTaskPastDueAcademic("2026-09-08T23:59:59.000Z", baseline), true);

      // Same day -> not overdue yet during business day
      assert.equal(isTaskPastDueAcademic("2026-09-09", baseline), false);
      assert.equal(isTaskPastDueAcademic("2026-09-09T00:00:00.000Z", baseline), false);

      // Future day -> not overdue
      assert.equal(isTaskPastDueAcademic("2026-09-10", baseline), false);

      // Null / empty dates -> not overdue
      assert.equal(isTaskPastDueAcademic(null, baseline), false);
      assert.equal(isTaskPastDueAcademic(undefined, baseline), false);
    });

    test("academic-calendar respects NEXT_PUBLIC_REFERENCE_DATE environment variable", () => {
      const original = process.env.NEXT_PUBLIC_REFERENCE_DATE;
      try {
        process.env.NEXT_PUBLIC_REFERENCE_DATE = "2026-11-20";
        assert.equal(getAcademicReferenceDate(), "2026-11-20");
        assert.equal(isTaskPastDueAcademic("2026-11-19"), true);
        assert.equal(isTaskPastDueAcademic("2026-11-20"), false);
      } finally {
        if (original !== undefined) {
          process.env.NEXT_PUBLIC_REFERENCE_DATE = original;
        } else {
          delete process.env.NEXT_PUBLIC_REFERENCE_DATE;
        }
      }
    });

    test("unified-task-hub isTaskPastDue accepts both Date instance and string reference", () => {
      assert.equal(isTaskPastDueHub("2026-09-08", "2026-09-09"), true);
      assert.equal(isTaskPastDueHub("2026-09-09", "2026-09-09"), false);
      assert.equal(isTaskPastDueHub("2026-09-10", "2026-09-09"), false);
      assert.equal(isTaskPastDueHub("2026-09-08", new Date(2026, 8, 9)), true);
      assert.equal(isTaskPastDueHub("2026-09-09", new Date(2026, 8, 9)), false);
    });
  });

  // --------------------------------------------------------------------------
  // Area 2: Scope Unification across school / unit / my scopes
  // --------------------------------------------------------------------------
  describe("2. Scope Unification Across Scopes", () => {
    test("bidirectional conversion between TaskScope and WorkspaceScope", () => {
      assert.equal(scopeToWorkspaceScope("SCHOOL_TASKS"), "school");
      assert.equal(scopeToWorkspaceScope("UNIT_TASKS"), "unit");
      assert.equal(scopeToWorkspaceScope("MY_TASKS"), "my");

      assert.equal(workspaceScopeToTaskScope("school"), "SCHOOL_TASKS");
      assert.equal(workspaceScopeToTaskScope("unit"), "UNIT_TASKS");
      assert.equal(workspaceScopeToTaskScope("my"), "MY_TASKS");
    });

    test("bidirectional URL parameter conversion", () => {
      assert.equal(workspaceScopeToUrlParam("school"), "all");
      assert.equal(workspaceScopeToUrlParam("unit"), "unit");
      assert.equal(workspaceScopeToUrlParam("my"), "personal");

      assert.equal(urlParamToWorkspaceScope("all"), "school");
      assert.equal(urlParamToWorkspaceScope("school"), "school");
      assert.equal(urlParamToWorkspaceScope("unit"), "unit");
      assert.equal(urlParamToWorkspaceScope("my"), "my");
      assert.equal(urlParamToWorkspaceScope("personal"), "my");
      assert.equal(urlParamToWorkspaceScope(undefined, "unit"), "unit");
    });

    test("parseScopeParam correctly normalizes and guards scope permissions", () => {
      assert.equal(parseScopeParam("my"), "MY_TASKS");
      assert.equal(parseScopeParam("unit"), "UNIT_TASKS");
      assert.equal(parseScopeParam("all", "MY_TASKS", "ADMIN"), "SCHOOL_TASKS");
      assert.equal(parseScopeParam("all", "MY_TASKS", "STAFF"), "MY_TASKS"); // Staff guarded against school scope
    });

    test("getDefaultScopeForRole returns proper default scope", () => {
      assert.equal(getDefaultScopeForRole("ADMIN"), "SCHOOL_TASKS");
      assert.equal(getDefaultScopeForRole("MANAGER"), "UNIT_TASKS");
      assert.equal(getDefaultScopeForRole("STAFF"), "MY_TASKS");
    });
  });

  // --------------------------------------------------------------------------
  // Area 3: Pipeline Filtering Consistency in DashboardZone
  // --------------------------------------------------------------------------
  describe("3. Pipeline Filtering Consistency in DashboardZone", () => {
    const sampleTasks: SchoolTask[] = [
      {
        id: "t-1",
        title: "Kế hoạch năm học mới",
        status: "IN_PROGRESS",
        dueDate: "2026-09-05", // Overdue compared to 2026-09-09
        priority: "URGENT",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadDepartmentId: "KHOA_CNTT",
        leadDepartmentCode: "CNTT",
        leadDepartment: "Khoa CNTT",
        leadAssigneeName: "Nguyễn Văn A",
        coAssignees: [],
        assignedDate: "2026-09-01",
        progressPercent: 30,
        totalSubTasks: 1,
        completedSubTasks: 0,
        subTasks: [],
      },
      {
        id: "t-2",
        title: "Báo cáo kiểm định chất lượng",
        status: "PENDING_EXECUTIVE_APPROVAL",
        dueDate: "2026-09-15",
        priority: "HIGH",
        category: "BAO_CAO",
        categoryLabel: "Báo cáo",
        leadDepartmentId: "PHONG_QLCL",
        leadDepartmentCode: "QLCL",
        leadDepartment: "Phòng QLCL",
        leadAssigneeName: "Trần Thị B",
        coAssignees: [],
        assignedDate: "2026-09-01",
        progressPercent: 90,
        totalSubTasks: 0,
        completedSubTasks: 0,
        subTasks: [],
      },
      {
        id: "t-3",
        title: "Nhiệm vụ đã hoàn tất",
        status: "COMPLETED",
        dueDate: "2026-09-02",
        priority: "NORMAL",
        category: "CHUYEN_DOI_SO",
        categoryLabel: "Chuyển đổi số",
        leadDepartmentId: "KHOA_CNTT",
        leadDepartmentCode: "CNTT",
        leadDepartment: "Khoa CNTT",
        leadAssigneeName: "Lê Văn C",
        coAssignees: [],
        assignedDate: "2026-09-01",
        progressPercent: 100,
        totalSubTasks: 0,
        completedSubTasks: 0,
        subTasks: [],
      },
    ];

    test("filterTasksHub filters by workbox URGENT_OVERDUE correctly", () => {
      const urgent = filterTasksHub(sampleTasks, {
        scope: "SCHOOL_TASKS",
        workbox: "URGENT_OVERDUE",
        referenceDate: "2026-09-09",
      });
      assert.equal(urgent.length, 1);
      assert.equal(urgent[0].id, "t-1");
    });

    test("filterTasksHub filters by department correctly", () => {
      const cnttTasks = filterTasksHub(sampleTasks, {
        scope: "SCHOOL_TASKS",
        department: "CNTT",
      });
      assert.equal(cnttTasks.length, 2);
      assert.ok(cnttTasks.every((t) => t.leadDepartmentCode === "CNTT"));
    });

    test("filterTasksHub filters by search query across title and assignee", () => {
      const searched = filterTasksHub(sampleTasks, {
        scope: "SCHOOL_TASKS",
        searchQuery: "kiểm định",
      });
      assert.equal(searched.length, 1);
      assert.equal(searched[0].id, "t-2");
    });

    test("DashboardZone source eliminates divergent filterDashboardReactiveTasks", () => {
      const filePath = path.join(
        process.cwd(),
        "src/components/dashboard/zones/dashboard-zone.tsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");
      assert.equal(
        content.includes("filterDashboardReactiveTasks"),
        false,
        "DashboardZone must not declare or call filterDashboardReactiveTasks"
      );
      assert.ok(
        content.includes("filteredTasks"),
        "DashboardZone must consume filteredTasks from useDashboardData context"
      );
    });
  });

  // --------------------------------------------------------------------------
  // Area 4: Authority Semantics in UniversalActionQueue
  // --------------------------------------------------------------------------
  describe("4. Authority Semantics in UniversalActionQueue", () => {
    test("getActionQueueButtonMeta delivers precise authority action labels", () => {
      const schoolReview = getActionQueueButtonMeta("school", "approval");
      assert.equal(schoolReview.label, "Phê duyệt");

      const unitReview = getActionQueueButtonMeta("unit", "approval");
      assert.equal(unitReview.label, "Thẩm định L1");

      const staffSubmit = getActionQueueButtonMeta("my", "submission");
      assert.equal(staffSubmit.label, "Nộp minh chứng");
    });

    test("UniversalActionQueue renders data-slot and authority badge without errors", () => {
      const html = renderToStaticMarkup(
        React.createElement(UniversalActionQueue, {
          actionQueue: {
            pendingApprovals: [
              {
                task: {
                  id: "task-1",
                  title: "Duyệt đề cương học phần",
                  status: "PENDING_EXECUTIVE_APPROVAL",
                  dueDate: "2026-09-08",
                } as SchoolTask,
                submittedBy: "Trần Văn A",
                complianceScore: 92,
              },
            ],
            myPendingSubmissions: [],
          },
          scope: "school",
          onSelectTask: () => {},
        })
      );

      assert.ok(html.includes('data-slot="universal-action-queue"'));
      assert.ok(html.includes("Phê duyệt"));
      assert.ok(html.includes("Duyệt đề cương học phần"));
    });
  });

  // --------------------------------------------------------------------------
  // Area 5: Compact Table View in DepartmentProgressMatrix
  // --------------------------------------------------------------------------
  describe("5. Compact Table View in DepartmentProgressMatrix", () => {
    const mockDepts: DepartmentHealthSummary[] = [
      {
        departmentId: "CNTT",
        code: "CNTT",
        departmentName: "Khoa Công Nghệ Thông Tin",
        leadName: "Nguyễn Văn A",
        totalTasksCount: 20,
        completedTasksCount: 16,
        inProgressTasksCount: 4,
        overdueTasksCount: 1,
        blockedTasksCount: 0,
        averageProgressPercent: 85,
        totalTasks: 20,
        completedTasks: 16,
        inProgressTasks: 4,
        overdueTasks: 1,
        completionRate: 85,
        status: "good",
      },
      {
        departmentId: "DIEN",
        code: "DIEN",
        departmentName: "Khoa Điện - Điện Tử",
        leadName: "Trần Văn B",
        totalTasksCount: 15,
        completedTasksCount: 5,
        inProgressTasksCount: 10,
        overdueTasksCount: 4,
        blockedTasksCount: 1,
        averageProgressPercent: 45,
        totalTasks: 15,
        completedTasks: 5,
        inProgressTasks: 10,
        overdueTasks: 4,
        completionRate: 45,
        status: "critical",
      },
    ];

    test("sortDepartmentsByOverdue sorts departments with most overdue items first", () => {
      const sorted = sortDepartmentsByOverdue(mockDepts, true);
      assert.equal(sorted[0].code, "DIEN", "DIEN with 4 overdue must be ranked first");
      assert.equal(sorted[1].code, "CNTT", "CNTT with 1 overdue must be ranked second");
    });

    test("DepartmentProgressMatrix renders compact table view when mode is compact_table", () => {
      const html = renderToStaticMarkup(
        React.createElement(DepartmentProgressMatrix, {
          departments: mockDepts,
          selectedDepartment: "ALL",
          onSelectDepartment: () => {},
          viewMode: "compact_table",
        })
      );

      assert.ok(
        html.includes('data-slot="department-progress-matrix-table"'),
        "Must render the compact table element"
      );
      assert.ok(
        html.includes('data-slot="department-table-row"'),
        "Must render table rows for departments"
      );
      assert.ok(html.includes("Khoa Công Nghệ Thông Tin"));
      assert.ok(html.includes("Khoa Điện - Điện Tử"));
    });

    test("DepartmentProgressMatrix renders cards view when mode is cards", () => {
      const html = renderToStaticMarkup(
        React.createElement(DepartmentProgressMatrix, {
          departments: mockDepts,
          selectedDepartment: "ALL",
          onSelectDepartment: () => {},
          viewMode: "cards",
        })
      );

      assert.ok(
        html.includes('data-slot="department-progress-matrix"'),
        "Must render the cards grid container"
      );
      assert.ok(
        html.includes('data-slot="department-card"'),
        "Must render cards for departments"
      );
    });
  });

  // --------------------------------------------------------------------------
  // Area 6: Split-Cockpit Layout & ActiveFilterBreadcrumb
  // --------------------------------------------------------------------------
  describe("6. Split-Cockpit Layout & ActiveFilterBreadcrumb", () => {
    test("getActiveFilterSummary produces accurate chips and handles defaults", () => {
      const activeFilters = getActiveFilterSummary({
        dept: "CNTT",
        workbox: "URGENT_OVERDUE",
        search: "đề cương",
      });
      assert.equal(activeFilters.length, 3);
      assert.equal(activeFilters[0], "Đơn vị: CNTT");
      assert.equal(activeFilters[1], "Hộp việc: URGENT_OVERDUE");
      assert.equal(activeFilters[2], 'Từ khóa: "đề cương"');

      const defaultFilters = getActiveFilterSummary({
        dept: "ALL",
        workbox: "ALL",
        search: "",
      });
      assert.equal(defaultFilters.length, 0);
    });

    test("UnifiedAdaptiveWorkspace renders responsive Split-Cockpit desktop grid", () => {
      const html = renderToStaticMarkup(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: adminUser,
          tasks,
          enableSplitCockpit: true,
          onSelectTask: () => {},
        })
      );

      assert.ok(
        html.includes('data-slot="split-cockpit-layout"'),
        "Must render split-cockpit-layout container"
      );
      assert.ok(html.includes("lg:grid-cols-12"), "Must use 12-column grid layout");
      assert.ok(
        html.includes('data-slot="split-cockpit-primary"'),
        "Must render primary work table panel"
      );
      assert.ok(
        html.includes('data-slot="split-cockpit-side-panel"'),
        "Must render contextual side panel"
      );
    });

    test("ActiveFilterBreadcrumb renders when filter is applied and hides when empty", () => {
      const htmlFiltered = renderToStaticMarkup(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: adminUser,
          tasks,
          selectedDepartment: "CNTT",
          onSelectTask: () => {},
        })
      );
      assert.ok(
        htmlFiltered.includes('data-slot="active-filter-breadcrumb"'),
        "Breadcrumb must appear when filter is active"
      );

      const htmlUnfiltered = renderToStaticMarkup(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: adminUser,
          tasks,
          selectedDepartment: "ALL",
          onSelectTask: () => {},
        })
      );
      assert.ok(
        !htmlUnfiltered.includes('data-slot="active-filter-breadcrumb"'),
        "Breadcrumb must be hidden when all filters are default"
      );
    });
  });

  // --------------------------------------------------------------------------
  // Area 7: Anti-slop & Light-Only Invariant Verification
  // --------------------------------------------------------------------------
  describe("7. Anti-Slop & Light-Only Invariants Verification", () => {
    const filesToAudit = [
      "src/components/dashboard/zones/dashboard-zone.tsx",
      "src/components/workspace/unified-adaptive-workspace.tsx",
      "src/components/workspace/components/active-filter-breadcrumb.tsx",
      "src/components/workspace/components/universal-action-queue.tsx",
      "src/components/dashboard/department-progress-matrix.tsx",
      "src/components/dashboard/active-filter-breadcrumb.tsx",
      "src/lib/unified-task-hub.ts",
      "src/lib/academic-calendar.ts",
    ];

    test("zero dark: CSS classes in all Workbench 2.0 files", () => {
      for (const relativeFile of filesToAudit) {
        const fullPath = path.join(process.cwd(), relativeFile);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          const matches = content.match(/\bdark:/g);
          assert.equal(
            matches,
            null,
            `File ${relativeFile} must not contain dark: classes (found ${matches?.length ?? 0})`
          );
        }
      }
    });

    test("zero emoji characters in all Workbench 2.0 source code", () => {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      for (const relativeFile of filesToAudit) {
        const fullPath = path.join(process.cwd(), relativeFile);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          assert.ok(
            !emojiRegex.test(content),
            `File ${relativeFile} must be 100% free of emojis`
          );
        }
      }
    });

    test("tabular numerals (font-mono / tabular-nums) are used for statistics", () => {
      const matrixPath = path.join(
        process.cwd(),
        "src/components/dashboard/department-progress-matrix.tsx"
      );
      const matrixContent = fs.readFileSync(matrixPath, "utf-8");
      assert.ok(
        matrixContent.includes("tabular-nums"),
        "DepartmentProgressMatrix must use tabular-nums for numeric alignment"
      );

      const breadcrumbPath = path.join(
        process.cwd(),
        "src/components/workspace/components/active-filter-breadcrumb.tsx"
      );
      const breadcrumbContent = fs.readFileSync(breadcrumbPath, "utf-8");
      assert.ok(
        breadcrumbContent.includes("tabular-nums"),
        "ActiveFilterBreadcrumb must use tabular-nums for count displays"
      );
    });
  });
});
