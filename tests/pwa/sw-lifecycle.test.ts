import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import nextConfig from "../../next.config";

describe("Task 1: Service Worker Core & Lifecycle Refactor", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const swPath = path.join(rootDir, "public", "sw.js");

  test("sw.js exists and has valid JavaScript syntax", () => {
    assert.ok(fs.existsSync(swPath), "public/sw.js must exist");
    const content = fs.readFileSync(swPath, "utf-8");
    assert.ok(content.length > 100, "sw.js must not be empty");

    assert.doesNotThrow(() => {
      new vm.Script(content);
    }, "sw.js must be valid JavaScript syntax");
  });

  describe("1. Version Contract", () => {
    test("defines APP_VERSION, CACHE_STATIC_NAME, and CACHE_SHELL_NAME with 2026.09.09.1", () => {
      const content = fs.readFileSync(swPath, "utf-8");
      assert.match(
        content,
        /const\s+APP_VERSION\s*=\s*['"]2026\.09\.09\.1['"]/,
        "APP_VERSION must be 2026.09.09.1"
      );
      assert.match(
        content,
        /const\s+CACHE_STATIC_NAME\s*=\s*['"]qcet-static-2026\.09\.09\.1['"]/,
        "CACHE_STATIC_NAME must be qcet-static-2026.09.09.1"
      );
      assert.match(
        content,
        /const\s+CACHE_SHELL_NAME\s*=\s*['"]qcet-shell-2026\.09\.09\.1['"]/,
        "CACHE_SHELL_NAME must be qcet-shell-2026.09.09.1"
      );
    });
  });

  describe("2. Lifecycle & SKIP_WAITING message control", () => {
    test("install precaches core shell assets without auto-skipWaiting", async () => {
      const content = fs.readFileSync(swPath, "utf-8");

      type EventHandler = (event: any) => void;
      const listeners: Record<string, EventHandler> = {};
      let skippedWaiting = false;
      const precachedAssets: string[] = [];

      const mockCache = {
        add: async (asset: string) => {
          precachedAssets.push(asset);
        },
      };

      const mockCaches = {
        open: async (name: string) => {
          assert.equal(name, "qcet-shell-2026.09.09.1");
          return mockCache;
        },
      };

      const sandbox = {
        self: {
          addEventListener: (event: string, handler: EventHandler) => {
            listeners[event] = handler;
          },
          skipWaiting: async () => {
            skippedWaiting = true;
          },
          clients: { claim: async () => {} },
          location: { origin: "https://eoffice.qcet.edu.vn" },
        },
        caches: mockCaches,
        Promise,
        console,
        URL,
      };

      vm.createContext(sandbox);
      vm.runInContext(content, sandbox);

      assert.ok(listeners.install, "install listener must be registered");
      assert.ok(listeners.message, "message listener must be registered");
      assert.ok(listeners.activate, "activate listener must be registered");

      let installWaited: Promise<any> | null = null;
      listeners.install({
        waitUntil: (p: Promise<any>) => {
          installWaited = p;
        },
      });
      if (installWaited) await installWaited;

      // In the new architecture, install MUST NOT automatically skipWaiting
      assert.equal(skippedWaiting, false, "install must NOT blindly call skipWaiting");

      // Verify core assets precached
      assert.ok(precachedAssets.includes("/"), "Must precache '/'");
      assert.ok(precachedAssets.includes("/?zone=tasks"), "Must precache '/?zone=tasks'");
      assert.ok(precachedAssets.includes("/logo-qcet.png"), "Must precache '/logo-qcet.png'");
      assert.ok(precachedAssets.includes("/logo-qcet.webp"), "Must precache '/logo-qcet.webp'");

      // Trigger message listener with SKIP_WAITING
      listeners.message({ data: { type: "SKIP_WAITING" } });
      assert.equal(skippedWaiting, true, "message with type SKIP_WAITING must trigger skipWaiting");
    });

    test("activate claims clients and deletes stale cache buckets not matching current constants", async () => {
      const content = fs.readFileSync(swPath, "utf-8");

      type EventHandler = (event: any) => void;
      const listeners: Record<string, EventHandler> = {};
      let claimedClients = false;
      const deletedCaches: string[] = [];

      const mockCaches = {
        keys: async () => [
          "qcet-eoffice-v1",
          "qcet-eoffice-v3",
          "qcet-static-old",
          "qcet-static-2026.09.09.1",
          "qcet-shell-2026.09.09.1",
        ],
        delete: async (name: string) => {
          deletedCaches.push(name);
          return true;
        },
      };

      const sandbox = {
        self: {
          addEventListener: (event: string, handler: EventHandler) => {
            listeners[event] = handler;
          },
          skipWaiting: async () => {},
          clients: {
            claim: async () => {
              claimedClients = true;
            },
          },
          location: { origin: "https://eoffice.qcet.edu.vn" },
        },
        caches: mockCaches,
        Promise,
        console,
        URL,
      };

      vm.createContext(sandbox);
      vm.runInContext(content, sandbox);

      let activateWaited: Promise<any> | null = null;
      listeners.activate({
        waitUntil: (p: Promise<any>) => {
          activateWaited = p;
        },
      });
      if (activateWaited) await activateWaited;

      assert.equal(claimedClients, true, "activate must call self.clients.claim()");
      assert.ok(deletedCaches.includes("qcet-eoffice-v1"), "stale cache v1 must be deleted");
      assert.ok(deletedCaches.includes("qcet-eoffice-v3"), "stale cache v3 must be deleted");
      assert.ok(deletedCaches.includes("qcet-static-old"), "stale static cache must be deleted");
      assert.ok(
        !deletedCaches.includes("qcet-static-2026.09.09.1"),
        "current static cache must NOT be deleted"
      );
      assert.ok(
        !deletedCaches.includes("qcet-shell-2026.09.09.1"),
        "current shell cache must NOT be deleted"
      );
    });
  });

  describe("3. Caching Strategy Matrix", () => {
    test("Static Assets use Cache First strategy and save to CACHE_STATIC_NAME", async () => {
      const content = fs.readFileSync(swPath, "utf-8");

      type EventHandler = (event: any) => void;
      const listeners: Record<string, EventHandler> = {};
      let cacheMatched = false;
      let cachedToBucket = "";

      const mockResponse = {
        status: 200,
        clone: () => ({ ...mockResponse }),
      };

      const mockCaches = {
        match: async () => {
          cacheMatched = true;
          return null; // Simulate cache miss first
        },
        open: async (name: string) => {
          cachedToBucket = name;
          return {
            put: async () => {},
          };
        },
      };

      let networkFetched = false;
      const mockFetch = async () => {
        networkFetched = true;
        return mockResponse;
      };

      const sandbox = {
        self: {
          addEventListener: (event: string, handler: EventHandler) => {
            listeners[event] = handler;
          },
          skipWaiting: async () => {},
          clients: { claim: async () => {} },
          location: { origin: "https://eoffice.qcet.edu.vn" },
        },
        caches: mockCaches,
        fetch: mockFetch,
        Promise,
        console,
        URL,
      };

      vm.createContext(sandbox);
      vm.runInContext(content, sandbox);

      let responsePromise: Promise<any> | null = null;
      const request = {
        method: "GET",
        url: "https://eoffice.qcet.edu.vn/_next/static/chunks/main.js",
        headers: new Map(),
      };

      listeners.fetch({
        request,
        respondWith: (p: Promise<any>) => {
          responsePromise = p;
        },
      });

      assert.ok(responsePromise, "Static asset request must be intercepted with respondWith");
      await responsePromise;
      assert.equal(cacheMatched, true, "Must check cache first");
      assert.equal(networkFetched, true, "Must fetch from network on miss");
      assert.equal(cachedToBucket, "qcet-static-2026.09.09.1", "Must save to CACHE_STATIC_NAME");
    });

    test("Mutations (POST, PUT, PATCH, DELETE) and Auth endpoints are Network Only", () => {
      const content = fs.readFileSync(swPath, "utf-8");

      type EventHandler = (event: any) => void;
      const listeners: Record<string, EventHandler> = {};

      const sandbox = {
        self: {
          addEventListener: (event: string, handler: EventHandler) => {
            listeners[event] = handler;
          },
          skipWaiting: async () => {},
          clients: { claim: async () => {} },
          location: { origin: "https://eoffice.qcet.edu.vn" },
        },
        caches: {},
        fetch: async () => {},
        Promise,
        console,
        URL,
      };

      vm.createContext(sandbox);
      vm.runInContext(content, sandbox);

      // POST request
      let postIntercepted = false;
      listeners.fetch({
        request: {
          method: "POST",
          url: "https://eoffice.qcet.edu.vn/api/tasks",
        },
        respondWith: () => {
          postIntercepted = true;
        },
      });
      assert.equal(postIntercepted, false, "POST request must NOT be intercepted");

      // GET /api/auth/session
      let authIntercepted = false;
      listeners.fetch({
        request: {
          method: "GET",
          url: "https://eoffice.qcet.edu.vn/api/auth/session",
        },
        respondWith: () => {
          authIntercepted = true;
        },
      });
      assert.equal(authIntercepted, false, "Auth endpoint must NOT be intercepted");
    });

    test("Navigation fallback returns offline HTML on network failure", async () => {
      const content = fs.readFileSync(swPath, "utf-8");

      type EventHandler = (event: any) => void;
      const listeners: Record<string, EventHandler> = {};

      const mockCaches = {
        match: async () => null, // Cache miss
        open: async () => ({ put: async () => {} }),
      };

      const mockFetch = async () => {
        throw new Error("Network unreachable");
      };

      class MockResponse {
        bodyText: string;
        status: number;
        headers: Record<string, string>;
        constructor(bodyText: string, init?: any) {
          this.bodyText = bodyText;
          this.status = init?.status || 200;
          this.headers = init?.headers || {};
        }
      }

      const sandbox = {
        self: {
          addEventListener: (event: string, handler: EventHandler) => {
            listeners[event] = handler;
          },
          skipWaiting: async () => {},
          clients: { claim: async () => {} },
          location: { origin: "https://eoffice.qcet.edu.vn" },
        },
        caches: mockCaches,
        fetch: mockFetch,
        Response: MockResponse,
        Promise,
        console,
        URL,
      };

      vm.createContext(sandbox);
      vm.runInContext(content, sandbox);

      let responsePromise: Promise<any> | null = null;
      listeners.fetch({
        request: {
          method: "GET",
          mode: "navigate",
          destination: "document",
          url: "https://eoffice.qcet.edu.vn/?zone=tasks",
        },
        respondWith: (p: Promise<any>) => {
          responsePromise = p;
        },
      });

      assert.ok(responsePromise, "Navigation request must be intercepted");
      const res: any = await responsePromise;
      assert.equal(res.status, 503, "Offline fallback should return 503 status");
      assert.match(res.headers["Content-Type"], /text\/html/, "Offline response should be HTML");
      assert.match(res.bodyText, /Hệ thống đang ngoại tuyến/, "Must contain offline message");
    });
  });

  describe("4. Push Deduplication & Deep-Link Same-Origin Validation", () => {
    test("Push event sets deduplicated tag task:{taskId}:{action}", async () => {
      const content = fs.readFileSync(swPath, "utf-8");

      type EventHandler = (event: any) => void;
      const listeners: Record<string, EventHandler> = {};
      let shownNotificationOptions: any = null;

      const sandbox = {
        self: {
          addEventListener: (event: string, handler: EventHandler) => {
            listeners[event] = handler;
          },
          registration: {
            showNotification: async (_title: string, options: any) => {
              shownNotificationOptions = options;
            },
          },
          location: { origin: "https://eoffice.qcet.edu.vn" },
        },
        navigator: {
          setAppBadge: async () => {},
        },
        Promise,
        console,
        URL,
      };

      vm.createContext(sandbox);
      vm.runInContext(content, sandbox);

      let pushWaited: Promise<any> | null = null;
      listeners.push({
        data: {
          json: () => ({
            title: "Nhiệm vụ mới",
            body: "Bạn vừa được phân công",
            data: { taskId: "task-999", action: "approve" },
          }),
        },
        waitUntil: (p: Promise<any>) => {
          pushWaited = p;
        },
      });

      if (pushWaited) await pushWaited;
      assert.ok(shownNotificationOptions, "Notification options must be captured");
      assert.equal(
        shownNotificationOptions.tag,
        "task:task-999:approve",
        "Tag must be formatted as task:{taskId}:{action}"
      );
    });

    test("Notification click validates same-origin and prevents open redirect", async () => {
      const content = fs.readFileSync(swPath, "utf-8");

      type EventHandler = (event: any) => void;
      const listeners: Record<string, EventHandler> = {};
      let openedWindowUrl = "";

      const sandbox = {
        self: {
          addEventListener: (event: string, handler: EventHandler) => {
            listeners[event] = handler;
          },
          clients: {
            matchAll: async () => [], // No open windows
            openWindow: async (url: string) => {
              openedWindowUrl = url;
              return {};
            },
          },
          location: { origin: "https://eoffice.qcet.edu.vn" },
        },
        navigator: {
          clearAppBadge: async () => {},
        },
        Promise,
        console,
        URL,
      };

      vm.createContext(sandbox);
      vm.runInContext(content, sandbox);

      // Malicious notification trying cross-origin redirect
      let clickWaited: Promise<any> | null = null;
      let closed = false;
      listeners.notificationclick({
        notification: {
          data: { linkHref: "https://malicious-phishing-site.com/steal-tokens" },
          close: () => {
            closed = true;
          },
        },
        waitUntil: (p: Promise<any>) => {
          clickWaited = p;
        },
      });

      if (clickWaited) await clickWaited;
      assert.equal(closed, true, "Notification must be closed on click");
      assert.ok(
        openedWindowUrl.startsWith("https://eoffice.qcet.edu.vn"),
        "Target URL must be sanitized to same-origin base"
      );
      assert.ok(
        !openedWindowUrl.includes("malicious-phishing-site.com"),
        "Must NOT open external untrusted URL"
      );
    });
  });

  describe("5. Next.js Security Headers for /sw.js", () => {
    test("next.config.ts exports security headers for /sw.js", async () => {
      assert.ok(typeof nextConfig.headers === "function", "nextConfig must define headers()");
      const headersConfig = await nextConfig.headers!();
      assert.ok(Array.isArray(headersConfig), "headers() must return an array");

      const swHeaderEntry = headersConfig.find((entry) => entry.source === "/sw.js");
      assert.ok(swHeaderEntry, "Must include a header rule for /sw.js");

      const headers = swHeaderEntry.headers;
      const cacheControl = headers.find((h) => h.key === "Cache-Control");
      assert.ok(cacheControl, "Must set Cache-Control");
      assert.equal(cacheControl.value, "no-cache, no-store, must-revalidate");

      const contentType = headers.find((h) => h.key === "Content-Type");
      assert.ok(contentType, "Must set Content-Type");
      assert.equal(contentType.value, "application/javascript; charset=utf-8");

      const swAllowed = headers.find((h) => h.key === "Service-Worker-Allowed");
      assert.ok(swAllowed, "Must set Service-Worker-Allowed");
      assert.equal(swAllowed.value, "/");
    });
  });
});
