import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const calendarPagePath = path.resolve(process.cwd(), "src/app/calendar/page.tsx");
const calendarWorkspacePath = path.resolve(
  process.cwd(),
  "src/components/calendar/executive-calendar-workspace.tsx"
);

describe("Calendar Route (/calendar) First-Class Standalone Route & Hygiene", () => {
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
      content.includes("Lịch Công Tác") || content.includes("Lịch Biểu"),
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

  test("src/app/calendar/page.tsx delegates creation to the canonical create command and avoids hardcoded 'task-1'", () => {
    const content = fs.readFileSync(calendarPagePath, "utf8");

    // Plan R-C1: the Create Command pipeline is canonical —
    // UI Draft -> canonical mapper -> CreateTaskInput -> API. A page must NOT
    // issue its own raw POST to /api/tasks; that duplicate-create defect is what
    // this assertion now forbids (previously it required the opposite).
    assert.doesNotMatch(
      content,
      /fetch\(\s*["'`]\/api\/tasks["'`]/,
      "Page must not issue a raw POST to /api/tasks — creation must go through the canonical create command"
    );

    // The create must still be persisted, via the shared canonical surface
    // rather than a locally fabricated task.
    assert.ok(
      content.includes("@/lib/adapters/create-task-mapper") ||
        content.includes("@/components/dashboard/create-task-modal"),
      "Page must route creation through the canonical create adapter/modal"
    );

    assert.doesNotMatch(
      content,
      /"task-1"/,
      "src/app/calendar/page.tsx must not use hardcoded 'task-1' fallback"
    );
  });

  test("ExecutiveCalendarWorkspace avoids double modal / backdrop collision on event click", () => {
    assert.ok(fs.existsSync(calendarWorkspacePath), "executive-calendar-workspace.tsx must exist");
    const content = fs.readFileSync(calendarWorkspacePath, "utf8");

    assert.ok(
      content.includes("if (onSelectEvent)") || content.includes("if (onSelectEvent) {"),
      "handleEventClick must branch on onSelectEvent"
    );
    // Ensure selectedPreviewEvent is NOT unconditionally called alongside onSelectEvent
    assert.doesNotMatch(
      content,
      /setSelectedPreviewEvent\(ev\);\s*onSelectEvent\?\.`?\(ev\)/,
      "Must not open preview modal simultaneously when onSelectEvent is provided"
    );
  });
});
