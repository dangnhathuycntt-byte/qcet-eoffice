import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { TaskOrigin, SchoolTask } from "@qcet/contracts/types/dashboard";
import type { OwnershipRoleFilter, AssigneeWorkloadItem } from "@qcet/contracts/types/workspace";

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
import type { StaffTask } from "@qcet/contracts/types/dashboard";
import type { AuthUser } from "@qcet/contracts/types/auth";

import { filterTasksByRole } from "../src/lib/role-task-filter";

describe("Role Task Filter - STAFF DRI and Co-Assignee Support", () => {
  const staffMember: AuthUser = {
    id: "user-vinh",
    name: "Nguyễn Ngọc Vinh",
    email: "vinhnn@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên CNTT",
    department: "Khoa CNTT",
    departmentCode: "CNTT",
  };

  const tasksList: SchoolTask[] = [
    // Task where Vinh is DRI (leadAssigneeName), with team members doing subtasks
    {
      id: "task-vinh-dri",
      title: "Triển khai hệ thống E-Office",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "Nguyễn Ngọc Vinh",
      coAssignees: ["Trần Hùng"],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      origin: "SELF_INITIATED",
      totalSubTasks: 2,
      completedSubTasks: 1,
      progressPercent: 50,
      subTasks: [
        {
          id: "sub-t1",
          title: "Cấu hình Server",
          assigneeName: "Trần Hùng",
          status: "COMPLETED",
          dueDate: "2026-09-10",
          parentSchoolTaskId: "task-vinh-dri",
          updatedAt: "2026-09-05",
        },
        {
          id: "sub-t2",
          title: "Kiểm thử bảo mật",
          assigneeName: "Trần Hùng",
          status: "IN_PROGRESS",
          dueDate: "2026-09-20",
          parentSchoolTaskId: "task-vinh-dri",
          updatedAt: "2026-09-05",
        },
      ],
    },
    // Task where Vinh is co-assignee, but no sub-task assigned yet
    {
      id: "task-vinh-coassignee",
      title: "Chuẩn bị Đại hội Đoàn trường",
      category: "KHAC",
      categoryLabel: "Khác",
      leadAssigneeName: "Trần Hùng",
      coAssignees: ["Nguyễn Ngọc Vinh"],
      assignedDate: "2026-09-05",
      dueDate: "2026-09-28",
      status: "IN_PROGRESS",
      origin: "SCHOOL",
      totalSubTasks: 1,
      completedSubTasks: 0,
      progressPercent: 0,
      subTasks: [
        {
          id: "sub-t3",
          title: "Soạn văn kiện",
          assigneeName: "Trần Hùng",
          status: "IN_PROGRESS",
          dueDate: "2026-09-20",
          parentSchoolTaskId: "task-vinh-coassignee",
          updatedAt: "2026-09-05",
        },
      ],
    },
  ];

  test("STAFF sees tasks where they are DRI (retaining all subtasks for coordination)", () => {
    const filtered = filterTasksByRole(tasksList, staffMember);
    const driTask = filtered.find((t) => t.id === "task-vinh-dri");
    assert.ok(driTask, "STAFF must see task where they are leadAssigneeName (DRI)");
    assert.equal(driTask.subTasks.length, 2, "DRI must retain all subtasks for coordination");
  });

  test("STAFF sees tasks where they are in coAssignees even with zero assigned subtasks", () => {
    const filtered = filterTasksByRole(tasksList, staffMember);
    const coTask = filtered.find((t) => t.id === "task-vinh-coassignee");
    assert.ok(coTask, "STAFF must see task where they are in coAssignees");
  });
});

import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";

describe("Mock Dashboard Data - Origin and Ownership Cases", () => {
  test("mock payload includes both SCHOOL and SELF_INITIATED tasks", () => {
    const payload = getMockDashboardPayload();
    const schoolOrigins = payload.schoolTasks.map((t) => t.origin || "SCHOOL");

    assert.ok(schoolOrigins.includes("SCHOOL"), "Must contain SCHOOL origin tasks");
    assert.ok(schoolOrigins.includes("SELF_INITIATED"), "Must contain SELF_INITIATED origin tasks");
  });

  test("mock payload contains a task with multiple subtasks assigned to the same individual", () => {
    const payload = getMockDashboardPayload();
    const hasMultipleSubTasksForSamePerson = payload.schoolTasks.some((task) => {
      const counts: Record<string, number> = {};
      for (const st of task.subTasks) {
        counts[st.assigneeName] = (counts[st.assigneeName] || 0) + 1;
        if (counts[st.assigneeName] > 1) return true;
      }
      return false;
    });

    assert.equal(hasMultipleSubTasksForSamePerson, true);
  });
});
