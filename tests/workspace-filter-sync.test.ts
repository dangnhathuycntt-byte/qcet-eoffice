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
import { filterDisplayedTasks } from "../src/components/workspace/unified-adaptive-workspace";
import type { SchoolTask } from "../src/types/dashboard";

describe("Task 2: Workspace Filter Synchronization, Empty States & Drill-Down Invariants", () => {
  const sampleTasks: SchoolTask[] = [
    {
      id: "task-overdue-1",
      title: "Hoàn thiện đề cương chi tiết học phần",
      taskCode: "NV-001",
      status: "IN_PROGRESS",
      priority: "HIGH",
      leadDepartmentId: "CNTT",
      leadDepartment: "Khoa CNTT",
      leadAssigneeId: "user-1",
      leadAssigneeName: "Nguyễn Văn A",
      dueDate: "2026-08-01", // Quá hạn so với tham chiếu
      academicMonth: 8,
      academicYear: "2026-2027",
      subTasks: [],
    } as unknown as SchoolTask,
    {
      id: "task-approval-1",
      title: "Phê duyệt kế hoạch giảng dạy học kỳ 1",
      taskCode: "NV-002",
      status: "WAITING_APPROVAL",
      priority: "URGENT",
      leadDepartmentId: "DAO_TAO",
      leadDepartment: "Phòng Đào tạo",
      leadAssigneeId: "user-2",
      leadAssigneeName: "Trần Thị B",
      dueDate: "2026-09-30",
      academicMonth: 9,
      academicYear: "2026-2027",
      subTasks: [],
    } as unknown as SchoolTask,
    {
      id: "task-completed-1",
      title: "Tổng kết công tác tuyển sinh",
      taskCode: "NV-003",
      status: "COMPLETED",
      priority: "NORMAL",
      leadDepartmentId: "TUYEN_SINH",
      leadDepartment: "Ban Tuyển sinh",
      leadAssigneeId: "user-3",
      leadAssigneeName: "Lê Văn C",
      dueDate: "2026-09-10",
      academicMonth: 9,
      academicYear: "2026-2027",
      subTasks: [],
    } as unknown as SchoolTask,
  ];

  describe("1. Transition: Chọn chờ duyệt sau quá hạn", () => {
    test("chuyển từ overdue sang waiting_approval loại bỏ overdue và áp dụng chờ duyệt", () => {
      // Bắt đầu ở trạng thái overdue
      const overdueState: WorkspaceFilterState = {
        scope: "school",
        month: 9,
        status: "ALL",
        attention: "overdue",
        view: "table",
      };
      const overdueParams = serializeWorkspaceQuery(overdueState);
      const parsedOverdue = parseWorkspaceQuery(overdueParams);
      assert.equal(parsedOverdue.attention, "overdue");

      // Chuyển sang chờ duyệt: atomic patch thay thế attention và cập nhật status
      const approvalState: WorkspaceFilterState = {
        ...parsedOverdue,
        status: "WAITING_APPROVAL",
        attention: "requires_my_approval",
      };
      const approvalParams = serializeWorkspaceQuery(approvalState);
      const parsedApproval = parseWorkspaceQuery(approvalParams);

      assert.equal(parsedApproval.status, "WAITING_APPROVAL");
      assert.equal(parsedApproval.attention, "requires_my_approval");
      assert.notEqual(parsedApproval.attention, "overdue", "Không được giữ lại attention overdue");
      assert.equal(parsedApproval.month, 9, "Giữ nguyên kỳ công tác tháng 9");
      assert.equal(parsedApproval.scope, "school", "Giữ nguyên scope");
    });
  });

  describe("2. Transition: Trở về Tất cả", () => {
    test("chọn Tất cả bỏ bộ lọc nhanh, giữ scope, kỳ công tác và bộ lọc nâng cao", () => {
      const complexState: WorkspaceFilterState = {
        scope: "unit",
        dept: "CNTT",
        unit: "CNTT",
        unitId: "CNTT",
        month: 9,
        status: "WAITING_APPROVAL",
        attention: "requires_my_approval",
        view: "table",
      };

      // Hành động 'Tất cả': chỉ bỏ status nhanh và attention
      const allState: WorkspaceFilterState = {
        ...complexState,
        status: "ALL",
        attention: undefined,
      };

      const params = serializeWorkspaceQuery(allState);
      const parsed = parseWorkspaceQuery(params);

      assert.equal(parsed.status, "ALL", "Status phải là ALL");
      assert.equal(parsed.attention, undefined, "Attention phải được xóa");
      assert.equal(parsed.scope, "unit", "Scope 'unit' phải được giữ nguyên");
      assert.equal(parsed.unit, "CNTT", "Đơn vị 'CNTT' phải được giữ nguyên");
      assert.equal(parsed.month, 9, "Kỳ công tác 9 phải được giữ nguyên");
    });
  });

  describe("3. Transition: Reset tìm kiếm", () => {
    test("xóa từ khóa tìm kiếm nhưng giữ nguyên các bộ lọc danh mục và trạng thái khác", () => {
      const stateWithSearch: WorkspaceFilterState = {
        scope: "school",
        month: 9,
        status: "IN_PROGRESS",
        q: "học phần",
        view: "table",
      };

      const stateWithoutSearch: WorkspaceFilterState = {
        ...stateWithSearch,
        q: undefined,
        query: undefined,
      };

      const params = serializeWorkspaceQuery(stateWithoutSearch);
      const parsed = parseWorkspaceQuery(params);

      assert.equal(parsed.q, undefined, "Search query phải bị xóa");
      assert.equal(parsed.status, "IN_PROGRESS", "Status IN_PROGRESS được giữ nguyên");
      assert.equal(parsed.month, 9, "Kỳ công tác được giữ nguyên");
    });
  });

  describe("4. Roundtrip serialization và parse giữ nguyên tiêu chí", () => {
    test("roundtrip với đầy đủ các thuộc tính", () => {
      const original: WorkspaceFilterState = {
        scope: "unit",
        dept: "KHAO_THI",
        unit: "KHAO_THI",
        unitId: "KHAO_THI",
        month: 10,
        status: "WAITING_APPROVAL",
        attention: "requires_my_approval",
        view: "kanban",
        q: "báo cáo",
        taskId: "task-001",
      };

      const serialized = serializeWorkspaceQuery(original);
      const parsed = parseWorkspaceQuery(serialized);

      assert.equal(parsed.scope, original.scope);
      assert.equal(parsed.dept, original.dept);
      assert.equal(parsed.month, original.month);
      assert.equal(parsed.status, original.status);
      assert.equal(parsed.attention, original.attention);
      assert.equal(parsed.view, original.view);
      assert.equal(parsed.q, original.q);
      assert.equal(parsed.taskId, original.taskId);
    });
    test("reset lọc không thay đổi scope hay tháng công tác đã chọn", () => {
      const baseState: WorkspaceFilterState = {
        scope: "unit",
        dept: "CNTT",
        unit: "CNTT",
        month: 10,
        status: "WAITING_APPROVAL",
        attention: "requires_my_approval",
        view: "kanban",
        q: "rà soát đề cương",
      };

      // Thao tác reset bộ lọc theo chuẩn:
      // Xóa search, status, attention, category, priority
      // Giữ scope được phép, kỳ công tác đang chọn, dạng xem
      const resetState: WorkspaceFilterState = {
        scope: baseState.scope,
        dept: undefined,
        unit: undefined,
        month: baseState.month, // Giữ nguyên kỳ công tác tháng 10
        status: "ALL",
        attention: undefined,
        view: baseState.view,   // Giữ nguyên dạng xem kanban
        q: undefined,
      };

      const params = serializeWorkspaceQuery(resetState);
      const parsed = parseWorkspaceQuery(params);

      assert.equal(parsed.scope, "unit", "Scope 'unit' phải được giữ nguyên sau khi xóa bộ lọc");
      assert.equal(parsed.month, 10, "Tháng công tác 10 phải được giữ nguyên sau khi xóa bộ lọc");
      assert.equal(parsed.view, "kanban", "Dạng xem 'kanban' phải được giữ nguyên");
      assert.equal(parsed.status, "ALL", "Status phải được xóa về ALL");
      assert.equal(parsed.attention, undefined, "Attention phải được xóa hoàn toàn");
      assert.equal(parsed.q, undefined, "Search needle phải được xóa hoàn toàn");
    });
  });

  describe("5. TaskEmptyState: Trạng thái rỗng chuẩn hóa tiếng Việt và phát hiện cờ lọc", () => {
    test("khi lọc ra 0 kết quả với bộ lọc chung: hiển thị thông báo phù hợp và nút xóa lọc", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          priority: "URGENT",
          category: "HOAT_DONG_CHUYEN_MON",
          onResetFilters: () => {},
        })
      );

      // Phải có thông báo "Không có nhiệm vụ phù hợp"
      assert.ok(
        html.includes("Không có nhiệm vụ phù hợp"),
        "Phải hiển thị tiêu đề 'Không có nhiệm vụ phù hợp' khi có bộ lọc active"
      );

      // Phải có nút xóa lọc / đặt lại bộ lọc
      assert.ok(
        html.includes("Xóa bộ lọc") || html.includes("Đặt lại bộ lọc"),
        "Phải có nút xóa bộ lọc tác động về cha"
      );
    });

    test("khi không có bộ lọc và không có dữ liệu: hiển thị hướng dẫn tạo việc, không gợi ý reset", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          canAddTask: true,
          onAddTask: () => {},
          // Không truyền bộ lọc nào active
          activeTab: "all",
        })
      );

      assert.ok(
        !html.includes("Xóa bộ lọc") && !html.includes("Đặt lại bộ lọc"),
        "Không có bộ lọc thì không được hiện nút reset"
      );
      assert.ok(
        html.includes("Tạo nhiệm vụ mới"),
        "Phải hiện nút tạo nhiệm vụ phù hợp quyền"
      );
    });

    test("nhận diện hasFilterActive từ cả attention, status, priority, category và search", () => {
      // 1. Chỉ có priority
      const htmlPriority = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          priority: "HIGH",
          onResetFilters: () => {},
        })
      );
      assert.ok(htmlPriority.includes("bộ lọc"), "Priority active phải kích hoạt nút xóa bộ lọc");

      // 2. Chỉ có category
      const htmlCategory = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          category: "CONG_TAC_DAO_TAO",
          onResetFilters: () => {},
        })
      );
      assert.ok(htmlCategory.includes("bộ lọc"), "Category active phải kích hoạt nút xóa bộ lọc");

      // 3. Chỉ có attention
      const htmlAttention = renderToStaticMarkup(
        React.createElement(TaskEmptyState, {
          attention: "requires_my_approval",
          onResetFilters: () => {},
        })
      );
      assert.ok(htmlAttention.includes("bộ lọc"), "Attention active phải kích hoạt nút xóa bộ lọc");
    });
  });

  describe("6. Canonical filtering: filterDisplayedTasks", () => {
    test("lọc waiting_approval chỉ lấy task chờ duyệt", () => {
      const result = filterDisplayedTasks({
        tasks: sampleTasks,
        status: "waiting_approval",
      });
      assert.equal(result.length, 1);
      assert.equal(result[0].id, "task-approval-1");
    });

    test("lọc overdue chỉ lấy task quá hạn theo dueDate", () => {
      const result = filterDisplayedTasks({
        tasks: sampleTasks,
        status: "overdue",
      });
      assert.equal(result.length, 1);
      assert.equal(result[0].id, "task-overdue-1");
    });

    test("lọc Tất cả (status=ALL) trả về toàn bộ danh sách", () => {
      const result = filterDisplayedTasks({
        tasks: sampleTasks,
        status: "ALL",
      });
      assert.equal(result.length, 3);
    });
  });

  describe("7. View Mode Transitions & Kanban Persistence Invariants", () => {
    test("serialization of kanban preserves view=kanban in query string", () => {
      const state: WorkspaceFilterState = {
        scope: "school",
        view: "kanban",
        status: "ALL",
        month: 9,
      };
      const params = serializeWorkspaceQuery(state);
      assert.equal(params.get("view"), "kanban");
    });

    test("parsing ?view=kanban returns view: 'kanban'", () => {
      const sp = new URLSearchParams("scope=school&view=kanban");
      const parsed = parseWorkspaceQuery(sp);
      assert.equal(parsed.view, "kanban");
    });

    test("updating status/scope/search preserves view: 'kanban'", () => {
      const baseState: WorkspaceFilterState = {
        scope: "school",
        view: "kanban",
        status: "ALL",
        month: 9,
      };
      // Patch with status and search
      const patchedState: WorkspaceFilterState = {
        ...baseState,
        status: "WAITING_APPROVAL",
        q: "khảo sát",
      };
      const params = serializeWorkspaceQuery(patchedState);
      const parsed = parseWorkspaceQuery(params);
      assert.equal(parsed.view, "kanban", "View mode kanban must not be lost when filtering");
      assert.equal(parsed.status, "WAITING_APPROVAL");
      assert.equal(parsed.q, "khảo sát");
    });

    test("reset filters with preserveView preserves view: 'kanban'", () => {
      const activeState: WorkspaceFilterState = {
        scope: "unit",
        dept: "CNTT",
        view: "kanban",
        status: "IN_PROGRESS",
        q: "nghiên cứu",
        month: 9,
      };
      // Reset non-persistent dimensions
      const resetState: WorkspaceFilterState = {
        ...activeState,
        status: "ALL",
        dept: undefined,
        q: undefined,
      };
      const params = serializeWorkspaceQuery(resetState);
      const parsed = parseWorkspaceQuery(params);
      assert.equal(parsed.view, "kanban", "View mode kanban must be retained after reset");
      assert.equal(parsed.status, "ALL");
      assert.equal(parsed.dept, undefined);
    });
  });
});
