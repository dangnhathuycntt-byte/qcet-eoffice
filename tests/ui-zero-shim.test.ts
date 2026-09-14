import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { RoleSwitcherPill } from "../src/components/auth/role-switcher-pill";
import { getViewpointText } from "../src/components/auth/role-viewpoint-banner";
import { AuthUser } from "../src/types/auth";

describe("UI Zero-Shim Contract & Elimination of Mock Switchers", () => {
  describe("1. RoleSwitcherPill Decommissioning", () => {
    test("RoleSwitcherPill component executes and strictly returns null", () => {
      const result = RoleSwitcherPill({});
      assert.strictEqual(result, null, "RoleSwitcherPill must strictly return null in standard production UI");
    });
  });

  describe("3. RoleViewpointBanner Informational-Only Invariant", () => {
    test("getViewpointText correctly formats authentic role perspective text", () => {
      const adminUser: AuthUser = {
        id: "u-admin",
        name: "Lê Văn Tường",
        email: "tuonglv@cdktcnqn.edu.vn",
        role: "ADMIN",
        roleLabel: "Ban Giám hiệu",
        department: "Ban Giám hiệu",
        departmentCode: "BGH",
      };
      const managerUser: AuthUser = {
        id: "u-manager",
        name: "Nguyễn Văn Hùng",
        email: "hungnv@cdktcnqn.edu.vn",
        role: "MANAGER",
        roleLabel: "Trưởng đơn vị",
        department: "Phòng Đào tạo",
        departmentCode: "DT",
      };
      const staffUser: AuthUser = {
        id: "u-staff",
        name: "Trần Thị Mai",
        email: "maitt@cdktcnqn.edu.vn",
        role: "STAFF",
        roleLabel: "Chuyên viên",
        department: "Phòng Đào tạo",
        departmentCode: "DT",
      };

      assert.ok(getViewpointText(adminUser).includes("Góc nhìn Ban Giám hiệu"));
      assert.ok(getViewpointText(managerUser).includes("Góc nhìn Lãnh đạo Đơn vị"));
      assert.ok(getViewpointText(managerUser).includes("Nguyễn Văn Hùng"));
      assert.ok(getViewpointText(staffUser).includes("Nhiệm vụ trực tiếp"));
      assert.ok(getViewpointText(staffUser).includes("Trần Thị Mai"));
    });
  });
});
