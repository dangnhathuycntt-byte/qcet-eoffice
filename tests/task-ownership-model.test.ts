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

import { getMockDashboardPayload } from "../src/lib/mock-dashboard-data";

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

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LecturerFocusWorkspace } from "../src/components/portal/lecturer-focus-workspace";

describe("LecturerFocusWorkspace - 2-Tier Rendering and Workload Badges", () => {
  const mockUser: AuthUser = {
    id: "user-huy",
    name: "Đặng Nhật Huy",
    email: "huydn@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên CNTT",
    department: "Khoa CNTT",
    departmentCode: "CNTT",
  };

  const tasks: SchoolTask[] = [
    {
      id: "school-100",
      title: "Lễ Khai giảng năm học 2026 - 2027",
      category: "TRUYEN_THONG",
      categoryLabel: "Truyền thông",
      leadAssigneeName: "Trần Hùng",
      coAssignees: ["Đặng Nhật Huy"],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-07",
      status: "IN_PROGRESS",
      origin: "SCHOOL",
      totalSubTasks: 2,
      completedSubTasks: 1,
      progressPercent: 50,
      subTasks: [
        {
          id: "sub-101",
          title: "Chụp ảnh sự kiện",
          assigneeName: "Đặng Nhật Huy",
          status: "COMPLETED",
          dueDate: "2026-09-05",
          parentSchoolTaskId: "school-100",
          updatedAt: "2026-09-05",
        },
        {
          id: "sub-102",
          title: "Quay phim bế mạc",
          assigneeName: "Đặng Nhật Huy",
          status: "IN_PROGRESS",
          dueDate: "2026-09-05",
          parentSchoolTaskId: "school-100",
          updatedAt: "2026-09-05",
        },
      ],
    },
    {
      id: "school-200",
      title: "Sổ tay sinh viên điện tử",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "Đặng Nhật Huy",
      coAssignees: ["Mai Thị Xuân"],
      assignedDate: "2026-09-02",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      origin: "SELF_INITIATED",
      totalSubTasks: 2,
      completedSubTasks: 0,
      progressPercent: 0,
      subTasks: [
        {
          id: "sub-201",
          title: "Soạn cấu trúc tài liệu",
          assigneeName: "Đặng Nhật Huy",
          status: "IN_PROGRESS",
          dueDate: "2026-09-15",
          parentSchoolTaskId: "school-200",
          updatedAt: "2026-09-02",
        },
        {
          id: "sub-202",
          title: "Biên tập mỹ thuật",
          assigneeName: "Mai Thị Xuân",
          status: "IN_PROGRESS",
          dueDate: "2026-09-20",
          parentSchoolTaskId: "school-200",
          updatedAt: "2026-09-02",
        },
      ],
    },
  ];

  test("renders 2-tier parent header and subtasks under single container", () => {
    const html = renderToStaticMarkup(
      React.createElement(LecturerFocusWorkspace, {
        user: mockUser,
        tasks: tasks,
        referenceDate: "2026-09-06",
      })
    );

    // Verifies Parent Task Title is present
    assert.ok(html.includes("Lễ Khai giảng năm học 2026 - 2027"));
    assert.ok(html.includes("Sổ tay sinh viên điện tử"));

    // Verifies Sub-tasks are rendered
    assert.ok(html.includes("Chụp ảnh sự kiện"));
    assert.ok(html.includes("Quay phim bế mạc"));

    // Verifies Segmented Ownership filters
    assert.ok(html.includes("Tôi chủ trì") || html.includes("Chủ trì"));
    assert.ok(html.includes("Tôi tham gia") || html.includes("Tham gia"));

    // Verifies origin badge
    assert.ok(html.includes("Tự khởi xướng") || html.includes("Cá nhân đề xuất"));
  });
});



