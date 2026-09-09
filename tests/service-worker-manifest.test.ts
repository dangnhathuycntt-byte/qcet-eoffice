import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import manifest from "../src/app/manifest";

describe("Task 5: Service Worker & PWA Manifest", () => {
  const rootDir = path.resolve(__dirname, "..");
  const swPath = path.join(rootDir, "public", "sw.js");
  const layoutPath = path.join(rootDir, "src", "app", "layout.tsx");

  describe("public/sw.js Service Worker implementation", () => {
    test("public/logo-qcet.webp exists and is smaller than PNG original", () => {
      const webpPath = path.join(rootDir, "public", "logo-qcet.webp");
      const pngPath = path.join(rootDir, "public", "logo-qcet.png");
      assert.ok(fs.existsSync(webpPath), "public/logo-qcet.webp must exist");
      const webpStat = fs.statSync(webpPath);
      const pngStat = fs.statSync(pngPath);
      assert.ok(webpStat.size > 0, "logo-qcet.webp must not be empty");
      assert.ok(
        webpStat.size < pngStat.size,
        `logo-qcet.webp (${webpStat.size}B) should be smaller than PNG (${pngStat.size}B)`
      );
    });

    test("public/sw.js exists and is valid JavaScript syntax", () => {
      assert.ok(fs.existsSync(swPath), "public/sw.js must exist");
      const content = fs.readFileSync(swPath, "utf-8");
      assert.ok(content.length > 50, "sw.js must not be empty");

      // Verify JavaScript syntax using Node.js vm Script
      assert.doesNotThrow(() => {
        new vm.Script(content);
      }, "sw.js must be valid JavaScript syntax");
    });

    test("contains lifecycle event listeners: install and activate", () => {
      const content = fs.readFileSync(swPath, "utf-8");
      assert.match(content, /addEventListener\(\s*['"]install['"]/);
      assert.match(content, /skipWaiting\(\)/);
      assert.match(content, /addEventListener\(\s*['"]activate['"]/);
      assert.match(content, /clients\.claim\(\)/);
    });

    test("defines CACHE_NAME version 4 and includes /logo-qcet.webp in PRECACHE_ASSETS", () => {
      const content = fs.readFileSync(swPath, "utf-8");
      assert.match(
        content,
        /const\s+CACHE_NAME\s*=\s*['"](qcet-eoffice-v4|qcet-cache-v4)['"]/,
        "CACHE_NAME must be updated to v4 (qcet-eoffice-v4 or qcet-cache-v4)"
      );
      assert.match(
        content,
        /PRECACHE_ASSETS\s*=\s*\[[\s\S]*?['"]\/logo-qcet\.webp['"][\s\S]*?\]/,
        "PRECACHE_ASSETS must contain '/logo-qcet.webp'"
      );
    });

    test("activate event purges older cache versions including v3", async () => {
      const content = fs.readFileSync(swPath, "utf-8");

      type EventHandler = (event: any) => void;
      const listeners: Record<string, EventHandler> = {};
      const deletedCaches: string[] = [];
      const mockCaches = {
        keys: async () => [
          "qcet-eoffice-v3",
          "qcet-cache-v3",
          "qcet-old-v1",
          "qcet-api-v1",
          "qcet-eoffice-v4",
          "qcet-cache-v4",
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
          clients: { claim: async () => {} },
        },
        caches: mockCaches,
        console,
        Promise,
      };

      vm.createContext(sandbox);
      vm.runInContext(content, sandbox);

      assert.ok(listeners.activate, "activate listener must be registered");
      let activateWaited: Promise<any> | null = null;
      listeners.activate({
        waitUntil: (p: Promise<any>) => {
          activateWaited = p;
        },
      });
      if (activateWaited) await activateWaited;

      assert.ok(
        deletedCaches.includes("qcet-eoffice-v3") || deletedCaches.includes("qcet-cache-v3"),
        "activate handler must delete older v3 cache"
      );
      assert.ok(!deletedCaches.includes("qcet-api-v1"), "API cache should not be deleted");
    });

    test("contains push event listener with notification options and app badge update", () => {
      const content = fs.readFileSync(swPath, "utf-8");
      assert.match(content, /addEventListener\(\s*['"]push['"]/);
      assert.match(content, /showNotification\(/);
      assert.match(content, /\/logo-qcet\.png/);
      assert.match(content, /setAppBadge/);
    });

    test("contains notificationclick event listener with client navigation and badge clearing", () => {
      const content = fs.readFileSync(swPath, "utf-8");
      assert.match(content, /addEventListener\(\s*['"]notificationclick['"]/);
      assert.match(content, /notification\.close\(\)/);
      assert.match(content, /clearAppBadge/);
      assert.match(content, /clients\.matchAll/);
      assert.match(content, /openWindow/);
      assert.match(content, /\/portal/);
    });

    test("simulates push and notificationclick logic in mock ServiceWorkerGlobalScope", async () => {
      const content = fs.readFileSync(swPath, "utf-8");

      type EventHandler = (event: any) => void;
      const listeners: Record<string, EventHandler> = {};
      const shownNotifications: Array<{ title: string; options: any }> = [];
      let badgeCount: number | null = null;
      let appBadgeCleared = false;
      let openedUrl: string | null = null;
      let focusedClient = false;
      let navigatedUrl: string | null = null;

      const mockClient = {
        url: "http://localhost:3000/portal",
        focus: async () => {
          focusedClient = true;
          return mockClient;
        },
        navigate: async (url: string) => {
          navigatedUrl = url;
          return mockClient;
        },
      };

      const mockClients = {
        claim: async () => {},
        matchAll: async (_opts?: any) => [mockClient],
        openWindow: async (url: string) => {
          openedUrl = url;
          return mockClient;
        },
      };

      const mockRegistration = {
        showNotification: async (title: string, options: any) => {
          shownNotifications.push({ title, options });
        },
      };

      const mockNavigator = {
        setAppBadge: async (count?: number) => {
          badgeCount = count ?? 1;
        },
        clearAppBadge: async () => {
          appBadgeCleared = true;
          badgeCount = 0;
        },
      };

      let skippedWaiting = false;
      const sandbox = {
        self: {
          addEventListener: (event: string, handler: EventHandler) => {
            listeners[event] = handler;
          },
          skipWaiting: async () => {
            skippedWaiting = true;
          },
          clients: mockClients,
          registration: mockRegistration,
        },
        addEventListener: (event: string, handler: EventHandler) => {
          listeners[event] = handler;
        },
        skipWaiting: async () => {
          skippedWaiting = true;
        },
        clients: mockClients,
        registration: mockRegistration,
        navigator: mockNavigator,
        console,
        Promise,
        JSON,
        URL,
      };

      vm.createContext(sandbox);
      vm.runInContext(content, sandbox);

      // Verify listeners registered
      assert.ok(listeners.install, "install listener must be registered");
      assert.ok(listeners.activate, "activate listener must be registered");
      assert.ok(listeners.push, "push listener must be registered");
      assert.ok(listeners.notificationclick, "notificationclick listener must be registered");

      // Trigger install
      let installWaited: Promise<any> | null = null;
      listeners.install({
        waitUntil: (p: Promise<any>) => {
          installWaited = p;
        },
      });
      if (installWaited) await installWaited;
      assert.equal(skippedWaiting, true, "install must call skipWaiting");

      // Trigger activate
      let activateWaited: Promise<any> | null = null;
      listeners.activate({
        waitUntil: (p: Promise<any>) => {
          activateWaited = p;
        },
      });
      if (activateWaited) await activateWaited;

      // Trigger push with JSON payload
      let pushWaited: Promise<any> | null = null;
      const pushEvent = {
        data: {
          json: () => ({
            title: "Nhiệm vụ mới",
            body: "Bạn được giao nhiệm vụ chuẩn bị báo cáo",
            data: { linkHref: "/portal?tab=tasks", taskId: "task-123", badgeCount: 3 },
            vibrate: [200, 100, 200],
            tag: "task-assigned-123",
          }),
          text: () => "Raw text fallback",
        },
        waitUntil: (p: Promise<any>) => {
          pushWaited = p;
        },
      };

      listeners.push(pushEvent);
      if (pushWaited) await pushWaited;

      assert.equal(shownNotifications.length, 1);
      assert.equal(shownNotifications[0].title, "Nhiệm vụ mới");
      assert.equal(shownNotifications[0].options.body, "Bạn được giao nhiệm vụ chuẩn bị báo cáo");
      assert.equal(shownNotifications[0].options.icon, "/logo-qcet.png");
      assert.equal(shownNotifications[0].options.data.taskId, "task-123");
      assert.equal(badgeCount, 3, "navigator.setAppBadge should be called with payload badgeCount or fallback");

      // Trigger notificationclick
      let clickWaited: Promise<any> | null = null;
      let closedNotification = false;
      const clickEvent = {
        notification: {
          data: { linkHref: "/portal?tab=tasks", taskId: "task-123" },
          close: () => {
            closedNotification = true;
          },
        },
        waitUntil: (p: Promise<any>) => {
          clickWaited = p;
        },
      };

      listeners.notificationclick(clickEvent);
      if (clickWaited) await clickWaited;

      assert.equal(closedNotification, true, "notification.close() must be called");
      assert.equal(appBadgeCleared, true, "navigator.clearAppBadge() must be called");
      assert.ok(focusedClient || openedUrl, "Window client should be focused or opened");
    });
  });

  describe("src/app/manifest.ts PWA configuration", () => {
    test("returns compliant PWA Web Manifest object", () => {
      const manifestData = manifest();

      assert.ok(manifestData.name, "Manifest must have a name");
      assert.match(manifestData.name, /QCET E-Office/);
      assert.equal(manifestData.short_name, "QCET E-Office");
      assert.equal(manifestData.display, "standalone");
      assert.ok(
        manifestData.theme_color === "#fbfbfb" || manifestData.theme_color === "#1e3a8a",
        "theme_color must match light-only #fbfbfb or legacy #1e3a8a"
      );
      assert.ok(
        manifestData.start_url === "/portal" || manifestData.start_url === "/",
        "start_url should be /portal or /"
      );

      assert.ok(Array.isArray(manifestData.icons), "Manifest must declare icons array");
      const icons = manifestData.icons!;

      // Check standard 192 and 512
      const icon192 = icons.find((i) => i.sizes === "192x192" && (!i.purpose || i.purpose === "any"));
      const icon512 = icons.find((i) => i.sizes === "512x512" && (!i.purpose || i.purpose === "any"));
      assert.ok(icon192, "Must include 192x192 icon with purpose any");
      assert.ok(icon512, "Must include 512x512 icon with purpose any");

      // Check maskable icons
      const maskable192 = icons.find((i) => i.sizes === "192x192" && i.purpose === "maskable");
      const maskable512 = icons.find((i) => i.sizes === "512x512" && i.purpose === "maskable");
      assert.ok(maskable192, "Must include 192x192 maskable icon");
      assert.ok(maskable512, "Must include 512x512 maskable icon");
    });
  });

  describe("src/app/layout.tsx PWA meta & SW registration", () => {
    test("layout.tsx contains apple-touch-icon link and service worker registration script", () => {
      const content = fs.readFileSync(layoutPath, "utf-8");

      assert.match(
        content,
        /apple-touch-icon/,
        "layout.tsx should contain apple-touch-icon"
      );
      assert.match(
        content,
        /\/logo-qcet\.png/,
        "layout.tsx apple-touch-icon should link to /logo-qcet.png"
      );
      assert.match(
        content,
        /serviceWorker\.register\(\s*['"]\/sw\.js['"]\)/,
        "layout.tsx should register /sw.js service worker"
      );
    });
  });
});
