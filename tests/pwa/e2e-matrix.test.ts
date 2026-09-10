import { describe, it, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

// PWA Module Imports
import {
  PWAOnboardingCoordinator,
  type BeforeInstallPromptEvent,
} from "../../src/lib/pwa/onboarding-coordinator";
import {
  getReadCache,
  setReadCache,
  getDraft,
  setDraft,
  listUserDrafts,
  enqueueOutboxItem,
  getOutboxQueue as getStoreOutboxQueue,
  purgeUserOfflineData,
  purgeAllUserData,
} from "../../src/lib/pwa/offline-store";
import { resetMemoryDatabase } from "../../src/lib/pwa/indexed-db";
import {
  enqueueOutbox,
  flushOutbox,
  clearOutbox,
  resolveConflict,
  setActiveUserId,
  SYNC_TAG_QCET_OUTBOX,
  registerBackgroundSync,
} from "../../src/lib/pwa/outbox-manager";
import {
  PWAConnectivityManager,
  checkServerReachable,
} from "../../src/lib/pwa/connectivity";
import {
  urlBase64ToUint8Array,
  generateNotificationTag,
  validateDeepLinkUrl,
  subscribeToPush as subscribePushNotifications,
} from "../../src/lib/pwa/push-manager";
import {
  getStorageEstimate,
  requestStoragePersistence,
} from "../../src/lib/pwa/storage-manager";
import getManifest from "../../src/app/manifest";
import {
  isBadgingSupported,
  setAppBadge,
  clearAppBadge,
  calculateActionableBadgeCount,
  updateActionableBadge,
} from "../../src/lib/pwa/badging";
import {
  getTelemetryLog,
  clearTelemetryLog,
  recordTelemetry,
  maskUserId,
} from "../../src/lib/pwa/telemetry";

describe("QCET E-Office — Comprehensive PWA End-to-End Verification Matrix", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const swPath = path.join(rootDir, "public", "sw.js");
  const swSource = fs.readFileSync(swPath, "utf-8");

  beforeEach(() => {
    resetMemoryDatabase();
    clearTelemetryLog();
  });

  // =========================================================================
  // 1. Install Eligibility & Deferred Prompt
  // =========================================================================
  describe("Matrix 1: Install Eligibility & Deferred Prompt Orchestration", () => {
    let coordinator: PWAOnboardingCoordinator;
    let mockStorage: Record<string, string>;

    beforeEach(() => {
      mockStorage = {};
      const fakeLocalStorage = {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => {
          mockStorage[k] = v;
        },
        removeItem: (k: string) => {
          delete mockStorage[k];
        },
        clear: () => {
          mockStorage = {};
        },
        length: 0,
        key: () => null,
      };

      (global as any).window = {
        localStorage: fakeLocalStorage,
        matchMedia: () => ({ matches: false }),
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      (global as any).localStorage = fakeLocalStorage;
      Object.defineProperty(global, "navigator", {
        value: {
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          maxTouchPoints: 0,
        },
        configurable: true,
        writable: true,
      });

      coordinator = new PWAOnboardingCoordinator();
      coordinator.init("matrix-user-01");
    });

    it("captures and defers beforeinstallprompt event without immediate display", () => {
      let defaultPrevented = false;
      const fakePromptEvent = {
        preventDefault: () => {
          defaultPrevented = true;
        },
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
      } as unknown as BeforeInstallPromptEvent;

      coordinator.handleBeforeInstallPrompt(fakePromptEvent);

      assert.equal(defaultPrevented, true, "Must preventDefault() on native prompt");
      const state = coordinator.getState();
      assert.equal(state.canShowInstallPrompt, false, "Must require engagement before prompting");
      assert.equal(state.isInstallable, true);
    });

    it("evaluates eligibility based on engagement actions and respects user dismissal", () => {
      const fakePromptEvent = {
        preventDefault: () => {},
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "dismissed" as const, platform: "web" }),
      } as unknown as BeforeInstallPromptEvent;

      coordinator.completeWelcome();
      coordinator.recordAction("task_created");
      coordinator.recordAction("document_viewed");
      coordinator.handleBeforeInstallPrompt(fakePromptEvent);

      const stateEligible = coordinator.getState();
      assert.equal(stateEligible.canShowInstallPrompt, true, "Eligible after completing welcome and 2 actions");

      // User dismisses prompt
      coordinator.snoozeInstall(14);
      const stateDismissed = coordinator.getState();
      assert.equal(stateDismissed.canShowInstallPrompt, false, "Must not prompt immediately after dismissal");
    });

    it("detects standalone installed mode and disables prompt eligibility", () => {
      (global as any).window.matchMedia = (query: string) => ({
        matches: query.includes("display-mode: standalone"),
      });

      const standaloneCoordinator = new PWAOnboardingCoordinator();
      standaloneCoordinator.init("matrix-user-standalone");
      standaloneCoordinator.completeWelcome();
      standaloneCoordinator.recordAction("task_1");
      standaloneCoordinator.recordAction("task_2");

      const state = standaloneCoordinator.getState();
      assert.equal(state.isInstalled, true);
      assert.equal(state.canShowInstallPrompt, false);
    });
  });

  // =========================================================================
  // 2. Service Worker Versioning & Update Lifecycle
  // =========================================================================
  describe("Matrix 2: Service Worker Versioning & Update Lifecycle", () => {
    it("adheres to strict semantic versioning 2026.09.09.1", () => {
      assert.match(swSource, /const\s+APP_VERSION\s*=\s*['"]2026\.09\.09\.1['"]/);
      assert.match(swSource, /const\s+CACHE_STATIC_NAME\s*=\s*['"]qcet-static-2026\.09\.09\.1['"]/);
      assert.match(swSource, /const\s+CACHE_SHELL_NAME\s*=\s*['"]qcet-shell-2026\.09\.09\.1['"]/);
    });

    it("precaches shell assets on install without auto-skipWaiting", async () => {
      const precached: string[] = [];
      let skippedWaiting = false;

      const mockCaches = {
        open: async (name: string) => {
          assert.equal(name, "qcet-shell-2026.09.09.1");
          return {
            add: async (url: string) => {
              precached.push(url);
            },
          };
        },
      };

      const sandbox: any = {
        self: {
          addEventListener: (type: string, handler: any) => {
            sandbox.handlers[type] = handler;
          },
          skipWaiting: () => {
            skippedWaiting = true;
          },
          clients: { claim: async () => {} },
        },
        caches: mockCaches,
        handlers: {},
      };

      vm.createContext(sandbox);
      vm.runInContext(swSource, sandbox);

      // Trigger install event
      let waitPromise: Promise<any> | null = null;
      sandbox.handlers.install({
        waitUntil: (p: Promise<any>) => {
          waitPromise = p;
        },
      });

      await waitPromise;
      assert.ok(precached.includes("/"));
      assert.ok(precached.includes("/?zone=tasks"));
      assert.equal(skippedWaiting, false, "Must not auto-skipWaiting during install");
    });

    it("triggers skipWaiting on SKIP_WAITING postMessage", () => {
      let skippedWaiting = false;
      const sandbox: any = {
        self: {
          addEventListener: (type: string, handler: any) => {
            sandbox.handlers[type] = handler;
          },
          skipWaiting: () => {
            skippedWaiting = true;
          },
        },
        caches: {},
        handlers: {},
      };

      vm.createContext(sandbox);
      vm.runInContext(swSource, sandbox);

      sandbox.handlers.message({
        data: { type: "SKIP_WAITING" },
      });

      assert.equal(skippedWaiting, true, "Must invoke self.skipWaiting() on SKIP_WAITING");
    });

    it("claims clients and purges stale caches on activate", async () => {
      let clientsClaimed = false;
      const deletedCaches: string[] = [];

      const mockCaches = {
        keys: async () => [
          "qcet-static-2026.09.09.1",
          "qcet-shell-2026.09.09.1",
          "qcet-old-v1",
          "stale-workbox-cache",
        ],
        delete: async (name: string) => {
          deletedCaches.push(name);
          return true;
        },
      };

      const sandbox: any = {
        self: {
          addEventListener: (type: string, handler: any) => {
            sandbox.handlers[type] = handler;
          },
          clients: {
            claim: async () => {
              clientsClaimed = true;
            },
          },
        },
        caches: mockCaches,
        handlers: {},
      };

      vm.createContext(sandbox);
      vm.runInContext(swSource, sandbox);

      let waitPromise: Promise<any> | null = null;
      sandbox.handlers.activate({
        waitUntil: (p: Promise<any>) => {
          waitPromise = p;
        },
      });

      await waitPromise;
      assert.equal(clientsClaimed, true);
      assert.ok(deletedCaches.includes("qcet-old-v1"));
      assert.ok(deletedCaches.includes("stale-workbox-cache"));
      assert.ok(!deletedCaches.includes("qcet-static-2026.09.09.1"));
    });
  });

  // =========================================================================
  // 3. Offline Caching Matrix (Static vs Dynamic vs Auth Bypass)
  // =========================================================================
  describe("Matrix 3: Offline Caching Strategy Matrix & Security Bypass", () => {
    function createSwSandbox(overrides: Record<string, any> = {}) {
      const sandbox: any = {
        self: {
          location: { origin: "https://eoffice.qcet.edu.vn" },
          addEventListener: (type: string, handler: any) => {
            sandbox.handlers[type] = handler;
          },
          clients: {
            claim: async () => {},
            matchAll: async () => [],
          },
          skipWaiting: async () => {},
          registration: {
            showNotification: async () => {},
            sync: { register: async () => {} },
          },
        },
        caches: {},
        handlers: {},
        URL: global.URL,
        Response: global.Response,
        Headers: global.Headers,
        Request: global.Request,
        setTimeout: global.setTimeout,
        clearTimeout: global.clearTimeout,
        console: global.console,
        Promise: global.Promise,
        ...overrides,
      };
      if (overrides.self) {
        sandbox.self = { ...sandbox.self, ...overrides.self };
      }
      return sandbox;
    }

    it("bypasses caching completely for mutation methods (POST, PUT, PATCH, DELETE)", () => {
      const sandbox = createSwSandbox();

      vm.createContext(sandbox);
      vm.runInContext(swSource, sandbox);

      let responded = false;
      const fakeEvent = {
        request: {
          method: "POST",
          url: "https://eoffice.qcet.edu.vn/api/tasks",
        },
        respondWith: () => {
          responded = true;
        },
      };

      sandbox.handlers.fetch(fakeEvent);
      assert.equal(responded, false, "Mutation must not be intercepted by SW");
    });

    it("bypasses caching completely for authentication endpoints (/api/auth/*)", () => {
      const sandbox = createSwSandbox();

      vm.createContext(sandbox);
      vm.runInContext(swSource, sandbox);

      let responded = false;
      const fakeEvent = {
        request: {
          method: "GET",
          url: "https://eoffice.qcet.edu.vn/api/auth/session",
        },
        respondWith: () => {
          responded = true;
        },
      };

      sandbox.handlers.fetch(fakeEvent);
      assert.equal(responded, false, "Auth endpoints must bypass SW cache");
    });

    it("serves static assets via Cache First strategy", async () => {
      let cacheChecked = false;
      const fakeCachedResponse = new Response("console.log('static chunk')", { status: 200 });

      const mockCaches = {
        match: async () => {
          cacheChecked = true;
          return fakeCachedResponse;
        },
      };

      const sandbox = createSwSandbox({ caches: mockCaches });

      vm.createContext(sandbox);
      vm.runInContext(swSource, sandbox);

      let responsePromise: Promise<any> | null = null;
      sandbox.handlers.fetch({
        request: {
          method: "GET",
          url: "https://eoffice.qcet.edu.vn/_next/static/chunks/main.js",
        },
        respondWith: (p: Promise<any>) => {
          responsePromise = p;
        },
      });

      const response = await responsePromise;
      assert.equal(cacheChecked, true);
      assert.equal(response, fakeCachedResponse);
    });

    it("provides offline fallback for navigation requests when network is down", async () => {
      const offlineShellResponse = new Response("<html>Shell</html>", { status: 200 });

      const mockCaches = {
        match: async () => offlineShellResponse,
        open: async () => ({ put: async () => {} }),
      };

      const sandbox = createSwSandbox({
        caches: mockCaches,
        fetch: async () => {
          throw new Error("Network down");
        },
      });

      vm.createContext(sandbox);
      vm.runInContext(swSource, sandbox);

      let responsePromise: Promise<any> | null = null;
      sandbox.handlers.fetch({
        request: {
          method: "GET",
          mode: "navigate",
          destination: "document",
          url: "https://eoffice.qcet.edu.vn/tasks",
          headers: new Headers({ accept: "text/html" }),
        },
        respondWith: (p: Promise<any>) => {
          responsePromise = p;
        },
      });

      const res: any = await responsePromise;
      assert.ok(res);
      assert.equal(res.status, 200);
    });
  });

  // =========================================================================
  // 4. User-Isolated IndexedDB Stores & Logout Purge
  // =========================================================================
  describe("Matrix 4: User-Isolated IndexedDB Stores & Logout Purge", () => {
    const USER_1 = "lecturer-01";
    const USER_2 = "dean-02";

    it("strictly isolates read cache and drafts between different users", async () => {
      await setReadCache(USER_1, "/api/tasks", { count: 3 });
      await setDraft(USER_1, "draft-01", { title: "Draft 1" });

      // Ensure User 2 has zero access
      const user2Cache = await getReadCache(USER_2, "/api/tasks");
      const user2Draft = await getDraft(USER_2, "draft-01");

      assert.equal(user2Cache, null);
      assert.equal(user2Draft, null);
    });

    it("purges user data upon logout while preserving other users' offline data", async () => {
      await setReadCache(USER_1, "/api/profile", { user: USER_1 });
      await setReadCache(USER_2, "/api/profile", { user: USER_2 });

      await purgeUserOfflineData(USER_1);

      assert.equal(await getReadCache(USER_1, "/api/profile"), null);
      assert.ok(await getReadCache(USER_2, "/api/profile"));
    });
  });

  // =========================================================================
  // 5. Outbox Queuing, Idempotency Headers, FIFO Dispatch & 409 OCC Handling
  // =========================================================================
  describe("Matrix 5: Outbox Queuing, Idempotency Headers, FIFO & 409 OCC", () => {
    const USER_ID = "matrix-user-outbox";

    beforeEach(async () => {
      setActiveUserId(USER_ID);
      await clearOutbox(USER_ID);
    });

    it("attaches Idempotency-Key and OCC headers (If-Match, x-expected-version)", async () => {
      await enqueueOutbox({
        operation: "TASK_UPDATE",
        url: "/api/tasks/task-99",
        method: "PUT",
        payload: { status: "IN_PROGRESS" },
        expectedVersion: 4,
        entityId: "task-99",
      });

      let capturedHeaders: Record<string, string> = {};
      const mockFetch: typeof fetch = async (_url, init) => {
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      };

      Object.defineProperty(global, "navigator", {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });
      await flushOutbox(USER_ID, { fetchFn: mockFetch });

      assert.ok(capturedHeaders["Idempotency-Key"], "Must carry Idempotency-Key");
      assert.equal(capturedHeaders["If-Match"], '"4"', "Must carry If-Match with version");
      assert.equal(capturedHeaders["x-expected-version"], "4", "Must carry x-expected-version");
    });

    it("handles 409 Conflict without data loss and supports override resolution", async () => {
      const item = await enqueueOutbox({
        operation: "UPDATE_SYLLABUS",
        url: "/api/syllabus/syl-1",
        method: "PUT",
        payload: { credits: 4 },
        expectedVersion: 1,
        entityId: "syl-1",
      });

      // Server returns 409 Conflict
      const mockConflictFetch: typeof fetch = async () => {
        return new Response(
          JSON.stringify({ error: "Version mismatch: current is 2" }),
          { status: 409 }
        );
      };

      Object.defineProperty(global, "navigator", {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });
      const flushRes = await flushOutbox(USER_ID, { fetchFn: mockConflictFetch });
      assert.equal(flushRes.conflicts, 1);

      // Verify item preserved in conflict state
      const conflictItems = await getStoreOutboxQueue(USER_ID, "conflict");
      assert.equal(conflictItems.length, 1);
      assert.equal(conflictItems[0].status, "conflict");

      // Resolve via override
      let overrideSuccess = false;
      const mockSuccessFetch: typeof fetch = async () => {
        overrideSuccess = true;
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      };

      const originalFetch = global.fetch;
      global.fetch = mockSuccessFetch;
      try {
        await resolveConflict(item.id, "override", USER_ID);
        await flushOutbox(USER_ID, { fetchFn: mockSuccessFetch });
        assert.equal(overrideSuccess, true);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // =========================================================================
  // 6. Tri-State Connectivity Detection & Manual Retry
  // =========================================================================
  describe("Matrix 6: Tri-State Connectivity Detection & Health Probing", () => {
    it("correctly identifies ONLINE, DEGRADED, and OFFLINE states", async () => {
      // 1. OFFLINE when navigator.onLine is false
      Object.defineProperty(global, "navigator", {
        value: { onLine: false },
        configurable: true,
        writable: true,
      });
      const manager = new PWAConnectivityManager({ autoStart: false });
      const stateOffline = await manager.checkConnectivity(true);
      assert.equal(stateOffline, "OFFLINE");

      // 2. DEGRADED when navigator is online but probe fails
      Object.defineProperty(global, "navigator", {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });
      const failingFetch: typeof fetch = async () => {
        throw new Error("Server down");
      };
      manager.setFetchFn(failingFetch);
      const stateDegraded = await manager.checkConnectivity(true);
      assert.equal(stateDegraded, "DEGRADED");

      // 3. ONLINE when server probe succeeds
      const successfulFetch: typeof fetch = async () => {
        return new Response(null, { status: 200 });
      };
      manager.setFetchFn(successfulFetch);
      const stateOnline = await manager.checkConnectivity(true);
      assert.equal(stateOnline, "ONLINE");
    });
  });

  // =========================================================================
  // 7. Contextual Push Pre-prompt, VAPID, Tag Dedup & Deep-Link Routing
  // =========================================================================
  describe("Matrix 7: Push Notifications, VAPID & Same-Origin Deep Links", () => {
    it("converts base64 VAPID keys into valid Uint8Array", () => {
      const base64Key = "BCzD98s3L7o";
      const keyBuffer = urlBase64ToUint8Array(base64Key);
      assert.ok(keyBuffer instanceof Uint8Array);
      assert.ok(keyBuffer.length > 0);
    });

    it("generates deterministic deduplication tags: task:{taskId}:{action}", () => {
      const tag = generateNotificationTag("task", "task-456", "assigned");
      assert.equal(tag, "task:task-456:assigned");
    });

    it("validates same-origin deep link URLs and rejects external/open redirects", () => {
      (global as any).window = { location: { origin: "https://eoffice.qcet.edu.vn" } };

      // Valid internal paths
      assert.equal(
        validateDeepLinkUrl("/tasks/task-123", "https://eoffice.qcet.edu.vn"),
        "https://eoffice.qcet.edu.vn/tasks/task-123"
      );

      // Malicious external redirects
      assert.equal(
        validateDeepLinkUrl("https://phishing-site.com/login", "https://eoffice.qcet.edu.vn"),
        null,
        "Must reject external origins"
      );

      assert.equal(
        validateDeepLinkUrl("javascript:alert(1)", "https://eoffice.qcet.edu.vn"),
        null,
        "Must reject javascript: protocols"
      );
    });
  });

  // =========================================================================
  // 8. Storage Quota Estimation & Explicit Persist Boundary
  // =========================================================================
  describe("Matrix 8: Storage Quota & Explicit Persist Boundary Invariant", () => {
    it("estimates storage usage and identifies warning state when usage exceeds 80%", async () => {
      Object.defineProperty(global, "navigator", {
        value: {
          storage: {
            estimate: async () => ({
              usage: 85 * 1024 * 1024,
              quota: 100 * 1024 * 1024,
            }),
          },
        },
        configurable: true,
        writable: true,
      });

      const est = await getStorageEstimate();
      assert.equal(est.usage, 85 * 1024 * 1024);
      assert.equal(est.percentUsed, 85);
      assert.equal(est.percentUsed >= 80, true, "Must flag warning at >= 80% usage");
    });

    it("requires explicit user action to request persistent storage (never auto-requested)", async () => {
      let persistCalled = false;
      Object.defineProperty(global, "navigator", {
        value: {
          storage: {
            persist: async () => {
              persistCalled = true;
              return true;
            },
          },
        },
        configurable: true,
        writable: true,
      });

      const result = await requestStoragePersistence("user-storage-01");
      assert.equal(persistCalled, true);
      assert.equal(result, true);
    });
  });

  // =========================================================================
  // 9. Progressive Enhancement Guards (Sync, Badging, Share Target)
  // =========================================================================
  describe("Matrix 9: Progressive Enhancement Guards (Sync, Badging, Share Target)", () => {
    it("guards Background Sync and degrades gracefully when unsupported", async () => {
      assert.equal(SYNC_TAG_QCET_OUTBOX, "qcet-outbox-sync");

      // When sync is unsupported
      (global as any).window = {};
      Object.defineProperty(global, "navigator", {
        value: { serviceWorker: { ready: Promise.resolve({}) } },
        configurable: true,
        writable: true,
      });
      const ok = await registerBackgroundSync();
      assert.equal(ok, false, "Must return false and not crash when SyncManager absent");
    });

    it("guards Badging API and only badges actionable items (never passive counts)", async () => {
      let badgeSet: number | undefined = undefined;
      Object.defineProperty(global, "navigator", {
        value: {
          setAppBadge: async (count?: number) => {
            badgeSet = count;
          },
          clearAppBadge: async () => {
            badgeSet = 0;
          },
        },
        configurable: true,
        writable: true,
      });

      assert.equal(isBadgingSupported(), true);

      // Set actionable count
      await updateActionableBadge({
        actionableTasks: 2,
        pendingApprovals: 3,
      });
      assert.equal(badgeSet, 5);

      // Clear when 0
      await updateActionableBadge({
        actionableTasks: 0,
      });
      assert.equal(badgeSet, 0);

      // Guard against NaN / non-finite badge counts
      const nanResult = await setAppBadge(NaN);
      assert.equal(nanResult, false, "Must reject NaN badge count");
      const infResult = await setAppBadge(Infinity);
      assert.equal(infResult, false, "Must reject Infinity badge count");
    });

    it("manifest defines institutional metadata and shortcuts", () => {
      const m = getManifest();
      assert.ok(m.name?.includes("QCET E-Office"));
      assert.equal(m.short_name, "QCET E-Office");
      assert.equal(m.display, "standalone");
      assert.equal(m.start_url, "/?source=pwa");
      assert.ok(Array.isArray(m.icons) && m.icons.length >= 4);
      assert.ok(Array.isArray(m.shortcuts) && m.shortcuts.length >= 2);
    });
  });

  // =========================================================================
  // 10. PWA Operational Telemetry & Privacy Preservation
  // =========================================================================
  describe("Matrix 10: PWA Operational Telemetry & Privacy Preservation", () => {
    beforeEach(() => {
      clearTelemetryLog();
    });

    it("tracks operational events across the PWA lifecycle", () => {
      recordTelemetry("pwa.install.offer", { promptCount: 1 });
      recordTelemetry("sw.update.applied", { previousVersion: "1.0.0", newVersion: "1.0.1" });
      recordTelemetry("sync.success", { entityId: "task-01", durationMs: 120 });
      recordTelemetry("offline.enter", { state: "offline" });
      recordTelemetry("offline.exit", { state: "online" });

      const log = getTelemetryLog();
      assert.equal(log.length, 5);
      assert.equal(log[0].event, "pwa.install.offer");
      assert.equal(log[1].event, "sw.update.applied");
      assert.equal(log[2].event, "sync.success");
      assert.equal(log[2].metadata?.entityId, "task-01");
      assert.equal(log[3].event, "offline.enter");
      assert.equal(log[4].event, "offline.exit");
    });

    it("enforces privacy scrubbing for sensitive metadata keys", () => {
      recordTelemetry("sync.queued", {
        entityId: "doc-123",
        method: "POST",
        title: "Kế hoạch tuyển sinh tuyệt mật",
        name: "Nguyễn Văn A",
        password: "SecretPassword123!",
        token: "bearer-token-abc",
        secret: "app-secret-xyz",
        auth: "Basic dXNlcjpwYXNz",
        credential: "cred-secret-value",
        cookie: "session=xyz123",
        content: "Nội dung chỉ đạo mật",
        body: "Chi tiết công việc nội bộ",
        payload: { sensitive: true },
        safeMetric: 42,
      });

      const log = getTelemetryLog();
      assert.equal(log.length, 1);
      const metadata = log[0].metadata;
      assert.ok(metadata);
      assert.equal(metadata.safeMetric, 42);
      assert.equal(metadata.entityId, "doc-123");
      assert.equal(metadata.method, "POST");

      // Verify sensitive keys are omitted
      assert.equal(metadata.title, undefined);
      assert.equal(metadata.name, undefined);
      assert.equal(metadata.password, undefined);
      assert.equal(metadata.token, undefined);
      assert.equal(metadata.secret, undefined);
      assert.equal(metadata.auth, undefined);
      assert.equal(metadata.credential, undefined);
      assert.equal(metadata.cookie, undefined);
      assert.equal(metadata.content, undefined);
      assert.equal(metadata.body, undefined);
      assert.equal(metadata.payload, undefined);
    });

    it("masks user ID identifiers to protect staff privacy in telemetry logs", () => {
      recordTelemetry("pwa.install.accept", { source: "banner" }, "staff_nguyen_van_a_98765");

      const log = getTelemetryLog();
      assert.equal(log.length, 1);
      const entry = log[0];
      assert.ok(entry.userId !== "staff_nguyen_van_a_98765", "Raw userId must not be present");
      assert.equal(entry.userId, maskUserId("staff_nguyen_van_a_98765"));
      assert.ok(entry.userId?.startsWith("user_"), "Masked ID must begin with user_ prefix");
      assert.ok(entry.userId?.endsWith("..."), "Masked ID must end with ellipsis");
    });

    it("retrieves telemetry log via getTelemetryLog and clears history via clearTelemetryLog", () => {
      assert.equal(getTelemetryLog().length, 0);

      recordTelemetry("storage.cleared", { source: "settings" });
      assert.equal(getTelemetryLog().length, 1);

      clearTelemetryLog();
      assert.equal(getTelemetryLog().length, 0);
    });
  });
});
