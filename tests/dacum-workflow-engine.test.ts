import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  canAssignStaffTask,
  validateDueDate,
  validateDeliverableSubmission,
  transitionStaffTaskStatus,
  calculateSchoolTaskRollup,
} from "../src/lib/dacum-workflow-engine";
import type { AuthUser } from "../src/types/auth";
import type { StaffTask, SchoolTask, DeliverableItem } from "../src/types/dashboard";

describe("DACUM Workflow & RBAC Engine", () => {
  const adminUser: AuthUser = {
    id: "admin-1",
    name: "Hiệu trưởng",
    email: "bgh@cdktcnqn.edu.vn",
    role: "ADMIN",
    roleLabel: "Ban Giám hiệu",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
  };

  const managerDaoTao: AuthUser = {
    id: "manager-1",
    name: "Trần Hùng",
    email: "daotao@cdktcnqn.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng phòng Đào tạo",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
  };

  const staffDaoTao: AuthUser = {
    id: "staff-1",
    name: "Lê Văn A",
    email: "anlv@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên Đào tạo",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
  };

  const staffCNTT: AuthUser = {
    id: "staff-2",
    name: "Nguyễn Ngọc Vinh",
    email: "vinhnn@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên CNTT",
    department: "Khoa Công nghệ thông tin",
    departmentCode: "CNTT",
  };

  describe("Assignment Rules (Chống giao việc vượt cấp)", () => {
    test("Manager CAN assign to staff within their department", () => {
      const check = canAssignStaffTask(managerDaoTao, staffDaoTao.departmentCode);
      assert.equal(check.allowed, true);
    });

    test("Manager CANNOT assign directly to staff in another department", () => {
      const check = canAssignStaffTask(managerDaoTao, staffCNTT.departmentCode);
      assert.equal(check.allowed, false);
      assert.ok(check.reason?.includes("Phiếu yêu cầu phối hợp"));
    });

    test("Admin can assign anywhere; triggers bypass alert if direct to staff", () => {
      const normalCheck = canAssignStaffTask(adminUser, "DAO_TAO", false);
      assert.equal(normalCheck.allowed, true);

      const bypassCheck = canAssignStaffTask(adminUser, "CNTT", true);
      assert.equal(bypassCheck.allowed, true);
      assert.equal(bypassCheck.isBypassWarning, true);
    });
  });

  describe("Date Constraint Rules", () => {
    test("Internal due date earlier than or equal to school task due date is valid", () => {
      assert.equal(validateDueDate("2026-09-25", "2026-09-30").valid, true);
      assert.equal(validateDueDate("2026-09-30", "2026-09-30").valid, true);
    });

    test("Internal due date after school task due date is rejected", () => {
      const check = validateDueDate("2026-10-02", "2026-09-30");
      assert.equal(check.valid, false);
      assert.ok(check.error?.includes("không được vượt quá"));
    });
  });

  describe("Deliverable Submission Rules (Chống hoàn thành hình thức)", () => {
    const baseTask: StaffTask = {
      id: "task-1",
      title: "Viết báo cáo kiểm định",
      assigneeName: "Lê Văn A",
      status: "IN_PROGRESS",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "school-1",
      updatedAt: "2026-09-06T00:00:00Z",
    };

    test("Submitting to NEEDS_REVIEW fails if no deliverable or url provided", () => {
      const check = validateDeliverableSubmission(baseTask, [], "");
      assert.equal(check.valid, false);
      assert.ok(check.error?.includes("bắt buộc phải có sản phẩm minh chứng"));
    });

    test("Submitting with valid deliverable item succeeds", () => {
      const item: DeliverableItem = {
        id: "deliv-1",
        name: "Bao_cao_kiem_dinh.pdf",
        url: "https://drive.google.com/file/d/xyz",
      };
      const check = validateDeliverableSubmission(baseTask, [item], "Bản nộp đợt 1");
      assert.equal(check.valid, true);
    });
  });

  describe("Staff Task Status Transitions", () => {
    const task: StaffTask = {
      id: "task-1",
      title: "Thiết kế poster",
      assigneeName: "Lê Văn A",
      status: "IN_PROGRESS",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "school-1",
      updatedAt: "2026-09-06T00:00:00Z",
    };

    test("Staff cannot directly complete task without review", () => {
      const res = transitionStaffTaskStatus(task, "COMPLETED", staffDaoTao);
      assert.equal(res.success, false);
      assert.ok(res.error?.includes("Chỉ Trưởng phòng hoặc BGH mới có quyền nghiệm thu"));
    });

    test("Manager can approve NEEDS_REVIEW task to COMPLETED", () => {
      const reviewTask: StaffTask = { ...task, status: "NEEDS_REVIEW" };
      const res = transitionStaffTaskStatus(reviewTask, "COMPLETED", managerDaoTao);
      assert.equal(res.success, true);
      assert.equal(res.updatedTask?.status, "COMPLETED");
    });

    test("Manager can reject NEEDS_REVIEW task back to IN_PROGRESS with reason", () => {
      const reviewTask: StaffTask = { ...task, status: "NEEDS_REVIEW" };
      const res = transitionStaffTaskStatus(reviewTask, "IN_PROGRESS", managerDaoTao, {
        rejectionReason: "Hình ảnh mờ, cần thay đổi logo chuẩn trường",
      });
      assert.equal(res.success, true);
      assert.equal(res.updatedTask?.status, "IN_PROGRESS");
      assert.equal(res.updatedTask?.rejectionReason, "Hình ảnh mờ, cần thay đổi logo chuẩn trường");
    });

    test("Staff can flag task as BLOCKED with reason", () => {
      const res = transitionStaffTaskStatus(task, "BLOCKED", staffDaoTao, {
        blockedReason: "Chưa nhận được số liệu từ phòng Kế hoạch Tài chính",
      });
      assert.equal(res.success, true);
      assert.equal(res.updatedTask?.status, "BLOCKED");
      assert.equal(res.updatedTask?.blockedReason, "Chưa nhận được số liệu từ phòng Kế hoạch Tài chính");
    });
  });

  describe("School Task Rollup Calculation", () => {
    test("Calculates correct percentage and sets PENDING_EXECUTIVE_APPROVAL when 100% complete", () => {
      const schoolTask: SchoolTask = {
        id: "school-1",
        title: "Tổ chức hội thảo",
        category: "KHAC",
        categoryLabel: "Khác",
        leadAssigneeName: "Trần Hùng",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        totalSubTasks: 2,
        completedSubTasks: 2,
        progressPercent: 100,
        subTasks: [
          {
            id: "sub-1",
            title: "Thuê hội trường",
            assigneeName: "A",
            status: "COMPLETED",
            dueDate: "2026-09-15",
            parentSchoolTaskId: "school-1",
            updatedAt: "",
          },
          {
            id: "sub-2",
            title: "Mời diễn giả",
            assigneeName: "B",
            status: "COMPLETED",
            dueDate: "2026-09-20",
            parentSchoolTaskId: "school-1",
            updatedAt: "",
          },
        ],
      };

      const rollup = calculateSchoolTaskRollup(schoolTask);
      assert.equal(rollup.totalSubTasks, 2);
      assert.equal(rollup.completedSubTasks, 2);
      assert.equal(rollup.progressPercent, 100);
      assert.equal(rollup.calculatedStatus, "PENDING_EXECUTIVE_APPROVAL");
    });

    test("Keeps IN_PROGRESS when incomplete", () => {
      const schoolTask: SchoolTask = {
        id: "school-1",
        title: "Tổ chức hội thảo",
        category: "KHAC",
        categoryLabel: "Khác",
        leadAssigneeName: "Trần Hùng",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        totalSubTasks: 2,
        completedSubTasks: 1,
        progressPercent: 50,
        subTasks: [
          {
            id: "sub-1",
            title: "Thuê hội trường",
            assigneeName: "A",
            status: "COMPLETED",
            dueDate: "2026-09-15",
            parentSchoolTaskId: "school-1",
            updatedAt: "",
          },
          {
            id: "sub-2",
            title: "Mời diễn giả",
            assigneeName: "B",
            status: "IN_PROGRESS",
            dueDate: "2026-09-20",
            parentSchoolTaskId: "school-1",
            updatedAt: "",
          },
        ],
      };

      const rollup = calculateSchoolTaskRollup(schoolTask);
      assert.equal(rollup.progressPercent, 50);
      assert.equal(rollup.calculatedStatus, "IN_PROGRESS");
    });
  });
});
