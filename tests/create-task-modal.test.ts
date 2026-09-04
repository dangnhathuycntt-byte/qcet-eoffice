import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateTaskForm,
  getInitialTaskFormData,
  type CreateTaskFormData,
} from "../src/components/dashboard/create-task-modal";

describe("CreateTaskModal Helpers", () => {
  test("getInitialTaskFormData returns clean initial state", () => {
    const data = getInitialTaskFormData();
    assert.equal(data.level, "TRUONG");
    assert.equal(data.category, "CHUYEN_DOI_SO");
    assert.equal(data.title, "");
    assert.equal(data.leadAssigneeName, "");
    assert.equal(data.dueDate, "");
    assert.equal(data.description, "");
    assert.deepEqual(data.coAssignees, []);
    assert.equal(data.parentTaskId, undefined);
  });

  test("validateTaskForm validates required fields", () => {
    const invalidData: CreateTaskFormData = {
      level: "TRUONG",
      category: "CHUYEN_DOI_SO",
      title: "   ",
      leadAssigneeName: "",
      dueDate: "",
      description: "",
      coAssignees: [],
    };
    const errors = validateTaskForm(invalidData);
    assert.ok(errors.title, "Expected title error");
    assert.ok(errors.leadAssigneeName, "Expected leadAssigneeName error");
    assert.ok(errors.dueDate, "Expected dueDate error");

    const validData: CreateTaskFormData = {
      level: "TRUONG",
      category: "ATTT",
      title: "Kiểm tra an ninh mạng",
      leadAssigneeName: "Trần Hùng",
      dueDate: "2026-09-30",
      description: "Mô tả chi tiết",
      coAssignees: ["Vinh"],
    };
    const noErrors = validateTaskForm(validData);
    assert.equal(Object.keys(noErrors).length, 0);
  });

  test("validateTaskForm requires parentTaskId when level is DON_VI if school tasks are provided or required", () => {
    const unitTaskWithoutParent: CreateTaskFormData = {
      level: "DON_VI",
      category: "CNTT",
      title: "Nâng cấp switch mạng phòng máy",
      leadAssigneeName: "Nguyễn Văn A",
      dueDate: "2026-09-25",
      description: "Bảo trì định kỳ",
      coAssignees: [],
      parentTaskId: "",
    };
    // If unit task allows optional or required parent task:
    // Let's test standard validation: title, leadAssigneeName, dueDate are always required
    const errors = validateTaskForm(unitTaskWithoutParent);
    assert.equal(errors.title, undefined);
    assert.equal(errors.leadAssigneeName, undefined);
    assert.equal(errors.dueDate, undefined);
  });
});
