import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { filterTasksByAcademicMonthStrict } from "../src/lib/academic-calendar";
import type { SchoolTask } from "../src/types/dashboard";

describe("filterTasksByAcademicMonthStrict refinement", () => {
  test("filterTasksByAcademicMonthStrict prioritizes academicMonth property", () => {
    const tasks: SchoolTask[] = [
      {
        id: "1",
        title: "Month 9 Task",
        category: "KHAC",
        categoryLabel: "Khác",
        status: "IN_PROGRESS",
        dueDate: "2026-09-20",
        academicMonth: 9,
        progressPercent: 50,
        totalSubTasks: 0,
        completedSubTasks: 0,
        leadAssigneeName: "Nguyễn Văn A",
        coAssignees: [],
        assignedDate: "2026-09-01",
        subTasks: [],
      },
      {
        id: "2",
        title: "Month 12 Task with early seed date",
        category: "KHAC",
        categoryLabel: "Khác",
        status: "IN_PROGRESS",
        dueDate: "2026-12-20",
        academicMonth: 12,
        startDate: "2026-09-07",
        progressPercent: 20,
        totalSubTasks: 0,
        completedSubTasks: 0,
        leadAssigneeName: "Trần Văn B",
        coAssignees: [],
        assignedDate: "2026-09-07",
        subTasks: [],
      },
    ];

    const month9 = filterTasksByAcademicMonthStrict(tasks, 9, "2026-2027");
    assert.equal(month9.length, 1);
    assert.equal(month9[0].id, "1");

    const month12 = filterTasksByAcademicMonthStrict(tasks, 12, "2026-2027");
    assert.equal(month12.length, 1);
    assert.equal(month12[0].id, "2");
  });

  test("does not leak Month 12 task into Month 9 when academicMonth is undefined", () => {
    const tasks: SchoolTask[] = [
      {
        id: "task-month-12-seed",
        title: "Nhiệm vụ dài hạn đến Tháng 12",
        category: "KHAC",
        categoryLabel: "Khác",
        status: "IN_PROGRESS",
        dueDate: "2026-12-20T00:00:00.000Z",
        startDate: "2026-09-07T00:00:00.000Z",
        progressPercent: 10,
        totalSubTasks: 0,
        completedSubTasks: 0,
        leadAssigneeName: "Giảng viên A",
        coAssignees: [],
        assignedDate: "2026-09-07",
        subTasks: [],
      },
    ];

    const month9 = filterTasksByAcademicMonthStrict(tasks, 9, "2026-2027");
    assert.equal(month9.length, 0, "Task due in Month 12 must not leak into Month 9 even if startDate was in September");

    const month12 = filterTasksByAcademicMonthStrict(tasks, 12, "2026-2027");
    assert.equal(month12.length, 1, "Task due in Month 12 must appear in Month 12");
    assert.equal(month12[0].id, "task-month-12-seed");
  });

  test("prunes subtasks when academicMonth is explicitly defined", () => {
    const tasks: SchoolTask[] = [
      {
        id: "task-with-subtasks",
        title: "Nhiệm vụ Tháng 9 có subtask vắt qua Tháng 10",
        category: "KHAC",
        categoryLabel: "Khác",
        status: "IN_PROGRESS",
        dueDate: "2026-09-20T00:00:00.000Z",
        academicMonth: 9,
        progressPercent: 50,
        totalSubTasks: 2,
        completedSubTasks: 1,
        leadAssigneeName: "Trưởng phòng",
        coAssignees: [],
        assignedDate: "2026-09-01",
        subTasks: [
          {
            id: "sub-1-sep",
            taskId: "task-with-subtasks",
            title: "Subtask Tháng 9",
            status: "COMPLETED",
            assigneeName: "Cán bộ A",
            dueDate: "2026-09-10T00:00:00.000Z",
            assignedToDepartmentId: "P_DTQLKH",
            assignedToDepartmentName: "Phòng Đào tạo",
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
          {
            id: "sub-2-oct",
            taskId: "task-with-subtasks",
            title: "Subtask Tháng 10",
            status: "IN_PROGRESS",
            assigneeName: "Cán bộ B",
            dueDate: "2026-10-05T00:00:00.000Z",
            assignedToDepartmentId: "P_DTQLKH",
            assignedToDepartmentName: "Phòng Đào tạo",
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
        ],
      },
    ];

    const month9 = filterTasksByAcademicMonthStrict(tasks, 9, "2026-2027");
    assert.equal(month9.length, 1);
    assert.equal(month9[0].subTasks?.length, 1);
    assert.equal(month9[0].subTasks?.[0].id, "sub-1-sep");
    assert.equal(month9[0].totalSubTasks, 1);
    assert.equal(month9[0].completedSubTasks, 1);
  });

  test("returns all tasks when month is ALL", () => {
    const tasks: SchoolTask[] = [
      {
        id: "1",
        title: "Month 9 Task",
        category: "KHAC",
        categoryLabel: "Khác",
        status: "IN_PROGRESS",
        dueDate: "2026-09-20",
        academicMonth: 9,
        progressPercent: 50,
        totalSubTasks: 0,
        completedSubTasks: 0,
        leadAssigneeName: "Nguyễn Văn A",
        coAssignees: [],
        assignedDate: "2026-09-01",
        subTasks: [],
      },
      {
        id: "2",
        title: "Month 12 Task",
        category: "KHAC",
        categoryLabel: "Khác",
        status: "IN_PROGRESS",
        dueDate: "2026-12-20",
        academicMonth: 12,
        progressPercent: 20,
        totalSubTasks: 0,
        completedSubTasks: 0,
        leadAssigneeName: "Trần Văn B",
        coAssignees: [],
        assignedDate: "2026-09-07",
        subTasks: [],
      },
    ];

    const all = filterTasksByAcademicMonthStrict(tasks, "ALL", "2026-2027");
    assert.equal(all.length, 2);
  });
});
