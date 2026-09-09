import { test, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  flattenPersonalTasks,
} from "../src/components/tasks/cascading-task-table";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";

describe("Task 4: Subtask Flattening & Breadcrumb in Personal Workbox", () => {
  const mockTasks: SchoolTask[] = [
    {
      id: "task-school-01",
      taskCode: "NV-2026-09-001",
      title: "Triển khai E-Office toàn trường",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "ThS. Lê Văn Thí",
      leadAssigneeId: "user-manager-qldt",
      coAssignees: ["Trần Hùng"],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      progressPercent: 50,
      totalSubTasks: 2,
      completedSubTasks: 1,
      subTasks: [
        {
          id: "sub-01-a",
          code: "NV-2026-09-001.01",
          title: "Xây dựng tài liệu hướng dẫn sử dụng E-Office",
          assigneeName: "KS. Nguyễn Ngọc Vinh",
          assigneeId: "user-staff-vinh",
          status: "IN_PROGRESS",
          dueDate: "2026-09-15",
          parentSchoolTaskId: "task-school-01",
          updatedAt: "2026-09-02",
        },
        {
          id: "sub-01-b",
          code: "NV-2026-09-001.02",
          title: "Cấu hình hạ tầng máy chủ",
          assigneeName: "Trần Hùng",
          assigneeId: "user-staff-hung",
          status: "COMPLETED",
          dueDate: "2026-09-10",
          parentSchoolTaskId: "task-school-01",
          updatedAt: "2026-09-05",
        },
      ],
    },
    {
      id: "task-school-02",
      taskCode: "NV-2026-09-002",
      title: "Nâng cấp cổng thông tin đào tạo",
      category: "CNTT",
      categoryLabel: "CNTT",
      leadAssigneeName: "KS. Nguyễn Ngọc Vinh",
      leadAssigneeId: "user-staff-vinh",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-25",
      status: "IN_PROGRESS",
      progressPercent: 25,
      totalSubTasks: 2,
      completedSubTasks: 0,
      subTasks: [
        {
          id: "sub-02-a",
          code: "NV-2026-09-002.01",
          title: "Thiết kế giao diện responsive",
          assigneeName: "Trần Hùng",
          assigneeId: "user-staff-hung",
          status: "IN_PROGRESS",
          dueDate: "2026-09-18",
          parentSchoolTaskId: "task-school-02",
          updatedAt: "2026-09-03",
        },
        {
          id: "sub-02-b",
          code: "NV-2026-09-002.02",
          title: "Tối ưu hóa cơ sở dữ liệu PostgreSQL",
          assigneeName: "KS. Nguyễn Ngọc Vinh",
          assigneeId: "user-staff-vinh",
          status: "IN_PROGRESS",
          dueDate: "2026-09-22",
          parentSchoolTaskId: "task-school-02",
          updatedAt: "2026-09-04",
        },
      ],
    },
    {
      id: "task-school-03",
      taskCode: "NV-2026-09-003",
      title: "Kiểm định chất lượng giáo dục",
      category: "BAO_CAO",
      categoryLabel: "Báo cáo",
      leadAssigneeName: "ThS. Phạm Văn Tường",
      leadAssigneeId: "user-admin-bgh",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-28",
      status: "IN_PROGRESS",
      progressPercent: 0,
      totalSubTasks: 1,
      completedSubTasks: 0,
      subTasks: [
        {
          id: "sub-03-a",
          code: "NV-2026-09-003.01",
          title: "Tổng hợp minh chứng tiêu chuẩn 4",
          assigneeName: "Đỗ Thị Mai",
          assigneeId: "user-staff-mai",
          collaborators: [
            {
              id: "user-staff-vinh",
              name: "KS. Nguyễn Ngọc Vinh",
              role: "COLLABORATOR",
            },
          ],
          status: "IN_PROGRESS",
          dueDate: "2026-09-20",
          parentSchoolTaskId: "task-school-03",
          updatedAt: "2026-09-03",
        },
      ],
    },
  ];

  it("extracts assigned subtask as a first-class row in personal view when user is not lead of parent", () => {
    const personalTasks = flattenPersonalTasks(
      mockTasks,
      "KS. Nguyễn Ngọc Vinh",
      "user-staff-vinh"
    );

    // sub-01-a is under task-school-01 (lead is ThS. Lê Văn Thí).
    // The parent task-school-01 should NOT be included as an unassigned block for Vinh.
    const parent01 = personalTasks.find((t: any) => t.id === "task-school-01");
    assert.equal(parent01, undefined, "Parent task-school-01 must not appear since Vinh is not the lead assignee");

    // sub-01-a must be extracted as a first-class row
    const sub01a = personalTasks.find((t: any) => t.id === "sub-01-a") as any;
    assert.ok(sub01a, "sub-01-a must be extracted as a first-class row");
    assert.equal(sub01a.parentSchoolTaskId, "task-school-01");
    assert.equal(sub01a.parentSchoolTaskTitle, "Triển khai E-Office toàn trường");
    assert.equal(sub01a.parentSchoolTaskCode, "NV-2026-09-001");
  });

  it("extracts subtask where user is collaborator as a first-class row with breadcrumb", () => {
    const personalTasks = flattenPersonalTasks(
      mockTasks,
      "KS. Nguyễn Ngọc Vinh",
      "user-staff-vinh"
    );

    // sub-03-a has Vinh as collaborator
    const sub03a = personalTasks.find((t: any) => t.id === "sub-03-a") as any;
    assert.ok(sub03a, "sub-03-a (where user is collaborator) must be included");
    assert.equal(sub03a.parentSchoolTaskId, "task-school-03");
    assert.equal(sub03a.parentSchoolTaskTitle, "Kiểm định chất lượng giáo dục");
    assert.equal(sub03a.parentSchoolTaskCode, "NV-2026-09-003");
  });

  it("includes parent task with proper subtask counts when user is the lead assignee of parent", () => {
    const personalTasks = flattenPersonalTasks(
      mockTasks,
      "KS. Nguyễn Ngọc Vinh",
      "user-staff-vinh"
    );

    // task-school-02 has Vinh as leadAssigneeName
    const parent02 = personalTasks.find((t: any) => t.id === "task-school-02") as any;
    assert.ok(parent02, "Parent task-school-02 must be included since Vinh is the lead assignee");
    assert.equal(parent02.title, "Nâng cấp cổng thông tin đào tạo");
    // Verify subtask count
    assert.equal((parent02 as any).totalSubTasks ?? parent02.subItems?.length, 2);

    // Subtask sub-02-b which is assigned to Vinh is also available
    const sub02b = personalTasks.find((t: any) => t.id === "sub-02-b") as any;
    assert.ok(sub02b, "sub-02-b assigned to Vinh should be present");
    assert.equal(sub02b.parentSchoolTaskId, "task-school-02");
  });

  it("does not include unrelated tasks or subtasks assigned exclusively to others", () => {
    const personalTasks = flattenPersonalTasks(
      mockTasks,
      "KS. Nguyễn Ngọc Vinh",
      "user-staff-vinh"
    );

    // sub-01-b is assigned to Trần Hùng only
    const sub01b = personalTasks.find((t: any) => t.id === "sub-01-b");
    assert.equal(sub01b, undefined, "sub-01-b (assigned only to Hung) must not be in Vinh's personal tasks");

    // task-school-03 is led by ThS. Phạm Văn Tường
    const parent03 = personalTasks.find((t: any) => t.id === "task-school-03");
    assert.equal(parent03, undefined, "task-school-03 led by Tuong must not be in Vinh's personal tasks");
  });

  it("cascading-task-table.tsx renders breadcrumb with parent code and title when activeWorkbox is MY_RECEIVED", () => {
    const filePath = path.resolve(__dirname, "../src/components/tasks/cascading-task-table.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Check for flattening integration
    assert.ok(
      content.includes("flattenPersonalTasks"),
      "cascading-task-table.tsx must import or define flattenPersonalTasks"
    );

    // Check for Breadcrumb display: parent task code and title
    assert.ok(
      content.includes("parentSchoolTaskTitle") || content.includes("parentSchoolTaskCode"),
      "cascading-task-table.tsx must render parent task breadcrumb"
    );

    // Check for CornerDownRight icon or tree indicator
    assert.ok(
      content.includes("CornerDownRight"),
      "cascading-task-table.tsx must use CornerDownRight icon for breadcrumb"
    );

    // Check for badge 'Việc thành phần'
    assert.ok(
      content.includes("Việc thành phần"),
      "cascading-task-table.tsx must display 'Việc thành phần' badge on flattened subtasks"
    );
  });

  it("universal-action-queue.tsx renders parent task breadcrumb chip", () => {
    const filePath = path.resolve(__dirname, "../src/components/workspace/components/universal-action-queue.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Must render parent breadcrumb
    assert.ok(
      content.includes("parentTaskTitle") || content.includes("parentSchoolTaskTitle"),
      "universal-action-queue.tsx must check for parentTaskTitle or parentSchoolTaskTitle"
    );
    assert.ok(
      content.includes("CornerDownRight") || content.includes("parentTaskCode") || content.includes("breadcrumb"),
      "universal-action-queue.tsx must display parent task breadcrumb info"
    );
  });
});
