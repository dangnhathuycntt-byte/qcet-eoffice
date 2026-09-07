import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { TaskOrigin, SchoolTask } from "../src/types/dashboard";
import type { OwnershipRoleFilter, AssigneeWorkloadItem } from "../src/types/workspace";

describe("Task Ownership Model - Type Definitions", () => {
  test("supports TaskOrigin union values and backward compatibility", () => {
    const origin1: TaskOrigin = "SCHOOL";
    const origin2: TaskOrigin = "SELF_INITIATED";
    assert.equal(origin1, "SCHOOL");
    assert.equal(origin2, "SELF_INITIATED");

    const sampleTask: SchoolTask = {
      id: "task-test-1",
      title: "Nhiệm vụ kiểm thử",
      category: "CNTT",
      categoryLabel: "Công nghệ thông tin",
      leadAssigneeName: "Trần Hùng",
      coAssignees: ["Nguyễn Ngọc Vinh"],
      assignedDate: "2026-09-07",
      dueDate: "2026-09-24",
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 0,
      origin: "SELF_INITIATED",
    };

    assert.equal(sampleTask.origin, "SELF_INITIATED");
  });

  test("validates OwnershipRoleFilter and AssigneeWorkloadItem structures", () => {
    const filters: OwnershipRoleFilter[] = ["ALL", "LEADING", "PARTICIPATING"];
    assert.equal(filters.length, 3);

    const workload: AssigneeWorkloadItem = {
      assigneeName: "Nguyễn Ngọc Vinh",
      count: 2,
      completedCount: 1,
    };
    assert.equal(workload.count, 2);
    assert.equal(workload.completedCount, 1);
  });
});
