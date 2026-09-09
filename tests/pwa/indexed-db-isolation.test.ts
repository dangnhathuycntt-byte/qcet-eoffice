import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getReadCache,
  setReadCache,
  getDraft,
  setDraft,
  listUserDrafts,
  enqueueOutboxItem,
  getOutboxQueue,
  purgeUserOfflineData,
  purgeAllUserData,
} from "../../src/lib/pwa/offline-store";
import { resetMemoryDatabase } from "../../src/lib/pwa/indexed-db";

describe("PWA IndexedDB Multi-Tenant Isolation & Logout Purge Suite", () => {
  const USER_A = "user-quang-ninh-001";
  const USER_B = "user-ha-long-002";

  beforeEach(() => {
    resetMemoryDatabase();
  });

  it("strictly isolates read cache between two institutional users", async () => {
    // User A caches their task list
    await setReadCache(USER_A, "/api/tasks", {
      tasks: [{ id: "task-01", title: "Soạn giáo án điện tử", role: "teacher" }],
    });

    // User B caches their administrative dashboard
    await setReadCache(USER_B, "/api/tasks", {
      tasks: [{ id: "task-99", title: "Ký duyệt kế hoạch tài chính", role: "dean" }],
    });

    // Verify User A only reads User A data
    const userACache = await getReadCache<{ tasks: Array<{ id: string; title: string }> }>(
      USER_A,
      "/api/tasks"
    );
    assert.ok(userACache);
    assert.equal(userACache.tasks.length, 1);
    assert.equal(userACache.tasks[0].id, "task-01");
    assert.equal(userACache.tasks[0].title, "Soạn giáo án điện tử");

    // Verify User B only reads User B data
    const userBCache = await getReadCache<{ tasks: Array<{ id: string; title: string }> }>(
      USER_B,
      "/api/tasks"
    );
    assert.ok(userBCache);
    assert.equal(userBCache.tasks.length, 1);
    assert.equal(userBCache.tasks[0].id, "task-99");
    assert.equal(userBCache.tasks[0].title, "Ký duyệt kế hoạch tài chính");
  });

  it("strictly isolates offline drafts and prevents cross-user leakage", async () => {
    // User A saves draft syllabus
    await setDraft(USER_A, "task-draft-101", {
      subject: "Toán cao cấp",
      credits: 3,
    });

    // User B saves draft exam paper
    await setDraft(USER_B, "exam-draft-202", {
      subject: "Kinh tế vi mô",
      durationMinutes: 90,
    });

    // List drafts for User A
    const draftsA = await listUserDrafts(USER_A);
    assert.equal(draftsA.length, 1);
    assert.equal(draftsA[0].key, "task-draft-101");
    assert.deepEqual(draftsA[0].data, { subject: "Toán cao cấp", credits: 3 });

    // Ensure User B cannot read User A's draft
    const leakAttempt = await getDraft(USER_B, "task-draft-101");
    assert.equal(leakAttempt, null);

    // List drafts for User B
    const draftsB = await listUserDrafts(USER_B);
    assert.equal(draftsB.length, 1);
    assert.equal(draftsB[0].key, "exam-draft-202");
  });

  it("strictly isolates offline mutation outbox queues between users", async () => {
    // User A enqueues task status update
    await enqueueOutboxItem(USER_A, {
      operation: "TASK_UPDATE_STATUS",
      url: "/api/tasks/task-01/status",
      method: "PATCH",
      payload: { status: "COMPLETED" },
      entityId: "task-01",
    });

    // User B enqueues grade submission
    await enqueueOutboxItem(USER_B, {
      operation: "GRADE_SUBMIT",
      url: "/api/grades/class-3A",
      method: "POST",
      payload: { average: 8.5 },
      entityId: "class-3A",
    });

    const queueA = await getOutboxQueue(USER_A);
    const queueB = await getOutboxQueue(USER_B);

    assert.equal(queueA.length, 1);
    assert.equal(queueA[0].operation, "TASK_UPDATE_STATUS");
    assert.equal(queueA[0].entityId, "task-01");

    assert.equal(queueB.length, 1);
    assert.equal(queueB[0].operation, "GRADE_SUBMIT");
    assert.equal(queueB[0].entityId, "class-3A");
  });

  it("purges only targeted user's offline data on logout, preserving other users' offline data", async () => {
    // Setup data for both users
    await setReadCache(USER_A, "/api/profile", { name: "User A" });
    await setDraft(USER_A, "draft-a", { content: "Draft A" });
    await enqueueOutboxItem(USER_A, {
      operation: "MUTATION_A",
      entityId: "item-a",
      url: "/api/a",
      method: "POST",
      payload: { value: "a" },
    });

    await setReadCache(USER_B, "/api/profile", { name: "User B" });
    await setDraft(USER_B, "draft-b", { content: "Draft B" });
    await enqueueOutboxItem(USER_B, {
      operation: "MUTATION_B",
      entityId: "item-b",
      url: "/api/b",
      method: "POST",
      payload: { value: "b" },
    });

    // User A logs out -> Purge User A
    await purgeUserOfflineData(USER_A);

    // Verify User A data is completely wiped
    const userACache = await getReadCache(USER_A, "/api/profile");
    const userADrafts = await listUserDrafts(USER_A);
    const userAQueue = await getOutboxQueue(USER_A);

    assert.equal(userACache, null);
    assert.equal(userADrafts.length, 0);
    assert.equal(userAQueue.length, 0);

    // Verify User B data remains 100% intact
    const userBCache = await getReadCache(USER_B, "/api/profile");
    const userBDrafts = await listUserDrafts(USER_B);
    const userBQueue = await getOutboxQueue(USER_B);

    assert.ok(userBCache);
    assert.equal(userBDrafts.length, 1);
    assert.equal(userBDrafts[0].key, "draft-b");
    assert.equal(userBQueue.length, 1);
    assert.equal(userBQueue[0].operation, "MUTATION_B");
  });

  it("purges all user partitions when full device wipe is executed", async () => {
    await setReadCache(USER_A, "/api/a", { val: 1 });
    await setReadCache(USER_B, "/api/b", { val: 2 });

    await purgeAllUserData();

    assert.equal(await getReadCache(USER_A, "/api/a"), null);
    assert.equal(await getReadCache(USER_B, "/api/b"), null);
  });
});
