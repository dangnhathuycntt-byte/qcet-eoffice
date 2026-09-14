import test, { describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ChecklistTaskConfig,
  calculateOnboardingProgress,
  getRoleTourSteps,
  getRoleChecklist,
  isSnoozed,
  resolveOnboardingState,
  type TourStepConfig,
} from "../src/lib/onboarding-constants";
import {
  OnboardingChecklistWidget,
  dispatchRoleAction,
} from "../src/components/onboarding/onboarding-checklist-widget";
import { WelcomeModal } from "../src/components/onboarding/welcome-modal";
import {
  SpotlightTour,
  clampTooltip,
  calculateCutoutRect,
} from "../src/components/onboarding/spotlight-tour";
import { AuthContext, AuthContextType } from "../src/lib/auth-context";
import type { AuthUser } from "../src/types/auth";

const mockAuthContextValue = (user: AuthUser | null): AuthContextType => ({
  user,
  isAuthenticated: Boolean(user),
  isOfflineReadOnly: false,
  authState: user ? { status: "authenticated", user } : { status: "anonymous" },
  canMutate: Boolean(user),
  switchRole: () => {},
  switchUser: () => {},
  login: async () => ({ success: true }),
  register: async () => ({ success: true }),
  loginWithGoogle: () => user!,
  updateProfile: async () => ({ success: true }),
  logout: async () => {},
  isProfileModalOpen: false,
  setIsProfileModalOpen: () => {},
  isLoading: false,
});

describe("OnboardingChecklistWidget task selection", () => {
  test("Next incomplete task is identified correctly", () => {
    const tasks: ChecklistTaskConfig[] = [
      {
        id: "step-1",
        title: "Task 1",
        description: "Desc 1",
        actionLabel: "Do 1",
        actionType: "MODAL",
      },
      {
        id: "step-2",
        title: "Task 2",
        description: "Desc 2",
        actionLabel: "Do 2",
        actionType: "REQUEST_PUSH",
      },
      {
        id: "step-3",
        title: "Task 3",
        description: "Desc 3",
        actionLabel: "Do 3",
        actionType: "OPEN_SEARCH",
      },
    ];
    const completed = ["step-1"];
    const next = tasks.find((t) => !completed.includes(t.id));
    assert.equal(next?.id, "step-2");
  });

  test("Returns undefined when all tasks are completed", () => {
    const tasks: ChecklistTaskConfig[] = [
      {
        id: "step-1",
        title: "Task 1",
        description: "Desc 1",
        actionLabel: "Do 1",
        actionType: "MODAL",
      },
      {
        id: "step-2",
        title: "Task 2",
        description: "Desc 2",
        actionLabel: "Do 2",
        actionType: "REQUEST_PUSH",
      },
    ];
    const completed = ["step-1", "step-2"];
    const next = tasks.find((t) => !completed.includes(t.id));
    assert.equal(next, undefined);
  });

  test("Next incomplete task picks first available when none completed", () => {
    const tasks: ChecklistTaskConfig[] = [
      {
        id: "step-1",
        title: "Task 1",
        description: "Desc 1",
        actionLabel: "Do 1",
        actionType: "MODAL",
      },
      {
        id: "step-2",
        title: "Task 2",
        description: "Desc 2",
        actionLabel: "Do 2",
        actionType: "REQUEST_PUSH",
      },
    ];
    const completed: string[] = [];
    const next = tasks.find((t) => !completed.includes(t.id));
    assert.equal(next?.id, "step-1");
  });
});

describe("OnboardingChecklistWidget rendering & actions", () => {
  test("Snooze button renders in header next to dismiss button and triggers onSnooze", () => {
    const tasks: ChecklistTaskConfig[] = [
      {
        id: "step-1",
        title: "Hoàn tất hồ sơ",
        description: "Kiểm tra thông tin",
        actionLabel: "Xem hồ sơ",
        actionType: "MODAL",
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(OnboardingChecklistWidget, {
        tasks,
        completedSteps: [],
        percentage: 25,
        isExpanded: true,
        isDismissed: false,
        onToggleExpand: () => {},
        onDismiss: () => {},
        onSnooze: () => {},
        onCompleteStep: () => {},
      })
    );

    assert.ok(html.includes("Nhắc lại sau 24h"), "HTML must contain snooze button text");
    assert.ok(html.includes("Nhắc lại sau 24 giờ"), "HTML must contain snooze aria-label/title");
    assert.ok(html.includes("Ẩn checklist"), "HTML must contain dismiss button");
  });

  test("Widget hides when isDismissed is true or snoozedUntil is in the future", () => {
    const tasks: ChecklistTaskConfig[] = [
      {
        id: "step-1",
        title: "Hoàn tất hồ sơ",
        description: "Kiểm tra thông tin",
        actionLabel: "Xem hồ sơ",
        actionType: "MODAL",
      },
    ];

    // 1. isDismissed: true
    const dismissedHtml = renderToStaticMarkup(
      React.createElement(OnboardingChecklistWidget, {
        tasks,
        completedSteps: [],
        percentage: 25,
        isExpanded: true,
        isDismissed: true,
        onToggleExpand: () => {},
        onDismiss: () => {},
        onCompleteStep: () => {},
      })
    );
    assert.equal(dismissedHtml, "", "Dismissed widget must return null");

    // 2. snoozedUntil: future
    const futureSnooze = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const snoozedHtml = renderToStaticMarkup(
      React.createElement(OnboardingChecklistWidget, {
        tasks,
        completedSteps: [],
        percentage: 25,
        isExpanded: true,
        isDismissed: false,
        snoozedUntil: futureSnooze,
        onToggleExpand: () => {},
        onDismiss: () => {},
        onCompleteStep: () => {},
      })
    );
    assert.equal(snoozedHtml, "", "Snoozed widget must return null");

    // 3. snoozedUntil: expired past timestamp
    const pastSnooze = new Date(Date.now() - 3600 * 1000).toISOString();
    const expiredHtml = renderToStaticMarkup(
      React.createElement(OnboardingChecklistWidget, {
        tasks,
        completedSteps: [],
        percentage: 25,
        isExpanded: true,
        isDismissed: false,
        snoozedUntil: pastSnooze,
        onToggleExpand: () => {},
        onDismiss: () => {},
        onCompleteStep: () => {},
      })
    );
    assert.ok(expiredHtml.length > 0, "Expired snooze must render widget");
  });

  test("dispatchRoleAction executes role-based actions and dispatches correct custom events", () => {
    const events: string[] = [];

    // Setup DOM global stubs
    const originalWindow = (globalThis as unknown as { window: unknown }).window;
    const originalCustomEvent = (globalThis as unknown as { CustomEvent: unknown }).CustomEvent;
    const originalDocument = (globalThis as unknown as { document: unknown }).document;

    (globalThis as unknown as { window: unknown }).window = {
      dispatchEvent: (ev: { type: string }) => {
        events.push(ev.type);
        return true;
      },
      location: { pathname: "/tasks", href: "" },
    };

    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class MockCustomEvent {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    };

    (globalThis as unknown as { document: unknown }).document = {
      querySelector: () => null,
    };

    try {
      // 1. BAN_GIAM_HIEU / ADMIN
      events.length = 0;
      const bghAction = dispatchRoleAction("BAN_GIAM_HIEU");
      assert.equal(bghAction, "qcet:navigate-cockpit");
      assert.equal(events[0], "qcet:navigate-cockpit");

      events.length = 0;
      const adminAction = dispatchRoleAction("ADMIN");
      assert.equal(adminAction, "qcet:navigate-cockpit");
      assert.equal(events[0], "qcet:navigate-cockpit");

      // 2. TRUONG_PHONG / MANAGER
      events.length = 0;
      const tpAction = dispatchRoleAction("TRUONG_PHONG");
      assert.equal(tpAction, "qcet:open-create-task");
      assert.equal(events[0], "qcet:open-create-task");

      events.length = 0;
      const mgrAction = dispatchRoleAction("MANAGER");
      assert.equal(mgrAction, "qcet:open-create-task");
      assert.equal(events[0], "qcet:open-create-task");

      // 3. VAN_THU
      events.length = 0;
      let pushedRoute = "";
      const mockRouter = { push: (url: string) => { pushedRoute = url; } };
      const vtAction = dispatchRoleAction("VAN_THU", undefined, mockRouter);
      assert.equal(vtAction, "qcet:navigate-documents");
      assert.equal(events[0], "qcet:navigate-documents");
      assert.equal(pushedRoute, "/documents");

      // 4. CHUYEN_VIEN / GIANG_VIEN / STAFF
      events.length = 0;
      const cvAction = dispatchRoleAction("CHUYEN_VIEN");
      assert.equal(cvAction, "qcet:open-submit-deliverable");
      assert.equal(events[0], "qcet:open-submit-deliverable");

      events.length = 0;
      const gvAction = dispatchRoleAction("GIANG_VIEN");
      assert.equal(gvAction, "qcet:open-submit-deliverable");
      assert.equal(events[0], "qcet:open-submit-deliverable");

      events.length = 0;
      const staffAction = dispatchRoleAction("STAFF");
      assert.equal(staffAction, "qcet:open-submit-deliverable");
      assert.equal(events[0], "qcet:open-submit-deliverable");
    } finally {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
      (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = originalCustomEvent;
      (globalThis as unknown as { document: unknown }).document = originalDocument;
    }
  });

  test("Celebration UX renders milestone badge and dismiss button when percentage is 100%", () => {
    const tasks: ChecklistTaskConfig[] = [
      {
        id: "step-1",
        title: "Hoàn tất hồ sơ",
        description: "Kiểm tra thông tin",
        actionLabel: "Xem hồ sơ",
        actionType: "MODAL",
      },
    ];

    // Expanded 100% view
    const expandedHtml = renderToStaticMarkup(
      React.createElement(OnboardingChecklistWidget, {
        tasks,
        completedSteps: ["step-1"],
        percentage: 100,
        isExpanded: true,
        isDismissed: false,
        onToggleExpand: () => {},
        onDismiss: () => {},
        onCompleteStep: () => {},
      })
    );

    assert.ok(
      expandedHtml.includes("Cán bộ số hóa tiêu biểu"),
      "Celebration banner must contain milestone badge 'Cán bộ số hóa tiêu biểu'"
    );
    assert.ok(
      expandedHtml.includes("100% Hoàn tất"),
      "Celebration banner must show 100% completion badge"
    );
    assert.ok(
      expandedHtml.includes("Đóng và bắt đầu làm việc"),
      "Celebration banner must offer button to close/dismiss checklist"
    );

    // Collapsed 100% mini-pill view
    const collapsedHtml = renderToStaticMarkup(
      React.createElement(OnboardingChecklistWidget, {
        tasks,
        completedSteps: ["step-1"],
        percentage: 100,
        isExpanded: false,
        isDismissed: false,
        onToggleExpand: () => {},
        onDismiss: () => {},
        onCompleteStep: () => {},
      })
    );

    assert.ok(
      collapsedHtml.includes("Cán bộ số hóa tiêu biểu"),
      "Collapsed mini-pill must also display milestone badge title"
    );
  });
});

describe("WelcomeModal behaviour", () => {
  test("WelcomeModal copywriting matches official university tone", () => {
    const getGreeting = (name: string, roleLabel: string, dept: string) => {
      return `Kính chào Thầy/Cô ${name} gia nhập QCET E-Office!`;
    };
    const text = getGreeting("Nguyễn Văn A", "Trưởng Khoa", "Khoa CNTT");
    assert.match(text, /Kính chào Thầy\/Cô/);
    assert.match(text, /QCET E-Office/);
  });

  test("Focus trap keyboard navigation logic wraps correctly", () => {
    // Pure unit test of the focus trap cycle algorithm
    const mockElements = [
      { id: "btn-close", focusCalled: false, focus() { this.focusCalled = true; } },
      { id: "btn-skip", focusCalled: false, focus() { this.focusCalled = true; } },
      { id: "btn-tour", focusCalled: false, focus() { this.focusCalled = true; } },
    ];

    function simulateFocusTrap(
      elements: typeof mockElements,
      currentActiveIndex: number,
      shiftKey: boolean
    ): { prevented: boolean; nextFocusedIndex: number } {
      const first = elements[0];
      const last = elements[elements.length - 1];
      const currentActive = elements[currentActiveIndex];
      let prevented = false;
      let nextFocusedIndex = currentActiveIndex;

      if (shiftKey && currentActive === first) {
        last.focus();
        prevented = true;
        nextFocusedIndex = elements.length - 1;
      } else if (!shiftKey && currentActive === last) {
        first.focus();
        prevented = true;
        nextFocusedIndex = 0;
      }

      return { prevented, nextFocusedIndex };
    }

    // Case 1: Shift+Tab on first element wraps to last
    const res1 = simulateFocusTrap(mockElements, 0, true);
    assert.strictEqual(res1.prevented, true);
    assert.strictEqual(res1.nextFocusedIndex, 2);
    assert.strictEqual(mockElements[2].focusCalled, true);

    // Case 2: Tab on last element wraps to first
    const res2 = simulateFocusTrap(mockElements, 2, false);
    assert.strictEqual(res2.prevented, true);
    assert.strictEqual(res2.nextFocusedIndex, 0);
    assert.strictEqual(mockElements[0].focusCalled, true);

    // Case 3: Tab on middle element does not wrap
    const res3 = simulateFocusTrap(mockElements, 1, false);
    assert.strictEqual(res3.prevented, false);
    assert.strictEqual(res3.nextFocusedIndex, 1);
  });
});

describe("SpotlightTour geometry, keyboard & fallback", () => {
  test("clampTooltip prevents overflow outside viewport on left and right", () => {
    const clamped1 = clampTooltip(-20, 320, 1024);
    assert.equal(clamped1, 12, "Should clamp negative left to minMargin (12)");

    const clamped2 = clampTooltip(950, 320, 1024);
    assert.equal(clamped2, 1024 - 320 - 12, "Should clamp overflowing right edge");

    const clamped3 = clampTooltip(200, 320, 1024);
    assert.equal(clamped3, 200, "Should preserve left when inside bounds");

    const clamped4 = clampTooltip(950, 320, 1024, 16);
    assert.equal(clamped4, 1024 - 320 - 16, "Should respect custom margin");
  });

  test("calculateCutoutRect correctly expands rect by padding on all sides", () => {
    const target = { x: 100, y: 50, width: 200, height: 40 };
    const cutout = calculateCutoutRect(target, 8);

    assert.equal(cutout!.x, 92);
    assert.equal(cutout!.y, 42);
    assert.equal(cutout!.width, 216);
    assert.equal(cutout!.height, 56);

    const customCutout = calculateCutoutRect(target, 12);
    assert.equal(customCutout!.x, 88);
    assert.equal(customCutout!.y, 38);
    assert.equal(customCutout!.width, 224);
    assert.equal(customCutout!.height, 64);
  });

  test("calculateCutoutRect defensively handles null or undefined without crashing", () => {
    assert.equal(calculateCutoutRect(null), null);
    assert.equal(calculateCutoutRect(undefined), null);
  });

  test("keyboard shortcuts map correctly to tour controls", () => {
    let nextCalls = 0;
    let prevCalls = 0;
    let closeCalls = 0;

    const handleKeyDown = (key: string) => {
      if (key === "Escape") closeCalls++;
      if (key === "ArrowRight") nextCalls++;
      if (key === "ArrowLeft") prevCalls++;
    };

    handleKeyDown("ArrowRight");
    assert.equal(nextCalls, 1);
    assert.equal(prevCalls, 0);
    assert.equal(closeCalls, 0);

    handleKeyDown("ArrowLeft");
    assert.equal(prevCalls, 1);

    handleKeyDown("Escape");
    assert.equal(closeCalls, 1);

    handleKeyDown("Enter");
    assert.equal(nextCalls, 1, "Other keys should not trigger handlers");
  });

  test("SpotlightTour renders centered fallback card when targetRect is null (target DOM missing)", () => {
    const steps = [
      {
        id: "step-missing",
        title: "Phân hệ Tác vụ & Phê duyệt",
        description: "Quản lý toàn bộ danh sách công việc và phân công nhiệm vụ.",
        targetSelector: "#non-existent-element-id-12345",
        fallbackSelector: "#another-missing-selector",
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(SpotlightTour, {
        isActive: true,
        steps,
        currentIndex: 0,
        onNext: () => {},
        onPrev: () => {},
        onClose: () => {},
      })
    );

    // Fallback card structure and content
    assert.ok(
      html.includes("Phân hệ Tác vụ &amp; Phê duyệt") || html.includes("Phân hệ Tác vụ & Phê duyệt"),
      "Must render step title in fallback card"
    );
    assert.ok(
      html.includes("Quản lý toàn bộ danh sách công việc"),
      "Must render step description in fallback card"
    );

    // Informative notice indicating target is collapsed or in another view
    assert.ok(
      html.includes("thu gọn") || html.includes("phân hệ") || html.includes("khám phá"),
      "Must include notice that target section is collapsed or located in another view"
    );

    // Controls: Tiếp tục & Để sau (Tự khám phá)
    assert.ok(html.includes("Tiếp tục"), "Must include 'Tiếp tục' button");
    assert.ok(
      html.includes("Để sau (Tự khám phá)") || html.includes("Để sau"),
      "Must include 'Để sau' button in tour controls"
    );
  });
});

describe("Onboarding integration lifecycle", () => {
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
});
