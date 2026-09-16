import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { SchoolTask } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";
import { filterTasksByScope } from "../src/components/workspace/utils/task-workspace-mutations";

describe("Unified 3-Scopes (Cá nhân / Đơn vị / Toàn trường) Suite", () => {
  const mockTasks: SchoolTask[] = [
    {
      id: "task-1",
      title: "Triển khai tuyển sinh năm học 2026-2027",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "ThS. Lê Văn Thí",
      coAssignees: [],
      leadDepartmentCode: "P_QLDT",
      department: "Phòng Quản lý Đào tạo",
      departmentCode: "P_QLDT",
      coDepartments: ["Khoa Công nghệ thông tin"],
      coDepartmentCodes: ["CNTT"],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      subTasks: [
        {
          id: "sub-1-1",
          title: "Xây dựng cổng đăng ký trực tuyến",
          assigneeName: "KS. Nguyễn Ngọc Vinh",
          departmentCode: "CNTT",
          department: "Khoa Công nghệ thông tin",
          status: "IN_PROGRESS",
          dueDate: "2026-09-15",
          parentSchoolTaskId: "task-1",
          updatedAt: "2026-09-02",
        },
        {
          id: "sub-1-2",
          title: "Soạn thảo thông báo tuyển sinh",
          assigneeName: "ThS. Lê Văn Thí",
          departmentCode: "P_QLDT",
          department: "Phòng Quản lý Đào tạo",
          status: "COMPLETED",
          dueDate: "2026-09-08",
          parentSchoolTaskId: "task-1",
          updatedAt: "2026-09-02",
        },
      ],
      totalSubTasks: 2,
      completedSubTasks: 1,
      progressPercent: 50,
    },
    {
      id: "task-2",
      title: "Tổ chức Hội nghị An toàn thông tin",
      category: "ATTT",
      categoryLabel: "An toàn thông tin",
      leadAssigneeName: "ThS. Đặng Nhật Huy",
      coAssignees: [],
      leadDepartmentCode: "BGH",
      department: "Ban Giám hiệu",
      departmentCode: "BGH",
      coDepartments: [],
      coDepartmentCodes: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-10-10",
      status: "NOT_STARTED",
      subTasks: [
        {
          id: "sub-2-1",
          title: "Chuẩn bị tham luận bảo mật",
          assigneeName: "KS. Nguyễn Ngọc Vinh",
          departmentCode: "CNTT",
          department: "Khoa Công nghệ thông tin",
          status: "NOT_STARTED",
          dueDate: "2026-09-25",
          parentSchoolTaskId: "task-2",
          updatedAt: "2026-09-02",
        },
      ],
      totalSubTasks: 1,
      completedSubTasks: 0,
      progressPercent: 0,
    },
  ];

  const bghUser: AuthUser = {
    id: "user-bgh",
    name: "ThS. Đặng Nhật Huy",
    email: "bgh@cdktcnqn.edu.vn",
    role: "ADMIN",
    roleLabel: "Ban Giám hiệu (Hiệu trưởng)",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
  };

  const managerUser: AuthUser = {
    id: "user-manager",
    name: "ThS. Lê Văn Thí",
    email: "thi@cdktcnqn.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng phòng Đào tạo",
    department: "Phòng Quản lý Đào tạo",
    departmentCode: "P_QLDT",
  };

  const staffUser: AuthUser = {
    id: "user-staff",
    name: "KS. Nguyễn Ngọc Vinh",
    email: "vinh@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên CNTT",
    department: "Khoa Công nghệ thông tin",
    departmentCode: "CNTT",
  };

  describe("1. BGH (Ban Giám hiệu / Admin)", () => {
    test("Góc nhìn Toàn trường: Thấy toàn bộ công việc cấp trường", () => {
      const result = filterTasksByScope(mockTasks, "school", bghUser);
      assert.strictEqual(result.length, 2);
    });

    test("Góc nhìn Đơn vị: Có thể chuyển và xem bất kỳ đơn vị nào", () => {
      // Xem đơn vị P_QLDT
      const qldtTasks = filterTasksByScope(mockTasks, "unit", bghUser, "P_QLDT");
      assert.strictEqual(qldtTasks.length, 1);
      assert.strictEqual(qldtTasks[0].id, "task-1");

      // Xem đơn vị BGH
      const bghTasks = filterTasksByScope(mockTasks, "unit", bghUser, "BGH");
      assert.strictEqual(bghTasks.length, 1);
      assert.strictEqual(bghTasks[0].id, "task-2");
    });

    test("Góc nhìn Cá nhân: Thấy việc BGH trực tiếp chủ trì/phụ trách", () => {
      const myTasks = filterTasksByScope(mockTasks, "my", bghUser);
      assert.strictEqual(myTasks.length, 1);
      assert.strictEqual(myTasks[0].id, "task-2");
    });
  });

  describe("2. Trưởng đơn vị (Manager / Trưởng phòng / Trưởng khoa)", () => {
    test("Góc nhìn Toàn trường: Được phép xem các việc cấp trường được chia sẻ", () => {
      const result = filterTasksByScope(mockTasks, "school", managerUser);
      assert.strictEqual(result.length, 2);
    });

    test("Góc nhìn Đơn vị: Thấy việc đơn vị mình chủ trì hoặc phối hợp", () => {
      const unitTasks = filterTasksByScope(mockTasks, "unit", managerUser);
      assert.strictEqual(unitTasks.length, 1);
      assert.strictEqual(unitTasks[0].id, "task-1");
    });

    test("Góc nhìn Cá nhân: Thấy việc cá nhân trưởng phòng phụ trách/làm", () => {
      const myTasks = filterTasksByScope(mockTasks, "my", managerUser);
      assert.strictEqual(myTasks.length, 1);
      assert.strictEqual(myTasks[0].id, "task-1");
      // Chỉ giữ subtasks do mình làm hoặc toàn bộ nếu mình là lead
      assert.strictEqual(myTasks[0].leadAssigneeName, "ThS. Lê Văn Thí");
    });
  });

  describe("3. Chuyên viên (Staff)", () => {
    test("Góc nhìn Toàn trường: Được xem các việc cấp trường có quyền xem", () => {
      const result = filterTasksByScope(mockTasks, "school", staffUser);
      assert.strictEqual(result.length, 2);
    });

    test("Góc nhìn Đơn vị: Thấy việc đơn vị CNTT chủ trì hoặc phối hợp", () => {
      const unitTasks = filterTasksByScope(mockTasks, "unit", staffUser);
      // CNTT phối hợp task-1 và có subtask trong task-2
      assert.strictEqual(unitTasks.length, 2);
    });

    test("Góc nhìn Cá nhân: Chỉ thấy việc mình phụ trách hoặc tham gia", () => {
      const myTasks = filterTasksByScope(mockTasks, "my", staffUser);
      assert.strictEqual(myTasks.length, 2);
      // Subtasks được lọc chính xác cho chuyên viên Vinh
      assert.strictEqual(myTasks[0].subTasks?.length, 1);
      assert.strictEqual(myTasks[0].subTasks?.[0].assigneeName, "KS. Nguyễn Ngọc Vinh");
      assert.strictEqual(myTasks[1].subTasks?.length, 1);
      assert.strictEqual(myTasks[1].subTasks?.[0].assigneeName, "KS. Nguyễn Ngọc Vinh");
    });
  });
});
