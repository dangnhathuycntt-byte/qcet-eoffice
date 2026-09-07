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

import {
  calculateAssigneeWorkloads,
  groupSchoolTasksForWorkspace,
  filterGroupedTasks,
} from "../src/lib/task-ownership";
import type { StaffTask } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";

describe("Task Ownership Logic - Workload and Grouping", () => {
  const staffUser: AuthUser = {
    id: "user-huy",
    name: "Đặng Nhật Huy",
    email: "huydn@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên",
    department: "CNTT",
    departmentCode: "CNTT",
  };

  const sampleTasks: SchoolTask[] = [
    {
      id: "school-1",
      title: "Lễ Khai giảng năm học 2026 - 2027",
      category: "TRUYEN_THONG",
      categoryLabel: "Truyền thông",
      leadAssigneeName: "Trần Hùng",
      coAssignees: ["Đặng Nhật Huy", "Mai Th��� Xuân", "Lê Văn Anh"],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-07",
      status: "IN_PROGRESS",
      origin: "SCHOOL",
      totalSubTasks: 4,
      completedSubTasks: 2,
      progressPercent: 50,
      subTasks: [
        {
          id: "sub-1",
          title: "Chụp ảnh sự kiện",
          assigneeName: "Đặng Nhật Huy",
          status: "COMPLETED",
          dueDate: "2026-09-05",
          parentSchoolTaskId: "school-1",
          updatedAt: "2026-09-05",
        },
        {
          id: "sub-2",
          title: "Quay phim toàn cảnh",
          assigneeName: "Đặng Nhật Huy",
          status: "IN_PROGRESS",
          dueDate: "2026-09-05",
          parentSchoolTaskId: "school-1",
          updatedAt: "2026-09-05",
        },
        {
          id: "sub-3",
          title: "Thiết kế banner sân khấu",
          assigneeName: "Mai Thị Xuân",
          status: "COMPLETED",
          dueDate: "2026-09-04",
          parentSchoolTaskId: "school-1",
          updatedAt: "2026-09-04",
        },
        {
          id: "sub-4",
          title: "Viết bài đăng website",
          assigneeName: "Mai Thị Xuân",
          status: "IN_PROGRESS",
          dueDate: "2026-09-05",
          parentSchoolTaskId: "school-1",
          updatedAt: "2026-09-05",
        },
      ],
    },
    {
      id: "school-2",
      title: "Xây dựng Sổ tay sinh viên điện tử 2026",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "Đặng Nhật Huy",
      coAssignees: ["Trần Hùng"],
      assignedDate: "2026-09-02",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      origin: "SELF_INITIATED",
      totalSubTasks: 2,
      completedSubTasks: 0,
      progressPercent: 0,
      subTasks: [
        {
          id: "sub-5",
          title: "Soạn thảo cấu trúc thông tin",
          assigneeName: "Đặng Nhật Huy",
          status: "IN_PROGRESS",
          dueDate: "2026-09-15",
          parentSchoolTaskId: "school-2",
          updatedAt: "2026-09-02",
        },
        {
          id: "sub-6",
          title: "Duyệt nội dung sư phạm",
          assigneeName: "Trần Hùng",
          status: "IN_PROGRESS",
          dueDate: "2026-09-20",
          parentSchoolTaskId: "school-2",
          updatedAt: "2026-09-02",
        },
      ],
    },
    {
      id: "school-3",
      title: "Kiểm định chất lượng định kỳ",
      category: "BAO_CAO",
      categoryLabel: "Báo cáo",
      leadAssigneeName: "Trần Hùng",
      coAssignees: ["Đặng Nhật Huy"],
      assignedDate: "2026-09-03",
      dueDate: "2026-09-25",
      status: "IN_PROGRESS",
      origin: "SCHOOL",
      totalSubTasks: 1,
      completedSubTasks: 0,
      progressPercent: 0,
      subTasks: [
        {
          id: "sub-7",
          title: "Tổng hợp biểu mẫu phòng ban",
          assigneeName: "Trần Hùng",
          status: "IN_PROGRESS",
          dueDate: "2026-09-20",
          parentSchoolTaskId: "school-3",
          updatedAt: "2026-09-03",
        },
      ],
    },
  ];

  test("calculateAssigneeWorkloads aggregates task counts per person", () => {
    const workloads = calculateAssigneeWorkloads(sampleTasks[0].subTasks);
    assert.equal(workloads.length, 2);

    const huyWork = workloads.find((w) => w.assigneeName === "Đặng Nhật Huy");
    assert.ok(huyWork);
    assert.equal(huyWork.count, 2);
    assert.equal(huyWork.completedCount, 1);

    const maiWork = workloads.find((w) => w.assigneeName === "Mai Thị Xuân");
    assert.ok(maiWork);
    assert.equal(maiWork.count, 2);
    assert.equal(maiWork.completedCount, 1);
  });

  test("groupSchoolTasksForWorkspace correctly groups tasks for staff member", () => {
    const groups = groupSchoolTasksForWorkspace(sampleTasks, staffUser);
    assert.equal(groups.length, 3);

    // Task 1: Huy is participating, has 2 subtasks
    const g1 = groups.find((g) => g.parentTask.id === "school-1");
    assert.ok(g1);
    assert.equal(g1.isLeading, false);
    assert.equal(g1.isParticipating, true);
    assert.equal(g1.isAwaitingAssignment, false);
    assert.equal(g1.userSubTasks.length, 2);
    assert.equal(g1.allSubTasks.length, 4);

    // Task 2: Huy is DRI (leading)
    const g2 = groups.find((g) => g.parentTask.id === "school-2");
    assert.ok(g2);
    assert.equal(g2.isLeading, true);
    assert.equal(g2.isParticipating, false);
    assert.equal(g2.isAwaitingAssignment, false);
    assert.equal(g2.userSubTasks.length, 1);
    assert.equal(g2.allSubTasks.length, 2);
    assert.equal(g2.workloads.length, 2);

    // Task 3: Huy is co-assignee with NO subtasks (Awaiting Assignment)
    const g3 = groups.find((g) => g.parentTask.id === "school-3");
    assert.ok(g3);
    assert.equal(g3.isLeading, false);
    assert.equal(g3.isParticipating, true);
    assert.equal(g3.isAwaitingAssignment, true);
    assert.equal(g3.userSubTasks.length, 0);
  });

  test("filters grouped tasks by LEADING vs PARTICIPATING", () => {
    const allGroups = groupSchoolTasksForWorkspace(sampleTasks, staffUser);

    const leadingOnly = filterGroupedTasks(allGroups, { ownershipFilter: "LEADING" });
    assert.equal(leadingOnly.length, 1);
    assert.equal(leadingOnly[0].parentTask.id, "school-2");

    const participatingOnly = filterGroupedTasks(allGroups, { ownershipFilter: "PARTICIPATING" });
    assert.equal(participatingOnly.length, 2);
    const partIds = participatingOnly.map((g) => g.parentTask.id);
    assert.ok(partIds.includes("school-1"));
    assert.ok(partIds.includes("school-3"));
  });
});
