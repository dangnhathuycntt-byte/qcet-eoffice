/**
 * QCET E-Office - Durable Offline Mutation Outbox Manager
 *
 * Implements an institutional-grade, user-isolated outbox pattern with:
 *  - OCC (Optimistic Concurrency Control) via expectedVersion and If-Match / x-expected-version
 *  - Deduplication via Idempotency-Key
 *  - 409 Conflict detection & preservation (never silently overwrite or discard)
 *  - Progressive sync: Background Sync (SyncManager) with online/visibility fallback
 *  - Strict FIFO sequential processing with concurrency mutex
 *  - Backward compatibility bridge for existing offline mutation queues
 */

import {
  OfflineOutboxItem,
  EnqueueOutboxItemInput,
  enqueueOutboxItem as storeEnqueue,
  getOutboxItem as storeGet,
  getOutboxQueue as storeGetQueue,
  updateOutboxItem as storeUpdate,
  removeOutboxItem as storeRemove,
  clearUserOutbox as storeClear,
} from "./offline-store";
import { recordTelemetry } from "./telemetry";

export type OutboxStatus = "pending" | "syncing" | "conflict" | "failed";

export type { OfflineOutboxItem, EnqueueOutboxItemInput };

export const MAX_OUTBOX_RETRIES = 5;
export const SYNC_TAG_QCET_OUTBOX = "qcet-outbox-sync";

// ---------------------------------------------------------------------------
// 1. User Context Resolver
// ---------------------------------------------------------------------------

let activeUserIdOverride: string | null = null;

export function setActiveUserId(userId: string | null): void {
  activeUserIdOverride = userId;
}

export function getActiveUserId(): string {
  if (activeUserIdOverride) {
    return activeUserIdOverride;
  }
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem("qcet_active_user");
      if (raw) {
        const user = JSON.parse(raw);
        if (user && user.id) {
          return String(user.id);
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }
  return "system";
}

// ---------------------------------------------------------------------------
// 2. Connectivity & Progressive Sync
// ---------------------------------------------------------------------------

export function isOnline(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
}

/**
 * Registers background sync with Service Worker if SyncManager is supported.
 * Falls back gracefully on browsers lacking Background Sync (iOS Safari, Firefox).
 */
export async function registerBackgroundSync(): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("SyncManager" in window)
  ) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if (
      "sync" in registration &&
      typeof (registration as any).sync?.register === "function"
    ) {
      await (registration as any).sync.register(SYNC_TAG_QCET_OUTBOX);
      return true;
    }
  } catch (err) {
    console.warn("Background Sync registration failed:", err);
  }
  return false;
}

// ---------------------------------------------------------------------------
// 3. In-Memory Mirror & Event Subscription
// ---------------------------------------------------------------------------

type OutboxSubscriber = (items: OfflineOutboxItem[]) => void;
const subscribers = new Set<OutboxSubscriber>();

function notifySubscribers(items: OfflineOutboxItem[]): void {
  for (const sub of subscribers) {
    try {
      sub(items);
    } catch (err) {
      console.warn("Error in outbox subscriber:", err);
    }
  }

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(
        new CustomEvent("qcet:outbox-updated", { detail: items })
      );
    } catch {
      // Ignore event dispatch failure
    }
  }
}

function notifyConflict(item: OfflineOutboxItem): void {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(
        new CustomEvent("qcet:outbox-conflict", { detail: item })
      );
    } catch {
      // Ignore
    }
  }
}

export function subscribeOutbox(listener: OutboxSubscriber): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// 4. Outbox CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Enqueue a mutation into the user-scoped outbox.
 */
export async function enqueueOutbox(
  item: EnqueueOutboxItemInput,
  userId?: string
): Promise<OfflineOutboxItem> {
  const uid = userId || getActiveUserId();
  const created = await storeEnqueue(uid, item);

  // Trigger background sync or fallback drain
  registerBackgroundSync().catch(() => {});

  // Refresh and notify
  const currentQueue = await storeGetQueue(uid);
  notifySubscribers(currentQueue);

  // Record non-sensitive operational telemetry
  recordTelemetry(
    "sync.queued",
    {
      itemId: created.id,
      operation: created.operation,
      entityId: created.entityId,
      method: created.method,
    },
    uid
  );

  return created;
}

/**
 * Startup reconciliation: Resets any mutation items left in "syncing" state back to "pending".
 * Safe because all mutations carry unique Idempotency-Key headers.
 */
export async function reconcileStuckSyncingItems(userId?: string): Promise<number> {
  const uid = userId || getActiveUserId();
  const syncingItems = await storeGetQueue(uid, "syncing");
  for (const item of syncingItems) {
    await storeUpdate(uid, item.id, {
      status: "pending",
      updatedAt: Date.now(),
    });
  }
  if (syncingItems.length > 0) {
    const queue = await storeGetQueue(uid);
    notifySubscribers(queue);
  }
  return syncingItems.length;
}

/**
 * Get items from the user's outbox, optionally filtered by status.
 */
export async function getOutboxQueue(
  userId?: string,
  status?: OutboxStatus
): Promise<OfflineOutboxItem[]> {
  const uid = userId || getActiveUserId();
  return storeGetQueue(uid, status);
}

/**
 * Get the next pending mutation item in FIFO order.
 */
export async function peekOutbox(
  userId?: string
): Promise<OfflineOutboxItem | null> {
  const uid = userId || getActiveUserId();
  const pending = await storeGetQueue(uid, "pending");
  return pending.length > 0 ? pending[0] : null;
}

/**
 * Get all mutation items currently in 409 conflict state.
 */
export async function getConflictItems(
  userId?: string
): Promise<OfflineOutboxItem[]> {
  const uid = userId || getActiveUserId();
  return storeGetQueue(uid, "conflict");
}

/**
 * Remove an item from the outbox.
 */
export async function removeOutboxItem(
  itemId: string,
  userId?: string
): Promise<void> {
  const uid = userId || getActiveUserId();
  await storeRemove(uid, itemId);
  const currentQueue = await storeGetQueue(uid);
  notifySubscribers(currentQueue);
}

/**
 * Clear all outbox items for a user.
 */
export async function clearOutbox(userId?: string): Promise<void> {
  const uid = userId || getActiveUserId();
  await storeClear(uid);
  notifySubscribers([]);
}

/**
 * Update an outbox item.
 */
export async function updateOutboxItem(
  itemId: string,
  updates: Partial<OfflineOutboxItem>,
  userId?: string
): Promise<void> {
  const uid = userId || getActiveUserId();
  await storeUpdate(uid, itemId, updates);
  const currentQueue = await storeGetQueue(uid);
  notifySubscribers(currentQueue);
}

/**
 * Resolves a 409 Conflict state on an outbox item:
 *  - 'override': Clears expectedVersion constraint, resets status to pending, and re-triggers flush.
 *  - 'discard': Removes the item from the outbox entirely.
 */
export async function resolveConflict(
  itemId: string,
  resolution: "override" | "discard",
  userId?: string
): Promise<void> {
  const uid = userId || getActiveUserId();

  if (resolution === "discard") {
    await removeOutboxItem(itemId, uid);
    return;
  }

  if (resolution === "override") {
    const existing = await storeGet(uid, itemId);
    if (!existing) return;

    // Remove expectedVersion check to force overwrite, reset status to pending
    await storeUpdate(uid, itemId, {
      status: "pending",
      expectedVersion: undefined,
      serverConflictData: undefined,
      errorMessage: undefined,
      retryCount: 0,
      updatedAt: Date.now(),
    });

    const currentQueue = await storeGetQueue(uid);
    notifySubscribers(currentQueue);
  }
}

// ---------------------------------------------------------------------------
// 5. Sequential Flush Engine with OCC & Idempotency
// ---------------------------------------------------------------------------

export interface FlushResult {
  succeeded: number;
  failed: number;
  conflicts: number;
}

let isFlushing = false;
let activeFlushPromise: Promise<FlushResult> | null = null;

/**
 * Flushes all pending mutations in strict sequential FIFO order.
 * Ensures single-threaded execution via mutex lock.
 */
export async function flushOutbox(
  userId?: string,
  options?: {
    fetchFn?: typeof fetch;
    maxRetries?: number;
  }
): Promise<FlushResult> {
  if (isFlushing && activeFlushPromise) {
    return activeFlushPromise;
  }

  isFlushing = true;
  activeFlushPromise = (async () => {
    try {
      return await executeFlush(userId, options);
    } finally {
      isFlushing = false;
      activeFlushPromise = null;
    }
  })();

  return activeFlushPromise;
}

async function executeFlush(
  userId?: string,
  options?: {
    fetchFn?: typeof fetch;
    maxRetries?: number;
  }
): Promise<FlushResult> {
  const uid = userId || getActiveUserId();
  const fetcher = options?.fetchFn || (typeof fetch !== "undefined" ? fetch : null);
  const maxRetries = options?.maxRetries ?? MAX_OUTBOX_RETRIES;

  if (!isOnline()) {
    const pendingCount = (await storeGetQueue(uid, "pending")).length;
    return { succeeded: 0, failed: pendingCount, conflicts: 0 };
  }

  if (!fetcher) {
    return { succeeded: 0, failed: 0, conflicts: 0 };
  }

  // 0. Pre-flush sweep: reset any items stuck in "syncing" back to "pending"
  await reconcileStuckSyncingItems(uid);

  const pendingItems = await storeGetQueue(uid, "pending");
  if (pendingItems.length === 0) {
    return { succeeded: 0, failed: 0, conflicts: 0 };
  }

  let succeeded = 0;
  let failed = 0;
  let conflicts = 0;
  const blockedEntityIds = new Set<string>();

  for (const item of pendingItems) {
    // If an earlier mutation for this entity failed or conflicted in this cycle,
    // skip subsequent mutations for the same entity to avoid cascading errors or out-of-order state.
    if (item.entityId && blockedEntityIds.has(item.entityId)) {
      continue;
    }

    // 1. Mark status as syncing
    await storeUpdate(uid, item.id, {
      status: "syncing",
      updatedAt: Date.now(),
    });

    // 2. Prepare headers with OCC and Idempotency keys
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Idempotency-Key": item.idempotencyKey,
    };

    if (typeof item.expectedVersion === "number") {
      headers["If-Match"] = `"${item.expectedVersion}"`;
      headers["x-expected-version"] = String(item.expectedVersion);
    }

    try {
      const response = await fetcher(item.url, {
        method: item.method,
        headers,
        body: item.payload !== undefined ? JSON.stringify(item.payload) : undefined,
      });

      if (response.ok) {
        // Successful mutation sync -> Remove from outbox
        await storeRemove(uid, item.id);
        succeeded++;
        recordTelemetry(
          "sync.success",
          {
            itemId: item.id,
            operation: item.operation,
            entityId: item.entityId,
            method: item.method,
          },
          uid
        );
      } else if (response.status === 409) {
        // 409 Conflict: OCC mismatch.
        // DO NOT discard and DO NOT overwrite server data blindly.
        conflicts++;
        failed++;
        if (item.entityId) {
          blockedEntityIds.add(item.entityId);
        }

        recordTelemetry(
          "sync.conflict",
          {
            itemId: item.id,
            operation: item.operation,
            entityId: item.entityId,
            expectedVersion: item.expectedVersion,
          },
          uid
        );

        let conflictData: unknown = null;
        try {
          conflictData = await response.json();
        } catch {
          conflictData = {
            error: "Xung đột phiên bản dữ liệu (409 Conflict)",
          };
        }

        const conflictItem: OfflineOutboxItem = {
          ...item,
          status: "conflict",
          serverConflictData: conflictData,
          errorMessage:
            (conflictData as any)?.error ||
            (conflictData as any)?.message ||
            "Dữ liệu trên máy chủ đã thay đổi bởi người dùng khác.",
          updatedAt: Date.now(),
        };

        await storeUpdate(uid, item.id, {
          status: "conflict",
          serverConflictData: conflictData,
          errorMessage: conflictItem.errorMessage,
          updatedAt: Date.now(),
        });

        notifyConflict(conflictItem);
      } else if (response.status >= 400 && response.status < 500) {
        // Permanent client error (400, 404, 422, etc.)
        failed++;
        if (item.entityId) {
          blockedEntityIds.add(item.entityId);
        }
        const nextRetries = item.retryCount + 1;
        let clientErr = `Lỗi yêu cầu (${response.status})`;
        try {
          const body = await response.json();
          if (body?.error || body?.message) {
            clientErr = body.error || body.message;
          }
        } catch {
          // Ignore json parse error
        }

        await storeUpdate(uid, item.id, {
          retryCount: nextRetries,
          status: "failed",
          errorMessage: clientErr,
          updatedAt: Date.now(),
        });
      } else {
        // 5xx Server Error: Increment retry count
        failed++;
        if (item.entityId) {
          blockedEntityIds.add(item.entityId);
        }
        const nextRetries = item.retryCount + 1;
        if (nextRetries >= maxRetries) {
          await storeUpdate(uid, item.id, {
            retryCount: nextRetries,
            status: "failed",
            errorMessage: `Thất bại sau ${maxRetries} lần thử lại máy chủ.`,
            updatedAt: Date.now(),
          });
        } else {
          await storeUpdate(uid, item.id, {
            retryCount: nextRetries,
            status: "pending",
            errorMessage: `Lỗi máy chủ (${response.status}), sẽ thử lại.`,
            updatedAt: Date.now(),
          });
        }
      }
    } catch (networkErr: any) {
      // Network drop or connection refused: Revert to pending and abort sequential drain
      failed++;
      if (item.entityId) {
        blockedEntityIds.add(item.entityId);
      }
      const nextRetries = item.retryCount + 1;
      await storeUpdate(uid, item.id, {
        retryCount: nextRetries,
        status: "pending",
        errorMessage: networkErr?.message || "Mất kết nối mạng khi đồng bộ.",
        updatedAt: Date.now(),
      });
      break; // Stop drain when offline
    }
  }

  const updatedQueue = await storeGetQueue(uid);
  notifySubscribers(updatedQueue);

  return { succeeded, failed, conflicts };
}

// ---------------------------------------------------------------------------
// 6. Global Event Handlers for Automatic Drain
// ---------------------------------------------------------------------------

let isListenersAttached = false;

export function setupOutboxAutoSyncListeners(): void {
  if (typeof window === "undefined" || isListenersAttached) {
    return;
  }

  isListenersAttached = true;

  // Startup reconciliation sweep: reset any stuck syncing items
  reconcileStuckSyncingItems().catch(() => {});

  const triggerDrain = () => {
    if (isOnline()) {
      flushOutbox().catch(() => {});
    }
  };

  // 1. Online network reconnection event
  window.addEventListener("online", triggerDrain);

  // 2. Tab focus & visibility change
  window.addEventListener("focus", triggerDrain);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        triggerDrain();
      }
    });
  }

  // 3. Service Worker background sync postMessage
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "QCET_OUTBOX_DRAIN") {
        triggerDrain();
      }
    });
  }
}

// Automatically attach listeners in browser environment
if (typeof window !== "undefined") {
  setupOutboxAutoSyncListeners();
}
