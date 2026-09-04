import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isSchoolTask,
  getTaskLevelBadge,
  getDetailStatusConfig,
  formatDetailDate,
} from "../src/components/dashboard/task-detail-side-sheet";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";

describe("TaskDetailSideSheet Type Guard", () => {
  test("distinguishes SchoolTask from StaffTask", () => {
    const schoolTask: SchoolTask = {
      id: "s1",
      title: "Test School",
      category: "CNTT",
      categoryLabel: "CNTT",
      leadAssigneeName: "Hùng",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-20",
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 0,
    };

    const staffTask: StaffTask = {
      id: "st1",
      title: "Test Staff",
      assigneeName: "Tuấn",
      status: "NEW",
      dueDate: "2026-09-15",
      parentSchoolTaskId: "s1",
      updatedAt: "2026-09-02",
    };

    assert.equal(isSchoolTask(schoolTask), true);
    assert.equal(isSchoolTask(staffTask), false);
    assert.equal(isSchoolTask(null), false);
    assert.equal(isSchoolTask(undefined), false);
  });

  test("provides correct Task Level badge labels", () => {
    const schoolLevel = getTaskLevelBadge(true);
    assert.equal(schoolLevel.label, "Nhiệm vụ cấp Trường");

    const staffLevel = getTaskLevelBadge(false);
    assert.equal(staffLevel.label, "Công việc Đơn vị");
  });

  test("provides status configuration for quick selector and badge", () => {
    const newConfig = getDetailStatusConfig("NEW");
    assert.equal(newConfig.label, "Mới");

    const inProgressConfig = getDetailStatusConfig("IN_PROGRESS");
    assert.equal(inProgressConfig.label, "Đang thực hiện");

    const needsReviewConfig = getDetailStatusConfig("NEEDS_REVIEW");
    assert.equal(needsReviewConfig.label, "Cần chỉnh sửa");

    const completedConfig = getDetailStatusConfig("COMPLETED");
    assert.equal(completedConfig.label, "Hoàn thành");
  });

  test("formats detail dates safely", () => {
    assert.equal(formatDetailDate("2026-09-20"), "20/09/2026");
    assert.equal(formatDetailDate(""), "Chưa đặt");
    assert.equal(formatDetailDate(undefined), "Chưa đặt");
  });
});
