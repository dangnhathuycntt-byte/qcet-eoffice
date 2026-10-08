import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getDueIndicator } from "../src/components/tasks/table/utils/table-date-helpers";
import { computeWorkspaceTabCounts } from "../src/lib/workspace-metrics-aggregator";
import type { SchoolTask } from "../src/types/dashboard";

describe("getDueIndicator: chỉ báo hạn dùng chung cho bảng và thẻ di động", () => {
  const base = { isOverdue: false, isToday: false };

  test("trễ hạn: đỏ, icon overdue, hint 'Trễ N ngày'", () => {
    const r = getDueIndicator({ ...base, isOverdue: true, daysRemaining: -10 });
    assert.deepEqual(r, { tone: "danger", icon: "overdue", hint: "Trễ 10 ngày" });
  });

  test("hôm nay: đỏ, icon mặc định", () => {
    const r = getDueIndicator({ ...base, isToday: true, daysRemaining: 0 });
    assert.deepEqual(r, { tone: "danger", icon: "default", hint: "Hôm nay" });
  });

  test("trong 7 ngày: cam, icon soon; ngoài 7 ngày: xám", () => {
    assert.deepEqual(getDueIndicator({ ...base, daysRemaining: 7 }), {
      tone: "warn",
      icon: "soon",
      hint: "Còn 7 ngày",
    });
    assert.deepEqual(getDueIndicator({ ...base, daysRemaining: 8 }), {
      tone: "muted",
      icon: "default",
      hint: "Còn 8 ngày",
    });
  });

  test("nhiệm vụ đã hoàn thành/hủy luôn xám dù đã trễ hạn", () => {
    const done = getDueIndicator({
      ...base,
      status: "COMPLETED",
      isOverdue: true,
      daysRemaining: -3,
      label: "Đã hoàn thành",
    });
    assert.equal(done.tone, "muted");
    assert.equal(done.icon, "closed");
    assert.equal(done.hint, "Đã hoàn thành");
    assert.equal(getDueIndicator({ ...base, status: "CANCELLED", daysRemaining: 2 }).tone, "muted");
  });

  test("không có hạn: xám, hint rỗng", () => {
    assert.deepEqual(getDueIndicator({ ...base, daysRemaining: null }), {
      tone: "muted",
      icon: "default",
      hint: "",
    });
  });
});

describe("Thanh tóm tắt: số đếm theo nhiệm vụ cha không vượt tổng", () => {
  test("việc con trễ hạn không làm số trễ hạn vượt số nhiệm vụ", () => {
    const parent = (id: string, subDue: string[]): SchoolTask =>
      ({
        id,
        title: id,
        status: "IN_PROGRESS",
        dueDate: "2026-12-31",
        subTasks: subDue.map((d, i) => ({ id: `${id}-s${i}`, title: "sub", status: "IN_PROGRESS", dueDate: d })),
      }) as unknown as SchoolTask;

    const tasks = [parent("a", ["2026-09-01", "2026-09-02", "2026-09-03"]), parent("b", ["2026-09-01"])];
    const counts = computeWorkspaceTabCounts({ scopedTasks: tasks, referenceDate: "2026-09-10" });

    assert.equal(counts.all, 2);
    assert.equal(counts.overdue, 2);
    assert.ok(counts.overdue <= counts.all);
  });
});
