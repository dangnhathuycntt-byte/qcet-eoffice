import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  urlBase64ToUint8Array,
  validateSameOriginRoute,
  validateDeepLinkUrl,
  generateNotificationTag,
  formatNotificationPayload,
  checkIOSPushStatus,
} from "../../src/lib/pwa/push-manager";

import {
  isBadgingSupported,
  setAppBadge,
  clearAppBadge,
  calculateActionableBadgeCount,
  updateActionableBadge,
  type ActionableBadgeCounts,
} from "../../src/lib/pwa/badging";

import {
  DEFAULT_PUSH_PREFERENCES,
  mapNotificationTypeToTopic,
  isTopicEnabled,
  getPushPreferencesStorageKey,
  type PushPreferences,
} from "../../src/lib/pwa/push-preferences";

// Mock minimal browser globals for testing
class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] || null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

describe("Task 7: Push Pre-Prompt, Subscription Lifecycle, Deep Linking & Notification Dedup", () => {
  beforeEach(() => {
    (global as any).localStorage = new MockLocalStorage();
  });

  describe("1. VAPID & Uint8Array Key Conversion", () => {
    test("converts standard base64 and url-safe base64 string to Uint8Array", () => {
      const sampleKey = "BM4mKz6Xq0r7y5K4Bf_8cE9d3_lO8vW-2Z3X7Y6W9T8=";
      const uint8 = urlBase64ToUint8Array(sampleKey);
      assert.ok(uint8 instanceof Uint8Array);
      assert.ok(uint8.length > 0);
    });
  });

  describe("2. Same-Origin Deep Link Route Validation", () => {
    const baseOrigin = "https://eoffice.qcet.edu.vn";

    test("preserves valid relative routes", () => {
      assert.equal(
        validateSameOriginRoute("/tasks?taskId=task-100", baseOrigin),
        "/tasks?taskId=task-100"
      );
      assert.equal(
        validateSameOriginRoute("/portal?tab=documents", baseOrigin),
        "/portal?tab=documents"
      );
    });

    test("normalizes same-origin absolute URLs to route path", () => {
      assert.equal(
        validateSameOriginRoute(
          "https://eoffice.qcet.edu.vn/tasks?taskId=task-200",
          baseOrigin
        ),
        "/tasks?taskId=task-200"
      );
    });

    test("blocks untrusted external origins and falls back to /tasks", () => {
      assert.equal(
        validateSameOriginRoute("https://malicious-phishing.com/steal-creds", baseOrigin),
        "/tasks"
      );
      assert.equal(
        validateSameOriginRoute("http://attacker.org/tasks", baseOrigin),
        "/tasks"
      );
    });

    test("blocks dangerous URI schemes like javascript: and data:", () => {
      assert.equal(
        validateSameOriginRoute("javascript:alert(document.cookie)", baseOrigin),
        "/tasks"
      );
      assert.equal(
        validateSameOriginRoute("data:text/html,<script>alert(1)</script>", baseOrigin),
        "/tasks"
      );
      assert.equal(
        validateSameOriginRoute("vbscript:MsgBox(1)", baseOrigin),
        "/tasks"
      );
    });

    test("handles empty or null inputs safely", () => {
      assert.equal(validateSameOriginRoute(null as any, baseOrigin), "/tasks");
      assert.equal(validateSameOriginRoute(undefined as any, baseOrigin), "/tasks");
      assert.equal(validateSameOriginRoute("", baseOrigin), "/tasks");
      assert.equal(validateSameOriginRoute("   ", baseOrigin), "/tasks");
    });
  });

  describe("3. Notification Tag Namespaces & Deduplication", () => {
    test("generates task:review tag for deliverable and review actions", () => {
      const tag = generateNotificationTag("task", "task-888", "review");
      assert.equal(tag, "task:task-888:review");

      const deliverableTag = generateNotificationTag("task", "task-888", "DELIVERABLE_SUBMITTED");
      assert.equal(deliverableTag, "task:task-888:review");
    });

    test("generates task:assigned tag for assignment actions", () => {
      const tag = generateNotificationTag("task", "task-777", "assigned");
      assert.equal(tag, "task:task-777:assigned");

      const assignTag = generateNotificationTag("task", "task-777", "TASK_ASSIGNED");
      assert.equal(assignTag, "task:task-777:assigned");
    });

    test("generates task:deadline tag for deadline reminders", () => {
      const tag = generateNotificationTag("task", "task-999", "deadline");
      assert.equal(tag, "task:task-999:deadline");

      const deadlineWarnTag = generateNotificationTag("task", "task-999", "DEADLINE_WARNING_24H");
      assert.equal(deadlineWarnTag, "task:task-999:deadline");
    });

    test("generates doc:directive tag for document directives", () => {
      const tag = generateNotificationTag("doc", "doc-123", "directive");
      assert.equal(tag, "doc:doc-123:directive");

      const tagFromDocEntity = generateNotificationTag("document", "doc-456", "directive");
      assert.equal(tagFromDocEntity, "doc:doc-456:directive");
    });

    test("formats notification payload conforming to canonical schema", () => {
      const payload = formatNotificationPayload(
        "[GIAO VIỆC] Soạn thảo kế hoạch",
        "Hiệu trưởng vừa giao việc cho bạn",
        {
          entityType: "task",
          entityId: "task-001",
          action: "assigned",
          route: "/tasks?taskId=task-001",
        }
      );

      assert.equal(payload.title, "[GIAO VIỆC] Soạn thảo kế hoạch");
      assert.equal(payload.tag, "task:task-001:assigned");
      assert.equal(payload.data.entityId, "task-001");
      assert.equal(payload.data.type, "ASSIGNED");
      assert.equal(payload.data.route, "/tasks?taskId=task-001");
      assert.equal(payload.data.url, "/tasks?taskId=task-001");
    });
  });

  describe("4. iOS Platform Constraints & Web Push Guidance", () => {
    test("identifies iOS Safari browser mode and enforces Home Screen PWA requirement", () => {
      const iPhoneUA =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

      (global as any).window = {
        matchMedia: () => ({ matches: false }),
      };
      Object.defineProperty(global, "navigator", {
        value: {
          userAgent: iPhoneUA,
          standalone: false,
          maxTouchPoints: 5,
        },
        configurable: true,
        writable: true,
      });

      const status = checkIOSPushStatus(iPhoneUA);
      assert.equal(status.isIOS, true);
      assert.equal(status.isStandalone, false);
      assert.equal(status.requiresPwaInstall, true);
      assert.equal(status.isPushSupported, false);
      assert.ok(status.message?.includes("Màn hình chính"));
    });

    test("identifies Android / Desktop non-iOS without requiring Home Screen install", () => {
      const desktopChromeUA =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

      (global as any).window = {
        matchMedia: () => ({ matches: false }),
      };
      Object.defineProperty(global, "navigator", {
        value: {
          userAgent: desktopChromeUA,
          standalone: false,
          maxTouchPoints: 0,
        },
        configurable: true,
        writable: true,
      });

      const status = checkIOSPushStatus(desktopChromeUA);
      assert.equal(status.isIOS, false);
      assert.equal(status.requiresPwaInstall, false);
    });
  });

  describe("5. Push Preferences & Topic Filters", () => {
    test("initializes default preferences with all topics enabled", () => {
      assert.equal(DEFAULT_PUSH_PREFERENCES.taskAssigned, true);
      assert.equal(DEFAULT_PUSH_PREFERENCES.taskReview, true);
      assert.equal(DEFAULT_PUSH_PREFERENCES.deadlineReminder, true);
      assert.equal(DEFAULT_PUSH_PREFERENCES.documentDirective, true);
    });

    test("maps notification event types to canonical push topics", () => {
      assert.equal(mapNotificationTypeToTopic("TASK_ASSIGNED"), "task_assigned");
      assert.equal(mapNotificationTypeToTopic("DELIVERABLE_SUBMITTED"), "task_review");
      assert.equal(mapNotificationTypeToTopic("DELIVERABLE_APPROVED"), "task_review");
      assert.equal(mapNotificationTypeToTopic("DEADLINE_WARNING_24H"), "deadline_reminder");
      assert.equal(mapNotificationTypeToTopic("EXECUTIVE_DIRECTIVE"), "document_directive");
      assert.equal(mapNotificationTypeToTopic("DOCUMENT_DIRECTIVE"), "document_directive");
    });

    test("evaluates topic enabled status accurately based on preferences", () => {
      const customizedPrefs: PushPreferences = {
        taskAssigned: true,
        taskReview: false,
        deadlineReminder: true,
        documentDirective: false,
      };

      assert.equal(isTopicEnabled(customizedPrefs, "TASK_ASSIGNED"), true);
      assert.equal(isTopicEnabled(customizedPrefs, "DELIVERABLE_SUBMITTED"), false);
      assert.equal(isTopicEnabled(customizedPrefs, "DEADLINE_WARNING_24H"), true);
      assert.equal(isTopicEnabled(customizedPrefs, "EXECUTIVE_DIRECTIVE"), false);
    });

    test("isolates push preferences storage keys by user id", () => {
      assert.equal(
        getPushPreferencesStorageKey("user-1"),
        "qcet_push_prefs_v1:user-1"
      );
      assert.equal(
        getPushPreferencesStorageKey(null),
        "qcet_push_prefs_v1:anonymous"
      );
    });
  });

  describe("6. Same-Origin Deep Link URL Validation (validateDeepLinkUrl)", () => {
    test("validates same-origin deep link URLs and rejects external/open redirects", () => {
      (global as any).window = { location: { origin: "https://eoffice.qcet.edu.vn" } };

      // Valid internal paths
      assert.equal(
        validateDeepLinkUrl("/tasks/task-123", "https://eoffice.qcet.edu.vn"),
        "https://eoffice.qcet.edu.vn/tasks/task-123"
      );

      // Malicious external redirects
      assert.equal(
        validateDeepLinkUrl("https://phishing-site.com/login", "https://eoffice.qcet.edu.vn"),
        null,
        "Must reject external origins"
      );

      assert.equal(
        validateDeepLinkUrl("javascript:alert(1)", "https://eoffice.qcet.edu.vn"),
        null,
        "Must reject javascript: protocols"
      );
    });
  });

  describe("7. Push Onboarding Snooze Account Isolation", () => {
    test("scopes the push/install snooze by account (no shared-device suppression)", async () => {
      const USER_A = "offline-account-A";
      const USER_B = "offline-account-B";

      const backing = new Map<string, string>();
      const originalLocalStorage = globalThis.localStorage;
      Object.defineProperty(globalThis, "localStorage", {
        value: {
          getItem: (key: string) => (backing.has(key) ? backing.get(key)! : null),
          setItem: (key: string, value: string) => void backing.set(key, value),
          removeItem: (key: string) => void backing.delete(key),
          clear: () => backing.clear(),
          key: (index: number) => Array.from(backing.keys())[index] ?? null,
          get length() {
            return backing.size;
          },
        },
        configurable: true,
        writable: true,
      });

      try {
        const { isPushOnboardingSnoozed, recordPushOnboardingSnooze } = await import(
          "../../src/components/pwa/push-onboarding-sheet"
        );

        assert.equal(isPushOnboardingSnoozed(USER_A), false, "No dismissal recorded yet");

        recordPushOnboardingSnooze(USER_A);

        assert.equal(
          isPushOnboardingSnoozed(USER_A),
          true,
          "A dismissal must suppress the prompt for the same account"
        );
        assert.equal(
          isPushOnboardingSnoozed(USER_B),
          false,
          "A dismissal must NOT suppress the prompt for another account on a shared device"
        );
        assert.ok(
          backing.has(`qcet-push-onboarding-dismissed:${USER_A}`),
          "Snooze must be persisted under the account-scoped key, never a global constant"
        );
      } finally {
        Object.defineProperty(globalThis, "localStorage", {
          value: originalLocalStorage,
          configurable: true,
          writable: true,
        });
      }
    });
  });

  describe("8. PWA Badging API Progressive Enhancement", () => {
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

    test("returns true when navigator.setAppBadge and clearAppBadge are present", () => {
      assert.equal(isBadgingSupported(), true);
    });

    test("returns false when navigator.setAppBadge is missing", () => {
      Object.defineProperty(global, "navigator", {
        value: {},
        configurable: true,
        writable: true,
      });
      assert.equal(isBadgingSupported(), false);
    });

    test("sets app badge with integer count", async () => {
      const ok = await setAppBadge(5);
      assert.equal(ok, true);
      assert.equal(badgeValue, 5);
      assert.equal(isCleared, false);
    });

    test("clears badge automatically when count is 0", async () => {
      const ok = await setAppBadge(0);
      assert.equal(ok, true);
      assert.equal(isCleared, true);
    });

    test("clears badge directly via clearAppBadge", async () => {
      const ok = await clearAppBadge();
      assert.equal(ok, true);
      assert.equal(isCleared, true);
    });

    test("gracefully catches exceptions and returns false without crashing", async () => {
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

    test("rejects non-finite badge counts (NaN / Infinity)", async () => {
      assert.equal(await setAppBadge(NaN), false, "Must reject NaN badge count");
      assert.equal(await setAppBadge(Infinity), false, "Must reject Infinity badge count");
    });

    test("calculates badge count strictly from actionable items", () => {
      const counts: ActionableBadgeCounts = {
        actionableTasks: 3,
        pendingReviews: 2,
        urgentOverdueTasks: 1,
        pendingApprovals: 4,
      };

      const total = calculateActionableBadgeCount(counts);
      assert.equal(total, 10);
    });

    test("handles zero and undefined counts gracefully", () => {
      const counts: ActionableBadgeCounts = {
        actionableTasks: 0,
      };

      const total = calculateActionableBadgeCount(counts);
      assert.equal(total, 0);
    });

    test("updates OS badge with actionable sum and clears when total is zero", async () => {
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
