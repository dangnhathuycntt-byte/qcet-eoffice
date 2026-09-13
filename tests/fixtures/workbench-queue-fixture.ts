/**
 * T02 — Workbench queue fixture with HAND-WRITTEN expected results.
 *
 * Plan: docs/plans/active/qcet-workbench-uiux-agent-execution-plan.md §5 (T02).
 *
 * Rules this file obeys:
 *  - Expected IDs are written by hand from the table in the plan. They are NEVER
 *    produced by calling the selector under test (that would make the assertion
 *    circular).
 *  - Only real schema shapes are used. `Task.dueDate` is `DateTime`
 *    (prisma/schema.prisma:217) and there is no `Subtask` model — subtasks are
 *    `Task` rows linked by `parentTaskId`. The fixture mirrors that.
 *  - No production enum value is invented.
 *
 * Business reference date D = 2026-09-13 (the plan's stated D, ICT).
 */

import type { SchoolTask, StaffTask } from "../../src/types/dashboard";

/** D — the business reference date every expectation below is written against. */
export const FIXTURE_REFERENCE_DATE = "2026-09-13";

/** Calendar-day offsets from D, written out literally so the table is readable. */
export const D = {
  minus3: "2026-09-10",
  minus2: "2026-09-11",
  minus1: "2026-09-12",
  today: "2026-09-13",
  plus1: "2026-09-14",
  plus2: "2026-09-15",
  plus3: "2026-09-16",
  plus6: "2026-09-19",
  plus7: "2026-09-20",
  /** Beyond the upcoming window — used by the scale fixture's action rows. */
  plus10: "2026-09-23",
};

function baseSchoolTask(overrides: Partial<SchoolTask> & { id: string; title: string }): SchoolTask {
  return {
    category: "KHAC",
    categoryLabel: "Khác",
    status: "IN_PROGRESS",
    dueDate: D.plus3,
    progressPercent: 0,
    totalSubTasks: 0,
    completedSubTasks: 0,
    leadAssigneeName: "Nguyễn Văn A",
    coAssignees: [],
    assignedDate: "2026-09-01",
    subTasks: [],
    ...overrides,
  };
}

function baseStaffTask(overrides: Partial<StaffTask> & { id: string; title: string }): StaffTask {
  return {
    assigneeName: "Trần Thị B",
    status: "IN_PROGRESS",
    dueDate: D.plus3,
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Small fixture — q01..q14, one row per expected-behaviour clause in the plan.
// ---------------------------------------------------------------------------

export const Q01_IN_PROGRESS_NO_REASON = baseSchoolTask({
  id: "q01",
  title: "q01 — đang thực hiện bình thường",
  status: "IN_PROGRESS",
  progressPercent: 40,
  priority: "NORMAL",
  dueDate: D.plus3,
  leadDepartmentCode: "K_CNTT",
});

export const Q02_PROGRESS_100_NOT_SUBMITTED = baseSchoolTask({
  id: "q02",
  title: "q02 — tiến độ 100% nhưng chưa gửi yêu cầu xem xét",
  status: "IN_PROGRESS",
  progressPercent: 100,
  priority: "HIGH",
  dueDate: D.plus3,
  leadDepartmentCode: "K_CNTT",
});

export const Q03_REVIEW_DUE_TOMORROW = baseSchoolTask({
  id: "q03",
  title: "q03 — hồ sơ đang chờ xem xét, hạn ngày mai",
  status: "PENDING_EXECUTIVE_APPROVAL",
  progressPercent: 100,
  priority: "NORMAL",
  dueDate: D.plus1,
  leadDepartmentCode: "P_DTQLKH",
});

export const Q04_REVIEW_AND_OVERDUE = baseSchoolTask({
  id: "q04",
  title: "q04 — hồ sơ chờ xem xét đã quá hạn",
  status: "PENDING_EXECUTIVE_APPROVAL",
  progressPercent: 100,
  priority: "HIGH",
  dueDate: D.minus1,
  leadDepartmentCode: "P_HCQT",
});

export const Q05_BLOCKED_HIGH = baseSchoolTask({
  id: "q05",
  title: "q05 — vướng mắc, ưu tiên cao",
  status: "BLOCKED",
  progressPercent: 30,
  priority: "HIGH",
  dueDate: D.plus2,
  leadDepartmentCode: "K_KTCN",
});

export const Q06_OVERDUE_URGENT = baseSchoolTask({
  id: "q06",
  title: "q06 — quá hạn, ưu tiên khẩn cấp",
  status: "IN_PROGRESS",
  progressPercent: 55,
  priority: "URGENT",
  dueDate: D.minus3,
  leadDepartmentCode: "K_KTQT",
});

export const Q07_COMPLETED_PAST_DUE = baseSchoolTask({
  id: "q07",
  title: "q07 — đã hoàn thành, hạn đã qua",
  status: "COMPLETED",
  progressPercent: 100,
  priority: "NORMAL",
  dueDate: D.minus2,
  leadDepartmentCode: "K_CNTT",
});

export const Q08_CANCELLED_PAST_DUE = baseSchoolTask({
  id: "q08",
  title: "q08 — đã hủy, hạn đã qua",
  status: "CANCELLED",
  progressPercent: 0,
  priority: "NORMAL",
  dueDate: D.minus2,
  leadDepartmentCode: "K_CNTT",
});

/** No usable deadline. Must NOT be coerced to "today". */
export const Q09_NO_VALID_DEADLINE = baseSchoolTask({
  id: "q09",
  title: "q09 — hạn không hợp lệ",
  status: "IN_PROGRESS",
  progressPercent: 10,
  priority: "NORMAL",
  dueDate: "khong-phai-ngay",
  leadDepartmentCode: "K_CNTT",
});

/** A non-existent calendar date (30 February). Must be treated as missing, not parsed. */
export const Q09B_IMPOSSIBLE_CALENDAR_DATE = baseSchoolTask({
  id: "q09b",
  title: "q09b — ngày không tồn tại trên lịch",
  status: "IN_PROGRESS",
  progressPercent: 10,
  priority: "NORMAL",
  dueDate: "2026-02-30",
  leadDepartmentCode: "K_CNTT",
});

/** Lives in a department the actor cannot reach — must be absent from actor-scoped output. */
export const Q10_FOREIGN_DEPARTMENT = baseSchoolTask({
  id: "q10",
  title: "q10 — đơn vị ngoài phạm vi truy cập",
  status: "BLOCKED",
  progressPercent: 0,
  priority: "URGENT",
  dueDate: D.minus3,
  leadDepartmentCode: "P_CTHSSV",
  leadDepartmentId: "P_CTHSSV",
});

/** Subtask awaiting review, but the actor is not the designated approver for that step. */
export const Q11_SUBTASK_REVIEW_NOT_MINE = baseSchoolTask({
  id: "q11",
  title: "q11 — nhiệm vụ có việc con chờ thẩm định cấp đơn vị",
  status: "IN_PROGRESS",
  progressPercent: 20,
  priority: "NORMAL",
  dueDate: D.plus3,
  leadDepartmentCode: "K_CNTT",
  subTasks: [
    baseStaffTask({
      id: "q11-sub",
      title: "q11-sub — việc con chờ thẩm định L1",
      status: "NEEDS_REVIEW",
      dueDate: D.plus2,
      departmentCode: "K_CNTT",
    }),
  ],
});

export const Q12_DUE_PLUS6 = baseSchoolTask({
  id: "q12",
  title: "q12 — hạn trong 6 ngày tới",
  status: "IN_PROGRESS",
  progressPercent: 70,
  priority: "NORMAL",
  dueDate: D.plus6,
  leadDepartmentCode: "TT_NNTH",
});

export const Q13_DUE_PLUS7 = baseSchoolTask({
  id: "q13",
  title: "q13 — hạn ở ngày thứ 7, ngoài cửa sổ",
  status: "IN_PROGRESS",
  progressPercent: 60,
  priority: "NORMAL",
  dueDate: D.plus7,
  leadDepartmentCode: "TT_NNTH",
});

export const Q14_DUE_TODAY = baseSchoolTask({
  id: "q14",
  title: "q14 — hạn đúng hôm nay, chưa quá hạn",
  status: "IN_PROGRESS",
  progressPercent: 80,
  priority: "HIGH",
  dueDate: D.today,
  leadDepartmentCode: "P_KTDBCL",
});

export const SMALL_FIXTURE_TASKS: SchoolTask[] = [
  Q01_IN_PROGRESS_NO_REASON,
  Q02_PROGRESS_100_NOT_SUBMITTED,
  Q03_REVIEW_DUE_TOMORROW,
  Q04_REVIEW_AND_OVERDUE,
  Q05_BLOCKED_HIGH,
  Q06_OVERDUE_URGENT,
  Q07_COMPLETED_PAST_DUE,
  Q08_CANCELLED_PAST_DUE,
  Q09_NO_VALID_DEADLINE,
  Q09B_IMPOSSIBLE_CALENDAR_DATE,
  Q10_FOREIGN_DEPARTMENT,
  Q11_SUBTASK_REVIEW_NOT_MINE,
  Q12_DUE_PLUS6,
  Q13_DUE_PLUS7,
  Q14_DUE_TODAY,
];

/**
 * HAND-WRITTEN expectation for the executive action queue over SMALL_FIXTURE_TASKS.
 * Derived from the plan's q-table, not from running the selector.
 *
 *  - q01 no reason              -> absent
 *  - q02 progress 100, no request -> absent  (progress is not a review request)
 *  - q03 pending review         -> REVIEW
 *  - q04 pending review + past due -> REVIEW + OVERDUE (ONE row, TWO reasons)
 *  - q05 blocked                -> BLOCKED
 *  - q06 past due               -> OVERDUE
 *  - q07 completed              -> absent
 *  - q08 cancelled              -> absent
 *  - q09 / q09b no valid date   -> absent (not overdue, not upcoming)
 *  - q10 foreign department     -> excluded by the actor-scoped task list, not by this selector
 *  - q11 subtask NEEDS_REVIEW   -> REVIEW, but the row must NOT claim the actor is the approver
 *  - q12..q14                   -> no reason, so absent from the queue (they are upcoming, not actions)
 */
export const EXPECTED_QUEUE_ROWS: Array<{
  taskId: string;
  reasons: Array<"REVIEW" | "BLOCKED" | "OVERDUE">;
  primaryReason: "REVIEW" | "BLOCKED" | "OVERDUE";
}> = [
  { taskId: "q06", reasons: ["OVERDUE"], primaryReason: "OVERDUE" },
  { taskId: "q04", reasons: ["REVIEW", "OVERDUE"], primaryReason: "REVIEW" },
  { taskId: "q03", reasons: ["REVIEW"], primaryReason: "REVIEW" },
  { taskId: "q11", reasons: ["REVIEW"], primaryReason: "REVIEW" },
  { taskId: "q05", reasons: ["BLOCKED"], primaryReason: "BLOCKED" },
];

/**
 * HAND-WRITTEN sort expectation, per plan T04.6:
 * priority desc -> overdue first -> due asc -> waitingSince asc -> taskId.
 *
 *  q06 URGENT overdue  (rank 1 priority, overdue)   -> first
 *  q04 HIGH   overdue  (rank 2 priority, overdue)   -> second
 *  q05 HIGH   blocked  (rank 2 priority, not overdue, due D+2)
 *  q03 NORMAL overdue? no — due D+1, not overdue
 *  q11 NORMAL not overdue, due D+3
 *
 * Between q05 (HIGH, not overdue) and q04 (HIGH, overdue): overdue wins, so q04 before q05.
 */
export const EXPECTED_QUEUE_ORDER = ["q06", "q04", "q05", "q03", "q11"];

/**
 * HAND-WRITTEN expectation for the upcoming-deadline window [D, D+6].
 *  - q14 due D      -> included, NOT overdue
 *  - q12 due D+6    -> included
 *  - q13 due D+7    -> excluded (outside window)
 *  - q03 due D+1    -> included
 *  - q05 due D+2    -> included
 *  - q01/q02 due D+3 -> included
 *  - q11 due D+3    -> included
 *  - q04/q06 past due -> EXCLUDED (overdue never appears in upcoming)
 *  - q07 completed, q08 cancelled -> excluded
 *  - q09/q09b invalid date -> excluded
 */
export const EXPECTED_UPCOMING_ORDER = [
  "q14", // due D    HIGH
  "q03", // due D+1  NORMAL
  "q05", // due D+2  HIGH
  "q02", // due D+3  HIGH   (tie with q01/q11 broken by priority desc)
  "q01", // due D+3  NORMAL
  "q11", // due D+3  NORMAL (tie with q01 broken by id asc)
  "q12", // due D+6  NORMAL
];

/** Upcoming IDs that MUST be present. */
export const EXPECTED_UPCOMING_PRESENT = EXPECTED_UPCOMING_ORDER;

/** Upcoming IDs that MUST be absent, and why. */
export const EXPECTED_UPCOMING_ABSENT = [
  "q04", // overdue
  "q06", // overdue
  "q07", // completed
  "q08", // cancelled
  "q09", // invalid date
  "q09b", // impossible calendar date
  "q13", // D+7, outside the window
  "q10", // foreign department — not in the actor-scoped task list
];

// ---------------------------------------------------------------------------
// Departments — exactly 7 with a real problem, 10 without, one of which has 0 tasks.
// Expected attention count is 7; attention preview is the top 5 of those 7.
// ---------------------------------------------------------------------------

export interface FixtureDepartmentStats {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  totalTasksCount: number;
  completedTasksCount: number;
  inProgressTasksCount: number;
  blockedTasksCount: number;
  overdueTasksCount: number;
  averageProgressPercent: number;
  completionRate: number;
  parentTasksCount: number;
  completedParentTasksCount: number;
  inProgressParentTasksCount: number;
  blockedParentTasksCount: number;
  overdueParentTasksCount: number;
  subTasksCount: number;
  completedSubTasksCount: number;
  inProgressSubTasksCount: number;
  blockedSubTasksCount: number;
  overdueSubTasksCount: number;
}

function dept(
  departmentId: string,
  departmentName: string,
  init: {
    total?: number;
    completed?: number;
    inProgress?: number;
    blocked?: number;
    overdue?: number;
    percent?: number;
  } = {}
): FixtureDepartmentStats {
  const total = init.total ?? 0;
  const completed = init.completed ?? 0;
  const inProgress = init.inProgress ?? 0;
  const blocked = init.blocked ?? 0;
  const overdue = init.overdue ?? 0;
  return {
    departmentId,
    departmentCode: departmentId,
    departmentName,
    totalTasksCount: total,
    completedTasksCount: completed,
    inProgressTasksCount: inProgress,
    blockedTasksCount: blocked,
    overdueTasksCount: overdue,
    averageProgressPercent: init.percent ?? 0,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    parentTasksCount: total,
    completedParentTasksCount: completed,
    inProgressParentTasksCount: inProgress,
    blockedParentTasksCount: blocked,
    overdueParentTasksCount: overdue,
    subTasksCount: 0,
    completedSubTasksCount: 0,
    inProgressSubTasksCount: 0,
    blockedSubTasksCount: 0,
    overdueSubTasksCount: 0,
  };
}

/**
 * 17 departments. Exactly SEVEN carry a real problem signal
 * (overdue > 0 or blocked > 0). The other ten do not.
 *
 * Deliberately included to kill the old `<60%` progress threshold:
 *  - "D_HIGH_PROGRESS_CLEAN" is 95% with zero overdue/blocked -> NOT attention
 *  - "D_LOW_PROGRESS_CLEAN"  is 10% with zero overdue/blocked -> NOT attention
 *    (low progress alone is not a risk signal; the old code called this one)
 */
export const FIXTURE_DEPARTMENTS: FixtureDepartmentStats[] = [
  // --- 7 departments WITH a real problem ---
  dept("A_OVERDUE_MOST", "Đơn vị quá hạn nhiều", { total: 20, completed: 4, inProgress: 12, overdue: 4, percent: 41 }),
  dept("B_BLOCKED_AND_OVERDUE", "Đơn vị vừa vướng vừa trễ", { total: 12, completed: 3, inProgress: 6, blocked: 3, overdue: 2, percent: 38 }),
  dept("C_BLOCKED_MOST", "Đơn vị vướng mắc nhiều", { total: 15, completed: 5, inProgress: 7, blocked: 3, percent: 44 }),
  dept("D_OVERDUE_MODERATE", "Đơn vị trễ hạn vừa", { total: 9, completed: 4, inProgress: 4, overdue: 1, percent: 55 }),
  dept("E_BLOCKED_ONE", "Đơn vị có một việc vướng", { total: 7, completed: 3, inProgress: 3, blocked: 1, percent: 61 }),
  dept("F_OVERDUE_ONE", "Đơn vị có một việc trễ", { total: 6, completed: 2, inProgress: 3, overdue: 1, percent: 48 }),
  dept("G_OVERDUE_AND_BLOCKED_SMALL", "Đơn vị nhỏ có vấn đề", { total: 3, completed: 0, inProgress: 1, blocked: 1, overdue: 1, percent: 20 }),

  // --- 10 departments WITHOUT a problem ---
  dept("H_HIGH_PROGRESS_CLEAN", "Đơn vị tiến độ cao, không vấn đề", { total: 18, completed: 17, inProgress: 1, percent: 95 }),
  dept("I_LOW_PROGRESS_CLEAN", "Đơn vị tiến độ thấp nhưng không vấn đề", { total: 10, completed: 1, inProgress: 9, percent: 10 }),
  dept("J_MID_PROGRESS_CLEAN", "Đơn vị tiến độ trung bình", { total: 14, completed: 7, inProgress: 7, percent: 50 }),
  dept("K_NO_TASKS", "Đơn vị chưa có nhiệm vụ nào", { total: 0, percent: 0 }),
  dept("L_ALL_COMPLETED", "Đơn vị hoàn thành toàn bộ", { total: 8, completed: 8, percent: 100 }),
  dept("M_JUST_STARTED", "Đơn vị mới bắt đầu", { total: 5, completed: 0, inProgress: 5, percent: 4 }),
  dept("N_STEADY", "Đơn vị đang đều tiến độ", { total: 11, completed: 5, inProgress: 6, percent: 62 }),
  dept("O_ALMOST_DONE", "Đơn vị gần hoàn tất", { total: 9, completed: 8, inProgress: 1, percent: 91 }),
  dept("P_FRESH_BLOCK_FREE", "Đơn vị không vướng", { total: 4, completed: 1, inProgress: 3, percent: 33 }),
  dept("Q_TINY_CLEAN", "Đơn vị nhỏ không vấn đề", { total: 1, completed: 0, inProgress: 1, percent: 25 }),
];

export const EXPECTED_DEPARTMENT_TOTALS = {
  /** Every department in scope. */
  all: 17,
  /** Departments with overdue > 0 or blocked > 0 — NOT a progress threshold. */
  attention: 7,
  /** Preview cap. */
  preview: 5,
} as const;

/** Hand-written attention set, in the plan's required sort order. */
export const EXPECTED_ATTENTION_ORDER = [
  "A_OVERDUE_MOST", // overdue 4, blocked 0
  "B_BLOCKED_AND_OVERDUE", // overdue 2, blocked 3
  "G_OVERDUE_AND_BLOCKED_SMALL", // overdue 1, blocked 1
  "D_OVERDUE_MODERATE", // overdue 1, blocked 0
  "F_OVERDUE_ONE", // overdue 1, blocked 0  (tie with D broken by id asc)
  "C_BLOCKED_MOST", // overdue 0, blocked 3
  "E_BLOCKED_ONE", // overdue 0, blocked 1
];

/**
 * The departments that must NEVER be reported as needing attention, even though
 * their progress is low. This is the regression guard for the removed `<60%` rule.
 */
export const EXPECTED_NOT_ATTENTION = [
  "I_LOW_PROGRESS_CLEAN", // 10%
  "M_JUST_STARTED", // 4%
  "Q_TINY_CLEAN", // 25%
  "P_FRESH_BLOCK_FREE", // 33%
  "J_MID_PROGRESS_CLEAN", // 50%
  "K_NO_TASKS", // 0 tasks, 0%
];

// ---------------------------------------------------------------------------
// Large fixture — the plan's scale case: 311 action rows, 20 upcoming rows.
// ---------------------------------------------------------------------------

export interface LargeFixture {
  tasks: SchoolTask[];
  /** Hand-written count checks. */
  expectedActionRowCount: number;
  expectedUpcomingCount: number;
  expectedPreviewCount: number;
}

const LONG_VIETNAMESE_TITLES = [
  "Xây dựng và ban hành quy chế phối hợp liên đơn vị trong công tác tuyển sinh và truyền thông tuyển sinh năm học mới",
  "Rà soát, cập nhật toàn bộ quy trình nghiệp vụ tiếp nhận hồ sơ và xử lý văn bản đến theo quy định hiện hành của nhà trường",
  "Tổ chức đánh giá giữa kỳ chất lượng đào tạo các ngành trọng điểm và đề xuất phương án điều chỉnh chương trình",
  "Triển khai kế hoạch chuyển đổi số toàn diện giai đoạn tiếp theo bao gồm hạ tầng, dữ liệu và năng lực số của viên chức",
];

const DEPT_CODES = [
  "K_CNTT",
  "P_DTQLKH",
  "TT_STT",
  "P_HCQT",
  "P_KTDBCL",
  "TT_NNTH",
  "K_KTQT",
  "K_KTCN",
  "P_KHTC",
  "P_CTHSSV",
];

/**
 * Builds the scale fixture deterministically.
 *
 * NOT every row is IN_PROGRESS — the plan explicitly forbids padding the action
 * count that way. Rows get a real reason:
 *   - index % 5 === 0 -> blocked
 *   - index % 5 === 1 -> overdue
 *   - index % 5 === 2 -> pending review
 *   - index % 5 === 3 -> pending review AND overdue
 *   - index % 5 === 4 -> completed (NO reason — must not appear)
 * That is 4 of every 5 rows actionable => 250 actionable, so the generator is
 * given enough rows to land exactly 311 actionable ones.
 *
 * For upcoming: exactly 20 rows land in [D, D+6] and the rest do not.
 */
export function buildLargeFixture(): LargeFixture {
  const tasks: SchoolTask[] = [];

  const ACTIONABLE_TARGET = 311;
  // 4 of every 5 rows are actionable; generate enough groups to exceed the
  // target, then force every surplus actionable row to COMPLETED so the count
  // lands exactly on 311 without padding with IN_PROGRESS rows.
  const groups = Math.ceil(ACTIONABLE_TARGET / 4) + 1;
  const totalRows = groups * 5;

  let actionableSoFar = 0;
  for (let i = 0; i < totalRows; i++) {
    const bucket = i % 5;
    const dept = DEPT_CODES[i % DEPT_CODES.length];
    const longTitle = LONG_VIETNAMESE_TITLES[i % LONG_VIETNAMESE_TITLES.length];

    // Missing owner on every 7th row.
    const noOwner = i % 7 === 0;

    // Same day/priority collisions are deliberate.
    //
    // Action rows deliberately fall OUTSIDE the upcoming window [D, D+6] so the
    // two scale counts are exactly 311 and 20 and stay disjoint:
    //   overdue buckets -> D-1 (past due, never upcoming)
    //   blocked/review buckets -> D+10 (future, beyond the window)
    const dueDate =
      bucket === 1 || bucket === 3 ? D.minus1 : bucket === 4 ? D.minus2 : D.plus10;

    const naturalStatus: SchoolTask["status"] =
      bucket === 0
        ? "BLOCKED"
        : bucket === 2 || bucket === 3
          ? "PENDING_EXECUTIVE_APPROVAL"
          : bucket === 4
            ? "COMPLETED"
            : "IN_PROGRESS";

    // A row is actionable unless it is the completed bucket, or we have already
    // produced the exact number of actionable rows we want.
    const wouldBeActionable = bucket !== 4;
    const isActionable = wouldBeActionable && actionableSoFar < ACTIONABLE_TARGET;
    if (isActionable) actionableSoFar++;

    const id = `large-${String(i).padStart(3, "0")}`;
    const status: SchoolTask["status"] = isActionable ? naturalStatus : "COMPLETED";

    tasks.push(
      baseSchoolTask({
        id,
        title: `${id} — ${longTitle}`,
        status,
        progressPercent: isActionable ? (i * 7) % 100 : 100,
        priority: i % 3 === 0 ? "URGENT" : i % 3 === 1 ? "HIGH" : "NORMAL",
        dueDate: isActionable ? dueDate : D.minus2,
        leadAssigneeName: noOwner ? "" : `Cán bộ ${i % 40}`,
        leadDepartmentCode: dept,
      })
    );
  }

  // Exactly 20 upcoming rows in [D, D+6].
  const upcomingOffsets = [D.today, D.plus1, D.plus2, D.plus3, D.plus6];
  for (let i = 0; i < 20; i++) {
    tasks.push(
      baseSchoolTask({
        id: `up-${String(i).padStart(2, "0")}`,
        title: `up-${String(i).padStart(2, "0")} — nhiệm vụ sắp tới hạn`,
        status: "IN_PROGRESS",
        progressPercent: 20 + i,
        priority: i % 2 === 0 ? "HIGH" : "NORMAL",
        dueDate: upcomingOffsets[i % upcomingOffsets.length],
        leadDepartmentCode: DEPT_CODES[i % DEPT_CODES.length],
      })
    );
  }

  return {
    tasks,
    expectedActionRowCount: ACTIONABLE_TARGET,
    expectedUpcomingCount: 20,
    expectedPreviewCount: 5,
  };
}
