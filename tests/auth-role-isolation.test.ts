import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  resolveRoleFlags,
  normalizeUserRole,
  useAuthRole,
  type AuthRoleFlags,
} from "../src/hooks/use-auth-role";
import { AuthProvider } from "../src/lib/auth-context";
import type { AuthUser } from "../src/types/auth";

describe("Task 9: Lightweight Role Flag Resolution Hook & Isolation", () => {
  const mockAdminUser: AuthUser = {
    id: "usr-admin-01",
    name: "TS. Nguyễn Ngọc Vinh",
    email: "vinh.nn@qcet.edu.vn",
    role: "ADMIN",
    roleLabel: "Ban Giám hiệu",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
  };

  const mockManagerUser: AuthUser = {
    id: "usr-manager-01",
    name: "ThS. Trần Văn Nam",
    email: "nam.tv@qcet.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng phòng Đào tạo",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAOTAO",
  };

  const mockStaffUser: AuthUser = {
    id: "usr-staff-01",
    name: "CN. Lê Thị Mai",
    email: "mai.lt@qcet.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên",
    department: "Khoa CNTT",
    departmentCode: "CNTT",
  };

  describe("1. resolveRoleFlags pure resolver logic", () => {
    test("resolves ADMIN / BGH role flags accurately", () => {
      const flags = resolveRoleFlags(mockAdminUser);
      assert.strictEqual(flags.role, "ADMIN");
      assert.strictEqual(flags.rawRole, "ADMIN");
      assert.strictEqual(flags.isAdmin, true);
      assert.strictEqual(flags.isBGH, true);
      assert.strictEqual(flags.isExecutive, true);
      assert.strictEqual(flags.isDepartmentHead, false);
      assert.strictEqual(flags.isManager, false);
      assert.strictEqual(flags.isLeader, false);
      assert.strictEqual(flags.isLecturer, false);
      assert.strictEqual(flags.isStaff, false);
      assert.strictEqual(flags.isReady, true);
      assert.strictEqual(flags.user, mockAdminUser);
    });

    test("resolves ADMIN with dbRole alias (e.g. BGH, BAN_GIAM_HIEU)", () => {
      const bghUser: AuthUser = {
        ...mockAdminUser,
        dbRole: "BGH",
      };
      const flags = resolveRoleFlags(bghUser);
      assert.strictEqual(flags.role, "ADMIN");
      assert.strictEqual(flags.rawRole, "BGH");
      assert.strictEqual(flags.isAdmin, true);
      assert.strictEqual(flags.isBGH, true);
      assert.strictEqual(flags.isExecutive, true);
    });

    test("resolves MANAGER / DepartmentHead / Leader role flags accurately", () => {
      const flags = resolveRoleFlags(mockManagerUser);
      assert.strictEqual(flags.role, "MANAGER");
      assert.strictEqual(flags.rawRole, "MANAGER");
      assert.strictEqual(flags.isAdmin, false);
      assert.strictEqual(flags.isBGH, false);
      assert.strictEqual(flags.isExecutive, false);
      assert.strictEqual(flags.isDepartmentHead, true);
      assert.strictEqual(flags.isManager, true);
      assert.strictEqual(flags.isLeader, true);
      assert.strictEqual(flags.isLecturer, false);
      assert.strictEqual(flags.isStaff, false);
      assert.strictEqual(flags.isReady, true);
      assert.strictEqual(flags.user, mockManagerUser);
    });

    test("resolves MANAGER with aliases (TRUONG_PHONG, DEPARTMENT_HEAD)", () => {
      const deptHeadUser: AuthUser = {
        ...mockManagerUser,
        dbRole: "TRUONG_PHONG",
      };
      const flags = resolveRoleFlags(deptHeadUser);
      assert.strictEqual(flags.role, "MANAGER");
      assert.strictEqual(flags.rawRole, "TRUONG_PHONG");
      assert.strictEqual(flags.isDepartmentHead, true);
      assert.strictEqual(flags.isManager, true);
      assert.strictEqual(flags.isLeader, true);
      assert.strictEqual(flags.isAdmin, false);
    });

    test("resolves STAFF / Lecturer role flags accurately", () => {
      const flags = resolveRoleFlags(mockStaffUser);
      assert.strictEqual(flags.role, "STAFF");
      assert.strictEqual(flags.rawRole, "STAFF");
      assert.strictEqual(flags.isAdmin, false);
      assert.strictEqual(flags.isBGH, false);
      assert.strictEqual(flags.isExecutive, false);
      assert.strictEqual(flags.isDepartmentHead, false);
      assert.strictEqual(flags.isManager, false);
      assert.strictEqual(flags.isLeader, false);
      assert.strictEqual(flags.isLecturer, true);
      assert.strictEqual(flags.isStaff, true);
      assert.strictEqual(flags.isReady, true);
      assert.strictEqual(flags.user, mockStaffUser);
    });

    test("resolves STAFF with aliases (GIANG_VIEN, LECTURER)", () => {
      const lecturerUser: AuthUser = {
        ...mockStaffUser,
        dbRole: "GIANG_VIEN",
      };
      const flags = resolveRoleFlags(lecturerUser);
      assert.strictEqual(flags.role, "STAFF");
      assert.strictEqual(flags.rawRole, "GIANG_VIEN");
      assert.strictEqual(flags.isLecturer, true);
      assert.strictEqual(flags.isStaff, true);
      assert.strictEqual(flags.isAdmin, false);
      assert.strictEqual(flags.isManager, false);
    });

    test("resolves unauthenticated / guest user (null) safely with non-privileged flags", () => {
      const flags = resolveRoleFlags(null);
      assert.strictEqual(flags.role, null);
      assert.strictEqual(flags.rawRole, null);
      assert.strictEqual(flags.user, null);
      assert.strictEqual(flags.isAdmin, false);
      assert.strictEqual(flags.isBGH, false);
      assert.strictEqual(flags.isExecutive, false);
      assert.strictEqual(flags.isDepartmentHead, false);
      assert.strictEqual(flags.isManager, false);
      assert.strictEqual(flags.isLeader, false);
      assert.strictEqual(flags.isLecturer, false);
      assert.strictEqual(flags.isStaff, false);
      assert.strictEqual(flags.isReady, true);
    });

    test("correctly reflects isLoading state via isReady", () => {
      const loadingFlags = resolveRoleFlags(mockAdminUser, true);
      assert.strictEqual(loadingFlags.isReady, false);
      assert.strictEqual(loadingFlags.isAdmin, true);

      const readyFlags = resolveRoleFlags(mockAdminUser, false);
      assert.strictEqual(readyFlags.isReady, true);
      assert.strictEqual(readyFlags.isAdmin, true);

      const nullLoading = resolveRoleFlags(null, true);
      assert.strictEqual(nullLoading.isReady, false);
      assert.strictEqual(nullLoading.user, null);

      const nullReady = resolveRoleFlags(null, false);
      assert.strictEqual(nullReady.isReady, true);
      assert.strictEqual(nullReady.user, null);
    });

    test("normalizeUserRole helper covers case insensitivity and common aliases", () => {
      assert.strictEqual(normalizeUserRole("admin"), "ADMIN");
      assert.strictEqual(normalizeUserRole("bgh"), "ADMIN");
      assert.strictEqual(normalizeUserRole("HIEU_TRUONG"), "ADMIN");
      assert.strictEqual(normalizeUserRole("manager"), "MANAGER");
      assert.strictEqual(normalizeUserRole("truong_phong"), "MANAGER");
      assert.strictEqual(normalizeUserRole("staff"), "STAFF");
      assert.strictEqual(normalizeUserRole("giang_vien"), "STAFF");
      assert.strictEqual(normalizeUserRole("unknown_role"), null);
      assert.strictEqual(normalizeUserRole(null), null);
      assert.strictEqual(normalizeUserRole(undefined), null);
    });
  });

  describe("2. useAuthRole React rendering harness", () => {
    test("gracefully renders outside AuthProvider without throwing errors", () => {
      let capturedFlags: AuthRoleFlags | null = null;

      function FallbackConsumer() {
        capturedFlags = useAuthRole();
        return React.createElement(
          "div",
          { "data-testid": "fallback" },
          `Ready: ${String(capturedFlags.isReady)}, Role: ${String(capturedFlags.role)}`
        );
      }

      assert.doesNotThrow(() => {
        const html = renderToStaticMarkup(React.createElement(FallbackConsumer));
        assert.ok(html.includes("data-testid=\"fallback\""));
      });

      assert.ok(capturedFlags !== null, "Flags must be captured");
      assert.strictEqual((capturedFlags as AuthRoleFlags).role, null);
      assert.strictEqual((capturedFlags as AuthRoleFlags).rawRole, null);
      assert.strictEqual((capturedFlags as AuthRoleFlags).user, null);
      assert.strictEqual((capturedFlags as AuthRoleFlags).isAdmin, false);
      assert.strictEqual((capturedFlags as AuthRoleFlags).isBGH, false);
      assert.strictEqual((capturedFlags as AuthRoleFlags).isExecutive, false);
      assert.strictEqual((capturedFlags as AuthRoleFlags).isDepartmentHead, false);
      assert.strictEqual((capturedFlags as AuthRoleFlags).isManager, false);
      assert.strictEqual((capturedFlags as AuthRoleFlags).isLeader, false);
      assert.strictEqual((capturedFlags as AuthRoleFlags).isLecturer, false);
      assert.strictEqual((capturedFlags as AuthRoleFlags).isStaff, false);
    });

    test("renders cleanly inside AuthProvider", () => {
      let capturedFlags: AuthRoleFlags | null = null;

      function AuthConsumer() {
        capturedFlags = useAuthRole();
        return React.createElement(
          "div",
          { "data-testid": "auth-consumer" },
          `Ready: ${String(capturedFlags.isReady)}`
        );
      }

      assert.doesNotThrow(() => {
        const html = renderToStaticMarkup(
          React.createElement(AuthProvider, null, React.createElement(AuthConsumer))
        );
        assert.ok(html.includes("data-testid=\"auth-consumer\""));
      });

      assert.ok(capturedFlags !== null, "Flags must be captured inside AuthProvider");
      assert.strictEqual((capturedFlags as AuthRoleFlags).role, null);
      assert.strictEqual((capturedFlags as AuthRoleFlags).user, null);
      // In static SSR rendering before client useEffect hydration, AuthProvider initializes with isLoading: true
      assert.strictEqual((capturedFlags as AuthRoleFlags).isReady, false);
    });
  });

});
