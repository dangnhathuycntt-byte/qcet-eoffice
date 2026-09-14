import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  enqueueOutbox,
  getOutboxQueue,
  peekOutbox,
  getConflictItems,
  getUnknownResultItems,
  resolveConflict,
  removeOutboxItem,
  clearOutbox,
  updateOutboxItem,
  flushOutbox,
  drainOutbox,
  reconcileUnknownItems,
  reconcileStuckSyncingItems,
  setActiveUserId,
  getActiveUserId,
  switchActiveUser,
  subscribeOutbox,
  registerBackgroundSync,
  setupOutboxAutoSyncListeners,
  SYNC_TAG_QCET_OUTBOX,
  OfflineOutboxItem,
} from "../../src/lib/pwa/outbox-manager";
import {
  purgeUserOfflineData,
  clearOfflineMutationQueue,
  getOutboxItem,
  getOutboxQueue as getStoreOfflineMutationQueue,
} from "../../src/lib/pwa/offline-store";
import { resetMemoryDatabase } from "../../src/lib/pwa/indexed-db";
import {
  PWAConnectivityManager,
  checkServerReachable,
} from "../../src/lib/pwa/connectivity";
import {
  OFFLINE_STATE_LABELS,
  CANONICAL_OFFLINE_LABELS,
  outboxItemToOfflineState,
  offlineStateForDisplay,
  deriveOfflineState,
  labelForOfflineState,
  isServerConfirmed,
} from "../../src/lib/pwa/offline-state";
import {
  getTelemetryLog,
  clearTelemetryLog,
  recordTelemetry,
  maskUserId,
} from "../../src/lib/pwa/telemetry";
import {
  enqueueOfflineMutation,
  getOfflineMutationQueue,
  removeOfflineMutation,
  clearOfflineMutationQueue as clearLegacyMutationQueue,
  flushOfflineMutations,
  subscribeOfflineQueue,
} from "../../src/lib/offline-sync";

const __originalNavigator = globalThis.navigator;
const __originalWindow = (globalThis as { window?: unknown }).window;
const __originalDocument = (globalThis as { document?: unknown }).document;
const __originalFetch = globalThis.fetch;

describe("Task 4: Durable Offline Mutation Outbox with Idempotency & OCC Conflict Handling", () => {
  beforeEach(async () => {
    resetMemoryDatabase();
    clearTelemetryLog();
    setActiveUserId("test-user-01");
    await clearOutbox("test-user-01");
    await clearOutbox("test-user-02");
    clearOfflineMutationQueue();
    clearLegacyMutationQueue();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: __originalNavigator,
      configurable: true,
      writable: true,
    });
    if (__originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      Object.defineProperty(globalThis, "window", {
        value: __originalWindow,
        configurable: true,
        writable: true,
      });
    }
    if (__originalDocument === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      Object.defineProperty(globalThis, "document", {
        value: __originalDocument,
        configurable: true,
        writable: true,
      });
    }
    globalThis.fetch = __originalFetch;
  });

  describe("1. Outbox CRUD & FIFO Queue Ordering", () => {
    it("enqueues mutation items with unique UUID, timestamps, and idempotency keys", async () => {
      const item1 = await enqueueOutbox({
        operation: "TASK_UPDATE_STATUS",
        entityId: "task-100",
        url: "/api/tasks/task-100",
        method: "PATCH",
        payload: { status: "IN_PROGRESS" },
        expectedVersion: 3,
      });

      assert.ok(item1.id, "Outbox item must have an id");
      assert.strictEqual(item1.userId, "test-user-01");
      assert.strictEqual(item1.status, "pending");
      assert.strictEqual(item1.expectedVersion, 3);
      assert.ok(item1.idempotencyKey.startsWith("idemp-"), "Must have auto-generated idempotency key");

      const queue = await getOutboxQueue("test-user-01");
      assert.strictEqual(queue.length, 1);
      assert.strictEqual(queue[0].id, item1.id);
    });

    it("maintains strict FIFO ordering based on creation time", async () => {
      const first = await enqueueOutbox({
        operation: "OP_1",
        entityId: "task-1",
        url: "/api/tasks/1",
        method: "PATCH",
        payload: {},
        createdAt: 1000,
      });

      const second = await enqueueOutbox({
        operation: "OP_2",
        entityId: "task-2",
        url: "/api/tasks/2",
        method: "PATCH",
        payload: {},
        createdAt: 2000,
      });

      const third = await enqueueOutbox({
        operation: "OP_3",
        entityId: "task-3",
        url: "/api/tasks/3",
        method: "PATCH",
        payload: {},
        createdAt: 3000,
      });

      const peeked = await peekOutbox("test-user-01");
      assert.strictEqual(peeked?.id, first.id, "peekOutbox must return the oldest pending item");

      const queue = await getOutboxQueue("test-user-01");
      assert.deepStrictEqual(
        queue.map((q) => q.id),
        [first.id, second.id, third.id],
        "Queue must be chronologically ordered"
      );
    });

    it("updates, removes, and clears items accurately per user", async () => {
      const item = await enqueueOutbox({
        operation: "TASK_UPDATE_PROGRESS",
        entityId: "task-50",
        url: "/api/tasks/task-50",
        method: "PATCH",
        payload: { progress: 50 },
      });

      await updateOutboxItem(item.id, {
        retryCount: 2,
        errorMessage: "Network blip",
      });

      let queue = await getOutboxQueue();
      assert.strictEqual(queue[0].retryCount, 2);
      assert.strictEqual(queue[0].errorMessage, "Network blip");

      await removeOutboxItem(item.id);
      queue = await getOutboxQueue();
      assert.strictEqual(queue.length, 0);
    });
  });

  describe("2. Idempotency Key & OCC Header Transmission", () => {
    it("attaches Idempotency-Key, If-Match, and x-expected-version headers during flush", async () => {
      const item = await enqueueOutbox({
        operation: "TASK_APPROVE",
        entityId: "task-200",
        url: "/api/tasks/task-200/approve",
        method: "POST",
        payload: { decision: "APPROVED" },
        expectedVersion: 7,
        idempotencyKey: "test-custom-idempotency-key-200",
      });

      let recordedUrl = "";
      let recordedOptions: RequestInit | undefined;

      const mockFetch: typeof fetch = async (input, init) => {
        recordedUrl = String(input);
        recordedOptions = init;
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const result = await flushOutbox("test-user-01", { fetchFn: mockFetch });

      assert.strictEqual(result.succeeded, 1);
      assert.strictEqual(result.failed, 0);
      assert.strictEqual(result.conflicts, 0);

      assert.strictEqual(recordedUrl, "/api/tasks/task-200/approve");
      assert.strictEqual(recordedOptions?.method, "POST");

      const headers = recordedOptions?.headers as Record<string, string>;
      assert.strictEqual(headers["Idempotency-Key"], "test-custom-idempotency-key-200");
      assert.strictEqual(headers["If-Match"], '"7"');
      assert.strictEqual(headers["x-expected-version"], "7");
      assert.strictEqual(headers["Content-Type"], "application/json");

      // Verify item was dequeued on success
      const remaining = await getOutboxQueue("test-user-01");
      assert.strictEqual(remaining.length, 0);
    });
  });

  describe("3. OCC 409 Conflict Preservation & Handling", () => {
    it("preserves item, marks status as conflict, and records serverConflictData on 409 response", async () => {
      const item = await enqueueOutbox({
        operation: "TASK_UPDATE_STATUS",
        entityId: "task-300",
        url: "/api/tasks/task-300",
        method: "PATCH",
        payload: { status: "COMPLETED" },
        expectedVersion: 2,
      });

      const conflictPayload = {
        error: "Version conflict: expected 2, found 4",
        currentVersion: 4,
        serverState: { status: "IN_REVIEW", updatedBy: "user-boss" },
      };

      const mockConflictFetch: typeof fetch = async () => {
        return new Response(JSON.stringify(conflictPayload), {
          status: 409,
          statusText: "Conflict",
          headers: { "Content-Type": "application/json" },
        });
      };

      const result = await flushOutbox("test-user-01", { fetchFn: mockConflictFetch });

      assert.strictEqual(result.succeeded, 0);
      assert.strictEqual(result.conflicts, 1);
      assert.strictEqual(result.failed, 1);

      // Verify item was NOT discarded or overwritten blindly
      const conflictItems = await getConflictItems("test-user-01");
      assert.strictEqual(conflictItems.length, 1);
      assert.strictEqual(conflictItems[0].id, item.id);
      assert.strictEqual(conflictItems[0].status, "conflict");
      assert.deepStrictEqual(conflictItems[0].serverConflictData, conflictPayload);
      assert.strictEqual(
        conflictItems[0].errorMessage,
        "Version conflict: expected 2, found 4"
      );
    });

    it("resolves conflict via 'discard': permanently removes item from outbox", async () => {
      const item = await enqueueOutbox({
        operation: "TASK_DISCARD_TEST",
        entityId: "task-400",
        url: "/api/tasks/task-400",
        method: "PATCH",
        payload: { note: "Local edit" },
        status: "conflict",
        serverConflictData: { currentVersion: 5 },
      });

      let conflicts = await getConflictItems("test-user-01");
      assert.strictEqual(conflicts.length, 1);

      await resolveConflict(item.id, "discard", "test-user-01");

      conflicts = await getConflictItems("test-user-01");
      assert.strictEqual(conflicts.length, 0);
      const remaining = await getOutboxQueue("test-user-01");
      assert.strictEqual(remaining.length, 0);
    });

    it("resolves conflict via 'override': clears expectedVersion constraint and resets to pending", async () => {
      const item = await enqueueOutbox({
        operation: "TASK_OVERRIDE_TEST",
        entityId: "task-500",
        url: "/api/tasks/task-500",
        method: "PATCH",
        payload: { progress: 100 },
        expectedVersion: 1,
        status: "conflict",
        serverConflictData: { currentVersion: 2 },
        errorMessage: "Conflict occurred",
        retryCount: 3,
      });

      await resolveConflict(item.id, "override", "test-user-01");

      const queue = await getOutboxQueue("test-user-01");
      assert.strictEqual(queue.length, 1);
      const updated = queue[0];
      assert.strictEqual(updated.status, "pending");
      assert.strictEqual(updated.expectedVersion, undefined, "expectedVersion constraint must be cleared on override");
      assert.strictEqual(updated.serverConflictData, undefined);
      assert.strictEqual(updated.errorMessage, undefined);
      assert.strictEqual(updated.retryCount, 0);
    });
  });

  describe("4. Retry Count Limits & Error Handling", () => {
    it("marks item failed after exceeding maxRetries on 500 server errors", async () => {
      await enqueueOutbox({
        operation: "TASK_SERVER_FAIL",
        entityId: "task-600",
        url: "/api/tasks/task-600",
        method: "POST",
        payload: {},
        retryCount: 4, // 5th try next
      });

      const mock500Fetch: typeof fetch = async () => {
        return new Response("Internal Server Error", { status: 500 });
      };

      const result = await flushOutbox("test-user-01", {
        fetchFn: mock500Fetch,
        maxRetries: 5,
      });

      assert.strictEqual(result.succeeded, 0);
      assert.strictEqual(result.failed, 1);

      const queue = await getOutboxQueue("test-user-01");
      assert.strictEqual(queue[0].retryCount, 5);
      assert.strictEqual(queue[0].status, "failed");
      assert.ok(queue[0].errorMessage?.includes("5 lần thử lại"));
    });

    it("immediately marks 4xx client errors as failed", async () => {
      await enqueueOutbox({
        operation: "TASK_BAD_REQUEST",
        entityId: "task-700",
        url: "/api/tasks/task-700",
        method: "PATCH",
        payload: { invalid: true },
      });

      const mock400Fetch: typeof fetch = async () => {
        return new Response(JSON.stringify({ error: "Invalid task parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      };

      const result = await flushOutbox("test-user-01", { fetchFn: mock400Fetch });
      assert.strictEqual(result.succeeded, 0);
      assert.strictEqual(result.failed, 1);

      const queue = await getOutboxQueue("test-user-01");
      assert.strictEqual(queue[0].status, "failed");
      assert.strictEqual(queue[0].errorMessage, "Invalid task parameter");
    });
  });

  describe("5. Concurrency Mutex & Single-Threaded Flush Execution", () => {
    it("serializes concurrent flush calls with a mutex promise lock", async () => {
      await enqueueOutbox({
        operation: "TASK_LOCK_1",
        entityId: "task-lock-1",
        url: "/api/tasks/lock-1",
        method: "POST",
        payload: {},
      });

      let callCount = 0;
      const delayedMockFetch: typeof fetch = async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      };

      // Trigger two flushes simultaneously
      const [res1, res2] = await Promise.all([
        flushOutbox("test-user-01", { fetchFn: delayedMockFetch }),
        flushOutbox("test-user-01", { fetchFn: delayedMockFetch }),
      ]);

      // Both promises should return the same flush execution result
      assert.strictEqual(callCount, 1, "Fetch should only be called once across concurrent flush calls");
      assert.strictEqual(res1.succeeded, 1);
      assert.strictEqual(res2.succeeded, 1);
    });
  });

  describe("6. Backward Compatibility Bridge in offline-sync.ts", () => {
    it("allows synchronous enqueue, inspection, removal, and queue subscription", () => {
      let notifiedQueue: any[] = [];
      const unsub = subscribeOfflineQueue((q) => {
        notifiedQueue = q;
      });

      const mutation = enqueueOfflineMutation({
        url: "/api/tasks/compat-101",
        method: "PATCH",
        body: { status: "IN_PROGRESS" },
        description: "Tiến độ nhiệm vụ compat-101",
        expectedVersion: 1,
      });

      assert.ok(mutation.id);
      assert.strictEqual(mutation.operation, "Tiến độ nhiệm vụ compat-101");
      assert.strictEqual(mutation.entityId, "compat-101");

      const current = getOfflineMutationQueue();
      assert.ok(current.some((m) => m.id === mutation.id));
      assert.ok(notifiedQueue.some((m) => m.id === mutation.id));

      removeOfflineMutation(mutation.id);
      const afterRemoval = getOfflineMutationQueue();
      assert.strictEqual(afterRemoval.length, 0);

      unsub();
    });
  });

  describe("7. Task 3 Reviewer Fixes Verification", () => {
    it("purgeUserOfflineData resets in-memory queue even when userId is falsy/empty", async () => {
      // Put item in legacy/in-memory queue
      enqueueOfflineMutation({
        url: "/api/tasks/test",
        method: "POST",
        body: {},
      });
      assert.strictEqual(getOfflineMutationQueue().length, 1);

      // Call purge with empty string / falsy userId
      await purgeUserOfflineData("");

      // In-memory queue must be cleared
      assert.strictEqual(getOfflineMutationQueue().length, 0);
    });
  });

  describe("8. Task 4 Reviewer Refinements: Startup Sweep & Blocked Entity Cascade Prevention", () => {
    it("reconcileStuckSyncingItems sweeps stuck syncing items back to pending", async () => {
      const item = await enqueueOutbox({
        operation: "TASK_UPDATE",
        entityId: "task-sweep-1",
        url: "/api/tasks/sweep-1",
        method: "PATCH",
        payload: { test: true },
      });

      // Manually set status to "syncing" to simulate interrupted flush (e.g. tab closed mid-sync)
      await updateOutboxItem(item.id, { status: "syncing" });

      let queue = await getOutboxQueue("test-user-01");
      assert.strictEqual(queue[0].status, "syncing");

      // Run reconciliation sweep
      const count = await reconcileStuckSyncingItems("test-user-01");
      assert.strictEqual(count, 1);

      queue = await getOutboxQueue("test-user-01");
      assert.strictEqual(queue[0].status, "pending", "Stuck syncing item must be reverted to pending");
    });

    it("flushOutbox skips subsequent mutations for an entity whose earlier mutation conflicted or failed", async () => {
      // Enqueue 2 mutations for task-entity-A:
      // First one will fail with 409 conflict
      // Second one should be SKIPPED in that flush cycle
      await enqueueOutbox({
        operation: "TASK_STEP_1",
        entityId: "task-entity-A",
        url: "/api/tasks/entity-A/step-1",
        method: "PATCH",
        payload: { step: 1 },
      });

      await enqueueOutbox({
        operation: "TASK_STEP_2",
        entityId: "task-entity-A",
        url: "/api/tasks/entity-A/step-2",
        method: "PATCH",
        payload: { step: 2 },
      });

      // Enqueue 1 mutation for independent task-entity-B which should succeed
      await enqueueOutbox({
        operation: "TASK_STEP_INDEPENDENT",
        entityId: "task-entity-B",
        url: "/api/tasks/entity-B",
        method: "PATCH",
        payload: { step: "b" },
      });

      const processedUrls: string[] = [];
      const mockFetch: typeof fetch = async (input) => {
        const url = String(input);
        processedUrls.push(url);
        if (url.includes("entity-A/step-1")) {
          return new Response(JSON.stringify({ error: "Version conflict" }), { status: 409 });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      };

      const result = await flushOutbox("test-user-01", { fetchFn: mockFetch });

      assert.strictEqual(result.conflicts, 1, "Entity A step 1 conflicts");
      assert.strictEqual(result.succeeded, 1, "Entity B succeeds");

      // Verify that step 2 for entity-A was NOT called in this flush
      assert.ok(
        !processedUrls.includes("/api/tasks/entity-A/step-2"),
        "Subsequent mutation for conflicted entity-A must be skipped in current flush cycle"
      );

      const queue = await getOutboxQueue("test-user-01");
      const step2 = queue.find((i) => i.operation === "TASK_STEP_2");
      assert.ok(step2, "Step 2 should remain in queue");
      assert.strictEqual(step2?.status, "pending", "Step 2 remains pending for future retry after conflict resolution");
    });
  });

  describe("9. Connectivity Detection & Outbox Subscription Bindings", () => {
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
      const listeners: string[] = [];

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

    it("notifies subscribers when items are enqueued in outbox", async () => {
      const notifications: OfflineOutboxItem[][] = [];

      const unsubscribe = subscribeOutbox((items) => {
        notifications.push(items);
      });

      await enqueueOutbox(
        {
          operation: "DOCUMENT_FORWARD",
          entityId: "doc-101",
          url: "/api/documents/101/forward",
          method: "POST",
          payload: { targetUserId: "user-approver" },
        },
        "test-user-01"
      );

      assert.ok(notifications.length > 0, "Subscriber must be notified on enqueue");
      const latest = notifications[notifications.length - 1];
      assert.strictEqual(latest.length, 1);
      assert.strictEqual(latest[0].entityId, "doc-101");
      assert.strictEqual(latest[0].status, "pending");

      unsubscribe();
    });

    it("correctly partitions pending vs conflict items for UX indicators", async () => {
      const uid = "test-user-01";

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

      await resolveConflict(item2.id, "discard", uid);
      const updatedQueue = await getOutboxQueue(uid);
      const updatedConflicts = updatedQueue.filter((i) => i.status === "conflict");
      assert.strictEqual(updatedConflicts.length, 0, "Conflict should be cleared after resolution");
    });

    it("handles outbox flush lifecycle and transitions items to synced", async () => {
      const uid = "test-user-01";

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

  describe("10. Background Sync Registration & Outbox Telemetry", () => {
    const TEST_USER = "test-sync-user";

    beforeEach(async () => {
      clearTelemetryLog();
      setActiveUserId(TEST_USER);
      await clearOutbox(TEST_USER);
    });

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

    it("records sync.queued telemetry on enqueue and strips sensitive title/credentials", async () => {
      await enqueueOutbox({
        operation: "CREATE_TASK",
        url: "/api/tasks",
        method: "POST",
        payload: {
          title: "Báo cáo tài chính mật 2026",
          password: "supersecretpassword",
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

  describe("11. P10 Offline: Reconnect Idempotency, Unknown-Result Reconciliation & State Taxonomy", () => {
    const USER = "reconnect-user-01";

    beforeEach(async () => {
      resetMemoryDatabase();
      setActiveUserId(USER);
      await clearOutbox(USER);
    });

    describe("T62 / C6: Truthful offline state taxonomy", () => {
      it("exposes exactly the six canonical truthful Vietnamese labels", () => {
        assert.deepEqual([...CANONICAL_OFFLINE_LABELS], [
          "Đã lưu trên thiết bị",
          "Đang chờ đồng bộ",
          "Đang đồng bộ",
          "Đã đồng bộ",
          "Không thể đồng bộ",
          "Xung đột cần xử lý",
        ]);
        assert.equal(OFFLINE_STATE_LABELS["server-confirmed"], "Đã đồng bộ");
        assert.equal(OFFLINE_STATE_LABELS.queued, "Đang chờ đồng bộ");
        assert.equal(OFFLINE_STATE_LABELS.conflict, "Xung đột cần xử lý");
        assert.equal(OFFLINE_STATE_LABELS.failed, "Không thể đồng bộ");
      });

      it("never presents queued or unconfirmed work as server-confirmed", () => {
        const queued = outboxItemToOfflineState({ status: "pending" });
        const unknown = outboxItemToOfflineState({
          status: "pending",
          unconfirmedResult: true,
        });

        assert.equal(queued, "queued");
        assert.equal(unknown, "unknown-after-timeout");
        assert.notEqual(queued, "server-confirmed");
        assert.notEqual(unknown, "server-confirmed");
        assert.equal(isServerConfirmed(queued), false);
        assert.equal(isServerConfirmed(unknown), false);

        assert.notEqual(
          labelForOfflineState(unknown),
          OFFLINE_STATE_LABELS["server-confirmed"]
        );
      });

      it("prioritizes conflict over queued when both are present", () => {
        const aggregate = deriveOfflineState([
          { status: "pending" },
          { status: "conflict" },
        ]);
        assert.equal(aggregate, "conflict");
        assert.equal(deriveOfflineState([]), null);
      });

      it("surfaces the local-only 'Đã lưu trên thiết bị' label for work queued on an offline device", () => {
        const queued = outboxItemToOfflineState({ status: "pending" });

        assert.equal(
          offlineStateForDisplay(queued, { isOnline: true }),
          "queued",
          "Online queued work is waiting to sync"
        );
        assert.equal(
          offlineStateForDisplay(queued, { isOnline: false }),
          "local-only",
          "Offline queued work is truthfully saved on the device"
        );
        assert.equal(
          labelForOfflineState("local-only"),
          "Đã lưu trên thiết bị",
          "local-only must render the canonical saved-on-device label"
        );

        const reachable = new Set<string>([
          labelForOfflineState("local-only"),
          labelForOfflineState("queued"),
          labelForOfflineState("syncing"),
          labelForOfflineState("server-confirmed"),
          labelForOfflineState("failed"),
          labelForOfflineState("conflict"),
        ]);
        for (const label of CANONICAL_OFFLINE_LABELS) {
          assert.ok(reachable.has(label), `Canonical label must be reachable: ${label}`);
        }
      });
    });

    describe("T65: reconnect race performs one logical flush", () => {
      it("fires exactly one request per mutation when reconnect triggers race", async () => {
        await enqueueOutbox(
          {
            operation: "TASK_STATUS_A",
            entityId: "task-a",
            url: "/api/tasks/task-a",
            method: "PATCH",
            payload: { status: "COMPLETED" },
          },
          USER
        );
        await enqueueOutbox(
          {
            operation: "TASK_STATUS_B",
            entityId: "task-b",
            url: "/api/tasks/task-b",
            method: "PATCH",
            payload: { status: "COMPLETED" },
          },
          USER
        );

        let callCount = 0;
        const seenKeys = new Set<string>();
        const delayedFetch: typeof fetch = async (_input, init) => {
          callCount++;
          const headers = (init?.headers as Record<string, string>) || {};
          seenKeys.add(headers["Idempotency-Key"]);
          await new Promise((resolve) => setTimeout(resolve, 25));
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        };

        const results = await Promise.all([
          flushOutbox(USER, { fetchFn: delayedFetch }),
          flushOutbox(USER, { fetchFn: delayedFetch }),
          flushOutbox(USER, { fetchFn: delayedFetch }),
        ]);

        assert.equal(callCount, 2, "Each mutation must be sent exactly once across racing flushes");
        assert.equal(seenKeys.size, 2, "Each mutation carries a distinct idempotency key");
        for (const result of results) {
          assert.equal(result.succeeded, 2);
        }

        const queue = await getOutboxQueue(USER);
        assert.equal(queue.length, 0, "Outbox must be drained after a single logical flush");
      });
    });

    describe("T66: unknown mutation result requires reconciliation", () => {
      it("marks a lost-response mutation as unknown-after-timeout, not cleanly pending", async () => {
        const item = await enqueueOutbox(
          {
            operation: "TASK_APPROVE",
            entityId: "task-unknown",
            url: "/api/tasks/task-unknown/approve",
            method: "POST",
            payload: { decision: "APPROVED" },
            idempotencyKey: "idemp-lost-response-key",
          },
          USER
        );

        const throwingFetch: typeof fetch = async () => {
          throw new Error("Socket closed after request dispatch");
        };

        const result = await flushOutbox(USER, { fetchFn: throwingFetch });
        assert.equal(result.succeeded, 0);

        const queue = await getOutboxQueue(USER);
        assert.equal(queue.length, 1, "Item must remain in the outbox");
        assert.equal(queue[0].status, "pending");
        assert.equal(queue[0].unconfirmedResult, true, "Lost response must set unconfirmedResult");

        const unknown = await getUnknownResultItems(USER);
        assert.equal(unknown.length, 1);
        assert.equal(outboxItemToOfflineState(unknown[0]), "unknown-after-timeout");
        assert.notEqual(
          labelForOfflineState(outboxItemToOfflineState(unknown[0])),
          OFFLINE_STATE_LABELS["server-confirmed"]
        );

        assert.equal(queue[0].id, item.id);
      });

      it("reconciles the unknown result by replaying with the SAME idempotency key", async () => {
        await enqueueOutbox(
          {
            operation: "TASK_APPROVE",
            entityId: "task-reconcile",
            url: "/api/tasks/task-reconcile/approve",
            method: "POST",
            payload: { decision: "APPROVED" },
            idempotencyKey: "idemp-reconcile-key",
          },
          USER
        );

        const seenKeys: string[] = [];
        const throwingFetch: typeof fetch = async (_input, init) => {
          const headers = (init?.headers as Record<string, string>) || {};
          seenKeys.push(headers["Idempotency-Key"]);
          throw new Error("Network lost after send");
        };

        await flushOutbox(USER, { fetchFn: throwingFetch });
        assert.equal((await getUnknownResultItems(USER)).length, 1);

        const successFetch: typeof fetch = async (_input, init) => {
          const headers = (init?.headers as Record<string, string>) || {};
          seenKeys.push(headers["Idempotency-Key"]);
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        };

        const reconcile = await reconcileUnknownItems(USER, { fetchFn: successFetch });
        assert.equal(reconcile.attempted, 1);
        assert.equal(reconcile.reconciled, 1);
        assert.equal(reconcile.remaining, 0);

        assert.equal(seenKeys.length, 2);
        assert.equal(
          seenKeys[0],
          seenKeys[1],
          "Reconciliation must replay with the original Idempotency-Key (exactly-once)"
        );

        const queue = await getOutboxQueue(USER);
        assert.equal(queue.length, 0, "Reconciled mutation must be confirmed and dequeued");
        assert.equal((await getUnknownResultItems(USER)).length, 0);
      });

      it("reconcileUnknownItems is a no-op when there is nothing unknown", async () => {
        const result = await reconcileUnknownItems(USER, {
          fetchFn: (async () => new Response("{}", { status: 200 })) as typeof fetch,
        });
        assert.deepEqual(result, {
          attempted: 0,
          reconciled: 0,
          remaining: 0,
          conflicts: 0,
          failed: 0,
        });
      });

      it("flags an interrupted in-flight (stuck syncing) mutation as an unknown result", async () => {
        const item = await enqueueOutbox(
          {
            operation: "TASK_UPDATE",
            entityId: "task-interrupted",
            url: "/api/tasks/task-interrupted",
            method: "PATCH",
            payload: { status: "IN_PROGRESS" },
            idempotencyKey: "idemp-interrupted",
          },
          USER
        );

        await updateOutboxItem(item.id, { status: "syncing" }, USER);
        assert.equal((await getUnknownResultItems(USER)).length, 0);

        const swept = await reconcileStuckSyncingItems(USER);
        assert.equal(swept, 1);

        const unknown = await getUnknownResultItems(USER);
        assert.equal(
          unknown.length,
          1,
          "An interrupted in-flight mutation must be treated as an unknown result, not cleanly unsent"
        );
        assert.equal(unknown[0].status, "pending");
      });

      it("reconciliation targets only unconfirmed items, leaving clean pending work for the drain", async () => {
        await enqueueOutbox(
          {
            operation: "TASK_APPROVE",
            entityId: "task-scope-unknown",
            url: "/api/tasks/task-scope-unknown/approve",
            method: "POST",
            payload: { decision: "APPROVED" },
            idempotencyKey: "idemp-scope-unknown",
          },
          USER
        );

        const throwingFetch: typeof fetch = async () => {
          throw new Error("Network lost after send");
        };
        await flushOutbox(USER, { fetchFn: throwingFetch });
        assert.equal((await getUnknownResultItems(USER)).length, 1);

        await enqueueOutbox(
          {
            operation: "TASK_UPDATE",
            entityId: "task-scope-clean",
            url: "/api/tasks/task-scope-clean",
            method: "PATCH",
            payload: { status: "IN_PROGRESS" },
            idempotencyKey: "idemp-scope-clean",
          },
          USER
        );

        const seenKeys: string[] = [];
        const recordingFetch: typeof fetch = async (_input, init) => {
          const headers = (init?.headers as Record<string, string>) || {};
          seenKeys.push(headers["Idempotency-Key"]);
          return new Response("{}", { status: 200 });
        };

        const result = await reconcileUnknownItems(USER, { fetchFn: recordingFetch });

        assert.equal(result.attempted, 1);
        assert.equal(result.reconciled, 1);
        assert.deepEqual(
          seenKeys,
          ["idemp-scope-unknown"],
          "Reconciliation must not resend clean, never-sent pending work"
        );

        const remaining = await getOutboxQueue(USER);
        assert.equal(remaining.length, 1, "Clean pending work must remain for the normal drain");
        assert.equal(remaining[0].idempotencyKey, "idemp-scope-clean");
      });

      it("reconnect drain reconciles unknown results then drains clean work as one logical pass", async () => {
        await enqueueOutbox(
          {
            operation: "TASK_APPROVE",
            entityId: "task-drain-unknown",
            url: "/api/tasks/task-drain-unknown/approve",
            method: "POST",
            payload: { decision: "APPROVED" },
            idempotencyKey: "idemp-drain-unknown",
          },
          USER
        );

        const throwingFetch: typeof fetch = async () => {
          throw new Error("Socket closed after send");
        };
        await flushOutbox(USER, { fetchFn: throwingFetch });

        await enqueueOutbox(
          {
            operation: "TASK_UPDATE",
            entityId: "task-drain-clean",
            url: "/api/tasks/task-drain-clean",
            method: "PATCH",
            payload: { status: "COMPLETED" },
            idempotencyKey: "idemp-drain-clean",
          },
          USER
        );

        const seenKeys: string[] = [];
        const okFetch: typeof fetch = async (_input, init) => {
          const headers = (init?.headers as Record<string, string>) || {};
          seenKeys.push(headers["Idempotency-Key"]);
          return new Response("{}", { status: 200 });
        };

        await drainOutbox(USER, { fetchFn: okFetch });

        assert.equal(seenKeys.length, 2, "One replay per mutation — no duplicate mutations");
        assert.equal(new Set(seenKeys).size, 2, "Each mutation replayed exactly once, with its own key");
        assert.deepEqual(
          [...seenKeys].sort(),
          ["idemp-drain-clean", "idemp-drain-unknown"]
        );

        const queue = await getOutboxQueue(USER);
        assert.equal(queue.length, 0, "Reconnect drain must fully settle the queue");
        assert.equal((await getUnknownResultItems(USER)).length, 0);
      });

      it("does not blindly re-attempt a still-unknown mutation within one drain", async () => {
        await enqueueOutbox(
          {
            operation: "TASK_APPROVE",
            entityId: "task-still-unknown",
            url: "/api/tasks/task-still-unknown/approve",
            method: "POST",
            payload: { decision: "APPROVED" },
            idempotencyKey: "idemp-still-unknown",
          },
          USER
        );

        const throwingFetch: typeof fetch = async () => {
          throw new Error("Socket closed after send");
        };
        await flushOutbox(USER, { fetchFn: throwingFetch });

        await enqueueOutbox(
          {
            operation: "TASK_UPDATE",
            entityId: "task-still-clean",
            url: "/api/tasks/task-still-clean",
            method: "PATCH",
            payload: { status: "COMPLETED" },
            idempotencyKey: "idemp-still-clean",
          },
          USER
        );

        const attemptKeys: string[] = [];
        const flakyFetch: typeof fetch = async (input, init) => {
          const key = ((init?.headers as Record<string, string>) || {})[
            "Idempotency-Key"
          ] as string;
          attemptKeys.push(key);
          if (String(input).includes("still-unknown")) {
            throw new Error("Response lost again");
          }
          return new Response("{}", { status: 200 });
        };

        await drainOutbox(USER, { fetchFn: flakyFetch });

        assert.equal(
          attemptKeys.filter((k) => k === "idemp-still-unknown").length,
          1,
          "A mutation whose result is still unknown must be attempted exactly once per drain"
        );
        assert.equal(
          attemptKeys.filter((k) => k === "idemp-still-clean").length,
          1,
          "Clean work must drain exactly once"
        );

        const queue = await getOutboxQueue(USER);
        assert.equal(queue.length, 1, "The still-unknown mutation remains for the next reconnect");
        assert.equal(queue[0].idempotencyKey, "idemp-still-unknown");
        assert.equal(queue[0].unconfirmedResult, true);
      });
    });
  });

  describe("12. Account Isolation & Safe Outbox Partitioning", () => {
    const USER_A = "offline-account-A";
    const USER_B = "offline-account-B";

    async function enqueueFor(userId: string, entityId: string) {
      return enqueueOutbox(
        {
          operation: "TASK_UPDATE",
          entityId,
          url: `/api/tasks/${entityId}`,
          method: "PATCH",
          payload: { entityId },
        },
        userId
      );
    }

    beforeEach(async () => {
      resetMemoryDatabase();
      setActiveUserId(USER_A);
      await clearOutbox(USER_A);
      await clearOutbox(USER_B);
    });

    it("never resolves mutations into a shared 'system' partition", () => {
      setActiveUserId(null);
      assert.equal(
        getActiveUserId(),
        "",
        "With no authenticated user the resolver must not fabricate a shared partition"
      );
    });

    it("refuses to enqueue a mutation without an authenticated owner", async () => {
      setActiveUserId(null);
      await assert.rejects(
        () =>
          enqueueOutbox({
            operation: "TASK_UPDATE",
            entityId: "orphan-task",
            url: "/api/tasks/orphan-task",
            method: "PATCH",
            payload: {},
          }),
        /authenticated user/i,
        "Enqueuing without a user must fail rather than leak into a shared bucket"
      );
    });

    it("keeps account partitions isolated when switching account without purge", async () => {
      const itemA = await enqueueFor(USER_A, "task-a-1");
      setActiveUserId(USER_B);
      const itemB = await enqueueFor(USER_B, "task-b-1");

      assert.equal((await getOutboxQueue(USER_A)).length, 1);
      assert.equal((await getOutboxQueue(USER_B)).length, 1);

      assert.equal(await getOutboxItem(USER_B, itemA.id), null);
      assert.equal(await getOutboxItem(USER_A, itemB.id), null);
      assert.ok(await getOutboxItem(USER_A, itemA.id));
      assert.ok(await getOutboxItem(USER_B, itemB.id));
    });

    it("switchActiveUser purges the previous account partition with no cross-account leakage", async () => {
      const itemA = await enqueueFor(USER_A, "task-a-leak");
      assert.equal((await getOutboxQueue(USER_A)).length, 1);

      await switchActiveUser(USER_B, { purgePrevious: true });

      assert.equal(getActiveUserId(), USER_B);
      assert.equal(
        (await getOutboxQueue(USER_A)).length,
        0,
        "Outgoing account's outbox must be cleared on switch"
      );
      assert.equal(
        await getOutboxItem(USER_A, itemA.id),
        null,
        "No residual mutation may remain for the previous account"
      );
      assert.equal((await getOutboxQueue(USER_B)).length, 0);

      await purgeUserOfflineData(USER_B);
      assert.equal((await getOutboxQueue(USER_B)).length, 0);
    });
  });

  describe("13. PWA Operational Telemetry & Privacy Preservation", () => {
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
