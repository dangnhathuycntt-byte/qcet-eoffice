/**
 * QCET E-Office Offline Mutation Sync Manager
 *
 * Redesigned to delegate to the durable, user-isolated IndexedDB Outbox
 * while maintaining 100% backward compatibility for existing callers.
 *
 * Implements:
 *  - OCC (Optimistic Concurrency Control) via expectedVersion and If-Match
 *  - Deduplication via Idempotency-Key
 *  - 409 Conflict preservation
 *  - Progressive background drain
 */

import {
  OfflineOutboxItem,
  EnqueueOutboxItemInput,
  enqueueOutbox,
  removeOutboxItem,
  clearOutbox,
  flushOutbox,
  getOutboxQueue,
  getConflictItems as outboxGetConflictItems,
  resolveConflict as outboxResolveConflict,
  subscribeOutbox,
  isOnline as outboxIsOnline,
  getActiveUserId,
} from "./pwa/outbox-manager";
import { registerPurgeHook } from "./pwa/offline-store";

export interface OfflineMutation {
  id: string;
  url: string;
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  description?: string;
  timestamp: number;
  retryCount: number;
  operation?: string;
  entityId?: string;
  expectedVersion?: number;
  idempotencyKey?: string;
  status?: "pending" | "syncing" | "conflict" | "failed";
  serverConflictData?: unknown;
  errorMessage?: string;
}

// In-memory cache for synchronous reads and SSR/Node testing compatibility
let memoryQueue: OfflineMutation[] = [];
const subscribers = new Set<(queue: OfflineMutation[]) => void>();

registerPurgeHook(() => {
  memoryQueue = [];
  notifySubscribers([]);
});

function mapOutboxItemToMutation(item: OfflineOutboxItem): OfflineMutation {
  return {
    id: item.id,
    url: item.url,
    method: item.method,
    body: item.payload,
    headers: {},
    description: item.operation,
    timestamp: item.createdAt,
    retryCount: item.retryCount,
    operation: item.operation,
    entityId: item.entityId,
    expectedVersion: item.expectedVersion,
    idempotencyKey: item.idempotencyKey,
    status: item.status,
    serverConflictData: item.serverConflictData,
    errorMessage: item.errorMessage,
  };
}

function notifySubscribers(queue: OfflineMutation[]): void {
  for (const subscriber of subscribers) {
    try {
      subscriber(queue);
    } catch {
      // Ignore subscriber errors
    }
  }
}

// Sync in-memory mirror when outbox updates occur
subscribeOutbox((items) => {
  memoryQueue = items.map(mapOutboxItemToMutation);
  notifySubscribers(memoryQueue);
});

// Initial hydration from IndexedDB if in browser
if (typeof window !== "undefined") {
  getOutboxQueue()
    .then((items) => {
      if (items.length > 0) {
        memoryQueue = items.map(mapOutboxItemToMutation);
        notifySubscribers(memoryQueue);
      }
    })
    .catch(() => {});
}

export function isOnline(): boolean {
  return outboxIsOnline();
}

/**
 * Returns current offline mutations from in-memory queue.
 * Guarantees synchronous response for React hooks and banner components.
 */
export function getOfflineMutationQueue(): OfflineMutation[] {
  return [...memoryQueue];
}

/**
 * Helper to infer entityId and operation from URL and method.
 */
function inferOperationAndEntity(
  url: string,
  method: string,
  description?: string
): { operation: string; entityId: string } {
  const cleanUrl = url.split("?")[0].replace(/\/$/, "");
  const segments = cleanUrl.split("/").filter(Boolean);

  let entityId = "global";
  if (segments.length >= 3 && segments[1] === "tasks") {
    entityId = segments[2];
  } else if (segments.length > 0) {
    entityId = segments[segments.length - 1];
  }

  const operation =
    description ||
    (method === "PATCH"
      ? "TASK_UPDATE"
      : method === "POST"
      ? "TASK_CREATE"
      : method === "DELETE"
      ? "TASK_DELETE"
      : "MUTATION");

  return { operation, entityId };
}

/**
 * Synchronous enqueue function maintaining backward-compatibility.
 * Instantly appends to in-memory queue and persists to IndexedDB outbox.
 */
export function enqueueOfflineMutation(
  item: Omit<OfflineMutation, "id" | "timestamp" | "retryCount"> & {
    id?: string;
    timestamp?: number;
    retryCount?: number;
  }
): OfflineMutation {
  const id =
    item.id ||
    `mut-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = item.timestamp || Date.now();
  const retryCount = item.retryCount || 0;
  const { operation, entityId } = inferOperationAndEntity(
    item.url,
    item.method,
    item.description || item.operation
  );

  const idempotencyKey =
    item.idempotencyKey ||
    `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const mutation: OfflineMutation = {
    id,
    url: item.url,
    method: item.method,
    body: item.body,
    headers: item.headers,
    description: item.description || operation,
    timestamp,
    retryCount,
    operation,
    entityId: item.entityId || entityId,
    expectedVersion: item.expectedVersion,
    idempotencyKey,
    status: item.status || "pending",
    serverConflictData: item.serverConflictData,
    errorMessage: item.errorMessage,
  };

  // 1. Synchronously update in-memory queue
  memoryQueue = [...memoryQueue.filter((m) => m.id !== id), mutation];
  notifySubscribers(memoryQueue);

  // 2. Persist to durable IndexedDB outbox asynchronously
  const outboxItem: EnqueueOutboxItemInput = {
    id: mutation.id,
    operation: mutation.operation || "MUTATION",
    entityId: mutation.entityId || "unknown",
    url: mutation.url,
    method: mutation.method as "POST" | "PUT" | "PATCH" | "DELETE",
    payload: mutation.body,
    expectedVersion: mutation.expectedVersion,
    idempotencyKey: mutation.idempotencyKey,
    createdAt: mutation.timestamp,
    retryCount: mutation.retryCount,
    status: mutation.status,
    serverConflictData: mutation.serverConflictData,
    errorMessage: mutation.errorMessage,
  };

  enqueueOutbox(outboxItem).catch((err) => {
    console.warn("Failed to persist mutation to IndexedDB outbox:", err);
  });

  return mutation;
}

/**
 * Removes a mutation from in-memory queue and IndexedDB outbox.
 */
export function removeOfflineMutation(id: string): void {
  memoryQueue = memoryQueue.filter((item) => item.id !== id);
  notifySubscribers(memoryQueue);
  removeOutboxItem(id).catch((err) => {
    console.warn("Failed to remove outbox item from IndexedDB:", err);
  });
}

/**
 * Clears all mutations from memory queue and IndexedDB outbox.
 */
export function clearOfflineMutationQueue(): void {
  memoryQueue = [];
  notifySubscribers([]);
  clearOutbox().catch((err) => {
    console.warn("Failed to clear IndexedDB outbox:", err);
  });
}

/**
 * Subscribes to mutation queue changes.
 */
export function subscribeOfflineQueue(
  listener: (queue: OfflineMutation[]) => void
): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

/**
 * Flushes all pending offline mutations by delegating to the durable outbox engine.
 */
export async function flushOfflineMutations(): Promise<{
  succeeded: number;
  failed: number;
}> {
  const result = await flushOutbox();
  // Refresh memory queue
  const latestOutbox = await getOutboxQueue();
  memoryQueue = latestOutbox.map(mapOutboxItemToMutation);
  notifySubscribers(memoryQueue);

  return {
    succeeded: result.succeeded,
    failed: result.failed,
  };
}

// Re-export conflict management functions for UI integration
export {
  outboxGetConflictItems as getConflictItems,
  outboxResolveConflict as resolveConflict,
};
