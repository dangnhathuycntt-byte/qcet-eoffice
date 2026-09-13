import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  deriveNotificationsViewState,
  getNotificationEmptyCopy,
  getMobileNotificationEmptyCopy,
  NOTIFICATION_OVERCLAIM_PHRASES,
  type NotificationTriageTab,
  type MobileNotificationFilter,
} from "../../src/lib/notification-triage";

const PAGE_PATH = path.resolve(process.cwd(), "src/app/notifications/page.tsx");
const MOBILE_PATH = path.resolve(
  process.cwd(),
  "src/components/notifications/mobile-notification-inbox.tsx"
);
const POPOVER_PATH = path.resolve(
  process.cwd(),
  "src/components/notifications/notification-popover.tsx"
);

const SURFACES = [PAGE_PATH, MOBILE_PATH, POPOVER_PATH];

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

  test("each surface renders distinct error and empty states, not one collapsed block", () => {
    for (const filePath of SURFACES) {
      const content = fs.readFileSync(filePath, "utf-8");
      const name = path.basename(filePath);
      assert.ok(
        content.includes("notification-error-state"),
        `${name} must render a distinct error state`
      );
      assert.ok(
        content.includes("notification-empty-state"),
        `${name} must render a distinct empty state`
      );
      assert.ok(
        content.includes("deriveNotificationsViewState"),
        `${name} must derive view state from the canonical helper`
      );
    }
  });

  test("no surface silently swallows a failed fetch with a best-effort catch", () => {
    for (const filePath of SURFACES) {
      const content = fs.readFileSync(filePath, "utf-8");
      const name = path.basename(filePath);
      assert.equal(
        /Best[- ]effort/i.test(content),
        false,
        `${name} must not contain a best-effort fetch swallow`
      );
    }
  });

  test("fetching surfaces treat a non-ok response as an error", () => {
    for (const filePath of [PAGE_PATH, POPOVER_PATH]) {
      const content = fs.readFileSync(filePath, "utf-8");
      const name = path.basename(filePath);
      assert.ok(content.includes("!res.ok"), `${name} must treat a non-ok response as an error`);
      assert.ok(content.includes("setError"), `${name} must record an error state`);
    }
  });

  test("mobile inbox accepts an explicit error prop for parity with desktop", () => {
    const content = fs.readFileSync(MOBILE_PATH, "utf-8");
    assert.ok(
      /error\?:\s*string\s*\|\s*null/.test(content),
      "MobileNotificationInboxProps must declare an error prop"
    );
    assert.ok(
      content.includes("error = null"),
      "mobile inbox must default the error prop"
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

  test("surfaces consume the canonical bounded copy helpers", () => {
    assert.ok(
      fs.readFileSync(PAGE_PATH, "utf-8").includes("getNotificationEmptyCopy"),
      "page.tsx must use the canonical bounded empty copy helper"
    );
    assert.ok(
      fs.readFileSync(MOBILE_PATH, "utf-8").includes("getMobileNotificationEmptyCopy"),
      "mobile inbox must use the canonical bounded empty copy helper"
    );
    assert.ok(
      fs.readFileSync(POPOVER_PATH, "utf-8").includes("getNotificationEmptyCopy"),
      "popover must use the canonical bounded empty copy helper"
    );
  });

  test("no surface hardcodes an overclaiming empty-copy phrase", () => {
    for (const filePath of SURFACES) {
      const lower = fs.readFileSync(filePath, "utf-8").toLowerCase();
      const name = path.basename(filePath);
      for (const phrase of NOTIFICATION_OVERCLAIM_PHRASES) {
        assert.equal(
          lower.includes(phrase),
          false,
          `${name} contains forbidden overclaim phrase "${phrase}"`
        );
      }
    }
  });
});
