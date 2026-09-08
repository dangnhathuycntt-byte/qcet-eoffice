import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UnifiedAdaptiveWorkspace } from "../src/components/workspace/unified-adaptive-workspace";
import {
  getOnboardingStorageKey,
  resolveOnboardingState,
  DEFAULT_ONBOARDING_STATE,
} from "../src/lib/onboarding-constants";
import type { AuthUser } from "../src/types/auth";
import type { SchoolTask } from "../src/types/dashboard";

describe("Workspace & Onboarding Real Sync Suite", () => {
  const adminUser: AuthUser = {
    id: "usr-admin-real",
    email: "bgh@cdktcnqn.edu.vn",
    name: "TS. Nguyễn Văn A",
    role: "ADMIN",
    dbRole: "BAN_GIAM_HIEU",
    roleLabel: "Ban Giám hiệu",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
  };

  const managerUser: AuthUser = {
    id: "usr-mgr-real",
    email: "truongphong@cdktcnqn.edu.vn",
    name: "ThS. Trần Thị B",
    role: "MANAGER",
    dbRole: "TRUONG_PHONG",
    roleLabel: "Trưởng phòng Đào tạo",
    department: "Phòng Quản lý Đào tạo",
    departmentCode: "P_QLDT",
  };

  const staffUser: AuthUser = {
    id: "usr-staff-real",
    email: "chuyenvien@cdktcnqn.edu.vn",
    name: "Lê Văn C",
    role: "STAFF",
    dbRole: "CHUYEN_VIEN",
    roleLabel: "Chuyên viên Khảo thí",
    department: "Phòng Khảo thí & ĐBCL",
    departmentCode: "P_KTDBCL",
  };

  test("1. Workspace gán default scope dựa trên user thật từ session", () => {
    const htmlAdmin = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: adminUser,
        tasks: [],
        onSelectTask: () => {},
      })
    );
    assert.ok(htmlAdmin.includes("data-active-scope=\"school\""));

    const htmlMgr = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: managerUser,
        tasks: [],
        onSelectTask: () => {},
      })
    );
    assert.ok(htmlMgr.includes("data-active-scope=\"unit\""));

    const htmlStaff = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: staffUser,
        tasks: [],
        onSelectTask: () => {},
      })
    );
    assert.ok(htmlStaff.includes("data-active-scope=\"my\""));
    assert.ok(htmlStaff.includes("role=\"tablist\""));
    assert.ok(!htmlStaff.includes("data-slot=\"staff-scope-indicator\""));
  });

  test("2. Trạng thái onboarding gắn theo ID người dùng thật trong CSDL", () => {
    const keyUser1 = getOnboardingStorageKey("usr-admin-real");
    const keyUser2 = getOnboardingStorageKey("usr-mgr-real");
    assert.notStrictEqual(keyUser1, keyUser2);
    assert.ok(keyUser1.includes("usr-admin-real"));
    assert.ok(keyUser2.includes("usr-mgr-real"));

    const userWithDbData = {
      id: "usr-admin-real",
      onboardedAt: "2026-09-01T08:00:00Z",
      onboardingData: {
        hasSeenWelcome: true,
        hasCompletedTour: true,
        completedSteps: ["step-profile", "step-push", "step-action", "step-search"],
        isDismissed: true,
        snoozedUntil: null,
      },
    };

    const resolved = resolveOnboardingState(userWithDbData, null);
    assert.strictEqual(resolved.hasSeenWelcome, true);
    assert.strictEqual(resolved.hasCompletedTour, true);
    assert.strictEqual(resolved.isDismissed, true);
    assert.strictEqual(resolved.completedSteps.length, 4);
  });

  test("3. Không fallback về mock payload khi API trả về lỗi hoặc rỗng", () => {
    const emptyTasks: SchoolTask[] = [];

    const htmlOffline = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: adminUser,
        tasks: emptyTasks,
        isOffline: true,
        errorMessage: "Lỗi kết nối máy chủ dữ liệu QCET",
        onSelectTask: () => {},
        onRefresh: () => {},
      })
    );

    assert.ok(htmlOffline.includes("data-slot=\"workspace-offline-alert\""));
    assert.ok(htmlOffline.includes("Lỗi kết nối máy chủ dữ liệu QCET"));
    assert.ok(htmlOffline.includes("data-slot=\"workspace-empty-state\""));
    assert.ok(htmlOffline.includes("Chưa có nhiệm vụ nào được phân công trong kỳ này"));
    // Ensure no mock tasks are generated
    assert.ok(!htmlOffline.includes("Đề xuất mở lớp đào tạo cấp chứng chỉ"));
    assert.ok(!htmlOffline.includes("Dự án xây dựng phòng thí nghiệm"));
  });
});
