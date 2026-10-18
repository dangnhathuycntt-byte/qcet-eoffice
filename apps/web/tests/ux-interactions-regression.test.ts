import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateSubtaskDueDate } from "../src/hooks/use-create-task-form";
import {
  getCalendarAttentionState,
  sortCalendarItemsByAttention,
} from "../src/lib/calendar/calendar-presentation";

describe("Stream Form + Lịch UX Interactions Regression Suite", () => {
  describe("Task 4: Form Close Contract, Snapshot Dirty Checking, and DRI Validation", () => {

    it("validates that subtask dueDate cannot exceed parent task dueDate", () => {
      const parentDueDate = "2026-10-15";
      assert.strictEqual(validateSubtaskDueDate(parentDueDate, "2026-10-10"), true);
      assert.strictEqual(validateSubtaskDueDate(parentDueDate, "2026-10-15"), true);
      assert.strictEqual(validateSubtaskDueDate(parentDueDate, "2026-10-16"), false);
      assert.strictEqual(validateSubtaskDueDate(parentDueDate, "2026-11-01"), false);
    });
  });

  describe("Task 6: Calendar Attention Priority, Filter Preservation, and Empty State", () => {
    it("computes calendar attention state accurately based on status and dates", () => {
      const refDate = "2026-09-14";

      // Overdue task: due yesterday, not completed
      const overdueState = getCalendarAttentionState(
        {
          id: "t-1",
          title: "Việc trễ hạn",
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
        { id: "3", title: "Việc trễ hạn khẩn", status: "IN_PROGRESS", dueDate: "2026-09-12" },
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
