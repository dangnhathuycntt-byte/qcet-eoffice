import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { RoleSwitcherPill } from "../src/components/auth/role-switcher-pill";
import { getViewpointText } from "../src/components/auth/role-viewpoint-banner";
import { AuthUser } from "../src/types/auth";

describe("UI Zero-Shim Contract & Elimination of Mock Switchers", () => {
  const topbarPath = path.resolve(__dirname, "../src/components/layout/app-topbar.tsx");
  const roleSwitcherPath = path.resolve(__dirname, "../src/components/auth/role-switcher-pill.tsx");
  const roleBannerPath = path.resolve(__dirname, "../src/components/auth/role-viewpoint-banner.tsx");
  const mobileDrawerPath = path.resolve(__dirname, "../src/components/layout/mobile-menu-drawer.tsx");
  const navPath = path.resolve(__dirname, "../src/components/navigation.tsx");
  const loginPagePath = path.resolve(__dirname, "../src/app/login/page.tsx");

  describe("1. RoleSwitcherPill Decommissioning", () => {
    test("RoleSwitcherPill component executes and strictly returns null", () => {
      const result = RoleSwitcherPill({});
      assert.strictEqual(result, null, "RoleSwitcherPill must strictly return null in standard production UI");
    });

    test("role-switcher-pill.tsx source code contains no interactive role-switching DOM elements", () => {
      const content = fs.readFileSync(roleSwitcherPath, "utf-8");
      assert.ok(!content.includes("<button"), "Must not render any button elements");
      assert.ok(!content.includes("switchRole"), "Must not invoke switchRole");
      assert.ok(!content.includes("onClick"), "Must not contain onClick handlers for switching");
    });
  });

  describe("2. AppTopbar Zero-Shim & Authentic User Profile Dropdown", () => {
    test("app-topbar.tsx contains ZERO dev role testing shims or switchers", () => {
      const content = fs.readFileSync(topbarPath, "utf-8");
      assert.ok(!content.includes("Chế độ kiểm thử vai trò"), "Must not contain 'Chế độ kiểm thử vai trò'");
      assert.ok(!content.includes("devRoles"), "Must not contain devRoles array or references");
      assert.ok(!content.includes("FlaskConical"), "Must not import or render FlaskConical icon");
      assert.ok(!content.includes("switchRole"), "Must not contain switchRole calls in topbar");
    });

    test("app-topbar.tsx retains only authentic user profile menu items", () => {
      const content = fs.readFileSync(topbarPath, "utf-8");
      assert.ok(content.includes("Hồ sơ cá nhân"), "Must contain 'Hồ sơ cá nhân' action");
      assert.ok(
        content.includes("Cài đặt ứng dụng di động") || content.includes("Cài đặt App Mobile"),
        "Must contain mobile PWA action"
      );
      assert.ok(
        content.includes("Hướng dẫn sử dụng hệ thống") || content.includes("Hướng dẫn làm quen"),
        "Must contain onboarding guidance action"
      );
      assert.ok(
        content.includes("Đổi tài khoản / Đăng nhập khác") || content.includes("Đổi tài khoản"),
        "Must contain account switch/login link"
      );
      assert.ok(content.includes("Đăng xuất"), "Must contain logout button");
    });

    test("app-topbar.tsx renders authentic user details and verified badge", () => {
      const content = fs.readFileSync(topbarPath, "utf-8");
      assert.ok(content.includes("getInitials(user.name)"), "Must compute user initials");
      assert.ok(content.includes("user.emailVerified"), "Must check emailVerified status");
      assert.ok(content.includes("CheckCircle2"), "Must display verified check icon for verified users");
    });
  });

  describe("3. RoleViewpointBanner Informational-Only Invariant", () => {
    test("role-viewpoint-banner.tsx contains NO interactive role switching buttons", () => {
      const content = fs.readFileSync(roleBannerPath, "utf-8");
      assert.ok(!content.includes("<button"), "Must not contain interactive buttons");
      assert.ok(!content.includes("switchRole"), "Must not contain switchRole logic");
      assert.ok(!content.includes("onClick"), "Must not contain onClick event handlers");
    });

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

  describe("4. MobileDrawer & Navigation Zero-Dev-Shim Invariants", () => {
    test("mobile-menu-drawer.tsx has NO role switching UI or demo accounts", () => {
      const content = fs.readFileSync(mobileDrawerPath, "utf-8");
      assert.ok(!content.includes("Chế độ kiểm thử"), "Must not contain 'Chế độ kiểm thử'");
      assert.ok(!content.includes("CHUYỂN VAI TRÒ TRẢI NGHIỆM"), "Must not contain demo role switch header");
      assert.ok(!content.includes("switchRole"), "Must not contain switchRole calls");
      assert.ok(!content.includes("DEMO_USERS"), "Must not contain DEMO_USERS");
    });

    test("navigation.tsx has NO role testing or mock account selectors", () => {
      const content = fs.readFileSync(navPath, "utf-8");
      assert.ok(!content.includes("Chế độ kiểm thử vai trò"), "Must not contain dev testing header");
      assert.ok(!content.includes("devRoles"), "Must not contain devRoles");
      assert.ok(!content.includes("switchRole"), "Must not contain switchRole");
    });
  });

  describe("5. Login Page Zero-Mock Contract", () => {
    test("login/page.tsx has NO mock 1-click accounts or hardcoded credentials", () => {
      const content = fs.readFileSync(loginPagePath, "utf-8");
      assert.ok(!content.includes("SEED_ACCOUNTS"), "Must not contain SEED_ACCOUNTS");
      assert.ok(!content.includes("Tài khoản mẫu để thử nghiệm"), "Must not contain mock accounts header");
      assert.ok(!content.includes("handleQuickSeedLogin"), "Must not contain quick seed login handler");
      assert.ok(!content.includes("Qcet@2026"), "Must not contain hardcoded demo password");
    });

    test("login/page.tsx cleanly mounts GoogleLoginButton for @cdktcnqn.edu.vn domain", () => {
      const content = fs.readFileSync(loginPagePath, "utf-8");
      assert.ok(content.includes("<GoogleLoginButton"), "Must mount GoogleLoginButton");
      assert.ok(content.includes("@cdktcnqn.edu.vn"), "Must display authentic institutional domain");
    });
  });

  describe("6. Anti-Slop Cleanliness: Zero Decorative Emojis", () => {
    const files = [
      { name: "app-topbar.tsx", path: topbarPath },
      { name: "role-switcher-pill.tsx", path: roleSwitcherPath },
      { name: "role-viewpoint-banner.tsx", path: roleBannerPath },
      { name: "mobile-menu-drawer.tsx", path: mobileDrawerPath },
      { name: "navigation.tsx", path: navPath },
      { name: "login/page.tsx", path: loginPagePath },
    ];

    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    for (const file of files) {
      test(`${file.name} contains zero decorative emojis`, () => {
        const content = fs.readFileSync(file.path, "utf-8");
        const match = content.match(emojiRegex);
        assert.strictEqual(
          match,
          null,
          `Found decorative emoji in ${file.name}: ${match ? match[0] : ""}`
        );
      });
    }
  });
});
