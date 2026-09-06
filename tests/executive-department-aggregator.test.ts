import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeExecutiveDepartmentSummaries,
  matchDepartmentForTask,
  isTaskOverdue,
  isTaskDueSoon,
  extractFocusInitiative,
  QCET_12_DEPARTMENTS,
} from "@/lib/tasks/executive-department-aggregator";
import type { SchoolTask } from "@/types/dashboard";

describe("Executive Department Aggregator", () => {
  test("trả về đủ 12 đơn vị QCET theo thứ tự chuẩn với thông tin lãnh đạo", () => {
    const summaries = computeExecutiveDepartmentSummaries([]);
    assert.equal(summaries.length, 12);

    const expectedDeptIds = [
      "KHOA_CNTT",
      "KHOA_DIEN",
      "KHOA_CK",
      "KHOA_XD",
      "KHOA_KTO",
      "KHOA_SP",
      "PHONG_DT",
      "PHONG_HCQT",
      "PHONG_KHTC",
      "PHONG_CTHSSV",
      "TT_TTTV",
      "TT_NNTH",
    ];

    expectedDeptIds.forEach((id, index) => {
      assert.equal(summaries[index].departmentId, id);
      assert.ok(summaries[index].headOfDepartment.name);
      assert.ok(summaries[index].headOfDepartment.title);
    });

    const cntt = summaries.find((s) => s.departmentId === "KHOA_CNTT");
    assert.equal(cntt?.headOfDepartment.name, "TS. Trần Văn Nam");
    assert.equal(cntt?.headOfDepartment.title, "Trưởng khoa");

    const hcqt = summaries.find((s) => s.departmentId === "PHONG_HCQT");
    assert.equal(hcqt?.headOfDepartment.name, "Ông Vũ Đức Thịnh");
    assert.equal(hcqt?.headOfDepartment.title, "Trưởng phòng");

    const khtc = summaries.find((s) => s.departmentId === "PHONG_KHTC");
    assert.equal(khtc?.headOfDepartment.name, "Bà Trần Thị Ngọc Mai");

    const tttv = summaries.find((s) => s.departmentId === "TT_TTTV");
    assert.equal(tttv?.headOfDepartment.name, "ThS. Bùi Thị Vân");
    assert.equal(tttv?.headOfDepartment.title, "Giám đốc");
  });

  test("gán đúng RAG status RED khi có task quá hạn", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-cntt-1",
        title: "Kiểm định chất lượng CNTT",
        category: "BAO_CAO",
        categoryLabel: "Đào tạo",
        leadAssigneeName: "TS. Nguyễn Văn A (Khoa CNTT)",
        coAssignees: [],
        assignedDate: "2026-08-01",
        dueDate: "2026-08-20", // Overdue compared to 2026-09-06
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 2,
        completedSubTasks: 0,
        progressPercent: 20,
      },
    ];

    const summaries = computeExecutiveDepartmentSummaries(mockTasks, "2026-09-06");
    const cntt = summaries.find((s) => s.departmentId === "KHOA_CNTT");
    assert.ok(cntt, "Department KHOA_CNTT should be found");
    assert.equal(cntt.ragStatus, "RED");
    assert.equal(cntt.metrics.overdue, 1);
    assert.match(cntt.ragReason || "", /quá hạn/i);
  });

  test("gán đúng RAG status RED khi completionRate < 35% dù chưa có task quá hạn", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-dien-1",
        title: "Nâng cấp xưởng thực hành Điện",
        category: "CNTT",
        categoryLabel: "Kỹ thuật",
        leadDepartmentCode: "KHOA_DIEN",
        leadAssigneeName: "ThS. Lê Thị Mai",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30", // Far deadline
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 4,
        completedSubTasks: 1,
        progressPercent: 25,
      },
    ];

    const summaries = computeExecutiveDepartmentSummaries(mockTasks, "2026-09-06");
    const dien = summaries.find((s) => s.departmentId === "KHOA_DIEN");
    assert.ok(dien);
    assert.equal(dien.ragStatus, "RED");
    assert.equal(dien.metrics.completionRate, 25);
    assert.match(dien.ragReason || "", /thấp/i);
  });

  test("gán đúng RAG status AMBER khi có task sắp đến hạn (dueSoon)", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-ck-1",
        title: "Bảo trì máy CNC",
        category: "CNTT",
        categoryLabel: "Kỹ thuật",
        leadAssigneeName: "TS. Phạm Quốc Bảo",
        coAssignees: [],
        assignedDate: "2026-08-15",
        dueDate: "2026-09-08", // 2 days ahead from 2026-09-06
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 2,
        completedSubTasks: 1,
        progressPercent: 70,
      },
    ];

    const summaries = computeExecutiveDepartmentSummaries(mockTasks, "2026-09-06");
    const ck = summaries.find((s) => s.departmentId === "KHOA_CK");
    assert.ok(ck);
    assert.equal(ck.ragStatus, "AMBER");
    assert.equal(ck.metrics.dueSoon, 1);
    assert.equal(ck.metrics.overdue, 0);
  });

  test("gán đúng RAG status AMBER khi completionRate từ 35% đến dưới 60%", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-xd-1",
        title: "Thiết kế sa bàn Đô thị",
        category: "CNTT",
        categoryLabel: "Kỹ thuật",
        leadDepartmentId: "dept-k-xd",
        leadAssigneeName: "Khoa Xây dựng",
        coAssignees: [],
        assignedDate: "2026-08-01",
        dueDate: "2026-09-25", // Far deadline
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 2,
        completedSubTasks: 1,
        progressPercent: 50,
      },
    ];

    const summaries = computeExecutiveDepartmentSummaries(mockTasks, "2026-09-06");
    const xd = summaries.find((s) => s.departmentId === "KHOA_XD");
    assert.ok(xd);
    assert.equal(xd.ragStatus, "AMBER");
    assert.equal(xd.metrics.completionRate, 50);
  });

  test("gán đúng RAG status GREEN khi completionRate >= 60% và không có quá hạn", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-kto-1",
        title: "Hội thảo hướng nghiệp Du lịch",
        category: "TRUYEN_THONG",
        categoryLabel: "Truyền thông",
        leadAssigneeName: "ThS. Đỗ Thị Hồng",
        coAssignees: [],
        assignedDate: "2026-08-10",
        dueDate: "2026-09-20",
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 3,
        completedSubTasks: 2,
        progressPercent: 85,
      },
    ];

    const summaries = computeExecutiveDepartmentSummaries(mockTasks, "2026-09-06");
    const kto = summaries.find((s) => s.departmentId === "KHOA_KTO");
    assert.ok(kto);
    assert.equal(kto.ragStatus, "GREEN");
    assert.equal(kto.metrics.completionRate, 85);
  });

  test("đơn vị không có task mặc định có RAG status GREEN và completionRate 100%", () => {
    const summaries = computeExecutiveDepartmentSummaries([]);
    const sp = summaries.find((s) => s.departmentId === "KHOA_SP");
    assert.ok(sp);
    assert.equal(sp.ragStatus, "GREEN");
    assert.equal(sp.metrics.totalTasks, 0);
    assert.equal(sp.metrics.completionRate, 100);
    assert.equal(sp.focusInitiative, undefined);
  });

  test("trích xuất chính xác Focus Initiative cho đơn vị", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-dt-1",
        title: "Xếp thời khóa biểu Học kỳ I",
        category: "BAO_CAO",
        categoryLabel: "Đào tạo",
        leadAssigneeName: "Phòng Đào tạo",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-15",
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 3,
        completedSubTasks: 1,
        progressPercent: 33,
      },
    ];

    const summaries = computeExecutiveDepartmentSummaries(mockTasks);
    const dt = summaries.find((s) => s.departmentId === "PHONG_DT");
    assert.ok(dt, "Department PHONG_DT should be found");
    assert.ok(dt.focusInitiative, "Focus initiative should be defined");
    assert.equal(dt.focusInitiative.title, "Xếp thời khóa biểu Học kỳ I");
    assert.equal(dt.focusInitiative.taskId, "task-dt-1");
  });

  test("trích xuất Focus Initiative ưu tiên task có priority HIGH hoặc deadline gần nhất", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-hc-1",
        title: "Bảo dưỡng hệ thống điều hòa",
        category: "KHAC",
        categoryLabel: "Hành chính",
        leadAssigneeName: "Phòng Hành chính - Quản trị",
        coAssignees: [],
        assignedDate: "2026-08-01",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 70, // MEDIUM
      },
      {
        id: "task-hc-2",
        title: "Chuẩn bị lễ Khai giảng năm học mới",
        category: "KHAC",
        categoryLabel: "Hành chính",
        leadAssigneeName: "Phòng Hành chính - Quản trị",
        coAssignees: [],
        assignedDate: "2026-08-15",
        dueDate: "2026-09-08", // due soon -> HIGH priority
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 5,
        completedSubTasks: 1,
        progressPercent: 20,
      },
    ];

    const summaries = computeExecutiveDepartmentSummaries(mockTasks, "2026-09-06");
    const hc = summaries.find((s) => s.departmentId === "PHONG_HCQT");
    assert.ok(hc?.focusInitiative);
    assert.equal(hc.focusInitiative.title, "Chuẩn bị lễ Khai giảng năm học mới");
    assert.equal(hc.focusInitiative.priority, "HIGH");
  });

  test("fallback Focus Initiative về task mới nhất khi tất cả task đã COMPLETED", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-khtc-old",
        title: "Quyết toán quý 1",
        category: "BAO_CAO",
        categoryLabel: "Tài chính",
        leadAssigneeName: "Phòng Kế hoạch - Tài chính",
        coAssignees: [],
        assignedDate: "2026-03-01",
        dueDate: "2026-03-31",
        status: "COMPLETED",
        subTasks: [],
        totalSubTasks: 1,
        completedSubTasks: 1,
        progressPercent: 100,
      },
      {
        id: "task-khtc-new",
        title: "Quyết toán quý 2",
        category: "BAO_CAO",
        categoryLabel: "Tài chính",
        leadAssigneeName: "Phòng Kế hoạch - Tài chính",
        coAssignees: [],
        assignedDate: "2026-06-01",
        dueDate: "2026-06-30",
        status: "COMPLETED",
        subTasks: [],
        totalSubTasks: 2,
        completedSubTasks: 2,
        progressPercent: 100,
      },
    ];

    const summaries = computeExecutiveDepartmentSummaries(mockTasks, "2026-09-06");
    const khtc = summaries.find((s) => s.departmentId === "PHONG_KHTC");
    assert.ok(khtc?.focusInitiative);
    assert.equal(khtc.focusInitiative.title, "Quyết toán quý 2");
    assert.equal(khtc.focusInitiative.progressPercent, 100);
  });

  test("tính toán chính xác pendingApprovalCount", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-cthssv-1",
        title: "Xét học bổng khuyến khích học tập",
        category: "KHAC",
        categoryLabel: "HSSV",
        leadAssigneeName: "Phòng Công tác HSSV",
        coAssignees: [],
        assignedDate: "2026-08-20",
        dueDate: "2026-09-10",
        status: "PENDING_EXECUTIVE_APPROVAL",
        subTasks: [],
        totalSubTasks: 2,
        completedSubTasks: 2,
        progressPercent: 100,
      },
      {
        id: "task-cthssv-2",
        title: "Tổ chức tuần sinh hoạt công dân",
        category: "KHAC",
        categoryLabel: "HSSV",
        leadAssigneeName: "Phòng Công tác HSSV",
        coAssignees: [],
        assignedDate: "2026-08-20",
        dueDate: "2026-09-20",
        status: "IN_PROGRESS",
        subTasks: [
          {
            id: "sub-1",
            title: "Báo cáo điểm danh",
            assigneeName: "Chuyên viên HSSV",
            status: "NEEDS_REVIEW",
            dueDate: "2026-09-18",
            parentSchoolTaskId: "task-cthssv-2",
            updatedAt: "2026-09-05",
          },
        ],
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 50,
      },
    ];

    const summaries = computeExecutiveDepartmentSummaries(mockTasks);
    const cthssv = summaries.find((s) => s.departmentId === "PHONG_CTHSSV");
    assert.ok(cthssv);
    assert.equal(cthssv.pendingApprovalCount, 2);
    assert.equal(cthssv.schoolLevelTaskCount, 2);
    assert.equal(cthssv.unitLevelTaskCount, 1);
  });

  test("nhận diện đúng Trung tâm Ngoại ngữ - Tin học (TT_NNTH) và Thư viện (TT_TTTV)", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-nnth-1",
        title: "Tổ chức thi chứng chỉ Ngoại ngữ chuẩn đầu ra",
        category: "BAO_CAO",
        categoryLabel: "Đào tạo",
        leadAssigneeName: "Trung tâm Ngoại ngữ - Tin học",
        coAssignees: [],
        assignedDate: "2026-08-25",
        dueDate: "2026-09-25",
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 40,
      },
      {
        id: "task-tttv-1",
        title: "Bổ sung giáo trình điện tử Thư viện",
        category: "THU_VIEN",
        categoryLabel: "Thư viện",
        leadAssigneeName: "ThS. Bùi Thị Vân",
        coAssignees: [],
        assignedDate: "2026-08-20",
        dueDate: "2026-09-10",
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 60,
      },
    ];

    const summaries = computeExecutiveDepartmentSummaries(mockTasks);
    const nnth = summaries.find((s) => s.departmentId === "TT_NNTH");
    const tttv = summaries.find((s) => s.departmentId === "TT_TTTV");

    assert.ok(nnth);
    assert.equal(nnth.metrics.totalTasks, 1);
    assert.equal(nnth.tasks[0].id, "task-nnth-1");

    assert.ok(tttv);
    assert.equal(tttv.metrics.totalTasks, 1);
    assert.equal(tttv.tasks[0].id, "task-tttv-1");
  });
});
