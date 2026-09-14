import test, { describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WelcomeModal } from "../src/components/onboarding/welcome-modal";
import { SpotlightTour } from "../src/components/onboarding/spotlight-tour";
import { OnboardingChecklistWidget } from "../src/components/onboarding/onboarding-checklist-widget";
import { CelebrationConfetti } from "../src/components/onboarding/celebration-confetti";
import { ActionableEmptyState } from "../src/components/onboarding/actionable-empty-state";
import { AuthContext, AuthContextType } from "../src/lib/auth-context";
import { getRoleTourSteps, getRoleChecklist } from "../src/lib/onboarding-constants";
import type { AuthUser } from "../src/types/auth";

const testOfficer: AuthUser = {
  id: "officer-a11y-test",
  name: "Thầy Lê Văn B",
  email: "lvb@cdktcnqn.edu.vn",
  role: "STAFF",
  dbRole: "CHUYEN_VIEN",
  roleLabel: "Chuyên viên Phòng Đào tạo",
  department: "Phòng Đào tạo",
  departmentCode: "DAO_TAO",
};

const mockAuthValue: AuthContextType = {
  user: testOfficer,
  isAuthenticated: true,
  isOfflineReadOnly: false,
  authState: { status: "authenticated", user: testOfficer },
  canMutate: true,
  switchRole: () => {},
  switchUser: () => {},
  login: async () => ({ success: true }),
  register: async () => ({ success: true }),
  loginWithGoogle: () => testOfficer,
  updateProfile: async () => ({ success: true }),
  logout: async () => {},
  isProfileModalOpen: false,
  setIsProfileModalOpen: () => {},
  isLoading: false,
};

describe("Onboarding Accessibility, Contrast & Quality Gate Suite", () => {
  // =========================================================================
  // 1. WCAG 2.1 AA DIALOG ROLES & LABELS
  // =========================================================================
  describe("WCAG 2.1 AA Dialog Roles & Accessible Labeling", () => {
    test("WelcomeModal renders proper dialog role, aria-modal, and label attributes", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          AuthContext.Provider,
          { value: mockAuthValue },
          React.createElement(WelcomeModal, {
            isOpen: true,
            onStartTour: () => {},
            onDismiss: () => {},
          })
        )
      );

      // Must have role="dialog" and aria-modal="true"
      assert.ok(html.includes('role="dialog"'), "WelcomeModal must have role='dialog'");
      assert.ok(html.includes('aria-modal="true"'), "WelcomeModal must have aria-modal='true'");

      // Check aria-labelledby points to existing id
      assert.ok(
        html.includes('aria-labelledby="welcome-modal-title"'),
        "WelcomeModal must have aria-labelledby='welcome-modal-title'"
      );
      assert.ok(
        html.includes('id="welcome-modal-title"'),
        "Element with id='welcome-modal-title' must exist in WelcomeModal DOM"
      );

      // Check aria-describedby points to existing id
      assert.ok(
        html.includes('aria-describedby="welcome-modal-desc"'),
        "WelcomeModal must have aria-describedby='welcome-modal-desc'"
      );
      assert.ok(
        html.includes('id="welcome-modal-desc"'),
        "Element with id='welcome-modal-desc' must exist in WelcomeModal DOM"
      );

      // Accessible close button
      assert.ok(
        html.includes('aria-label="Đóng bảng chào mừng"'),
        "WelcomeModal must have accessible close button aria-label"
      );
    });

    test("SpotlightTour renders proper dialog role, aria-modal, and label attributes", () => {
      const steps = getRoleTourSteps("STAFF", "CHUYEN_VIEN");
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

      // Must have role="dialog" and aria-modal="true"
      assert.ok(html.includes('role="dialog"'), "SpotlightTour must have role='dialog'");
      assert.ok(html.includes('aria-modal="true"'), "SpotlightTour must have aria-modal='true'");

      // Check aria-labelledby points to existing id
      assert.ok(
        html.includes('aria-labelledby="tour-step-title"'),
        "SpotlightTour must have aria-labelledby='tour-step-title'"
      );
      assert.ok(
        html.includes('id="tour-step-title"'),
        "Element with id='tour-step-title' must exist in SpotlightTour DOM"
      );

      // Check aria-describedby points to existing id
      assert.ok(
        html.includes('aria-describedby="tour-step-desc"'),
        "SpotlightTour must have aria-describedby='tour-step-desc'"
      );
      assert.ok(
        html.includes('id="tour-step-desc"'),
        "Element with id='tour-step-desc' must exist in SpotlightTour DOM"
      );

      // Accessible close button
      assert.ok(
        html.includes('aria-label="Đóng hướng dẫn"'),
        "SpotlightTour must have accessible close button aria-label"
      );

      // SVG backdrop mask is aria-hidden so assistive tech ignores decorative geometry
      assert.ok(
        html.includes('aria-hidden="true"'),
        "SpotlightTour SVG overlay must be marked aria-hidden"
      );
    });

    test("OnboardingChecklistWidget implements region role and accessible action labels", () => {
      const tasks = getRoleChecklist("STAFF", "CHUYEN_VIEN");
      const html = renderToStaticMarkup(
        React.createElement(
          AuthContext.Provider,
          { value: mockAuthValue },
          React.createElement(OnboardingChecklistWidget, {
            tasks,
            completedSteps: ["step-profile"],
            percentage: 25,
            isExpanded: true,
            isDismissed: false,
            snoozedUntil: null,
            onToggleExpand: () => {},
            onDismiss: () => {},
            onCompleteStep: () => {},
          })
        )
      );

      // Region landmark role
      assert.ok(
        html.includes('role="region"'),
        "ChecklistWidget expanded card must have role='region'"
      );
      assert.ok(
        html.includes('aria-label="Danh mục khởi động cho cán bộ mới"'),
        "ChecklistWidget expanded card must have accessible aria-label"
      );

      // Control buttons aria-labels
      assert.ok(
        html.includes('aria-label="Nhắc lại sau 24 giờ"'),
        "Snooze button must have aria-label='Nhắc lại sau 24 giờ'"
      );
      assert.ok(
        html.includes('aria-label="Thu nhỏ"'),
        "Collapse button must have aria-label='Thu nhỏ'"
      );
      assert.ok(
        html.includes('aria-label="Ẩn checklist"'),
        "Dismiss button must have aria-label='Ẩn checklist'"
      );
    });

    test("CelebrationConfetti decorative animation is aria-hidden from screen readers", () => {
      const html = renderToStaticMarkup(React.createElement(CelebrationConfetti));
      assert.ok(
        html.includes('aria-hidden="true"'),
        "CelebrationConfetti must have aria-hidden='true'"
      );
    });
  });

});
