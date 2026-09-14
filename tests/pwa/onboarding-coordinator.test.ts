import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
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

  describe("5. Deferred Prompt Capture, Standalone Detection & Listener Dedup", () => {
    it("calls preventDefault on the native beforeinstallprompt event and withholds the prompt", () => {
      let defaultPrevented = false;
      const fakePromptEvent = {
        preventDefault: () => {
          defaultPrevented = true;
        },
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
      } as unknown as BeforeInstallPromptEvent;

      coordinator.handleBeforeInstallPrompt(fakePromptEvent);

      assert.strictEqual(defaultPrevented, true, "Must preventDefault() on the native prompt");
      const state = coordinator.getState();
      assert.strictEqual(state.canShowInstallPrompt, false, "Must require engagement before prompting");
      assert.strictEqual(state.isInstallable, true);
    });

    it("detects installed standalone display-mode via matchMedia and disables prompt eligibility", () => {
      (global as any).window.matchMedia = (query: string) => ({
        matches: query.includes("display-mode: standalone"),
      });

      const standaloneCoordinator = new PWAOnboardingCoordinator();
      standaloneCoordinator.init("matrix-user-standalone");
      standaloneCoordinator.completeWelcome();
      standaloneCoordinator.recordAction("task_1");
      standaloneCoordinator.recordAction("task_2");

      const state = standaloneCoordinator.getState();
      assert.strictEqual(state.isInstalled, true);
      assert.strictEqual(state.canShowInstallPrompt, false);
    });

    it("captures beforeinstallprompt exactly once across repeated re-inits", () => {
      const originalWindow = globalThis.window;
      const originalLocalStorage = globalThis.localStorage;
      const originalSessionStorage = globalThis.sessionStorage;

      const registered: Record<string, number> = {};
      const fakeStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        length: 0,
        key: () => null,
      };
      const fakeWindow = {
        localStorage: fakeStorage,
        matchMedia: () => ({ matches: false }),
        addEventListener: (type: string) => {
          registered[type] = (registered[type] || 0) + 1;
        },
        removeEventListener: () => {},
      };

      Object.defineProperty(globalThis, "window", {
        value: fakeWindow,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "localStorage", {
        value: fakeStorage,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "sessionStorage", {
        value: fakeStorage,
        configurable: true,
        writable: true,
      });

      try {
        const dedupCoordinator = new PWAOnboardingCoordinator();
        dedupCoordinator.init("dedup-user-1");
        dedupCoordinator.init("dedup-user-2");
        dedupCoordinator.init("dedup-user-1");

        assert.strictEqual(
          registered["beforeinstallprompt"] ?? 0,
          1,
          "Only one beforeinstallprompt capture may be registered across re-inits"
        );
        assert.strictEqual(
          registered["appinstalled"] ?? 0,
          1,
          "Only one appinstalled listener may be registered across re-inits"
        );
      } finally {
        Object.defineProperty(globalThis, "window", {
          value: originalWindow,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(globalThis, "localStorage", {
          value: originalLocalStorage,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(globalThis, "sessionStorage", {
          value: originalSessionStorage,
          configurable: true,
          writable: true,
        });
      }
    });
  });
});
