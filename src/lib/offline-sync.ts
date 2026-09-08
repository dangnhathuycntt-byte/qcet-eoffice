/**
 * QCET E-Office Offline Mutation Sync Manager
 * Preserves optimistic UI changes across unstable network drops and synchronizes when reconnected.
 */

export interface OfflineMutation {
  id: string;
  url: string;
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  description?: string;
  timestamp: number;
  retryCount: number;
}

const STORAGE_KEY = "qcet_offline_mutations_v1";

// In-memory fallback for Node/SSR or restricted environments
let memoryQueue: OfflineMutation[] = [];
const subscribers = new Set<(queue: OfflineMutation[]) => void>();

function notifySubscribers(queue: OfflineMutation[]): void {
  for (const subscriber of subscribers) {
    try {
      subscriber(queue);
    } catch {
      // Ignore subscriber errors
    }
  }
}

export function isOnline(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
}

export function getOfflineMutationQueue(): OfflineMutation[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return [...memoryQueue];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [...memoryQueue];
  }
}

function saveOfflineMutationQueue(queue: OfflineMutation[]): void {
  memoryQueue = [...queue];
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // Ignore storage quota or disabled errors
    }
  }
  notifySubscribers(queue);
}

export function enqueueOfflineMutation(
  item: Omit<OfflineMutation, "id" | "timestamp" | "retryCount"> & {
    id?: string;
    timestamp?: number;
    retryCount?: number;
  }
): OfflineMutation {
  const mutation: OfflineMutation = {
    id: item.id || `mut-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    url: item.url,
    method: item.method,
    body: item.body,
    headers: item.headers,
    description: item.description,
    timestamp: item.timestamp || Date.now(),
    retryCount: item.retryCount || 0,
  };

  const queue = getOfflineMutationQueue();
  const updatedQueue = [...queue, mutation];
  saveOfflineMutationQueue(updatedQueue);

  return mutation;
}

export function removeOfflineMutation(id: string): void {
  const queue = getOfflineMutationQueue();
  const filtered = queue.filter((item) => item.id !== id);
  saveOfflineMutationQueue(filtered);
}

export function clearOfflineMutationQueue(): void {
  saveOfflineMutationQueue([]);
}

export function subscribeOfflineQueue(
  listener: (queue: OfflineMutation[]) => void
): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

/**
 * Attempt to flush all queued mutations against server APIs.
 */
export async function flushOfflineMutations(): Promise<{
  succeeded: number;
  failed: number;
}> {
  if (!isOnline()) {
    return { succeeded: 0, failed: getOfflineMutationQueue().length };
  }

  const queue = getOfflineMutationQueue();
  if (queue.length === 0) {
    return { succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(item.headers || {}),
      };

      const response = await fetch(item.url, {
        method: item.method,
        headers,
        body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
      });

      if (response.ok) {
        removeOfflineMutation(item.id);
        succeeded++;
      } else if (response.status >= 400 && response.status < 500) {
        // Client error (e.g. 404 or validation), drop from retry queue to avoid blocking
        removeOfflineMutation(item.id);
        failed++;
      } else {
        // 5xx Server error, increment retry count
        item.retryCount += 1;
        failed++;
      }
    } catch {
      // Network failure during sync
      item.retryCount += 1;
      failed++;
      break; // Stop loop if still offline
    }
  }

  return { succeeded, failed };
}

// Auto-sync on window 'online' event
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushOfflineMutations().catch(() => {});
  });
}
