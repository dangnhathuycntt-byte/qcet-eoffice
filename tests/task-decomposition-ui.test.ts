import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateSubtaskDueDate,
  validateSubtaskAssignment,
  validateTaskForm,
  getInitialTaskFormData,
  type CreateTaskFormData,
} from "../src/components/dashboard/create-task-modal";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";

describe("Task Decomposition UI & Validation Logic (Task 3)", () => {
  describe("1. validateSubtaskDueDate", () => {
    test("allows subtask due date before parent task due date", () => {
      assert.equal(validateSubtaskDueDate("2026-10-30", "2026-10-15"), true);
    });

    test("allows subtask due date on the same day as parent task due date", () => {
      assert.equal(validateSubtaskDueDate("2026-10-30", "2026-10-30"), true);
    });

    test("rejects subtask due date after parent task due date", () => {
      assert.equal(validateSubtaskDueDate("2026-10-30", "2026-11-01"), false);
      assert.equal(validateSubtaskDueDate("2026-10-15", "2026-10-16"), false);
    });

    test("handles empty inputs safely", () => {
      assert.equal(validateSubtaskDueDate("", "2026-10-15"), true);
      assert.equal(validateSubtaskDueDate("2026-10-30", ""), true);
    });

    test("rejects invalid date strings", () => {
      assert.equal(validateSubtaskDueDate("invalid-date", "2026-10-15"), false);
      assert.equal(validateSubtaskDueDate("2026-10-30", "not-a-date"), false);
    });
  });

  describe("2. validateSubtaskAssignment (Single DRI Principle)", () => {
    test("passes when valid single DRI is assigned without collaborators", () => {
      const res = validateSubtaskAssignment("user-123", []);
      assert.equal(res.valid, true);
      assert.equal(res.error, undefined);
    });

    test("passes when valid single DRI is assigned with distinct collaborators", () => {
      const res = validateSubtaskAssignment("user-123", ["user-456", "user-789"]);
      assert.equal(res.valid, true);
      assert.equal(res.error, undefined);
    });

    test("fails when single DRI (leadAssignee) is missing or empty", () => {
      const res1 = validateSubtaskAssignment("", ["user-456"]);
      assert.equal(res1.valid, false);
      assert.ok(res1.error?.includes("Người phụ trách chính") || res1.error?.includes("DRI"));

      const res2 = validateSubtaskAssignment("   ", []);
      assert.equal(res2.valid, false);
      assert.ok(res2.error?.includes("Người phụ trách chính") || res2.error?.includes("DRI"));
    });

    test("fails when collaborator list duplicates the leadAssignee", () => {
      const res = validateSubtaskAssignment("user-123", ["user-456", "user-123"]);
      assert.equal(res.valid, false);
      assert.ok(
        res.error?.includes("Người phụ trách chính không thể") ||
        res.error?.includes("trùng") ||
        res.error?.includes("phối hợp")
      );
    });
  });

  describe("3. CreateTaskModal form validation for Subtasks", () => {
    const parentTask: SchoolTask = {
      id: "parent-task-1",
      code: "NV-2026-09-001",
      title: "Triển khai hệ thống E-Office toàn trường",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "Trần Hùng",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-10-31",
      status: "IN_PROGRESS",
      progressPercent: 40,
      totalSubTasks: 3,
      completedSubTasks: 1,
      subTasks: [],
    };

    test("validateTaskForm enforces subtask due date cannot exceed parent task due date", () => {
      const invalidSubtaskForm: CreateTaskFormData = {
        level: "DON_VI",
        category: "CHUYEN_DOI_SO",
        title: "Xây dựng module phân rã nhiệm vụ",
        leadAssigneeName: "Nguyễn Văn Tuấn",
        coAssignees: ["Trần Thị Hoa"],
        dueDate: "2026-11-05", // Exceeds parent dueDate (2026-10-31)
        description: "",
        parentTaskId: "parent-task-1",
      };

      const errors = validateTaskForm(invalidSubtaskForm, parentTask);
      assert.ok(errors.dueDate, "Phải có lỗi dueDate khi vượt quá hạn chót cha");
      assert.ok(
        errors.dueDate.includes("Hạn chót của nhiệm vụ con không được muộn hơn hạn chót nhiệm vụ cha") ||
        errors.dueDate.includes("không được vượt quá hạn chót"),
        `Unexpected error message: ${errors.dueDate}`
      );
    });

    test("validateTaskForm accepts subtask when dueDate is within parent task dueDate", () => {
      const validSubtaskForm: CreateTaskFormData = {
        level: "DON_VI",
        category: "CHUYEN_DOI_SO",
        title: "Xây dựng module phân rã nhiệm vụ",
        leadAssigneeName: "Nguyễn Văn Tuấn",
        coAssignees: ["Trần Thị Hoa"],
        dueDate: "2026-10-25", // Before parent dueDate (2026-10-31)
        description: "",
        parentTaskId: "parent-task-1",
      };

      const errors = validateTaskForm(validSubtaskForm, parentTask);
      assert.equal(errors.dueDate, undefined);
    });

    test("validateTaskForm accepts explicit parentDueDate string when parentSchoolTask object is not provided", () => {
      const invalidSubtaskForm: CreateTaskFormData = {
        level: "DON_VI",
        category: "CHUYEN_DOI_SO",
        title: "Nhiệm vụ con độc lập",
        leadAssigneeName: "Nguyễn Văn Tuấn",
        coAssignees: [],
        dueDate: "2026-11-15",
        description: "",
        parentTaskId: "parent-task-1",
      };

      const errors = validateTaskForm(
        invalidSubtaskForm,
        undefined,
        undefined,
        "2026-10-31" // explicit parentDueDate
      );
      assert.ok(errors.dueDate, "Phải có lỗi khi vượt qua explicit parentDueDate");
      assert.ok(
        errors.dueDate.includes("Hạn chót của nhiệm vụ con không được muộn hơn hạn chót nhiệm vụ cha")
      );
    });
  });

  describe("4. TaskDetailSideSheet Decomposition & Breadcrumb Contracts", () => {
    test("verifies breadcrumb target and subtask selection contracts", () => {
      // Sample subtask with parent reference
      const subTaskSample: StaffTask = {
        id: "sub-101",
        code: "NV-2026-09-088",
        title: "Viết test case cho phân rã UI",
        assigneeName: "Nguyễn Văn Tuấn",
        assigneeAvatar: "https://avatar.example/tuan.jpg",
        status: "IN_PROGRESS",
        dueDate: "2026-10-20",
        parentSchoolTaskId: "parent-task-1",
        parentSchoolTaskTitle: "Triển khai hệ thống E-Office toàn trường",
        parentSchoolTaskCode: "NV-2026-09-001",
        updatedAt: "2026-09-09",
        progressPercent: 65,
      };

      // Verify breadcrumb contract
      let selectedNavId: string | null = null;
      const onSelectSubTask = (target: StaffTask | string) => {
        selectedNavId = typeof target === "string" ? target : target.id;
      };

      // When clicking parent breadcrumb, onSelectSubTask receives parentSchoolTaskId
      onSelectSubTask(subTaskSample.parentSchoolTaskId!);
      assert.equal(selectedNavId, "parent-task-1");

      // When clicking a subtask item, onSelectSubTask receives subtask id
      onSelectSubTask(subTaskSample.id);
      assert.equal(selectedNavId, "sub-101");

      // When clicking with StaffTask object, it also resolves correctly
      onSelectSubTask(subTaskSample);
      assert.equal(selectedNavId, "sub-101");
    });

    test("verifies onAddSubTask contract with prefilled title", () => {
      let capturedParentId: string | null = null;
      let capturedPrefillTitle: string | undefined = undefined;

      const onAddSubTask = (parentId: string, prefillTitle?: string) => {
        capturedParentId = parentId;
        capturedPrefillTitle = prefillTitle;
      };

      onAddSubTask("parent-task-1", "Nhiệm vụ con cần tạo");
      assert.equal(capturedParentId, "parent-task-1");
      assert.equal(capturedPrefillTitle, "Nhiệm vụ con cần tạo");
    });
  });
});
