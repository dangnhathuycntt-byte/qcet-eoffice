import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(process.cwd(), "src/app/calendar/page.tsx");
const pageSource = fs.readFileSync(pagePath, "utf8");

describe("calendar route persistence and terminology", () => {
  test("loads and creates calendar events through the canonical meetings API", () => {
    assert.match(pageSource, /fetch\(["'`]\/api\/meetings\?/);
    assert.match(pageSource, /fetch\(["'`]\/api\/meetings["'`],\s*\{/);
    assert.match(pageSource, /method:\s*["']POST["']/);
    assert.doesNotMatch(pageSource, /setCustomEvents/);
  });

  test("uses the clearer Danh sách label while preserving the internal agenda mode", () => {
    assert.match(pageSource, /<span>Danh sách<\/span>/);
    assert.match(pageSource, /handleViewChange\("agenda"\)/);
  });

  test("projects persisted meetings into day-sheet event items", () => {
    assert.match(pageSource, /meetingDayItems/);
    assert.match(pageSource, /isEvent:\s*true/);
    assert.match(pageSource, /categoryLabel:\s*["']Sự kiện["']/);
  });
});
