import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isUserUnassignedDepartment } from "../src/lib/auth-context";
import { resolveScopeDetails } from "../src/components/layout/scope-switcher";

describe("Unassigned Department Detection & Scope Details", () => {
  test("identifies unassigned staff with null/empty or fallback departmentCode", () => {
    assert.equal(isUserUnassignedDepartment(null), false);
    assert.equal(isUserUnassignedDepartment({ role: "STAFF", department: "Chưa cập nhật đơn vị", departmentCode: "QCET" }), true);
    assert.equal(isUserUnassignedDepartment({ role: "STAFF", department: "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn", departmentCode: "QCET" }), true);
    assert.equal(isUserUnassignedDepartment({ role: "STAFF", department: "", departmentCode: "" }), true);
    assert.equal(isUserUnassignedDepartment({ role: "STAFF", department: "Chưa chọn đơn vị", departmentCode: "UNASSIGNED" }), true);
  });

  test("does NOT mark executive (BGH/ADMIN) as unassigned", () => {
    assert.equal(isUserUnassignedDepartment({ role: "ADMIN", departmentCode: "BGH" }), false);
    assert.equal(isUserUnassignedDepartment({ role: "BAN_GIAM_HIEU", departmentCode: "QCET" }), false);
  });

  test("does NOT mark staff with valid assigned department as unassigned", () => {
    assert.equal(isUserUnassignedDepartment({ role: "STAFF", department: "Khoa Công nghệ Thông tin", departmentCode: "CNTT" }), false);
    assert.equal(isUserUnassignedDepartment({ role: "MANAGER", department: "Phòng Quản lý Đào tạo", departmentCode: "P_QLDT" }), false);
  });

  test("resolveScopeDetails returns warning state and friendly label when user is unassigned", () => {
    const unassignedUser = { role: "STAFF", department: "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn", departmentCode: "QCET" };
    const details = resolveScopeDetails("unit", null, unassignedUser);
    assert.equal(details.scope, "unit");
    assert.equal(details.label, "Chưa chọn đơn vị");
    assert.equal(details.shortLabel, "Chưa chọn đ/vị");
    assert.equal(details.isWarning, true);
  });

  test("UnassignedDepartmentState file exists and contains accessible actionable CTA", () => {
    const content = readFileSync("src/components/workspace/components/unassigned-department-state.tsx", "utf-8");
    assert.ok(content.includes("UnassignedDepartmentState"));
    assert.ok(content.includes("onOpenProfile"));
    assert.ok(content.includes("Building2"));
    assert.ok(content.includes("Cập nhật Khoa / Phòng công tác ngay"));
    assert.ok(!content.includes("dark:")); // Light-only compliance
  });
});
