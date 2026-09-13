/**
 * QCET E-Office - Canonical Offline Mutation State Taxonomy (C6 / T62 / T73)
 *
 * Single source of truth for how an offline mutation is described to the user.
 * Every surface (status bar, badges, conflict dialog, banners) MUST derive its
 * label from this module — never invent local variants (One Capability, One
 * Implementation).
 *
 * C6 semantic taxonomy (7 states):
 *   local-only           - written to device, not yet enqueued for the server
 *   queued               - enqueued in the outbox, awaiting sync
 *   syncing              - a request is currently in flight
 *   server-confirmed     - the server acknowledged the mutation (2xx)
 *   failed               - the server rejected it permanently (4xx / retries exhausted)
 *   conflict             - server state changed (409 OCC); user must decide
 *   unknown-after-timeout - a request may have reached the server but the
 *                           response was lost; it must be reconciled before it
 *                           can be considered confirmed
 *
 * T62 truthful Vietnamese labels (exactly six): the seven-state taxonomy
 * collapses onto these six canonical strings. `local-only` renders
 * "Đã lưu trên thiết bị" (saved on device, not yet transmitted), while
 * `queued` and `unknown-after-timeout` share "Đang chờ đồng bộ" (waiting to
 * sync / awaiting reconciliation). Only `server-confirmed` may render
 * "Đã đồng bộ".
 */

export type OfflineMutationState =
  | "local-only"
  | "queued"
  | "syncing"
  | "server-confirmed"
  | "failed"
  | "conflict"
  | "unknown-after-timeout";

/**
 * Persisted outbox status as stored in IndexedDB (offline-store.ts).
 * Kept intentionally narrow so the durable record stays backward compatible.
 */
export type OutboxPersistedStatus = "pending" | "syncing" | "conflict" | "failed";

/**
 * The six canonical, truthful Vietnamese offline labels (T62).
 * `local-only` is distinct from `queued` in taxonomy but shares the
 * "saved on device" vs "waiting to sync" family; it maps to the device label.
 */
export const OFFLINE_STATE_LABELS: Record<OfflineMutationState, string> = {
  "local-only": "Đã lưu trên thiết bị",
  queued: "Đang chờ đồng bộ",
  syncing: "Đang đồng bộ",
  "server-confirmed": "Đã đồng bộ",
  failed: "Không thể đồng bộ",
  conflict: "Xung đột cần xử lý",
  // Unknown result is never presented as confirmed; it is awaiting reconciliation.
  "unknown-after-timeout": "Đang chờ đồng bộ",
};

/** The six unique canonical label strings required by T62. */
export const CANONICAL_OFFLINE_LABELS = [
  "Đã lưu trên thiết bị",
  "Đang chờ đồng bộ",
  "Đang đồng bộ",
  "Đã đồng bộ",
  "Không thể đồng bộ",
  "Xung đột cần xử lý",
] as const;

/**
 * Maps a durable outbox item (persisted status + unconfirmed-result flag) to
 * the canonical C6 state.
 *
 * A `pending` item whose previous send was unconfirmed is `unknown-after-timeout`
 * rather than a clean `queued` item — it must be reconciled, not blindly retried.
 */
export function outboxItemToOfflineState(item: {
  status: OutboxPersistedStatus;
  unconfirmedResult?: boolean;
}): OfflineMutationState {
  switch (item.status) {
    case "syncing":
      return "syncing";
    case "conflict":
      return "conflict";
    case "failed":
      return "failed";
    case "pending":
    default:
      return item.unconfirmedResult ? "unknown-after-timeout" : "queued";
  }
}

/** Returns the truthful Vietnamese label for a canonical offline state. */
export function labelForOfflineState(state: OfflineMutationState): string {
  return OFFLINE_STATE_LABELS[state];
}

/**
 * Composes a durable outbox state with live connectivity to produce the state
 * that a surface must actually display.
 *
 * A mutation that is merely `queued` while the device is OFFLINE cannot be
 * transmitted — it is truthfully "Đã lưu trên thiết bị" (saved on device), not
 * "Đang chờ đồng bộ" (waiting to sync). This is the runtime path that makes the
 * `local-only` label reachable (T62): it exists only for offline-saved work.
 */
export function offlineStateForDisplay(
  state: OfflineMutationState,
  connectivity: { isOnline: boolean }
): OfflineMutationState {
  if (!connectivity.isOnline && state === "queued") {
    return "local-only";
  }
  return state;
}

/**
 * Aggregate priority used by the global status surface. The most actionable /
 * least-confirmed condition wins so queued work is never presented as confirmed.
 */
const STATE_PRIORITY: Record<OfflineMutationState, number> = {
  conflict: 0,
  "unknown-after-timeout": 1,
  syncing: 2,
  failed: 3,
  queued: 4,
  "local-only": 5,
  "server-confirmed": 6,
};

/**
 * Derives the single most relevant offline state from a set of outbox items.
 * Returns null when there are no items (surface falls back to connectivity state).
 */
export function deriveOfflineState(
  items: Array<{ status: OutboxPersistedStatus; unconfirmedResult?: boolean }>
): OfflineMutationState | null {
  if (items.length === 0) return null;
  let best: OfflineMutationState | null = null;
  for (const item of items) {
    const state = outboxItemToOfflineState(item);
    if (best === null || STATE_PRIORITY[state] < STATE_PRIORITY[best]) {
      best = state;
    }
  }
  return best;
}

/** True only when the server has acknowledged the mutation (T73 / D13). */
export function isServerConfirmed(state: OfflineMutationState): boolean {
  return state === "server-confirmed";
}
