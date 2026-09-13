/**
 * QCET E-Office - High-Level Offline Store & Data Isolation Layer
 * Segregates data into 3 distinct categories:
 *  1. READ_CACHE: Ephemeral read data (tasks, calendar). Can be discarded.
 *  2. DRAFT: Unsaved user drafts (task drafts, notes). Persisted until cleared.
 *  3. MUTATION_OUTBOX: Queued mutations to sync with server.
 *
 * All records are strictly isolated by userId namespace:
 *   qcet:user:${userId}:${storeType}:${key}
 * User B on a shared device will never see User A's data.
 */

import {
  QCET_OFFLINE_STORES,
  BaseOfflineRecord,
  getRecord,
  putRecord,
  deleteRecord,
  getRecordsByIndex,
  deleteRecordsByIndex,
  clearStore,
} from "./indexed-db";

export type OfflineStoreCategory = "READ_CACHE" | "DRAFT" | "MUTATION_OUTBOX";

const purgeHooks = new Set<() => void>();

/**
 * Registers a hook to be executed when offline data is purged (e.g., clearing in-memory queues).
 */
export function registerPurgeHook(hook: () => void): () => void {
  purgeHooks.add(hook);
  return () => {
    purgeHooks.delete(hook);
  };
}

/**
 * Triggers all registered purge hooks (such as clearing in-memory queues on logout).
 */
export function clearOfflineMutationQueue(): void {
  for (const hook of purgeHooks) {
    try {
      hook();
    } catch (err) {
      console.warn("Error in purge hook:", err);
    }
  }
}

/**
 * Builds the canonical user-scoped store key:
 * qcet:user:${userId}:${storeCategory}:${key}
 */
export function buildUserStoreKey(
  userId: string,
  storeCategory: OfflineStoreCategory | string,
  key: string
): string {
  if (!userId) {
    throw new Error("userId is required to build user-scoped offline store key");
  }
  return `qcet:user:${userId}:${storeCategory}:${key}`;
}

/**
 * Builds the canonical user-scoped namespace prefix:
 * qcet:user:${userId}:${storeCategory} or qcet:user:${userId}
 */
export function buildUserPrefix(
  userId: string,
  storeCategory?: OfflineStoreCategory | string
): string {
  if (!userId) {
    throw new Error("userId is required to build user-scoped prefix");
  }
  return storeCategory
    ? `qcet:user:${userId}:${storeCategory}`
    : `qcet:user:${userId}`;
}

// ---------------------------------------------------------------------------
// 1. READ_CACHE Interfaces & Methods
// ---------------------------------------------------------------------------

export interface ReadCacheItem<T = unknown> extends BaseOfflineRecord {
  fullKey: string;
  userId: string;
  storeType: "READ_CACHE";
  key: string;
  data: T;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number | null;
}

export async function getReadCache<T = unknown>(
  userId: string,
  key: string
): Promise<T | null> {
  if (!userId || !key) return null;
  const fullKey = buildUserStoreKey(userId, "READ_CACHE", key);
  const record = await getRecord<ReadCacheItem<T>>(
    QCET_OFFLINE_STORES.READ_CACHE,
    fullKey
  );

  if (!record) return null;

  // Check TTL expiration
  if (record.expiresAt && Date.now() > record.expiresAt) {
    // Expired - silently clean up
    await deleteRecord(QCET_OFFLINE_STORES.READ_CACHE, fullKey).catch(() => {});
    return null;
  }

  return record.data;
}

export async function setReadCache<T = unknown>(
  userId: string,
  key: string,
  data: T,
  options?: { ttlMs?: number }
): Promise<void> {
  if (!userId || !key) return;
  const fullKey = buildUserStoreKey(userId, "READ_CACHE", key);
  const now = Date.now();
  const expiresAt = options?.ttlMs ? now + options.ttlMs : null;

  const record: ReadCacheItem<T> = {
    fullKey,
    userId,
    storeType: "READ_CACHE",
    key,
    data,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  await putRecord(QCET_OFFLINE_STORES.READ_CACHE, record as any);
}

export async function removeReadCache(
  userId: string,
  key: string
): Promise<void> {
  if (!userId || !key) return;
  const fullKey = buildUserStoreKey(userId, "READ_CACHE", key);
  await deleteRecord(QCET_OFFLINE_STORES.READ_CACHE, fullKey);
}

export async function clearUserReadCache(userId: string): Promise<number> {
  if (!userId) return 0;
  return deleteRecordsByIndex(
    QCET_OFFLINE_STORES.READ_CACHE,
    "by_user",
    userId
  );
}

// ---------------------------------------------------------------------------
// 2. DRAFT Interfaces & Methods
// ---------------------------------------------------------------------------

export interface DraftItem<T = unknown> extends BaseOfflineRecord {
  fullKey: string;
  userId: string;
  storeType: "DRAFT";
  key: string;
  data: T;
  createdAt: number;
  updatedAt: number;
}

export async function getDraft<T = unknown>(
  userId: string,
  key: string
): Promise<T | null> {
  if (!userId || !key) return null;
  const fullKey = buildUserStoreKey(userId, "DRAFT", key);
  const record = await getRecord<DraftItem<T>>(
    QCET_OFFLINE_STORES.DRAFT,
    fullKey
  );
  return record ? record.data : null;
}

export async function setDraft<T = unknown>(
  userId: string,
  key: string,
  data: T
): Promise<void> {
  if (!userId || !key) return;
  const fullKey = buildUserStoreKey(userId, "DRAFT", key);
  const now = Date.now();
  const existing = await getRecord<DraftItem<T>>(
    QCET_OFFLINE_STORES.DRAFT,
    fullKey
  );

  const record: DraftItem<T> = {
    fullKey,
    userId,
    storeType: "DRAFT",
    key,
    data,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await putRecord(QCET_OFFLINE_STORES.DRAFT, record as any);
}

export async function removeDraft(
  userId: string,
  key: string
): Promise<void> {
  if (!userId || !key) return;
  const fullKey = buildUserStoreKey(userId, "DRAFT", key);
  await deleteRecord(QCET_OFFLINE_STORES.DRAFT, fullKey);
}

export async function listUserDrafts<T = unknown>(
  userId: string
): Promise<Array<{ key: string; data: T; updatedAt: number; fullKey: string }>> {
  if (!userId) return [];
  const records = await getRecordsByIndex<DraftItem<T>>(
    QCET_OFFLINE_STORES.DRAFT,
    "by_user",
    userId
  );
  return records.map((r) => ({
    key: r.key,
    data: r.data,
    updatedAt: r.updatedAt,
    fullKey: r.fullKey,
  }));
}

export async function clearUserDrafts(userId: string): Promise<number> {
  if (!userId) return 0;
  return deleteRecordsByIndex(QCET_OFFLINE_STORES.DRAFT, "by_user", userId);
}

// ---------------------------------------------------------------------------
// 3. MUTATION_OUTBOX Interfaces & Methods
// ---------------------------------------------------------------------------

export interface OfflineOutboxItem<TPayload = unknown> extends BaseOfflineRecord {
  fullKey: string;
  id: string; // uuid or unique mutation ID
  userId: string;
  storeType: "MUTATION_OUTBOX";
  key: string;
  operation: string; // e.g. "TASK_UPDATE_PROGRESS" | "TASK_STATUS_CHANGE"
  entityId: string;
  url: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  payload: TPayload;
  expectedVersion?: number;
  idempotencyKey: string;
  createdAt: number;
  retryCount: number;
  status: "pending" | "syncing" | "conflict" | "failed";
  /**
   * True when a send was attempted but the response was lost (network dropped
   * after the request left the device). The item stays `pending` so it remains
   * in the drain, but it must be reconciled with the original Idempotency-Key
   * before it can be treated as confirmed (T66). Never a success indicator.
   */
  unconfirmedResult?: boolean;
  serverConflictData?: unknown;
  errorMessage?: string;
  updatedAt: number;
}

export interface EnqueueOutboxItemInput<TPayload = unknown> {
  id?: string;
  operation: string;
  entityId: string;
  url: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  payload: TPayload;
  expectedVersion?: number;
  idempotencyKey?: string;
  createdAt?: number;
  retryCount?: number;
  status?: "pending" | "syncing" | "conflict" | "failed";
  unconfirmedResult?: boolean;
  serverConflictData?: unknown;
  errorMessage?: string;
  updatedAt?: number;
}

export async function enqueueOutboxItem<TPayload = unknown>(
  userId: string,
  item: EnqueueOutboxItemInput<TPayload>
): Promise<OfflineOutboxItem<TPayload>> {
  if (!userId) {
    throw new Error("userId is required to enqueue mutation outbox item");
  }

  const id =
    item.id ||
    `outbox-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const fullKey = buildUserStoreKey(userId, "MUTATION_OUTBOX", id);
  const now = Date.now();

  const record: OfflineOutboxItem<TPayload> = {
    fullKey,
    id,
    userId,
    storeType: "MUTATION_OUTBOX",
    key: id,
    operation: item.operation,
    entityId: item.entityId,
    url: item.url,
    method: item.method,
    payload: item.payload,
    expectedVersion: item.expectedVersion,
    idempotencyKey:
      item.idempotencyKey ||
      `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: item.createdAt || now,
    retryCount: item.retryCount || 0,
    status: item.status || "pending",
    unconfirmedResult: item.unconfirmedResult,
    serverConflictData: item.serverConflictData,
    errorMessage: item.errorMessage,
    updatedAt: item.updatedAt || now,
  };

  await putRecord(QCET_OFFLINE_STORES.MUTATION_OUTBOX, record as any);
  return record;
}

export async function getOutboxItem<TPayload = unknown>(
  userId: string,
  id: string
): Promise<OfflineOutboxItem<TPayload> | null> {
  if (!userId || !id) return null;
  const fullKey = buildUserStoreKey(userId, "MUTATION_OUTBOX", id);
  return getRecord<OfflineOutboxItem<TPayload>>(
    QCET_OFFLINE_STORES.MUTATION_OUTBOX,
    fullKey
  );
}

export async function getOutboxQueue<TPayload = unknown>(
  userId: string,
  status?: "pending" | "syncing" | "conflict" | "failed"
): Promise<OfflineOutboxItem<TPayload>[]> {
  if (!userId) return [];
  const records = await getRecordsByIndex<OfflineOutboxItem<TPayload>>(
    QCET_OFFLINE_STORES.MUTATION_OUTBOX,
    "by_user",
    userId
  );

  let filtered = records;
  if (status) {
    filtered = records.filter((r) => r.status === status);
  }

  // Chronological sorting (earliest first)
  return filtered.sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateOutboxItem<TPayload = unknown>(
  userId: string,
  id: string,
  updates: Partial<OfflineOutboxItem<TPayload>>
): Promise<void> {
  if (!userId || !id) return;
  const existing = await getOutboxItem<TPayload>(userId, id);
  if (!existing) return;

  const fullKey = buildUserStoreKey(userId, "MUTATION_OUTBOX", id);
  const updated: OfflineOutboxItem<TPayload> = {
    ...existing,
    ...updates,
    fullKey,
    id,
    userId,
    storeType: "MUTATION_OUTBOX",
    key: id,
    updatedAt: Date.now(),
  };

  await putRecord(QCET_OFFLINE_STORES.MUTATION_OUTBOX, updated as any);
}

export async function removeOutboxItem(
  userId: string,
  id: string
): Promise<void> {
  if (!userId || !id) return;
  const fullKey = buildUserStoreKey(userId, "MUTATION_OUTBOX", id);
  await deleteRecord(QCET_OFFLINE_STORES.MUTATION_OUTBOX, fullKey);
}

export async function clearUserOutbox(userId: string): Promise<number> {
  if (!userId) return 0;
  return deleteRecordsByIndex(
    QCET_OFFLINE_STORES.MUTATION_OUTBOX,
    "by_user",
    userId
  );
}

// ---------------------------------------------------------------------------
// 4. Scoped User Offline Store Facade
// ---------------------------------------------------------------------------

export function getUserOfflineStore(userId: string) {
  if (!userId) {
    throw new Error("userId is required to initialize user offline store");
  }

  return {
    userId,
    readCache: {
      get: <T>(key: string) => getReadCache<T>(userId, key),
      set: <T>(key: string, data: T, ttlMs?: number) =>
        setReadCache<T>(userId, key, data, { ttlMs }),
      remove: (key: string) => removeReadCache(userId, key),
      clear: () => clearUserReadCache(userId),
    },
    drafts: {
      get: <T>(key: string) => getDraft<T>(userId, key),
      set: <T>(key: string, data: T) => setDraft<T>(userId, key, data),
      remove: (key: string) => removeDraft(userId, key),
      list: <T>() => listUserDrafts<T>(userId),
      clear: () => clearUserDrafts(userId),
    },
    outbox: {
      enqueue: <T>(
        item: Parameters<typeof enqueueOutboxItem<T>>[1]
      ) => enqueueOutboxItem<T>(userId, item),
      get: <T>(id: string) => getOutboxItem<T>(userId, id),
      getAll: <T>(status?: "pending" | "syncing" | "conflict" | "failed") =>
        getOutboxQueue<T>(userId, status),
      update: <T>(id: string, updates: Partial<OfflineOutboxItem<T>>) =>
        updateOutboxItem<T>(userId, id, updates),
      remove: (id: string) => removeOutboxItem(userId, id),
      clear: () => clearUserOutbox(userId),
    },
    purge: () => purgeUserOfflineData(userId),
  };
}

// ---------------------------------------------------------------------------
// 5. Logout Purge & Device Cleanup
// ---------------------------------------------------------------------------

/**
 * Securely purges all private offline data belonging to a specific user on logout:
 *  1. Clears private IndexedDB stores for that user (READ_CACHE, DRAFT, MUTATION_OUTBOX)
 *  2. Clears private Cache Storage entries (matching user caches or user-specific cached API endpoints)
 *  3. Resets in-memory mutation queue and subscribers
 *  4. Leaves other users' data on shared device intact
 */
export async function purgeUserOfflineData(userId: string): Promise<void> {
  // Always reset in-memory mutation queue on logout, even if userId is falsy
  try {
    clearOfflineMutationQueue();
  } catch (err) {
    console.warn("Error resetting in-memory mutation queue:", err);
  }

  if (!userId) return;

  // 1. Clear private IndexedDB stores for this user
  await Promise.allSettled([
    clearUserReadCache(userId),
    clearUserDrafts(userId),
    clearUserOutbox(userId),
  ]);

  // 2. Clear private Cache Storage entries
  const cacheStorage =
    typeof caches !== "undefined"
      ? caches
      : typeof window !== "undefined" && (window as any).caches
      ? (window as any).caches
      : null;

  if (cacheStorage) {
    try {
      const cacheNames = await cacheStorage.keys();
      for (const name of cacheNames) {
        // Delete caches specifically named with userId
        if (name.toLowerCase().includes(userId.toLowerCase())) {
          await cacheStorage.delete(name);
          continue;
        }

        // Clean user-specific requests from runtime caches
        if (name.includes("api") || name.includes("runtime")) {
          try {
            const cache = await cacheStorage.open(name);
            const requests = await cache.keys();
            for (const req of requests) {
              const url = req.url.toLowerCase();
              if (
                url.includes(userId.toLowerCase()) ||
                url.includes("/api/auth/me")
              ) {
                await cache.delete(req);
              }
            }
          } catch {
            // Ignore single-cache inspection failure
          }
        }
      }
    } catch (err) {
      console.warn("Cache storage purge encountered error:", err);
    }
  }

  // 3. Reset in-memory queue
  try {
    clearOfflineMutationQueue();
  } catch (err) {
    console.warn("Error resetting in-memory mutation queue:", err);
  }
}

/**
 * Comprehensive device-wide offline data cleanup.
 * Clears all stores in IndexedDB, all runtime/api caches, and memory queues.
 */
export async function purgeAllUserData(): Promise<void> {
  await Promise.allSettled([
    clearStore(QCET_OFFLINE_STORES.READ_CACHE),
    clearStore(QCET_OFFLINE_STORES.DRAFT),
    clearStore(QCET_OFFLINE_STORES.MUTATION_OUTBOX),
  ]);

  const cacheStorage =
    typeof caches !== "undefined"
      ? caches
      : typeof window !== "undefined" && (window as any).caches
      ? (window as any).caches
      : null;

  if (cacheStorage) {
    try {
      const cacheNames = await cacheStorage.keys();
      for (const name of cacheNames) {
        if (
          name.includes("api") ||
          name.includes("runtime") ||
          name.includes("user")
        ) {
          await cacheStorage.delete(name);
        }
      }
    } catch {
      // Ignore cache deletion errors
    }
  }

  try {
    clearOfflineMutationQueue();
  } catch {
    // Ignore queue errors
  }
}
