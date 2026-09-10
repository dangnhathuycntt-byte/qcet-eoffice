/**
 * QCET E-Office - Badging API Progressive Enhancement
 *
 * Implements OS-level app icon badging with strict institutional invariants:
 * - Only badge ACTIONABLE work (pending reviews, urgent overdue tasks, pending approvals)
 * - NEVER mirror raw total notification counts or passive alerts
 * - Progressive enhancement: gracefully no-ops on browsers/platforms lacking Badging API
 * - Resilient to SecurityError, permission denial, or SSR contexts
 */

export interface ActionableBadgeCounts {
  /**
   * Tasks explicitly requiring user action (assigned, pending completion, or blocked awaiting user)
   */
  actionableTasks?: number;
  /**
   * Pending document or deliverable reviews requiring decision
   */
  pendingReviews?: number;
  /**
   * Urgent or overdue tasks requiring immediate institutional intervention
   */
  urgentOverdueTasks?: number;
  /**
   * Administrative or workflow approval requests awaiting sign-off
   */
  pendingApprovals?: number;
}

/**
 * Checks whether Badging API is supported in current browser environment.
 */
export function isBadgingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof (navigator as any).setAppBadge === "function" &&
    typeof (navigator as any).clearAppBadge === "function"
  );
}

/**
 * Sets application badge to a specific positive count.
 * If count is 0 or negative, automatically clears the badge.
 *
 * @param count Positive integer representing actionable items count.
 * @returns Promise<boolean> True if badge was successfully set, false otherwise.
 */
export async function setAppBadge(count?: number): Promise<boolean> {
  if (!isBadgingSupported()) {
    return false;
  }

  try {
    if (count !== undefined) {
      if (typeof count !== "number" || !Number.isFinite(count)) {
        return false;
      }
      const sanitized = Math.max(0, Math.floor(count));
      if (sanitized === 0) {
        await (navigator as any).clearAppBadge();
        return true;
      }
      await (navigator as any).setAppBadge(sanitized);
      return true;
    }

    // Indeterminate badge (dot)
    await (navigator as any).setAppBadge();
    return true;
  } catch (err) {
    // Badging API can reject if permission is denied, window is unfocused,
    // or on non-PWA tab contexts. Silently handle as progressive enhancement.
    return false;
  }
}

/**
 * Clears the application badge.
 *
 * @returns Promise<boolean> True if badge was successfully cleared, false otherwise.
 */
export async function clearAppBadge(): Promise<boolean> {
  if (!isBadgingSupported()) {
    return false;
  }

  try {
    await (navigator as any).clearAppBadge();
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Calculates canonical actionable badge count according to institutional invariants.
 * Strictly excludes passive/read-only notifications.
 */
export function calculateActionableBadgeCount(
  counts: ActionableBadgeCounts
): number {
  const actionable = Math.max(0, Math.floor(counts.actionableTasks || 0));
  const reviews = Math.max(0, Math.floor(counts.pendingReviews || 0));
  const overdue = Math.max(0, Math.floor(counts.urgentOverdueTasks || 0));
  const approvals = Math.max(0, Math.floor(counts.pendingApprovals || 0));

  return actionable + reviews + overdue + approvals;
}

/**
 * Updates OS app badge reflecting only actionable items.
 * If total actionable count is zero, the badge is automatically cleared.
 *
 * @param counts Breakdown of actionable items.
 * @returns Promise<boolean>
 */
export async function updateActionableBadge(
  counts: ActionableBadgeCounts
): Promise<boolean> {
  const totalActionable = calculateActionableBadgeCount(counts);

  if (totalActionable > 0) {
    return await setAppBadge(totalActionable);
  } else {
    return await clearAppBadge();
  }
}
