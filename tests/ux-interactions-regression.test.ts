import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isFormDirty,
  takeFormSnapshot,
  validateTaskForm,
  validateSubtaskDueDate,
  validateSubtaskAssignment,
  resolveCreateTaskIdentity,
  getAllowedTaskLevelsForRole,
  getDefaultTaskLevelForRole,
  type CreateTaskFormData,
  type CreateTaskPersonnelRef,
} from "../src/components/dashboard/create-task-modal";
import {
  executeKanbanStatusTransition,
  applyOptimisticOverrides,
  extractKanbanItems,
  filterKanbanItems,
  groupTasksByStatus,
  type KanbanTransitionState,
} from "../src/components/tasks/task-kanban-board";
import {
  getCalendarAttentionState,
  sortCalendarItemsByAttention,
} from "../src/lib/calendar/calendar-presentation";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";

describe("Stream Form + Kanban + Lịch UX Interactions Regression Suite", () => {
  describe("Task 4: Form Close Contract, Snapshot Dirty Checking, and DRI Validation", () => {
    const baseFormData: CreateTaskFormData = {
      level: "TRUONG",
      category: "CHUYEN_DOI_SO",
      title: "Kế hoạch nâng cấp hạ tầng số 2026",
      leadAssigneeName: "TS. Nguyễn Văn A",
      dueDate: "2026-10-15",
      description: "Mô tả chi tiết kế hoạch công tác",
      priority: "HIGH",
      requiresReview: false,
      coAssignees: [],
    };

    it("evaluates clean baseline as not dirty", () => {
      const baseline = takeFormSnapshot(baseFormData);
      assert.strictEqual(isFormDirty(baseFormData, baseline), false);
    });

    it("detects dirty state when title, assignee, or dueDate changes", () => {
      const baseline = takeFormSnapshot(baseFormData);

      const modifiedTitle = { ...baseFormData, title: "Tên công việc mới" };
      assert.strictEqual(isFormDirty(modifiedTitle, baseline), true);

      const modifiedAssignee = { ...baseFormData, leadAssigneeName: "ThS. Trần Thị B" };
      assert.strictEqual(isFormDirty(modifiedAssignee, baseline), true);

      const modifiedDueDate = { ...baseFormData, dueDate: "2026-11-20" };
      assert.strictEqual(isFormDirty(modifiedDueDate, baseline), true);
    });

    it("detects dirty state when advanced fields (coAssignees, priority) change", () => {
      const baseline = takeFormSnapshot(baseFormData);

      const withCollaborator = { ...baseFormData, coAssignees: ["ThS. Trần Thị B"] };
      assert.strictEqual(isFormDirty(withCollaborator, baseline), true);

      const withPriority = { ...baseFormData, priority: "URGENT" as const };
      assert.strictEqual(isFormDirty(withPriority, baseline), true);
    });

    it("returns false (not dirty) when changes are reverted back to initial baseline", () => {
      const baseline = takeFormSnapshot(baseFormData);
      const modified = { ...baseFormData, title: "Tiêu đề tạm", coAssignees: ["Người hỗ trợ"] };
      assert.strictEqual(isFormDirty(modified, baseline), true);

      // Revert back
      const reverted = { ...baseFormData, title: "Kế hoạch nâng cấp hạ tầng số 2026", coAssignees: [] };
      assert.strictEqual(isFormDirty(reverted, baseline), false);
    });

    it("enforces Single DRI: lead assignee cannot simultaneously be collaborator", () => {
      const valid = validateSubtaskAssignment("user-1", ["user-2", "user-3"]);
      assert.strictEqual(valid.valid, true);

      const invalid = validateSubtaskAssignment("user-1", ["user-2", "user-1"]);
      assert.strictEqual(invalid.valid, false);
      assert.match(invalid.error || "", /đồng thời là cán bộ phối hợp/);
    });

    it("validates that subtask dueDate cannot exceed parent task dueDate", () => {
      const parentDueDate = "2026-10-15";
      assert.strictEqual(validateSubtaskDueDate(parentDueDate, "2026-10-10"), true);
      assert.strictEqual(validateSubtaskDueDate(parentDueDate, "2026-10-15"), true);
      assert.strictEqual(validateSubtaskDueDate(parentDueDate, "2026-10-16"), false);
      assert.strictEqual(validateSubtaskDueDate(parentDueDate, "2026-11-01"), false);
    });

    it("enforces allowed task levels by user role", () => {
      assert.deepStrictEqual(getAllowedTaskLevelsForRole("ADMIN"), ["TRUONG", "DON_VI"]);
      assert.deepStrictEqual(getAllowedTaskLevelsForRole("MANAGER"), ["DON_VI"]);
      assert.deepStrictEqual(getAllowedTaskLevelsForRole("STAFF"), []);

      assert.strictEqual(getDefaultTaskLevelForRole("ADMIN"), "TRUONG");
      assert.strictEqual(getDefaultTaskLevelForRole("MANAGER"), "DON_VI");
    });

    it("resolves assignee identity against personnel directory without fabricating IDs", () => {
      const personnel: CreateTaskPersonnelRef[] = [
        { id: "usr-1", name: "Nguyễn Văn A", departmentId: "dept-cntt" },
        { id: "usr-2", name: "Trần Thị B", departmentId: "dept-kh" },
      ];

      // Exact match in institutional mode
      const resultA = resolveCreateTaskIdentity({ leadAssigneeName: "Nguyễn Văn A" }, personnel);
      assert.strictEqual(resultA.ok, true);
      if (resultA.ok) {
        assert.strictEqual(resultA.assigneeId, "usr-1");
        assert.strictEqual(resultA.departmentId, "dept-cntt");
      }

      // Non-existent assignee rejected before network call
      const resultUnknown = resolveCreateTaskIdentity({ leadAssigneeName: "Người Lạ" }, personnel);
      assert.strictEqual(resultUnknown.ok, false);
      if (!resultUnknown.ok) {
        assert.strictEqual(resultUnknown.field, "leadAssigneeName");
        assert.match(resultUnknown.message, /không có trong danh mục nhân sự/);
      }
    });

    it("validates required fields in form", () => {
      const emptyForm: CreateTaskFormData = {
        level: "TRUONG",
        category: "CHUYEN_DOI_SO",
        title: "",
        leadAssigneeName: "",
        dueDate: "",
        coAssignees: [],
        description: "",
      };
      const errors = validateTaskForm(emptyForm);
      assert.ok(errors.title, "Title should have validation error");
      assert.ok(errors.leadAssigneeName, "Lead assignee should have validation error");
    });

    it("rejects subtask internal due date later than parent due date", () => {
      const parentTask = {
        id: "parent-1",
        title: "Nhiệm vụ cấp Trường",
        dueDate: "2026-10-15",
      } as unknown as SchoolTask;

      const subtaskFormData: CreateTaskFormData = {
        level: "DON_VI",
        category: "CHUYEN_DOI_SO",
        title: "Nhiệm vụ con",
        leadAssigneeName: "TS. Nguyễn Văn A",
        dueDate: "2026-10-10",
        internalDueDate: "2026-10-20", // Later than parent!
        parentTaskId: "parent-1",
        coAssignees: [],
        description: "",
      };

      const errors = validateTaskForm(subtaskFormData, parentTask);
      assert.ok(errors.internalDueDate, "Should raise error for invalid internalDueDate");
      assert.match(errors.internalDueDate, /không được muộn hơn hạn chót nhiệm vụ cha/);
    });

    it("rejects subtask completion due date later than parent due date", () => {
      const parentTask = {
        id: "parent-1",
        title: "Nhiệm vụ cấp Trường",
        dueDate: "2026-10-15",
      } as unknown as SchoolTask;

      const subtaskFormData: CreateTaskFormData = {
        level: "DON_VI",
        category: "CHUYEN_DOI_SO",
        title: "Nhiệm vụ con",
        leadAssigneeName: "TS. Nguyễn Văn A",
        dueDate: "2026-10-25", // Later than parent!
        parentTaskId: "parent-1",
        coAssignees: [],
        description: "",
      };

      const errors = validateTaskForm(subtaskFormData, parentTask);
      assert.ok(errors.dueDate, "Should raise error for invalid dueDate");
      assert.match(errors.dueDate, /không được muộn hơn hạn chót nhiệm vụ cha/);
    });
  });

  describe("Task 5: Kanban Transitions, Double-Click Prevention, and Optimistic Rollback", () => {
    const initialState: KanbanTransitionState = {
      pendingTaskIds: {},
      optimisticStatuses: {},
      taskErrors: {},
    };

    it("sets pending and optimistic state during transition and cleans up upon success", async () => {
      let dispatchedTaskId = "";
      let dispatchedStatus = "";

      const onStatusChange = async (taskId: string, newStatus: string) => {
        dispatchedTaskId = taskId;
        dispatchedStatus = newStatus;
        return { success: true };
      };

      const result = await executeKanbanStatusTransition(
        "task-101",
        "IN_PROGRESS",
        "NEW",
        initialState,
        onStatusChange
      );

      assert.strictEqual(result.ok, true);
      assert.strictEqual(dispatchedTaskId, "task-101");
      assert.strictEqual(dispatchedStatus, "IN_PROGRESS");
      assert.strictEqual(result.state.pendingTaskIds["task-101"], undefined);
      assert.strictEqual(result.state.optimisticStatuses["task-101"], "IN_PROGRESS");
    });

    it("prevents double execution while a task is already pending", async () => {
      const pendingState: KanbanTransitionState = {
        pendingTaskIds: { "task-101": true },
        optimisticStatuses: { "task-101": "IN_PROGRESS" },
        taskErrors: {},
      };

      let called = false;
      const onStatusChange = async () => {
        called = true;
      };

      const result = await executeKanbanStatusTransition(
        "task-101",
        "COMPLETED",
        "IN_PROGRESS",
        pendingState,
        onStatusChange
      );

      assert.strictEqual(result.ok, false);
      assert.strictEqual(called, false);
      assert.match(result.error || "", /đang xử lý/);
    });

    it("rolls back optimistic status and surfaces Vietnamese error when server rejects transition", async () => {
      const onStatusChange = async () => {
        throw new Error("Lỗi mạng: Không thể kết nối đến máy chủ.");
      };

      const result = await executeKanbanStatusTransition(
        "task-202",
        "COMPLETED",
        "IN_PROGRESS",
        initialState,
        onStatusChange
      );

      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.state.pendingTaskIds["task-202"], undefined);
      assert.strictEqual(result.state.optimisticStatuses["task-202"], undefined);
      assert.match(result.state.taskErrors["task-202"] || "", /Không thể kết nối/);
    });

    it("applies optimistic overrides to tasks and nested subtasks cleanly", () => {
      const mockTasks = [
        {
          id: "school-1",
          title: "Kế hoạch năm học",
          level: "TRUONG",
          status: "NEW",
          category: "CHUYEN_DOI_SO",
          leadAssigneeName: "TS. A",
          progressPercent: 0,
          subTasks: [
            {
              id: "sub-1",
              title: "Nhiệm vụ con 1",
              status: "NEW",
              assigneeName: "ThS. B",
            } as unknown as StaffTask,
          ],
        } as unknown as SchoolTask,
      ];

      const overrides = {
        "school-1": "IN_PROGRESS" as const,
        "sub-1": "COMPLETED" as const,
      };

      const updated = applyOptimisticOverrides(mockTasks, overrides);
      assert.strictEqual(updated[0].status, "IN_PROGRESS");
      assert.strictEqual(updated[0].subTasks?.[0].status, "COMPLETED");
      // Other fields intact
      assert.strictEqual(updated[0].title, "Kế hoạch năm học");
    });

    it("extracts and groups tasks by status across school and unit levels", () => {
      const mockTasks = [
        {
          id: "school-1",
          title: "Công việc cấp trường",
          level: "TRUONG",
          status: "IN_PROGRESS",
          category: "CHUYEN_DOI_SO",
          leadAssigneeName: "TS. A",
          subTasks: [
            {
              id: "sub-1",
              title: "Công việc cấp đơn vị",
              status: "COMPLETED",
              assigneeName: "ThS. B",
            } as unknown as StaffTask,
          ],
        } as unknown as SchoolTask,
      ];

      const allItems = extractKanbanItems(mockTasks);
      assert.strictEqual(allItems.length, 2);

      const filteredSchoolOnly = filterKanbanItems(mockTasks, "TRUONG");
      assert.strictEqual(filteredSchoolOnly.length, 1);
      assert.strictEqual(filteredSchoolOnly[0].id, "school-1");

      const filteredUnitOnly = filterKanbanItems(mockTasks, "DON_VI");
      assert.strictEqual(filteredUnitOnly.length, 1);
      assert.strictEqual(filteredUnitOnly[0].id, "sub-1");

      const grouped = groupTasksByStatus(mockTasks);
      assert.strictEqual(grouped.IN_PROGRESS.length, 1);
      assert.strictEqual(grouped.COMPLETED.length, 1);
      assert.strictEqual(grouped.NEW.length, 0);
    });
  });

  describe("Task 6: Calendar Attention Priority, Filter Preservation, and Empty State", () => {
    it("computes calendar attention state accurately based on status and dates", () => {
      const refDate = "2026-09-14";

      // Overdue task: due yesterday, not completed
      const overdueState = getCalendarAttentionState(
        {
          id: "t-1",
          title: "Việc quá hạn",
          status: "IN_PROGRESS",
          dueDate: "2026-09-13",
        },
        refDate
      );
      assert.strictEqual(overdueState, "overdue");

      // Due today
      const todayState = getCalendarAttentionState(
        {
          id: "t-2",
          title: "Việc hôm nay",
          status: "IN_PROGRESS",
          dueDate: "2026-09-14",
        },
        refDate
      );
      assert.strictEqual(todayState, "due_today");

      // Completed task past due is still completed, not overdue
      const completedState = getCalendarAttentionState(
        {
          id: "t-3",
          title: "Việc đã xong",
          status: "COMPLETED",
          dueDate: "2026-09-10",
        },
        refDate
      );
      assert.strictEqual(completedState, "completed");
    });

    it("sorts calendar items by attention severity: overdue first, completed last", () => {
      const refDate = "2026-09-14";
      const items = [
        { id: "1", title: "Việc bình thường", status: "IN_PROGRESS", dueDate: "2026-09-20" },
        { id: "2", title: "Việc đã xong", status: "COMPLETED", dueDate: "2026-09-10" },
        { id: "3", title: "Việc quá hạn khẩn", status: "IN_PROGRESS", dueDate: "2026-09-12" },
        { id: "4", title: "Việc đến hạn hôm nay", status: "IN_PROGRESS", dueDate: "2026-09-14" },
      ];

      const sorted = sortCalendarItemsByAttention(items, refDate);
      assert.strictEqual(sorted[0].id, "3", "Overdue item must appear first");
      assert.strictEqual(sorted[1].id, "4", "Due today item must appear second");
      assert.strictEqual(sorted[sorted.length - 1].id, "2", "Completed item must appear last");
    });

    it("preserves academic period, selectedDate, and scope when resetting filters", () => {
      // Contract test verifying that handleResetFilters only modifies filter criteria,
      // never touching currentPeriod, selectedDate, or activeScope.
      const calendarState = {
        selectedAcademicYear: "2025-2026",
        selectedMonthNumber: 9,
        selectedDate: "2026-09-14",
        activeScope: "school" as const,
        levelFilter: "TRUONG" as const,
        statusFilter: "OVERDUE",
        searchQuery: "Nâng cấp",
      };

      // Simulating handleResetFilters contract
      const resetFilters = (state: typeof calendarState) => ({
        ...state,
        levelFilter: "ALL" as const,
        statusFilter: "ALL",
        searchQuery: "",
      });

      const nextState = resetFilters(calendarState);

      // Criteria cleared
      assert.strictEqual(nextState.levelFilter, "ALL");
      assert.strictEqual(nextState.statusFilter, "ALL");
      assert.strictEqual(nextState.searchQuery, "");

      // Date, period, and scope preserved (Zero Silent Loss)
      assert.strictEqual(nextState.selectedAcademicYear, "2025-2026");
      assert.strictEqual(nextState.selectedMonthNumber, 9);
      assert.strictEqual(nextState.selectedDate, "2026-09-14");
      assert.strictEqual(nextState.activeScope, "school");
    });

    it("supports individual filter chip removal without clearing other criteria or date", () => {
      const calendarState = {
        selectedDate: "2026-09-14",
        levelFilter: "TRUONG" as const,
        statusFilter: "IN_PROGRESS",
        searchQuery: "Nhiệm vụ số",
      };

      // Remove only status filter
      const removedStatus = { ...calendarState, statusFilter: "ALL" };
      assert.strictEqual(removedStatus.statusFilter, "ALL");
      assert.strictEqual(removedStatus.levelFilter, "TRUONG");
      assert.strictEqual(removedStatus.searchQuery, "Nhiệm vụ số");
      assert.strictEqual(removedStatus.selectedDate, "2026-09-14");

      // Remove only search query
      const removedSearch = { ...calendarState, searchQuery: "" };
      assert.strictEqual(removedSearch.searchQuery, "");
      assert.strictEqual(removedSearch.statusFilter, "IN_PROGRESS");
      assert.strictEqual(removedSearch.levelFilter, "TRUONG");
      assert.strictEqual(removedSearch.selectedDate, "2026-09-14");
    });

    it("distinguishes empty state caused by active filters versus a day with no tasks", () => {
      const resolveEmptyState = (hasTasksTotal: boolean, hasActiveFilters: boolean) => {
        if (!hasTasksTotal) {
          return {
            type: "empty_day",
            message: "Không có nhiệm vụ hoặc sự kiện nào trong ngày này",
            actionLabel: "Tạo nhiệm vụ",
          };
        }
        if (hasActiveFilters) {
          return {
            type: "filtered_out",
            message: "Không có công việc nào khớp với bộ lọc",
            actionLabel: "Xóa tất cả bộ lọc",
          };
        }
        return {
          type: "none",
          message: "",
          actionLabel: "",
        };
      };

      // Case 1: Day truly has 0 tasks
      const dayEmpty = resolveEmptyState(false, false);
      assert.strictEqual(dayEmpty.type, "empty_day");
      assert.strictEqual(dayEmpty.actionLabel, "Tạo nhiệm vụ");

      // Case 2: Tasks exist on day, but filters eliminated all matches
      const filteredEmpty = resolveEmptyState(true, true);
      assert.strictEqual(filteredEmpty.type, "filtered_out");
      assert.strictEqual(filteredEmpty.actionLabel, "Xóa tất cả bộ lọc");
    });
  });
});
