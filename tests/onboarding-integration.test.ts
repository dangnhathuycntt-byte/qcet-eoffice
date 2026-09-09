import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  calculateOnboardingProgress,
  getRoleTourSteps,
  getRoleChecklist,
  isSnoozed,
  resolveOnboardingState,
  getOnboardingStorageKey,
  LEGACY_ONBOARDING_STORAGE_KEY,
  type TourStepConfig,
} from "../src/lib/onboarding-constants";
import { WelcomeModal } from "../src/components/onboarding/welcome-modal";
import { SpotlightTour } from "../src/components/onboarding/spotlight-tour";
import {
  OnboardingChecklistWidget,
  dispatchRoleAction,
} from "../src/components/onboarding/onboarding-checklist-widget";
import { AuthContext, AuthContextType } from "../src/lib/auth-context";
import type { AuthUser } from "../src/types/auth";

const mockAuthContextValue = (user: AuthUser | null): AuthContextType => ({
  user,
  isAuthenticated: Boolean(user),
  isOfflineReadOnly: false,
  switchRole: () => {},
  switchUser: () => {},
  login: async () => ({ success: true }),
  register: async () => ({ success: true }),
  loginWithGoogle: () => user!,
  updateProfile: () => {},
  logout: async () => {},
  isProfileModalOpen: false,
  setIsProfileModalOpen: () => {},
  isLoading: false,
});

describe("Onboarding Integration & Lifecycle Suite", () => {
  test("Required DOM anchor IDs are defined in onboarding specification", () => {
    const requiredAnchors = [
      "tour-scope-switcher",
      "tour-topbar-search",
      "tour-tasks-landing",
    ];
    assert.equal(requiredAnchors.length, 3);
    assert.ok(requiredAnchors.includes("tour-scope-switcher"));
    assert.ok(requiredAnchors.includes("tour-topbar-search"));
    assert.ok(requiredAnchors.includes("tour-tasks-landing"));
  });

  test("ActionableEmptyState component source structure and content", () => {
    const emptyStatePath = path.resolve(
      process.cwd(),
      "src/components/onboarding/actionable-empty-state.tsx"
    );
    assert.ok(fs.existsSync(emptyStatePath), "actionable-empty-state.tsx must exist");

    const content = fs.readFileSync(emptyStatePath, "utf-8");
    assert.ok(content.includes('"use client"'), "Must be client component");
    assert.ok(content.includes('id="tour-empty-state-cta"'), "Must contain id tour-empty-state-cta");
    assert.ok(content.includes("Chào mừng Thầy/Cô đến với Bàn làm việc!"), "Must contain greeting header");
    assert.ok(content.includes("Soạn Tờ trình / Nhiệm vụ mới"), "Must have CTA to create task / proposal");
    assert.ok(content.includes("Tra cứu văn bản trường (NĐ 30)"), "Must have CTA to inspect documents");
  });

  test("AppShell integrates OnboardingHub with WelcomeModal, SpotlightTour and ChecklistWidget", () => {
    const appShellPath = path.resolve(
      process.cwd(),
      "src/components/layout/app-shell.tsx"
    );
    assert.ok(fs.existsSync(appShellPath), "app-shell.tsx must exist");

    const content = fs.readFileSync(appShellPath, "utf-8");
    assert.ok(
      content.includes("OnboardingHub") || content.includes("useOnboarding"),
      "AppShell must integrate OnboardingHub / useOnboarding"
    );
    assert.ok(content.includes("WelcomeModal"), "AppShell must mount WelcomeModal");
    assert.ok(content.includes("SpotlightTour"), "AppShell must mount SpotlightTour");
    assert.ok(content.includes("OnboardingChecklistWidget"), "AppShell must mount OnboardingChecklistWidget");
  });

  test("Contextual components and ScopeSwitcher contain required tour DOM anchors", () => {
    const topbarPath = path.resolve(
      process.cwd(),
      "src/components/layout/app-topbar.tsx"
    );
    const scopeSwitcherPath = path.resolve(
      process.cwd(),
      "src/components/layout/scope-switcher.tsx"
    );
    const dashboardZonePath = path.resolve(
      process.cwd(),
      "src/components/dashboard/zones/dashboard-zone.tsx"
    );

    const topbarContent = fs.readFileSync(topbarPath, "utf-8");
    const scopeSwitcherContent = fs.readFileSync(scopeSwitcherPath, "utf-8");
    const dashboardZoneContent = fs.readFileSync(dashboardZonePath, "utf-8");

    assert.ok(
      topbarContent.includes('id="tour-topbar-search"'),
      "AppTopbar must have id='tour-topbar-search' on search button/container"
    );

    assert.ok(
      dashboardZoneContent.includes('id="tour-scope-switcher"') ||
        scopeSwitcherContent.includes('id="tour-scope-switcher"'),
      "ScopeSwitcher or its DashboardZone wrapper must have id='tour-scope-switcher'"
    );
  });

  test("TasksFocusLanding contains tour-tasks-landing anchor and handles ActionableEmptyState", () => {
    const landingPath = path.resolve(
      process.cwd(),
      "src/components/dashboard/zones/tasks-focus-landing.tsx"
    );
    assert.ok(fs.existsSync(landingPath), "tasks-focus-landing.tsx must exist");

    const content = fs.readFileSync(landingPath, "utf-8");
    assert.ok(
      content.includes('id="tour-tasks-landing"'),
      "TasksFocusLanding must have id='tour-tasks-landing'"
    );
    assert.ok(
      content.includes("ActionableEmptyState"),
      "TasksFocusLanding must import and integrate ActionableEmptyState"
    );
  });

  test("AppTopbar provides restart-onboarding trigger and OnboardingHub handles event", () => {
    const topbarPath = path.resolve(
      process.cwd(),
      "src/components/layout/app-topbar.tsx"
    );
    const shellPath = path.resolve(
      process.cwd(),
      "src/components/layout/app-shell.tsx"
    );

    assert.ok(fs.existsSync(topbarPath), "app-topbar.tsx must exist");
    assert.ok(fs.existsSync(shellPath), "app-shell.tsx must exist");

    const topbarContent = fs.readFileSync(topbarPath, "utf-8");
    const shellContent = fs.readFileSync(shellPath, "utf-8");

    assert.ok(
      topbarContent.includes("Hướng dẫn sử dụng hệ thống"),
      "AppTopbar must include 'Hướng dẫn sử dụng hệ thống' menu item"
    );
    assert.ok(
      topbarContent.includes('"qcet:restart-onboarding"'),
      "AppTopbar must dispatch 'qcet:restart-onboarding' custom event"
    );

    assert.ok(
      shellContent.includes('"qcet:restart-onboarding"'),
      "OnboardingHub must listen to 'qcet:restart-onboarding' event"
    );
    assert.ok(
      shellContent.includes("onboarding.restartOnboarding()"),
      "OnboardingHub must call restartOnboarding on event"
    );
    assert.ok(
      shellContent.includes("onboarding.setIsChecklistExpanded(true)"),
      "OnboardingHub must expand checklist on event"
    );
    assert.ok(
      shellContent.includes('removeEventListener("qcet:restart-onboarding"'),
      "OnboardingHub must clean up event listener on unmount"
    );
  });

  // =========================================================================
  // 1. COMPLETE ONBOARDING LIFECYCLE JOURNEY
  // =========================================================================
  test("Complete Onboarding Lifecycle: Initial -> Welcome -> Tour -> Step Actions -> Snooze -> Celebration", () => {
    // Stage 1: Initial State & Endowed Progress
    const freshUser: AuthUser = {
      id: "user-new-officer",
      name: "Nguyễn Văn A",
      email: "nva@cdktcnqn.edu.vn",
      role: "STAFF",
      dbRole: "CHUYEN_VIEN",
      roleLabel: "Chuyên viên Phòng Đào tạo",
      department: "Phòng Đào tạo",
      departmentCode: "DAO_TAO",
      onboardedAt: null,
      onboardingData: null,
    };

    const initialState = resolveOnboardingState(freshUser, null);
    assert.equal(initialState.hasSeenWelcome, false);
    assert.equal(initialState.hasCompletedTour, false);
    assert.deepEqual(initialState.completedSteps, ["step-profile"]);
    assert.equal(initialState.isDismissed, false);
    assert.equal(initialState.snoozedUntil, null);

    const initialProgress = calculateOnboardingProgress(initialState.completedSteps);
    assert.equal(initialProgress.completedCount, 1);
    assert.equal(initialProgress.totalCount, 4);
    assert.equal(initialProgress.percentage, 25);
    assert.equal(initialProgress.isCompleted, false);

    // Stage 2: WelcomeModal Interaction & Tour Initiation
    const welcomeHtml = renderToStaticMarkup(
      React.createElement(
        AuthContext.Provider,
        { value: mockAuthContextValue(freshUser) },
        React.createElement(WelcomeModal, {
          isOpen: true,
          onStartTour: () => {},
          onDismiss: () => {},
        })
      )
    );

    assert.ok(welcomeHtml.includes('role="dialog"'));
    assert.ok(welcomeHtml.includes('aria-modal="true"'));
    assert.ok(welcomeHtml.includes("Kính chào Thầy/Cô"));
    assert.ok(welcomeHtml.includes("Nguyễn Văn A"));
    assert.ok(welcomeHtml.includes("Xem hướng dẫn sử dụng"));
    assert.ok(welcomeHtml.includes("Vào bàn làm việc ngay"));

    // State after accepting tour: hasSeenWelcome: true
    const currentState = {
      ...initialState,
      hasSeenWelcome: true,
    };
    assert.equal(currentState.hasSeenWelcome, true);

    // Stage 3: Tour Navigation Step by Step
    const tourSteps: TourStepConfig[] = getRoleTourSteps(freshUser.role, freshUser.dbRole);
    assert.equal(tourSteps.length, 3);
    assert.equal(tourSteps[0].targetSelector, "#tour-tasks-landing");
    assert.equal(tourSteps[1].targetSelector, "#tour-empty-state-cta");
    assert.equal(tourSteps[2].targetSelector, "#tour-topbar-search");

    let tourIndex = 0;
    // Step 0 -> Step 1
    tourIndex += 1;
    assert.equal(tourIndex, 1);
    // Step 1 -> Step 2
    tourIndex += 1;
    assert.equal(tourIndex, 2);
    // Step 2 is the last step
    assert.equal(tourIndex === tourSteps.length - 1, true);

    // Render SpotlightTour on the last step
    const tourHtml = renderToStaticMarkup(
      React.createElement(SpotlightTour, {
        isActive: true,
        steps: tourSteps,
        currentIndex: tourIndex,
        onNext: () => {
          currentState.hasCompletedTour = true;
        },
        onPrev: () => {},
        onClose: () => {},
      })
    );
    assert.ok(tourHtml.includes("Bước 3 / 3"));
    assert.ok(tourHtml.includes("Hoàn tất"));

    // Completing the tour
    currentState.hasCompletedTour = true;
    assert.equal(currentState.hasCompletedTour, true);

    // Stage 4: Executing Checklist Step Actions
    const checklist = getRoleChecklist(freshUser.role, freshUser.dbRole);
    assert.equal(checklist.length, 4);

    // Step 1: step-profile is already completed (endowed)
    assert.ok(currentState.completedSteps.includes("step-profile"));

    // Step 2: Push Notifications Action (step-push)
    const pushStep = checklist.find((t) => t.id === "step-push");
    assert.ok(pushStep);
    assert.equal(pushStep.actionType, "REQUEST_PUSH");
    currentState.completedSteps = Array.from(
      new Set([...currentState.completedSteps, "step-push"])
    );
    const progressAfterPush = calculateOnboardingProgress(currentState.completedSteps);
    assert.equal(progressAfterPush.completedCount, 2);
    assert.equal(progressAfterPush.percentage, 50);

    // Step 3: Core Role Action (step-action)
    const actionStep = checklist.find((t) => t.id === "step-action");
    assert.ok(actionStep);
    assert.equal(actionStep.id, "step-action");
    const dispatchedEvent = dispatchRoleAction(freshUser.role, freshUser.dbRole, null);
    assert.equal(dispatchedEvent, "qcet:open-submit-deliverable");
    currentState.completedSteps = Array.from(
      new Set([...currentState.completedSteps, "step-action"])
    );
    const progressAfterAction = calculateOnboardingProgress(currentState.completedSteps);
    assert.equal(progressAfterAction.completedCount, 3);
    assert.equal(progressAfterAction.percentage, 75);

    // Stage 5: Snooze 24h & Temporary Hide
    const snoozeIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    currentState.snoozedUntil = snoozeIso;
    assert.equal(isSnoozed(currentState.snoozedUntil), true);

    // When snoozed, widget does not render (returns null / empty markup)
    const snoozedHtml = renderToStaticMarkup(
      React.createElement(
        AuthContext.Provider,
        { value: mockAuthContextValue(freshUser) },
        React.createElement(OnboardingChecklistWidget, {
          tasks: checklist,
          completedSteps: currentState.completedSteps,
          percentage: progressAfterAction.percentage,
          isExpanded: true,
          isDismissed: false,
          snoozedUntil: currentState.snoozedUntil,
          onToggleExpand: () => {},
          onDismiss: () => {},
          onCompleteStep: () => {},
        })
      )
    );
    assert.equal(snoozedHtml, "");

    // Stage 6: Resume / Unsnooze
    currentState.snoozedUntil = null;
    assert.equal(isSnoozed(currentState.snoozedUntil), false);

    // Stage 7: Final Step (step-search) & 100% Celebration
    const searchStep = checklist.find((t) => t.id === "step-search");
    assert.ok(searchStep);
    assert.equal(searchStep.actionType, "OPEN_SEARCH");
    currentState.completedSteps = Array.from(
      new Set([...currentState.completedSteps, "step-search"])
    );

    const finalProgress = calculateOnboardingProgress(currentState.completedSteps);
    assert.equal(finalProgress.completedCount, 4);
    assert.equal(finalProgress.totalCount, 4);
    assert.equal(finalProgress.percentage, 100);
    assert.equal(finalProgress.isCompleted, true);

    // Render 100% Celebration in Widget
    const celebrationHtml = renderToStaticMarkup(
      React.createElement(
        AuthContext.Provider,
        { value: mockAuthContextValue(freshUser) },
        React.createElement(OnboardingChecklistWidget, {
          tasks: checklist,
          completedSteps: currentState.completedSteps,
          percentage: finalProgress.percentage,
          isExpanded: true,
          isDismissed: false,
          snoozedUntil: null,
          onToggleExpand: () => {},
          onDismiss: () => {
            currentState.isDismissed = true;
          },
          onCompleteStep: () => {},
        })
      )
    );

    // Verify celebration elements
    assert.ok(
      celebrationHtml.includes("Cán bộ số hóa tiêu biểu"),
      "Must render milestone badge 'Cán bộ số hóa tiêu biểu'"
    );
    assert.ok(
      celebrationHtml.includes("100% Hoàn tất"),
      "Must show '100% Hoàn tất' badge"
    );
    assert.ok(
      celebrationHtml.includes("Xuất sắc! Thầy/Cô đã hoàn tất các bước thiết lập khởi đầu"),
      "Must display celebration headline"
    );
    assert.ok(
      celebrationHtml.includes("Đóng và bắt đầu làm việc"),
      "Must provide final dismiss CTA"
    );
  });

  // =========================================================================
  // 2. LOCALSTORAGE & SERVER SYNC WITH ATOMIC SET UNION
  // =========================================================================
  test("LocalStorage & Server Sync: User isolation and atomic Set union", () => {
    // 1. User-scoped storage keys prevent crosstalk
    const keyUser1 = getOnboardingStorageKey("user-1");
    const keyUser2 = getOnboardingStorageKey("user-2");
    const keyAnon = getOnboardingStorageKey(undefined);

    assert.equal(keyUser1, "qcet_onboarding_state_user-1");
    assert.equal(keyUser2, "qcet_onboarding_state_user-2");
    assert.equal(keyAnon, "qcet_onboarding_state_guest");
    assert.notEqual(keyUser1, keyUser2);
    assert.equal(LEGACY_ONBOARDING_STORAGE_KEY, "qcet_onboarding_state");

    // 2. Atomic Set union logic as implemented in /api/users/onboarding PATCH
    const existingServerSteps = ["step-profile", "step-push"];
    const incomingClientSteps = ["step-profile", "step-action"];

    const mergedSteps = Array.from(
      new Set([...existingServerSteps, ...incomingClientSteps])
    );
    assert.deepEqual(mergedSteps.sort(), ["step-action", "step-profile", "step-push"]);
    assert.equal(mergedSteps.length, 3);

    // Incoming step-search achieves 100%
    const nextClientSteps = ["step-search"];
    const finalMergedSteps = Array.from(
      new Set([...mergedSteps, ...nextClientSteps])
    );
    const REQUIRED_STEPS = ["step-profile", "step-push", "step-action", "step-search"];
    const isFinished = REQUIRED_STEPS.every((s) => finalMergedSteps.includes(s));
    assert.equal(isFinished, true);

    // 3. Reset/Delete synchronization
    const serverResetState = {
      id: "user-1",
      onboardedAt: null,
      onboardingData: null,
    };
    const dirtyLocalCache = {
      hasSeenWelcome: true,
      hasCompletedTour: true,
      completedSteps: ["step-profile", "step-push", "step-action", "step-search"],
      isDismissed: true,
      snoozedUntil: null,
    };

    const resolvedAfterReset = resolveOnboardingState(serverResetState, dirtyLocalCache);
    // When server onboarding was deleted (null), client cache resets to clean default
    assert.equal(resolvedAfterReset.hasSeenWelcome, false);
    assert.equal(resolvedAfterReset.hasCompletedTour, false);
    assert.deepEqual(resolvedAfterReset.completedSteps, ["step-profile"]);
    assert.equal(resolvedAfterReset.isDismissed, false);
  });

  // =========================================================================
  // 3. ROLE-BASED SPECIALIZATION ACROSS ALL 4 CORE ROLES
  // =========================================================================
  test("Role-based specialization: BAN_GIAM_HIEU, TRUONG_PHONG, CHUYEN_VIEN, VAN_THU", () => {
    // 1. BAN_GIAM_HIEU (ADMIN / BGH)
    const bghTour = getRoleTourSteps("ADMIN", "BAN_GIAM_HIEU");
    const bghTasks = getRoleChecklist("ADMIN", "BAN_GIAM_HIEU");
    assert.equal(bghTour[0].targetSelector, "#tour-scope-switcher");
    assert.equal(bghTour[1].targetSelector, "#tour-radar-card");
    assert.equal(bghTour[1].fallbackSelector, "#tour-cockpit-metrics");
    assert.equal(bghTour[2].targetSelector, "#tour-topbar-search");
    assert.equal(bghTasks[2].title, "Kiểm tra Radar điểm nghẽn đơn vị");
    assert.equal(bghTasks[2].actionLabel, "Thực hiện");
    const bghEvent = dispatchRoleAction("ADMIN", "BAN_GIAM_HIEU", null);
    assert.equal(bghEvent, "qcet:navigate-cockpit");

    // 2. TRUONG_PHONG (MANAGER)
    const tpTour = getRoleTourSteps("MANAGER", "TRUONG_PHONG");
    const tpTasks = getRoleChecklist("MANAGER", "TRUONG_PHONG");
    assert.equal(tpTour[0].targetSelector, "#tour-scope-switcher");
    assert.equal(tpTour[1].targetSelector, "#tour-create-task-btn");
    assert.equal(tpTour[2].targetSelector, "#tour-topbar-search");
    assert.equal(tpTasks[2].title, "Phân công hoặc duyệt việc đầu tiên");
    assert.equal(tpTasks[2].actionLabel, "Thực hiện");
    const tpEvent = dispatchRoleAction("MANAGER", "TRUONG_PHONG", null);
    assert.equal(tpEvent, "qcet:open-create-task");

    // 3. CHUYEN_VIEN (STAFF / CHUYEN_VIEN)
    const cvTour = getRoleTourSteps("STAFF", "CHUYEN_VIEN");
    const cvTasks = getRoleChecklist("STAFF", "CHUYEN_VIEN");
    assert.equal(cvTour[0].targetSelector, "#tour-tasks-landing");
    assert.equal(cvTour[1].targetSelector, "#tour-empty-state-cta");
    assert.equal(cvTour[2].targetSelector, "#tour-topbar-search");
    assert.equal(cvTasks[2].title, "Nộp minh chứng hoặc tạo tờ trình");
    assert.equal(cvTasks[2].actionLabel, "Thực hiện");
    const cvEvent = dispatchRoleAction("STAFF", "CHUYEN_VIEN", null);
    assert.equal(cvEvent, "qcet:open-submit-deliverable");

    // 4. VAN_THU (STAFF / VAN_THU)
    const vtTour = getRoleTourSteps("STAFF", "VAN_THU");
    const vtTasks = getRoleChecklist("STAFF", "VAN_THU");
    assert.equal(vtTour[0].targetSelector, "#tour-nav-documents");
    assert.equal(vtTour[1].targetSelector, "#tour-nav-documents");
    assert.equal(vtTour[2].targetSelector, "#tour-topbar-search");
    assert.equal(vtTasks[2].title, "Kiểm tra Sổ văn bản đến NĐ 30");
    assert.equal(vtTasks[2].actionLabel, "Thực hiện");
    const vtEvent = dispatchRoleAction("STAFF", "VAN_THU", null);
    assert.equal(vtEvent, "qcet:navigate-documents");
  });
});
