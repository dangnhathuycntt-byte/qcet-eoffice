import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  enqueueOutbox,
  getOutboxQueue,
  peekOutbox,
  getConflictItems,
  resolveConflict,
  removeOutboxItem,
  clearOutbox,
  updateOutboxItem,
  flushOutbox,
  reconcileStuckSyncingItems,
  setActiveUserId,
  getActiveUserId,
  subscribeOutbox,
  OfflineOutboxItem,
} from "../../src/lib/pwa/outbox-manager";
import {
  purgeUserOfflineData,
  clearOfflineMutationQueue,
  getOutboxQueue as getStoreOfflineMutationQueue,
} from "../../src/lib/pwa/offline-store";
import { resetMemoryDatabase } from "../../src/lib/pwa/indexed-db";
import {
  enqueueOfflineMutation,
  getOfflineMutationQueue,
  removeOfflineMutation,
  clearOfflineMutationQueue as clearLegacyMutationQueue,
  flushOfflineMutations,
  subscribeOfflineQueue,
} from "../../src/lib/offline-sync";

describe("Task 4: Durable Offline Mutation Outbox with Idempotency & OCC Conflict Handling", () => {
  beforeEach(async () => {
    resetMemoryDatabase();
    setActiveUserId("test-user-01");
    await clearOutbox("test-user-01");
    await clearOutbox("test-user-02");
    clearOfflineMutationQueue();
    clearLegacyMutationQueue();
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

    it("indexed-db.ts onblocked handler resets dbInstance and dbOpenPromise to null", () => {
      const idbFilePath = path.resolve(
        process.cwd(),
        "src/lib/pwa/indexed-db.ts"
      );
      const content = fs.readFileSync(idbFilePath, "utf-8");

      assert.ok(
        content.includes("request.onblocked"),
        "indexed-db.ts must have onblocked handler"
      );
      assert.ok(
        content.includes("dbInstance = null;") &&
          content.includes("dbOpenPromise = null;"),
        "onblocked must reset dbInstance and dbOpenPromise to null"
      );
    });
  });

  describe("8. Offline Conflict Dialog Component Quality & Standards", () => {
    it("conforms strictly to QCET Light-Only UI standard (zero dark: classes)", () => {
      const dialogPath = path.resolve(
        process.cwd(),
        "src/components/pwa/offline-conflict-dialog.tsx"
      );
      const content = fs.readFileSync(dialogPath, "utf-8");

      assert.ok(
        !content.includes("dark:"),
        "offline-conflict-dialog.tsx must not contain any dark: CSS classes"
      );
      assert.ok(
        !content.includes(".dark"),
        "offline-conflict-dialog.tsx must not contain any .dark selectors"
      );
    });

    it("contains zero decorative emojis", () => {
      const dialogPath = path.resolve(
        process.cwd(),
        "src/components/pwa/offline-conflict-dialog.tsx"
      );
      const content = fs.readFileSync(dialogPath, "utf-8");
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

      assert.ok(
        !emojiRegex.test(content),
        "offline-conflict-dialog.tsx must contain zero decorative emojis"
      );
    });

    it("implements required Vietnamese administrative titles, descriptions, and action buttons", () => {
      const dialogPath = path.resolve(
        process.cwd(),
        "src/components/pwa/offline-conflict-dialog.tsx"
      );
      const content = fs.readFileSync(dialogPath, "utf-8");

      assert.ok(content.includes("Xung đột dữ liệu ngoại tuyến"));
      assert.ok(content.includes("Bỏ thay đổi của tôi"));
      assert.ok(content.includes("Áp dụng lại (Ghi đè)"));
      assert.ok(content.includes("Xem chi tiết"));
      assert.ok(content.includes("min-h-[44px]"), "All interactive buttons must satisfy min 44px touch ergonomics");
      assert.ok(
        content.includes("size-11 min-h-[44px] min-w-[44px]"),
        "Dismiss button must satisfy min 44x44px touch boundary"
      );
    });
  });

  describe("9. Task 4 Reviewer Refinements: Startup Sweep & Blocked Entity Cascade Prevention", () => {
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
});
