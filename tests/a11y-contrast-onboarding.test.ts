import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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

  // =========================================================================
  // 2. ERGONOMICS & MINIMUM 44PX TOUCH TARGETS
  // =========================================================================
  describe("Senior Ergonomics & Touch Target Sizing (44px+ Rule)", () => {
    test("Checklist widget pill button provides 44px+ touch target on mobile", () => {
      const widgetPath = path.resolve(
        process.cwd(),
        "src/components/onboarding/onboarding-checklist-widget.tsx"
      );
      const content = fs.readFileSync(widgetPath, "utf-8");

      // Collapsed mini pill has min-h-[44px] and touch-manipulation
      assert.ok(
        content.includes("min-h-[44px]"),
        "Mini pill badge button must enforce min-h-[44px] touch target"
      );
      assert.ok(
        content.includes("touch-manipulation"),
        "Mini pill badge button must declare touch-manipulation for mobile tap response"
      );
    });

    test("Checklist widget action controls have minimum touch boundaries", () => {
      const widgetPath = path.resolve(
        process.cwd(),
        "src/components/onboarding/onboarding-checklist-widget.tsx"
      );
      const content = fs.readFileSync(widgetPath, "utf-8");

      assert.ok(
        content.includes("min-h-[36px]"),
        "Compact header buttons must enforce at least min-h-[36px]"
      );
      assert.ok(
        content.includes("min-w-[36px]"),
        "Compact icon buttons must enforce at least min-w-[36px]"
      );
    });

    test("SpotlightTour mobile layout uses bottom sheet positioning and safe-area padding", () => {
      const tourPath = path.resolve(
        process.cwd(),
        "src/components/onboarding/spotlight-tour.tsx"
      );
      const content = fs.readFileSync(tourPath, "utf-8");

      assert.ok(
        content.includes("innerWidth < 768") || content.includes("isMobile"),
        "Must have mobile viewport detection"
      );
      assert.ok(
        content.includes("safe-area-inset-bottom"),
        "Mobile sheet must respect device safe-area-inset-bottom"
      );
      assert.ok(
        content.includes("touch-manipulation"),
        "Interactive tour buttons must use touch-manipulation"
      );
    });

    test("PushOnboardingSheet provides senior-friendly touch targets", () => {
      const sheetPath = path.resolve(
        process.cwd(),
        "src/components/pwa/push-onboarding-sheet.tsx"
      );
      const content = fs.readFileSync(sheetPath, "utf-8");

      assert.ok(
        content.includes("min-h-[44px]") || content.includes("h-11") || content.includes("h-12"),
        "PushOnboardingSheet must provide primary action button with 44px+ height"
      );
    });
  });

  // =========================================================================
  // 3. KEYBOARD NAVIGATION & FOCUS TRAPPING
  // =========================================================================
  describe("Keyboard Navigation & Focus Management", () => {
    test("WelcomeModal traps focus on Tab and dismisses on Escape", () => {
      const modalPath = path.resolve(
        process.cwd(),
        "src/components/onboarding/welcome-modal.tsx"
      );
      const content = fs.readFileSync(modalPath, "utf-8");

      assert.ok(
        content.includes('e.key === "Escape"'),
        "WelcomeModal must dismiss on Escape key"
      );
      assert.ok(
        content.includes('e.key === "Tab"'),
        "WelcomeModal must handle Tab key for focus trapping"
      );
      assert.ok(
        content.includes("e.shiftKey"),
        "WelcomeModal must handle Shift+Tab for backward focus cycle"
      );
    });

    test("SpotlightTour supports Escape, ArrowRight and ArrowLeft keyboard shortcuts", () => {
      const tourPath = path.resolve(
        process.cwd(),
        "src/components/onboarding/spotlight-tour.tsx"
      );
      const content = fs.readFileSync(tourPath, "utf-8");

      assert.ok(
        content.includes('e.key === "Escape"'),
        "SpotlightTour must close on Escape key"
      );
      assert.ok(
        content.includes('e.key === "ArrowRight"'),
        "SpotlightTour must advance to next step on ArrowRight"
      );
      assert.ok(
        content.includes('e.key === "ArrowLeft"'),
        "SpotlightTour must navigate to previous step on ArrowLeft"
      );
    });
  });

  // =========================================================================
  // 4. LIGHT-ONLY COMPLIANCE (0% DARK CLASSES)
  // =========================================================================
  describe("Light-Only Palette Compliance (Standard Công Sở Giáo Dục)", () => {
    const onboardingFiles = [
      "src/components/onboarding/welcome-modal.tsx",
      "src/components/onboarding/spotlight-tour.tsx",
      "src/components/onboarding/onboarding-checklist-widget.tsx",
      "src/components/onboarding/celebration-confetti.tsx",
      "src/components/onboarding/actionable-empty-state.tsx",
      "src/components/pwa/push-onboarding-sheet.tsx",
    ];

    for (const relPath of onboardingFiles) {
      test(`${relPath} strictly complies with Light-Only standards (0 dark: classes)`, () => {
        const fullPath = path.resolve(process.cwd(), relPath);
        assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
        const content = fs.readFileSync(fullPath, "utf-8");

        // Zero dark: classes
        const darkMatches = content.match(/dark:[a-zA-Z0-9_\-\/]+/g) || [];
        assert.equal(
          darkMatches.length,
          0,
          `Found disallowed dark: classes in ${relPath}: ${darkMatches.join(", ")}`
        );

        // Disallow useTheme or ThemeProvider in onboarding components
        assert.equal(
          content.includes("useTheme"),
          false,
          `${relPath} should not import or use useTheme`
        );
      });
    }

    test("Onboarding components consistently use semantic color tokens", () => {
      const widgetPath = path.resolve(
        process.cwd(),
        "src/components/onboarding/onboarding-checklist-widget.tsx"
      );
      const content = fs.readFileSync(widgetPath, "utf-8");

      assert.ok(content.includes("bg-card"), "Must use semantic bg-card token");
      assert.ok(content.includes("text-foreground"), "Must use semantic text-foreground token");
      assert.ok(content.includes("text-muted-foreground"), "Must use semantic text-muted-foreground token");
      assert.ok(content.includes("bg-primary"), "Must use semantic bg-primary token");
      assert.ok(content.includes("border-border"), "Must use semantic border-border token");
    });
  });

  // =========================================================================
  // 5. 0% EMOJI SLOP ENFORCEMENT
  // =========================================================================
  describe("0% Emoji Slop Quality Gate Across All Onboarding Modules", () => {
    const allFilesToAudit = [
      "src/components/onboarding/welcome-modal.tsx",
      "src/components/onboarding/spotlight-tour.tsx",
      "src/components/onboarding/onboarding-checklist-widget.tsx",
      "src/components/onboarding/celebration-confetti.tsx",
      "src/components/onboarding/actionable-empty-state.tsx",
      "src/components/pwa/push-onboarding-sheet.tsx",
      "src/hooks/use-onboarding.ts",
      "src/lib/onboarding-constants.ts",
      "src/lib/onboarding-schema.ts",
    ];

    const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

    for (const relPath of allFilesToAudit) {
      test(`${relPath} contains 0% emoji slop`, () => {
        const fullPath = path.resolve(process.cwd(), relPath);
        assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
        const content = fs.readFileSync(fullPath, "utf-8");

        const match = content.match(EMOJI_REGEX);
        assert.equal(
          match,
          null,
          `Emoji found in ${relPath}: ${match ? match[0] : ""}`
        );
      });
    }
  });
});
