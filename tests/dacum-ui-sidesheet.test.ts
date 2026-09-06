// tests/dacum-ui-sidesheet.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task Detail Side-Sheet AI Integration Audit", () => {
  const filePath = path.resolve(
    __dirname,
    "../src/components/dashboard/task-detail-side-sheet.tsx"
  );
  const content = fs.readFileSync(filePath, "utf-8");

  test("contains AI Executive Brief card integration", () => {
    assert.ok(content.includes("aiReview") || content.includes("screenDeliverablesWithAI"));
    assert.ok(content.includes("Điểm tuân thủ") || content.includes("complianceScore"));
  });

  test("provides Quick Approve action according to AI recommendation", () => {
    assert.ok(content.includes("Duyệt nhanh") || content.includes("QUICK_APPROVE"));
  });

  test("adheres strictly to Zero Emojis policy", () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.equal(emojiRegex.test(content), false, "Must contain zero emojis");
  });
});
