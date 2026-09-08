import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";
import {
  computeExecutiveActionStats,
  computeDepartmentHealthMatrix,
  resolveDepartmentId,
  QCET_DEPARTMENT_DEFINITIONS,
} from "../src/lib/executive-matrix-aggregator";
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

    const hanhChinh = matrix.find((d) => d.departmentId === "HANH_CHINH");
    assert.ok(hanhChinh);
    assert.strictEqual(hanhChinh.totalTasksCount, 1);
    assert.strictEqual(hanhChinh.blockedTasksCount, 1);
    assert.strictEqual(hanhChinh.overdueTasksCount, 1);
    assert.strictEqual(hanhChinh.completedTasksCount, 0);

    const daoTao = matrix.find((d) => d.departmentId === "DAO_TAO");
    assert.ok(daoTao);
    assert.strictEqual(daoTao.totalTasksCount, 2);
    assert.strictEqual(daoTao.completedTasksCount, 2);
    assert.strictEqual(daoTao.inProgressTasksCount, 0);
    assert.strictEqual(daoTao.overdueTasksCount, 0);
    assert.strictEqual(daoTao.averageProgressPercent, 100);

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
