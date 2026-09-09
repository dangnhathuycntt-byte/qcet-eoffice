import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getPageNumbers } from "../src/components/tasks/table/components/task-pagination-bar";
import {
  areTaskRowPropsEqual,
  parseLeadAssignee,
} from "../src/components/tasks/table/components/task-row";
import { getStatusBadgeConfig, getCategoryBadgeConfig } from "../src/components/tasks/table/constants";
import { getSlaBadgeStatus, formatTableDate } from "../src/components/tasks/table/utils/table-date-helpers";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";

describe("Task Table Presentation Components - Unit & Behavior Suite", () => {
  describe("TaskPaginationBar - getPageNumbers Pagination Engine", () => {
    it("returns direct sequential page numbers when totalPages <= 5", () => {
      assert.deepEqual(getPageNumbers(1, 1), [1]);
      assert.deepEqual(getPageNumbers(1, 3), [1, 2, 3]);
      assert.deepEqual(getPageNumbers(3, 5), [1, 2, 3, 4, 5]);
    });

    it("inserts right ellipsis when on early pages (page 1-3 of 10)", () => {
      const p1 = getPageNumbers(1, 10);
      assert.equal(p1[0], 1);
      assert.equal(p1[p1.length - 1], 10);
      assert.ok(p1.includes("..."));
      assert.deepEqual(p1, [1, 2, "...", 10]);

      const p3 = getPageNumbers(3, 10);
      assert.deepEqual(p3, [1, 2, 3, 4, "...", 10]);
    });

    it("inserts both left and right ellipses when in the middle (page 5 of 10)", () => {
      const p5 = getPageNumbers(5, 10);
      assert.deepEqual(p5, [1, "...", 4, 5, 6, "...", 10]);
    });

    it("inserts left ellipsis when on late pages (page 8-10 of 10)", () => {
      const p8 = getPageNumbers(8, 10);
      assert.deepEqual(p8, [1, "...", 7, 8, 9, 10]);

      const p10 = getPageNumbers(10, 10);
      assert.deepEqual(p10, [1, "...", 9, 10]);
    });
  });

  describe("TaskRow - areTaskRowPropsEqual Custom Memoization Guard", () => {
    const baseTask: SchoolTask = {
      id: "st-001",
      taskCode: "NV-001",
      title: "Triển khai hệ thống E-Office",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: "2026-09-30",
      assignedDate: "2026-09-01",
      department: "Khoa CNTT",
      leadAssigneeName: "Nguyễn Văn A",
      leadAssigneeId: "user-1",
      leadAssigneeAvatar: "/avatar1.png",
      progressPercent: 45,
      totalSubTasks: 3,
      completedSubTasks: 1,
      coAssignees: [],
      subTasks: [
        {
          id: "sub-1",
          title: "Thiết kế CSDL",
          assigneeName: "Trần B",
          status: "COMPLETED",
          dueDate: "2026-09-15",
          updatedAt: "2026-09-01",
        } as StaffTask,
      ],
      createdAt: "2026-09-01",
      updatedAt: "2026-09-05",
    };

    const baseProps = {
      task: baseTask,
      isSelected: false,
      isExpanded: false,
      isActive: false,
      density: "comfortable" as const,
      showSelection: true,
      canAssign: false,
      selectedAcademicMonth: 9,
      referenceDate: "2026-09-09",
    };

    it("returns true when props and task properties are identical", () => {
      const nextProps = { ...baseProps, task: { ...baseTask } };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), true);
    });

    it("returns false when selection state changes", () => {
      const nextProps = { ...baseProps, isSelected: true };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when expansion state changes", () => {
      const nextProps = { ...baseProps, isExpanded: true };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when active focus highlight state changes", () => {
      const nextProps = { ...baseProps, isActive: true };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when density changes between comfortable and compact", () => {
      const nextProps = { ...baseProps, density: "compact" as const };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when task progressPercent changes", () => {
      const nextProps = {
        ...baseProps,
        task: { ...baseTask, progressPercent: 60 },
      };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when task status changes", () => {
      const nextProps = {
        ...baseProps,
        task: { ...baseTask, status: "COMPLETED" as const },
      };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when subtasks count changes", () => {
      const nextProps = {
        ...baseProps,
        task: {
          ...baseTask,
          subTasks: [
            ...baseTask.subTasks!,
            {
              id: "sub-2",
              title: "Tích hợp API",
              assigneeName: "Lê C",
              status: "NEW",
              dueDate: "2026-09-20",
              updatedAt: "2026-09-02",
            } as StaffTask,
          ],
        },
      };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when leadAssigneeName or leadAssigneeId changes", () => {
      const nextProps = {
        ...baseProps,
        task: { ...baseTask, leadAssigneeName: "Phạm D" },
      };
      assert.equal(areTaskRowPropsEqual(baseProps, nextProps), false);
    });

    it("returns false when activeCategory or suppressCategory changes", () => {
      const nextCatProps = {
        ...baseProps,
        activeCategory: "CHUYEN_DOI_SO",
      };
      assert.equal(areTaskRowPropsEqual(baseProps, nextCatProps), false);

      const nextSuppressProps = {
        ...baseProps,
        suppressCategory: true,
      };
      assert.equal(areTaskRowPropsEqual(baseProps, nextSuppressProps), false);
    });
  });

  describe("DRI Lead Assignee Parser - parseLeadAssignee", () => {
    it("extracts academic title and clean name from formatted DRI string", () => {
      const result = parseLeadAssignee("TT ThS. Nguyễn Tiến Phong", "P.TC-ĐBCL");
      assert.equal(result.primaryName, "Nguyễn Tiến Phong");
      assert.equal(result.subtext, "TT ThS. · P.TC-ĐBCL");
    });

    it("handles parenthetical title notes cleanly", () => {
      const result = parseLeadAssignee(
        "ThS. Nguyễn Tiến Phong (Trưởng phòng TC-ĐBCL)",
        "P.TC-ĐBCL"
      );
      assert.equal(result.primaryName, "Nguyễn Tiến Phong");
      assert.equal(result.subtext, "ThS. · Trưởng phòng TC-ĐBCL");
    });

    it("handles plain names without title prefix by attaching department subtext", () => {
      const result = parseLeadAssignee("Nguyễn Văn A", "Khoa CNTT");
      assert.equal(result.primaryName, "Nguyễn Văn A");
      assert.equal(result.subtext, "Khoa CNTT");
    });

    it("handles fallback gracefully when name is empty or undefined", () => {
      const result = parseLeadAssignee(undefined, "P.QLĐT");
      assert.equal(result.primaryName, "QCET");
      assert.equal(result.subtext, "P.QLĐT");
    });
  });

  describe("Subtask and SLA Badge Integrations", () => {
    it("evaluates overdue SLA status correctly for past due dates", () => {
      const sla = getSlaBadgeStatus("2026-09-01", "IN_PROGRESS", "2026-09-09");
      assert.equal(sla.isOverdue, true);
      assert.equal(sla.isToday, false);
      assert.ok(sla.label.includes("Quá hạn"));
    });

    it("evaluates due today SLA status accurately", () => {
      const sla = getSlaBadgeStatus("2026-09-09", "IN_PROGRESS", "2026-09-09");
      assert.equal(sla.isOverdue, false);
      assert.equal(sla.isToday, true);
      assert.equal(sla.label, "Hôm nay");
    });

    it("evaluates completed tasks as non-overdue regardless of date", () => {
      const sla = getSlaBadgeStatus("2026-09-01", "COMPLETED", "2026-09-09");
      assert.equal(sla.isOverdue, false);
      assert.equal(sla.label, "Đã hoàn thành");
    });

    it("formats table dates cleanly to DD/MM/YYYY", () => {
      assert.equal(formatTableDate("2026-09-30"), "30/09/2026");
      assert.equal(formatTableDate(null), "—");
      assert.equal(formatTableDate(""), "—");
    });
  });

  describe("Badge Configuration Mappings", () => {
    it("maps standard task statuses to appropriate badge styles", () => {
      assert.equal(getStatusBadgeConfig("COMPLETED").label, "Hoàn thành");
      assert.equal(getStatusBadgeConfig("IN_PROGRESS").label, "Đang thực hiện");
      assert.equal(getStatusBadgeConfig("NEW").label, "Mới");
      assert.equal(getStatusBadgeConfig("OVERDUE").label, "Quá hạn");
      assert.equal(getStatusBadgeConfig("CANCELLED").label, "Đã hủy");
    });

    it("maps DACUM categories to clean labels", () => {
      assert.equal(getCategoryBadgeConfig("CHUYEN_DOI_SO").label, "Chuyển đổi số");
      assert.equal(getCategoryBadgeConfig("TRUYEN_THONG").label, "Truyền thông");
      assert.equal(getCategoryBadgeConfig("ATTT").label, "An toàn thông tin");
    });
  });
});
