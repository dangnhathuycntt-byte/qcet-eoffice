import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { AuthContext, type AuthContextType } from "../src/lib/auth-context";
import PortalPage, {
  formatProgressMetric,
  formatSchoolTasksMetric,
  type PortalStatsSummary,
} from "../src/app/portal/page";

const portalPagePath = path.resolve(process.cwd(), "src/app/portal/page.tsx");

function createMockAuthContext(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    user: null,
    switchRole: () => {},
    switchUser: () => {},
    login: async () => ({ success: true }),
    register: async () => ({ success: true }),
    loginWithGoogle: () => ({
      id: "1",
      name: "Test User",
      email: "test@qcet.edu.vn",
      role: "ADMIN",
      roleLabel: "Ban Giám hiệu",
      department: "Ban Giám hiệu",
      departmentCode: "BGH",
    }),
    updateProfile: () => {},
    logout: async () => {},
    isProfileModalOpen: false,
    setIsProfileModalOpen: () => {},
    isLoading: false,
    ...overrides,
  };
}

describe("Task 5: Real Data Binding for /portal & Eradicate CSS Zoom (P0-7 & P1-12)", () => {
  describe("Static / AST Audit of src/app/portal/page.tsx", () => {
    test("file exists and can be loaded", () => {
      assert.ok(fs.existsSync(portalPagePath), "src/app/portal/page.tsx must exist");
    });

    test("asserts document.documentElement.style.zoom is completely eliminated", () => {
      const content = fs.readFileSync(portalPagePath, "utf8");
      assert.equal(
        content.includes("document.documentElement.style.zoom"),
        false,
        "Application UI must not manipulate DOM CSS zoom"
      );
      assert.equal(
        content.includes("qcet_ui_zoom"),
        false,
        "localStorage.getItem('qcet_ui_zoom') must be eradicated from portal page"
      );
    });

    test("asserts PortalZoomToggle component is completely eliminated", () => {
      const content = fs.readFileSync(portalPagePath, "utf8");
      assert.equal(
        content.includes("PortalZoomToggle"),
        false,
        "PortalZoomToggle must be eliminated from /portal"
      );
    });

    test("asserts hardcoded KPI strings are eliminated", () => {
      const content = fs.readFileSync(portalPagePath, "utf8");
      assert.equal(
        content.includes("32% hoàn thành (340 việc)"),
        false,
        "Hardcoded '32% hoàn thành (340 việc)' must not be present"
      );
      assert.equal(
        content.includes("94 việc trọng tâm"),
        false,
        "Hardcoded '94 việc trọng tâm' must not be present"
      );
    });

    test("asserts dynamic fetch and binding to /api/dashboard/overview is present", () => {
      const content = fs.readFileSync(portalPagePath, "utf8");
      assert.ok(
        content.includes("/api/dashboard/overview"),
        "Dynamic fetch to /api/dashboard/overview must be present"
      );
      assert.ok(
        content.includes('credentials: "include"'),
        "Fetch must include session credentials"
      );
    });

    test("asserts Light-Only standard (Tailwind v4 OKLCH tokens, zero dark: classes)", () => {
      const content = fs.readFileSync(portalPagePath, "utf8");
      assert.doesNotMatch(content, /\bdark:/, "Strict Light-Only: no dark: classes allowed");
      assert.doesNotMatch(content, /ThemeProvider/, "No ThemeProvider allowed");
    });

    test("asserts zero decorative emojis in file", () => {
      const content = fs.readFileSync(portalPagePath, "utf8");
      assert.doesNotMatch(
        content,
        /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u,
        "Zero decorative emojis allowed in portal page"
      );
    });

    test("asserts accessible keyboard skip link id='main-content' and navigation links exist", () => {
      const content = fs.readFileSync(portalPagePath, "utf8");
      assert.ok(content.includes('id="main-content"'), "Must preserve id='main-content'");
      assert.ok(content.includes('href="/dashboard"'), "Must provide link to /dashboard");
      assert.ok(content.includes('href="/"'), "Must provide link to /");
      assert.ok(content.includes('href="/calendar"'), "Must provide link to /calendar");
    });
  });

  describe("Metric Formatting Functions Contract", () => {
    test("formatProgressMetric formats dynamically when stats are available", () => {
      const stats: PortalStatsSummary = {
        completionRate: 68,
        total: 150,
        schoolTasks: 45,
      };
      assert.equal(
        formatProgressMetric(stats, false, true),
        "68% hoàn thành (150 việc)"
      );
    });

    test("formatProgressMetric supports zero values without fallback to mock", () => {
      const stats: PortalStatsSummary = {
        completionRate: 0,
        total: 0,
        schoolTasks: 0,
      };
      assert.equal(
        formatProgressMetric(stats, false, true),
        "0% hoàn thành (0 việc)"
      );
    });

    test("formatProgressMetric returns 'Đang tải...' when loading", () => {
      assert.equal(formatProgressMetric(null, true, true), "Đang tải...");
      assert.equal(formatProgressMetric(null, true, false), "Đang tải...");
    });

    test("formatProgressMetric returns 'Đăng nhập để xem' when unauthenticated", () => {
      assert.equal(formatProgressMetric(null, false, false), "Đăng nhập để xem");
    });

    test("formatProgressMetric returns 'Chưa có dữ liệu' on error or missing stats", () => {
      assert.equal(formatProgressMetric(null, false, true), "Chưa có dữ liệu");
    });

    test("formatSchoolTasksMetric formats dynamically when stats are available", () => {
      const stats: PortalStatsSummary = {
        completionRate: 40,
        total: 80,
        schoolTasks: 25,
      };
      assert.equal(
        formatSchoolTasksMetric(stats, false, true),
        "25 việc trọng tâm"
      );
    });

    test("formatSchoolTasksMetric supports zero values without fallback to mock", () => {
      const stats: PortalStatsSummary = {
        completionRate: 0,
        total: 0,
        schoolTasks: 0,
      };
      assert.equal(
        formatSchoolTasksMetric(stats, false, true),
        "0 việc trọng tâm"
      );
    });

    test("formatSchoolTasksMetric returns 'Đang tải...' when loading", () => {
      assert.equal(formatSchoolTasksMetric(null, true, true), "Đang tải...");
      assert.equal(formatSchoolTasksMetric(null, true, false), "Đang tải...");
    });

    test("formatSchoolTasksMetric returns 'Đăng nhập để xem' when unauthenticated", () => {
      assert.equal(formatSchoolTasksMetric(null, false, false), "Đăng nhập để xem");
    });

    test("formatSchoolTasksMetric returns 'Chưa có dữ liệu' on error or missing stats", () => {
      assert.equal(formatSchoolTasksMetric(null, false, true), "Chưa có dữ liệu");
    });
  });

  describe("Render Verification", () => {
    test("renders unauthenticated state with 'Đăng nhập để xem' and zero synthetic numbers", () => {
      const auth = createMockAuthContext({
        user: null,
        isLoading: false,
      });

      const html = renderToString(
        React.createElement(
          AuthContext.Provider,
          { value: auth },
          React.createElement(PortalPage)
        )
      );

      assert.ok(html.includes("Đăng nhập để xem"), "Must display 'Đăng nhập để xem' when unauthenticated");
      assert.equal(
        html.includes("32% hoàn thành (340 việc)"),
        false,
        "Must not render synthetic 32% hoàn thành (340 việc)"
      );
      assert.equal(
        html.includes("94 việc trọng tâm"),
        false,
        "Must not render synthetic 94 việc trọng tâm"
      );
    });

    test("renders loading state with 'Đang tải...' when auth is resolving", () => {
      const auth = createMockAuthContext({
        user: null,
        isLoading: true,
      });

      const html = renderToString(
        React.createElement(
          AuthContext.Provider,
          { value: auth },
          React.createElement(PortalPage)
        )
      );

      assert.ok(html.includes("Đang tải..."), "Must display 'Đang tải...' during loading phase");
    });
  });

  describe("API Response Parser Simulation", () => {
    test("correctly parses live overview payload without falling back to mock numbers", () => {
      const rawApiResponse = {
        source: "database",
        stats: {
          totalTasks: 280,
          completedTasks: 140,
          totalSchoolTasks: 85,
          completionRate: 50,
        },
      };

      const total = rawApiResponse.stats.totalTasks ?? rawApiResponse.stats.totalSchoolTasks ?? 0;
      const completionRate =
        typeof rawApiResponse.stats.completionRate === "number"
          ? rawApiResponse.stats.completionRate
          : total > 0
          ? Math.round(((rawApiResponse.stats.completedTasks ?? 0) / total) * 100)
          : 0;
      const schoolTasks = rawApiResponse.stats.totalSchoolTasks ?? 0;

      const stats: PortalStatsSummary = {
        completionRate,
        total,
        schoolTasks,
      };

      assert.equal(formatProgressMetric(stats, false, true), "50% hoàn thành (280 việc)");
      assert.equal(formatSchoolTasksMetric(stats, false, true), "85 việc trọng tâm");
    });
  });
});
