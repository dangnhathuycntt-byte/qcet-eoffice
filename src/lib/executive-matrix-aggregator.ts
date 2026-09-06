import type { SchoolTask, TaskCategory } from "@/types/dashboard";
import { isTaskPastDue, TODAY_ISO } from "./unified-task-hub";

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

export interface DepartmentHealthSummary {
  departmentId: string;
  departmentName: string;
  leadName: string;
  totalTasksCount: number;
  completedTasksCount: number;
  inProgressTasksCount: number;
  blockedTasksCount: number;
  overdueTasksCount: number;
  averageProgressPercent: number;
}

export interface DepartmentDefinition {
  id: string;
  name: string;
  leadName: string;
  alternateCodes: string[];
  categories?: TaskCategory[];
  personnelKeywords: string[];
}

export const QCET_DEPARTMENT_DEFINITIONS: DepartmentDefinition[] = [
  {
    id: "BGH",
    name: "Ban Giám hiệu",
    leadName: "TS. Nguyễn Minh Tuấn",
    alternateCodes: ["dept-bgh", "BGH", "HIEU_TRUONG"],
    personnelKeywords: ["Tuấn", "Đạt", "Cúc", "BGH", "Hiệu trưởng"],
  },
  {
    id: "CNTT",
    name: "Khoa Công nghệ thông tin",
    leadName: "TS. Nguyễn Ngọc Vinh",
    alternateCodes: ["dept-k-cntt", "K_CNTT", "CNTT", "KHOA_CNTT"],
    categories: ["CNTT", "ATTT", "CHUYEN_DOI_SO"],
    personnelKeywords: ["Vinh", "Hùng", "Khôi"],
  },
  {
    id: "DAO_TAO",
    name: "Phòng Đào tạo & QLKH",
    leadName: "ThS. Đỗ Quang Trung",
    alternateCodes: ["dept-p-dtqlkh", "P_DTQLKH", "DAO_TAO", "DTQLKH", "PHONG_DAO_TAO"],
    categories: ["BAO_CAO"],
    personnelKeywords: ["Trung", "Trí", "Thủy"],
  },
  {
    id: "TRUYEN_THONG",
    name: "TT Truyền thông & Số hóa",
    leadName: "ThS. Mai Đinh Thị Xuân",
    alternateCodes: ["dept-tt-dcc", "TT_DCC", "TRUYEN_THONG", "DCC"],
    categories: ["TRUYEN_THONG"],
    personnelKeywords: ["Xuân", "Huy", "Linh"],
  },
  {
    id: "HANH_CHINH",
    name: "Phòng Hành chính - Quản trị",
    leadName: "ThS. Phan Văn Thanh",
    alternateCodes: ["dept-p-hcqt", "P_HCQT", "HANH_CHINH", "HCQT"],
    personnelKeywords: ["Thanh", "Nam", "Nhung"],
  },
  {
    id: "KHAO_THI",
    name: "Phòng Khảo thí & ĐBCL",
    leadName: "TS. Nguyễn Công Minh",
    alternateCodes: ["dept-p-ktdbcl", "P_KTDBCL", "KHAO_THI", "KTDBCL"],
    personnelKeywords: ["Minh", "Hậu", "My"],
  },
  {
    id: "THU_VIEN",
    name: "TT Ngoại ngữ - TH & Thư viện",
    leadName: "ThS. Chu Đình Thắng",
    alternateCodes: ["dept-tt-nnth", "TT_NNTH", "THU_VIEN", "NNTH"],
    categories: ["THU_VIEN"],
    personnelKeywords: ["Thắng", "Thu", "Ngọc"],
  },
  {
    id: "KINH_TE",
    name: "Khoa Kinh tế - Quản trị",
    leadName: "TS. Lê Thị Ánh Tuyết",
    alternateCodes: ["dept-k-ktqt", "K_KTQT", "KINH_TE", "KTQT"],
    personnelKeywords: ["Tuyết", "Sơn", "Phượng"],
  },
  {
    id: "KY_THUAT",
    name: "Khoa Kỹ thuật - Công nghệ",
    leadName: "TS. Đinh Quốc Cường",
    alternateCodes: ["dept-k-ktcn", "K_KTCN", "KY_THUAT", "KTCN"],
    personnelKeywords: ["Cường", "Vũ", "Lộc"],
  },
  {
    id: "TAI_CHINH",
    name: "Phòng Kế hoạch - Tài chính",
    leadName: "ThS. Trần Thị Mai Loan",
    alternateCodes: ["dept-p-khtc", "P_KHTC", "TAI_CHINH", "KHTC"],
    personnelKeywords: ["Loan", "Vân", "Hào"],
  },
  {
    id: "CTHSSV",
    name: "Phòng Công tác HSSV",
    leadName: "ThS. Huỳnh Công Tuấn",
    alternateCodes: ["dept-p-cthssv", "P_CTHSSV", "CTHSSV"],
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
    if (task.status !== "COMPLETED") {
      const isCompleteProgress =
        task.progressPercent === 100 ||
        task.status === "PENDING_EXECUTIVE_APPROVAL";
      const hasSubtaskNeedingReview = (task.subTasks || []).some(
        (st) => st.status === "NEEDS_REVIEW" || st.requiresReview === true
      );
      if (isCompleteProgress || hasSubtaskNeedingReview) {
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
      if (sub.status === "BLOCKED") {
        blockedTasksCount++;
      }
    }

    if (task.status !== "COMPLETED" && isTaskPastDue(task.dueDate, referenceDate)) {
      overdueTasksCount++;
    }
    for (const sub of task.subTasks || []) {
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
    const parentDeptId =
      resolveDepartmentId(task.leadDepartmentCode) ||
      resolveDepartmentId(task.leadDepartment) ||
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
      const subDeptId =
        resolveDepartmentId(sub.departmentCode) ||
        resolveDepartmentId(undefined, sub.assigneeName) ||
        parentDeptId;

      const subStats = deptMap.get(subDeptId);
      if (subStats) {
        subStats.totalTasksCount++;

        const isSubCompleted = sub.status === "COMPLETED";
        const isSubBlocked = sub.status === "BLOCKED";

        if (isSubCompleted) {
          subStats.completedTasksCount++;
          subStats.totalProgress += 100;
        } else if (isSubBlocked) {
          subStats.blockedTasksCount++;
        } else {
          subStats.inProgressTasksCount++;
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

    return {
      departmentId: def.id,
      departmentName: def.name,
      leadName: def.leadName,
      totalTasksCount: stats.totalTasksCount,
      completedTasksCount: stats.completedTasksCount,
      inProgressTasksCount: stats.inProgressTasksCount,
      blockedTasksCount: stats.blockedTasksCount,
      overdueTasksCount: stats.overdueTasksCount,
      averageProgressPercent,
    };
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
      return tasks.filter(
        (t) => t.progressPercent === 100 && t.status !== "COMPLETED"
      );
    case "BLOCKED_OVERDUE":
      return tasks.filter((t) => {
        if ((t.status as string) === "BLOCKED") return true;
        if (
          t.status !== "COMPLETED" &&
          isTaskPastDue(t.dueDate, referenceDate)
        ) {
          return true;
        }
        const hasBlockedSub = (t.subTasks || []).some(
          (sub) =>
            sub.status === "BLOCKED" ||
            (sub.status !== "COMPLETED" &&
              isTaskPastDue(sub.dueDate, referenceDate))
        );
        return hasBlockedSub;
      });
    case "STRATEGIC":
      return tasks.filter((t) => t.status === "IN_PROGRESS");
    default:
      return tasks;
  }
}
