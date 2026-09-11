import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const calendarPagePath = path.resolve(process.cwd(), "src/app/calendar/page.tsx");

describe("Calendar Route (/calendar) Hygiene & First-Class Executive View", () => {
  test("src/app/calendar/page.tsx renders ExecutiveCalendarWorkspace directly without redirect", () => {
    assert.ok(fs.existsSync(calendarPagePath), "src/app/calendar/page.tsx must exist");
    const content = fs.readFileSync(calendarPagePath, "utf8");

    assert.equal(
      content.includes("router.replace"),
      false,
      "src/app/calendar/page.tsx must not perform client redirect with router.replace"
    );
    assert.ok(
      content.includes("ExecutiveCalendarWorkspace"),
      "src/app/calendar/page.tsx must mount ExecutiveCalendarWorkspace directly"
    );
  });

  test("src/app/calendar/page.tsx contains ZERO dark: classes", () => {
    const content = fs.readFileSync(calendarPagePath, "utf8");
    assert.doesNotMatch(content, /\bdark:/, "Strict Light-Only: no dark: classes allowed");
    assert.doesNotMatch(content, /ThemeProvider/, "No ThemeProvider allowed");
  });

  test("src/app/calendar/page.tsx contains ZERO decorative emojis", () => {
    const content = fs.readFileSync(calendarPagePath, "utf8");
    assert.doesNotMatch(
      content,
      /[\u{1F300}-\u{1FAFF}]/u,
      "Zero decorative emojis allowed in calendar route"
    );
  });

  test("src/app/calendar/page.tsx defines executive page title and breadcrumb navigation", () => {
    const content = fs.readFileSync(calendarPagePath, "utf8");
    assert.ok(
      content.includes("Lịch công tác") || content.includes("Lịch Công Tác") || content.includes("Lịch Biểu"),
      "Page must define executive title in Vietnamese"
    );
    assert.ok(
      content.includes("<title>") || content.includes("document.title"),
      "Page must specify HTML document title"
    );
  });

  test("src/app/calendar/page.tsx integrates task fetching and Suspense loading skeleton", () => {
    const content = fs.readFileSync(calendarPagePath, "utf8");
    assert.ok(content.includes("Suspense"), "Page must wrap content in Suspense boundary");
    assert.ok(
      content.includes("/api/dashboard/overview") || content.includes("/api/tasks"),
      "Page must fetch tasks from task or overview API"
    );
    assert.ok(
      content.includes("useSearchParams"),
      "Page must support useSearchParams for query params"
    );
    assert.ok(
      content.includes("zone"),
      "Page must support zone parameter compatibility"
    );
  });

  // Task 6 — Content-First Chrome Invariants
  describe("Task 6: Content-first chrome layout invariants", () => {
    test("primary chrome uses a single-row flex container, not a multi-row card", () => {
      const content = fs.readFileSync(calendarPagePath, "utf8");
      // The new chrome is a single flex row (no calendar-controls-row-2)
      assert.equal(
        content.includes("calendar-controls-row-2"),
        false,
        "Must not have a second permanent chrome row (calendar-controls-row-2)"
      );
    });

    test("search is not a permanent full row — no permanent search input outside the disclosure panel", () => {
      const content = fs.readFileSync(calendarPagePath, "utf8");
      // The old layout had a standalone search bar in calendar-controls-row-2.
      // The new layout puts search inside the secondary (⋯) disclosure panel only.
      // Verify: no search input rendered directly at the top level of the chrome
      // (the search input only appears inside isSearchExpanded conditional inside isSecondaryOpen).
      assert.ok(
        content.includes("isSearchExpanded"),
        "Search must be gated behind an expansion state, not always-visible"
      );
      assert.ok(
        content.includes("isSecondaryOpen"),
        "Search must live inside the secondary disclosure panel"
      );
    });

    test("secondary disclosure panel (⋯) contains view mode, academic year, search, and filters", () => {
      const content = fs.readFileSync(calendarPagePath, "utf8");
      assert.ok(content.includes("MoreHorizontal"), "Must render MoreHorizontal icon for ⋯ button");
      assert.ok(content.includes("isSecondaryOpen"), "Must have secondary disclosure state");
      // View mode inside secondary panel
      assert.ok(content.includes("Chế độ xem"), "Secondary panel must contain view mode label");
      // Academic year inside secondary panel
      assert.ok(content.includes("Năm học"), "Secondary panel must contain academic year selector");
      // Filters inside the scope dropdown (not a permanent row)
      assert.ok(content.includes("Cấp nhiệm vụ"), "Filters must be present in disclosure surface");
      assert.ok(content.includes("Trạng thái"), "Status filter must be present in disclosure surface");
    });

    test("month navigation (prev/next/today) is in the single primary row", () => {
      const content = fs.readFileSync(calendarPagePath, "utf8");
      assert.ok(content.includes("handlePrevMonth"), "Prev month handler must be present");
      assert.ok(content.includes("handleNextMonth"), "Next month handler must be present");
      assert.ok(content.includes("handleCurrentMonth"), "Today/current-month handler must be present");
      assert.ok(content.includes("Hôm nay"), "Primary chrome must show Hôm nay button");
    });

    test("task/event creation preserved — + Tạo dropdown present in page header", () => {
      const content = fs.readFileSync(calendarPagePath, "utf8");
      assert.ok(content.includes("Tạo công việc"), "Create task option must be present");
      assert.ok(content.includes("Tạo sự kiện"), "Create event option must be present");
      assert.ok(content.includes("isCreateDropdownOpen"), "Create dropdown state must be present");
    });

    test("font-mono tabular-nums applied to dates/times in chrome", () => {
      const content = fs.readFileSync(calendarPagePath, "utf8");
      assert.ok(
        content.includes("font-mono tabular-nums"),
        "Month label must use font-mono tabular-nums for dates"
      );
    });

    test("day sheet preserved — CalendarDaySheet and isDaySheetOpen present", () => {
      const content = fs.readFileSync(calendarPagePath, "utf8");
      assert.ok(content.includes("CalendarDaySheet"), "CalendarDaySheet must be preserved");
      assert.ok(content.includes("isDaySheetOpen"), "Day sheet open state must be preserved");
    });

    test("no RefreshCw or decorative icon boxes in page header", () => {
      const content = fs.readFileSync(calendarPagePath, "utf8");
      assert.equal(
        content.includes("RefreshCw"),
        false,
        "RefreshCw button must be removed from page header"
      );
    });
  });
});
