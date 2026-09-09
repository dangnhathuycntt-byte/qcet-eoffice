// @ts-nocheck
import test from "node:test";
import assert from "node:assert/strict";
import {
  extractExecutiveActionItems,
  computeExecutiveActionStats,
  computeDepartmentHealthMatrix,
} from "../src/lib/executive-matrix-aggregator";
import type { SchoolTask } from "../src/types/dashboard";

test("extractExecutiveActionItems extracts real tasks and prioritizes pending approvals", () => {
  const ref = "2026-09-09";
  const tasks: SchoolTask[] = [
    {
      id: "t1",
      title: "Phê duyệt kế hoạch kiểm định",
      category: "CNTT",
      categoryLabel: "CNTT",
      status: "WAITING_APPROVAL",
      dueDate: "2026-09-18",
      assignedDate: "2026-09-01",
      leadDepartment: "Khoa CNTT",
      leadDepartmentCode: "CNTT",
      leadAssigneeName: "TS. Nguyễn Ngọc Vinh",
      coAssignees: [],
      progressPercent: 100,
      totalSubTasks: 0,
      completedSubTasks: 0,
      subTasks: [],
    },
    {
      id: "t2",
      title: "Báo cáo chậm tiến độ",
      category: "BAO_CAO",
      categoryLabel: "Báo cáo",
      status: "IN_PROGRESS",
      dueDate: "2026-09-01",
      assignedDate: "2026-08-15",
      leadDepartment: "Phòng QTTB",
      leadDepartmentCode: "HANH_CHINH",
      leadAssigneeName: "ThS. Phan Văn Thanh",
      coAssignees: [],
      progressPercent: 30,
      totalSubTasks: 0,
      completedSubTasks: 0,
      subTasks: [],
    },
  ];

  const items = extractExecutiveActionItems(tasks, ref);
  assert.equal(items.length, 2);
  assert.equal(items[0].filterType, "PENDING_APPROVAL");
  assert.equal(items[0].actionLabel, "Phê duyệt ngay");
  assert.equal(items[1].filterType, "BLOCKED_OVERDUE");
  assert.equal(items[1].actionLabel, "Đôn đốc");

  const stats = computeExecutiveActionStats(tasks, ref);
  assert.equal(stats.pendingSchoolApprovalCount, 1);
  assert.equal(stats.overdueTasksCount, 1);
});

test("extractExecutiveActionItems handles BLOCKED, STRATEGIC, CANCELLED, and subtasks needing review", () => {
  const ref = "2026-09-09";
  const tasks: SchoolTask[] = [
    {
      id: "t-cancelled",
      title: "Nhiệm vụ bị huỷ",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      status: "CANCELLED",
      dueDate: "2026-09-01",
      assignedDate: "2026-08-15",
      leadDepartment: "Khoa CNTT",
      leadAssigneeName: "TS. Nguyễn Ngọc Vinh",
      coAssignees: [],
      progressPercent: 0,
      totalSubTasks: 0,
      completedSubTasks: 0,
      subTasks: [],
    },
    {
      id: "t-sub-review",
      title: "Nhiệm vụ có công việc con cần duyệt",
      category: "CNTT",
      categoryLabel: "CNTT",
      status: "IN_PROGRESS",
      dueDate: "2026-09-20",
      assignedDate: "2026-09-01",
      leadDepartment: "Khoa CNTT",
      leadDepartmentCode: "CNTT",
      leadAssigneeName: "TS. Nguyễn Ngọc Vinh",
      coAssignees: [],
      progressPercent: 40,
      totalSubTasks: 1,
      completedSubTasks: 0,
      subTasks: [
        {
          id: "st-review",
          title: "Báo cáo phân tích hệ thống",
          assigneeName: "Trần Hùng",
          status: "NEEDS_REVIEW",
          dueDate: "2026-09-15",
          parentSchoolTaskId: "t-sub-review",
          updatedAt: "2026-09-08T00:00:00Z",
        },
      ],
    },
    {
      id: "t-blocked",
      title: "Nhiệm vụ bị tắc nghẽn",
      category: "THU_VIEN",
      categoryLabel: "Thư viện",
      status: "BLOCKED",
      dueDate: "2026-09-25",
      assignedDate: "2026-09-01",
      leadDepartment: "Thư viện & Học liệu",
      leadDepartmentCode: "THU_VIEN",
      leadAssigneeName: "ThS. Chu Đình Thắng",
      coAssignees: [],
      progressPercent: 20,
      totalSubTasks: 0,
      completedSubTasks: 0,
      subTasks: [],
    },
    {
      id: "t-strategic",
      title: "Nhiệm vụ trọng tâm đang triển khai",
      category: "TRUYEN_THONG",
      categoryLabel: "Truyền thông",
      status: "IN_PROGRESS",
      dueDate: "2026-09-30",
      assignedDate: "2026-09-01",
      leadDepartment: "TT Truyền thông",
      leadDepartmentCode: "TRUYEN_THONG",
      leadAssigneeName: "ThS. Mai Đinh Thị Xuân",
      coAssignees: [],
      progressPercent: 60,
      totalSubTasks: 0,
      completedSubTasks: 0,
      subTasks: [],
    },
  ];

  const items = extractExecutiveActionItems(tasks, ref);
  // t-cancelled should be skipped
  assert.equal(items.length, 3);

  // Sorting order: PENDING_APPROVAL -> BLOCKED_OVERDUE -> STRATEGIC
  assert.equal(items[0].id, "act-wait-t-sub-review");
  assert.equal(items[0].filterType, "PENDING_APPROVAL");
  assert.equal(items[0].actionLabel, "Phê duyệt ngay");
  assert.equal(items[0].department, "Khoa CNTT");
  assert.equal(items[0].departmentCode, "CNTT");

  assert.equal(items[1].id, "act-overdue-t-blocked");
  assert.equal(items[1].filterType, "BLOCKED_OVERDUE");
  assert.equal(items[1].actionLabel, "Đôn đốc");

  assert.equal(items[2].id, "act-strat-t-strategic");
  assert.equal(items[2].filterType, "STRATEGIC");
  assert.equal(items[2].actionLabel, "Theo dõi");
});

test("computeDepartmentHealthMatrix computes completionRate independently from averageProgressPercent", () => {
  const ref = "2026-09-09";
  const tasks: SchoolTask[] = [
    {
      id: "t-cntt-1",
      title: "Dự án phần mềm 1",
      category: "CNTT",
      categoryLabel: "CNTT",
      status: "COMPLETED",
      dueDate: "2026-09-05",
      assignedDate: "2026-08-15",
      leadDepartmentCode: "CNTT",
      leadAssigneeName: "TS. Nguyễn Ngọc Vinh",
      coAssignees: [],
      progressPercent: 100,
      totalSubTasks: 0,
      completedSubTasks: 0,
      subTasks: [],
    },
    {
      id: "t-cntt-2",
      title: "Dự án phần mềm 2",
      category: "CNTT",
      categoryLabel: "CNTT",
      status: "IN_PROGRESS",
      dueDate: "2026-09-20",
      assignedDate: "2026-09-01",
      leadDepartmentCode: "CNTT",
      leadAssigneeName: "TS. Nguyễn Ngọc Vinh",
      coAssignees: [],
      progressPercent: 40,
      totalSubTasks: 1,
      completedSubTasks: 0,
      subTasks: [
        {
          id: "st-cntt-sub",
          title: "Thiết kế CSDL",
          assigneeName: "Nguyễn Ngọc Vinh",
          departmentCode: "CNTT",
          status: "IN_PROGRESS",
          dueDate: "2026-09-15",
          parentSchoolTaskId: "t-cntt-2",
          updatedAt: "2026-09-07T00:00:00Z",
          progressPercent: 60,
        },
      ],
    },
  ];

  const matrix = computeDepartmentHealthMatrix(tasks, ref);
  const cntt = matrix.find((d) => d.departmentId === "CNTT");
  assert.ok(cntt);
  // Total items = 2 parent tasks + 1 subtask = 3
  assert.equal(cntt.totalTasksCount, 3);
  // Completed = 1 parent task (t-cntt-1)
  assert.equal(cntt.completedTasksCount, 1);
  // Completion rate = 1 / 3 = 33%
  assert.equal(cntt.completionRate, 33);
  // Total progress = 100 (t1) + 40 (t2) + 60 (st) = 200 / 3 = 67%
  assert.equal(cntt.averageProgressPercent, 67);
});
