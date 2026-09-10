import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  formatBytes,
  checkStoragePersistence,
  requestStoragePersistence,
  getStorageEstimate,
  clearUserOfflineData,
  StorageEstimateResult,
} from "../../src/lib/pwa/storage-manager";
import { resetMemoryDatabase } from "../../src/lib/pwa/indexed-db";
import {
  setActiveUserId,
  enqueueOutbox,
  getOutboxQueue,
  clearOutbox,
} from "../../src/lib/pwa/outbox-manager";
import {
  setReadCache,
  getReadCache,
  setDraft,
  getDraft,
  listUserDrafts,
} from "../../src/lib/pwa/offline-store";
import { getTelemetryEvents, clearTelemetryEvents, maskUserId } from "../../src/lib/pwa/telemetry";

describe("PWA Storage Manager Tests", () => {
  const originalNavigator = globalThis.navigator;
  const originalCaches = globalThis.caches;

  beforeEach(async () => {
    resetMemoryDatabase();
    clearTelemetryEvents();
    setActiveUserId("test-user-storage-01");
    await clearOutbox("test-user-storage-01");
  });

  afterEach(() => {
    // Restore globals
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "caches", {
      value: originalCaches,
      configurable: true,
      writable: true,
    });
  });

  describe("1. formatBytes Formatting Helper", () => {
    it("handles zero and non-finite values safely", () => {
      assert.strictEqual(formatBytes(0), "0 B");
      assert.strictEqual(formatBytes(-100), "0 B");
      assert.strictEqual(formatBytes(NaN), "0 B");
      assert.strictEqual(formatBytes(Infinity), "0 B");
    });

    it("formats standard byte sizes correctly", () => {
      assert.strictEqual(formatBytes(512), "512 B");
      assert.strictEqual(formatBytes(1024), "1 KB");
      assert.strictEqual(formatBytes(1536), "1.5 KB");
      assert.strictEqual(formatBytes(1024 * 1024), "1 MB");
      assert.strictEqual(formatBytes(12.4 * 1024 * 1024), "12.4 MB");
      assert.strictEqual(formatBytes(1.2 * 1024 * 1024 * 1024), "1.2 GB");
      assert.strictEqual(formatBytes(2 * 1024 * 1024 * 1024 * 1024), "2 TB");
    });

    it("respects decimal precision parameter", () => {
      assert.strictEqual(formatBytes(1550 * 1024, 2), "1.51 MB");
      assert.strictEqual(formatBytes(1550 * 1024, 0), "2 MB");
    });
  });

  describe("2. checkStoragePersistence & requestStoragePersistence", () => {
    it("returns false gracefully when navigator.storage is undefined", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        configurable: true,
        writable: true,
      });

      const persisted = await checkStoragePersistence();
      assert.strictEqual(persisted, false);

      const requested = await requestStoragePersistence("user-1");
      assert.strictEqual(requested, false);
    });

    it("checks persistence status via navigator.storage.persisted()", async () => {
      let persistedCalled = false;
      Object.defineProperty(globalThis, "navigator", {
        value: {
          storage: {
            persisted: async () => {
              persistedCalled = true;
              return true;
            },
          },
        },
        configurable: true,
        writable: true,
      });

      const persisted = await checkStoragePersistence();
      assert.strictEqual(persisted, true);
      assert.strictEqual(persistedCalled, true);
    });

    it("requests persistence via navigator.storage.persist() and logs telemetry", async () => {
      let persistCalled = false;
      Object.defineProperty(globalThis, "navigator", {
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

      const granted = await requestStoragePersistence("test-user-storage-01");
      assert.strictEqual(granted, true);
      assert.strictEqual(persistCalled, true);

      const events = getTelemetryEvents();
      const persistEvent = events.find((e) => e.event === "storage.persist.granted");
      assert.ok(persistEvent, "Must record storage.persist.granted telemetry event");
      assert.strictEqual(persistEvent.userId, maskUserId("test-user-storage-01"));
      assert.strictEqual(persistEvent.metadata?.explicitUserAction, true);
    });

    it("handles persistence denial cleanly and logs denial telemetry", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          storage: {
            persist: async () => false,
          },
        },
        configurable: true,
        writable: true,
      });

      const granted = await requestStoragePersistence("test-user-storage-01");
      assert.strictEqual(granted, false);

      const events = getTelemetryEvents();
      const denyEvent = events.find((e) => e.event === "storage.persist.denied");
      assert.ok(denyEvent, "Must record storage.persist.denied telemetry event");
      assert.strictEqual(denyEvent.userId, maskUserId("test-user-storage-01"));
    });
  });

  describe("3. getStorageEstimate Calculation", () => {
    it("returns calculated usage, quota, and summary string", async () => {
      const mockUsage = 15 * 1024 * 1024; // 15 MB
      const mockQuota = 1500 * 1024 * 1024; // 1.5 GB

      Object.defineProperty(globalThis, "navigator", {
        value: {
          storage: {
            estimate: async () => ({
              usage: mockUsage,
              quota: mockQuota,
            }),
            persisted: async () => false,
          },
        },
        configurable: true,
        writable: true,
      });

      const estimate = await getStorageEstimate();
      assert.strictEqual(estimate.usage, mockUsage);
      assert.strictEqual(estimate.quota, mockQuota);
      assert.strictEqual(estimate.usageFormatted, "15 MB");
      assert.strictEqual(estimate.quotaFormatted, "1.5 GB");
      assert.strictEqual(estimate.percentUsed, 1);
      assert.strictEqual(estimate.summary, "15 MB / 1.5 GB (1%)");
      assert.strictEqual(estimate.isPersisted, false);
    });

    it("handles zero quota gracefully without division by zero errors", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          storage: {
            estimate: async () => ({ usage: 0, quota: 0 }),
            persisted: async () => false,
          },
        },
        configurable: true,
        writable: true,
      });

      const estimate = await getStorageEstimate();
      assert.strictEqual(estimate.usage, 0);
      assert.strictEqual(estimate.quota, 0);
      assert.strictEqual(estimate.percentUsed, 0);
      assert.strictEqual(estimate.summary, "0 B / 0 B (0%)");
    });

    it("inspects Cache Storage if caches API is present", async () => {
      const mockUsage = 20 * 1024 * 1024;
      const mockQuota = 100 * 1024 * 1024;

      const mockCacheMatch = async () => ({
        headers: {
          get: (name: string) => (name.toLowerCase() === "content-length" ? "5242880" : null), // 5 MB
        },
      });

      Object.defineProperty(globalThis, "navigator", {
        value: {
          storage: {
            estimate: async () => ({ usage: mockUsage, quota: mockQuota }),
            persisted: async () => true,
          },
        },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(globalThis, "caches", {
        value: {
          keys: async () => ["qcet-api-cache-v1"],
          open: async () => ({
            keys: async () => ["/api/documents/1"],
            match: mockCacheMatch,
          }),
        },
        configurable: true,
        writable: true,
      });

      const estimate = await getStorageEstimate();
      assert.strictEqual(estimate.isPersisted, true);
      assert.ok(estimate.breakdown?.cacheStorageBytes! > 0);
      assert.ok(estimate.breakdown?.indexedDbBytes! > 0);
    });
  });

  describe("4. clearUserOfflineData On-Demand Purge", () => {
    it("purges user read cache, drafts, and outbox, and logs telemetry", async () => {
      const uid = "test-user-storage-01";

      // 1. Seed read cache, drafts, and outbox
      await setReadCache(uid, "doc-1", { title: "Văn bản số 1" });
      await setDraft(uid, "draft-1", { subject: "Dự thảo tờ trình" });
      await enqueueOutbox(
        {
          operation: "DOCUMENT_APPROVE",
          entityId: "doc-1",
          url: "/api/documents/1/approve",
          method: "POST",
          payload: { approved: true },
        },
        uid
      );

      // Verify data exists
      const cached = await getReadCache(uid, "doc-1");
      assert.ok(cached, "Read cache should exist before purge");

      const draftsBefore = await listUserDrafts(uid);
      assert.strictEqual(draftsBefore.length, 1);

      const outboxBefore = await getOutboxQueue(uid);
      assert.strictEqual(outboxBefore.length, 1);

      // 2. Clear offline data
      const result = await clearUserOfflineData(uid);
      assert.strictEqual(result.success, true);
      assert.ok(result.readCacheCleared >= 1);
      assert.ok(result.draftsCleared >= 1);
      assert.ok(result.outboxCleared >= 1);

      // 3. Verify data was removed
      const cachedAfter = await getReadCache(uid, "doc-1");
      assert.strictEqual(cachedAfter, null);

      const draftsAfter = await listUserDrafts(uid);
      assert.strictEqual(draftsAfter.length, 0);

      const outboxAfter = await getOutboxQueue(uid);
      assert.strictEqual(outboxAfter.length, 0);

      // 4. Verify telemetry event
      const events = getTelemetryEvents();
      const clearEvent = events.find((e) => e.event === "storage.cleared");
      assert.ok(clearEvent, "Must record storage.cleared event");
      assert.strictEqual(clearEvent.userId, maskUserId(uid));
    });

    it("preserves outbox when preserveOutbox: true is specified", async () => {
      const uid = "test-user-storage-01";

      await setReadCache(uid, "doc-2", { title: "Văn bản số 2" });
      await enqueueOutbox(
        {
          operation: "TASK_ASSIGN",
          entityId: "task-2",
          url: "/api/tasks/2/assign",
          method: "POST",
          payload: { assigneeId: "user-9" },
        },
        uid
      );

      const result = await clearUserOfflineData(uid, { preserveOutbox: true });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.outboxCleared, 0);

      const outboxRemaining = await getOutboxQueue(uid);
      assert.strictEqual(outboxRemaining.length, 1, "Outbox item must be preserved");
    });

    it("purges runtime caches when clearCaches: true is specified", async () => {
      const deletedCaches: string[] = [];
      Object.defineProperty(globalThis, "caches", {
        value: {
          keys: async () => ["qcet-shell-v1", "qcet-api-data-v1", "qcet-tasks-api-v1"],
          delete: async (name: string) => {
            deletedCaches.push(name);
            return true;
          },
        },
        configurable: true,
        writable: true,
      });

      const result = await clearUserOfflineData("test-user-storage-01", {
        clearCaches: true,
      });

      assert.strictEqual(result.cachesPurged, true);
      assert.ok(deletedCaches.includes("qcet-api-data-v1"));
      assert.ok(deletedCaches.includes("qcet-tasks-api-v1"));
      assert.strictEqual(
        deletedCaches.includes("qcet-shell-v1"),
        false,
        "Should preserve app shell cache for immediate offline boot"
      );
    });
  });
});
