import type { SchoolTask, TaskCategory } from "@/types/dashboard";
import { isTaskPastDue, getSystemReferenceDate, parseStrictDateOnly } from "./academic-calendar";

export const TODAY_ISO = getSystemReferenceDate();

export type ExecutiveFilter =
  | "ALL"
  | "PENDING_APPROVAL"
  | "BLOCKED_OVERDUE"
  | "STRATEGIC";

export interface ExecutiveActionStats {
  pendingSchoolApprovalCount: number;
  blockedTasksCount: number;
  overdueTasksCount: number;
  strategicActiveCount: number;
}

/**
 * Why a task sits in the workbench action queue. A single task may carry more
 * than one reason (e.g. a review file that is also overdue) — the queue shows
 * ONE row per task with every reason, not one row per reason.
 */
export type ExecutiveActionReason = "REVIEW" | "BLOCKED" | "OVERDUE";

export interface ExecutiveActionItem {
  id: string;
  /** The real task id. Rows are keyed by this, so it is always present. */
  taskId: string;
  title: string;
  departmentName?: string;
  departmentCode?: string;
  department?: string;
  leadName?: string;
  assignee?: string;
  leadAvatar?: string;
  dueDate: string;
  /** Primary group, kept for consumers that only understand the 3-way lens. */
  filterType: Exclude<ExecutiveFilter, "ALL">;
  /** Every reason this row is actionable. Order: REVIEW, BLOCKED, OVERDUE. */
  reasons: ExecutiveActionReason[];
  /** Headline reason: REVIEW, else BLOCKED, else OVERDUE. */
  primaryReason: ExecutiveActionReason;
  /** ISO date the task entered its current waiting state (sort tie-break). */
  waitingSince?: string;
  badgeLabel?: string;
  badgeVariant?: "warning" | "rose" | "default" | string;
  actionType?: "REVIEW" | "DETAIL" | "APPROVE" | "URGE" | "MONITOR" | "DIRECT" | string;
  actionLabel?: string;
  priority?: "KHAN_CAP" | "CAO" | "TRUNG_BINH";
}

/** Counts for each workbench queue lens, computed from the same item set. */
export type ExecutiveActionCounts = Record<Exclude<ExecutiveFilter, "ALL">, number>;

export interface ExecutiveActionQueueSelection {
  /** Size of the filtered set BEFORE the preview slice — never the preview length. */
  filteredTotal: number;
  /** First `previewLimit` rows of the sorted, filtered set. */
  previewItems: ExecutiveActionItem[];
  /** Predicate-matching counts for every lens. */
  counts: ExecutiveActionCounts;
}

export interface DepartmentHealthSummary {
  departmentId: string;
  code?: string;
  departmentName: string;
  leadName: string;
  totalTasksCount: number;
  completedTasksCount: number;
  inProgressTasksCount: number;
  blockedTasksCount: number;
  overdueTasksCount: number;
  averageProgressPercent: number;

  // Extended fields for live dashboard service compatibility
  departmentCode?: string;
  shortName?: string;
  totalTasks?: number;
  completedTasks?: number;
  inProgressTasks?: number;
  overdueTasks?: number;
  completionRate?: number;
  healthScore?: number;
  healthStatus?: "HEALTHY" | "AT_RISK" | "CRITICAL" | string;
  status?: "critical" | "warning" | "good";

  // Distinct parent and subtask counters (Denominator Integrity per Rule 40 & docs/product/metrics.md)
  parentTasksCount?: number;
  completedParentTasksCount?: number;
  inProgressParentTasksCount?: number;
  blockedParentTasksCount?: number;
  overdueParentTasksCount?: number;

  subTasksCount?: number;
  completedSubTasksCount?: number;
  inProgressSubTasksCount?: number;
  blockedSubTasksCount?: number;
  overdueSubTasksCount?: number;
}

export interface DepartmentDefinition {
  id: string;
  code?: string;
  name: string;
  leadName: string;
  alternateCodes: string[];
  categories?: TaskCategory[];
  personnelKeywords: string[];
}

export const QCET_DEPARTMENT_DEFINITIONS: DepartmentDefinition[] = [
  {
    id: "BGH",
    code: "BGH",
    name: "Ban Giám hiệu",
    leadName: "ThS. Phạm Văn Tường",
    alternateCodes: ["dept-bgh", "BGH", "HIEU_TRUONG", "ban-giam-hieu", "bgh"],
    personnelKeywords: ["Tường", "Kiệm", "Nguyên", "Tuấn", "Đạt", "Cúc", "BGH", "Hiệu trưởng"],
  },
  {
    id: "CNTT",
    code: "K_CNTT",
    name: "Khoa Công nghệ thông tin",
    leadName: "TS. Nguyễn Ngọc Vinh",
    alternateCodes: [
      "dept-k-cntt",
      "K_CNTT",
      "CNTT",
      "KHOA_CNTT",
      "K_DTTH",
      "TT_STT",
      "dept-tt-stt",
      "Khoa Điện tử - Tin học",
      "Khoa Công nghệ thông tin",
      "khoa-cntt",
      "dept-k-dtth",
      "k-cntt",
      "k_cntt",
      "khoa-dien-tu-tin-hoc",
    ],
    categories: ["CNTT", "ATTT", "CHUYEN_DOI_SO"],
    personnelKeywords: ["Vinh", "Hùng", "Khôi"],
  },
  {
    id: "DAO_TAO",
    code: "P_DTQLKH",
    name: "Phòng Đào tạo & QLKH",
    leadName: "ThS. Đỗ Quang Trung",
    alternateCodes: [
      "dept-p-dtqlkh",
      "dept-p-qldt",
      "P_QLDT",
      "P_DTQLKH",
      "DAO_TAO",
      "DTQLKH",
      "PHONG_DAO_TAO",
      "Phòng Quản lý Đào tạo",
      "Phòng Đào tạo & QLKH",
      "phong-dao-tao",
      "p-qldt",
      "p_qldt",
      "phong-quan-ly-dao-tao",
      "phong-dao-tao-qlkh",
    ],
    categories: ["BAO_CAO"],
    personnelKeywords: ["Thí", "Trung", "Trí", "Thủy", "Hùng"],
  },
  {
    id: "TRUYEN_THONG",
    code: "TT_SO_TT",
    name: "Trung tâm Số và Truyền thông",
    leadName: "ThS. Mai Đinh Thị Xuân",
    alternateCodes: [
      "TT_SO_TT",
      "tt_so_tt",
      "tt-so-tt",
      "Trung tâm Số và Truyền thông",
      "TT Số & Truyền thông",
      "trung-tam-so-va-truyen-thong",
      "dept-tt-stt",
      "TT_STT",
      "dept-tt-dcc",
      "TT_DCC",
      "TRUYEN_THONG",
      "DCC",
      "Trung tâm Số - Truyền thông",
      "TT Truyền thông & Số hóa",
      "trung-tam-truyen-thong",
      "tt-truyen-thong-so-hoa",
      "trung-tam-so-truyen-thong",
      "tt-stt",
      "tt_stt",
    ],
    categories: ["TRUYEN_THONG"],
    personnelKeywords: ["Vinh", "Xuân", "Huy", "Linh"],
  },
  {
    id: "HANH_CHINH",
    code: "P_HCQT",
    name: "Phòng Hành chính - Quản trị",
    leadName: "ThS. Phan Văn Thanh",
    alternateCodes: [
      "dept-p-hcqt",
      "P_HCQT",
      "HANH_CHINH",
      "HCQT",
      "phong-hanh-chinh",
      "p-hcqt",
      "p_hcqt",
      "phong-hanh-chinh-quan-tri",
    ],
    personnelKeywords: ["Thanh", "Nam", "Nhung"],
  },
  {
    id: "KHAO_THI",
    code: "P_KTDBCL",
    name: "Phòng Khảo thí & ĐBCL",
    leadName: "TS. Nguyễn Công Minh",
    alternateCodes: [
      "dept-p-ktdbcl",
      "P_KTDBCL",
      "KHAO_THI",
      "KTDBCL",
      "dept-p-tcdbcl",
      "P_TCDBCL",
      "phong-khao-thi",
      "p-ktdbcl",
      "p-tcdbcl",
      "p_tcdbcl",
      "phong-khao-thi-dbcl",
      "phong-to-chuc-dam-bao-chat-luong",
    ],
    personnelKeywords: ["Minh", "Hậu", "My"],
  },
  {
    id: "THU_VIEN",
    code: "TT_NNTH",
    name: "TT Ngoại ngữ - TH & Thư viện",
    leadName: "ThS. Chu Đình Thắng",
    alternateCodes: [
      "dept-tt-nnth",
      "TT_NNTH",
      "THU_VIEN",
      "NNTH",
      "trung-tam-thu-vien",
      "tt-thu-vien",
      "tt-nnth",
      "tt_nnth",
      "trung-tam-ngoai-ngu-tin-hoc",
    ],
    categories: ["THU_VIEN"],
    personnelKeywords: ["Thắng", "Thu", "Ngọc"],
  },
  {
    id: "KINH_TE",
    code: "K_KTQT",
    name: "Khoa Kinh tế - Quản trị",
    leadName: "TS. Lê Thị Ánh Tuyết",
    alternateCodes: [
      "dept-k-ktqt",
      "K_KTQT",
      "KINH_TE",
      "KTQT",
      "dept-k-ktth",
      "K_KTTH",
      "khoa-kinh-te",
      "k-ktqt",
      "k-ktth",
      "k_ktth",
      "khoa-kinh-te-quan-tri",
    ],
    personnelKeywords: ["Tuyết", "Sơn", "Phượng"],
  },
  {
    id: "KY_THUAT",
    code: "K_KTCN",
    name: "Khoa Kỹ thuật - Công nghệ",
    leadName: "TS. Đinh Quốc Cường",
    alternateCodes: [
      "dept-k-ktcn",
      "K_KTCN",
      "KY_THUAT",
      "KTCN",
      "khoa-co-khi",
      "dept-k-ck",
      "k-ck",
      "K_CK",
      "khoa-ky-thuat",
      "k-ktcn",
      "dept-k-cnoto",
      "k-cnoto",
      "K_CNOTO",
      "khoa-cong-nghe-o-to",
      "dept-k-dien",
      "k-dien",
      "K_DIEN",
      "khoa-dien",
      "dept-k-ktnn",
      "k-ktnn",
      "K_KTNN",
      "khoa-ky-thuat-nong-nghiep",
    ],
    personnelKeywords: ["Cường", "Vũ", "Lộc"],
  },
  {
    id: "TAI_CHINH",
    code: "P_KHTC",
    name: "Phòng Kế hoạch - Tài chính",
    leadName: "ThS. Trần Thị Mai Loan",
    alternateCodes: [
      "dept-p-khtc",
      "P_KHTC",
      "TAI_CHINH",
      "KHTC",
      "dept-p-tc",
      "P_TC",
      "phong-tai-chinh",
      "p-khtc",
      "p-tc",
      "p_tc",
      "phong-ke-hoach-tai-chinh",
    ],
    personnelKeywords: ["Loan", "Vân", "Hào"],
  },
  {
    id: "CTHSSV",
    code: "P_CTHSSV",
    name: "Phòng Công tác HSSV",
    leadName: "ThS. Huỳnh Công Tuấn",
    alternateCodes: [
      "dept-p-cthssv",
      "P_CTHSSV",
      "CTHSSV",
      "dept-p-tshtqt",
      "P_TSHTQT",
      "phong-cthssv",
      "p-cthssv",
      "p-tshtqt",
      "p_tshtqt",
      "phong-cong-tac-hssv",
      "phong-tuyen-sinh",
      "tuyensinh",
      "tt-tuyensinh",
    ],
    personnelKeywords: ["Huỳnh Công Tuấn", "Hà", "Phúc"],
  },
];

export function resolveDepartmentId(
  deptCodeOrName?: string,
  personName?: string,
  category?: TaskCategory
): string | null {
  if (deptCodeOrName) {
    const clean = deptCodeOrName.trim().toUpperCase();
    for (const def of QCET_DEPARTMENT_DEFINITIONS) {
      if (def.id === clean) return def.id;
      if (def.alternateCodes.some((code) => code.toUpperCase() === clean)) {
        return def.id;
      }
      if (
        def.name.toUpperCase().includes(clean) ||
        clean.includes(def.name.toUpperCase())
      ) {
        return def.id;
      }
    }
  }

  if (personName) {
    const p = personName.trim().toLowerCase();
    for (const def of QCET_DEPARTMENT_DEFINITIONS) {
      if (def.personnelKeywords.some((kw) => p.includes(kw.toLowerCase()))) {
        return def.id;
      }
    }
  }

  if (category) {
    for (const def of QCET_DEPARTMENT_DEFINITIONS) {
      if (def.categories && def.categories.includes(category)) {
        return def.id;
      }
    }
  }

  return null;
}

export function computeExecutiveActionStats(
  tasks: SchoolTask[],
  referenceDate: string = TODAY_ISO
): ExecutiveActionStats {
  let pendingSchoolApprovalCount = 0;
  let blockedTasksCount = 0;
  let overdueTasksCount = 0;
  let strategicActiveCount = 0;

  for (const task of tasks) {
    if ((task.status as string) === "CANCELLED") continue;

    if (task.status !== "COMPLETED") {
      // A real pending-review request only. `progressPercent === 100` is NOT a
      // review request — it only means the owner filled the bar (plan T04.2).
      const isWaiting =
        (task.status as string) === "WAITING_APPROVAL" ||
        task.status === "PENDING_EXECUTIVE_APPROVAL";
      const hasSubtaskNeedingReview = (task.subTasks || []).some(
        (st) =>
          (st.status as string) !== "CANCELLED" &&
          (st.status === "NEEDS_REVIEW" || st.requiresReview === true)
      );
      if (isWaiting || hasSubtaskNeedingReview) {
        pendingSchoolApprovalCount++;
      }
    }

    if (task.status === "IN_PROGRESS") {
      strategicActiveCount++;
    }

    if ((task.status as string) === "BLOCKED") {
      blockedTasksCount++;
    }
    for (const sub of task.subTasks || []) {
      if ((sub.status as string) === "CANCELLED") continue;
      if (sub.status === "BLOCKED") {
        blockedTasksCount++;
      }
    }

    if (task.status !== "COMPLETED" && isTaskPastDue(task.dueDate, referenceDate)) {
      overdueTasksCount++;
    }
    for (const sub of task.subTasks || []) {
      if ((sub.status as string) === "CANCELLED") continue;
      if (sub.status !== "COMPLETED" && isTaskPastDue(sub.dueDate, referenceDate)) {
        overdueTasksCount++;
      }
    }
  }

  return {
    pendingSchoolApprovalCount,
    blockedTasksCount,
    overdueTasksCount,
    strategicActiveCount,
  };
}

export function computeDepartmentHealthMatrix(
  tasks: SchoolTask[],
  referenceDate: string = TODAY_ISO
): DepartmentHealthSummary[] {
  const deptMap = new Map<
    string,
    {
      parentTasksCount: number;
      completedParentTasksCount: number;
      inProgressParentTasksCount: number;
      blockedParentTasksCount: number;
      overdueParentTasksCount: number;
      parentProgressSum: number;

      subTasksCount: number;
      completedSubTasksCount: number;
      inProgressSubTasksCount: number;
      blockedSubTasksCount: number;
      overdueSubTasksCount: number;
      subProgressSum: number;
    }
  >();

  for (const def of QCET_DEPARTMENT_DEFINITIONS) {
    deptMap.set(def.id, {
      parentTasksCount: 0,
      completedParentTasksCount: 0,
      inProgressParentTasksCount: 0,
      blockedParentTasksCount: 0,
      overdueParentTasksCount: 0,
      parentProgressSum: 0,

      subTasksCount: 0,
      completedSubTasksCount: 0,
      inProgressSubTasksCount: 0,
      blockedSubTasksCount: 0,
      overdueSubTasksCount: 0,
      subProgressSum: 0,
    });
  }

  for (const task of tasks) {
    if ((task.status as string) === "CANCELLED") continue;

    const parentDeptId =
      resolveDepartmentId(task.leadDepartmentCode) ||
      resolveDepartmentId(task.leadDepartment) ||
      resolveDepartmentId(task.departmentCode) ||
      resolveDepartmentId(task.departmentId) ||
      resolveDepartmentId(task.department) ||
      resolveDepartmentId(undefined, task.leadAssigneeName) ||
      resolveDepartmentId(undefined, undefined, task.category) ||
      "BGH";

    const parentStats = deptMap.get(parentDeptId);
    if (parentStats) {
      parentStats.parentTasksCount++;

      const isCompleted = task.status === "COMPLETED";
      const isBlocked = (task.status as string) === "BLOCKED";

      if (isCompleted) {
        parentStats.completedParentTasksCount++;
        parentStats.parentProgressSum += 100;
      } else if (isBlocked) {
        parentStats.blockedParentTasksCount++;
        parentStats.parentProgressSum +=
          typeof task.progressPercent === "number" ? task.progressPercent : 0;
      } else {
        parentStats.inProgressParentTasksCount++;
        parentStats.parentProgressSum +=
          typeof task.progressPercent === "number" ? task.progressPercent : 0;
      }

      if (!isCompleted && isTaskPastDue(task.dueDate, referenceDate)) {
        parentStats.overdueParentTasksCount++;
      }
    }

    for (const sub of task.subTasks || []) {
      if ((sub.status as string) === "CANCELLED") continue;

      const subDeptId =
        resolveDepartmentId(sub.departmentCode) ||
        resolveDepartmentId(sub.departmentId) ||
        resolveDepartmentId((sub as any).assignedToDepartmentId) ||
        resolveDepartmentId(sub.department) ||
        resolveDepartmentId(undefined, sub.assigneeName) ||
        parentDeptId;

      const subStats = deptMap.get(subDeptId);
      if (subStats) {
        subStats.subTasksCount++;

        const isSubCompleted = sub.status === "COMPLETED";
        const isSubBlocked = sub.status === "BLOCKED";

        if (isSubCompleted) {
          subStats.completedSubTasksCount++;
          subStats.subProgressSum +=
            typeof (sub as any).progressPercent === "number"
              ? (sub as any).progressPercent
              : 100;
        } else if (isSubBlocked) {
          subStats.blockedSubTasksCount++;
          subStats.subProgressSum +=
            typeof (sub as any).progressPercent === "number"
              ? (sub as any).progressPercent
              : 0;
        } else {
          subStats.inProgressSubTasksCount++;
          subStats.subProgressSum +=
            typeof (sub as any).progressPercent === "number"
              ? (sub as any).progressPercent
              : 0;
        }

        if (!isSubCompleted && isTaskPastDue(sub.dueDate, referenceDate)) {
          subStats.overdueSubTasksCount++;
        }
      }
    }
  }

  return QCET_DEPARTMENT_DEFINITIONS.map((def) => {
    const stats = deptMap.get(def.id)!;
    const totalItems = stats.parentTasksCount + stats.subTasksCount;
    const totalProgress = stats.parentProgressSum + stats.subProgressSum;
    const averageProgressPercent =
      totalItems > 0 ? Math.round(totalProgress / totalItems) : 0;

    // Strict Denominator Integrity: Calculate completionRate strictly from valid parent tasks (milestones)
    // per docs/product/metrics.md Section 3.1 & 4.1. Never mix parent milestones and subtasks into a shared denominator.
    const completionRate =
      stats.parentTasksCount > 0
        ? Math.round((stats.completedParentTasksCount / stats.parentTasksCount) * 100)
        : 0;

    const totalTasksCount = stats.parentTasksCount + stats.subTasksCount;
    const completedTasksCount = stats.completedParentTasksCount + stats.completedSubTasksCount;
    const inProgressTasksCount = stats.inProgressParentTasksCount + stats.inProgressSubTasksCount;
    const blockedTasksCount = stats.blockedParentTasksCount + stats.blockedSubTasksCount;
    const overdueTasksCount = stats.overdueParentTasksCount + stats.overdueSubTasksCount;

    return {
      departmentId: def.id,
      code: def.code || def.id,
      departmentCode: def.code || def.id,
      departmentName: def.name,
      leadName: def.leadName,
      totalTasksCount,
      completedTasksCount,
      inProgressTasksCount,
      blockedTasksCount,
      overdueTasksCount,
      averageProgressPercent,
      totalTasks: totalTasksCount,
      completedTasks: completedTasksCount,
      inProgressTasks: inProgressTasksCount,
      overdueTasks: overdueTasksCount,
      completionRate,

      // Distinct parent and subtask separation counters (Rule 40.2 Denominator Integrity)
      parentTasksCount: stats.parentTasksCount,
      completedParentTasksCount: stats.completedParentTasksCount,
      inProgressParentTasksCount: stats.inProgressParentTasksCount,
      blockedParentTasksCount: stats.blockedParentTasksCount,
      overdueParentTasksCount: stats.overdueParentTasksCount,

      subTasksCount: stats.subTasksCount,
      completedSubTasksCount: stats.completedSubTasksCount,
      inProgressSubTasksCount: stats.inProgressSubTasksCount,
      blockedSubTasksCount: stats.blockedSubTasksCount,
      overdueSubTasksCount: stats.overdueSubTasksCount,
    };
  });
}

/**
 * Strict overdue check. `isTaskPastDue` compares ISO strings, so an impossible
 * calendar date like "2026-02-30" would read as past due. A row is only overdue
 * when its due date is a REAL calendar date strictly before the reference date;
 * an invalid date stays missing and is never coerced (plan T05 "Deadline").
 */
function isStrictlyOverdue(
  dueDate: string | Date | null | undefined,
  referenceDate: string
): boolean {
  const due = parseStrictDateOnly(dueDate);
  const ref = parseStrictDateOnly(referenceDate);
  if (!due || !ref) return false;
  return due < ref;
}

/** Display-priority ranking for queue rows. */
const ACTION_PRIORITY_WEIGHT: Record<string, number> = {
  KHAN_CAP: 3,
  CAO: 2,
  TRUNG_BINH: 1,
};

function actionPriorityWeight(priority?: string): number {
  return ACTION_PRIORITY_WEIGHT[String(priority ?? "").toUpperCase()] ?? 1;
}

/**
 * Canonical workbench queue order (plan T04.6):
 * priority desc -> overdue first -> due asc -> waitingSince asc -> taskId asc.
 * A row with no usable due date sorts last and is never coerced to "today".
 */
export function compareExecutiveActionItems(
  a: ExecutiveActionItem,
  b: ExecutiveActionItem
): number {
  const byPriority = actionPriorityWeight(b.priority) - actionPriorityWeight(a.priority);
  if (byPriority !== 0) return byPriority;

  const overdueA = a.reasons.includes("OVERDUE") ? 1 : 0;
  const overdueB = b.reasons.includes("OVERDUE") ? 1 : 0;
  if (overdueA !== overdueB) return overdueB - overdueA;

  const dueA = parseStrictDateOnly(a.dueDate);
  const dueB = parseStrictDateOnly(b.dueDate);
  if (dueA !== dueB) {
    if (dueA === null) return 1;
    if (dueB === null) return -1;
    return dueA < dueB ? -1 : 1;
  }

  const waitA = a.waitingSince ?? "";
  const waitB = b.waitingSince ?? "";
  if (waitA !== waitB) {
    if (!waitA) return 1;
    if (!waitB) return -1;
    return waitA < waitB ? -1 : 1;
  }

  return a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0;
}

/** Does this row belong to the given workbench lens? Predicate, not primaryReason. */
export function matchesExecutiveFilter(
  item: ExecutiveActionItem,
  filter: ExecutiveFilter
): boolean {
  switch (filter) {
    case "ALL":
      return true;
    case "PENDING_APPROVAL":
      return item.reasons.includes("REVIEW");
    case "BLOCKED_OVERDUE":
      return item.reasons.includes("BLOCKED") || item.reasons.includes("OVERDUE");
    case "STRATEGIC":
      return item.filterType === "STRATEGIC";
    default:
      return true;
  }
}

/**
 * Selects the visible rows for a lens. The filter and the sort are applied
 * BEFORE the preview slice, and `filteredTotal` is the size of the filtered set
 * — a caller must never read `previewItems.length` as the total.
 */
export function selectExecutiveActionQueue(
  items: ExecutiveActionItem[],
  filter: ExecutiveFilter = "ALL",
  previewLimit = 5
): ExecutiveActionQueueSelection {
  const filtered = items
    .filter((item) => matchesExecutiveFilter(item, filter))
    .sort(compareExecutiveActionItems);

  return {
    filteredTotal: filtered.length,
    previewItems: filtered.slice(0, previewLimit),
    counts: {
      PENDING_APPROVAL: items.filter((i) => matchesExecutiveFilter(i, "PENDING_APPROVAL")).length,
      BLOCKED_OVERDUE: items.filter((i) => matchesExecutiveFilter(i, "BLOCKED_OVERDUE")).length,
      STRATEGIC: items.filter((i) => matchesExecutiveFilter(i, "STRATEGIC")).length,
    },
  };
}

/** Minimal shape `summarizeDepartmentAttention` needs from a department row. */
export interface DepartmentAttentionInput {
  departmentId: string;
  departmentCode?: string;
  departmentName?: string;
  totalTasksCount?: number;
  completedTasksCount?: number;
  overdueTasksCount?: number;
  overdueTasks?: number;
  blockedTasksCount?: number;
}

export interface DepartmentAttentionSummary<T> {
  /** Every department in scope. */
  all: T[];
  /** Departments needing attention, sorted. */
  attention: T[];
  /** Size of `attention` — never the preview length. */
  attentionCount: number;
  /** First `previewLimit` rows of `attention`. */
  preview: T[];
}

/**
 * Splits departments into "all" and "needs attention".
 *
 * Attention is a real risk signal only: overdue tasks > 0 OR blocked tasks > 0.
 * A low average progress percentage is deliberately NOT a reason — that was the
 * old `<60%` threshold that reported problems on an empty dataset (plan T05.1).
 */
export function summarizeDepartmentAttention<T extends DepartmentAttentionInput>(
  departments: T[],
  previewLimit = 5
): DepartmentAttentionSummary<T> {
  const overdueOf = (d: DepartmentAttentionInput) => d.overdueTasksCount ?? d.overdueTasks ?? 0;
  const blockedOf = (d: DepartmentAttentionInput) => d.blockedTasksCount ?? 0;

  const attention = departments
    .filter((d) => overdueOf(d) > 0 || blockedOf(d) > 0)
    .sort((a, b) => {
      const byOverdue = overdueOf(b) - overdueOf(a);
      if (byOverdue !== 0) return byOverdue;
      const byBlocked = blockedOf(b) - blockedOf(a);
      if (byBlocked !== 0) return byBlocked;
      return a.departmentId < b.departmentId ? -1 : a.departmentId > b.departmentId ? 1 : 0;
    });

  return {
    all: departments,
    attention,
    attentionCount: attention.length,
    preview: attention.slice(0, previewLimit),
  };
}

/**
 * Extracts the workbench action queue from real tasks.
 *
 * One row per task (keyed by `taskId`), carrying every reason it is actionable.
 * Only real signals count: a pending review request, a blocker, or an overdue
 * deadline. A plain IN_PROGRESS task is NOT a workbench action row.
 */
export function extractExecutiveActionItems(
  tasks: SchoolTask[],
  referenceDate: string = TODAY_ISO
): ExecutiveActionItem[] {
  const items: ExecutiveActionItem[] = [];

  for (const t of tasks) {
    const status = String(t.status ?? "");
    if (status === "CANCELLED") continue;

    const isTerminal = status === "COMPLETED" || status === "CANCELLED";
    const subTasks = t.subTasks || [];
    const isSubActive = (s: { status?: string }) => String(s.status ?? "") !== "CANCELLED";

    const reasons: ExecutiveActionReason[] = [];

    // REVIEW — a real pending-review request, never `progressPercent === 100`.
    const taskWaitingForReview =
      status === "WAITING_APPROVAL" || status === "PENDING_EXECUTIVE_APPROVAL";
    const subtaskAwaitingReview = subTasks.some(
      (s) =>
        isSubActive(s) &&
        (String(s.status) === "NEEDS_REVIEW" || s.requiresReview === true)
    );
    if (taskWaitingForReview || subtaskAwaitingReview) {
      reasons.push("REVIEW");
    }

    // BLOCKED — task or one of its subtasks is blocked.
    const taskBlocked = status === "BLOCKED";
    const subtaskBlocked = subTasks.some(
      (s) => isSubActive(s) && String(s.status) === "BLOCKED"
    );
    if (taskBlocked || subtaskBlocked) {
      reasons.push("BLOCKED");
    }

    // OVERDUE — the task itself or one of its open subtasks is past due.
    const taskOverdue =
      status === "OVERDUE" || (!isTerminal && isStrictlyOverdue(t.dueDate, referenceDate));
    const subtaskOverdue = subTasks.some(
      (s) =>
        isSubActive(s) &&
        String(s.status) !== "COMPLETED" &&
        isStrictlyOverdue(s.dueDate, referenceDate)
    );
    if (taskOverdue || subtaskOverdue) {
      reasons.push("OVERDUE");
    }

    if (reasons.length === 0) continue;

    const primaryReason: ExecutiveActionReason = reasons.includes("REVIEW")
      ? "REVIEW"
      : reasons.includes("BLOCKED")
        ? "BLOCKED"
        : "OVERDUE";

    const resolvedDeptId =
      resolveDepartmentId(t.leadDepartmentCode) ||
      resolveDepartmentId(t.departmentCode) ||
      resolveDepartmentId(t.leadDepartment) ||
      resolveDepartmentId(t.department) ||
      resolveDepartmentId(t.departmentId) ||
      resolveDepartmentId(t.departmentName) ||
      resolveDepartmentId(undefined, t.leadAssigneeName) ||
      null;
    const deptDef = resolvedDeptId
      ? QCET_DEPARTMENT_DEFINITIONS.find((d) => d.id === resolvedDeptId)
      : undefined;

    // No department resolved -> never silently fall back to "BGH" (plan T04.8).
    const departmentCode = deptDef?.id ?? resolvedDeptId ?? undefined;
    const departmentName =
      t.leadDepartment ||
      t.department ||
      t.departmentName ||
      deptDef?.name ||
      "Chưa xác định đơn vị";

    const leadName = t.leadAssigneeName || t.assignedTo || "Chưa phân công";

    const priority: "KHAN_CAP" | "CAO" | "TRUNG_BINH" =
      t.priority === "URGENT"
        ? "KHAN_CAP"
        : t.priority === "HIGH"
          ? "CAO"
          : "TRUNG_BINH";

    const isReview = primaryReason === "REVIEW";
    const isBlocked = primaryReason === "BLOCKED";

    items.push({
      id: `act-${t.id}`,
      taskId: t.id,
      title: t.title,
      departmentName,
      departmentCode,
      department: departmentName,
      leadName,
      assignee: leadName,
      leadAvatar: t.leadAssigneeAvatar,
      dueDate: t.dueDate,
      filterType: isReview ? "PENDING_APPROVAL" : "BLOCKED_OVERDUE",
      reasons,
      primaryReason,
      waitingSince: t.assignedDate,
      badgeLabel: isReview
        ? "Hồ sơ chờ xem xét"
        : isBlocked
          ? "Tắc nghẽn"
          : "Trễ hạn tiến độ",
      badgeVariant: isReview ? "warning" : "rose",
      // Opening a review file is "Xem xét"; opening anything else is "Xem chi tiết".
      // Neither sends an approval mutation from the queue (plan T04.7).
      actionType: isReview ? "REVIEW" : "DETAIL",
      actionLabel: isReview ? "Xem xét" : "Xem chi tiết",
      priority,
    });
  }

  return items.sort(compareExecutiveActionItems);
}

/**
 * Filters SchoolTask[] by an executive action lens.
 * Applied after filterTasksHub to narrow the work canvas for BGH users.
 */
export function filterTasksByExecutive(
  tasks: SchoolTask[],
  filter: ExecutiveFilter,
  referenceDate: string = TODAY_ISO
): SchoolTask[] {
  if (filter === "ALL") return tasks;

  switch (filter) {
    case "PENDING_APPROVAL":
      return tasks.filter((t) => {
        if ((t.status as string) === "CANCELLED" || t.status === "COMPLETED") return false;
        // A real pending-review request only — `progressPercent === 100` alone is
        // not a review request (plan T04.2). Same predicate as the queue.
        return (
          (t.status as string) === "WAITING_APPROVAL" ||
          t.status === "PENDING_EXECUTIVE_APPROVAL" ||
          (t.subTasks || []).some(
            (sub) =>
              (sub.status as string) !== "CANCELLED" &&
              (sub.status === "NEEDS_REVIEW" || sub.requiresReview)
          )
        );
      });
    case "BLOCKED_OVERDUE":
      return tasks.filter((t) => {
        if ((t.status as string) === "CANCELLED") return false;
        if ((t.status as string) === "BLOCKED") return true;
        if (
          t.status !== "COMPLETED" &&
          isTaskPastDue(t.dueDate, referenceDate)
        ) {
          return true;
        }
        const hasBlockedSub = (t.subTasks || []).some(
          (sub) =>
            (sub.status as string) !== "CANCELLED" &&
            (sub.status === "BLOCKED" ||
              (sub.status !== "COMPLETED" &&
                isTaskPastDue(sub.dueDate, referenceDate)))
        );
        return hasBlockedSub;
      });
    case "STRATEGIC":
      return tasks.filter((t) => t.status === "IN_PROGRESS");
    default:
      return tasks;
  }
}
