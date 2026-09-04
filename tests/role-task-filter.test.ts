import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  filterTasksByRole,
  canCreateSchoolTask,
  canAssignUnitTask,
  DEFAULT_DEMO_USERS,
} from "../src/lib/role-task-filter";
import type { SchoolTask } from "../src/types/dashboard";

describe("RBAC Task Filter Engine", () => {
  const sampleTasks: SchoolTask[] = [
    {
      id: "school-1",
      title: "An ninh mạng",
      category: "ATTT",
      categoryLabel: "An toàn thông tin",
      leadAssigneeName: "Trần Hùng",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-24",
      status: "IN_PROGRESS",
      subTasks: [
        {
          id: "sub-1",
          title: "Kiểm tra bản sao lưu",
          assigneeName: "Trần Hùng",
          status: "IN_PROGRESS",
          dueDate: "2026-09-24",
          parentSchoolTaskId: "school-1",
          updatedAt: "2026-09-01",
        },
        {
          id: "sub-2",
          title: "Báo cáo an ninh",
          assigneeName: "Nguyễn Ngọc Vinh",
          status: "COMPLETED",
          dueDate: "2026-09-24",
          parentSchoolTaskId: "school-1",
          updatedAt: "2026-09-01",
        },
      ],
      totalSubTasks: 2,
      completedSubTasks: 1,
      progressPercent: 50,
    },
    {
      id: "school-2",
      title: "Truyền thông tuyển sinh",
      category: "TRUYEN_THONG",
      categoryLabel: "Truyền thông",
      leadAssigneeName: "Mai Đinh Thị Xuân",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-20",
      status: "IN_PROGRESS",
      subTasks: [
        {
          id: "sub-3",
          title: "Viết bài MXH",
          assigneeName: "Mai Đinh Thị Xuân",
          status: "NEW",
          dueDate: "2026-09-20",
          parentSchoolTaskId: "school-2",
          updatedAt: "2026-09-01",
        },
      ],
      totalSubTasks: 1,
      completedSubTasks: 0,
      progressPercent: 0,
    },
  ];

  test("ADMIN sees all tasks across all departments", () => {
    const admin = DEFAULT_DEMO_USERS[0];
    const filtered = filterTasksByRole(sampleTasks, admin);
    assert.equal(filtered.length, 2);
    assert.equal(canCreateSchoolTask(admin.role), true);
    assert.equal(canAssignUnitTask(admin.role), true);
  });

  test("MANAGER sees only tasks related to their department or lead", () => {
    const manager = DEFAULT_DEMO_USERS[1]; // Trưởng phòng Đào tạo & QLKH (Trần Hùng)
    const filtered = filterTasksByRole(sampleTasks, manager);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].leadAssigneeName, "Trần Hùng");
    assert.equal(canCreateSchoolTask(manager.role), false);
    assert.equal(canAssignUnitTask(manager.role), true);
  });

  test("STAFF sees only tasks they are assigned to", () => {
    const staff = DEFAULT_DEMO_USERS[2]; // Nguyễn Ngọc Vinh
    const filtered = filterTasksByRole(sampleTasks, staff);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].subTasks.length, 1);
    assert.equal(filtered[0].subTasks[0].assigneeName, "Nguyễn Ngọc Vinh");
    assert.equal(canCreateSchoolTask(staff.role), false);
    assert.equal(canAssignUnitTask(staff.role), false);
  });

  test("STAFF view recalculates task rollup for personal subtasks", () => {
    const staff = DEFAULT_DEMO_USERS[2]; // Nguyễn Ngọc Vinh
    const filtered = filterTasksByRole(sampleTasks, staff);
    assert.equal(filtered.length, 1);
    const task = filtered[0];
    // In original sampleTasks, totalSubTasks = 2, completedSubTasks = 1, progressPercent = 50
    // For Nguyễn Ngọc Vinh, only sub-2 (COMPLETED) is retained, so:
    assert.equal(task.totalSubTasks, 1);
    assert.equal(task.completedSubTasks, 1);
    assert.equal(task.progressPercent, 100);
  });

  test("DEFAULT_DEMO_USERS defines 3 authentic QCET roles verbatim", () => {
    assert.equal(DEFAULT_DEMO_USERS.length, 3);

    const [admin, manager, staff] = DEFAULT_DEMO_USERS;

    // 1. ADMIN
    assert.equal(admin.role, "ADMIN");
    assert.equal(admin.email, "bgh@cdktcnqn.edu.vn");
    assert.ok(admin.name.includes("Ban Giám hiệu") || admin.roleLabel.includes("Ban Giám hiệu"));
    assert.equal(canCreateSchoolTask(admin.role), true);
    assert.equal(canAssignUnitTask(admin.role), true);

    // 2. MANAGER
    assert.equal(manager.role, "MANAGER");
    assert.equal(manager.email, "daotao@cdktcnqn.edu.vn");
    assert.ok(manager.name.includes("Trần Hùng"));
    assert.ok(manager.roleLabel.includes("Trưởng phòng Đào tạo & QLKH"));
    assert.equal(canCreateSchoolTask(manager.role), false);
    assert.equal(canAssignUnitTask(manager.role), true);

    // 3. STAFF
    assert.equal(staff.role, "STAFF");
    assert.equal(staff.email, "vinhnn@cdktcnqn.edu.vn");
    assert.ok(staff.name.includes("Nguyễn Ngọc Vinh"));
    assert.ok(staff.roleLabel.includes("Chuyên viên CNTT"));
    assert.equal(canCreateSchoolTask(staff.role), false);
    assert.equal(canAssignUnitTask(staff.role), false);
  });
});
