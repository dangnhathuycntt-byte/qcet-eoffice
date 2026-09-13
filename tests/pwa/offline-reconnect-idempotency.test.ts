import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  enqueueOutbox,
  flushOutbox,
  clearOutbox,
  setActiveUserId,
  getOutboxQueue,
  getUnknownResultItems,
  updateOutboxItem,
  reconcileStuckSyncingItems,
  reconcileUnknownItems,
  drainOutbox,
} from "../../src/lib/pwa/outbox-manager";
import {
  OFFLINE_STATE_LABELS,
  CANONICAL_OFFLINE_LABELS,
  outboxItemToOfflineState,
  offlineStateForDisplay,
  deriveOfflineState,
  labelForOfflineState,
  isServerConfirmed,
} from "../../src/lib/pwa/offline-state";
import { resetMemoryDatabase } from "../../src/lib/pwa/indexed-db";
import { PWAOnboardingCoordinator } from "../../src/lib/pwa/onboarding-coordinator";

const USER = "reconnect-user-01";

function resetOutboxState() {
  resetMemoryDatabase();
  setActiveUserId(USER);
}

describe("P10 Offline: Reconnect Idempotency, Unknown-Result Reconciliation & State Taxonomy", () => {
  beforeEach(async () => {
    resetOutboxState();
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

      // An unconfirmed item must not surface as "Đã đồng bộ".
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

      // Every canonical label must be reachable at runtime, not just a constant.
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

      // Simulate the reconnect race: online event + focus + SW message draining together.
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
      assert.equal(
        outboxItemToOfflineState(unknown[0]),
        "unknown-after-timeout"
      );
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

      // Simulate an app interrupt mid-flight: dispatched but response never observed.
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

      // A clean, never-sent mutation queued alongside it.
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

  describe("T68: PWA onboarding install listeners are not duplicated", () => {
    it("captures beforeinstallprompt exactly once across repeated re-inits", () => {
      const originalWindow = globalThis.window;
      const originalLocalStorage = globalThis.localStorage;
      const originalSessionStorage = globalThis.sessionStorage;

      const registered: Record<string, number> = {};
      const fakeStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        length: 0,
        key: () => null,
      };
      const fakeWindow = {
        localStorage: fakeStorage,
        matchMedia: () => ({ matches: false }),
        addEventListener: (type: string) => {
          registered[type] = (registered[type] || 0) + 1;
        },
        removeEventListener: () => {},
      };

      Object.defineProperty(globalThis, "window", {
        value: fakeWindow,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "localStorage", {
        value: fakeStorage,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "sessionStorage", {
        value: fakeStorage,
        configurable: true,
        writable: true,
      });

      try {
        const coordinator = new PWAOnboardingCoordinator();
        coordinator.init("dedup-user-1");
        coordinator.init("dedup-user-2");
        coordinator.init("dedup-user-1");

        assert.equal(
          registered["beforeinstallprompt"] ?? 0,
          1,
          "Only one beforeinstallprompt capture may be registered across re-inits"
        );
        assert.equal(
          registered["appinstalled"] ?? 0,
          1,
          "Only one appinstalled listener may be registered across re-inits"
        );
      } finally {
        Object.defineProperty(globalThis, "window", {
          value: originalWindow,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(globalThis, "localStorage", {
          value: originalLocalStorage,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(globalThis, "sessionStorage", {
          value: originalSessionStorage,
          configurable: true,
          writable: true,
        });
      }
    });
  });
});
