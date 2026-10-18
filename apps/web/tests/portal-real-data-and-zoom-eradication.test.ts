import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { AuthContext, type AuthContextType } from "../src/lib/auth-context";
import PortalPage from "../src/app/portal/page";
import {
  formatProgressMetric,
  formatSchoolTasksMetric,
  type PortalStatsSummary,
} from "../src/lib/portal-metrics";

function createMockAuthContext(overrides: Partial<AuthContextType> = {}): AuthContextType {
  const base: AuthContextType = {
    user: null,
    isAuthenticated: false,
    isOfflineReadOnly: false,
    authState: { status: "anonymous" },
    canMutate: false,
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
    updateProfile: async () => ({ success: true }),
    logout: async () => {},
    isProfileModalOpen: false,
    setIsProfileModalOpen: () => {},
    isLoading: false,
  };
  return Object.assign(base, overrides);
}

describe("Task 5: Real Data Binding for /portal & Eradicate CSS Zoom (P0-7 & P1-12)", () => {
  describe("Metric Formatting Functions Contract", () => {
    test("formatProgressMetric formats dynamically when stats are available", () => {
      const stats: PortalStatsSummary = {
        completionRate: 68,
        parentTaskTotal: 150,
        schoolTasks: 45,
        isDenominatorSeparated: true,
      };
      assert.equal(
        formatProgressMetric(stats, false, true),
        "68% hoàn thành (150 việc gốc)"
      );
    });

    test("formatProgressMetric supports zero values without fallback to mock", () => {
      const stats: PortalStatsSummary = {
        completionRate: 0,
        parentTaskTotal: 0,
        schoolTasks: 0,
        isDenominatorSeparated: true,
      };
      assert.equal(
        formatProgressMetric(stats, false, true),
        "0% hoàn thành (0 việc gốc)"
      );
    });

    test("formatProgressMetric returns null when loading so the caller renders a skeleton", () => {
      assert.equal(formatProgressMetric(null, true, true), null);
      assert.equal(formatProgressMetric(null, true, false), null);
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
        parentTaskTotal: 80,
        schoolTasks: 25,
        isDenominatorSeparated: true,
      };
      assert.equal(
        formatSchoolTasksMetric(stats, false, true),
        "25 việc trọng tâm"
      );
    });

    test("formatSchoolTasksMetric supports zero values without fallback to mock", () => {
      const stats: PortalStatsSummary = {
        completionRate: 0,
        parentTaskTotal: 0,
        schoolTasks: 0,
        isDenominatorSeparated: true,
      };
      assert.equal(
        formatSchoolTasksMetric(stats, false, true),
        "0 việc trọng tâm"
      );
    });

    test("formatSchoolTasksMetric returns null when loading so the caller renders a skeleton", () => {
      assert.equal(formatSchoolTasksMetric(null, true, true), null);
      assert.equal(formatSchoolTasksMetric(null, true, false), null);
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
        html.includes("32% hoàn thành (340 việc gốc)"),
        false,
        "Must not render synthetic 32% hoàn thành (340 việc gốc)"
      );
      assert.equal(
        html.includes("94 việc trọng tâm"),
        false,
        "Must not render synthetic 94 việc trọng tâm"
      );
    });

    test("renders a skeleton, not 'Đang tải...' prose, when auth is resolving", () => {
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

      assert.equal(
        html.includes("Đang tải..."),
        false,
        "Must not render 'Đang tải...' prose in the metric slot during loading"
      );
      assert.ok(
        html.includes("animate-pulse"),
        "Must render a skeleton placeholder during the loading phase"
      );
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
        parentTaskTotal: total,
        schoolTasks,
        isDenominatorSeparated: true,
      };

      assert.equal(formatProgressMetric(stats, false, true), "50% hoàn thành (280 việc gốc)");
      assert.equal(formatSchoolTasksMetric(stats, false, true), "85 việc trọng tâm");
    });
  });
});
