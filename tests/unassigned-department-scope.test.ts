import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isUserUnassignedDepartment, shouldPromptUnassignedDepartment } from "../src/lib/auth-context";
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

  test("sessionStorage prompt behavior logic correctly prevents repeated popups", () => {
    const unassignedUser = { role: "STAFF", department: "Chưa chọn đơn vị", departmentCode: "QCET" };
    const mockStorage: Record<string, string> = {};
    const storageApi = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
    };

    // First visit: should prompt
    assert.equal(shouldPromptUnassignedDepartment(unassignedUser, storageApi), true);

    // After prompt is recorded: should NOT prompt again
    storageApi.setItem("qcet_profile_unassigned_prompted", "true");
    assert.equal(shouldPromptUnassignedDepartment(unassignedUser, storageApi), false);

    // Dismissed key should also prevent prompt
    const dismissedStorage = {
      getItem: (key: string) => (key === "qcet_dept_prompt_dismissed" ? "true" : null),
    };
    assert.equal(shouldPromptUnassignedDepartment(unassignedUser, dismissedStorage), false);

    // Assigned staff or executives should never be prompted
    const assignedUser = { role: "STAFF", department: "Khoa CNTT", departmentCode: "CNTT" };
    assert.equal(shouldPromptUnassignedDepartment(assignedUser, storageApi), false);

    const adminUser = { role: "ADMIN", department: "BGH", departmentCode: "BGH" };
    assert.equal(shouldPromptUnassignedDepartment(adminUser, storageApi), false);
  });
});
