import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  checkHasUnsavedChanges,
  registerServiceWorker,
  applyServiceWorkerUpdate,
  setupControllerChangeListener,
} from "../../src/components/pwa/pwa-service-worker-manager";

describe("Task 2: PWA Service Worker Manager & Safe Update UX", () => {
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
  });
});
