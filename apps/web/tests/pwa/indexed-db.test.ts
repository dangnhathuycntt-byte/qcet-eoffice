import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { QCET_OFFLINE_DB_NAME, QCET_OFFLINE_DB_VERSION, QCET_OFFLINE_STORES, isIndexedDBSupported, getDatabase, closeDatabase, deleteDatabase, getRecord, putRecord, deleteRecord, getRecordsByIndex, deleteRecordsByIndex, clearStore, resetMemoryDatabase } from "../../src/lib/pwa/indexed-db";
import { buildUserStoreKey, getReadCache, setReadCache, removeReadCache, clearUserReadCache, getDraft, setDraft, removeDraft, listUserDrafts, clearUserDrafts, enqueueOutboxItem, getOutboxItem, getOutboxQueue, updateOutboxItem, removeOutboxItem, clearUserOutbox, purgeUserOfflineData } from "../../src/lib/pwa/offline-store";
import { enqueueOfflineMutation } from "../../src/lib/offline-sync";

describe("Task 3: User-Isolated IndexedDB Offline Data Layer & Logout Purge", () => {
  beforeEach(async () => {
    resetMemoryDatabase();
    closeDatabase();
  });

  afterEach(async () => {
    resetMemoryDatabase();
    closeDatabase();
  });

  describe("1. Low-level IndexedDB Wrapper & SSR/Fallback Resilience", () => {
    test("detects SSR / non-browser environment safely without throwing", () => {
      // In default Node.js without window, isIndexedDBSupported should safely return false
      assert.strictEqual(typeof window, "undefined");
      assert.strictEqual(isIndexedDBSupported(), false);
    });
  });

  describe("2. Key Scoping & Namespace Isolation", () => {
    test("builds canonical user-scoped store keys according to specification", () => {
      const readKey = buildUserStoreKey("user-101", "READ_CACHE", "task-list");
      assert.strictEqual(
        readKey,
        "qcet:user:user-101:READ_CACHE:task-list",
        "Key must follow qcet:user:${userId}:${storeType}:${key}"
      );

      const draftKey = buildUserStoreKey("user-202", "DRAFT", "new-task-form");
      assert.strictEqual(
        draftKey,
        "qcet:user:user-202:DRAFT:new-task-form"
      );

      const outboxKey = buildUserStoreKey(
        "user-303",
        "MUTATION_OUTBOX",
        "mut-abc"
      );
      assert.strictEqual(
        outboxKey,
        "qcet:user:user-303:MUTATION_OUTBOX:mut-abc"
      );
    });
  });

  describe("3. READ_CACHE Operations & TTL Expiration", () => {
    test("stores and retrieves read cache data for isolated users", async () => {
      await setReadCache("user-a", "tasks-today", [{ id: "t1", title: "Task 1" }]);
      await setReadCache("user-b", "tasks-today", [{ id: "t2", title: "Task 2" }]);

      const userAData = await getReadCache<any[]>("user-a", "tasks-today");
      const userBData = await getReadCache<any[]>("user-b", "tasks-today");

      assert.deepStrictEqual(userAData, [{ id: "t1", title: "Task 1" }]);
      assert.deepStrictEqual(userBData, [{ id: "t2", title: "Task 2" }]);
    });

    test("honors TTL expiration on read cache items", async () => {
      // Set an item with ttl in the past (-1000ms)
      await setReadCache("user-a", "expired-cache", { ok: true }, { ttlMs: -1000 });

      // Set an item with ttl in the future (+60000ms)
      await setReadCache("user-a", "valid-cache", { ok: true }, { ttlMs: 60000 });

      const expired = await getReadCache("user-a", "expired-cache");
      assert.strictEqual(expired, null, "Expired item must return null and be pruned");

      const valid = await getReadCache("user-a", "valid-cache");
      assert.deepStrictEqual(valid, { ok: true });
    });

    test("removes and clears read cache for a specific user without touching others", async () => {
      await setReadCache("user-a", "item-1", "A1");
      await setReadCache("user-a", "item-2", "A2");
      await setReadCache("user-b", "item-1", "B1");

      await removeReadCache("user-a", "item-1");
      assert.strictEqual(await getReadCache("user-a", "item-1"), null);
      assert.strictEqual(await getReadCache("user-a", "item-2"), "A2");
      assert.strictEqual(await getReadCache("user-b", "item-1"), "B1");

      await clearUserReadCache("user-a");
      assert.strictEqual(await getReadCache("user-a", "item-2"), null);
      assert.strictEqual(await getReadCache("user-b", "item-1"), "B1");
    });
  });

  describe("4. DRAFT Operations & User Isolation", () => {
    test("creates, updates, retrieves, and lists drafts per user", async () => {
      await setDraft("teacher-1", "syllabus-draft", { week: 1, title: "Lập trình Web" });
      await setDraft("teacher-1", "exam-draft", { subject: "CS101", questions: 20 });
      await setDraft("teacher-2", "exam-draft", { subject: "CS202", questions: 30 });

      const teacher1Syllabus = await getDraft("teacher-1", "syllabus-draft");
      assert.deepStrictEqual(teacher1Syllabus, { week: 1, title: "Lập trình Web" });

      const teacher1Drafts = await listUserDrafts("teacher-1");
      assert.strictEqual(teacher1Drafts.length, 2);
      const keys = teacher1Drafts.map((d) => d.key).sort();
      assert.deepStrictEqual(keys, ["exam-draft", "syllabus-draft"]);

      // Teacher 2 drafts
      const teacher2Drafts = await listUserDrafts("teacher-2");
      assert.strictEqual(teacher2Drafts.length, 1);
      assert.strictEqual(teacher2Drafts[0].key, "exam-draft");
      assert.deepStrictEqual(teacher2Drafts[0].data, {
        subject: "CS202",
        questions: 30,
      });

      // Update draft
      await setDraft("teacher-1", "syllabus-draft", {
        week: 1,
        title: "Lập trình Web nâng cao",
      });
      const updated = await getDraft("teacher-1", "syllabus-draft");
      assert.deepStrictEqual(updated, {
        week: 1,
        title: "Lập trình Web nâng cao",
      });
    });

    test("removes single draft and clears all drafts for one user", async () => {
      await setDraft("u1", "d1", { val: 1 });
      await setDraft("u1", "d2", { val: 2 });
      await setDraft("u2", "d1", { val: 99 });

      await removeDraft("u1", "d1");
      assert.strictEqual(await getDraft("u1", "d1"), null);
      assert.deepStrictEqual(await getDraft("u1", "d2"), { val: 2 });

      await clearUserDrafts("u1");
      assert.strictEqual(await getDraft("u1", "d2"), null);
      assert.deepStrictEqual(await getDraft("u2", "d1"), { val: 99 });
    });
  });

  describe("5. MUTATION_OUTBOX Operations & Queue Ordering", () => {
    test("enqueues, retrieves, and filters outbox mutations chronologically", async () => {
      const m1 = await enqueueOutboxItem("u-lead", {
        operation: "TASK_UPDATE_PROGRESS",
        entityId: "task-001",
        url: "/api/tasks/task-001/progress",
        method: "PATCH",
        payload: { progressPercent: 75 },
        createdAt: 1000,
      });

      const m2 = await enqueueOutboxItem("u-lead", {
        operation: "TASK_STATUS_CHANGE",
        entityId: "task-001",
        url: "/api/tasks/task-001/status",
        method: "POST",
        payload: { status: "WAITING_APPROVAL" },
        createdAt: 2000,
        status: "pending",
      });

      const mOther = await enqueueOutboxItem("u-other", {
        operation: "TASK_UPDATE_PROGRESS",
        entityId: "task-999",
        url: "/api/tasks/task-999/progress",
        method: "PATCH",
        payload: { progressPercent: 10 },
      });

      // Fetch single item
      const fetchedM1 = await getOutboxItem("u-lead", m1.id);
      assert.ok(fetchedM1);
      assert.strictEqual(fetchedM1.operation, "TASK_UPDATE_PROGRESS");
      assert.strictEqual(fetchedM1.entityId, "task-001");

      // Fetch queue for u-lead
      const queue = await getOutboxQueue("u-lead");
      assert.strictEqual(queue.length, 2);
      assert.strictEqual(queue[0].id, m1.id);
      assert.strictEqual(queue[1].id, m2.id);

      // u-other's queue is completely isolated
      const queueOther = await getOutboxQueue("u-other");
      assert.strictEqual(queueOther.length, 1);
      assert.strictEqual(queueOther[0].id, mOther.id);

      // Update status to syncing
      await updateOutboxItem("u-lead", m1.id, { status: "syncing" });
      const pendingOnly = await getOutboxQueue("u-lead", "pending");
      assert.strictEqual(pendingOnly.length, 1);
      assert.strictEqual(pendingOnly[0].id, m2.id);

      const syncingOnly = await getOutboxQueue("u-lead", "syncing");
      assert.strictEqual(syncingOnly.length, 1);
      assert.strictEqual(syncingOnly[0].id, m1.id);
    });

    test("removes outbox item and clears user outbox", async () => {
      const m1 = await enqueueOutboxItem("u1", {
        operation: "OP1",
        entityId: "e1",
        url: "/api/test",
        method: "POST",
        payload: {},
      });
      const m2 = await enqueueOutboxItem("u1", {
        operation: "OP2",
        entityId: "e2",
        url: "/api/test",
        method: "POST",
        payload: {},
      });

      await removeOutboxItem("u1", m1.id);
      assert.strictEqual(await getOutboxItem("u1", m1.id), null);
      assert.ok(await getOutboxItem("u1", m2.id));

      await clearUserOutbox("u1");
      const queue = await getOutboxQueue("u1");
      assert.strictEqual(queue.length, 0);
    });
  });

  describe("6. Đăng xuất xóa Cache Storage riêng tư", () => {
    afterEach(() => {
      delete (globalThis as { caches?: unknown }).caches;
    });

    test("bỏ cache shell (trang HTML đã mở mang dữ liệu người dùng), giữ tài nguyên tĩnh", async () => {
      const deleted: string[] = [];
      Object.defineProperty(globalThis, "caches", {
        value: {
          keys: async () => ["qcet-static-2026.09.10.1", "qcet-shell-2026.09.10.1"],
          delete: async (name: string) => {
            deleted.push(name);
            return true;
          },
          open: async () => ({ keys: async () => [], delete: async () => true }),
        },
        configurable: true,
        writable: true,
      });

      await purgeUserOfflineData("user-shared-device");
      assert.deepEqual(deleted, ["qcet-shell-2026.09.10.1"]);
    });
  });
});
