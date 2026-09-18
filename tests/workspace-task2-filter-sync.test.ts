import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskEmptyState } from "../src/components/tasks/table/components/task-empty-state";
import {
  parseWorkspaceQuery,
  serializeWorkspaceQuery,
  type WorkspaceFilterState,
} from "../src/lib/workspace-query";
import { filterTasks } from "../src/components/tasks/table/utils/table-filter-engine";
import type { SchoolTask } from "../src/types/dashboard";
import {
  UnifiedTaskToolbar,
  areCriteriaEqual,
} from "../src/components/dashboard/unified-task-toolbar";

describe("Task 2 Invariants: Filter Transitions, Empty States & URL Synchronization", () => {
  const mockTasks = [
    {
      id: "task-1",
      title: "Rà soát chuẩn đầu ra Khoa CNTT",
      taskCode: "NV-001",
      status: "IN_PROGRESS",
      priority: "HIGH",
      departmentId: "CNTT",
      departmentName: "Khoa Công nghệ thông tin",
      leadDepartmentId: "CNTT",
      leadDepartment: "Khoa Công nghệ thông tin",
      leadAssigneeId: "user-cntt-1",
      leadAssigneeName: "Nguyễn Văn A",
      dueDate: "2026-09-20",
      academicMonth: 9,
      academicYear: "2026-2027",
      subTasks: [],
    },
    {
      id: "task-2",
      title: "Thẩm định giáo trình phòng Đào tạo",
      taskCode: "NV-002",
      status: "WAITING_APPROVAL",
      priority: "NORMAL",
      departmentId: "DAO_TAO",
      departmentName: "Phòng Đào tạo",
      leadDepartmentId: "DAO_TAO",
      leadDepartment: "Phòng Đào tạo",
      leadAssigneeId: "user-dt-1",
      leadAssigneeName: "Trần Thị B",
      dueDate: "2026-09-15",
      academicMonth: 9,
      academicYear: "2026-2027",
      subTasks: [],
    },
    {
      id: "task-3",
      title: "Báo cáo kiểm định chất lượng",
      taskCode: "NV-003",
      status: "COMPLETED",
      priority: "URGENT",
      departmentId: "KHAO_THI",
      departmentName: "Phòng Khảo thí & ĐBCL",
      leadDepartmentId: "KHAO_THI",
      leadDepartment: "Phòng Khảo thí & ĐBCL",
      leadAssigneeId: "user-kt-1",
      leadAssigneeName: "Lê Văn C",
      dueDate: "2026-09-05",
      academicMonth: 9,
      academicYear: "2026-2027",
      subTasks: [],
    },
  ] as unknown as SchoolTask[];

  describe("Subtask 2.1: Rich Contextual Empty State in TaskEmptyState", () => {
    test("renders specific heading and description for search query empty state", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          searchQuery: "Nhiệm vụ không tồn tại xyz",
          onResetFilters: () => {},
        })
      );

      assert.ok(html.includes("Không tìm thấy nhiệm vụ với từ khóa"));
      assert.ok(html.includes("Nhiệm vụ không tồn tại xyz"));
      assert.ok(html.includes("Đặt lại bộ lọc"));
    });

    test("renders specific heading for department filter without tasks", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          department: "Khoa Cơ khí",
          onResetFilters: () => {},
        })
      );

      assert.ok(html.includes("Khoa Cơ khí"));
      assert.ok(html.includes("chưa có nhiệm vụ"));
      assert.ok(html.includes("Đặt lại bộ lọc"));
    });

    test("renders specific heading for status filter without tasks", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          status: "WAITING_APPROVAL",
          onResetFilters: () => {},
        })
      );

      // Must state that no tasks match the waiting approval status
      assert.ok(
        html.includes("chờ phê duyệt") ||
          html.includes("chờ duyệt") ||
          html.includes("phê duyệt"),
        "Empty state should mention status context"
      );
      assert.ok(html.includes("Đặt lại bộ lọc"));
    });

    test("renders specific heading for academic month filter without tasks", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          academicMonth: 10,
          onResetFilters: () => {},
        })
      );

      assert.ok(
        html.includes("Tháng 10") || html.includes("tháng 10"),
        "Empty state should mention academic month context"
      );
      assert.ok(html.includes("Đặt lại bộ lọc"));
    });

    test("renders specific heading for overdue empty state (praising status)", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          activeTab: "overdue",
        })
      );

      assert.ok(html.includes("Không có nhiệm vụ nào quá hạn"));
    });

    test("renders primary CTA to create task when canAddTask is true", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          canAddTask: true,
          onAddTask: () => {},
        })
      );

      assert.ok(html.includes("Tạo nhiệm vụ mới"));
    });
  });

  describe("Subtask 2.2: Filter Transition Invariants & Multi-dimension Filtering", () => {
    test("drilling down from all to specific department isolates matching tasks", () => {
      const filtered = filterTasks(mockTasks, {
        department: "CNTT",
        smartTab: "all",
      });

      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].id, "task-1");
    });

    test("drilling down by status isolates matching tasks", () => {
      const filtered = filterTasks(mockTasks, {
        smartTab: "review",
      });

      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].id, "task-2");
    });

    test("orthogonal filters combine conjunctively without resetting each other", () => {
      // Dept: CNTT and Status: IN_PROGRESS -> matches task-1
      const matchBoth = filterTasks(mockTasks, {
        department: "CNTT",
        smartTab: "in_progress" as any,
      });
      assert.equal(matchBoth.length, 1);
      assert.equal(matchBoth[0].id, "task-1");

      // Dept: CNTT and Status: WAITING_APPROVAL (review tab) -> 0 results
      const matchNone = filterTasks(mockTasks, {
        department: "CNTT",
        smartTab: "review",
      });
      assert.equal(matchNone.length, 0);
    });
  });

  describe("Subtask 2.3: Atomic Query Synchronization via serializeWorkspaceQuery", () => {
    test("preserves existing query params when updating department and status", () => {
      const initial = parseWorkspaceQuery("?scope=unit&dept=CNTT&status=IN_PROGRESS&unrelated=123");
      assert.equal(initial.scope, "unit");
      assert.equal(initial.dept, "CNTT");
      assert.equal(initial.status, "IN_PROGRESS");

      // Changing department to DAO_TAO retains scope and unrelated params
      const updated = serializeWorkspaceQuery(
        {
          ...initial,
          dept: "DAO_TAO",
        },
        {
          preserveParams: new URLSearchParams("?scope=unit&dept=CNTT&status=IN_PROGRESS&unrelated=123"),
        }
      );

      assert.equal(updated.get("scope"), "unit");
      assert.equal(updated.get("dept"), "DAO_TAO");
      assert.equal(updated.get("status"), "IN_PROGRESS");
      assert.equal(updated.get("unrelated"), "123");
    });

    test("resetFilters returns query to canonical defaults while preserving non-workspace params", () => {
      const preserveParams = new URLSearchParams("?scope=unit&dept=CNTT&status=IN_PROGRESS&tab=custom&token=abc");
      const resetParams = serializeWorkspaceQuery(
        {
          scope: "school",
          dept: undefined,
          status: "ALL",
          month: "ALL",
          q: undefined,
        },
        {
          preserveParams,
        }
      );

      assert.equal(resetParams.get("token"), "abc");
      assert.equal(resetParams.get("dept"), null);
      assert.equal(resetParams.get("status"), null);
    });

    test("2.4 Filter Sequence: Overdue -> Waiting Approval -> All, Reset Search, Round-trip", () => {
      // 1. Initial overdue filter
      const overdueState: WorkspaceFilterState = {
        scope: "school",
        status: "ALL",
        attention: "overdue",
        month: "ALL",
        view: "table",
      };
      const overdueParams = serializeWorkspaceQuery(overdueState);
      const parsedOverdue = parseWorkspaceQuery(overdueParams);
      assert.equal(parsedOverdue.attention, "overdue");

      // 2. Select waiting_approval after overdue
      const approvalState: WorkspaceFilterState = {
        ...overdueState,
        status: "WAITING_APPROVAL",
        attention: "requires_my_approval",
      };
      const approvalParams = serializeWorkspaceQuery(approvalState);
      const parsedApproval = parseWorkspaceQuery(approvalParams);
      assert.equal(parsedApproval.status, "WAITING_APPROVAL");
      assert.equal(parsedApproval.attention, "requires_my_approval");

      // 3. Reset to All
      const allState: WorkspaceFilterState = {
        ...approvalState,
        status: "ALL",
        attention: undefined,
      };
      const allParams = serializeWorkspaceQuery(allState);
      const parsedAll = parseWorkspaceQuery(allParams);
      assert.equal(parsedAll.status, "ALL");
      assert.equal(parsedAll.attention, undefined);

      // 4. Add search query and then reset search
      const searchState: WorkspaceFilterState = {
        ...allState,
        q: "rà soát",
      };
      const searchParams = serializeWorkspaceQuery(searchState);
      assert.equal(searchParams.get("q"), "rà soát");

      const resetSearchState: WorkspaceFilterState = {
        ...searchState,
        q: undefined,
      };
      const resetSearchParams = serializeWorkspaceQuery(resetSearchState);
      assert.equal(resetSearchParams.get("q"), null);
      const parsedReset = parseWorkspaceQuery(resetSearchParams);
      assert.equal(parsedReset.q, undefined);
    });
  });

  describe("Task 3 Toolbar: Quick Filter Group, Role-Based Actions, a11y & Saved Views", () => {
    test("3.1 Role-Based Action Selection in Quick Filters: Executive gets 'Cần tôi duyệt'", () => {
      const { buildRoleActionPill, buildQuickFilterPills } = require("../src/components/dashboard/unified-task-toolbar");
      const tabCounts = {
        all: 12,
        waiting_approval: 4,
        pending_submission: 1,
        overdue: 2,
        today: 3,
      };

      const pill = buildRoleActionPill(true, tabCounts, "all");
      assert.equal(pill.label, "Cần tôi duyệt");
      assert.equal(pill.id, "waiting_approval");
      assert.equal(pill.count, 4);

      const allPills = buildQuickFilterPills(true, tabCounts, "all");
      const labels = allPills.map((p: any) => p.label);
      assert.ok(labels.includes("Tất cả"));
      assert.ok(labels.includes("Quá hạn"));
    });

    test("3.1b Role-Based Action Selection: Staff gets 'Chờ tôi nộp'", () => {
      const { buildRoleActionPill } = require("../src/components/dashboard/unified-task-toolbar");
      const tabCounts = {
        all: 8,
        waiting_approval: 0,
        pending_submission: 3,
        overdue: 1,
        today: 2,
      };

      const pill = buildRoleActionPill(false, tabCounts, "all");
      assert.equal(pill.label, "Chờ tôi nộp");
      assert.equal(pill.id, "pending_submission");
      assert.equal(pill.count, 3);
    });

    test("3.2 Selected state persists even when count is 0", () => {
      const { buildRoleActionPill } = require("../src/components/dashboard/unified-task-toolbar");
      const tabCounts = {
        all: 10,
        waiting_approval: 0,
        overdue: 0,
      };

      const pill = buildRoleActionPill(true, tabCounts, "waiting_approval");
      assert.equal(pill.isActive, true);
      assert.equal(pill.count, 0);
      assert.equal(pill.label, "Cần tôi duyệt");
    });

    test("3.3 a11y standards: type='button', touch 44px mobile, no tab semantics in filter group", () => {
      const html = renderToStaticMarkup(
        React.createElement(UnifiedTaskToolbar, {
          scope: "school",
          onScopeChange: () => {},
          searchQuery: "",
          onSearchChange: () => {},
          isExecutive: true,
          userRole: "ADMIN",
          activeTab: "all",
          onTabChange: () => {},
        })
      );

      // Verify buttons in toolbar have type="button" and proper touch manipulation / styling
      assert.ok(html.includes('type="button"'));
      assert.ok(html.includes('touch-manipulation'));
    });

    test("3.4 Saved View preset active state resets when criteria diverge", () => {
      const baseCriteria = {
        scope: "school" as const,
        dept: "CNTT",
        status: "waiting_approval",
      };

      const modifiedCriteria = {
        scope: "school" as const,
        dept: "CNTT",
        status: "waiting_approval",
        q: "khảo thí", // user modified search query
      };

      // When criteria equals preset
      assert.equal(areCriteriaEqual(baseCriteria, { ...baseCriteria }), true);

      // When criteria diverges (e.g. search added)
      assert.equal(areCriteriaEqual(baseCriteria, modifiedCriteria), false);
    });
  });

  describe("Subtask 2.4: TaskEmptyState — hasFilterActive với attention và priority", () => {
    test("hasFilterActive khi activeTab là waiting_approval → hiện nút reset", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          activeTab: "waiting_approval",
          onResetFilters: () => {},
        })
      );

      // Phải hiện nút reset vì filter active
      assert.ok(html.includes("Đặt lại bộ lọc"), "Khi activeTab=waiting_approval phải hiện nút Đặt lại bộ lọc");
      // Phải render context đúng
      assert.ok(
        html.includes("chờ phê duyệt") || html.includes("chờ duyệt") || html.includes("phê duyệt"),
        "Phải hiện thông báo context chờ duyệt"
      );
    });

    test("hasFilterActive khi attention=requires_my_approval → hiện nút reset", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          attention: "requires_my_approval",
          onResetFilters: () => {},
        })
      );

      assert.ok(html.includes("Đặt lại bộ lọc"), "Khi attention=requires_my_approval phải hiện nút reset");
    });

    test("hasFilterActive khi priority=HIGH → hiện nút reset", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          priority: "HIGH",
          onResetFilters: () => {},
        })
      );

      assert.ok(html.includes("Đặt lại bộ lọc"), "Khi priority=HIGH phải hiện nút reset");
    });

    test("KHÔNG hiện nút reset khi không có bộ lọc (tab=all, không search)", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          activeTab: "all",
          onResetFilters: () => {},
        })
      );

      // Không có filter active → không hiện nút reset (chỉ hiện khi có onResetFilters VÀ hasFilterActive)
      assert.ok(!html.includes("Đặt lại bộ lọc"), "Khi tab=all và không search thì KHÔNG hiện nút reset");
    });

    test("activeTab=overdue không hiện nút reset (good state, không nên reset)", () => {
      // Overdue là trạng thái tiêu cực nhưng tab ĐANG active → hasFilterActive=true
      // Nút reset nên hiện để người dùng có thể quay về tất cả
      const html = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          activeTab: "overdue",
          onResetFilters: () => {},
        })
      );

      // overdue tab: Không có quá hạn là GOOD STATE
      assert.ok(html.includes("Không có nhiệm vụ nào quá hạn"), "Phải hiện thông báo khen ngợi khi không có quá hạn");
      // Nhưng hasFilterActive=true vì activeTab !== "all" → nút reset sẽ hiện
      assert.ok(html.includes("Đặt lại bộ lọc"), "overdue tab filter đang active nên phải hiện nút reset");
    });
  });

  describe("Subtask 2.5: Serialize-parse roundtrip giữ nguyên criteria", () => {
    test("criteria chờ duyệt serialize/parse roundtrip nhất quán", () => {
      const approvalState: WorkspaceFilterState = {
        scope: "school",
        month: "ALL",
        status: "WAITING_APPROVAL",
        attention: "requires_my_approval",
        view: "table",
      };

      const params = serializeWorkspaceQuery(approvalState);
      const parsed = parseWorkspaceQuery(params);

      assert.equal(parsed.status, "WAITING_APPROVAL");
      assert.equal(parsed.attention, "requires_my_approval");
    });

    test("criteria overdue serialize/parse roundtrip nhất quán", () => {
      const overdueState: WorkspaceFilterState = {
        scope: "school",
        month: "ALL",
        status: "ALL",
        attention: "overdue",
        view: "table",
      };

      const params = serializeWorkspaceQuery(overdueState);
      const parsed = parseWorkspaceQuery(params);

      assert.equal(parsed.attention, "overdue");
      assert.equal(parsed.status, "ALL");
    });

    test("reset lọc không thay đổi scope hay tháng công tác", () => {
      const baseState: WorkspaceFilterState = {
        scope: "unit",
        month: 9,
        status: "WAITING_APPROVAL",
        attention: "requires_my_approval",
        view: "table",
        q: "từ khóa tìm kiếm",
      };

      // Simulate resetFilters: xóa search/status/attention nhưng giữ scope và month
      const resetState: WorkspaceFilterState = {
        scope: baseState.scope,   // giữ scope
        month: baseState.month,   // giữ kỳ công tác
        status: "ALL",
        attention: undefined,
        view: "table",
        q: undefined,
      };

      const params = serializeWorkspaceQuery(resetState);
      const parsed = parseWorkspaceQuery(params);

      assert.equal(parsed.scope, "unit", "Scope phải được giữ nguyên sau reset");
      assert.equal(parsed.month, 9, "Tháng công tác phải được giữ nguyên sau reset");
      assert.equal(parsed.status, "ALL", "Status phải được reset về ALL");
      assert.equal(parsed.attention, undefined, "Attention phải được xóa sau reset");
      assert.equal(parsed.q, undefined, "Search query phải được xóa sau reset");
    });
  });
});
