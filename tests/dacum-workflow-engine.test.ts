import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateDeliverableSubmission, transitionStaffTaskStatus } from "../src/lib/dacum-workflow-engine";
import type { AuthUser } from "@qcet/contracts/types/auth";
import type { StaffTask, SchoolTask, DeliverableItem } from "@qcet/contracts/types/dashboard";

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

    test("Staff can directly complete routine task without review", () => {
      const routineTask: StaffTask = { ...task, requiresReview: false };
      const res = transitionStaffTaskStatus(routineTask, "COMPLETED", staffDaoTao);
      assert.equal(res.success, true);
      assert.equal(res.updatedTask?.status, "COMPLETED");
    });

    test("Staff cannot directly complete critical DACUM task when requiresReview is true", () => {
      const criticalTask: StaffTask = { ...task, requiresReview: true };
      const res = transitionStaffTaskStatus(criticalTask, "COMPLETED", staffDaoTao);
      assert.equal(res.success, false);
      assert.ok(res.error?.includes("yêu cầu nghiệm thu sản phẩm"));
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

    test("Manager cannot reject NEEDS_REVIEW task without non-empty rejectionReason", () => {
      const reviewTask: StaffTask = { ...task, status: "NEEDS_REVIEW" };
      const resNoReason = transitionStaffTaskStatus(reviewTask, "IN_PROGRESS", managerDaoTao);
      assert.equal(resNoReason.success, false);
      assert.equal(
        resNoReason.error,
        "Lý do trả lại yêu cầu chỉnh sửa bắt buộc phải được ghi rõ."
      );

      const resWhitespaceReason = transitionStaffTaskStatus(
        reviewTask,
        "IN_PROGRESS",
        managerDaoTao,
        { rejectionReason: "   " }
      );
      assert.equal(resWhitespaceReason.success, false);
      assert.equal(
        resWhitespaceReason.error,
        "Lý do trả lại yêu cầu chỉnh sửa bắt buộc phải được ghi rõ."
      );
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
});
