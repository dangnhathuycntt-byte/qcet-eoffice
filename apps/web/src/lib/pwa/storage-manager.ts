/**
 * QCET E-Office - PWA Storage Quota & Persistence Manager
 *
 * Implements institutional client-side storage management:
 * 1. Storage Quota Inspection via navigator.storage.estimate().
 * 2. Clear human-readable formatting (MB/GB and percentage).
 * 3. Persistence inspection via navigator.storage.persisted().
 * 4. Persistence request boundary via navigator.storage.persist().
 *    INVARIANT: Must ONLY be called on explicit user action ("Cho phép dùng dữ liệu ngoại tuyến"),
 *    NEVER automatically on cold login or background load.
 * 5. Breakdown estimation (Cache Storage vs. IndexedDB).
 * 6. User-scoped offline data purge (clearUserOfflineData).
 *
 * Institutional Invariant: 0% emojis, zero unverified assumptions, light-only UX.
 */

import * as React from "react";
import {
  clearUserReadCache,
  clearUserDrafts,
  clearUserOutbox,
  clearOfflineMutationQueue,
} from "./offline-store";
import { getActiveUserId } from "./outbox-manager";
import { recordTelemetry } from "./telemetry";

export interface StorageEstimateResult {
  usage: number; // bytes
  quota: number; // bytes
  usageFormatted: string;
  quotaFormatted: string;
  percentUsed: number;
  summary: string;
  isPersisted: boolean;
  breakdown?: {
    indexedDbBytes?: number;
    cacheStorageBytes?: number;
    otherBytes?: number;
  };
}

export interface ClearOfflineDataOptions {
  preserveOutbox?: boolean;
  clearCaches?: boolean;
}

export interface ClearOfflineDataResult {
  readCacheCleared: number;
  draftsCleared: number;
  outboxCleared: number;
  cachesPurged: boolean;
  success: boolean;
}

/**
 * Formats bytes into clean institutional notation (B, KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}

/**
 * Checks whether persistent storage has been granted to the origin.
 */
export async function checkStoragePersistence(): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.persisted !== "function"
  ) {
    return false;
  }
  try {
    return await navigator.storage.persisted();
  } catch (err) {
    console.warn("[PWA Storage] Persistence check failed:", err);
    return false;
  }
}

/**
 * Requests persistent storage from the browser.
 *
 * ARCHITECTURAL INVARIANT:
 * Must ONLY be called upon explicit user intent ("Cho phép dùng dữ liệu ngoại tuyến"),
 * NEVER automatically on cold login or background load.
 */
export async function requestStoragePersistence(userId?: string): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.persist !== "function"
  ) {
    return false;
  }

  try {
    const isGranted = await navigator.storage.persist();
    if (isGranted) {
      recordTelemetry("storage.persist.granted", { explicitUserAction: true }, userId);
    } else {
      recordTelemetry("storage.persist.denied", { explicitUserAction: true }, userId);
    }
    return isGranted;
  } catch (err) {
    console.warn("[PWA Storage] Request persistence failed:", err);
    recordTelemetry("storage.persist.denied", { error: String(err) }, userId);
    return false;
  }
}

/**
 * Inspects origin storage usage, quota, and persistence status.
 */
export async function getStorageEstimate(): Promise<StorageEstimateResult> {
  let usage = 0;
  let quota = 0;

  if (
    typeof navigator !== "undefined" &&
    navigator.storage &&
    typeof navigator.storage.estimate === "function"
  ) {
    try {
      const estimate = await navigator.storage.estimate();
      usage = estimate.usage ?? 0;
      quota = estimate.quota ?? 0;
    } catch (err) {
      console.warn("[PWA Storage] Estimate inspection failed:", err);
    }
  }

  const isPersisted = await checkStoragePersistence();
  const percentUsed = quota > 0 ? Number(((usage / quota) * 100).toFixed(2)) : 0;
  const usageFormatted = formatBytes(usage);
  const quotaFormatted = formatBytes(quota);

  // Approximate cache storage breakdown if caches API is available
  let cacheStorageBytes = 0;
  if (typeof caches !== "undefined" && typeof caches.keys === "function") {
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        // Sample header contentLength on entries
        for (const req of keys.slice(0, 40)) {
          const res = await cache.match(req);
          if (res) {
            const cl = res.headers.get("content-length");
            if (cl) {
              cacheStorageBytes += parseInt(cl, 10) || 0;
            }
          }
        }
      }
    } catch {
      // Ignore cache inspection failure
    }
  }

  const indexedDbBytes = usage > cacheStorageBytes ? usage - cacheStorageBytes : undefined;

  return {
    usage,
    quota,
    usageFormatted,
    quotaFormatted,
    percentUsed,
    summary: `${usageFormatted} / ${quotaFormatted} (${percentUsed}%)`,
    isPersisted,
    breakdown: {
      cacheStorageBytes: cacheStorageBytes > 0 ? cacheStorageBytes : undefined,
      indexedDbBytes,
    },
  };
}

/**
 * Clears all local offline data for a user on demand.
 */
export async function clearUserOfflineData(
  userId?: string,
  options?: ClearOfflineDataOptions
): Promise<ClearOfflineDataResult> {
  const uid = userId || getActiveUserId();
  let readCacheCleared = 0;
  let draftsCleared = 0;
  let outboxCleared = 0;
  let cachesPurged = false;

  try {
    readCacheCleared = await clearUserReadCache(uid);
  } catch (err) {
    console.warn("[PWA Storage] Failed to clear user read cache:", err);
  }

  try {
    draftsCleared = await clearUserDrafts(uid);
  } catch (err) {
    console.warn("[PWA Storage] Failed to clear user drafts:", err);
  }

  if (!options?.preserveOutbox) {
    try {
      outboxCleared = await clearUserOutbox(uid);
      clearOfflineMutationQueue();
    } catch (err) {
      console.warn("[PWA Storage] Failed to clear user outbox:", err);
    }
  }

  if (options?.clearCaches && typeof caches !== "undefined" && typeof caches.keys === "function") {
    try {
      const keys = await caches.keys();
      for (const k of keys) {
        // Clear API / runtime data caches, preserve app shell for immediate offline boot
        if (k.includes("api") || k.includes("data")) {
          await caches.delete(k);
        }
      }
      cachesPurged = true;
    } catch (err) {
      console.warn("[PWA Storage] Failed to purge caches:", err);
    }
  }

  recordTelemetry(
    "storage.cleared",
    {
      readCacheCleared,
      draftsCleared,
      outboxCleared,
      cachesPurged,
      preserveOutbox: options?.preserveOutbox ?? false,
    },
    uid
  );

  return {
    readCacheCleared,
    draftsCleared,
    outboxCleared,
    cachesPurged,
    success: true,
  };
}

/**
 * React hook to observe and interact with storage quota & persistence.
 */
export function useStorageQuota(options?: { refreshIntervalMs?: number; userId?: string }) {
  const [estimate, setEstimate] = React.useState<StorageEstimateResult>({
    usage: 0,
    quota: 0,
    usageFormatted: "0 B",
    quotaFormatted: "0 B",
    percentUsed: 0,
    summary: "0 B / 0 B (0%)",
    isPersisted: false,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRequestingPersist, setIsRequestingPersist] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getStorageEstimate();
      setEstimate(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();

    if (!options?.refreshIntervalMs) return;

    const interval = setInterval(refresh, options.refreshIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, options?.refreshIntervalMs]);

  const requestPersist = React.useCallback(async () => {
    setIsRequestingPersist(true);
    try {
      const granted = await requestStoragePersistence(options?.userId);
      await refresh();
      return granted;
    } finally {
      setIsRequestingPersist(false);
    }
  }, [refresh, options?.userId]);

  const clearData = React.useCallback(
    async (opts?: ClearOfflineDataOptions) => {
      setIsClearing(true);
      try {
        const res = await clearUserOfflineData(options?.userId, opts);
        await refresh();
        return res;
      } finally {
        setIsClearing(false);
      }
    },
    [refresh, options?.userId]
  );

  return {
    estimate,
    isLoading,
    isRequestingPersist,
    isClearing,
    refresh,
    requestPersist,
    clearData,
  };
}
