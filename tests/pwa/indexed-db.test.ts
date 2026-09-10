import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  QCET_OFFLINE_DB_NAME,
  QCET_OFFLINE_DB_VERSION,
  QCET_OFFLINE_STORES,
  isIndexedDBSupported,
  getDatabase,
  closeDatabase,
  deleteDatabase,
  getRecord,
  putRecord,
  deleteRecord,
  getAllRecords,
  getRecordsByIndex,
  deleteRecordsByIndex,
  clearStore,
  countRecords,
  resetMemoryDatabase,
} from "../../src/lib/pwa/indexed-db";
import {
  buildUserStoreKey,
  buildUserPrefix,
  getReadCache,
  setReadCache,
  removeReadCache,
  clearUserReadCache,
  getDraft,
  setDraft,
  removeDraft,
  listUserDrafts,
  clearUserDrafts,
  enqueueOutboxItem,
  getOutboxItem,
  getOutboxQueue,
  updateOutboxItem,
  removeOutboxItem,
  clearUserOutbox,
  getUserOfflineStore,
  purgeUserOfflineData,
  purgeAllUserData,
} from "../../src/lib/pwa/offline-store";
import {
  enqueueOfflineMutation,
  getOfflineMutationQueue,
} from "../../src/lib/offline-sync";
import fs from "node:fs";
import path from "node:path";

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

    test("performs basic CRUD via in-memory fallback when IndexedDB is unavailable", async () => {
      const record = {
        fullKey: "qcet:user:u1:read_cache:doc-1",
        userId: "u1",
        data: { title: "Chỉ đạo tuần 37" },
      };

      await putRecord(QCET_OFFLINE_STORES.READ_CACHE, record);

      const fetched = await getRecord<typeof record>(
        QCET_OFFLINE_STORES.READ_CACHE,
        record.fullKey
      );
      assert.deepStrictEqual(fetched?.data, { title: "Chỉ đạo tuần 37" });

      const count = await countRecords(QCET_OFFLINE_STORES.READ_CACHE);
      assert.strictEqual(count, 1);

      await deleteRecord(QCET_OFFLINE_STORES.READ_CACHE, record.fullKey);
      const afterDelete = await getRecord(
        QCET_OFFLINE_STORES.READ_CACHE,
        record.fullKey
      );
      assert.strictEqual(afterDelete, null);
    });

    test("queries and deletes records by index in fallback mode", async () => {
      await putRecord(QCET_OFFLINE_STORES.DRAFT, {
        fullKey: "qcet:user:u1:draft:draft-1",
        userId: "u1",
        key: "draft-1",
        title: "Draft 1",
      });
      await putRecord(QCET_OFFLINE_STORES.DRAFT, {
        fullKey: "qcet:user:u1:draft:draft-2",
        userId: "u1",
        key: "draft-2",
        title: "Draft 2",
      });
      await putRecord(QCET_OFFLINE_STORES.DRAFT, {
        fullKey: "qcet:user:u2:draft:draft-3",
        userId: "u2",
        key: "draft-3",
        title: "Draft 3",
      });

      const u1Drafts = await getRecordsByIndex<{ fullKey: string; userId: string; title: string }>(
        QCET_OFFLINE_STORES.DRAFT,
        "by_user",
        "u1"
      );
      assert.strictEqual(u1Drafts.length, 2);

      const deletedCount = await deleteRecordsByIndex(
        QCET_OFFLINE_STORES.DRAFT,
        "by_user",
        "u1"
      );
      assert.strictEqual(deletedCount, 2);

      const remainingDrafts = await getAllRecords(QCET_OFFLINE_STORES.DRAFT);
      assert.strictEqual(remainingDrafts.length, 1);
      assert.strictEqual((remainingDrafts[0] as any).userId, "u2");
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

    test("builds canonical user prefix for wildcard/scope matching", () => {
      assert.strictEqual(
        buildUserPrefix("user-101"),
        "qcet:user:user-101"
      );
      assert.strictEqual(
        buildUserPrefix("user-101", "READ_CACHE"),
        "qcet:user:user-101:READ_CACHE"
      );
    });

    test("throws when userId is empty", () => {
      assert.throws(() => buildUserStoreKey("", "READ_CACHE", "key"));
      assert.throws(() => buildUserPrefix(""));
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

  describe("6. Scoped User Store Facade (getUserOfflineStore)", () => {
    test("provides fully scoped interface for a single user", async () => {
      const store = getUserOfflineStore("user-vinh");

      await store.readCache.set("calendar-week-37", { event: "Họp BGH" });
      await store.drafts.set("memo-draft", { title: "Kế hoạch CNTT" });
      const outboxItem = await store.outbox.enqueue({
        operation: "SUBMIT_REPORT",
        entityId: "rep-1",
        url: "/api/reports",
        method: "POST",
        payload: { pages: 5 },
      });

      const cached = await store.readCache.get("calendar-week-37");
      assert.deepStrictEqual(cached, { event: "Họp BGH" });

      const draft = await store.drafts.get("memo-draft");
      assert.deepStrictEqual(draft, { title: "Kế hoạch CNTT" });

      const queue = await store.outbox.getAll();
      assert.strictEqual(queue.length, 1);
      assert.strictEqual(queue[0].id, outboxItem.id);

      await store.purge();

      assert.strictEqual(await store.readCache.get("calendar-week-37"), null);
      assert.strictEqual(await store.drafts.get("memo-draft"), null);
      assert.strictEqual((await store.outbox.getAll()).length, 0);
    });
  });

  describe("7. Logout Purge Mechanism (purgeUserOfflineData)", () => {
    test("purges User A's offline data while leaving User B's data completely intact", async () => {
      // User A (Principal) offline state
      await setReadCache("user-a", "school-kpis", { count: 42 });
      await setDraft("user-a", "directive-draft", { text: "Công văn 123" });
      await enqueueOutboxItem("user-a", {
        operation: "APPROVE_TASK",
        entityId: "task-01",
        url: "/api/tasks/task-01/approve",
        method: "POST",
        payload: {},
      });

      // User B (Faculty Staff) offline state
      await setReadCache("user-b", "staff-tasks", { count: 5 });
      await setDraft("user-b", "lecture-draft", { text: "Giáo án tuần 1" });
      await enqueueOutboxItem("user-b", {
        operation: "UPDATE_ATTENDANCE",
        entityId: "class-01",
        url: "/api/classes/01",
        method: "POST",
        payload: {},
      });

      // Set up mock window.caches to verify Cache Storage purge
      const deletedCacheKeys: string[] = [];
      const deletedRequestUrls: string[] = [];

      (globalThis as any).window = {
        caches: {
          keys: async () => [
            "qcet-static-v1",
            "qcet-user-user-a-cache",
            "qcet-api-runtime",
          ],
          delete: async (key: string) => {
            deletedCacheKeys.push(key);
            return true;
          },
          open: async (name: string) => ({
            keys: async () => [
              { url: "https://eoffice.cdktcnqn.edu.vn/api/users/user-a/profile" },
              { url: "https://eoffice.cdktcnqn.edu.vn/api/users/user-b/profile" },
              { url: "https://eoffice.cdktcnqn.edu.vn/api/auth/me" },
            ],
            delete: async (req: { url: string }) => {
              deletedRequestUrls.push(req.url);
              return true;
            },
          }),
        },
      };

      // Also enqueue an in-memory mutation
      enqueueOfflineMutation({
        url: "/api/test",
        method: "PATCH",
        body: {},
        description: "Update progress offline",
      });
      assert.strictEqual(getOfflineMutationQueue().length > 0, true);

      // Execute logout purge for User A
      await purgeUserOfflineData("user-a");

      // Verify User A's IndexedDB stores are wiped
      assert.strictEqual(await getReadCache("user-a", "school-kpis"), null);
      assert.strictEqual(await getDraft("user-a", "directive-draft"), null);
      assert.strictEqual((await getOutboxQueue("user-a")).length, 0);

      // Verify User B's IndexedDB stores are COMPLETELY INTACT
      assert.deepStrictEqual(await getReadCache("user-b", "staff-tasks"), {
        count: 5,
      });
      assert.deepStrictEqual(await getDraft("user-b", "lecture-draft"), {
        text: "Giáo án tuần 1",
      });
      assert.strictEqual((await getOutboxQueue("user-b")).length, 1);

      // Verify Cache Storage purge
      assert.ok(
        deletedCacheKeys.includes("qcet-user-user-a-cache"),
        "User A-specific cache store must be deleted"
      );
      assert.ok(
        !deletedCacheKeys.includes("qcet-static-v1"),
        "Global static cache must not be deleted"
      );
      assert.ok(
        deletedRequestUrls.some((u) => u.includes("user-a")),
        "User A request URLs must be purged from runtime cache"
      );
      assert.ok(
        !deletedRequestUrls.some((u) => u.includes("user-b")),
        "User B request URLs must NOT be purged"
      );

      // Verify in-memory mutation queue is reset
      assert.strictEqual(getOfflineMutationQueue().length, 0);

      // Clean up global mock
      delete (globalThis as any).window;
    });

    test("purgeAllUserData wipes all data across all users and stores", async () => {
      await setReadCache("u1", "k1", "data1");
      await setReadCache("u2", "k2", "data2");
      await setDraft("u1", "d1", "draft1");
      await setDraft("u2", "d2", "draft2");

      await purgeAllUserData();

      assert.strictEqual(await getReadCache("u1", "k1"), null);
      assert.strictEqual(await getReadCache("u2", "k2"), null);
      assert.strictEqual(await getDraft("u1", "d1"), null);
      assert.strictEqual(await getDraft("u2", "d2"), null);
    });
  });

  describe("8. AuthContext Logout Integration Verification", () => {
    test("auth-context.tsx imports and calls purgeUserOfflineData during logout", () => {
      const authContextPath = path.resolve(
        __dirname,
        "../../src/lib/auth-context.tsx"
      );
      const source = fs.readFileSync(authContextPath, "utf-8");

      assert.match(
        source,
        /import\s+{[^}]*purgeUserOfflineData[^}]*}\s+from\s+["']\.\/pwa\/offline-store["']/,
        "auth-context.tsx must import purgeUserOfflineData from ./pwa/offline-store"
      );

      assert.match(
        source,
        /purgeUserOfflineData\s*\(\s*userIdToPurge\s*\)/,
        "auth-context logout must execute purgeUserOfflineData with active userId"
      );

      assert.match(
        source,
        /window\.location\.href\s*=\s*["']\/login["']/,
        "auth-context logout must redirect to /login after purge"
      );
    });
  });
});
