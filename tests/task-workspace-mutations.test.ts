import test from "node:test";
import assert from "node:assert/strict";
import { applyOptimisticTaskPatch } from "../src/components/workspace/utils/task-workspace-mutations";
import type { SchoolTask } from "../src/types/dashboard";

const tasks = [
  { id: "t1", priority: "NORMAL", dueDate: "2026-10-20", subTasks: [{ id: "s1", priority: "LOW", dueDate: "2026-10-18" }] },
  { id: "t2", priority: "HIGH", dueDate: "2026-10-25", subTasks: [] },
] as unknown as SchoolTask[];

test("áp patch lên nhiệm vụ cha, giữ nguyên nhiệm vụ khác", () => {
  const next = applyOptimisticTaskPatch(tasks, "t1", { priority: "URGENT" });
  assert.equal(next[0].priority, "URGENT");
  assert.equal(next[1], tasks[1]);
  assert.equal(tasks[0].priority, "NORMAL", "không sửa dữ liệu gốc");
});

test("áp subTaskPatch lên nhiệm vụ con, không đổi cha", () => {
  const next = applyOptimisticTaskPatch(tasks, "s1", { priority: "URGENT" }, { dueDate: "2026-11-01" });
  assert.equal(next[0].priority, "NORMAL");
  assert.equal((next[0].subTasks[0] as { dueDate: string }).dueDate, "2026-11-01");
});

test("rollback bằng giá trị cũ trả đúng nhiệm vụ về trạng thái trước", () => {
  const edited = applyOptimisticTaskPatch(tasks, "t2", { dueDate: "2026-12-01" });
  const rolledBack = applyOptimisticTaskPatch(edited, "t2", { dueDate: "2026-10-25" });
  assert.equal(rolledBack[1].dueDate, "2026-10-25");
});
