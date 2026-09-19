import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskSubtasksSidebarSection } from "../src/components/tasks/detail/task-subtasks-sidebar-section";
import type { StaffTask } from "../src/types/dashboard";

function makeSubtask(overrides: Partial<StaffTask> & { id: string; title: string }): StaffTask {
  return {
    status: "NOT_STARTED",
    priority: "MEDIUM",
    assigneeName: "",
    departmentName: "",
    createdAt: "2026-01-01",
    dueDate: null,
    ...overrides,
  } as StaffTask;
}

describe("TaskSubtasksSidebarSection — Compact sidebar child list", () => {

  it("renders header with count 0 and no rows when empty", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskSubtasksSidebarSection, {
        subTasks: [],
        onSelectSubtask: () => {},
      })
    );
    assert.ok(html.includes("Việc con"), "Must show 'Việc con' header");
    assert.ok(html.includes(">0<"), "Must show count 0");
    // No row buttons except the + button
    const rowButtons = html.match(/<button[^>]*title="[^"]*"[^>]*>/g)?.filter(b => !b.includes('Tạo việc con')) ?? [];
    assert.equal(rowButtons.length, 0, "Must not render any subtask row buttons when empty");
  });

  it("renders 1 child row with status dot and title", () => {
    const sub = makeSubtask({ id: "s1", title: "Kiểm tra tài liệu", status: "IN_PROGRESS" });
    const html = renderToStaticMarkup(
      React.createElement(TaskSubtasksSidebarSection, {
        subTasks: [sub],
        onSelectSubtask: () => {},
      })
    );
    assert.ok(html.includes("Kiểm tra tài liệu"), "Must show subtask title");
    assert.ok(html.includes("bg-blue-600"), "Must show IN_PROGRESS dot color");
    assert.ok(html.includes(">1<"), "Count must be 1");
  });

  it("renders 5 children without 'Xem thêm'", () => {
    const subs = Array.from({ length: 5 }, (_, i) =>
      makeSubtask({ id: `s${i}`, title: `Task ${i}` })
    );
    const html = renderToStaticMarkup(
      React.createElement(TaskSubtasksSidebarSection, {
        subTasks: subs,
        onSelectSubtask: () => {},
      })
    );
    assert.ok(!html.includes("Xem thêm"), "Must not show 'Xem thêm' for exactly 5 items");
    assert.ok(html.includes(">5<"), "Count must be 5");
    for (let i = 0; i < 5; i++) {
      assert.ok(html.includes(`Task ${i}`), `Must show Task ${i}`);
    }
  });

  it("renders max 5 rows and 'Xem thêm N' for >5 children", () => {
    const subs = Array.from({ length: 8 }, (_, i) =>
      makeSubtask({ id: `s${i}`, title: `Task ${i}` })
    );
    const html = renderToStaticMarkup(
      React.createElement(TaskSubtasksSidebarSection, {
        subTasks: subs,
        onSelectSubtask: () => {},
      })
    );
    assert.ok(html.includes(">8<"), "Count must be 8");
    // Only first 5 visible initially (SSR = collapsed)
    for (let i = 0; i < 5; i++) {
      assert.ok(html.includes(`Task ${i}`), `Must show Task ${i}`);
    }
    assert.ok(!html.includes("Task 5"), "Task 5 must be hidden initially");
    assert.ok(html.includes("Xem thêm 3"), "Must show 'Xem thêm 3 việc con'");
  });

  it("marks selected row with bg-muted/40", () => {
    const subs = [
      makeSubtask({ id: "s1", title: "First" }),
      makeSubtask({ id: "s2", title: "Second" }),
    ];
    const html = renderToStaticMarkup(
      React.createElement(TaskSubtasksSidebarSection, {
        subTasks: subs,
        activeSubtaskId: "s2",
        onSelectSubtask: () => {},
      })
    );
    // The active row should have bg-muted/40
    const s2Idx = html.indexOf("Second");
    assert.ok(s2Idx > 0, "Must render Second subtask");
    // Find the button containing "Second" and check it has bg-muted/40
    const beforeS2 = html.slice(Math.max(0, s2Idx - 300), s2Idx);
    assert.ok(beforeS2.includes("bg-muted/40"), "Active row must have bg-muted/40 class");
  });

  it("renders + button calling onAddSubtask", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskSubtasksSidebarSection, {
        subTasks: [],
        onSelectSubtask: () => {},
        onAddSubtask: () => {},
      })
    );
    assert.ok(html.includes('title="Tạo việc con"'), "Must render + button with proper title");
  });

  it("does not render + button when onAddSubtask is not provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskSubtasksSidebarSection, {
        subTasks: [],
        onSelectSubtask: () => {},
      })
    );
    assert.ok(!html.includes('title="Tạo việc con"'), "Must not render + button without onAddSubtask");
  });

  it("uses correct status dot colors for each status", () => {
    const subs = [
      makeSubtask({ id: "s1", title: "New", status: "NOT_STARTED" }),
      makeSubtask({ id: "s2", title: "Progress", status: "IN_PROGRESS" }),
      makeSubtask({ id: "s3", title: "Waiting", status: "WAITING_APPROVAL" }),
      makeSubtask({ id: "s4", title: "Done", status: "COMPLETED" }),
    ];
    const html = renderToStaticMarkup(
      React.createElement(TaskSubtasksSidebarSection, {
        subTasks: subs,
        onSelectSubtask: () => {},
      })
    );
    assert.ok(html.includes("bg-muted-foreground/60"), "NOT_STARTED dot");
    assert.ok(html.includes("bg-blue-600"), "IN_PROGRESS dot");
    assert.ok(html.includes("bg-amber-600"), "WAITING_APPROVAL dot");
    assert.ok(html.includes("bg-emerald-600"), "COMPLETED dot");
  });
});
