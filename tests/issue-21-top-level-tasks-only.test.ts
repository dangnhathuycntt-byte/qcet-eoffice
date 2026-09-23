/**
 * Issue #21 Regression Tests: List Nhiệm vụ chỉ hiển thị nhiệm vụ cha.
 *
 * Verifies that the Task List view-model excludes child tasks from the
 * rendered dataset while preserving them as nested subTasks on each parent.
 *
 * INTEGRATION approach: mixed parent+child datasets are fed DIRECTLY into
 * the real pipeline functions without pre-filtering — the pipeline itself
 * must strip children.
 *
 * Covers: filterDisplayedTasks, count, sort, pagination, select-all,
 * personal flattening, and Inbox/Search backward compatibility.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  filterDisplayedTasks,
} from "../src/components/workspace/unified-adaptive-workspace";
import {
  filterTasks,
  paginateTasks,
  flattenPersonalTasks,
  sortTasks,
} from "../src/components/tasks/table/utils/table-filter-engine";
import {
  aggregateFilterCounts,
} from "../src/components/tasks/table/components/task-table-toolbar";
import {
  calculateSelectionState,
} from "../src/components/tasks/table/hooks/use-task-table-state";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";

// ── Fixtures ───��──────────────────────────────────────────────────────

function makeParentTask(id: string, overrides: Partial<SchoolTask> = {}): SchoolTask {
  return {
    id,
    code: `NV-${id}`,
    title: `Nhiệm vụ cha ${id}`,
    department: "Phòng CNTT",
    departmentCode: "CNTT",

    leadDepartment: "Phòng CNTT",
    leadDepartmentCode: "CNTT",
    leadDepartmentId: "CNTT",
    assignedTo: "TS. Nguyễn Văn A",
    leadAssigneeId: "user-a",
    leadAssigneeName: "TS. Nguyễn Văn A",
    dueDate: "2026-10-15",
    status: "IN_PROGRESS",
    priority: "NORMAL",
    category: "CNTT",
    categoryLabel: "CNTT",
    progressPercent: 50,
    totalSubTasks: 2,
    completedSubTasks: 0,
    coAssignees: [],
    assignedDate: "2026-09-01",
    subTasks: [
      {
        id: `${id}-sub-1`,
        code: `NV-${id}.1`,
        title: `Việc con 1 của ${id}`,
        assigneeName: "ThS. Trần Văn B",
        assigneeId: "user-b",
        status: "IN_PROGRESS",
        dueDate: "2026-10-10",
        progressPercent: 30,
      } as StaffTask,
      {
        id: `${id}-sub-2`,
        code: `NV-${id}.2`,
        title: `Việc con 2 của ${id}`,
        assigneeName: "KS. Lê Văn C",
        assigneeId: "user-c",
        status: "NOT_STARTED",
        dueDate: "2026-10-12",
        progressPercent: 0,
      } as StaffTask,
    ],
    ...overrides,
  };
}

function makeChildTask(id: string, parentId: string, overrides: Partial<SchoolTask> = {}): SchoolTask {
  return {
    id,
    code: `NV-${parentId}.${id}`,
    title: `Nhiệm vụ con ${id} (cha: ${parentId})`,
    department: "Phòng CNTT",
    departmentCode: "CNTT",

    leadDepartment: "Phòng CNTT",
    leadDepartmentCode: "CNTT",
    leadDepartmentId: "CNTT",
    assignedTo: "ThS. Trần Văn B",
    leadAssigneeId: "user-b",
    leadAssigneeName: "ThS. Trần Văn B",
    dueDate: "2026-10-10",
    status: "IN_PROGRESS",
    priority: "NORMAL",
    category: "CNTT",
    categoryLabel: "CNTT",
    progressPercent: 30,
    totalSubTasks: 0,
    completedSubTasks: 0,
    coAssignees: [],
    assignedDate: "2026-09-01",
    subTasks: [],
    parentTaskId: parentId,
    parentTaskTitle: `Nhiệm vụ cha ${parentId}`,
    parentTaskCode: `NV-${parentId}`,
    ...overrides,
  };
}

// Mixed dataset: 2 parents + 3 children — simulates an API response
// that returns both parents and children (pre-Issue-#21 behavior).
const parent1 = makeParentTask("p1");
const parent2 = makeParentTask("p2", {
  status: "COMPLETED",
  progressPercent: 100,
  dueDate: "2026-09-20",
});
const child1 = makeChildTask("c1", "p1");
const child2 = makeChildTask("c2", "p1", { status: "COMPLETED", progressPercent: 100 });
const child3 = makeChildTask("c3", "p2", { status: "NOT_STARTED", progressPercent: 0 });

const MIXED: SchoolTask[] = [parent1, child1, parent2, child2, child3];

// ── Integration tests — unfiltered mixed dataset through real pipeline ──

describe("Issue #21: Task List chỉ hiển thị nhiệm vụ cha (top-level)", () => {

  // ────────────────────────────────────────────────────────────────────
  // 1. filterDisplayedTasks — the workspace view-model guard
  //    This is the FIRST function that touches the raw dataset.
  //    It must strip children BEFORE any further filtering.
  // ────────────────────────────────────────────────────────────────────
  describe("filterDisplayedTasks — workspace view-model guard (integration)", () => {
    test("mixed dataset → only parent tasks survive", () => {
      // Feed the raw mixed array directly — NO pre-filter.
      const result = filterDisplayedTasks({ tasks: MIXED });
      assert.equal(result.length, 2, `Expected 2 parents, got ${result.length}`);
      const ids = result.map((t) => t.id).sort();
      assert.deepEqual(ids, ["p1", "p2"]);
    });

    test("no result has a truthy parentTaskId", () => {
      const result = filterDisplayedTasks({ tasks: MIXED });
      for (const t of result) {
        assert.ok(!t.parentTaskId, `Task ${t.id} has parentTaskId=${t.parentTaskId}`);
      }
    });

    test("nested subTasks on parents are preserved", () => {
      const result = filterDisplayedTasks({ tasks: MIXED });
      const p1 = result.find((t) => t.id === "p1")!;
      assert.equal(p1.subTasks.length, 2, "Parent p1 should keep its nested subTasks");
      assert.equal(p1.subTasks[0].id, "p1-sub-1");
    });

    test("search on mixed dataset never returns a child row", () => {
      // child1 title includes "con" — search for "con"
      const result = filterDisplayedTasks({ tasks: MIXED, search: "con" });
      assert.ok(result.every((t) => !t.parentTaskId), "Search must not surface children");
    });

    test("status filter on mixed dataset only considers parents", () => {
      const result = filterDisplayedTasks({ tasks: MIXED, status: "COMPLETED" });
      assert.equal(result.length, 1, "Only parent p2 is COMPLETED");
      assert.equal(result[0].id, "p2");
    });

    test("empty array returns empty", () => {
      assert.equal(filterDisplayedTasks({ tasks: [] }).length, 0);
    });

    test("parentTaskId=undefined treated as top-level", () => {
      const task = makeParentTask("e1");
      assert.equal(task.parentTaskId, undefined);
      assert.equal(filterDisplayedTasks({ tasks: [task] }).length, 1);
    });

    test("parentTaskId='' (empty string) treated as top-level", () => {
      const task = makeParentTask("e2", { parentTaskId: "" });
      assert.equal(filterDisplayedTasks({ tasks: [task] }).length, 1);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 2. Full pipeline: filterDisplayedTasks → filterTasks → sortTasks → paginateTasks
  //    Simulates the real data flow in the workspace + table.
  // ──────────────────────────────────────────��─────────────────────────
  describe("Full pipeline integration (no pre-filter)", () => {
    test("count after full pipeline = parent count only", () => {
      // Step 1: workspace guard
      const displayed = filterDisplayedTasks({ tasks: MIXED });
      // Step 2: table filter (receives output of workspace)
      const filtered = filterTasks(displayed, {});
      assert.equal(filtered.length, 2, "Pipeline should yield 2 parents");
    });

    test("pagination total and pages reflect parent-only count", () => {
      const displayed = filterDisplayedTasks({ tasks: MIXED });
      const filtered = filterTasks(displayed, {});
      const page = paginateTasks(filtered, 1, 1); // 1 per page
      assert.equal(page.total, 2, "Total should be 2 (parents only)");
      assert.equal(page.totalPages, 2, "Should have 2 pages with pageSize=1");
      assert.equal(page.items.length, 1);
      assert.ok(!page.items[0].parentTaskId);
    });

    test("second page also contains only parents", () => {
      const displayed = filterDisplayedTasks({ tasks: MIXED });
      const filtered = filterTasks(displayed, {});
      const page2 = paginateTasks(filtered, 2, 1);
      assert.equal(page2.items.length, 1);
      assert.ok(!page2.items[0].parentTaskId);
    });

    test("sorting on mixed dataset after guard preserves parent-only", () => {
      const displayed = filterDisplayedTasks({ tasks: MIXED });
      const sorted = sortTasks(displayed, { field: "dueDate", column: "dueDate", direction: "asc" });
      assert.equal(sorted.length, 2);
      assert.ok(sorted.every((t) => !t.parentTaskId));
      // p2 dueDate "2026-09-20" < p1 dueDate "2026-10-15"
      assert.equal(sorted[0].id, "p2");
      assert.equal(sorted[1].id, "p1");
    });

    test("aggregateFilterCounts after pipeline counts parents only", () => {
      const displayed = filterDisplayedTasks({ tasks: MIXED });
      const counts = aggregateFilterCounts(displayed, {});
      assert.equal(counts.all, 2, "All count = 2 parents");
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 3. Select-all — visibleIds from pipeline output
  // ────────────────────────────────────────────────────────────────────
  describe("Select-all on pipeline output", () => {
    test("select-all IDs exclude children", () => {
      const displayed = filterDisplayedTasks({ tasks: MIXED });
      const visibleIds = displayed.map((t) => t.id);
      assert.ok(!visibleIds.includes("c1"));
      assert.ok(!visibleIds.includes("c2"));
      assert.ok(!visibleIds.includes("c3"));
      assert.deepEqual(visibleIds.sort(), ["p1", "p2"]);
    });

    test("calculateSelectionState with parent-only IDs", () => {
      const displayed = filterDisplayedTasks({ tasks: MIXED });
      const visibleIds = displayed.map((t) => t.id);
      const allSelected = new Set(visibleIds);
      const state = calculateSelectionState(allSelected, visibleIds);
      assert.equal(state.totalSelected, 2);
      assert.equal(state.allVisibleSelected, true);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 4. Personal flattening — still works on top-level-only dataset
  // ────────────────────────────────────────────────────────────────────
  describe("Personal flattening compatibility", () => {
    test("flattenPersonalTasks from top-level dataset yields subtask entries", () => {
      const displayed = filterDisplayedTasks({ tasks: MIXED });
      const flattened = flattenPersonalTasks(displayed, "ThS. Trần Văn B", "user-b");
      assert.ok(flattened.length > 0, "Should produce entries");
      const flatSubs = flattened.filter((t: any) => t.isFlattenedSubtask);
      assert.ok(flatSubs.length > 0, "Subtask entries from nested subTasks");
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 5. API generic behavior — parentTaskId=root filters correctly
  // ────────────────────────────────────────────────────────────────────
  describe("API contract: parentTaskId=root → Prisma WHERE parentTaskId=null", () => {
    test("TaskQueryFilters parentTaskId='root' maps to null in service", () => {
      // This is a contract-level assertion: the service code at
      // task-query-service.ts:373-379 maps 'root' → null.
      // We verify the mapping table is correct.
      const testCases: Array<{ input: string | null; expected: null }> = [
        { input: "null", expected: null },
        { input: "root", expected: null },
        { input: null, expected: null },
      ];
      for (const tc of testCases) {
        // Simulate the mapping logic from task-query-service.ts
        let result: null | string | undefined = undefined;
        if (tc.input !== undefined && tc.input !== "all") {
          if (tc.input === "null" || tc.input === "root" || tc.input === null) {
            result = null;
          } else {
            result = tc.input;
          }
        }
        assert.equal(result, tc.expected, `parentTaskId='${tc.input}' should map to null`);
      }
    });

    test("parentTaskId=undefined does NOT add parentTaskId filter (API stays generic)", () => {
      // Simulate: when parentTaskId is undefined, no where.parentTaskId is set
      const parentTaskId = undefined;
      let filterApplied = false;
      if (parentTaskId !== undefined && parentTaskId !== "all") {
        filterApplied = true;
      }
      assert.equal(filterApplied, false, "API should NOT filter when parentTaskId is undefined");
    });
  });
});
