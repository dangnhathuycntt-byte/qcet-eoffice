import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  urlBase64ToUint8Array,
  validateSameOriginRoute,
  generateNotificationTag,
  formatNotificationPayload,
  checkIOSPushStatus,
} from "../../src/lib/pwa/push-manager";

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

  describe("6. Anti-Slop, Institutional QCET UI & Touch Target Invariants", () => {
    const emojiRegex =
      /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;

    test("push-manager.ts contains 0% emojis", () => {
      const fileContent = fs.readFileSync(
        path.join(process.cwd(), "src/lib/pwa/push-manager.ts"),
        "utf-8"
      );
      assert.equal(
        emojiRegex.test(fileContent),
        false,
        "push-manager.ts must contain 0 emojis"
      );
    });

    test("push-preferences.ts contains 0% emojis", () => {
      const fileContent = fs.readFileSync(
        path.join(process.cwd(), "src/lib/pwa/push-preferences.ts"),
        "utf-8"
      );
      assert.equal(
        emojiRegex.test(fileContent),
        false,
        "push-preferences.ts must contain 0 emojis"
      );
    });

    test("push-onboarding-sheet.tsx contains 0% emojis and 0 dark theme classes", () => {
      const fileContent = fs.readFileSync(
        path.join(process.cwd(), "src/components/pwa/push-onboarding-sheet.tsx"),
        "utf-8"
      );
      assert.equal(
        emojiRegex.test(fileContent),
        false,
        "push-onboarding-sheet.tsx must contain 0 emojis"
      );
      assert.equal(
        fileContent.includes("dark:"),
        false,
        "push-onboarding-sheet.tsx must not contain dark: classes"
      );
    });

    test("push-onboarding-sheet.tsx enforces >=44px touch targets for mobile accessibility", () => {
      const fileContent = fs.readFileSync(
        path.join(process.cwd(), "src/components/pwa/push-onboarding-sheet.tsx"),
        "utf-8"
      );
      assert.ok(
        fileContent.includes("min-h-[44px]"),
        "push-onboarding-sheet.tsx must enforce min-h-[44px] touch targets"
      );
    });
  });
});
