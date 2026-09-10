import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  enqueueOutbox,
  flushOutbox,
  clearOutbox,
  setActiveUserId,
  registerBackgroundSync,
  SYNC_TAG_QCET_OUTBOX,
  setupOutboxAutoSyncListeners,
} from "../../src/lib/pwa/outbox-manager";
import {
  getTelemetryLog,
  clearTelemetryLog,
  maskUserId,
} from "../../src/lib/pwa/telemetry";
import { resetMemoryDatabase } from "../../src/lib/pwa/indexed-db";

describe("PWA Background Sync & Outbox Synchronization Suite", () => {
  const TEST_USER = "test-sync-user";

  beforeEach(async () => {
    resetMemoryDatabase();
    clearTelemetryLog();
    setActiveUserId(TEST_USER);
    await clearOutbox(TEST_USER);
  });

  describe("1. Background Sync Registration & Progressive Degradation", () => {
    it("exports canonical sync tag qcet-outbox-sync", () => {
      assert.equal(SYNC_TAG_QCET_OUTBOX, "qcet-outbox-sync");
    });

    it("registers sync tag when SyncManager and serviceWorker.ready.sync are available", async () => {
      let registeredTag = "";
      const mockSync = {
        register: async (tag: string) => {
          registeredTag = tag;
        },
      };

      (global as any).window = {
        SyncManager: function () {},
      };
      Object.defineProperty(global, "navigator", {
        value: {
          serviceWorker: {
            ready: Promise.resolve({
              sync: mockSync,
            }),
          },
        },
        configurable: true,
        writable: true,
      });

      const result = await registerBackgroundSync();
      assert.equal(result, true);
      assert.equal(registeredTag, "qcet-outbox-sync");
    });

    it("gracefully falls back when SyncManager is not supported (e.g., iOS Safari)", async () => {
      (global as any).window = {};
      Object.defineProperty(global, "navigator", {
        value: {
          serviceWorker: {
            ready: Promise.resolve({}),
          },
        },
        configurable: true,
        writable: true,
      });

      const result = await registerBackgroundSync();
      assert.equal(result, false);
    });
  });

  describe("2. Outbox Telemetry & Privacy Preservation", () => {
    it("records sync.queued telemetry on enqueue and strips sensitive title/credentials", async () => {
      await enqueueOutbox({
        operation: "CREATE_TASK",
        url: "/api/tasks",
        method: "POST",
        payload: {
          title: "Báo cáo tài chính mật 2026", // Sensitive title
          password: "supersecretpassword", // Sensitive credential
          amount: 50000000,
        },
        entityId: "task-fin-01",
      });

      const logs = getTelemetryLog();
      const queuedEvent = logs.find((l) => l.event === "sync.queued");
      assert.ok(queuedEvent, "Must record sync.queued event");
      assert.equal(queuedEvent.userId, maskUserId(TEST_USER));
      assert.ok(queuedEvent.userId?.startsWith("user_"), "User ID in telemetry must be masked");
      assert.equal(queuedEvent.metadata?.entityId, "task-fin-01");
      assert.equal(queuedEvent.metadata?.method, "POST");

      // Verify privacy preservation
      assert.equal(queuedEvent.metadata?.title, undefined);
      assert.equal(queuedEvent.metadata?.password, undefined);
    });

    it("records sync.success telemetry upon successful flush", async () => {
      await enqueueOutbox({
        operation: "UPDATE_STATUS",
        url: "/api/tasks/task-fin-01",
        method: "PATCH",
        payload: { status: "COMPLETED" },
        entityId: "task-fin-01",
      });

      // Mock successful fetch
      const mockFetch: typeof fetch = async () => {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      };

      Object.defineProperty(global, "navigator", {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });
      const res = await flushOutbox(TEST_USER, { fetchFn: mockFetch });
      assert.equal(res.succeeded, 1);

      const logs = getTelemetryLog();
      const successEvent = logs.find((l) => l.event === "sync.success");
      assert.ok(successEvent, "Must record sync.success telemetry");
      assert.equal(successEvent.metadata?.entityId, "task-fin-01");
    });

    it("records sync.conflict telemetry upon 409 Conflict OCC response", async () => {
      await enqueueOutbox({
        operation: "UPDATE_DOCUMENT",
        url: "/api/docs/doc-101",
        method: "PUT",
        expectedVersion: 2,
        payload: { content: "Nội dung cập nhật" },
        entityId: "doc-101",
      });

      // Mock 409 Conflict
      const mockFetch: typeof fetch = async () => {
        return new Response(
          JSON.stringify({ error: "Version mismatch: current is 3" }),
          { status: 409 }
        );
      };

      Object.defineProperty(global, "navigator", {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });
      const res = await flushOutbox(TEST_USER, { fetchFn: mockFetch });
      assert.equal(res.conflicts, 1);

      const logs = getTelemetryLog();
      const conflictEvent = logs.find((l) => l.event === "sync.conflict");
      assert.ok(conflictEvent, "Must record sync.conflict telemetry");
      assert.equal(conflictEvent.metadata?.entityId, "doc-101");
      assert.equal(conflictEvent.metadata?.expectedVersion, 2);
    });
  });

  describe("3. Outbox Auto-Sync Listeners & SW Message Handling", () => {
    it("attaches message event listener for QCET_OUTBOX_DRAIN message from service worker", () => {
      let swMessageListener: ((event: any) => void) | null = null;
      let windowOnlineListener: (() => void) | null = null;

      (global as any).window = {
        addEventListener: (event: string, handler: any) => {
          if (event === "online") windowOnlineListener = handler;
        },
      };
      (global as any).document = {
        addEventListener: () => {},
        visibilityState: "visible",
      };
      Object.defineProperty(global, "navigator", {
        value: {
          onLine: true,
          serviceWorker: {
            addEventListener: (event: string, handler: any) => {
              if (event === "message") swMessageListener = handler;
            },
          },
        },
        configurable: true,
        writable: true,
      });

      setupOutboxAutoSyncListeners();

      assert.ok(typeof swMessageListener === "function");
      assert.ok(typeof windowOnlineListener === "function");
    });
  });
});
