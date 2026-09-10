import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  PWAOnboardingCoordinator,
  type OnboardingStage,
  type BeforeInstallPromptEvent,
} from "../../src/lib/pwa/onboarding-coordinator";

describe("Task 6: PWA Onboarding Coordinator & Install UX Orchestration", () => {
  let coordinator: PWAOnboardingCoordinator;
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
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

    // Setup mock global window and localStorage
    (global as unknown as { window: unknown }).window = {
      localStorage: fakeLocalStorage,
      matchMedia: () => ({ matches: false }),
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    (global as unknown as { localStorage: unknown }).localStorage = fakeLocalStorage;
    Object.defineProperty(global, "navigator", {
      value: {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        maxTouchPoints: 0,
      },
      configurable: true,
      writable: true,
    });

    coordinator = new PWAOnboardingCoordinator();
    coordinator.init("test_user_01");
  });

  describe("1. State Machine Transitions", () => {
    it("initializes cold load as NEW_USER with zero prompts allowed", () => {
      const state = coordinator.getState();
      assert.strictEqual(state.stage, "NEW_USER");
      assert.strictEqual(state.canShowInstallPrompt, false, "Cold load must never show install prompt");
      assert.strictEqual(state.canShowPushPrompt, false, "Cold load must never show push prompt");
      assert.strictEqual(state.actionsCount, 0);
    });

    it("transitions NEW_USER -> WELCOME_DONE when welcome is completed", () => {
      coordinator.completeWelcome();
      const state = coordinator.getState();
      assert.strictEqual(state.stage, "WELCOME_DONE");
      assert.strictEqual(state.canShowInstallPrompt, false, "WELCOME_DONE must not trigger install prompt yet");
    });

    it("transitions WELCOME_DONE -> ENGAGED after user completes actions or visits pages", () => {
      coordinator.completeWelcome();
      coordinator.recordAction("created_task");
      coordinator.recordAction("viewed_document");

      const state = coordinator.getState();
      assert.strictEqual(state.stage, "ENGAGED");
      assert.strictEqual(state.actionsCount, 2);
    });

    it("transitions ENGAGED -> INSTALL_ELIGIBLE when platform is installable", () => {
      coordinator.completeWelcome();
      coordinator.recordAction("action_1");
      coordinator.recordAction("action_2");

      // Simulate Chromium beforeinstallprompt event
      let promptCalled = false;
      const fakeEvent = {
        preventDefault: () => {},
        prompt: async () => {
          promptCalled = true;
        },
        userChoice: Promise.resolve({ outcome: "accepted" as const }),
      };

      coordinator.handleBeforeInstallPrompt(fakeEvent as unknown as BeforeInstallPromptEvent);

      const state = coordinator.getState();
      assert.strictEqual(state.stage, "INSTALL_ELIGIBLE");
      assert.strictEqual(state.isInstallable, true);
      assert.strictEqual(state.canShowInstallPrompt, true);
    });

    it("transitions INSTALL_ELIGIBLE -> INSTALLED -> PUSH_ELIGIBLE upon app installation", () => {
      coordinator.completeWelcome();
      coordinator.recordAction("action_1");
      coordinator.recordAction("action_2");

      const fakeEvent = {
        preventDefault: () => {},
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "accepted" as const }),
      };
      coordinator.handleBeforeInstallPrompt(fakeEvent as unknown as BeforeInstallPromptEvent);

      // User installs the app
      coordinator.handleAppInstalled();

      const state = coordinator.getState();
      assert.strictEqual(state.isInstalled, true);
      assert.strictEqual(state.canShowInstallPrompt, false, "Installed app must never show install prompt");
      // Once installed, user becomes eligible for push notifications
      assert.strictEqual(state.stage, "PUSH_ELIGIBLE");
      assert.strictEqual(state.canShowPushPrompt, true);
    });
  });

  describe("2. Deferred Prompt Capture and Invocation", () => {
    it("holds deferred prompt and triggers it upon promptInstall call", async () => {
      let promptInvoked = false;
      const fakeEvent = {
        preventDefault: () => {},
        prompt: async () => {
          promptInvoked = true;
        },
        userChoice: Promise.resolve({ outcome: "accepted" as const }),
      };

      coordinator.handleBeforeInstallPrompt(fakeEvent as unknown as BeforeInstallPromptEvent);
      assert.strictEqual(promptInvoked, false, "Prompt must be held deferred, not auto-called");

      const outcome = await coordinator.promptInstall();
      assert.strictEqual(promptInvoked, true);
      assert.strictEqual(outcome, "accepted");

      // State should update to installed
      const state = coordinator.getState();
      assert.strictEqual(state.isInstalled, true);
    });

    it("handles user dismissal cleanly without breaking state", async () => {
      const fakeEvent = {
        preventDefault: () => {},
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "dismissed" as const }),
      };

      coordinator.handleBeforeInstallPrompt(fakeEvent as unknown as BeforeInstallPromptEvent);
      const outcome = await coordinator.promptInstall();
      assert.strictEqual(outcome, "dismissed");

      const state = coordinator.getState();
      assert.strictEqual(state.isInstalled, false);
    });
  });

  describe("3. Platform Detection: iOS vs Standalone", () => {
    it("detects iOS browser and provides step-by-step guidance", () => {
      Object.defineProperty(global, "navigator", {
        value: {
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
          maxTouchPoints: 5,
        },
        configurable: true,
        writable: true,
      });

      const iosCoordinator = new PWAOnboardingCoordinator();
      iosCoordinator.init("ios_user");

      const state = iosCoordinator.getState();
      assert.strictEqual(state.isIOS, true);
      assert.strictEqual(state.isStandalone, false);
      assert.ok(state.installGuidance !== null, "iOS must have contextual install guidance");
      assert.strictEqual(state.installGuidance?.platform, "ios");
      assert.ok(state.installGuidance?.steps.some((s: string) => s.includes("Chia sẻ")));
      assert.ok(state.installGuidance?.steps.some((s: string) => s.includes("Màn hình chính")));
    });

    it("detects iOS standalone mode as already INSTALLED", () => {
      Object.defineProperty(global, "navigator", {
        value: {
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148",
          standalone: true,
          maxTouchPoints: 5,
        },
        configurable: true,
        writable: true,
      });

      const iosStandaloneCoord = new PWAOnboardingCoordinator();
      iosStandaloneCoord.init("ios_standalone_user");

      const state = iosStandaloneCoord.getState();
      assert.strictEqual(state.isIOS, true);
      assert.strictEqual(state.isStandalone, true);
      assert.strictEqual(state.isInstalled, true);
      assert.strictEqual(state.canShowInstallPrompt, false);
    });
  });

  describe("4. User Isolation & Snooze Logic", () => {
    it("isolates onboarding state between different users", () => {
      coordinator.completeWelcome();
      coordinator.recordAction("action_1");
      coordinator.recordAction("action_2");
      assert.strictEqual(coordinator.getState().stage, "ENGAGED");

      // Switch to a new user
      const user2Coordinator = new PWAOnboardingCoordinator();
      user2Coordinator.init("test_user_02");
      assert.strictEqual(user2Coordinator.getState().stage, "NEW_USER");
      assert.strictEqual(user2Coordinator.getState().actionsCount, 0);
    });

    it("snoozes install prompt for specified days", () => {
      coordinator.completeWelcome();
      coordinator.recordAction("action_1");
      coordinator.recordAction("action_2");
      const fakeEvent = {
        preventDefault: () => {},
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "dismissed" as const }),
      };
      coordinator.handleBeforeInstallPrompt(fakeEvent as unknown as BeforeInstallPromptEvent);

      assert.strictEqual(coordinator.getState().canShowInstallPrompt, true);

      // Snooze for 3 days
      coordinator.snoozeInstall(3);

      const state = coordinator.getState();
      assert.strictEqual(state.canShowInstallPrompt, false, "Snoozed install must not show prompt");
      assert.strictEqual(state.installSnoozed, true);
    });

    it("snoozes push prompt for specified days", () => {
      coordinator.setState({
        stage: "PUSH_ELIGIBLE",
        isInstalled: true,
        canShowPushPrompt: true,
      });

      assert.strictEqual(coordinator.getState().canShowPushPrompt, true);

      coordinator.snoozePush(7);

      const state = coordinator.getState();
      assert.strictEqual(state.canShowPushPrompt, false);
      assert.strictEqual(state.pushSnoozed, true);
    });
  });

  describe("5. Anti-Slop, Institutional QCET UI & Touch Target Invariants", () => {
    const coordinatorPath = path.resolve(
      process.cwd(),
      "src/lib/pwa/onboarding-coordinator.ts"
    );
    const componentPath = path.resolve(
      process.cwd(),
      "src/components/pwa/pwa-install-prompt.tsx"
    );

    it("coordinator file contains 0% emojis", () => {
      const content = fs.readFileSync(coordinatorPath, "utf-8");
      const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
      assert.strictEqual(
        emojiRegex.test(content),
        false,
        "Coordinator must have zero emojis"
      );
    });

    it("pwa-install-prompt.tsx contains 0% emojis and 0 dark theme classes", () => {
      const content = fs.readFileSync(componentPath, "utf-8");
      const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
      assert.strictEqual(
        emojiRegex.test(content),
        false,
        "Install prompt component must have zero emojis"
      );

      assert.strictEqual(
        content.includes("dark:"),
        false,
        "Install prompt component must not contain dark: classes"
      );
    });

    it("pwa-install-prompt.tsx enforces institutional QCET styling and >=44px touch targets", () => {
      const content = fs.readFileSync(componentPath, "utf-8");

      // Verify institutional value proposition
      assert.ok(
        content.includes("Cài đặt QCET E-Office"),
        "Must contain QCET E-Office branding"
      );
      assert.ok(
        content.includes("Cài đặt ngay") || content.includes("Cài đặt ứng dụng"),
        "Must contain standard Vietnamese CTA"
      );
      assert.ok(
        content.includes("Để sau"),
        "Must contain polite dismiss CTA"
      );

      // Verify touch target >= 44px
      assert.ok(
        content.includes("min-h-[44px]") || content.includes("h-11"),
        "Buttons must meet minimum 44px touch target guideline"
      );
    });
  });
});
