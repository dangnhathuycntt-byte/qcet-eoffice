import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getDaysRemaining,
  getDeadlineBadgeInfo,
} from "../src/components/portal/lecturer-focus-workspace";

describe("getDaysRemaining & getDeadlineBadgeInfo Date & Timezone Handling", () => {
  describe("Preserves explicit referenceDate behavior", () => {
    const refDate = "2026-09-08";

    test("returns 0 for task due on reference date", () => {
      assert.strictEqual(getDaysRemaining("2026-09-08", refDate), 0);
      const badge = getDeadlineBadgeInfo("2026-09-08", refDate);
      assert.strictEqual(badge.label, "Hạn chót: Hôm nay");
      assert.strictEqual(badge.variant, "urgent");
      assert.strictEqual(badge.daysLeft, 0);
    });

    test("returns positive number for future due dates", () => {
      assert.strictEqual(getDaysRemaining("2026-09-09", refDate), 1);
      assert.strictEqual(getDaysRemaining("2026-09-15", refDate), 7);
      assert.strictEqual(getDaysRemaining("2026-09-20", refDate), 12);

      const tomorrowBadge = getDeadlineBadgeInfo("2026-09-09", refDate);
      assert.strictEqual(tomorrowBadge.label, "Hạn chót: Ngày mai");
      assert.strictEqual(tomorrowBadge.variant, "warning");

      const weekBadge = getDeadlineBadgeInfo("2026-09-15", refDate);
      assert.strictEqual(weekBadge.label, "Hạn chót: Còn 7 ngày");
      assert.strictEqual(weekBadge.variant, "warning");

      const laterBadge = getDeadlineBadgeInfo("2026-09-20", refDate);
      assert.strictEqual(laterBadge.label, "Còn 12 ngày");
      assert.strictEqual(laterBadge.variant, "neutral");
    });

    test("returns negative number for overdue tasks", () => {
      assert.strictEqual(getDaysRemaining("2026-09-07", refDate), -1);
      assert.strictEqual(getDaysRemaining("2026-09-03", refDate), -5);

      const overdueBadge = getDeadlineBadgeInfo("2026-09-07", refDate);
      assert.strictEqual(overdueBadge.label, "Quá hạn 1 ngày");
      assert.strictEqual(overdueBadge.variant, "urgent");
      assert.strictEqual(overdueBadge.daysLeft, -1);
    });

    test("handles null or undefined or malformed due dates gracefully", () => {
      assert.strictEqual(getDaysRemaining(undefined, refDate), null);
      assert.strictEqual(getDaysRemaining("", refDate), null);
      assert.strictEqual(getDaysRemaining("invalid-date", refDate), null);

      const emptyBadge = getDeadlineBadgeInfo(undefined, refDate);
      assert.strictEqual(emptyBadge.label, "Không có hạn");
      assert.strictEqual(emptyBadge.variant, "neutral");
      assert.strictEqual(emptyBadge.daysLeft, null);
    });
  });

  describe("Local calendar date resolution when referenceDate is omitted", () => {
    const OriginalDate = globalThis.Date;

    function mockDateWithLocalValues(year: number, month: number, day: number) {
      class MockedDate extends OriginalDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) {
            super();
            // Provide exact mock local date getters
            this.getFullYear = () => year;
            this.getMonth = () => month - 1; // 0-indexed
            this.getDate = () => day;
          } else {
            // @ts-expect-error TypeScript spread on unknown[]
            super(...args);
          }
        }
      }
      globalThis.Date = MockedDate as unknown as DateConstructor;
    }

    test("correctly calculates days remaining using local calendar date", () => {
      try {
        // Simulate local time: 2026-09-08
        mockDateWithLocalValues(2026, 9, 8);

        // Task due today (2026-09-08)
        assert.strictEqual(getDaysRemaining("2026-09-08"), 0);

        // Task due tomorrow (2026-09-09)
        assert.strictEqual(getDaysRemaining("2026-09-09"), 1);

        // Task overdue yesterday (2026-09-07)
        assert.strictEqual(getDaysRemaining("2026-09-07"), -1);
      } finally {
        globalThis.Date = OriginalDate;
      }
    });

    test("midnight boundary in Asia/Ho_Chi_Minh: 00:15 AM is local date 2026-09-08", () => {
      try {
        // In UTC+7 (Asia/Ho_Chi_Minh), 00:15 on 2026-09-08 corresponds to 17:15 UTC on 2026-09-07.
        // The local calendar date is 2026-09-08.
        mockDateWithLocalValues(2026, 9, 8);

        // Task due on 2026-09-08 must be 0 (due today), NOT 1
        assert.strictEqual(getDaysRemaining("2026-09-08"), 0);

        const badge = getDeadlineBadgeInfo("2026-09-08");
        assert.strictEqual(badge.label, "Hạn chót: Hôm nay");
        assert.strictEqual(badge.variant, "urgent");
      } finally {
        globalThis.Date = OriginalDate;
      }
    });

    test("late night boundary in Asia/Ho_Chi_Minh: 23:45 PM is local date 2026-09-08", () => {
      try {
        // At 23:45 on 2026-09-08 in UTC+7 (16:45 UTC on 2026-09-08).
        // Local calendar date is still 2026-09-08.
        mockDateWithLocalValues(2026, 9, 8);

        assert.strictEqual(getDaysRemaining("2026-09-08"), 0);
        assert.strictEqual(getDaysRemaining("2026-09-09"), 1);
        assert.strictEqual(getDaysRemaining("2026-09-07"), -1);
      } finally {
        globalThis.Date = OriginalDate;
      }
    });

    test("month transition boundary around midnight: 00:01 AM on 2026-10-01", () => {
      try {
        // Local calendar date: 2026-10-01
        mockDateWithLocalValues(2026, 10, 1);

        assert.strictEqual(getDaysRemaining("2026-10-01"), 0);
        assert.strictEqual(getDaysRemaining("2026-09-30"), -1);
        assert.strictEqual(getDaysRemaining("2026-10-05"), 4);
      } finally {
        globalThis.Date = OriginalDate;
      }
    });
  });
});
