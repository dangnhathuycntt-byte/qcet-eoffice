import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  isBadgingSupported,
  setAppBadge,
  clearAppBadge,
  calculateActionableBadgeCount,
  updateActionableBadge,
  type ActionableBadgeCounts,
} from "../../src/lib/pwa/badging";

describe("PWA Badging API Progressive Enhancement Suite", () => {
  let badgeValue: number | undefined | null = null;
  let isCleared = false;

  beforeEach(() => {
    badgeValue = null;
    isCleared = false;

    Object.defineProperty(global, "navigator", {
      value: {
        setAppBadge: async (count?: number) => {
          badgeValue = count;
        },
        clearAppBadge: async () => {
          isCleared = true;
          badgeValue = 0;
        },
      },
      configurable: true,
      writable: true,
    });
  });

  describe("1. Feature Detection", () => {
    it("returns true when navigator.setAppBadge and clearAppBadge are present", () => {
      assert.equal(isBadgingSupported(), true);
    });

    it("returns false when navigator.setAppBadge is missing", () => {
      Object.defineProperty(global, "navigator", {
        value: {},
        configurable: true,
        writable: true,
      });
      assert.equal(isBadgingSupported(), false);
    });
  });

  describe("2. Setting and Clearing Badge", () => {
    it("sets app badge with integer count", async () => {
      const ok = await setAppBadge(5);
      assert.equal(ok, true);
      assert.equal(badgeValue, 5);
      assert.equal(isCleared, false);
    });

    it("clears badge automatically when count is 0", async () => {
      const ok = await setAppBadge(0);
      assert.equal(ok, true);
      assert.equal(isCleared, true);
    });

    it("clears badge directly via clearAppBadge", async () => {
      const ok = await clearAppBadge();
      assert.equal(ok, true);
      assert.equal(isCleared, true);
    });

    it("gracefully catches exceptions and returns false without crashing", async () => {
      Object.defineProperty(global, "navigator", {
        value: {
          setAppBadge: async () => {
            throw new Error("SecurityError: Permission denied");
          },
          clearAppBadge: async () => {},
        },
        configurable: true,
        writable: true,
      });

      const ok = await setAppBadge(10);
      assert.equal(ok, false);
    });
  });

  describe("3. Institutional Invariant: Actionable Items Only", () => {
    it("calculates badge count strictly from actionable items", () => {
      const counts: ActionableBadgeCounts = {
        actionableTasks: 3,
        pendingReviews: 2,
        urgentOverdueTasks: 1,
        pendingApprovals: 4,
      };

      const total = calculateActionableBadgeCount(counts);
      assert.equal(total, 10);
    });

    it("handles zero and undefined counts gracefully", () => {
      const counts: ActionableBadgeCounts = {
        actionableTasks: 0,
      };

      const total = calculateActionableBadgeCount(counts);
      assert.equal(total, 0);
    });

    it("updates OS badge with actionable sum and clears when total is zero", async () => {
      // 1. Positive actionable count
      await updateActionableBadge({
        actionableTasks: 2,
        pendingApprovals: 1,
      });
      assert.equal(badgeValue, 3);

      // 2. Zero actionable count
      await updateActionableBadge({
        actionableTasks: 0,
        pendingReviews: 0,
      });
      assert.equal(isCleared, true);
    });
  });
});
