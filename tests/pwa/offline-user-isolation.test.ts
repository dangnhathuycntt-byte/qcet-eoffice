import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  enqueueOutbox,
  getOutboxQueue,
  getActiveUserId,
  setActiveUserId,
  switchActiveUser,
  clearOutbox,
} from "../../src/lib/pwa/outbox-manager";
import {
  getOutboxItem,
  purgeUserOfflineData,
} from "../../src/lib/pwa/offline-store";
import { resetMemoryDatabase } from "../../src/lib/pwa/indexed-db";

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

describe("P10 Offline: Account Isolation & Safe Outbox Partitioning (T63)", () => {
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

    // User B cannot resolve User A's item by id.
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

    // A subsequent purge of B must not resurrect or affect A.
    await purgeUserOfflineData(USER_B);
    assert.equal((await getOutboxQueue(USER_B)).length, 0);
  });

  it("scopes the push/install snooze by account (no shared-device suppression)", async () => {
    const backing = new Map<string, string>();
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => (backing.has(key) ? backing.get(key)! : null),
        setItem: (key: string, value: string) => void backing.set(key, value),
        removeItem: (key: string) => void backing.delete(key),
        clear: () => backing.clear(),
        key: (index: number) => Array.from(backing.keys())[index] ?? null,
        get length() {
          return backing.size;
        },
      },
      configurable: true,
      writable: true,
    });

    try {
      const { isPushOnboardingSnoozed, recordPushOnboardingSnooze } = await import(
        "../../src/components/pwa/push-onboarding-sheet"
      );

      assert.equal(
        isPushOnboardingSnoozed(USER_A),
        false,
        "No dismissal recorded yet"
      );

      recordPushOnboardingSnooze(USER_A);

      assert.equal(
        isPushOnboardingSnoozed(USER_A),
        true,
        "A dismissal must suppress the prompt for the same account"
      );
      assert.equal(
        isPushOnboardingSnoozed(USER_B),
        false,
        "A dismissal must NOT suppress the prompt for another account on a shared device"
      );
      assert.ok(
        backing.has(`qcet-push-onboarding-dismissed:${USER_A}`),
        "Snooze must be persisted under the account-scoped key, never a global constant"
      );
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        value: originalLocalStorage,
        configurable: true,
        writable: true,
      });
    }
  });
});
