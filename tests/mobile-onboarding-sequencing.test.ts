import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  PWAOnboardingCoordinator,
  type OnboardingStage,
  type BeforeInstallPromptEvent,
} from "../src/lib/pwa/onboarding-coordinator";

describe("Sprint M6: PWA & Onboarding Sequence Orchestration", () => {
  let coordinator: PWAOnboardingCoordinator;
  let mockStorage: Record<string, string>;
  let mockSessionStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    mockSessionStorage = {};
    const fakeLocalStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
      length: 0,
      key: () => null,
    };

    const fakeSessionStorage = {
      getItem: (key: string) => mockSessionStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockSessionStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockSessionStorage[key];
      },
      clear: () => {
        mockSessionStorage = {};
      },
      length: 0,
      key: () => null,
    };

    (global as unknown as { window: unknown }).window = {
      localStorage: fakeLocalStorage,
      sessionStorage: fakeSessionStorage,
      matchMedia: () => ({ matches: false }),
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    (global as unknown as { localStorage: unknown }).localStorage = fakeLocalStorage;
    (global as unknown as { sessionStorage: unknown }).sessionStorage = fakeSessionStorage;
    Object.defineProperty(global, "navigator", {
      value: {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        maxTouchPoints: 0,
      },
      configurable: true,
      writable: true,
    });

    coordinator = new PWAOnboardingCoordinator();
    coordinator.init("user_m6_test");
  });

  describe("1. Mutually Exclusive Single Interruption Per Session", () => {
    it("never allows multiple proactive prompts to be eligible at the same time", () => {
      const { canShowWelcome, canShowInstallPrompt, canShowPushPrompt } = coordinator.getState();
      const trueCount = [canShowWelcome, canShowInstallPrompt, canShowPushPrompt].filter(Boolean).length;
      assert.ok(trueCount <= 1, `At most 1 proactive prompt can be eligible, found ${trueCount}`);
    });

    it("records interruption and suppresses all further proactive interrupts in the same session", () => {
      assert.strictEqual(coordinator.hasSessionInterruptionShown(), false);
      assert.strictEqual(coordinator.canShowWelcome, true);

      // Record welcome modal displayed
      coordinator.recordInterruptionShown("WELCOME");
      assert.strictEqual(coordinator.hasSessionInterruptionShown(), true);
      assert.strictEqual(coordinator.getActiveInterruptionType(), "WELCOME");

      // Dismiss welcome modal
      coordinator.completeWelcome();
      coordinator.clearActiveInterruption();

      // State is now WELCOME_DONE, sessionInterruptionShown is still true
      assert.strictEqual(coordinator.hasSessionInterruptionShown(), true);
      assert.strictEqual(coordinator.canShowWelcome, false);
      assert.strictEqual(coordinator.canShowInstallPrompt, false, "Install prompt must be suppressed in session 1");
      assert.strictEqual(coordinator.canShowPushPrompt, false, "Push prompt must be suppressed in session 1");
    });
  });

  describe("2. Strict Lifecycle Sequencing: Welcome -> PWA Install -> Web Push", () => {
    it("Session 1: Shows WelcomeModal only; suppresses PWA install and push prompts", () => {
      const state1 = coordinator.getState();
      assert.strictEqual(state1.sessionCount, 1);
      assert.strictEqual(state1.canShowWelcome, true, "Session 1 must show WelcomeModal");
      assert.strictEqual(state1.canShowInstallPrompt, false, "Session 1 must suppress PWA prompt");
      assert.strictEqual(state1.canShowPushPrompt, false, "Session 1 must suppress Push prompt");

      // Simulate BeforeInstallPrompt event occurring during session 1
      coordinator.handleBeforeInstallPrompt({
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "accepted" as const }),
        preventDefault: () => {},
      } as unknown as BeforeInstallPromptEvent);

      // Even with install event available, session 1 must NOT show install prompt
      assert.strictEqual(coordinator.canShowInstallPrompt, false);

      // User finishes welcome
      coordinator.recordInterruptionShown("WELCOME");
      coordinator.completeWelcome();
      coordinator.clearActiveInterruption();

      // Ensure all proactive prompts remain false for the rest of session 1
      assert.strictEqual(coordinator.canShowWelcome, false);
      assert.strictEqual(coordinator.canShowInstallPrompt, false);
      assert.strictEqual(coordinator.canShowPushPrompt, false);
    });

    it("Session 2: Only prompts PWA Install if not installed; suppresses Push prompt", () => {
      // Complete welcome in session 1
      coordinator.recordInterruptionShown("WELCOME");
      coordinator.completeWelcome();
      coordinator.clearActiveInterruption();

      // Simulate starting Session 2 by closing the session (clearing sessionStorage)
      // and creating a new coordinator instance loading persisted localStorage
      mockSessionStorage = {};
      const session2Coordinator = new PWAOnboardingCoordinator();
      session2Coordinator.init("user_m6_test");

      // Set platform as installable
      session2Coordinator.handleBeforeInstallPrompt({
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "accepted" as const }),
        preventDefault: () => {},
      } as unknown as BeforeInstallPromptEvent);

      assert.strictEqual(session2Coordinator.getState().sessionCount, 2);
      assert.strictEqual(session2Coordinator.canShowWelcome, false, "Welcome already completed");
      assert.strictEqual(session2Coordinator.canShowInstallPrompt, true, "Session 2 must show PWA install prompt");
      assert.strictEqual(session2Coordinator.canShowPushPrompt, false, "Push prompt must be suppressed while PWA install is eligible");

      // Display PWA install prompt
      session2Coordinator.recordInterruptionShown("PWA_INSTALL");
      assert.strictEqual(session2Coordinator.hasSessionInterruptionShown(), true);

      // User dismisses/snoozes PWA install in Session 2
      session2Coordinator.snoozeInstall(7);

      // Session 2 should NOT immediately show Push (never stack in same session)
      assert.strictEqual(session2Coordinator.canShowPushPrompt, false, "Must not stack Push after PWA snooze in same session");
    });

    it("Session 3+ / After PWA Install: Only prompts Web Push permission", () => {
      // Set up user state as having completed Welcome and Installed PWA
      coordinator.completeWelcome();
      coordinator.handleAppInstalled();

      // Start a fresh session (Session 3)
      mockSessionStorage = {};
      const session3Coordinator = new PWAOnboardingCoordinator();
      session3Coordinator.init("user_m6_test");

      const state3 = session3Coordinator.getState();
      assert.strictEqual(state3.isInstalled, true);
      assert.strictEqual(session3Coordinator.canShowWelcome, false);
      assert.strictEqual(session3Coordinator.canShowInstallPrompt, false, "Already installed");
      assert.strictEqual(session3Coordinator.canShowPushPrompt, true, "Session 3 must show Web Push prompt");

      // Display Push prompt
      session3Coordinator.recordInterruptionShown("PUSH");
      assert.strictEqual(session3Coordinator.hasSessionInterruptionShown(), true);

      // Dismiss / snooze Push
      session3Coordinator.snoozePush(14);
      assert.strictEqual(session3Coordinator.canShowPushPrompt, false);
    });

    it("never stacks Welcome -> Tour -> Install -> Push in the same session", () => {
      // Fresh user starts Session 1
      assert.strictEqual(coordinator.canShowWelcome, true);
      coordinator.recordInterruptionShown("WELCOME");

      // User completes welcome
      coordinator.completeWelcome();
      coordinator.clearActiveInterruption();

      // Ensure both install and push remain suppressed in Session 1
      assert.strictEqual(coordinator.canShowInstallPrompt, false);
      assert.strictEqual(coordinator.canShowPushPrompt, false);
    });
  });

  describe("3. Manual Triggers Function Regardless of Session Gate", () => {
    it("allows manual trigger custom event listeners to exist and function", () => {
      const appShellPath = path.resolve(
        process.cwd(),
        "src/components/layout/app-shell.tsx"
      );
      const appShellSource = fs.readFileSync(appShellPath, "utf-8");

      // Check event listeners for manual triggers in AppShell and child components
      assert.ok(
        appShellSource.includes("qcet:open-install-modal"),
        "AppShell must listen to qcet:open-install-modal for manual PWA install"
      );
      assert.ok(
        appShellSource.includes("qcet:restart-onboarding"),
        "AppShell must listen to qcet:restart-onboarding for manual tour replay"
      );

      const pushSheetPath = path.resolve(
        process.cwd(),
        "src/components/pwa/push-onboarding-sheet.tsx"
      );
      const pushSheetSource = fs.readFileSync(pushSheetPath, "utf-8");
      assert.ok(
        pushSheetSource.includes("qcet:open-push-onboarding"),
        "PushOnboardingSheet must listen to qcet:open-push-onboarding for manual push prompt"
      );

      // Ensure manual triggers are not blocked by sessionInterruptionShown
      assert.ok(
        pushSheetSource.includes("manualOpen !== undefined") ||
          pushSheetSource.includes("isControlled"),
        "PushOnboardingSheet must support controlled/manual open"
      );
    });
  });

  describe("4. Design Invariants: Zero Emojis, Light-Only, Touch Targets >= 44px", () => {
    const filesToCheck = [
      "src/lib/pwa/onboarding-coordinator.ts",
      "src/components/pwa/pwa-install-prompt.tsx",
      "src/components/pwa/push-onboarding-sheet.tsx",
      "src/components/pwa/mobile-app-install-modal.tsx",
      "src/components/onboarding/welcome-modal.tsx",
      "src/components/layout/app-shell.tsx",
    ];

    it("verifies 0% emojis across all onboarding and PWA modal files", () => {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

      for (const relativePath of filesToCheck) {
        const fullPath = path.resolve(process.cwd(), relativePath);
        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          assert.strictEqual(
            emojiRegex.test(line),
            false,
            `Emoji found in ${relativePath} at line ${i + 1}: ${line}`
          );
        }
      }
    });

    it("verifies zero dark theme classes (dark:) in all modal components", () => {
      const modalComponents = [
        "src/components/pwa/pwa-install-prompt.tsx",
        "src/components/pwa/push-onboarding-sheet.tsx",
        "src/components/pwa/mobile-app-install-modal.tsx",
        "src/components/onboarding/welcome-modal.tsx",
      ];

      for (const relativePath of modalComponents) {
        const fullPath = path.resolve(process.cwd(), relativePath);
        const content = fs.readFileSync(fullPath, "utf-8");
        // Check for className="... dark:..." or class 'dark:'
        const darkClassRegex = /(?:className|class)=["'][^"']*\bdark:[^"']*["']/g;
        const matches = content.match(darkClassRegex);
        assert.strictEqual(
          matches,
          null,
          `Dark theme class found in ${relativePath}: ${JSON.stringify(matches)}`
        );
      }
    });

    it("verifies touch targets >= 44px on modal action buttons and dismiss controls", () => {
      const welcomeModalPath = path.resolve(
        process.cwd(),
        "src/components/onboarding/welcome-modal.tsx"
      );
      const welcomeContent = fs.readFileSync(welcomeModalPath, "utf-8");
      assert.ok(
        welcomeContent.includes("min-w-[44px]") && welcomeContent.includes("min-h-[44px]"),
        "WelcomeModal dismiss button must enforce min-w-[44px] and min-h-[44px]"
      );
      assert.ok(
        welcomeContent.includes("min-h-[44px] px-4"),
        "WelcomeModal action buttons must enforce min-h-[44px]"
      );

      const pwaPromptPath = path.resolve(
        process.cwd(),
        "src/components/pwa/pwa-install-prompt.tsx"
      );
      const pwaContent = fs.readFileSync(pwaPromptPath, "utf-8");
      assert.ok(
        pwaContent.includes("min-w-[44px]") && pwaContent.includes("min-h-[44px]"),
        "PWAInstallPrompt dismiss button must enforce min-w-[44px] and min-h-[44px]"
      );

      const pushSheetPath = path.resolve(
        process.cwd(),
        "src/components/pwa/push-onboarding-sheet.tsx"
      );
      const pushContent = fs.readFileSync(pushSheetPath, "utf-8");
      assert.ok(
        pushContent.includes("min-w-[44px]") && pushContent.includes("min-h-[44px]"),
        "PushOnboardingSheet dismiss button must enforce min-w-[44px] and min-h-[44px]"
      );

      const installModalPath = path.resolve(
        process.cwd(),
        "src/components/pwa/mobile-app-install-modal.tsx"
      );
      const installModalContent = fs.readFileSync(installModalPath, "utf-8");
      assert.ok(
        installModalContent.includes("min-w-[44px]") && installModalContent.includes("min-h-[44px]"),
        "MobileAppInstallModal dismiss button must enforce min-w-[44px] and min-h-[44px]"
      );
    });
  });
});
