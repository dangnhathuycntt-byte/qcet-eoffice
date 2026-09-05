import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  canUserReviewTask,
  canUserSubmitDeliverable,
  canUserCloseSchoolTask,
} from "../src/components/dashboard/task-detail-side-sheet";
import type { AuthUser } from "../src/types/auth";
import type { StaffTask, SchoolTask } from "../src/types/dashboard";

describe("Task Detail Side Sheet Role Permissions", () => {
  const adminUser: AuthUser = {
    id: "admin-1",
    name: "Hiệu trưởng",
    email: "bgh@cdktcnqn.edu.vn",
    role: "ADMIN",
    roleLabel: "Ban Giám hiệu",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
  };

  const managerUser: AuthUser = {
    id: "manager-1",
    name: "Trần Hùng",
    email: "daotao@cdktcnqn.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng phòng Đào tạo",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
  };

  const staffUser: AuthUser = {
    id: "staff-1",
    name: "Lê Văn A",
    email: "anlv@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên Đào tạo",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
  };

  test("canUserSubmitDeliverable allows only assignee when task is IN_PROGRESS or BLOCKED", () => {
    const task: StaffTask = {
      id: "t1",
      title: "Biên soạn tài liệu",
      assigneeName: "Lê Văn A",
      status: "IN_PROGRESS",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "s1",
      updatedAt: "",
    };

    assert.equal(canUserSubmitDeliverable(task, staffUser), true);
    assert.equal(canUserSubmitDeliverable(task, managerUser), false);

    const completedTask: StaffTask = { ...task, status: "COMPLETED" };
    assert.equal(canUserSubmitDeliverable(completedTask, staffUser), false);

    const blockedTask: StaffTask = { ...task, status: "BLOCKED" };
    assert.equal(canUserSubmitDeliverable(blockedTask, staffUser), true);
    assert.equal(canUserSubmitDeliverable(blockedTask, managerUser), false);

    const newTask: StaffTask = { ...task, status: "NEW" };
    assert.equal(canUserSubmitDeliverable(newTask, staffUser), false);

    const needsReviewTask: StaffTask = { ...task, status: "NEEDS_REVIEW" };
    assert.equal(canUserSubmitDeliverable(needsReviewTask, staffUser), false);

    assert.equal(canUserSubmitDeliverable(task, null), false);
    assert.equal(canUserSubmitDeliverable(task, undefined), false);
  });

  test("canUserReviewTask allows manager and admin when status is NEEDS_REVIEW", () => {
    const task: StaffTask = {
      id: "t1",
      title: "Biên soạn tài liệu",
      assigneeName: "Lê Văn A",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "s1",
      updatedAt: "",
    };

    assert.equal(canUserReviewTask(task, managerUser), true);
    assert.equal(canUserReviewTask(task, adminUser), true);
    assert.equal(canUserReviewTask(task, staffUser), false);

    const inProgressTask: StaffTask = { ...task, status: "IN_PROGRESS" };
    assert.equal(canUserReviewTask(inProgressTask, managerUser), false);
    assert.equal(canUserReviewTask(inProgressTask, adminUser), false);

    const completedTask: StaffTask = { ...task, status: "COMPLETED" };
    assert.equal(canUserReviewTask(completedTask, managerUser), false);

    assert.equal(canUserReviewTask(task, null), false);
    assert.equal(canUserReviewTask(task, undefined), false);
  });

  test("canUserCloseSchoolTask allows only ADMIN when status is PENDING_EXECUTIVE_APPROVAL", () => {
    const schoolTask: SchoolTask = {
      id: "s1",
      title: "Tuyển sinh 2026",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "Trần Hùng",
      coAssignees: [],
      assignedDate: "",
      dueDate: "",
      status: "PENDING_EXECUTIVE_APPROVAL",
      subTasks: [],
      totalSubTasks: 2,
      completedSubTasks: 2,
      progressPercent: 100,
    };

    assert.equal(canUserCloseSchoolTask(schoolTask, adminUser), true);
    assert.equal(canUserCloseSchoolTask(schoolTask, managerUser), false);
    assert.equal(canUserCloseSchoolTask(schoolTask, staffUser), false);

    const inProgressSchoolTask: SchoolTask = {
      ...schoolTask,
      status: "IN_PROGRESS",
    };
    assert.equal(canUserCloseSchoolTask(inProgressSchoolTask, adminUser), false);

    const completedSchoolTask: SchoolTask = {
      ...schoolTask,
      status: "COMPLETED",
    };
    assert.equal(canUserCloseSchoolTask(completedSchoolTask, adminUser), false);

    assert.equal(canUserCloseSchoolTask(schoolTask, null), false);
    assert.equal(canUserCloseSchoolTask(schoolTask, undefined), false);
  });
});
