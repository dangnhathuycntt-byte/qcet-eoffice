import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  TASK_TABS,
  isUnfinishedTask,
  matchesTaskTab,
  parseTaskTab,
  resolveTaskTab,
} from "@qcet/shared/domain/tasks/task-tabs";
import { parseWorkspaceQuery, serializeWorkspaceQuery } from "../src/lib/workspace-query";
import { filterDisplayedTasks } from "../src/components/workspace/unified-adaptive-workspace";

describe("view trang Nhiệm vụ", () => {
  test("có đủ 4 view theo thứ tự và dùng thuật ngữ 'Trễ hạn'", () => {
    assert.deepEqual(
      TASK_TABS.map((t) => t.label),
      ["Tất cả", "Đang thực hiện", "Trễ hạn", "Hoàn thành"]
    );
  });

  test("parseTaskTab chỉ nhận giá trị hợp lệ", () => {
    assert.equal(parseTaskTab("active"), "active");
    assert.equal(parseTaskTab("all"), "all");
    assert.equal(parseTaskTab("quá hạn"), undefined);
    assert.equal(parseTaskTab(undefined), undefined);
  });

  test("view mặc định chỉ áp khi URL sạch", () => {
    assert.equal(resolveTaskTab({ hasOtherLifecycleFilters: false, defaultTab: "active" }), "active");
    assert.equal(resolveTaskTab({ hasOtherLifecycleFilters: false }), "all", "trang không khai báo mặc định thì không lọc");
    assert.equal(
      resolveTaskTab({ hasOtherLifecycleFilters: true, defaultTab: "active" }),
      "all",
      "liên kết sâu (vd ?status=completed) không bị view mặc định che"
    );
    assert.equal(resolveTaskTab({ param: "done", hasOtherLifecycleFilters: true, defaultTab: "active" }), "done");
    assert.equal(resolveTaskTab({ param: "all", hasOtherLifecycleFilters: false, defaultTab: "active" }), "all");
  });

  test("Đang thực hiện = mọi việc chưa hoàn thành và chưa hủy", () => {
    for (const status of ["NOT_STARTED", "IN_PROGRESS", "WAITING_APPROVAL", "PENDING_EXECUTIVE_APPROVAL"]) {
      assert.equal(isUnfinishedTask({ status }), true, status);
    }
    assert.equal(isUnfinishedTask({ status: "COMPLETED" }), false);
    assert.equal(isUnfinishedTask({ status: "CANCELLED" }), false);
  });

  test("matchesTaskTab: trễ hạn dùng đúng định nghĩa do nơi gọi cấp; Đang thực hiện không chứa việc trễ", () => {
    const overdue = { status: "IN_PROGRESS", late: true };
    const onTime = { status: "NOT_STARTED", late: false };
    const done = { status: "COMPLETED", late: false };
    const isOverdue = (t: { late: boolean }) => t.late;

    assert.deepEqual([overdue, onTime, done].filter((t) => matchesTaskTab(t, "all", isOverdue)).length, 3);
    assert.deepEqual([overdue, onTime, done].filter((t) => matchesTaskTab(t, "active", isOverdue)), [onTime]);
    assert.deepEqual([overdue, onTime, done].filter((t) => matchesTaskTab(t, "overdue", isOverdue)), [overdue]);
    assert.deepEqual([overdue, onTime, done].filter((t) => matchesTaskTab(t, "done", isOverdue)), [done]);
  });

  test("taskTab đi qua URL và bỏ giá trị lạ", () => {
    assert.equal(parseWorkspaceQuery("?taskTab=overdue").taskTab, "overdue");
    assert.equal(parseWorkspaceQuery("?taskTab=quahan").taskTab, undefined);
    assert.equal(parseWorkspaceQuery("").taskTab, undefined);
    assert.equal(serializeWorkspaceQuery({ taskTab: "done" }).get("taskTab"), "done");
    assert.equal(serializeWorkspaceQuery({}).has("taskTab"), false);
  });

  test("filterDisplayedTasks áp view làm tập nền, 'Trễ hạn' khớp bộ lọc thời hạn trễ hạn", () => {
    const refDate = "2026-09-26";
    const tasks = [
      { id: "new", title: "a", status: "NOT_STARTED", dueDate: "2026-10-30" },
      { id: "late", title: "b", status: "IN_PROGRESS", dueDate: "2026-09-20" },
      { id: "done", title: "c", status: "COMPLETED", dueDate: "2026-09-10" },
      { id: "cancel", title: "d", status: "CANCELLED", dueDate: "2026-09-10" },
    ] as any[];
    const ids = (taskTab?: any, deadline?: string) =>
      filterDisplayedTasks({ tasks, taskTab, deadline, referenceDate: refDate }).map((t) => t.id);

    assert.deepEqual(ids("all"), ["new", "late", "done", "cancel"]);
    assert.deepEqual(ids("active"), ["new"], "chưa hoàn thành và chưa trễ, gồm cả việc Mới");
    assert.deepEqual(ids("done"), ["done"]);
    assert.deepEqual(ids("overdue"), ids(undefined, "overdue"), "view Trễ hạn = bộ lọc thời hạn Trễ hạn");
    assert.deepEqual(ids("overdue"), ["late"]);
  });
});
