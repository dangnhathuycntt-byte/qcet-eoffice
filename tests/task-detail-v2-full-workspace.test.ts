import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { computeDueStatus } from "@/components/tasks/detail/task-identity-block";

describe("Task Detail V2 — Full-Detail Productivity Workspace Suite", () => {
  it("computeDueStatus calculates correct relative due dates and overdue flags", () => {
    const emptyResult = computeDueStatus(null);
    assert.equal(emptyResult.isOverdue, false);
    assert.equal(emptyResult.text, "Chưa đặt hạn");

    // Past due date
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const pastResult = computeDueStatus(pastDate.toISOString());
    assert.equal(pastResult.isOverdue, true);
    assert.match(pastResult.text, /Quá hạn 3 ngày/);

    // Future due date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const futureResult = computeDueStatus(futureDate.toISOString());
    assert.equal(futureResult.isOverdue, false);
    assert.match(futureResult.text, /Còn 5 ngày/);
  });

  it("Task Detail V2 components adhere to no-emoji and design token conventions", () => {
    const detailDir = path.join(process.cwd(), "src/components/tasks/detail");
    const files = fs.readdirSync(detailDir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

    assert.ok(files.length >= 6, "Must contain all modular detail components");

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    for (const file of files) {
      const content = fs.readFileSync(path.join(detailDir, file), "utf-8");

      // Verify no emojis in UI strings
      assert.doesNotMatch(
        content,
        emojiRegex,
        `File ${file} must not contain raw emojis according to anti-slop guidelines`
      );

      // Verify no dark: classes (Light-only construction)
      assert.doesNotMatch(
        content,
        /\bdark:/,
        `File ${file} must not contain dark: variants (QCET E-Office is light-only)`
      );
    }
  });

  it("TaskDetailPage eliminates outer card container and embraces full workspace", () => {
    const pagePath = path.join(process.cwd(), "src/components/tasks/task-detail-page.tsx");
    const content = fs.readFileSync(pagePath, "utf-8");

    // Check that outer padding card container is removed
    assert.doesNotMatch(
      content,
      /bg-slate-50\/60.*flex flex-col items-center/,
      "Must not contain outer centered card container"
    );

    // Verify presence of full workspace data-slot
    assert.match(
      content,
      /data-slot="task-workspace"/,
      "Must contain full-detail task-workspace container"
    );
  });
});
