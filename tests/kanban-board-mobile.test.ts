import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task Kanban Board Mobile Snap-Carousel Suite", () => {
  test("task-kanban-board.tsx implements snap-x carousel layout", () => {
    const kanbanPath = path.resolve(process.cwd(), "src/components/tasks/task-kanban-board.tsx");
    const content = fs.readFileSync(kanbanPath, "utf-8");
    assert.ok(content.includes("snap-x"));
    assert.ok(content.includes("snap-mandatory"));
    assert.ok(content.includes("snap-center"));
  });

  test("task-kanban-board.tsx includes mobile stage tabs and carousel indicators", () => {
    const kanbanPath = path.resolve(process.cwd(), "src/components/tasks/task-kanban-board.tsx");
    const content = fs.readFileSync(kanbanPath, "utf-8");
    assert.ok(content.includes("scrollToColumn"));
    assert.ok(content.includes("activeColumnIndex"));
  });
});
