import { test, describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UnifiedAdaptiveWorkspace } from "../src/components/workspace/unified-adaptive-workspace";
import { AdaptiveMetricStrip } from "../src/components/workspace/components/adaptive-metric-strip";
import { UniversalActionQueue } from "../src/components/workspace/components/universal-action-queue";
import { validateDeliverableSubmission } from "../src/components/portal/submit-deliverable-modal";
import {
  getRoleTourSteps,
  getRoleChecklist,
  getOnboardingStorageKey,
  resolveOnboardingState,
  DEFAULT_ONBOARDING_STATE,
} from "../src/lib/onboarding-constants";
import type { AuthUser } from "../src/types/auth";
import type { SchoolTask } from "../src/types/dashboard";

describe("Workspace Real Data Flow & Authentic State Suite", () => {
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

  describe("1. Zero Mock Fallbacks in Metrics & Queue", () => {
    test("AdaptiveMetricStrip displays strict 0 and 0% when zero metrics passed", () => {
      const zeroMetrics = {
        totalTasks: 0,
        urgentOverdueCount: 0,
        waitingApprovalCount: 0,
        completedRate: 0,
        labelScope: "Toàn trường",
      };

      const html = renderToStaticMarkup(
        React.createElement(AdaptiveMetricStrip, {
          metrics: zeroMetrics,
          scope: "school",
        })
      );

      assert.ok(html.includes("data-slot=\"adaptive-metric-strip\""));
      assert.ok(html.includes(">0<"));
      assert.ok(html.includes(">0%<"));
      // Must not render fake stats like 85% or 100%
      assert.ok(!html.includes("85%"));
    });

    test("UniversalActionQueue displays authentic empty state when queue is empty", () => {
      const emptyQueue = {
        pendingApprovals: [],
        myPendingSubmissions: [],
      };

      const html = renderToStaticMarkup(
        React.createElement(UniversalActionQueue, {
          actionQueue: emptyQueue,
          onSelectTask: () => {},
        })
      );

      assert.ok(html.includes("data-slot=\"universal-action-queue\""));
      assert.ok(html.includes("Không có nhiệm vụ cần xử lý gấp"));
      assert.ok(html.includes("Tất cả công việc đều đúng tiến độ"));
      // Must not render fake tasks or warnings
      assert.ok(!html.includes("Cảnh báo hạn chót khẩn cấp"));
    });
  });

  describe("2. UnifiedAdaptiveWorkspace Authentic State Handling", () => {
    test("renders clean empty state when tasks array is genuinely empty", () => {
      const emptyTasks: SchoolTask[] = [];

      const html = renderToStaticMarkup(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: staffUser,
          tasks: emptyTasks,
          onSelectTask: () => {},
        })
      );

      assert.ok(html.includes("data-slot=\"workspace-empty-state\""));
      assert.ok(
        html.includes("Chưa có nhiệm vụ nào được phân công trong kỳ này")
      );
      assert.ok(!html.includes("fake"));
      assert.ok(!html.includes("dummy"));
    });

    test("renders loading state when initialLoading is true and tasks are empty", () => {
      const emptyTasks: SchoolTask[] = [];

      const html = renderToStaticMarkup(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: managerUser,
          tasks: emptyTasks,
          initialLoading: true,
          onSelectTask: () => {},
        })
      );

      assert.ok(html.includes("data-slot=\"workspace-loading-state\""));
      assert.ok(html.includes("Đang tải dữ liệu nhiệm vụ từ máy chủ QCET..."));
    });

    test("renders offline/error banner when isOffline or errorMessage is present", () => {
      const emptyTasks: SchoolTask[] = [];

      const html = renderToStaticMarkup(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: adminUser,
          tasks: emptyTasks,
          isOffline: true,
          errorMessage: "Mất kết nối máy chủ CSDL",
          onSelectTask: () => {},
          onRefresh: () => {},
        })
      );

      assert.ok(html.includes("data-slot=\"workspace-offline-alert\""));
      assert.ok(html.includes("Mất kết nối máy chủ"));
      assert.ok(html.includes("Mất kết nối máy chủ CSDL"));
      assert.ok(html.includes("Thử lại"));
    });

    test("assigns default scope based on authentic user role", () => {
      const htmlAdmin = renderToStaticMarkup(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: adminUser,
          tasks: [],
          onSelectTask: () => {},
        })
      );
      assert.ok(htmlAdmin.includes("data-active-scope=\"school\""));

      const htmlManager = renderToStaticMarkup(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: managerUser,
          tasks: [],
          onSelectTask: () => {},
        })
      );
      assert.ok(htmlManager.includes("data-active-scope=\"unit\""));

      const htmlStaff = renderToStaticMarkup(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: staffUser,
          tasks: [],
          onSelectTask: () => {},
        })
      );
      assert.ok(htmlStaff.includes("data-active-scope=\"my\""));
    });

    test("staff user renders unified segmented tablist with unit and my scopes", () => {
      const htmlStaff = renderToStaticMarkup(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: staffUser,
          tasks: [],
          onSelectTask: () => {},
        })
      );

      assert.ok(!htmlStaff.includes("data-slot=\"staff-scope-indicator\""));
      assert.ok(htmlStaff.includes("role=\"tablist\""));
      assert.ok(htmlStaff.includes("data-scope=\"unit\""));
      assert.ok(htmlStaff.includes("data-scope=\"my\""));
    });
  });

  describe("3. Real Onboarding Workflows & DB Sync", () => {
    test("getOnboardingStorageKey scopes keys by authentic user id", () => {
      assert.strictEqual(
        getOnboardingStorageKey("usr-12345"),
        "qcet_onboarding_state_usr-12345"
      );
      assert.strictEqual(
        getOnboardingStorageKey(null),
        "qcet_onboarding_state_guest"
      );
    });

    test("resolveOnboardingState prioritizes database onboardedAt", () => {
      const userWithDbOnboarded = {
        id: "usr-done",
        onboardedAt: "2026-09-01T10:00:00Z",
        onboardingData: {
          hasSeenWelcome: true,
          hasCompletedTour: true,
          completedSteps: ["step-profile", "step-push", "step-action"],
          isDismissed: true,
          snoozedUntil: null,
        },
      };

      const resolved = resolveOnboardingState(userWithDbOnboarded, null);
      assert.strictEqual(resolved.hasSeenWelcome, true);
      assert.strictEqual(resolved.hasCompletedTour, true);
      assert.strictEqual(resolved.isDismissed, true);
    });

    test("resolveOnboardingState resets to default when database indicates reset", () => {
      const userReset = {
        id: "usr-fresh",
        onboardedAt: null,
        onboardingData: null,
      };

      const staleStored = {
        hasSeenWelcome: true,
        hasCompletedTour: true,
        completedSteps: ["step-1", "step-2"],
        isDismissed: true,
      };

      const resolved = resolveOnboardingState(userReset, staleStored);
      assert.strictEqual(resolved.hasSeenWelcome, false);
      assert.strictEqual(resolved.hasCompletedTour, false);
      assert.strictEqual(resolved.isDismissed, false);
    });

    test("getRoleTourSteps returns authentic QCET workflows for each role", () => {
      const bghSteps = getRoleTourSteps("ADMIN", "BAN_GIAM_HIEU");
      assert.ok(bghSteps.some((s) => s.id === "bgh-scope"));
      assert.ok(bghSteps.some((s) => s.id === "bgh-radar"));

      const mgrSteps = getRoleTourSteps("MANAGER", "TRUONG_PHONG");
      assert.ok(mgrSteps.some((s) => s.id === "manager-scope"));
      assert.ok(mgrSteps.some((s) => s.id === "manager-assign"));

      const staffSteps = getRoleTourSteps("STAFF", "CHUYEN_VIEN");
      assert.ok(staffSteps.some((s) => s.id === "staff-workspace"));
      assert.ok(staffSteps.some((s) => s.id === "staff-deliverable"));
    });

    test("getRoleChecklist returns official DACUM & administrative milestones", () => {
      const bghChecklist = getRoleChecklist("ADMIN", "BAN_GIAM_HIEU");
      assert.ok(
        bghChecklist.some((item) =>
          item.title.includes("Radar điểm nghẽn đơn vị")
        )
      );

      const mgrChecklist = getRoleChecklist("MANAGER", "TRUONG_PHONG");
      assert.ok(
        mgrChecklist.some((item) =>
          item.title.includes("Phân công hoặc duyệt việc")
        )
      );

      const staffChecklist = getRoleChecklist("STAFF", "CHUYEN_VIEN");
      assert.ok(
        staffChecklist.some((item) =>
          item.title.includes("Nộp minh chứng hoặc tạo tờ trình")
        )
      );
    });
  });
});


/* ===== merged from tests/workspace-real-sync.test.ts ===== */









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


/* ===== merged from tests/workspace-action-queue.test.ts ===== */






describe("Task 5: Workspace Action Queue & DACUM Review", () => {
  it("validateDeliverableSubmission rejects invalid URLs like '#' or 'javascript:'", () => {
    const res1 = validateDeliverableSubmission("Báo cáo", "#");
    assert.equal(res1.isValid, false);
    assert.ok(res1.error?.includes("URL") || res1.error?.includes("giao thức"));

    const res2 = validateDeliverableSubmission("Báo cáo", "javascript:alert(1)");
    assert.equal(res2.isValid, false);
    assert.ok(res2.error?.includes("giao thức http:// hoặc https://"));

    const resFtp = validateDeliverableSubmission("Báo cáo", "ftp://ftp.example.com/file.zip");
    assert.equal(resFtp.isValid, false);
    assert.ok(resFtp.error?.includes("giao thức http:// hoặc https://"));

    const resData = validateDeliverableSubmission("Báo cáo", "data:text/html,test");
    assert.equal(resData.isValid, false);

    const resMalformed = validateDeliverableSubmission("Báo cáo", "random-domain-without-protocol.com");
    assert.equal(resMalformed.isValid, false);

    const res3 = validateDeliverableSubmission("Báo cáo", "https://drive.google.com/file/123");
    assert.equal(res3.isValid, true);
    assert.equal(res3.error, undefined);

    const resHttp = validateDeliverableSubmission("Báo cáo", "http://example.edu.vn/document");
    assert.equal(resHttp.isValid, true);
  });

  it("validateDeliverableSubmission enforces non-empty deliverable title", () => {
    const emptyName = validateDeliverableSubmission("", "https://example.com");
    assert.equal(emptyName.isValid, false);
    assert.ok(emptyName.error?.includes("tên minh chứng"));

    const whitespaceName = validateDeliverableSubmission("   ", "https://example.com");
    assert.equal(whitespaceName.isValid, false);

    const validNoUrl = validateDeliverableSubmission("Báo cáo DACUM kỳ 1");
    assert.equal(validNoUrl.isValid, true);
  });
});
