import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  PWAConnectivityManager,
  ConnectionState,
  checkServerReachable,
} from "../../src/lib/pwa/connectivity";
import {
  enqueueOutbox,
  getOutboxQueue,
  clearOutbox,
  setActiveUserId,
  subscribeOutbox,
  flushOutbox,
  updateOutboxItem,
  resolveConflict,
  OfflineOutboxItem,
} from "../../src/lib/pwa/outbox-manager";
import { resetMemoryDatabase } from "../../src/lib/pwa/indexed-db";

describe("PWA Sync Status & Connectivity Tests", () => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    resetMemoryDatabase();
    setActiveUserId("test-user-sync-01");
    await clearOutbox("test-user-sync-01");
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
    globalThis.fetch = originalFetch;
  });

  describe("1. True Connectivity Detector (checkServerReachable)", () => {
    it("returns false immediately when navigator.onLine is false", async () => {
      Object.defineProperty(globalThis, "window", {
        value: {},
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "navigator", {
        value: { onLine: false },
        configurable: true,
        writable: true,
      });

      let fetchCalled = false;
      const mockFetch = async () => {
        fetchCalled = true;
        return new Response("ok", { status: 200 });
      };

      const reachable = await checkServerReachable({ fetchFn: mockFetch as any });
      assert.strictEqual(reachable, false);
      assert.strictEqual(fetchCalled, false, "Must not probe backend if browser is offline");
    });

    it("returns true when server probe responds with status < 500", async () => {
      Object.defineProperty(globalThis, "window", {
        value: {},
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "navigator", {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });

      const mockFetch = async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 });
      const reachable = await checkServerReachable({ fetchFn: mockFetch as any });
      assert.strictEqual(reachable, true);
    });

    it("returns false when probe fails with network error or 5xx", async () => {
      Object.defineProperty(globalThis, "window", {
        value: {},
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "navigator", {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });

      const mockFailingFetch = async () => {
        throw new Error("Network unreachable / Timeout");
      };
      const reachable = await checkServerReachable({ fetchFn: mockFailingFetch as any });
      assert.strictEqual(reachable, false);
    });
  });

  describe("2. Connectivity State Machine (ONLINE / DEGRADED / OFFLINE)", () => {
    it("initializes to OFFLINE when navigator.onLine is false", () => {
      Object.defineProperty(globalThis, "window", {
        value: {
          addEventListener: () => {},
          removeEventListener: () => {},
        },
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "navigator", {
        value: { onLine: false },
        configurable: true,
        writable: true,
      });

      const manager = new PWAConnectivityManager({ autoStart: false });
      manager.init();
      assert.strictEqual(manager.getState(), "OFFLINE");
      manager.destroy();
    });

    it("transitions between states and notifies subscribers", async () => {
      const listeners: ConnectionState[] = [];

      Object.defineProperty(globalThis, "window", {
        value: {
          addEventListener: () => {},
          removeEventListener: () => {},
        },
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "navigator", {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });

      const manager = new PWAConnectivityManager({ autoStart: false });
      const unsub = manager.subscribe((state) => {
        listeners.push(state);
      });

      // 1. Simulate server probe success -> ONLINE
      manager.setFetchFn((async () => new Response("ok", { status: 200 })) as any);
      await manager.checkConnectivity(true);
      assert.strictEqual(manager.getState(), "ONLINE");

      // 2. Simulate server probe failure while navigator.onLine is true -> DEGRADED
      manager.setFetchFn((async () => {
        throw new Error("Failed probe");
      }) as any);
      await manager.checkConnectivity(true);
      assert.strictEqual(manager.getState(), "DEGRADED");

      // 3. Simulate browser offline event -> OFFLINE
      Object.defineProperty(globalThis, "navigator", {
        value: { onLine: false },
        configurable: true,
        writable: true,
      });
      await manager.checkConnectivity(true);
      assert.strictEqual(manager.getState(), "OFFLINE");

      assert.ok(listeners.includes("DEGRADED"), "Listener should receive DEGRADED state");
      assert.ok(listeners.includes("OFFLINE"), "Listener should receive OFFLINE state");

      unsub();
      manager.destroy();
    });
  });

  describe("3. Outbox Subscription & Status Bindings", () => {
    it("notifies subscribers when items are enqueued in outbox", async () => {
      const notifications: OfflineOutboxItem[][] = [];

      const unsubscribe = subscribeOutbox((items) => {
        notifications.push(items);
      });

      // Enqueue mutation
      await enqueueOutbox(
        {
          operation: "DOCUMENT_FORWARD",
          entityId: "doc-101",
          url: "/api/documents/101/forward",
          method: "POST",
          payload: { targetUserId: "user-approver" },
        },
        "test-user-sync-01"
      );

      assert.ok(notifications.length > 0, "Subscriber must be notified on enqueue");
      const latest = notifications[notifications.length - 1];
      assert.strictEqual(latest.length, 1);
      assert.strictEqual(latest[0].entityId, "doc-101");
      assert.strictEqual(latest[0].status, "pending");

      unsubscribe();
    });

    it("correctly partitions pending vs conflict items for UX indicators", async () => {
      const uid = "test-user-sync-01";

      // Enqueue two items
      const item1 = await enqueueOutbox(
        {
          operation: "TASK_CREATE",
          entityId: "task-101",
          url: "/api/tasks",
          method: "POST",
          payload: { title: "Công việc khẩn" },
        },
        uid
      );

      const item2 = await enqueueOutbox(
        {
          operation: "TASK_UPDATE",
          entityId: "task-102",
          url: "/api/tasks/task-102",
          method: "PATCH",
          payload: { status: "COMPLETED" },
        },
        uid
      );

      // Mark item2 as conflict
      await updateOutboxItem(
        item2.id,
        {
          status: "conflict",
          errorMessage: "OCC Version Conflict",
          serverConflictData: { version: 5 },
        },
        uid
      );

      const queue = await getOutboxQueue(uid);
      const pendingItems = queue.filter(
        (i) => i.status === "pending" || i.status === "syncing"
      );
      const conflictItems = queue.filter((i) => i.status === "conflict");

      assert.strictEqual(pendingItems.length, 1, "Must have 1 pending item");
      assert.strictEqual(conflictItems.length, 1, "Must have 1 conflict item");
      assert.strictEqual(conflictItems[0].id, item2.id);

      // Resolving the conflict via discard removes it from queue
      await resolveConflict(item2.id, "discard", uid);
      const updatedQueue = await getOutboxQueue(uid);
      const updatedConflicts = updatedQueue.filter((i) => i.status === "conflict");
      assert.strictEqual(updatedConflicts.length, 0, "Conflict should be cleared after resolution");
    });

    it("handles outbox flush lifecycle and transitions items to synced", async () => {
      const uid = "test-user-sync-01";

      await enqueueOutbox(
        {
          operation: "TASK_COMMENT",
          entityId: "task-103",
          url: "/api/tasks/task-103/comments",
          method: "POST",
          payload: { content: "Báo cáo tiến độ hoàn thành" },
        },
        uid
      );

      // Mock successful fetch for flushOutbox
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ success: true, version: 2 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as any;

      const flushResult = await flushOutbox(uid);
      assert.strictEqual(flushResult.succeeded, 1);
      assert.strictEqual(flushResult.failed, 0);

      const queueAfter = await getOutboxQueue(uid);
      const remainingPending = queueAfter.filter(
        (i) => i.status === "pending" || i.status === "syncing"
      );
      assert.strictEqual(remainingPending.length, 0, "Outbox pending items should be 0 after flush");
    });
  });
});
