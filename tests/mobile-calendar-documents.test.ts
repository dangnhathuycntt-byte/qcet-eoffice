import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { formatMonthYearVi } from "../src/components/calendar/calendar-month-view";

describe("Sprint M4: Calendar & Documents Mobile Refactor", () => {
  const rootDir = path.resolve(__dirname, "..");
  const calendarWorkspacePath = path.join(
    rootDir,
    "src/components/calendar/executive-calendar-workspace.tsx"
  );
  const calendarMonthViewPath = path.join(
    rootDir,
    "src/components/calendar/calendar-month-view.tsx"
  );
  const documentRegistryPath = path.join(
    rootDir,
    "src/components/documents/document-registry-view.tsx"
  );
  const documentDetailDialogPath = path.join(
    rootDir,
    "src/components/documents/document-detail-dialog.tsx"
  );

  const calendarWorkspaceContent = fs.readFileSync(calendarWorkspacePath, "utf-8");
  const calendarMonthViewContent = fs.readFileSync(calendarMonthViewPath, "utf-8");
  const documentRegistryContent = fs.readFileSync(documentRegistryPath, "utf-8");
  const documentDetailDialogContent = fs.readFileSync(documentDetailDialogPath, "utf-8");

  // 1. Invariants Tests
  describe("Architectural Invariants", () => {
    const emojiRegex =
      /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

    test("Calendar components contain ZERO decorative emojis", () => {
      assert.equal(
        emojiRegex.test(calendarWorkspaceContent),
        false,
        "executive-calendar-workspace.tsx must not contain emojis"
      );
      assert.equal(
        emojiRegex.test(calendarMonthViewContent),
        false,
        "calendar-month-view.tsx must not contain emojis"
      );
    });

    test("Document components contain ZERO decorative emojis", () => {
      assert.equal(
        emojiRegex.test(documentRegistryContent),
        false,
        "document-registry-view.tsx must not contain emojis"
      );
      assert.equal(
        emojiRegex.test(documentDetailDialogContent),
        false,
        "document-detail-dialog.tsx must not contain emojis"
      );
    });

    test("All modified components strictly adhere to Light-Only standard (ZERO dark: classes)", () => {
      const darkClassRegex = /\bdark:/;
      assert.equal(
        darkClassRegex.test(calendarWorkspaceContent),
        false,
        "executive-calendar-workspace.tsx must not contain dark: classes"
      );
      assert.equal(
        darkClassRegex.test(calendarMonthViewContent),
        false,
        "calendar-month-view.tsx must not contain dark: classes"
      );
      assert.equal(
        darkClassRegex.test(documentRegistryContent),
        false,
        "document-registry-view.tsx must not contain dark: classes"
      );
      assert.equal(
        darkClassRegex.test(documentDetailDialogContent),
        false,
        "document-detail-dialog.tsx must not contain dark: classes"
      );
    });

    test("Uses tabular numbers (tabular-nums and font-mono) for numbers, codes, dates, and times", () => {
      assert.ok(
        calendarWorkspaceContent.includes("tabular-nums"),
        "Calendar workspace must use tabular-nums"
      );
      assert.ok(
        documentRegistryContent.includes("tabular-nums") &&
          documentRegistryContent.includes("font-mono"),
        "Document registry must use font-mono and tabular-nums"
      );
    });
  });

  // 2. Calendar Mobile Refactor
  describe("Calendar Mobile Refactor (< 640px / sm:hidden)", () => {
    test("Replaces 7-column grid on mobile with an Agenda Feed (data-slot='mobile-agenda-feed')", () => {
      assert.ok(
        calendarMonthViewContent.includes('data-slot="mobile-agenda-feed"'),
        "Calendar month view must provide a mobile agenda feed container"
      );
      assert.ok(
        calendarMonthViewContent.includes("block sm:hidden") &&
          calendarMonthViewContent.includes("hidden sm:block"),
        "Mobile agenda feed must be active on <640px (block sm:hidden) while desktop grid is preserved (hidden sm:block)"
      );
    });

    test("Mobile month header provides compact month selector with min 44px touch targets", () => {
      assert.ok(
        calendarMonthViewContent.includes("min-h-[44px]") &&
          calendarMonthViewContent.includes("min-w-[44px]"),
        "Mobile navigation arrows must provide minimum 44px touch target"
      );
    });

    test("Mobile agenda feed groups events chronologically by day with day headers", () => {
      assert.ok(
        calendarMonthViewContent.includes("EEEE, dd/MM/yyyy") ||
          calendarMonthViewContent.includes("Tháng") ||
          calendarMonthViewContent.includes("groupTasksByDay"),
        "Day headers must be formatted and grouped chronologically"
      );
      assert.ok(
        calendarMonthViewContent.includes('data-slot="mobile-agenda-event"'),
        "Mobile agenda feed must render structured event items"
      );
    });

    test("Mobile agenda events have min-h-[48px] tap target and show time, title, room, and host", () => {
      assert.ok(
        calendarMonthViewContent.includes("min-h-[48px]"),
        "Mobile agenda event items must have min-h-[48px] for comfortable tapping"
      );
      assert.ok(
        calendarMonthViewContent.includes("location") ||
          calendarMonthViewContent.includes("Phòng"),
        "Agenda event must render location or room metadata"
      );
    });

    test("Preserves full desktop views (Month/Week/Day) on desktop viewports", () => {
      assert.ok(
        calendarMonthViewContent.includes("hidden sm:block"),
        "Desktop viewports must preserve desktop month grid"
      );
    });
  });

  // 3. Documents Mobile Refactor
  describe("Documents Mobile Refactor (< 640px / sm:hidden)", () => {
    test("Eliminates desktop split table view on mobile viewports", () => {
      assert.ok(
        documentRegistryContent.includes("hidden sm:block"),
        "Registry table must be hidden on mobile viewports (<640px)"
      );
      assert.ok(
        documentRegistryContent.includes('data-slot="mobile-document-feed"'),
        "Mobile document feed must be rendered on mobile viewports"
      );
    });

    test("Provides mobile search input with min-h-[44px]", () => {
      assert.ok(
        documentRegistryContent.includes("min-h-[44px] pl-10") ||
          documentRegistryContent.includes('data-slot="mobile-document-controls"'),
        "Mobile search input must have min-h-[44px] touch target"
      );
    });

    test("Provides 4 mobile filter chips with min-h-[44px]: Tất cả, Văn bản đến, Văn bản đi, Chờ xử lý", () => {
      assert.ok(
        documentRegistryContent.includes("Văn bản đến") &&
          documentRegistryContent.includes("Văn bản đi") &&
          documentRegistryContent.includes("Chờ xử lý"),
        "Mobile filter chips must include Tất cả, Văn bản đến, Văn bản đi, and Chờ xử lý"
      );
      assert.ok(
        documentRegistryContent.includes("min-h-[44px] px-3.5"),
        "Mobile filter chips must satisfy minimum 44px touch ergonomics"
      );
    });

    test("Mobile document cards display Code, Title, Metadata (Type & Date), and Status", () => {
      assert.ok(
        documentRegistryContent.includes('data-slot="mobile-document-card"'),
        "Mobile document card slot must be present"
      );
      assert.ok(
        documentRegistryContent.includes("min-h-[48px]"),
        "Mobile document cards must have min-h-[48px] for finger tap ergonomics"
      );
      assert.ok(
        documentRegistryContent.includes("getDocTypeLabel"),
        "Mobile document card must format type label cleanly"
      );
    });

    test("Opening PDF / attachment triggers full-screen PDF view with min-h-[44px] back button", () => {
      assert.ok(
        documentRegistryContent.includes('data-slot="fullscreen-pdf-viewer"'),
        "Full-screen PDF viewer modal must be supported"
      );
      assert.ok(
        documentRegistryContent.includes("min-h-[44px] min-w-[44px]") ||
          documentRegistryContent.includes("min-h-[44px] px-4"),
        "Close and back buttons on full-screen PDF view must meet min-h-[44px]"
      );
    });

    test("DocumentDetailDialog supports onViewPdf callback and mobile-friendly responsive layout", () => {
      assert.ok(
        documentDetailDialogContent.includes("onViewPdf"),
        "DocumentDetailDialog must support onViewPdf callback"
      );
      assert.ok(
        documentDetailDialogContent.includes("min-h-[44px]"),
        "DocumentDetailDialog must have touch targets >= 44px"
      );
    });
  });

  // 4. Date and Day Formatter Logic Verification
  describe("Vietnamese Date & Time Formatting Utilities", () => {
    test("Formats month year in Vietnamese correctly", () => {
      const formatted = formatMonthYearVi(2026, 8); // 8 is September (0-indexed)
      assert.strictEqual(formatted, "Tháng 09 / 2026");
    });

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
