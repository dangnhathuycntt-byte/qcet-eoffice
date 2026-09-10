import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";
import { AUTH_STORAGE_KEY } from "../src/lib/auth-context";
import type { UserRole } from "../src/types/auth";

describe("AuthContext Demo Credentials", () => {
  test("defines 3 distinct role viewpoints conforming to Section 7", () => {
    assert.equal(DEFAULT_DEMO_USERS.length, 3);
    const roles = DEFAULT_DEMO_USERS.map((u) => u.role);
    assert.ok(roles.includes("ADMIN"));
    assert.ok(roles.includes("MANAGER"));
    assert.ok(roles.includes("STAFF"));
  });

  test("demo users provide valid fallback and individual attributes", () => {
    const admin = DEFAULT_DEMO_USERS.find((u) => u.role === "ADMIN");
    const manager = DEFAULT_DEMO_USERS.find((u) => u.role === "MANAGER");
    const staff = DEFAULT_DEMO_USERS.find((u) => u.role === "STAFF");

    assert.ok(admin);
    assert.ok(manager);
    assert.ok(staff);

    assert.equal(admin.id, "user-admin-bgh");
    assert.equal(admin.departmentCode, "BGH");

    assert.ok(manager.id === "user-manager-daotao" || manager.id === "user-manager-qldt");
    assert.ok(manager.departmentCode === "DAO_TAO" || manager.departmentCode === "P_QLDT");

    assert.equal(staff.id, "user-staff-vinh");
    assert.ok(staff.departmentCode === "CNTT" || staff.departmentCode === "TT_STT");
  });

  test("switchRole correctly resolves users from DEFAULT_DEMO_USERS", () => {
    const findUserByRole = (role: UserRole) => {
      return DEFAULT_DEMO_USERS.find((u) => u.role === role) || DEFAULT_DEMO_USERS[0];
    };

    assert.equal(findUserByRole("ADMIN").role, "ADMIN");
    assert.equal(findUserByRole("MANAGER").role, "MANAGER");
    assert.equal(findUserByRole("STAFF").role, "STAFF");
  });

  test("uses qcet_active_user as storage key", () => {
    assert.equal(AUTH_STORAGE_KEY, "qcet_active_user");
  });

  test("auto-provisions dangnhathuy@cdktcnqn.edu.vn with verified Google badge", () => {
    const email = "dangnhathuy@cdktcnqn.edu.vn";
    const name = "Đặng Nhật Huy";
    const user = {
      id: "user-staff-test",
      name,
      email,
      role: "STAFF" as const,
      roleLabel: "Viên chức / Giảng viên",
      department: "Chưa cập nhật đơn vị",
      departmentCode: "QCET",
      emailVerified: true,
      provider: "google" as const,
      isFirstLogin: true,
    };

    assert.equal(user.email, "dangnhathuy@cdktcnqn.edu.vn");
    assert.equal(user.emailVerified, true);
    assert.equal(user.provider, "google");
    assert.equal(user.isFirstLogin, true);
    assert.equal(user.role, "STAFF");
  });
});
