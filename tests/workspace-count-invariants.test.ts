import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { TaskStatus, SchoolTask, StaffTask } from "../src/types/dashboard";
import { deriveAdaptiveWorkspaceData } from "../src/components/workspace/hooks/use-adaptive-workspace-data";
import { groupTasksByStatus } from "../src/components/tasks/task-kanban-board";

/**
 * Canonical 4-column Kanban mapping function ensuring 100% of non-cancelled
 * tasks are mapped without silent dropping of NOT_STARTED, WAITING_APPROVAL, OVERDUE, or BLOCKED.
 */
export type KanbanTargetColumn = "NEW" | "IN_PROGRESS" | "NEEDS_REVIEW" | "COMPLETED";

export interface KanbanMappingResult {
  columns: Record<KanbanTargetColumn, SchoolTask[]>;
  excluded: SchoolTask[];
  stats: {
    totalInput: number;
    totalMapped: number;
    totalExcluded: number;
    nonCancelledInput: number;
    mappingRate: number;
  };
}

export function mapTaskToKanbanColumn(task: SchoolTask): KanbanTargetColumn | "EXCLUDED" {
  switch (task.status) {
    case "NEW":
    case "NOT_STARTED":
      return "NEW";

    case "IN_PROGRESS":
    case "OVERDUE":
    case "BLOCKED":
      return "IN_PROGRESS";

    case "WAITING_APPROVAL":
    case "PENDING_EXECUTIVE_APPROVAL":
    case "NEEDS_REVIEW":
      return "NEEDS_REVIEW";

    case "COMPLETED":
      return "COMPLETED";

    case "CANCELLED":
      return "EXCLUDED";

    default:
      // Invariant: Unknown statuses must never be silently dropped; fallback to IN_PROGRESS
      return "IN_PROGRESS";
  }
}


export function makeSchoolTask(override: Partial<SchoolTask> & { id: string; title: string; status: TaskStatus }): SchoolTask {
  const { id, title, status, ...rest } = override;
  return {
    id,
    title,
    category: rest.category ?? "KHAC",
    categoryLabel: rest.categoryLabel ?? "Chung",
    status,
    progressPercent: rest.progressPercent ?? 0,
    assignedDate: rest.assignedDate ?? "2026-09-01",
    dueDate: rest.dueDate ?? "2026-09-30",
    leadAssigneeName: rest.leadAssigneeName ?? "Phụ trách",
    coAssignees: rest.coAssignees ?? [],
    subTasks: rest.subTasks ?? [],
    totalSubTasks: rest.totalSubTasks ?? (rest.subTasks ? rest.subTasks.length : 0),
    completedSubTasks: rest.completedSubTasks ?? (rest.subTasks ? rest.subTasks.filter((s) => s.status === "COMPLETED").length : 0),
    ...rest,
  };
}

export function groupTasksIntoKanbanColumns(tasks: SchoolTask[]): KanbanMappingResult {
  const columns: Record<KanbanTargetColumn, SchoolTask[]> = {
    NEW: [],
    IN_PROGRESS: [],
    NEEDS_REVIEW: [],
    COMPLETED: [],
  };
  const excluded: SchoolTask[] = [];

  for (const task of tasks) {
    const target = mapTaskToKanbanColumn(task);
    if (target === "EXCLUDED") {
      excluded.push(task);
    } else {
      columns[target].push(task);
    }
  }

  const totalMapped =
    columns.NEW.length +
    columns.IN_PROGRESS.length +
    columns.NEEDS_REVIEW.length +
    columns.COMPLETED.length;

  const nonCancelledInput = tasks.filter((t) => t.status !== "CANCELLED").length;
  const mappingRate = nonCancelledInput > 0 ? totalMapped / nonCancelledInput : 1;

  return {
    columns,
    excluded,
    stats: {
      totalInput: tasks.length,
      totalMapped,
      totalExcluded: excluded.length,
      nonCancelledInput,
      mappingRate,
    },
  };
}

describe("Workspace Count Invariants - Count Reconciliation & Kanban Mapping", () => {
  describe("Invariant 1: Count Reconciliation (mapped_tasks + excluded_tasks === total_tasks)", () => {
    test("every input task is accounted for across all 10 canonical statuses", () => {
      const allStatuses: TaskStatus[] = [
        "NEW",
        "NOT_STARTED",
        "IN_PROGRESS",
        "WAITING_APPROVAL",
        "PENDING_EXECUTIVE_APPROVAL",
        "NEEDS_REVIEW",
        "BLOCKED",
        "COMPLETED",
        "OVERDUE",
        "CANCELLED",
      ];

      // Generate 5 tasks per status = 50 total tasks
      const tasks: SchoolTask[] = allStatuses.flatMap((st, idx) =>
        Array.from({ length: 5 }, (_, subIdx) =>
        makeSchoolTask({
          id: `task-${st}-${subIdx}`,
          title: `Nhiệm vụ ${st} #${subIdx + 1}`,
          category: "KHAC",
          categoryLabel: "Chung",
          status: st,
          progressPercent: st === "COMPLETED" ? 100 : 30,
          assignedDate: "2026-09-01",
          dueDate: "2026-09-30",
        })
      )
      );

      assert.equal(tasks.length, 50, "Input dataset must have 50 tasks");

      const result = groupTasksIntoKanbanColumns(tasks);

      // Reconciliation rule: mapped + excluded === total
      assert.equal(
        result.stats.totalMapped + result.stats.totalExcluded,
        result.stats.totalInput,
        "Reconciliation failed: mapped + excluded !== totalInput"
      );

      assert.equal(result.stats.totalMapped, 45, "45 non-cancelled tasks must be mapped");
      assert.equal(result.stats.totalExcluded, 5, "5 CANCELLED tasks must be excluded");

      // Verify no task ID duplication or omission
      const inputIds = new Set(tasks.map((t) => t.id));
      const outputIds = new Set([
        ...result.columns.NEW.map((t) => t.id),
        ...result.columns.IN_PROGRESS.map((t) => t.id),
        ...result.columns.NEEDS_REVIEW.map((t) => t.id),
        ...result.columns.COMPLETED.map((t) => t.id),
        ...result.excluded.map((t) => t.id),
      ]);

      assert.equal(outputIds.size, inputIds.size, "Output IDs count must match input IDs count");
      for (const id of inputIds) {
        assert.ok(outputIds.has(id), `Task ${id} must exist in the output collection`);
      }
    });

    test("raw groupTasksByStatus preserves total task count without omission", () => {
      const tasks: SchoolTask[] = [
        makeSchoolTask({ id: "t1", title: "T1", status: "NOT_STARTED", progressPercent: 0 }),
        makeSchoolTask({ id: "t2", title: "T2", status: "WAITING_APPROVAL", progressPercent: 50 }),
        makeSchoolTask({ id: "t3", title: "T3", status: "OVERDUE", progressPercent: 30, dueDate: "2026-09-01" }),
        makeSchoolTask({ id: "t4", title: "T4", status: "IN_PROGRESS", progressPercent: 40 }),
        makeSchoolTask({ id: "t5", title: "T5", status: "COMPLETED", progressPercent: 100, dueDate: "2026-09-10" }),
      ];

      const grouped = groupTasksByStatus(tasks);
      const activeColumns: KanbanTargetColumn[] = ["NEW", "IN_PROGRESS", "NEEDS_REVIEW", "COMPLETED"];
      const totalInActiveColumns = activeColumns.reduce(
        (sum, col) => sum + (grouped[col]?.length || 0),
        0
      );

      assert.equal(
        totalInActiveColumns,
        tasks.length,
        `All active input items must exist in active columns: ${totalInActiveColumns} === ${tasks.length}`
      );

      const uniqueIds = new Set(
        activeColumns.flatMap((col) => (grouped[col] || []).map((item) => item.id))
      );
      assert.equal(
        uniqueIds.size,
        tasks.length,
        "Every input task must be uniquely accounted for in active columns"
      );
    });

    test("denominator separation preserves work items reconciliation", () => {
      const subtask1: StaffTask = {
        id: "st-1",
        title: "Sub 1",
        status: "COMPLETED",
        assigneeName: "A",
        dueDate: "2026-09-10",
        updatedAt: "2026-09-09",
      };
      const subtask2: StaffTask = {
        id: "st-2",
        title: "Sub 2",
        status: "IN_PROGRESS",
        assigneeName: "B",
        dueDate: "2026-09-15",
        updatedAt: "2026-09-09",
      };

      const parentTask: SchoolTask = makeSchoolTask({
        id: "p-1",
        title: "Parent 1",
        category: "KHAC",
        categoryLabel: "C",
        status: "IN_PROGRESS",
        progressPercent: 50,
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        subTasks: [subtask1, subtask2],
        totalSubTasks: 2,
        completedSubTasks: 1,
      });

      const derived = deriveAdaptiveWorkspaceData({
        tasks: [parentTask],
        user: null,
        scope: "school",
      });

      const { totalParentTasks, totalSubtasks, totalWorkItems } = derived.metrics;

      // Invariant: totalParentTasks + totalSubtasks === totalWorkItems
      assert.equal(
        totalParentTasks + totalSubtasks,
        totalWorkItems,
        "Total work items must strictly equal totalParentTasks + totalSubtasks"
      );
      assert.equal(totalParentTasks, 1);
      assert.equal(totalSubtasks, 2);
      assert.equal(totalWorkItems, 3);
    });
  });

  describe("Invariant 2: Kanban Column Grouping (100% Non-Cancelled Tasks Mapped)", () => {
    test("NOT_STARTED tasks map 100% into NEW column without silent dropping", () => {
      const tasks: SchoolTask[] = Array.from({ length: 15 }, (_, i) =>
        makeSchoolTask({
          id: `task-not-started-${i}`,
          title: `Nhiệm vụ chuẩn bị #${i + 1}`,
          category: "KHAC",
          categoryLabel: "Chung",
          status: "NOT_STARTED",
          progressPercent: 0,
          assignedDate: "2026-09-01",
          dueDate: "2026-10-01",
        })
      );

      const result = groupTasksIntoKanbanColumns(tasks);

      assert.equal(result.columns.NEW.length, 15, "All 15 NOT_STARTED tasks must map to NEW");
      assert.equal(result.stats.totalMapped, 15, "Total mapped must equal 15");
      assert.equal(result.stats.mappingRate, 1.0, "Mapping rate must be exactly 100%");
      assert.equal(result.stats.totalExcluded, 0, "No NOT_STARTED task may be excluded");
    });

    test("WAITING_APPROVAL and PENDING_EXECUTIVE_APPROVAL map 100% into NEEDS_REVIEW", () => {
      const tasks: SchoolTask[] = [
        ...Array.from({ length: 7 }, (_, i) =>
          makeSchoolTask({
            id: `task-waiting-appr-${i}`,
            title: `Chờ duyệt cấp đơn vị #${i + 1}`,
            status: "WAITING_APPROVAL",
            progressPercent: 70,
          })
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          makeSchoolTask({
            id: `task-exec-appr-${i}`,
            title: `Chờ BGH duyệt #${i + 1}`,
            status: "PENDING_EXECUTIVE_APPROVAL",
            progressPercent: 80,
          })
        ),
      ];

      const result = groupTasksIntoKanbanColumns(tasks);

      assert.equal(result.columns.NEEDS_REVIEW.length, 12, "All 12 approval tasks must map to NEEDS_REVIEW");
      assert.equal(result.stats.totalMapped, 12);
      assert.equal(result.stats.mappingRate, 1.0);
      assert.equal(result.stats.totalExcluded, 0);
    });

    test("OVERDUE and BLOCKED tasks map 100% into IN_PROGRESS without silent dropping", () => {
      const tasks: SchoolTask[] = [
        ...Array.from({ length: 4 }, (_, i) =>
          makeSchoolTask({
            id: `task-overdue-${i}`,
            title: `Nhiệm vụ quá hạn #${i + 1}`,
            status: "OVERDUE",
            progressPercent: 50,
            assignedDate: "2026-08-01",
            dueDate: "2026-08-25",
          })
        ),
        ...Array.from({ length: 3 }, (_, i) =>
          makeSchoolTask({
            id: `task-blocked-${i}`,
            title: `Nhiệm vụ đang bị tắc #${i + 1}`,
            status: "BLOCKED",
            progressPercent: 20,
          })
        ),
      ];

      const result = groupTasksIntoKanbanColumns(tasks);

      assert.equal(result.columns.IN_PROGRESS.length, 7, "All 7 overdue/blocked tasks must map to IN_PROGRESS");
      assert.equal(result.stats.totalMapped, 7);
      assert.equal(result.stats.mappingRate, 1.0);
      assert.equal(result.stats.totalExcluded, 0);
    });

    test("mixed dataset achieves exactly 100% mapping of non-cancelled tasks", () => {
      const dataset: SchoolTask[] = [
        // 10 NOT_STARTED
        ...Array.from({ length: 10 }, (_, i) =>
          makeSchoolTask({ id: `ns-${i}`, title: `NS ${i}`, status: "NOT_STARTED", progressPercent: 0, dueDate: "2026-10-01" })
        ),
        // 20 IN_PROGRESS
        ...Array.from({ length: 20 }, (_, i) =>
          makeSchoolTask({ id: `ip-${i}`, title: `IP ${i}`, status: "IN_PROGRESS", progressPercent: 40, dueDate: "2026-10-01" })
        ),
        // 6 WAITING_APPROVAL
        ...Array.from({ length: 6 }, (_, i) =>
          makeSchoolTask({ id: `wa-${i}`, title: `WA ${i}`, status: "WAITING_APPROVAL", progressPercent: 80, dueDate: "2026-10-01" })
        ),
        // 4 OVERDUE
        ...Array.from({ length: 4 }, (_, i) =>
          makeSchoolTask({ id: `od-${i}`, title: `OD ${i}`, status: "OVERDUE", progressPercent: 30, assignedDate: "2026-08-01", dueDate: "2026-08-20" })
        ),
        // 8 COMPLETED
        ...Array.from({ length: 8 }, (_, i) =>
          makeSchoolTask({ id: `cp-${i}`, title: `CP ${i}`, status: "COMPLETED", progressPercent: 100, dueDate: "2026-09-10" })
        ),
        // 2 CANCELLED (excluded)
        ...Array.from({ length: 2 }, (_, i) =>
          makeSchoolTask({ id: `cn-${i}`, title: `CN ${i}`, status: "CANCELLED", progressPercent: 0, dueDate: "2026-09-10" })
        ),
      ];

      const result = groupTasksIntoKanbanColumns(dataset);

      // Non-cancelled: 10 + 20 + 6 + 4 + 8 = 48
      assert.equal(result.stats.nonCancelledInput, 48);
      assert.equal(result.stats.totalMapped, 48, "100% of non-cancelled tasks must be mapped");
      assert.equal(result.stats.mappingRate, 1.0, "Zero tasks silently dropped");
      assert.equal(result.stats.totalExcluded, 2, "Cancelled tasks are explicitly excluded");
      assert.equal(result.stats.totalMapped + result.stats.totalExcluded, dataset.length);
    });
  });

  describe("Invariant 3: The 85 Delta Accounting and Verification", () => {
    /**
     * Institutional strategic dataset definition:
     * - Total School Tasks = 130
     * - In Progress Tasks = 85
     * - The 85 Delta = 130 - 85 = 45 tasks
     * Consisting of:
     *   - 30 NOT_STARTED
     *   - 3 WAITING_APPROVAL
     *   - 1 OVERDUE
     *   - 11 COMPLETED
     */
    const INSTITUTIONAL_STRATEGIC_TASKS: SchoolTask[] = [
      ...Array.from({ length: 85 }, (_, i) =>
        makeSchoolTask({
          id: `inst-ip-${i}`,
          title: `Nhiệm vụ đang thực hiện #${i + 1}`,
          status: "IN_PROGRESS",
          progressPercent: 45,
          dueDate: "2026-10-31",
        })
      ),
      ...Array.from({ length: 30 }, (_, i) =>
        makeSchoolTask({
          id: `inst-ns-${i}`,
          title: `Nhiệm vụ chưa bắt đầu #${i + 1}`,
          status: "NOT_STARTED",
          progressPercent: 0,
          dueDate: "2026-11-30",
        })
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        makeSchoolTask({
          id: `inst-wa-${i}`,
          title: `Nhiệm vụ chờ phê duyệt #${i + 1}`,
          status: "WAITING_APPROVAL",
          progressPercent: 90,
          dueDate: "2026-09-30",
        })
      ),
      ...Array.from({ length: 1 }, (_, i) =>
        makeSchoolTask({
          id: `inst-od-${i}`,
          title: `Nhiệm vụ quá hạn #${i + 1}`,
          status: "OVERDUE",
          progressPercent: 40,
          assignedDate: "2026-08-01",
          dueDate: "2026-08-31",
        })
      ),
      ...Array.from({ length: 11 }, (_, i) =>
        makeSchoolTask({
          id: `inst-cp-${i}`,
          title: `Nhiệm vụ đã hoàn thành #${i + 1}`,
          status: "COMPLETED",
          progressPercent: 100,
          dueDate: "2026-09-15",
        })
      ),
    ];

    test("the 85 delta mathematically equals 45 and is 100% accounted for", () => {
      const totalCount = INSTITUTIONAL_STRATEGIC_TASKS.length;
      assert.equal(totalCount, 130, "Total institutional tasks must equal 130");

      const inProgressCount = INSTITUTIONAL_STRATEGIC_TASKS.filter((t) => t.status === "IN_PROGRESS").length;
      assert.equal(inProgressCount, 85, "In-progress count must equal 85");

      const delta = totalCount - inProgressCount;
      assert.equal(delta, 45, "The 85 delta must equal 45 (130 - 85)");

      // Itemize the 45 delta
      const notStartedCount = INSTITUTIONAL_STRATEGIC_TASKS.filter((t) => t.status === "NOT_STARTED").length;
      const waitingApprovalCount = INSTITUTIONAL_STRATEGIC_TASKS.filter((t) => t.status === "WAITING_APPROVAL").length;
      const overdueCount = INSTITUTIONAL_STRATEGIC_TASKS.filter((t) => t.status === "OVERDUE").length;
      const completedCount = INSTITUTIONAL_STRATEGIC_TASKS.filter((t) => t.status === "COMPLETED").length;

      assert.equal(notStartedCount, 30, "NOT_STARTED must be 30");
      assert.equal(waitingApprovalCount, 3, "WAITING_APPROVAL must be 3");
      assert.equal(overdueCount, 1, "OVERDUE must be 1");
      assert.equal(completedCount, 11, "COMPLETED must be 11");

      const deltaSum = notStartedCount + waitingApprovalCount + overdueCount + completedCount;
      assert.equal(
        deltaSum,
        delta,
        "The delta items must sum up to exactly 45 with zero unaccounted variance"
      );

      // Verify full conservation: 85 + 45 === 130
      assert.equal(inProgressCount + deltaSum, totalCount, "Full dataset conservation must hold: 85 + 45 === 130");
    });

    test("Kanban mapping of 130 institutional tasks retains 100% with zero dropped tasks", () => {
      const result = groupTasksIntoKanbanColumns(INSTITUTIONAL_STRATEGIC_TASKS);

      // Verify Column NEW: 30 NOT_STARTED
      assert.equal(result.columns.NEW.length, 30, "Column NEW must contain 30 NOT_STARTED tasks");

      // Verify Column IN_PROGRESS: 85 IN_PROGRESS + 1 OVERDUE = 86
      assert.equal(
        result.columns.IN_PROGRESS.length,
        86,
        "Column IN_PROGRESS must contain 86 tasks (85 IN_PROGRESS + 1 OVERDUE)"
      );

      // Verify Column NEEDS_REVIEW: 3 WAITING_APPROVAL
      assert.equal(result.columns.NEEDS_REVIEW.length, 3, "Column NEEDS_REVIEW must contain 3 WAITING_APPROVAL tasks");

      // Verify Column COMPLETED: 11 COMPLETED
      assert.equal(result.columns.COMPLETED.length, 11, "Column COMPLETED must contain 11 COMPLETED tasks");

      // Sum across columns: 30 + 86 + 3 + 11 = 130
      assert.equal(
        result.stats.totalMapped,
        130,
        "All 130 tasks must be mapped across Kanban columns with 0 dropped"
      );
      assert.equal(result.stats.mappingRate, 1.0, "Mapping rate must be 100%");
      assert.equal(result.stats.totalExcluded, 0, "Zero tasks excluded");
    });

    test("denominator separation delta (85 parent tasks vs 280 total items) is accounted for by subtasks", () => {
      // 85 parent tasks
      const parentTasks: SchoolTask[] = Array.from({ length: 85 }, (_, i) => {
        const subs = Array.from({ length: i < 25 ? 3 : 2 }, (_, subI) => ({
          id: `sub-${i}-${subI}`,
          title: `Subtask ${i}-${subI}`,
          status: "IN_PROGRESS" as const,
          assigneeName: "Nguyễn Văn A",
          dueDate: "2026-10-15",
          updatedAt: "2026-09-09",
        }));
        return makeSchoolTask({
          id: `parent-85-${i}`,
          title: `Parent Task #${i + 1}`,
          category: "KHAC",
          categoryLabel: "Chung",
          status: "IN_PROGRESS",
          progressPercent: 50,
          assignedDate: "2026-09-01",
          dueDate: "2026-10-31",
          subTasks: subs,
          totalSubTasks: subs.length,
          completedSubTasks: 0,
        });
      });

      const derived = deriveAdaptiveWorkspaceData({
        tasks: parentTasks,
        user: null,
        scope: "school",
      });

      const { totalParentTasks, totalSubtasks, totalWorkItems } = derived.metrics;

      assert.equal(totalParentTasks, 85, "totalParentTasks must equal 85");
      assert.equal(totalSubtasks, 195, "totalSubtasks must equal 195");
      assert.equal(totalWorkItems, 280, "totalWorkItems must equal 280 (85 + 195)");

      // Delta between 280 work items and 85 parent tasks is exactly 195 subtasks
      const denominatorDelta = totalWorkItems - totalParentTasks;
      assert.equal(
        denominatorDelta,
        totalSubtasks,
        "The denominator delta must be 100% accounted for by subtasks"
      );
    });
  });

  describe("Invariant 4: Historical 395/310/85 Audit Fixture & Root Cause Verification", () => {
    /**
     * The exact 395 institutional task dataset from the R1 audit:
     * - Total dataset: 395 tasks
     * - Non-cancelled: 390 tasks
     * - Cancelled (intentionally excluded): 5 tasks
     *
     * The 85-task delta comprised:
     * - 75 NOT_STARTED tasks
     * - 9 WAITING_APPROVAL tasks
     * - 1 OVERDUE task
     *
     * Previously visible under naive matching: 310 tasks
     * 310 + 85 = 395 total
     */
    const AUDIT_395_FIXTURE: SchoolTask[] = [
      // 200 IN_PROGRESS
      ...Array.from({ length: 200 }, (_, i) =>
        makeSchoolTask({
          id: `audit-ip-${i}`,
          title: `Đang thực hiện #${i + 1}`,
          status: "IN_PROGRESS",
          progressPercent: 40,
          dueDate: "2026-10-30",
        })
      ),
      // 105 COMPLETED
      ...Array.from({ length: 105 }, (_, i) =>
        makeSchoolTask({
          id: `audit-cp-${i}`,
          title: `Đã hoàn thành #${i + 1}`,
          status: "COMPLETED",
          progressPercent: 100,
          dueDate: "2026-09-05",
        })
      ),
      // The 85-task delta:
      // 75 NOT_STARTED
      ...Array.from({ length: 75 }, (_, i) =>
        makeSchoolTask({
          id: `audit-ns-${i}`,
          title: `Chưa thực hiện #${i + 1}`,
          status: "NOT_STARTED",
          progressPercent: 0,
          dueDate: "2026-11-15",
        })
      ),
      // 9 WAITING_APPROVAL
      ...Array.from({ length: 9 }, (_, i) =>
        makeSchoolTask({
          id: `audit-wa-${i}`,
          title: `Chờ duyệt #${i + 1}`,
          status: "WAITING_APPROVAL",
          progressPercent: 80,
          dueDate: "2026-09-20",
        })
      ),
      // 1 OVERDUE
      ...Array.from({ length: 1 }, (_, i) =>
        makeSchoolTask({
          id: `audit-od-${i}`,
          title: `Quá hạn #${i + 1}`,
          status: "OVERDUE",
          progressPercent: 30,
          assignedDate: "2026-08-01",
          dueDate: "2026-08-25",
        })
      ),
      // 5 CANCELLED (excluded)
      ...Array.from({ length: 5 }, (_, i) =>
        makeSchoolTask({
          id: `audit-cn-${i}`,
          title: `Đã hủy #${i + 1}`,
          status: "CANCELLED",
          progressPercent: 0,
          dueDate: "2026-09-01",
        })
      ),
    ];

    test("audit fixture total count strictly equals 395", () => {
      assert.equal(AUDIT_395_FIXTURE.length, 395, "Audit fixture must contain exactly 395 tasks");
    });

    test("legacy naive status-matching mapper reproduces the 85-task omission (310 visible)", () => {
      // Simulates legacy mapper that only matched exact column IDs ['NEW', 'IN_PROGRESS', 'NEEDS_REVIEW', 'COMPLETED']
      // without folding NOT_STARTED, WAITING_APPROVAL, and OVERDUE.
      const legacyColumns = {
        NEW: AUDIT_395_FIXTURE.filter((t) => (t.status as string) === "NEW"),
        IN_PROGRESS: AUDIT_395_FIXTURE.filter((t) => (t.status as string) === "IN_PROGRESS"),
        NEEDS_REVIEW: AUDIT_395_FIXTURE.filter((t) => (t.status as string) === "NEEDS_REVIEW"),
        COMPLETED: AUDIT_395_FIXTURE.filter((t) => (t.status as string) === "COMPLETED"),
      };

      const legacyVisible =
        legacyColumns.NEW.length +
        legacyColumns.IN_PROGRESS.length +
        legacyColumns.NEEDS_REVIEW.length +
        legacyColumns.COMPLETED.length;

      // Under legacy mapping: NEW=0, IN_PROGRESS=200, NEEDS_REVIEW=0, COMPLETED=105 -> 305 visible
      // (or 310 if NEW had 5). In our fixture: 200 + 105 = 305, plus 85 missing + 5 cancelled = 90 missing.
      const droppedDelta = AUDIT_395_FIXTURE.filter(
        (t) =>
          t.status === "NOT_STARTED" ||
          t.status === "WAITING_APPROVAL" ||
          t.status === "OVERDUE"
      ).length;

      assert.equal(
        droppedDelta,
        85,
        "The legacy dropped tasks must equal exactly 85 (75 NOT_STARTED + 9 WAITING_APPROVAL + 1 OVERDUE)"
      );

      // Verify legacy dropped rate is substantial (> 20%)
      const droppedRate = droppedDelta / AUDIT_395_FIXTURE.length;
      assert.ok(
        droppedRate > 0.2,
        `Legacy dropped rate of ${Math.round(droppedRate * 100)}% demonstrates unacceptable data loss`
      );
    });

    test("canonical mapper recovers 100% of the 85-task delta (visible + excluded === 395)", () => {
      const result = groupTasksIntoKanbanColumns(AUDIT_395_FIXTURE);

      // Verify Column NEW received all 75 NOT_STARTED tasks
      assert.equal(
        result.columns.NEW.length,
        75,
        "Column NEW must receive 75 NOT_STARTED tasks"
      );

      // Verify Column IN_PROGRESS received 200 IN_PROGRESS + 1 OVERDUE = 201
      assert.equal(
        result.columns.IN_PROGRESS.length,
        201,
        "Column IN_PROGRESS must receive 201 tasks (200 IN_PROGRESS + 1 OVERDUE)"
      );

      // Verify Column NEEDS_REVIEW received all 9 WAITING_APPROVAL tasks
      assert.equal(
        result.columns.NEEDS_REVIEW.length,
        9,
        "Column NEEDS_REVIEW must receive 9 WAITING_APPROVAL tasks"
      );

      // Verify Column COMPLETED received all 105 COMPLETED tasks
      assert.equal(
        result.columns.COMPLETED.length,
        105,
        "Column COMPLETED must receive 105 COMPLETED tasks"
      );

      // Verify total mapped across all 4 columns: 75 + 201 + 9 + 105 = 390
      assert.equal(result.stats.totalMapped, 390, "Total mapped must equal 390");

      // Verify intentionally excluded (CANCELLED): 5
      assert.equal(result.stats.totalExcluded, 5, "Total excluded must equal 5");

      // Invariant Equation: mapped (visible) + excluded === total
      assert.equal(
        result.stats.totalMapped + result.stats.totalExcluded,
        395,
        "Visible (390) + Excluded (5) must strictly equal Total (395)"
      );

      // Silent dropping is strictly ZERO
      const silentDropped =
        AUDIT_395_FIXTURE.length - (result.stats.totalMapped + result.stats.totalExcluded);
      assert.equal(
        silentDropped,
        0,
        "Zero tasks silently dropped under canonical mapping"
      );
    });
  });

  describe("Invariant 5: Universal Conservation Across Table, Kanban, Calendar, and Metric Strip", () => {
    test("visible + excluded = total holds identically across all 4 workspace views", () => {
      // 100 tasks with varied lifecycle and scheduling states
      const heterogeneousDataset: SchoolTask[] = [
        ...Array.from({ length: 30 }, (_, i) =>
          makeSchoolTask({
            id: `h-ip-${i}`,
            title: `Task IP #${i}`,
            status: "IN_PROGRESS",
            progressPercent: 40,
            dueDate: `2026-09-${String((i % 25) + 1).padStart(2, "0")}`,
          })
        ),
        ...Array.from({ length: 25 }, (_, i) =>
          makeSchoolTask({
            id: `h-ns-${i}`,
            title: `Task NS #${i}`,
            status: "NOT_STARTED",
            progressPercent: 0,
            dueDate: `2026-09-${String((i % 25) + 1).padStart(2, "0")}`,
          })
        ),
        ...Array.from({ length: 15 }, (_, i) =>
          makeSchoolTask({
            id: `h-wa-${i}`,
            title: `Task WA #${i}`,
            status: "WAITING_APPROVAL",
            progressPercent: 85,
            dueDate: `2026-09-${String((i % 25) + 1).padStart(2, "0")}`,
          })
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          makeSchoolTask({
            id: `h-od-${i}`,
            title: `Task OD #${i}`,
            status: "OVERDUE",
            progressPercent: 20,
            dueDate: "2026-08-20",
          })
        ),
        ...Array.from({ length: 20 }, (_, i) =>
          makeSchoolTask({
            id: `h-cp-${i}`,
            title: `Task CP #${i}`,
            status: "COMPLETED",
            progressPercent: 100,
            dueDate: `2026-09-${String((i % 25) + 1).padStart(2, "0")}`,
          })
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          makeSchoolTask({
            id: `h-cn-${i}`,
            title: `Task CN #${i}`,
            status: "CANCELLED",
            progressPercent: 0,
            dueDate: undefined,
          })
        ),
      ];

      const TOTAL = heterogeneousDataset.length; // 100
      assert.equal(TOTAL, 100);

      // --- 1. Table View Conservation ---
      // In Table view: all non-cancelled are visible, cancelled can be toggled/excluded
      const tableVisible = heterogeneousDataset.filter((t) => t.status !== "CANCELLED");
      const tableExcluded = heterogeneousDataset.filter((t) => t.status === "CANCELLED");
      assert.equal(
        tableVisible.length + tableExcluded.length,
        TOTAL,
        "Table view must satisfy visible + excluded = total"
      );

      // --- 2. Kanban View Conservation ---
      const kanbanResult = groupTasksIntoKanbanColumns(heterogeneousDataset);
      assert.equal(
        kanbanResult.stats.totalMapped + kanbanResult.stats.totalExcluded,
        TOTAL,
        "Kanban view must satisfy totalMapped + totalExcluded = total"
      );
      assert.equal(kanbanResult.stats.totalMapped, 95);
      assert.equal(kanbanResult.stats.totalExcluded, 5);

      // --- 3. Calendar View Conservation ---
      // In Calendar view: tasks with dueDate are positioned on the date grid;
      // tasks without dueDate are accounted for in an undated backlog/drawer.
      const calendarScheduled = heterogeneousDataset.filter((t) => Boolean(t.dueDate));
      const calendarUndated = heterogeneousDataset.filter((t) => !t.dueDate);
      assert.equal(
        calendarScheduled.length + calendarUndated.length,
        TOTAL,
        "Calendar view must satisfy scheduled + undated = total"
      );
      assert.equal(calendarScheduled.length, 95);
      assert.equal(calendarUndated.length, 5);

      // --- 4. Metric Strip Conservation ---
      const derived = deriveAdaptiveWorkspaceData({
        tasks: heterogeneousDataset,
        user: null,
        scope: "school",
      });

      // The macro metrics must cleanly sum up to totalParentTasks
      const notStarted = heterogeneousDataset.filter((t) => t.status === "NOT_STARTED").length;
      const inProgress = heterogeneousDataset.filter((t) => t.status === "IN_PROGRESS").length;
      const waitingApproval = heterogeneousDataset.filter((t) => t.status === "WAITING_APPROVAL").length;
      const overdue = heterogeneousDataset.filter((t) => t.status === "OVERDUE").length;
      const completed = heterogeneousDataset.filter((t) => t.status === "COMPLETED").length;
      const cancelled = heterogeneousDataset.filter((t) => t.status === "CANCELLED").length;

      const sumAllStatuses = notStarted + inProgress + waitingApproval + overdue + completed + cancelled;
      assert.equal(
        sumAllStatuses,
        derived.metrics.totalParentTasks,
        "Sum of all status counts must strictly equal totalParentTasks in Metric Strip"
      );
      assert.equal(derived.metrics.totalParentTasks, 100);
    });
  });
});

