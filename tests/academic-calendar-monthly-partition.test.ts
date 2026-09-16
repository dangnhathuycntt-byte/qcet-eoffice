import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  filterTasksByAcademicMonthStrict,
  computePriorOverdueBacklog,
  computeMonthPartitionBucket,
  getAcademicMonthPeriod,
} from "../src/lib/academic-calendar";
import type { SchoolTask } from "../src/types/dashboard";

describe("Academic Calendar Monthly Partitioning & Backlog Engine", () => {
  const sampleTasks: SchoolTask[] = [
    {
      id: "task-sept-1",
      code: "NV-01",
      title: "Khai giảng năm học mới",
      description: "Tổ chức lễ khai giảng",
      category: "CHUYEN_MON",
      priority: "URGENT",
      status: "IN_PROGRESS",
      progressPercent: 70,
      dueDate: "2026-09-05T00:00:00.000Z",
      startDate: "2026-08-26T00:00:00.000Z",
      departmentId: "P_DTQLKH",
      departmentName: "Phòng Đào tạo",
      subTasks: [
        {
          id: "sub-1",
          taskId: "task-sept-1",
          title: "In ấn tài liệu",
          status: "COMPLETED",
          dueDate: "2026-09-02T00:00:00.000Z",
          assignedToDepartmentId: "P_DTQLKH",
          assignedToDepartmentName: "Phòng Đào tạo",
          createdAt: "2026-08-26T00:00:00.000Z",
          updatedAt: "2026-09-02T00:00:00.000Z",
        },
        {
          id: "sub-oct",
          taskId: "task-sept-1",
          title: "Báo cáo sơ kết tháng 10",
          status: "IN_PROGRESS",
          dueDate: "2026-10-05T00:00:00.000Z",
          assignedToDepartmentId: "P_DTQLKH",
          assignedToDepartmentName: "Phòng Đào tạo",
          createdAt: "2026-08-26T00:00:00.000Z",
          updatedAt: "2026-09-02T00:00:00.000Z",
        },
      ],
      deliverables: [],
      assignees: [],
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    },
    {
      id: "task-aug-overdue",
      code: "NV-02",
      title: "Tổng kết tuyển sinh đợt 1",
      description: "Nhiệm vụ trễ hạn từ tháng 8",
      category: "HANH_CHINH",
      priority: "HIGH",
      status: "IN_PROGRESS",
      progressPercent: 40,
      dueDate: "2026-08-20T00:00:00.000Z",
      startDate: "2026-08-01T00:00:00.000Z",
      departmentId: "P_DTQLKH",
      departmentName: "Phòng Đào tạo",
      subTasks: [],
      deliverables: [],
      assignees: [],
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
    },
    {
      id: "task-aug-completed",
      code: "NV-02B",
      title: "Chuẩn bị phòng thi đợt 1",
      description: "Nhiệm vụ đã hoàn thành từ tháng 8",
      category: "HANH_CHINH",
      priority: "HIGH",
      status: "COMPLETED",
      progressPercent: 100,
      dueDate: "2026-08-15T00:00:00.000Z",
      startDate: "2026-08-01T00:00:00.000Z",
      departmentId: "P_DTQLKH",
      departmentName: "Phòng Đào tạo",
      subTasks: [],
      deliverables: [],
      assignees: [],
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-15T00:00:00.000Z",
    },
    {
      id: "task-oct-1",
      code: "NV-03",
      title: "Hội nghị NCKH sinh viên",
      description: "Hội nghị tháng 10",
      category: "CHUYEN_MON",
      priority: "NORMAL",
      status: "TODO",
      progressPercent: 0,
      dueDate: "2026-10-15T00:00:00.000Z",
      startDate: "2026-09-28T00:00:00.000Z",
      departmentId: "K_CNTT",
      departmentName: "Khoa CNTT",
      subTasks: [],
      deliverables: [],
      assignees: [],
      createdAt: "2026-09-20T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z",
    },
  ] as unknown as SchoolTask[];

  test("filterTasksByAcademicMonthStrict returns only tasks due or active in Month 9", () => {
    const septTasks = filterTasksByAcademicMonthStrict(sampleTasks, 9, "2026-2027");
    assert.equal(septTasks.length, 1);
    assert.equal(septTasks[0].id, "task-sept-1");
  });

  test("filterTasksByAcademicMonthStrict prunes subtasks not belonging to Month 9", () => {
    const septTasks = filterTasksByAcademicMonthStrict(sampleTasks, 9, "2026-2027");
    assert.equal(septTasks[0].subTasks?.length, 1);
    assert.equal(septTasks[0].subTasks?.[0].id, "sub-1");
    assert.equal(septTasks[0].totalSubTasks, 1);
    assert.equal(septTasks[0].completedSubTasks, 1);
  });

  test("filterTasksByAcademicMonthStrict returns all tasks when month is ALL", () => {
    const allTasks = filterTasksByAcademicMonthStrict(sampleTasks, "ALL", "2026-2027");
    assert.equal(allTasks.length, 4);
  });

  test("computePriorOverdueBacklog identifies unfinished tasks due before Month 9 window", () => {
    const backlog = computePriorOverdueBacklog(sampleTasks, 9, "2026-2027", "2026-09-04");
    assert.equal(backlog.length, 1);
    assert.equal(backlog[0].id, "task-aug-overdue");
  });

  test("computePriorOverdueBacklog ignores completed prior tasks", () => {
    const backlog = computePriorOverdueBacklog(sampleTasks, 9, "2026-2027", "2026-09-04");
    assert.ok(!backlog.some((t) => t.id === "task-aug-completed"));
  });

  test("computeMonthPartitionBucket produces structured bucket for Month 9", () => {
    const bucket = computeMonthPartitionBucket(sampleTasks, 9, "2026-2027", "2026-09-04");
    assert.equal(bucket.monthNumber, 9);
    assert.equal(bucket.academicYear, "2026-2027");
    assert.equal(bucket.tasks.length, 1);
    assert.equal(bucket.priorOverdueBacklog.length, 1);
    assert.equal(bucket.stats.totalTasks, 1);
    assert.equal(bucket.stats.completedTasks, 0);
    assert.equal(bucket.stats.inProgressTasks, 1);
    assert.equal(bucket.stats.overdueTasks, 0);
    assert.equal(bucket.stats.completionRate, 0);
  });

  test("getAcademicMonthPeriod returns accurate cycle dates for Month 9 and Month 1", () => {
    const m9 = getAcademicMonthPeriod(9, "2026-2027");
    assert.equal(m9.startDate, "2026-09-01");
    assert.equal(m9.endDate, "2026-09-30");

    const m1 = getAcademicMonthPeriod(1, "2026-2027");
    assert.equal(m1.startDate, "2027-01-01");
    assert.equal(m1.endDate, "2027-01-31");
  });
});
