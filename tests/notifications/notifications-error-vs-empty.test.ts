import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { deriveNotificationsViewState, getNotificationEmptyCopy, type NotificationTriageTab, type MobileNotificationFilter } from "../../src/lib/notification-triage";

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
