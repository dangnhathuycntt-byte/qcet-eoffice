import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getAllowedTaskLevelsForRole,
  canRoleSelectAssignee,
  validateTaskForm,
  getInitialTaskFormData,
  getDepartmentForMember,
} from "../src/components/dashboard/create-task-modal";
import type { AuthUser } from "../src/types/auth";
import type { SchoolTask } from "../src/types/dashboard";

describe("Create Task Modal Constraints & Helpers", () => {
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

  const staffUser: AuthUser = {
    id: "staff-1",
    name: "Nguyễn Thị Bích Thủy",
    email: "thuy@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
  };

  test("Allowed task levels per role", () => {
    assert.deepEqual(getAllowedTaskLevelsForRole("ADMIN"), ["TRUONG", "DON_VI"]);
    assert.deepEqual(getAllowedTaskLevelsForRole("MANAGER"), ["DON_VI"]);
    assert.deepEqual(getAllowedTaskLevelsForRole("STAFF"), []);
  });

  test("canRoleSelectAssignee allows manager only for internal staff, prevents external staff", () => {
    // Manager assigning to own staff
    const internalCheck = canRoleSelectAssignee(managerDaoTao, "DAO_TAO");
    assert.equal(internalCheck.allowed, true);

    // Manager assigning to CNTT staff
    const externalCheck = canRoleSelectAssignee(managerDaoTao, "CNTT");
    assert.equal(externalCheck.allowed, false);
    assert.ok(externalCheck.message?.includes("Phiếu yêu cầu phối hợp"));

    // Admin assigning anywhere
    const adminCheck = canRoleSelectAssignee(adminUser, "CNTT");
    assert.equal(adminCheck.allowed, true);
  });

  test("canRoleSelectAssignee flags isBypassWarning when Admin assigns directly to department staff", () => {
    const adminExternal = canRoleSelectAssignee(adminUser, "CNTT");
    assert.equal(adminExternal.allowed, true);
    assert.equal(adminExternal.isBypassWarning, true);
    assert.ok(adminExternal.message?.includes("Ban Giám hiệu") || adminExternal.message?.includes("thông báo"));

    const adminInternal = canRoleSelectAssignee(adminUser, "BGH");
    assert.equal(adminInternal.allowed, true);
    assert.equal(adminInternal.isBypassWarning, false);
  });

  test("canRoleSelectAssignee rejects staff from assigning tasks", () => {
    const staffCheck = canRoleSelectAssignee(staffUser, "DAO_TAO");
    assert.equal(staffCheck.allowed, false);
  });

  test("getDepartmentForMember resolves correct department group", () => {
    const vinhDept = getDepartmentForMember("Nguyễn Ngọc Vinh");
    assert.equal(vinhDept?.code, "CNTT");

    const trungDept = getDepartmentForMember("Đỗ Quang Trung");
    assert.equal(trungDept?.code, "DAO_TAO");

    const unknown = getDepartmentForMember("Người Lạ");
    assert.equal(unknown, undefined);
  });

  test("validateTaskForm enforces required fields and DACUM deliverables", () => {
    const emptyForm = getInitialTaskFormData("DON_VI");
    const errors = validateTaskForm(emptyForm);

    assert.ok(errors.title);
    assert.ok(errors.leadAssigneeName);
    assert.ok(errors.dueDate);
  });

  test("validateTaskForm validates internalDueDate against parent school task dueDate", () => {
    const parentSchoolTask: SchoolTask = {
      id: "school-task-1",
      title: "Chuyển đổi số 2026",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "Trần Hùng",
      leadDepartment: "Phòng Đào tạo",
      leadDepartmentCode: "DAO_TAO",
      assignedDate: "2026-09-01",
      dueDate: "2026-09-20",
      status: "IN_PROGRESS",
      progressPercent: 50,
      totalSubTasks: 2,
      completedSubTasks: 1,
    };

    const invalidForm = {
      ...getInitialTaskFormData("DON_VI"),
      title: "Biên tập tài liệu hướng dẫn",
      leadAssigneeName: "Nguyễn Thị Bích Thủy",
      dueDate: "2026-09-25",
      internalDueDate: "2026-09-25", // Later than parent schoolTask dueDate (2026-09-20)
      parentTaskId: "school-task-1",
    };

    const errors = validateTaskForm(invalidForm, parentSchoolTask);
    assert.ok(errors.internalDueDate || errors.dueDate);
    assert.ok(
      (errors.internalDueDate || errors.dueDate).includes("không được vượt quá hạn chót của Nhiệm vụ cấp Trường")
    );

    const validForm = {
      ...invalidForm,
      dueDate: "2026-09-18",
      internalDueDate: "2026-09-18",
    };
    const validErrors = validateTaskForm(validForm, parentSchoolTask);
    assert.equal(validErrors.internalDueDate, undefined);
    assert.equal(validErrors.dueDate, undefined);
  });

  test("validateTaskForm blocks manager from assigning external personnel", () => {
    const externalAssignForm = {
      ...getInitialTaskFormData("DON_VI"),
      title: "Cấu hình hạ tầng bảo mật",
      leadAssigneeName: "Nguyễn Ngọc Vinh", // Belongs to CNTT
      dueDate: "2026-09-20",
    };

    const errors = validateTaskForm(externalAssignForm, undefined, managerDaoTao);
    assert.ok(errors.leadAssigneeName);
    assert.ok(errors.leadAssigneeName.includes("Phiếu yêu cầu phối hợp"));

    // Allowed when assigned by Admin
    const adminErrors = validateTaskForm(externalAssignForm, undefined, adminUser);
    assert.equal(adminErrors.leadAssigneeName, undefined);
  });
});
