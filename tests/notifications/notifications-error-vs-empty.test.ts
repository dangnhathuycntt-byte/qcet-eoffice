import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  deriveNotificationsViewState,
  getNotificationEmptyCopy,
  getMobileNotificationEmptyCopy,
  NOTIFICATION_OVERCLAIM_PHRASES,
  type NotificationTriageTab,
  type MobileNotificationFilter,
} from "../../src/lib/notification-triage";

describe("T44: notification surfaces distinguish loading / data / empty / error", () => {
  test("error wins over empty and data — a failed fetch never collapses into no-data", () => {
    assert.equal(
      deriveNotificationsViewState({ isLoading: false, hasError: true, count: 0 }),
      "error"
    );
    assert.equal(
      deriveNotificationsViewState({ isLoading: false, hasError: true, count: 5 }),
      "error"
    );
    assert.equal(
      deriveNotificationsViewState({ isLoading: true, hasError: true, count: 0 }),
      "error"
    );
  });

  test("empty is only produced from a successful, genuinely empty result set", () => {
    assert.equal(
      deriveNotificationsViewState({ isLoading: false, hasError: false, count: 0 }),
      "empty"
    );
  });

  test("loading is produced while a fetch is in flight with no prior data", () => {
    assert.equal(
      deriveNotificationsViewState({ isLoading: true, hasError: false, count: 0 }),
      "loading"
    );
    // A background refresh that still has data must not blank the list.
    assert.equal(
      deriveNotificationsViewState({ isLoading: true, hasError: false, count: 3 }),
      "data"
    );
  });

  test("data is produced for a non-empty result set", () => {
    assert.equal(
      deriveNotificationsViewState({ isLoading: false, hasError: false, count: 1 }),
      "data"
    );
  });
});

describe("T45: notification empty copy is bounded and never overclaims", () => {
  const TABS: NotificationTriageTab[] = ["all", "action_required", "approvals", "reminders"];

  test("desktop empty copy never claims all institutional work is handled", () => {
    const copies = [
      ...TABS.map((tab) => getNotificationEmptyCopy(tab)),
      getNotificationEmptyCopy("all", true),
    ];
    for (const copy of copies) {
      const text = `${copy.title} ${copy.description}`;
      assert.ok(copy.title.trim().length > 0, "empty copy title must not be blank");
      assert.ok(copy.description.trim().length > 0, "empty copy description must not be blank");
      for (const phrase of NOTIFICATION_OVERCLAIM_PHRASES) {
        assert.equal(
          text.toLowerCase().includes(phrase),
          false,
          `overclaiming copy "${text}" contains forbidden phrase "${phrase}"`
        );
      }
    }
  });

  test("mobile empty copy is bounded for every triage filter", () => {
    const filters: MobileNotificationFilter[] = ["all", "unread", "action_required"];
    for (const filter of filters) {
      const copy = getMobileNotificationEmptyCopy(filter);
      const text = `${copy.title} ${copy.description}`;
      assert.ok(copy.title.trim().length > 0, "mobile empty title must not be blank");
      assert.ok(copy.description.trim().length > 0, "mobile empty description must not be blank");
      for (const phrase of NOTIFICATION_OVERCLAIM_PHRASES) {
        assert.equal(
          text.toLowerCase().includes(phrase),
          false,
          `overclaiming mobile copy "${text}" contains forbidden phrase "${phrase}"`
        );
      }
    }
  });
});
