import type { SchoolTask, TaskCategory } from "@/types/dashboard";
import { isTaskPastDue, getSystemReferenceDate } from "./academic-calendar";

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

export interface ExecutiveActionItem {
  id: string;
  taskId?: string;
  title: string;
  departmentName?: string;
  departmentCode?: string;
  department?: string;
  leadName?: string;
  assignee?: string;
  leadAvatar?: string;
  dueDate: string;
  filterType: Exclude<ExecutiveFilter, "ALL">;
  badgeLabel?: string;
  badgeVariant?: "warning" | "rose" | "default" | string;
  actionType?: "APPROVE" | "URGE" | "MONITOR" | "DIRECT" | string;
  actionLabel?: string;
  priority?: "KHAN_CAP" | "CAO" | "TRUNG_BINH";
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
  status?: "critical" | "warning" | "good";
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
    code: "TT_STT",
    name: "TT Truyền thông & Số hóa",
    leadName: "ThS. Mai Đinh Thị Xuân",
    alternateCodes: [
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
      const isWaiting =
        (task.status as string) === "WAITING_APPROVAL" ||
        task.status === "PENDING_EXECUTIVE_APPROVAL" ||
        task.progressPercent === 100;
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
      totalTasksCount: number;
      completedTasksCount: number;
      inProgressTasksCount: number;
      blockedTasksCount: number;
      overdueTasksCount: number;
      totalProgress: number;
    }
  >();

  for (const def of QCET_DEPARTMENT_DEFINITIONS) {
    deptMap.set(def.id, {
      totalTasksCount: 0,
      completedTasksCount: 0,
      inProgressTasksCount: 0,
      blockedTasksCount: 0,
      overdueTasksCount: 0,
      totalProgress: 0,
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
      parentStats.totalTasksCount++;

      const isCompleted = task.status === "COMPLETED";
      const isBlocked = (task.status as string) === "BLOCKED";

      if (isCompleted) {
        parentStats.completedTasksCount++;
        parentStats.totalProgress += 100;
      } else if (isBlocked) {
        parentStats.blockedTasksCount++;
        parentStats.totalProgress +=
          typeof task.progressPercent === "number" ? task.progressPercent : 0;
      } else {
        parentStats.inProgressTasksCount++;
        parentStats.totalProgress +=
          typeof task.progressPercent === "number" ? task.progressPercent : 0;
      }

      if (!isCompleted && isTaskPastDue(task.dueDate, referenceDate)) {
        parentStats.overdueTasksCount++;
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
        subStats.totalTasksCount++;

        const isSubCompleted = sub.status === "COMPLETED";
        const isSubBlocked = sub.status === "BLOCKED";

        if (isSubCompleted) {
          subStats.completedTasksCount++;
          subStats.totalProgress +=
            typeof (sub as any).progressPercent === "number"
              ? (sub as any).progressPercent
              : 100;
        } else if (isSubBlocked) {
          subStats.blockedTasksCount++;
          subStats.totalProgress +=
            typeof (sub as any).progressPercent === "number"
              ? (sub as any).progressPercent
              : 0;
        } else {
          subStats.inProgressTasksCount++;
          subStats.totalProgress +=
            typeof (sub as any).progressPercent === "number"
              ? (sub as any).progressPercent
              : 0;
        }

        if (!isSubCompleted && isTaskPastDue(sub.dueDate, referenceDate)) {
          subStats.overdueTasksCount++;
        }
      }
    }
  }

  return QCET_DEPARTMENT_DEFINITIONS.map((def) => {
    const stats = deptMap.get(def.id)!;
    const averageProgressPercent =
      stats.totalTasksCount > 0
        ? Math.round(stats.totalProgress / stats.totalTasksCount)
        : 0;
    const completionRate =
      stats.totalTasksCount > 0
        ? Math.round((stats.completedTasksCount / stats.totalTasksCount) * 100)
        : 0;

    return {
      departmentId: def.id,
      code: def.code || def.id,
      departmentCode: def.code || def.id,
      departmentName: def.name,
      leadName: def.leadName,
      totalTasksCount: stats.totalTasksCount,
      completedTasksCount: stats.completedTasksCount,
      inProgressTasksCount: stats.inProgressTasksCount,
      blockedTasksCount: stats.blockedTasksCount,
      overdueTasksCount: stats.overdueTasksCount,
      averageProgressPercent,
      totalTasks: stats.totalTasksCount,
      completedTasks: stats.completedTasksCount,
      inProgressTasks: stats.inProgressTasksCount,
      overdueTasks: stats.overdueTasksCount,
      completionRate,
    };
  });
}

/**
 * Extracts dynamic ExecutiveActionItem[] directly from real tasks for BGH leaders.
 */
export function extractExecutiveActionItems(
  tasks: SchoolTask[],
  referenceDate: string = TODAY_ISO
): ExecutiveActionItem[] {
  const items: ExecutiveActionItem[] = [];

  for (const t of tasks) {
    if ((t.status as string) === "CANCELLED") continue;

    const isWaiting =
      t.status !== "COMPLETED" &&
      ((t.status as string) === "WAITING_APPROVAL" ||
        t.status === "PENDING_EXECUTIVE_APPROVAL" ||
        t.progressPercent === 100 ||
        (t.subTasks || []).some(
          (s) =>
            (s.status as string) !== "CANCELLED" &&
            (s.status === "NEEDS_REVIEW" || s.requiresReview)
        ));

    const isOverdueOrBlocked =
      (t.status as string) === "OVERDUE" ||
      (t.status as string) === "BLOCKED" ||
      (t.status !== "COMPLETED" && isTaskPastDue(t.dueDate, referenceDate)) ||
      (t.subTasks || []).some(
        (s) =>
          (s.status as string) !== "CANCELLED" &&
          (s.status === "BLOCKED" ||
            (s.status !== "COMPLETED" && isTaskPastDue(s.dueDate, referenceDate)))
      );

    const deptCode =
      t.leadDepartmentCode ||
      t.departmentCode ||
      resolveDepartmentId(t.leadDepartment) ||
      resolveDepartmentId(t.department) ||
      resolveDepartmentId(undefined, t.leadAssigneeName) ||
      "BGH";

    const deptDef = QCET_DEPARTMENT_DEFINITIONS.find(
      (d) => d.id === deptCode || d.code === deptCode
    );

    const deptName =
      t.leadDepartment ||
      t.department ||
      t.departmentName ||
      deptDef?.name ||
      "QCET";

    const leadName = t.leadAssigneeName || t.assignedTo || "Chưa phân công";

    const priority: "KHAN_CAP" | "CAO" | "TRUNG_BINH" =
      t.priority === "URGENT"
        ? "KHAN_CAP"
        : t.priority === "HIGH"
          ? "CAO"
          : "TRUNG_BINH";

    if (isWaiting) {
      items.push({
        id: `act-wait-${t.id}`,
        taskId: t.id,
        title: t.title,
        departmentName: deptName,
        departmentCode: deptCode,
        department: deptName,
        leadName,
        assignee: leadName,
        leadAvatar: t.leadAssigneeAvatar,
        dueDate: t.dueDate,
        filterType: "PENDING_APPROVAL",
        badgeLabel: "Chờ phê duyệt",
        badgeVariant: "warning",
        actionType: "APPROVE",
        actionLabel: "Phê duyệt ngay",
        priority,
      });
    } else if (isOverdueOrBlocked) {
      items.push({
        id: `act-overdue-${t.id}`,
        taskId: t.id,
        title: t.title,
        departmentName: deptName,
        departmentCode: deptCode,
        department: deptName,
        leadName,
        assignee: leadName,
        leadAvatar: t.leadAssigneeAvatar,
        dueDate: t.dueDate,
        filterType: "BLOCKED_OVERDUE",
        badgeLabel: (t.status as string) === "BLOCKED" ? "Tắc nghẽn" : "Trễ hạn tiến độ",
        badgeVariant: "rose",
        actionType: "URGE",
        actionLabel: "Đôn đốc",
        priority,
      });
    } else if (t.status === "IN_PROGRESS") {
      items.push({
        id: `act-strat-${t.id}`,
        taskId: t.id,
        title: t.title,
        departmentName: deptName,
        departmentCode: deptCode,
        department: deptName,
        leadName,
        assignee: leadName,
        leadAvatar: t.leadAssigneeAvatar,
        dueDate: t.dueDate,
        filterType: "STRATEGIC",
        badgeLabel: "Nhiệm vụ trọng tâm",
        badgeVariant: "default",
        actionType: "MONITOR",
        actionLabel: "Theo dõi",
        priority,
      });
    }
  }

  return items.sort((a, b) => {
    const weights: Record<string, number> = {
      PENDING_APPROVAL: 0,
      BLOCKED_OVERDUE: 1,
      STRATEGIC: 2,
    };
    return (weights[a.filterType] ?? 9) - (weights[b.filterType] ?? 9);
  });
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
        return (
          t.progressPercent === 100 ||
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
