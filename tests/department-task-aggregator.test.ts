import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateTasksByDepartment,
  type DepartmentRAGStatus,
} from "../src/lib/department-task-aggregator";
import type { SchoolTask } from "../src/types/dashboard";
import type { DepartmentNode } from "../src/components/org/organization-tree";

describe("Department Task Aggregator", () => {
  const mockDepartments: DepartmentNode[] = [
    {
      id: "dept-cntt",
      code: "CNTT",
      name: "Khoa Công nghệ thông tin",
      category: "KHOA_CHUYEN_MON",
      categoryLabel: "Khoa Chuyên môn",
      description: "Đào tạo ngành CNTT",
      location: "Khu A - Tầng 2",
      phone: "0256.3846.123",
      email: "cntt@qcet.edu.vn",
      leaderName: "TS. Nguyễn Văn A",
      leaderRole: "Trưởng khoa",
      members: [],
    },
    {
      id: "dept-dao-tao",
      code: "DAO_TAO",
      name: "Phòng Đào tạo & QLKH",
      category: "PHONG_CHUC_NANG",
      categoryLabel: "Phòng Chức năng",
      description: "Quản lý đào tạo",
      location: "Khu B - Tầng 1",
      phone: "0256.3846.456",
      email: "daotao@qcet.edu.vn",
      leaderName: "ThS. Trần Văn B",
      leaderRole: "Trưởng phòng",
      members: [],
    },
  ];

  const mockTasks: SchoolTask[] = [
    {
      id: "task-1",
      title: "Nâng cấp Cổng thông tin đào tạo",
      category: "CNTT",
      categoryLabel: "Công nghệ thông tin",
      leadDepartmentCode: "CNTT",
      leadAssigneeName: "Nguyễn Văn A",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-09-01", // Overdue relative to 2026-09-06
      status: "IN_PROGRESS",
      progressPercent: 30,
      subTasks: [
        {
          id: "sub-1",
          title: "Thiết kế CSDL",
          assigneeName: "Lê Văn C",
          status: "COMPLETED",
          dueDate: "2026-08-20",
          parentSchoolTaskId: "task-1",
          updatedAt: "2026-08-20",
          departmentCode: "CNTT",
        },
      ],
      totalSubTasks: 1,
      completedSubTasks: 1,
    },
    {
      id: "task-2",
      title: "Rà soát đề cương năm học 2026",
      category: "BAO_CAO",
      categoryLabel: "Báo cáo",
      leadDepartmentCode: "DAO_TAO",
      leadAssigneeName: "Trần Văn B",
      coAssignees: [],
      assignedDate: "2026-08-15",
      dueDate: "2026-09-30", // Future due date
      status: "IN_PROGRESS",
      progressPercent: 80,
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
    },
  ];

  test("Gom nhóm công việc đúng theo mã đơn vị", () => {
    const groups = aggregateTasksByDepartment(mockTasks, mockDepartments, "2026-09-06");
    assert.equal(groups.length, 2);

    const cnttGroup = groups.find((g) => g.departmentCode === "CNTT");
    assert.ok(cnttGroup);
    assert.equal(cnttGroup.schoolTasks.length, 1);
    assert.equal(cnttGroup.unitTasks.length, 1);
    assert.equal(cnttGroup.stats.totalTasks, 2);

    const daoTaoGroup = groups.find((g) => g.departmentCode === "DAO_TAO");
    assert.ok(daoTaoGroup);
    assert.equal(daoTaoGroup.schoolTasks.length, 1);
    assert.equal(daoTaoGroup.unitTasks.length, 0);
    assert.equal(daoTaoGroup.stats.totalTasks, 1);
  });

  test("Tính toán chính xác trạng thái RAG", () => {
    const groups = aggregateTasksByDepartment(mockTasks, mockDepartments, "2026-09-06");
    const cnttGroup = groups.find((g) => g.departmentCode === "CNTT");
    const daoTaoGroup = groups.find((g) => g.departmentCode === "DAO_TAO");

    // CNTT có task trễ hạn (2026-09-01 < 2026-09-06) và tiến độ thấp -> RED
    assert.equal(cnttGroup?.stats.ragStatus, "RED");
    assert.ok(cnttGroup?.stats.overdueTasksCount! >= 1);

    // Đào tạo tiến độ 80%, không có trễ hạn -> GREEN
    assert.equal(daoTaoGroup?.stats.ragStatus, "GREEN");
    assert.equal(daoTaoGroup?.stats.overdueTasksCount, 0);
  });

  test("Xử lý an toàn đơn vị rỗng không có công việc nào", () => {
    const emptyDepartments: DepartmentNode[] = [
      {
        id: "dept-empty",
        code: "EMPTY",
        name: "Đơn vị chưa có việc",
        category: "TRUNG_TAM",
        categoryLabel: "Trung tâm",
        description: "Mới thành lập",
        location: "Khu C",
        phone: "0256.3846.789",
        email: "empty@qcet.edu.vn",
        leaderName: "Chưa bổ nhiệm",
        leaderRole: "Phụ trách",
        members: [],
      },
    ];

    const groups = aggregateTasksByDepartment([], emptyDepartments, "2026-09-06");
    assert.equal(groups.length, 1);
    assert.equal(groups[0].stats.totalTasks, 0);
    assert.equal(groups[0].stats.averageProgress, 0);
    assert.equal(groups[0].stats.ragStatus, "GREEN"); // Không có trễ hạn
  });

  test("Đơn vị chỉ có unitTasks hoàn thành (0 schoolTasks) đạt 100% tiến độ và RAG status GREEN", () => {
    const unitOnlyTasks: SchoolTask[] = [
      {
        id: "school-task-ext",
        title: "Kế hoạch phối hợp liên đơn vị",
        category: "KHAC",
        categoryLabel: "Khác",
        leadDepartmentCode: "DAO_TAO",
        leadAssigneeName: "Trần Văn Quản lý",
        coAssignees: [],
        assignedDate: "2026-08-15",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        progressPercent: 50,
        subTasks: [
          {
            id: "unit-task-1",
            title: "Triển khai hạ tầng phòng máy CNTT",
            assigneeName: "Nguyễn Kỹ sư",
            status: "COMPLETED",
            dueDate: "2026-09-20",
            parentSchoolTaskId: "school-task-ext",
            updatedAt: "2026-08-30",
            departmentCode: "CNTT",
          },
          {
            id: "unit-task-2",
            title: "Cấu hình mạng nội bộ cho phòng máy",
            assigneeName: "Lê Kỹ sư",
            status: "COMPLETED",
            dueDate: "2026-09-25",
            parentSchoolTaskId: "school-task-ext",
            updatedAt: "2026-09-01",
            departmentCode: "CNTT",
          },
        ],
        totalSubTasks: 2,
        completedSubTasks: 2,
      },
    ];

    const groups = aggregateTasksByDepartment(unitOnlyTasks, mockDepartments, "2026-09-06");
    const cnttGroup = groups.find((g) => g.departmentCode === "CNTT");

    assert.ok(cnttGroup);
    // CNTT có 0 school tasks và 2 unit tasks
    assert.equal(cnttGroup.schoolTasks.length, 0);
    assert.equal(cnttGroup.unitTasks.length, 2);
    assert.equal(cnttGroup.stats.totalTasks, 2);
    assert.equal(cnttGroup.stats.completedTasksCount, 2);
    assert.equal(cnttGroup.stats.overdueTasksCount, 0);
    assert.equal(cnttGroup.stats.blockedTasksCount, 0);
    // Cả 2 unit tasks đều COMPLETED -> tiến độ trung bình phải là 100%
    assert.equal(cnttGroup.stats.averageProgress, 100);
    // RAG Status phải là GREEN
    assert.equal(cnttGroup.stats.ragStatus, "GREEN");
  });

  test("Phân nhóm chính xác theo tên tiếng Việt đầy đủ và ID alias của đơn vị", () => {
    const tasksWithVariousDepts: SchoolTask[] = [
      // 1. Phân bổ theo tên tiếng Việt đầy đủ
      {
        id: "task-by-name",
        title: "Xây dựng giáo trình thực hành CNTT",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadDepartment: "Khoa Công nghệ thông tin", // Match by name
        leadAssigneeName: "Vũ Giảng viên",
        coAssignees: [],
        assignedDate: "2026-08-10",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        progressPercent: 75,
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
      },
      // 2. Phân bổ theo ID alias (ví dụ khoa-cntt hoặc dept-cntt)
      {
        id: "task-by-id",
        title: "Tổ chức hội thảo công nghệ AI",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadDepartmentId: "khoa-cntt", // Match by ID alias
        leadAssigneeName: "Hoàng Giảng viên",
        coAssignees: [],
        assignedDate: "2026-08-15",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        progressPercent: 60,
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
      },
      // 3. Phân bổ theo leadDepartmentCode chuẩn
      {
        id: "task-by-code",
        title: "Kiểm tra chất lượng đào tạo",
        category: "BAO_CAO",
        categoryLabel: "Báo cáo",
        leadDepartmentCode: "DAO_TAO",
        leadAssigneeName: "Đặng Chuyên viên",
        coAssignees: [],
        assignedDate: "2026-08-20",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        progressPercent: 90,
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
      },
    ];

    const groups = aggregateTasksByDepartment(tasksWithVariousDepts, mockDepartments, "2026-09-06");
    const cnttGroup = groups.find((g) => g.departmentCode === "CNTT");
    const daoTaoGroup = groups.find((g) => g.departmentCode === "DAO_TAO");

    assert.ok(cnttGroup);
    assert.equal(cnttGroup.schoolTasks.length, 2); // Cả task-by-name và task-by-id đều vào CNTT
    assert.ok(cnttGroup.schoolTasks.some((t) => t.id === "task-by-name"));
    assert.ok(cnttGroup.schoolTasks.some((t) => t.id === "task-by-id"));

    assert.ok(daoTaoGroup);
    assert.equal(daoTaoGroup.schoolTasks.length, 1);
    assert.ok(daoTaoGroup.schoolTasks.some((t) => t.id === "task-by-code"));
  });
});
