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
    const now = new Date("2026-09-18T05:00:00Z"); // 12:00 ngày 18/09 giờ Việt Nam
    assert.deepEqual(filterTasksByTime(tasks, { kind: "preset", preset: "today" }, now).map((t) => t.id), ["today"]);
    assert.deepEqual(filterTasksByTime(tasks, { kind: "preset", preset: "this_week" }, now).map((t) => t.id), ["today", "sunday"]);
    assert.deepEqual(filterTasksByTime(tasks, { kind: "preset", preset: "overdue" }, now).map((t) => t.id), ["old"]);
    assert.deepEqual(filterTasksByTime(tasks, { kind: "range", from: "2026-09-18", to: "2026-09-20" }, now).map((t) => t.id), ["today", "sunday"]);
    assert.equal(getTaskTimeFilterLabel({ kind: "none" }), "Thời gian");
  });

  test("hôm nay/tuần này tính theo giờ Việt Nam, không theo múi giờ trình duyệt", () => {
    const tasks = [
      { id: "sun", title: "a", status: "IN_PROGRESS", dueDate: "2026-09-20", subTasks: [] },
      { id: "mon", title: "b", status: "IN_PROGRESS", dueDate: "2026-09-21", subTasks: [] },
      { id: "nextSun", title: "c", status: "IN_PROGRESS", dueDate: "2026-09-27", subTasks: [] },
    ] as any;
    const now = new Date("2026-09-20T18:00:00Z"); // 01:00 thứ Hai 21/09 ở Việt Nam, còn Chủ nhật ở UTC
    assert.deepEqual(filterTasksByTime(tasks, { kind: "preset", preset: "today" }, now).map((t) => t.id), ["mon"]);
    assert.deepEqual(filterTasksByTime(tasks, { kind: "preset", preset: "this_week" }, now).map((t) => t.id), ["mon", "nextSun"]);
    assert.deepEqual(filterTasksByTime(tasks, { kind: "preset", preset: "this_month" }, now).map((t) => t.id), ["sun", "mon", "nextSun"]);
  });

  test("lọc theo tháng chỉ khớp tháng trong năm học hiện tại, không khớp cùng tháng năm khác", () => {
    const tasks = [
      { id: "oct-2026", title: "a", status: "IN_PROGRESS", dueDate: "2026-10-15", subTasks: [] },
      { id: "oct-2025", title: "b", status: "IN_PROGRESS", dueDate: "2025-10-15", subTasks: [] },
      { id: "jan-2027", title: "c", status: "IN_PROGRESS", dueDate: "2027-01-10", subTasks: [] },
      { id: "jan-2026", title: "d", status: "IN_PROGRESS", dueDate: "2026-01-10", subTasks: [] },
    ] as any;
    const now = new Date(2026, 9, 13, 12); // năm học 2026-2027
    assert.deepEqual(filterTasksByTime(tasks, { kind: "month", month: 10 }, now).map((t) => t.id), ["oct-2026"]);
    assert.deepEqual(filterTasksByTime(tasks, { kind: "month", month: 1 }, now).map((t) => t.id), ["jan-2027"]);
  });
});
