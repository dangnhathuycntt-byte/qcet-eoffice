import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  checkHasUnsavedChanges,
  registerServiceWorker,
  applyServiceWorkerUpdate,
  setupControllerChangeListener,
} from "../../src/components/pwa/pwa-service-worker-manager";

describe("Task 2: PWA Service Worker Manager & Safe Update UX", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const layoutPath = path.join(rootDir, "src", "app", "layout.tsx");
  const swManagerPath = path.join(
    rootDir,
    "src",
    "components",
    "pwa",
    "pwa-service-worker-manager.tsx"
  );
  const updateDialogPath = path.join(
    rootDir,
    "src",
    "components",
    "pwa",
    "pwa-update-dialog.tsx"
  );

  let originalNodeEnv: string | undefined;

  function setMockDom(mockWindow: unknown, mockDocument: unknown) {
    Object.defineProperty(globalThis, "window", {
      value: mockWindow,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "document", {
      value: mockDocument,
      configurable: true,
      writable: true,
    });
  }

  function setMockServiceWorker(sw: unknown) {
    try {
      Object.defineProperty(globalThis.navigator, "serviceWorker", {
        value: sw,
        configurable: true,
        writable: true,
      });
    } catch {
      // Fallback
    }
  }

  function clearMockDom() {
    try {
      delete (globalThis as unknown as { window?: unknown }).window;
    } catch {}
    try {
      delete (globalThis as unknown as { document?: unknown }).document;
    } catch {}
    try {
      delete (globalThis.navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
    } catch {}
  }

  beforeEach(() => {
    clearMockDom();
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    clearMockDom();
    (process.env as any).NODE_ENV = originalNodeEnv;
  });

  describe("1. Safe Update Protection & Dirty Form Detection", () => {
    it("returns false in clean state when window and document have no pending edits", () => {
      setMockDom(
        { __QCET_HAS_UNSAVED_CHANGES__: false },
        { querySelector: () => null, activeElement: null, forms: [] }
      );

      assert.strictEqual(checkHasUnsavedChanges(), false);
    });

    it("detects explicit application-level boolean flag (window.__QCET_HAS_UNSAVED_CHANGES__ = true)", () => {
      setMockDom(
        { __QCET_HAS_UNSAVED_CHANGES__: true },
        { querySelector: () => null, activeElement: null, forms: [] }
      );

      assert.strictEqual(checkHasUnsavedChanges(), true);
    });

    it("detects explicit application-level function flag (window.__QCET_HAS_UNSAVED_CHANGES__ = () => true)", () => {
      setMockDom(
        { __QCET_HAS_UNSAVED_CHANGES__: () => true },
        { querySelector: () => null, activeElement: null, forms: [] }
      );

      assert.strictEqual(checkHasUnsavedChanges(), true);

      setMockDom(
        { __QCET_HAS_UNSAVED_CHANGES__: () => false },
        { querySelector: () => null, activeElement: null, forms: [] }
      );
      assert.strictEqual(checkHasUnsavedChanges(), false);
    });

    it("detects DOM data-unsaved-changes or data-dirty attribute flags", () => {
      setMockDom(
        {},
        {
          querySelector: (sel: string) => {
            if (sel.includes("data-unsaved-changes") || sel.includes("data-dirty")) {
              return { nodeName: "DIV" };
            }
            return null;
          },
          activeElement: null,
          forms: [],
        }
      );

      assert.strictEqual(checkHasUnsavedChanges(), true);
    });

    it("detects active input focus with non-empty content", () => {
      class MockInput {
        type = "text";
        value = "Đang soạn thảo nhiệm vụ mới...";
      }

      (globalThis as unknown as { HTMLInputElement: typeof MockInput }).HTMLInputElement = MockInput;

      setMockDom(
        {},
        {
          querySelector: () => null,
          activeElement: new MockInput(),
          forms: [],
        }
      );

      assert.strictEqual(checkHasUnsavedChanges(), true);
    });

    it("detects active textarea focus with non-empty content", () => {
      class MockTextarea {
        value = "Ghi chú công việc...";
      }

      (globalThis as unknown as { HTMLTextAreaElement: typeof MockTextarea }).HTMLTextAreaElement =
        MockTextarea;

      setMockDom(
        {},
        {
          querySelector: () => null,
          activeElement: new MockTextarea(),
          forms: [],
        }
      );

      assert.strictEqual(checkHasUnsavedChanges(), true);
    });

    it("detects contenteditable active elements", () => {
      setMockDom(
        {},
        {
          querySelector: () => null,
          activeElement: { isContentEditable: true },
          forms: [],
        }
      );

      assert.strictEqual(checkHasUnsavedChanges(), true);
    });

    it("detects form element with modified defaultValue (value !== defaultValue)", () => {
      class MockInput {
        type = "text";
        defaultValue = "Kế hoạch ban đầu";
        value = "Kế hoạch đã sửa đổi";
      }

      (globalThis as unknown as { HTMLInputElement: typeof MockInput }).HTMLInputElement = MockInput;

      setMockDom(
        {},
        {
          querySelector: () => null,
          activeElement: null,
          forms: [
            {
              getAttribute: () => null,
              elements: [new MockInput()],
            },
          ],
        }
      );

      assert.strictEqual(checkHasUnsavedChanges(), true);
    });
  });

  describe("2. Safe Update Application (applyServiceWorkerUpdate)", () => {
    it("aborts update and triggers onBlockedByUnsaved when unsaved changes exist", () => {
      setMockDom(
        { __QCET_HAS_UNSAVED_CHANGES__: true },
        { querySelector: () => null, activeElement: null, forms: [] }
      );

      let blockedCalled = false;
      let postedMessage = false;

      const mockWorker = {
        postMessage: () => {
          postedMessage = true;
        },
      } as unknown as ServiceWorker;

      const result = applyServiceWorkerUpdate(mockWorker, {
        force: false,
        onBlockedByUnsaved: () => {
          blockedCalled = true;
        },
      });

      assert.strictEqual(result, false, "Must return false when blocked by unsaved changes");
      assert.strictEqual(blockedCalled, true, "Must call onBlockedByUnsaved callback");
      assert.strictEqual(postedMessage, false, "Must NOT send SKIP_WAITING message when dirty");
    });

    it("sends { type: 'SKIP_WAITING' } when form state is clean", () => {
      setMockDom(
        { __QCET_HAS_UNSAVED_CHANGES__: false },
        { querySelector: () => null, activeElement: null, forms: [] }
      );

      let sentPayload: unknown = null;
      const mockWorker = {
        postMessage: (payload: unknown) => {
          sentPayload = payload;
        },
      } as unknown as ServiceWorker;

      const result = applyServiceWorkerUpdate(mockWorker);

      assert.strictEqual(result, true, "Must return true when update applied");
      assert.deepStrictEqual(sentPayload, { type: "SKIP_WAITING" });
    });

    it("allows force update bypass when force: true is explicitly provided", () => {
      setMockDom(
        { __QCET_HAS_UNSAVED_CHANGES__: true },
        { querySelector: () => null, activeElement: null, forms: [] }
      );

      let sentPayload: unknown = null;
      const mockWorker = {
        postMessage: (payload: unknown) => {
          sentPayload = payload;
        },
      } as unknown as ServiceWorker;

      const result = applyServiceWorkerUpdate(mockWorker, { force: true });
      assert.strictEqual(result, true);
      assert.deepStrictEqual(sentPayload, { type: "SKIP_WAITING" });
    });
  });

  describe("3. Service Worker Registration & Update Detection", () => {
    it("registers /sw.js and invokes onWaiting when registration.waiting is present", async () => {
      (process.env as any).NODE_ENV = "production";

      let registeredUrl = "";
      let registeredScope = "";

      const mockWaitingWorker = { state: "installed" } as ServiceWorker;
      const mockRegistration = {
        waiting: mockWaitingWorker,
        installing: null,
        addEventListener: () => {},
      } as unknown as ServiceWorkerRegistration;

      setMockDom({}, {});
      setMockServiceWorker({
        register: async (url: string, opts?: { scope?: string }) => {
          registeredUrl = url;
          registeredScope = opts?.scope || "";
          return mockRegistration;
        },
        controller: {},
      });

      let capturedWaitingWorker: ServiceWorker | null = null;
      const reg = await registerServiceWorker({
        onWaiting: (worker) => {
          capturedWaitingWorker = worker;
        },
      });

      assert.ok(reg, "Must return registration object");
      assert.strictEqual(registeredUrl, "/sw.js");
      assert.strictEqual(registeredScope, "/");
      assert.strictEqual(capturedWaitingWorker, mockWaitingWorker);
    });

    it("detects update when installing worker transitions to installed state with active controller", async () => {
      (process.env as any).NODE_ENV = "production";

      const listeners: Record<string, () => void> = {};
      const installingListeners: Record<string, () => void> = {};

      const mockInstallingWorker = {
        state: "installing",
        addEventListener: (event: string, handler: () => void) => {
          installingListeners[event] = handler;
        },
      } as unknown as ServiceWorker;

      const mockRegistration = {
        waiting: null,
        installing: mockInstallingWorker,
        addEventListener: (event: string, handler: () => void) => {
          listeners[event] = handler;
        },
      } as unknown as ServiceWorkerRegistration;

      setMockDom({}, {});
      setMockServiceWorker({
        register: async () => mockRegistration,
        controller: { state: "activated" }, // Active controller indicates an update
      });

      let updateFoundWorker: ServiceWorker | null = null;
      await registerServiceWorker({
        onUpdateFound: (worker) => {
          updateFoundWorker = worker;
        },
      });

      assert.ok(listeners["updatefound"], "Must register updatefound listener");

      // Trigger updatefound
      listeners["updatefound"]();

      assert.ok(
        installingListeners["statechange"],
        "Must register statechange listener on installing worker"
      );

      // Simulate installing -> installed transition
      (mockInstallingWorker as { state: string }).state = "installed";
      installingListeners["statechange"]();

      assert.strictEqual(updateFoundWorker, mockInstallingWorker);
    });

    it("does NOT signal update when controller is absent (first-time PWA install)", async () => {
      (process.env as any).NODE_ENV = "production";

      const listeners: Record<string, () => void> = {};
      const installingListeners: Record<string, () => void> = {};

      const mockInstallingWorker = {
        state: "installing",
        addEventListener: (event: string, handler: () => void) => {
          installingListeners[event] = handler;
        },
      } as unknown as ServiceWorker;

      const mockRegistration = {
        waiting: null,
        installing: mockInstallingWorker,
        addEventListener: (event: string, handler: () => void) => {
          listeners[event] = handler;
        },
      } as unknown as ServiceWorkerRegistration;

      setMockDom({}, {});
      setMockServiceWorker({
        register: async () => mockRegistration,
        controller: null, // First time visit, no prior controlling SW
      });

      let updateFoundWorker: ServiceWorker | null = null;
      await registerServiceWorker({
        onUpdateFound: (worker) => {
          updateFoundWorker = worker;
        },
      });

      listeners["updatefound"]?.();
      (mockInstallingWorker as { state: string }).state = "installed";
      installingListeners["statechange"]?.();

      assert.strictEqual(
        updateFoundWorker,
        null,
        "Must not trigger update prompt on initial first-time install"
      );
    });
  });

  describe("3b. Controller Change Handling & First-Time Installation Safeguard", () => {
    it("does NOT reload window on initial controllerchange when hadController is false (first-time install client claim)", () => {
      let controllerChangeHandler: any = null;
      let reloadCount = 0;

      setMockDom({}, {});
      setMockServiceWorker({
        controller: null, // First-time visit: no active controller
        addEventListener: (event: string, handler: () => void) => {
          if (event === "controllerchange") {
            controllerChangeHandler = handler;
          }
        },
        removeEventListener: (event: string) => {
          if (event === "controllerchange") {
            controllerChangeHandler = null;
          }
        },
      });

      setupControllerChangeListener(() => {
        reloadCount++;
      });

      assert.ok(controllerChangeHandler, "controllerchange listener must be registered");

      // Simulate first-time install: sw activates and calls clients.claim()
      controllerChangeHandler?.();

      assert.strictEqual(
        reloadCount,
        0,
        "Must NOT reload window on initial controller claim (first-time PWA install)"
      );
    });

    it("reloads window on subsequent controllerchange after first-time installation claim", () => {
      let controllerChangeHandler: any = null;
      let reloadCount = 0;

      setMockDom({}, {});
      setMockServiceWorker({
        controller: null, // Initially null
        addEventListener: (event: string, handler: () => void) => {
          if (event === "controllerchange") {
            controllerChangeHandler = handler;
          }
        },
        removeEventListener: (event: string) => {
          if (event === "controllerchange") {
            controllerChangeHandler = null;
          }
        },
      });

      setupControllerChangeListener(() => {
        reloadCount++;
      });

      // 1. Initial claim: no reload
      controllerChangeHandler?.();
      assert.strictEqual(reloadCount, 0, "No reload on first claim");

      // 2. Subsequent update takes over (e.g. user triggers update later): must reload
      controllerChangeHandler?.();
      assert.strictEqual(
        reloadCount,
        1,
        "Must reload window on subsequent controller change when SW update activates"
      );
    });

    it("reloads window immediately when an existing controller was already present (hadController is true)", () => {
      let controllerChangeHandler: any = null;
      let reloadCount = 0;

      setMockDom({}, {});
      setMockServiceWorker({
        controller: { state: "activated" }, // User already has installed SW
        addEventListener: (event: string, handler: () => void) => {
          if (event === "controllerchange") {
            controllerChangeHandler = handler;
          }
        },
        removeEventListener: () => {},
      });

      setupControllerChangeListener(() => {
        reloadCount++;
      });

      // Controller replaced by update
      controllerChangeHandler?.();

      assert.strictEqual(
        reloadCount,
        1,
        "Must reload immediately when replacing an existing active controller"
      );
    });

    it("guards against multiple rapid controllerchange events (refreshing deduplication)", () => {
      let controllerChangeHandler: any = null;
      let reloadCount = 0;

      setMockDom({}, {});
      setMockServiceWorker({
        controller: { state: "activated" },
        addEventListener: (event: string, handler: () => void) => {
          if (event === "controllerchange") {
            controllerChangeHandler = handler;
          }
        },
        removeEventListener: () => {},
      });

      setupControllerChangeListener(() => {
        reloadCount++;
      });

      controllerChangeHandler?.();
      controllerChangeHandler?.();
      controllerChangeHandler?.();

      assert.strictEqual(
        reloadCount,
        1,
        "Must only trigger a single reload despite multiple rapid controllerchange events"
      );
    });

    it("cleans up controllerchange event listener on unmount", () => {
      let removedListener = false;

      setMockDom({}, {});
      setMockServiceWorker({
        controller: null,
        addEventListener: () => {},
        removeEventListener: (event: string) => {
          if (event === "controllerchange") {
            removedListener = true;
          }
        },
      });

      const cleanup = setupControllerChangeListener();
      assert.ok(typeof cleanup === "function");
      cleanup();

      assert.strictEqual(removedListener, true, "Must remove controllerchange listener on cleanup");
    });

    it("separates service worker registration effect from form activity listener", () => {
      const content = fs.readFileSync(swManagerPath, "utf-8");

      // Verify registration effect has empty dependency array []
      assert.ok(
        content.includes("void registerServiceWorker"),
        "Must invoke registerServiceWorker in manager"
      );
      assert.ok(
        content.includes('window.removeEventListener("qcet:check-sw-update", handleManualCheck);') &&
          content.includes("  }, []);"),
        "Registration effect must have empty dependency array [] to run once on mount"
      );

      // Verify form activity listener is isolated with [updateAvailable] dependency array
      assert.ok(
        content.includes('window.addEventListener("input", handleActivity, { passive: true });') &&
          content.includes("  }, [updateAvailable]);"),
        "Form activity listeners must be in a dedicated effect depending on [updateAvailable]"
      );
    });
  });

  describe("4. PWAUpdateDialog UX & Anti-Slop Component Contract", () => {
    it("dialog file exists and contains compliant Vietnamese warning and CTA copy", () => {
      assert.ok(fs.existsSync(updateDialogPath), "PWAUpdateDialog component file must exist");
      const content = fs.readFileSync(updateDialogPath, "utf-8");

      // Dirty warning copy
      assert.ok(
        content.includes("Có bản cập nhật mới. Vui lòng hoàn tất biểu mẫu trước khi cập nhật."),
        "Must include exact dirty-form protection warning copy"
      );

      // Clean update copy
      assert.ok(
        content.includes("Có phiên bản QCET E-Office mới"),
        "Must include new version notification title"
      );
      assert.ok(
        content.includes("Cập nhật ngay"),
        "Must include [Cập nhật ngay] CTA button"
      );
      assert.ok(
        content.includes("Để sau"),
        "Must include [Để sau] dismiss button"
      );
    });

    it("adheres to light-only anti-slop rules (0 dark: classes, 0 emojis)", () => {
      const dialogContent = fs.readFileSync(updateDialogPath, "utf-8");
      const managerContent = fs.readFileSync(swManagerPath, "utf-8");

      // 0 dark: classes
      assert.ok(
        !dialogContent.includes("dark:"),
        "PWAUpdateDialog must not contain dark: theme classes"
      );
      assert.ok(
        !managerContent.includes("dark:"),
        "PWAServiceWorkerManager must not contain dark: theme classes"
      );

      // 0 emojis
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      assert.ok(
        !emojiRegex.test(dialogContent),
        "PWAUpdateDialog must contain zero emojis"
      );
      assert.ok(
        !emojiRegex.test(managerContent),
        "PWAServiceWorkerManager must contain zero emojis"
      );
    });

    it("provides mobile touch target ergonomics (min-h-[44px])", () => {
      const content = fs.readFileSync(updateDialogPath, "utf-8");
      assert.ok(
        content.includes("min-h-[44px]"),
        "PWAUpdateDialog action buttons must provide minimum 44px touch targets"
      );
    });

    it("has accessible ARIA roles and labels", () => {
      const content = fs.readFileSync(updateDialogPath, "utf-8");
      assert.ok(
        content.includes('role="region"'),
        "PWAUpdateDialog must define accessible role"
      );
      assert.ok(
        content.includes('aria-label="Thông báo cập nhật QCET E-Office"'),
        "PWAUpdateDialog must define accessible aria-label"
      );
    });
  });

  describe("5. Root Layout Integration (src/app/layout.tsx)", () => {
    it("mounts PWAServiceWorkerManager in RootLayout", () => {
      const content = fs.readFileSync(layoutPath, "utf-8");
      assert.ok(
        content.includes("import { PWAServiceWorkerManager }"),
        "layout.tsx must import PWAServiceWorkerManager"
      );
      assert.ok(
        content.includes("<PWAServiceWorkerManager />"),
        "layout.tsx must render <PWAServiceWorkerManager />"
      );
    });

    it("removes legacy inline service worker registration script from layout.tsx", () => {
      const content = fs.readFileSync(layoutPath, "utf-8");
      assert.ok(
        !content.includes("navigator.serviceWorker.register"),
        "layout.tsx must NOT contain inline navigator.serviceWorker.register script"
      );
    });

    it("preserves display density pre-hydration script in <head>", () => {
      const content = fs.readFileSync(layoutPath, "utf-8");
      assert.ok(
        content.includes("qcet-display-density"),
        "layout.tsx must preserve qcet-display-density pre-hydration script"
      );
    });
  });
});
