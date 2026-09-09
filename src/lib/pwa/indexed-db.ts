/**
 * QCET E-Office - User-Isolated IndexedDB Storage Layer
 * Provides robust, typed, SSR-safe, and private-browsing-resilient access
 * to client-side IndexedDB persistence.
 */

export const QCET_OFFLINE_DB_NAME = "qcet_offline_v1";
export const QCET_OFFLINE_DB_VERSION = 1;

export const QCET_OFFLINE_STORES = {
  READ_CACHE: "read_cache",
  DRAFT: "drafts",
  MUTATION_OUTBOX: "mutation_outbox",
} as const;

export type OfflineStoreName =
  (typeof QCET_OFFLINE_STORES)[keyof typeof QCET_OFFLINE_STORES];

export interface BaseOfflineRecord {
  fullKey: string;
  userId: string;
}

// In-memory fallback stores when IndexedDB is not supported, blocked, or in SSR
const memoryStores = new Map<string, Map<string, unknown>>();

function getMemoryStore(storeName: string): Map<string, unknown> {
  let store = memoryStores.get(storeName);
  if (!store) {
    store = new Map();
    memoryStores.set(storeName, store);
  }
  return store;
}

export function resetMemoryDatabase(): void {
  memoryStores.clear();
}

/**
 * Checks if the runtime environment supports IndexedDB.
 */
export function isIndexedDBSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return typeof window.indexedDB !== "undefined" && window.indexedDB !== null;
  } catch {
    return false;
  }
}

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Safely opens the QCET IndexedDB database with schema upgrades and error resilience.
 * Returns null if IndexedDB is unsupported, disabled, or blocked (e.g. strict private mode).
 */
export async function getDatabase(): Promise<IDBDatabase | null> {
  if (dbInstance) {
    return dbInstance;
  }
  if (dbOpenPromise) {
    return dbOpenPromise;
  }

  if (!isIndexedDBSupported()) {
    return null;
  }

  dbOpenPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const idbFactory =
        typeof window !== "undefined" ? window.indexedDB : undefined;
      if (!idbFactory) {
        resolve(null);
        return;
      }

      const request = idbFactory.open(
        QCET_OFFLINE_DB_NAME,
        QCET_OFFLINE_DB_VERSION
      );

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. READ_CACHE store
        if (!db.objectStoreNames.contains(QCET_OFFLINE_STORES.READ_CACHE)) {
          const store = db.createObjectStore(QCET_OFFLINE_STORES.READ_CACHE, {
            keyPath: "fullKey",
          });
          store.createIndex("by_user", "userId", { unique: false });
          store.createIndex("by_key", "key", { unique: false });
          store.createIndex("by_expires", "expiresAt", { unique: false });
        }

        // 2. DRAFTS store
        if (!db.objectStoreNames.contains(QCET_OFFLINE_STORES.DRAFT)) {
          const store = db.createObjectStore(QCET_OFFLINE_STORES.DRAFT, {
            keyPath: "fullKey",
          });
          store.createIndex("by_user", "userId", { unique: false });
          store.createIndex("by_key", "key", { unique: false });
          store.createIndex("by_updated", "updatedAt", { unique: false });
        }

        // 3. MUTATION_OUTBOX store
        if (!db.objectStoreNames.contains(QCET_OFFLINE_STORES.MUTATION_OUTBOX)) {
          const store = db.createObjectStore(
            QCET_OFFLINE_STORES.MUTATION_OUTBOX,
            {
              keyPath: "fullKey",
            }
          );
          store.createIndex("by_user", "userId", { unique: false });
          store.createIndex("by_id", "id", { unique: false });
          store.createIndex("by_status", "status", { unique: false });
          store.createIndex("by_createdAt", "createdAt", { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        dbInstance = db;

        db.onversionchange = () => {
          db.close();
          dbInstance = null;
          dbOpenPromise = null;
        };

        db.onclose = () => {
          dbInstance = null;
          dbOpenPromise = null;
        };

        resolve(db);
      };

      request.onerror = () => {
        console.warn(
          "IndexedDB opening failed, using in-memory store fallback:",
          request.error
        );
        dbInstance = null;
        dbOpenPromise = null;
        resolve(null);
      };

      request.onblocked = () => {
        console.warn(
          "IndexedDB open blocked by another tab. Falling back to in-memory store."
        );
        resolve(null);
      };
    } catch (err) {
      console.warn("IndexedDB access error (possibly private browsing):", err);
      dbInstance = null;
      dbOpenPromise = null;
      resolve(null);
    }
  });

  return dbOpenPromise;
}

/**
 * Closes the active database connection.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignore close errors
    }
    dbInstance = null;
  }
  dbOpenPromise = null;
}

/**
 * Completely deletes the IndexedDB database and clears memory stores.
 */
export async function deleteDatabase(): Promise<void> {
  closeDatabase();
  resetMemoryDatabase();

  if (!isIndexedDBSupported()) {
    return;
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.deleteDatabase(QCET_OFFLINE_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

function mapIndexToProperty(indexName: string): string {
  switch (indexName) {
    case "by_user":
      return "userId";
    case "by_key":
      return "key";
    case "by_id":
      return "id";
    case "by_status":
      return "status";
    case "by_expires":
      return "expiresAt";
    case "by_updated":
      return "updatedAt";
    case "by_createdAt":
      return "createdAt";
    default:
      return indexName;
  }
}

/**
 * Retrieves a single record by its fullKey.
 */
export async function getRecord<T extends BaseOfflineRecord>(
  storeName: string,
  fullKey: string
): Promise<T | null> {
  const db = await getDatabase();
  if (!db) {
    const memory = getMemoryStore(storeName);
    const item = memory.get(fullKey);
    return item ? (JSON.parse(JSON.stringify(item)) as T) : null;
  }

  return new Promise<T | null>((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(fullKey);

      req.onsuccess = () => {
        resolve((req.result as T) ?? null);
      };
      req.onerror = () => {
        reject(req.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Puts or updates a single record.
 */
export async function putRecord<T extends BaseOfflineRecord>(
  storeName: string,
  record: T
): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    const memory = getMemoryStore(storeName);
    memory.set(record.fullKey, JSON.parse(JSON.stringify(record)));
    return;
  }

  return new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onabort = () =>
        reject(tx.error || new Error(`Transaction aborted in ${storeName}`));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Deletes a single record by its fullKey.
 */
export async function deleteRecord(
  storeName: string,
  fullKey: string
): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    const memory = getMemoryStore(storeName);
    memory.delete(fullKey);
    return;
  }

  return new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(fullKey);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onabort = () =>
        reject(tx.error || new Error(`Transaction aborted in ${storeName}`));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Retrieves all records from an object store.
 */
export async function getAllRecords<T extends BaseOfflineRecord>(
  storeName: string
): Promise<T[]> {
  const db = await getDatabase();
  if (!db) {
    const memory = getMemoryStore(storeName);
    return Array.from(memory.values()).map(
      (v) => JSON.parse(JSON.stringify(v)) as T
    );
  }

  return new Promise<T[]>((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();

      req.onsuccess = () => {
        resolve((req.result as T[]) || []);
      };
      req.onerror = () => {
        reject(req.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Retrieves records using an index.
 */
export async function getRecordsByIndex<T extends BaseOfflineRecord>(
  storeName: string,
  indexName: string,
  queryValue: IDBValidKey
): Promise<T[]> {
  const db = await getDatabase();
  if (!db) {
    const memory = getMemoryStore(storeName);
    const prop = mapIndexToProperty(indexName);
    const results: T[] = [];
    for (const record of memory.values()) {
      const rec = record as Record<string, unknown>;
      if (rec[prop] === queryValue) {
        results.push(JSON.parse(JSON.stringify(rec)) as T);
      }
    }
    return results;
  }

  return new Promise<T[]>((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(queryValue);

      req.onsuccess = () => {
        resolve((req.result as T[]) || []);
      };
      req.onerror = () => {
        reject(req.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Deletes records matching an index value. Returns the number of deleted records.
 */
export async function deleteRecordsByIndex(
  storeName: string,
  indexName: string,
  queryValue: IDBValidKey | IDBKeyRange
): Promise<number> {
  const db = await getDatabase();
  if (!db) {
    const memory = getMemoryStore(storeName);
    const prop = mapIndexToProperty(indexName);
    let count = 0;
    for (const [fullKey, record] of Array.from(memory.entries())) {
      const rec = record as Record<string, unknown>;
      if (rec[prop] === queryValue) {
        memory.delete(fullKey);
        count++;
      }
    }
    return count;
  }

  return new Promise<number>((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const range =
        typeof IDBKeyRange !== "undefined" && queryValue instanceof IDBKeyRange
          ? (queryValue as unknown as IDBKeyRange)
          : IDBKeyRange.only(queryValue as unknown as IDBValidKey);
      const request = index.openCursor(range);

      let deletedCount = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };

      tx.onabort = () => {
        reject(tx.error || new Error("Delete by index transaction aborted"));
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Clears an entire object store.
 */
export async function clearStore(storeName: string): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    const memory = getMemoryStore(storeName);
    memory.clear();
    return;
  }

  return new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Counts the number of records in an object store.
 */
export async function countRecords(storeName: string): Promise<number> {
  const db = await getDatabase();
  if (!db) {
    return getMemoryStore(storeName).size;
  }

  return new Promise<number>((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.count();

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}
