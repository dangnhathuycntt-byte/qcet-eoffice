import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { filterTasksByTime, getTaskTimeFilterLabel } from "../src/lib/task-time-filter";
import { getTaskContentPreview } from "../src/lib/task-content-preview";
import { parseWorkspaceQuery, serializeWorkspaceQuery } from "../src/lib/workspace-query";

describe("Task time filter and quick preview", () => {
  test("renders persisted QCET blocks as readable text", () => {
    const raw = JSON.stringify({ qcetBlocks: true, version: 1, blocks: [
      { id: "b-1", type: "heading", content: "Chuẩn bị cơ sở vật chất" },
      { id: "b-2", type: "text", content: "Hoàn thành trước khai giảng" },
      { id: "b-3", type: "divider" },
    ] });
    assert.equal(getTaskContentPreview(raw), "Chuẩn bị cơ sở vật chất\nHoàn thành trước khai giảng");
    assert.equal(getTaskContentPreview("Mô tả cũ"), "Mô tả cũ");
  });

  test("serializes presets and valid ranges without a fake all-time option", () => {
    const preset = serializeWorkspaceQuery({ month: "ALL", status: "ALL", time: "today" });
    assert.equal(preset.get("time"), "today");
    assert.equal(preset.has("month"), false);

    const range = parseWorkspaceQuery("?time=range&dateFrom=2026-09-01&dateTo=2026-09-18");
    assert.equal(range.time, "range");
    assert.equal(range.dateFrom, "2026-09-01");
    assert.equal(range.dateTo, "2026-09-18");
    assert.equal(parseWorkspaceQuery("?time=range&dateFrom=2026-09-20&dateTo=2026-09-18").time, undefined);
  });

  test("filters today, calendar week, month, overdue and inclusive range", () => {
    const tasks = [
      { id: "today", title: "Today", status: "IN_PROGRESS", dueDate: "2026-09-18", subTasks: [] },
      { id: "sunday", title: "Sunday", status: "IN_PROGRESS", dueDate: "2026-09-20", subTasks: [] },
      { id: "old", title: "Old", status: "IN_PROGRESS", dueDate: "2026-09-01", subTasks: [] },
      { id: "done", title: "Done", status: "COMPLETED", dueDate: "2026-09-01", subTasks: [] },
    ] as any;
    const now = new Date(2026, 8, 18, 12);
    assert.deepEqual(filterTasksByTime(tasks, { kind: "preset", preset: "today" }, now).map((t) => t.id), ["today"]);
    assert.deepEqual(filterTasksByTime(tasks, { kind: "preset", preset: "this_week" }, now).map((t) => t.id), ["today", "sunday"]);
    assert.deepEqual(filterTasksByTime(tasks, { kind: "preset", preset: "overdue" }, now).map((t) => t.id), ["old"]);
    assert.deepEqual(filterTasksByTime(tasks, { kind: "range", from: "2026-09-18", to: "2026-09-20" }, now).map((t) => t.id), ["today", "sunday"]);
    assert.equal(getTaskTimeFilterLabel({ kind: "none" }), "Thời gian");
  });
});
