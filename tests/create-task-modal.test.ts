import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateTaskForm,
  getInitialTaskFormData,
  CATEGORY_OPTIONS,
  QCET_DEPARTMENT_GROUPS,
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
    const errors = validateTaskForm(unitTaskWithoutParent);
    assert.equal(errors.title, undefined);
    assert.equal(errors.leadAssigneeName, undefined);
    assert.equal(errors.dueDate, undefined);
  });

  test("Anti-slop: zero emojis in create task modal department groups and category options", () => {
    const hasEmoji = (str: string) =>
      /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F680}-\u{1F6C5}\u{1F6CB}-\u{1F6D0}\u{1F6E0}-\u{1F6E5}\u{1F6F0}-\u{1F6F3}]/u.test(str);

    for (const group of QCET_DEPARTMENT_GROUPS) {
      assert.equal(hasEmoji(group.department), false, `Emoji found in department: ${group.department}`);
      if (group.icon) {
        assert.equal(hasEmoji(group.icon), false, `Emoji found in group icon: ${group.icon}`);
      }
      for (const member of group.members) {
        assert.equal(hasEmoji(member.name), false, `Emoji found in member name: ${member.name}`);
        assert.equal(hasEmoji(member.title), false, `Emoji found in member title: ${member.title}`);
        assert.equal(hasEmoji(member.role), false, `Emoji found in member role: ${member.role}`);
      }
    }

    for (const cat of CATEGORY_OPTIONS) {
      assert.equal(hasEmoji(cat.label), false, `Emoji found in category: ${cat.label}`);
    }
  });
});
