import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Sprint M4: Calendar & Documents Mobile Date Formatting", () => {
  describe("Vietnamese Date & Time Formatting Utilities", () => {

    test("Formats date header in Vietnamese correctly using standard formatter", () => {
      const testDate = new Date(2026, 8, 9, 9, 30); // 09/09/2026
      const formatted = new Intl.DateTimeFormat("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(testDate);
      assert.ok(
        formatted.includes("09") && formatted.includes("2026"),
        "Date string must include day and year in tabular format"
      );
    });
  });
});
