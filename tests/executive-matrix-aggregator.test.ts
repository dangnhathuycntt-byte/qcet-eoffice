import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";
import {
  computeExecutiveActionStats,
  computeDepartmentHealthMatrix,
  resolveDepartmentId,
  extractExecutiveActionItems,
  filterTasksByExecutive,
  QCET_DEPARTMENT_DEFINITIONS,
} from "../src/lib/executive-matrix-aggregator";
import {
  filterTasksByAcademicMonth,
  computeMonthlyTaskCounts,
  filterTasksHub,
} from "../src/lib/unified-task-hub";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";

describe("Executive Matrix Aggregator", () => {
  const REF_DATE = "2026-09-04";

  test("Department definitions contain 11 canonical QCET units with valid metadata", () => {
    assert.strictEqual(QCET_DEPARTMENT_DEFINITIONS.length, 11);
    const ids = QCET_DEPARTMENT_DEFINITIONS.map((d) => d.id);
    assert.ok(ids.includes("BGH"));
    assert.ok(ids.includes("CNTT"));
    assert.ok(ids.includes("DAO_TAO"));
    assert.ok(ids.includes("TRUYEN_THONG"));
    assert.ok(ids.includes("HANH_CHINH"));
    assert.ok(ids.includes("KHAO_THI"));
    assert.ok(ids.includes("THU_VIEN"));
    assert.ok(ids.includes("KINH_TE"));
    assert.ok(ids.includes("KY_THUAT"));
    assert.ok(ids.includes("TAI_CHINH"));
    assert.ok(ids.includes("CTHSSV"));

    for (const def of QCET_DEPARTMENT_DEFINITIONS) {
      assert.ok(def.id.length > 0);
      assert.ok(def.name.length > 0);
      assert.ok(def.leadName.length > 0);
    }
  });

  test("resolveDepartmentId correctly identifies departments by code, name, person, or category", () => {
    assert.strictEqual(resolveDepartmentId("DAO_TAO"), "DAO_TAO");
    assert.strictEqual(resolveDepartmentId("P_DTQLKH"), "DAO_TAO");
    assert.strictEqual(resolveDepartmentId("dept-p-dtqlkh"), "DAO_TAO");
    assert.strictEqual(resolveDepartmentId("K_CNTT"), "CNTT");
    assert.strictEqual(resolveDepartmentId("Khoa Công nghệ thông tin"), "CNTT");

    assert.strictEqual(resolveDepartmentId(undefined, "TS. Nguyễn Ngọc Vinh"), "CNTT");
    assert.strictEqual(resolveDepartmentId(undefined, "Đỗ Quang Trung"), "DAO_TAO");
    assert.strictEqual(resolveDepartmentId(undefined, "Phan Văn Thanh"), "HANH_CHINH");

    assert.strictEqual(resolveDepartmentId(undefined, undefined, "TRUYEN_THONG"), "TRUYEN_THONG");
    assert.strictEqual(resolveDepartmentId(undefined, undefined, "THU_VIEN"), "THU_VIEN");
    assert.strictEqual(resolveDepartmentId(undefined, undefined, "ATTT"), "CNTT");
  });

  test("computeExecutiveActionStats handles empty tasks array gracefully", () => {
    const stats = computeExecutiveActionStats([]);
    assert.deepStrictEqual(stats, {
      pendingSchoolApprovalCount: 0,
      blockedTasksCount: 0,
      overdueTasksCount: 0,
      strategicActiveCount: 0,
    });
  });

  test("computeDepartmentHealthMatrix handles empty tasks array with 11 zero-filled units", () => {
    const matrix = computeDepartmentHealthMatrix([]);
    assert.strictEqual(matrix.length, 11);

    for (const dept of matrix) {
      assert.strictEqual(dept.totalTasksCount, 0);
      assert.strictEqual(dept.completedTasksCount, 0);
      assert.strictEqual(dept.inProgressTasksCount, 0);
      assert.strictEqual(dept.blockedTasksCount, 0);
      assert.strictEqual(dept.overdueTasksCount, 0);
      assert.strictEqual(dept.averageProgressPercent, 0);
    }
  });

  test("computeExecutiveActionStats accurately calculates all executive metrics", () => {
    const sampleTasks: SchoolTask[] = [
      {
        id: "task-1",
        title: "Nhiệm vụ 1: Đã xong 100% chờ BGH duyệt",
        category: "CHUYEN_DOI_SO",
        categoryLabel: "Chuyển đổi số",
        leadAssigneeName: "Nguyễn Ngọc Vinh",
        leadDepartmentCode: "CNTT",
        coAssignees: [],
        assignedDate: "2026-08-01",
        dueDate: "2026-09-10",
        status: "PENDING_EXECUTIVE_APPROVAL",
        progressPercent: 100,
        subTasks: [
          {
            id: "st-1-1",
            title: "Tác vụ con hoàn thành",
            assigneeName: "Nguyễn Ngọc Vinh",
            status: "COMPLETED",
            dueDate: "2026-08-20",
            parentSchoolTaskId: "task-1",
            updatedAt: "2026-08-20T10:00:00Z",
          },
        ],
        totalSubTasks: 1,
        completedSubTasks: 1,
      },
      {
        id: "task-2",
        title: "Nhiệm vụ 2: Đang làm, có subtask cần duyệt và quá hạn",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadAssigneeName: "Nguyễn Ngọc Vinh",
        leadDepartmentCode: "CNTT",
        coAssignees: [],
        assignedDate: "2026-08-15",
        dueDate: "2026-09-20",
        status: "IN_PROGRESS",
        progressPercent: 50,
        subTasks: [
          {
            id: "st-2-1",
            title: "Subtask cần duyệt và quá hạn",
            assigneeName: "Phan Đình Khôi",
            status: "NEEDS_REVIEW",
            dueDate: "2026-09-01",
            parentSchoolTaskId: "task-2",
            updatedAt: "2026-09-01T10:00:00Z",
          },
          {
            id: "st-2-2",
            title: "Subtask bị vướng mắc",
            assigneeName: "Trần Hùng",
            status: "BLOCKED",
            dueDate: "2026-09-15",
            parentSchoolTaskId: "task-2",
            updatedAt: "2026-09-02T10:00:00Z",
          },
        ],
        totalSubTasks: 2,
        completedSubTasks: 0,
      },
      {
        id: "task-3",
        title: "Nhiệm vụ 3: Đã hoàn thành nghiệm thu",
        category: "BAO_CAO",
        categoryLabel: "Báo cáo",
        leadAssigneeName: "Đỗ Quang Trung",
        leadDepartmentCode: "DAO_TAO",
        coAssignees: [],
        assignedDate: "2026-08-01",
        dueDate: "2026-08-30",
        status: "COMPLETED",
        progressPercent: 100,
        subTasks: [
          {
            id: "st-3-1",
            title: "Subtask đã xong",
            assigneeName: "Võ Minh Trí",
            status: "COMPLETED",
            dueDate: "2026-08-25",
            parentSchoolTaskId: "task-3",
            updatedAt: "2026-08-25T10:00:00Z",
          },
        ],
        totalSubTasks: 1,
        completedSubTasks: 1,
      },
      {
        id: "task-4",
        title: "Nhiệm vụ 4: Quá hạn cấp trường và đang thực hiện",
        category: "KHAC",
        categoryLabel: "Hành chính",
        leadAssigneeName: "Phan Văn Thanh",
        leadDepartmentCode: "HANH_CHINH",
        coAssignees: [],
        assignedDate: "2026-08-01",
        dueDate: "2026-09-01",
        status: "IN_PROGRESS",
        progressPercent: 20,
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
      },
    ];

    const stats = computeExecutiveActionStats(sampleTasks, REF_DATE);

    assert.strictEqual(stats.pendingSchoolApprovalCount, 2);
    assert.strictEqual(stats.strategicActiveCount, 2);
    assert.strictEqual(stats.blockedTasksCount, 1);
    assert.strictEqual(stats.overdueTasksCount, 2);
  });

  test("computeDepartmentHealthMatrix correctly distributes tasks across departments", () => {
    const sampleTasks: SchoolTask[] = [
      {
        id: "task-cntt-1",
        title: "Xây dựng hệ thống portal",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadAssigneeName: "Nguyễn Ngọc Vinh",
        leadDepartmentCode: "CNTT",
        coAssignees: [],
        assignedDate: "2026-08-10",
        dueDate: "2026-09-15",
        status: "IN_PROGRESS",
        progressPercent: 50,
        subTasks: [
          {
            id: "st-cntt-1",
            title: "Cài đặt máy chủ",
            assigneeName: "Nguyễn Ngọc Vinh",
            departmentCode: "CNTT",
            status: "COMPLETED",
            dueDate: "2026-08-20",
            parentSchoolTaskId: "task-cntt-1",
            updatedAt: "2026-08-20T10:00:00Z",
          },
          {
            id: "st-hcqt-1",
            title: "Phối hợp chuẩn bị phòng máy",
            assigneeName: "Lê Hoàng Nam",
            departmentCode: "HANH_CHINH",
            status: "BLOCKED",
            dueDate: "2026-09-01",
            parentSchoolTaskId: "task-cntt-1",
            updatedAt: "2026-09-01T10:00:00Z",
          },
        ],
        totalSubTasks: 2,
        completedSubTasks: 1,
      },
      {
        id: "task-daotao-1",
        title: "Tổng kết công tác đào tạo",
        category: "BAO_CAO",
        categoryLabel: "Báo cáo",
        leadAssigneeName: "Đỗ Quang Trung",
        leadDepartmentCode: "DAO_TAO",
        coAssignees: [],
        assignedDate: "2026-08-01",
        dueDate: "2026-08-25",
        status: "COMPLETED",
        progressPercent: 100,
        subTasks: [
          {
            id: "st-daotao-1",
            title: "Báo cáo số liệu tuyển sinh",
            assigneeName: "Võ Minh Trí",
            departmentCode: "DAO_TAO",
            status: "COMPLETED",
            dueDate: "2026-08-20",
            parentSchoolTaskId: "task-daotao-1",
            updatedAt: "2026-08-20T10:00:00Z",
          },
        ],
        totalSubTasks: 1,
        completedSubTasks: 1,
      },
    ];

    const matrix = computeDepartmentHealthMatrix(sampleTasks, REF_DATE);

    const cntt = matrix.find((d) => d.departmentId === "CNTT");
    assert.ok(cntt);
    assert.strictEqual(cntt.departmentName, "Khoa Công nghệ thông tin");
    assert.strictEqual(cntt.leadName, "TS. Nguyễn Ngọc Vinh");
    assert.strictEqual(cntt.totalTasksCount, 2);
    assert.strictEqual(cntt.completedTasksCount, 1);
    assert.strictEqual(cntt.inProgressTasksCount, 1);
    assert.strictEqual(cntt.blockedTasksCount, 0);
    assert.strictEqual(cntt.overdueTasksCount, 0);
    assert.strictEqual(cntt.averageProgressPercent, 75);
    // Denominator integrity assertions (Rule 40.2 & docs/product/metrics.md Section 3.1)
    assert.strictEqual(cntt.parentTasksCount, 1);
    assert.strictEqual(cntt.completedParentTasksCount, 0);
    assert.strictEqual(cntt.subTasksCount, 1);
    assert.strictEqual(cntt.completedSubTasksCount, 1);
    assert.strictEqual(cntt.completionRate, 0); // 0 completed parent tasks out of 1 valid parent task

    const hanhChinh = matrix.find((d) => d.departmentId === "HANH_CHINH");
    assert.ok(hanhChinh);
    assert.strictEqual(hanhChinh.totalTasksCount, 1);
    assert.strictEqual(hanhChinh.blockedTasksCount, 1);
    assert.strictEqual(hanhChinh.overdueTasksCount, 1);
    assert.strictEqual(hanhChinh.completedTasksCount, 0);
    assert.strictEqual(hanhChinh.parentTasksCount, 0);
    assert.strictEqual(hanhChinh.completedParentTasksCount, 0);
    assert.strictEqual(hanhChinh.subTasksCount, 1);
    assert.strictEqual(hanhChinh.completionRate, 0);

    const daoTao = matrix.find((d) => d.departmentId === "DAO_TAO");
    assert.ok(daoTao);
    assert.strictEqual(daoTao.totalTasksCount, 2);
    assert.strictEqual(daoTao.completedTasksCount, 2);
    assert.strictEqual(daoTao.inProgressTasksCount, 0);
    assert.strictEqual(daoTao.overdueTasksCount, 0);
    assert.strictEqual(daoTao.averageProgressPercent, 100);
    assert.strictEqual(daoTao.parentTasksCount, 1);
    assert.strictEqual(daoTao.completedParentTasksCount, 1);
    assert.strictEqual(daoTao.subTasksCount, 1);
    assert.strictEqual(daoTao.completedSubTasksCount, 1);
    assert.strictEqual(daoTao.completionRate, 100);

    const bgh = matrix.find((d) => d.departmentId === "BGH");
    assert.ok(bgh);
    assert.strictEqual(bgh.totalTasksCount, 0);
    assert.strictEqual(bgh.averageProgressPercent, 0);
  });

  test("Executes successfully against authentic mock payload without errors", () => {
    const payload = getMockDashboardPayload();
    assert.ok(payload.tasks.length > 0);

    const stats = computeExecutiveActionStats(payload.tasks);
    assert.ok(typeof stats.pendingSchoolApprovalCount === "number");
    assert.ok(typeof stats.blockedTasksCount === "number");
    assert.ok(typeof stats.overdueTasksCount === "number");
    assert.ok(typeof stats.strategicActiveCount === "number");
    assert.ok(stats.strategicActiveCount > 0);

    const matrix = computeDepartmentHealthMatrix(payload.tasks);
    assert.strictEqual(matrix.length, 11);

    const totalCalculatedTasks = matrix.reduce((acc, d) => acc + d.totalTasksCount, 0);
    const expectedTotal =
      payload.tasks.length +
      payload.tasks.reduce((acc, t) => acc + t.subTasks.length, 0);
    assert.strictEqual(totalCalculatedTasks, expectedTotal);
  });
});

describe("Executive Action Items Extractor", () => {
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
    // At equal priority, an overdue row leads. t2 is overdue (due 01/09),
    // t1 is a review file not yet due, so t2 sorts first.
    assert.equal(items[0].taskId, "t2");
    assert.equal(items[0].filterType, "BLOCKED_OVERDUE");
    assert.equal(items[0].primaryReason, "OVERDUE");
    assert.equal(items[0].actionLabel, "Xem chi tiết");
    // A review file's list action is "Xem xét" (it opens the file);
    // the queue never offers a "Phê duyệt" mutation.
    assert.equal(items[1].taskId, "t1");
    assert.equal(items[1].filterType, "PENDING_APPROVAL");
    assert.equal(items[1].primaryReason, "REVIEW");
    assert.equal(items[1].actionLabel, "Xem xét");

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
    // t-cancelled is skipped, and the IN_PROGRESS -> STRATEGIC rule was removed
    // from the workbench queue, so t-strategic (healthy IN_PROGRESS) is gone.
    assert.equal(items.length, 2);

    // One row per task, ordered priority desc -> overdue -> due asc -> id.
    assert.equal(items[0].id, "act-t-sub-review");
    assert.equal(items[0].taskId, "t-sub-review");
    assert.equal(items[0].filterType, "PENDING_APPROVAL");
    assert.equal(items[0].actionLabel, "Xem xét");
    assert.equal(items[0].department, "Khoa CNTT");
    assert.equal(items[0].departmentCode, "CNTT");

    assert.equal(items[1].id, "act-t-blocked");
    assert.equal(items[1].filterType, "BLOCKED_OVERDUE");
    assert.equal(items[1].primaryReason, "BLOCKED");
    assert.equal(items[1].actionLabel, "Xem chi tiết");
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
    // Institutional completion rate = 1 completed parent task / 2 valid parent tasks = 50%
    assert.equal(cntt.completionRate, 50);
    // Total progress = 100 (t1) + 40 (t2) + 60 (st) = 200 / 3 = 67%
    assert.equal(cntt.averageProgressPercent, 67);
  });
});

describe("filterTasksByExecutive", () => {
  const REF_DATE = "2026-09-04";

  function makeSchoolTask(overrides: Partial<SchoolTask> & { id: string }): SchoolTask {
    return {
      title: `Task ${overrides.id}`,
      category: "CNTT",
      categoryLabel: "CNTT",
      leadAssigneeName: "Test Person",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-09-15",
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 50,
      ...overrides,
    };
  }

  function makeStaffTask(overrides: Partial<StaffTask> & { id: string }): StaffTask {
    return {
      title: `Sub ${overrides.id}`,
      assigneeName: "Staff Member",
      status: "IN_PROGRESS",
      dueDate: "2026-09-15",
      parentSchoolTaskId: "task-parent",
      updatedAt: "2026-09-01",
      ...overrides,
    };
  }

  const tasks: SchoolTask[] = [
    // NOT PENDING_APPROVAL: 100% progress on a healthy IN_PROGRESS task is not a
    // review request.
    makeSchoolTask({ id: "pending-1", progressPercent: 100, status: "IN_PROGRESS" }),
    // PENDING_APPROVAL: a real WAITING_APPROVAL request.
    makeSchoolTask({
      id: "review-1",
      progressPercent: 80,
      status: "WAITING_APPROVAL" as SchoolTask["status"],
    }),
    // COMPLETED task with 100% -- should NOT show as pending approval
    makeSchoolTask({ id: "completed-100", progressPercent: 100, status: "COMPLETED" }),
    // BLOCKED_OVERDUE: task-level blocked
    makeSchoolTask({
      id: "blocked-1",
      status: "BLOCKED" as SchoolTask["status"],
      progressPercent: 30,
    }),
    // BLOCKED_OVERDUE: parent overdue (dueDate in the past relative to REF_DATE)
    makeSchoolTask({
      id: "overdue-1",
      status: "IN_PROGRESS",
      dueDate: "2026-09-01",
      progressPercent: 40,
    }),
    // BLOCKED_OVERDUE: has a blocked subtask
    makeSchoolTask({
      id: "has-blocked-sub",
      status: "IN_PROGRESS",
      progressPercent: 60,
      subTasks: [
        makeStaffTask({ id: "sub-blocked", status: "BLOCKED" }),
        makeStaffTask({ id: "sub-ok", status: "IN_PROGRESS" }),
      ],
    }),
    // BLOCKED_OVERDUE: has an overdue subtask
    makeSchoolTask({
      id: "has-overdue-sub",
      status: "IN_PROGRESS",
      progressPercent: 55,
      subTasks: [
        makeStaffTask({ id: "sub-overdue", status: "IN_PROGRESS", dueDate: "2026-09-02" }),
      ],
    }),
    // STRATEGIC: status === IN_PROGRESS (normal healthy task)
    makeSchoolTask({ id: "strategic-1", status: "IN_PROGRESS", progressPercent: 70 }),
    // Neither pending nor blocked/overdue nor strategic
    makeSchoolTask({ id: "completed-normal", status: "COMPLETED", progressPercent: 100 }),
  ];

  test("ALL filter returns all tasks unchanged", () => {
    const result = filterTasksByExecutive(tasks, "ALL", REF_DATE);
    assert.strictEqual(result.length, tasks.length);
  });

  // The review lens is driven by a real pending-review request, never by progressPercent === 100.
  test("PENDING_APPROVAL returns real review requests, not 100%-progress tasks", () => {
    const result = filterTasksByExecutive(tasks, "PENDING_APPROVAL", REF_DATE);
    const ids = result.map((t) => t.id);
    assert.ok(ids.includes("review-1"), "a WAITING_APPROVAL task must match");
    assert.ok(!ids.includes("pending-1"), "100% progress on an IN_PROGRESS task must NOT match");
    assert.ok(!ids.includes("completed-100"));
    for (const t of result) {
      assert.notStrictEqual(t.status, "COMPLETED");
    }
  });

  test("BLOCKED_OVERDUE returns tasks that are blocked, overdue, or have blocked/overdue subtasks", () => {
    const result = filterTasksByExecutive(tasks, "BLOCKED_OVERDUE", REF_DATE);
    const ids = result.map((t) => t.id);
    assert.ok(ids.includes("blocked-1"), "Task-level BLOCKED should match");
    assert.ok(ids.includes("overdue-1"), "Parent-level overdue should match");
    assert.ok(ids.includes("has-blocked-sub"), "Task with blocked subtask should match");
    assert.ok(ids.includes("has-overdue-sub"), "Task with overdue subtask should match");
    // Normal tasks should not appear
    assert.ok(!ids.includes("completed-normal"));
    assert.ok(!ids.includes("pending-1"));
    assert.ok(!ids.includes("completed-100"));
  });

  test("STRATEGIC returns only tasks with status IN_PROGRESS", () => {
    const result = filterTasksByExecutive(tasks, "STRATEGIC", REF_DATE);
    for (const t of result) {
      assert.strictEqual(t.status, "IN_PROGRESS");
    }
    const ids = result.map((t) => t.id);
    assert.ok(ids.includes("strategic-1"));
    assert.ok(ids.includes("pending-1")); // pending-1 is also IN_PROGRESS
    assert.ok(!ids.includes("completed-100"));
    assert.ok(!ids.includes("blocked-1"));
    assert.ok(!ids.includes("completed-normal"));
  });

  test("Empty task list returns empty for all filters", () => {
    for (const filter of ["ALL", "PENDING_APPROVAL", "BLOCKED_OVERDUE", "STRATEGIC"] as const) {
      const result = filterTasksByExecutive([], filter, REF_DATE);
      assert.strictEqual(result.length, 0, `${filter} on empty list should return empty`);
    }
  });
});

describe("Academic Month Filtering Integration in Dashboard Hub", () => {
  function makeSchoolTask(overrides: Partial<SchoolTask> & { id: string }): SchoolTask {
    return {
      title: `Task ${overrides.id}`,
      category: "CNTT",
      categoryLabel: "CNTT",
      leadAssigneeName: "Test Person",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-09-15",
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 50,
      ...overrides,
    };
  }

  function makeStaffTask(overrides: Partial<StaffTask> & { id: string }): StaffTask {
    return {
      title: `Sub ${overrides.id}`,
      assigneeName: "Staff Member",
      status: "IN_PROGRESS",
      dueDate: "2026-09-15",
      parentSchoolTaskId: "task-parent",
      updatedAt: "2026-09-01",
      ...overrides,
    };
  }

  const sampleTasks: SchoolTask[] = [
    // Month 9 task (25/08/2026 - 24/09/2026)
    makeSchoolTask({ id: "task-month-9", dueDate: "2026-09-10", status: "IN_PROGRESS" }),
    // Month 9 boundary task (exact first day: 2026-08-25)
    makeSchoolTask({
      id: "task-month-9-boundary-start",
      dueDate: "2026-08-25",
      status: "IN_PROGRESS",
    }),
    // Month 9 boundary task (exact last day: 2026-09-24)
    makeSchoolTask({
      id: "task-month-9-boundary-end",
      dueDate: "2026-09-24",
      status: "IN_PROGRESS",
    }),
    // Month 10 task (25/09/2026 - 24/10/2026)
    makeSchoolTask({ id: "task-month-10", dueDate: "2026-10-05", status: "IN_PROGRESS" }),
    // Task with parent in Month 11 but subtask in Month 9
    makeSchoolTask({
      id: "task-cross-month",
      dueDate: "2026-11-15",
      status: "IN_PROGRESS",
      subTasks: [makeStaffTask({ id: "sub-in-month-9", dueDate: "2026-09-12" })],
    }),
    // Month 1 task in next year (25/12/2026 - 24/01/2027)
    makeSchoolTask({ id: "task-month-1", dueDate: "2027-01-10", status: "IN_PROGRESS" }),
  ];

  test("Filters tasks strictly by operational academic month", () => {
    const month9Result = filterTasksByAcademicMonth(sampleTasks, 9, "2026-2027");
    const ids9 = month9Result.map((t) => t.id);

    assert.equal(month9Result.length, 4);
    assert.ok(ids9.includes("task-month-9"));
    assert.ok(ids9.includes("task-month-9-boundary-start"));
    assert.ok(ids9.includes("task-month-9-boundary-end"));
    assert.ok(ids9.includes("task-cross-month"));
    assert.ok(!ids9.includes("task-month-10"));
    assert.ok(!ids9.includes("task-month-1"));
  });

  test("Month 10 filter captures only month 10 tasks", () => {
    const month10Result = filterTasksByAcademicMonth(sampleTasks, 10, "2026-2027");
    const ids10 = month10Result.map((t) => t.id);

    assert.equal(month10Result.length, 1);
    assert.ok(ids10.includes("task-month-10"));
  });

  test("ALL filter retains all tasks without truncation", () => {
    const allResult = filterTasksByAcademicMonth(sampleTasks, "ALL", "2026-2027");
    assert.equal(allResult.length, sampleTasks.length);
  });

  test("computeMonthlyTaskCounts generates accurate distribution across operational months", () => {
    const counts = computeMonthlyTaskCounts(sampleTasks, "2026-2027");

    assert.equal(counts[9], 4, "Month 9 should count 4 tasks");
    assert.equal(counts[10], 1, "Month 10 should count 1 task");
    assert.equal(counts[11], 1, "Month 11 should count 1 task (task-cross-month parent dueDate)");
    assert.equal(counts[1], 1, "Month 1 should count 1 task");
    assert.equal(counts[2], 0, "Month 2 should count 0 tasks");
  });

  test("filterTasksHub seamlessly applies academicMonth alongside scope and search", () => {
    const hubResult = filterTasksHub({
      tasks: sampleTasks,
      scope: "SCHOOL_TASKS",
      academicMonth: 9,
      academicYear: "2026-2027",
    });
    assert.equal(hubResult.length, 4);

    const hubResultWithSearch = filterTasksHub({
      tasks: sampleTasks,
      scope: "SCHOOL_TASKS",
      academicMonth: 9,
      academicYear: "2026-2027",
      searchQuery: "boundary-start",
    });
    assert.equal(hubResultWithSearch.length, 1);
    assert.equal(hubResultWithSearch[0].id, "task-month-9-boundary-start");
  });
});
