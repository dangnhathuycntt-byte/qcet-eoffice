import type { SchoolTask } from "@/types/dashboard";
import type {
  ExecutiveDepartmentSummary,
  ExecutiveRAGStatus,
  FocusInitiative,
} from "@/types/executive-command";

export interface DepartmentMetadata {
  id: string;
  code: string;
  name: string;
  head: {
    name: string;
    title: string;
    email?: string;
  };
  aliases: string[];
  keywords: string[];
}

export const QCET_12_DEPARTMENTS: DepartmentMetadata[] = [
  {
    id: "KHOA_CNTT",
    code: "KHOA_CNTT",
    name: "Khoa Công nghệ Thông tin",
    head: {
      name: "TS. Trần Văn Nam",
      title: "Trưởng khoa",
      email: "nam.tran@qcet.edu.vn",
    },
    aliases: ["KHOA_CNTT", "K_CNTT", "dept-k-cntt", "CNTT"],
    keywords: [
      "công nghệ thông tin",
      "cntt",
      "khoa cntt",
      "trần văn nam",
      "nguyễn văn a (khoa cntt)",
      "văn nam",
    ],
  },
  {
    id: "KHOA_DIEN",
    code: "KHOA_DIEN",
    name: "Khoa Điện - Điện tử",
    head: {
      name: "ThS. Lê Thị Mai",
      title: "Trưởng khoa",
      email: "mai.le@qcet.edu.vn",
    },
    aliases: ["KHOA_DIEN", "K_DIEN", "dept-k-dien", "DIEN", "DIEN_TU"],
    keywords: ["điện - điện tử", "điện tử", "khoa điện", "lê thị mai"],
  },
  {
    id: "KHOA_CK",
    code: "KHOA_CK",
    name: "Khoa Cơ khí",
    head: {
      name: "TS. Phạm Quốc Bảo",
      title: "Trưởng khoa",
      email: "bao.pham@qcet.edu.vn",
    },
    aliases: ["KHOA_CK", "K_CK", "dept-k-ck", "CO_KHI", "CK"],
    keywords: ["khoa cơ khí", "cơ khí", "phạm quốc bảo"],
  },
  {
    id: "KHOA_XD",
    code: "KHOA_XD",
    name: "Khoa Xây dựng & Đô thị",
    head: {
      name: "ThS. Hoàng Văn Tuấn",
      title: "Phó Trưởng khoa phụ trách",
      email: "tuan.hoang@qcet.edu.vn",
    },
    aliases: ["KHOA_XD", "K_XD", "dept-k-xd", "XAY_DUNG", "XD", "DO_THI"],
    keywords: [
      "xây dựng & đô thị",
      "xây dựng và đô thị",
      "khoa xây dựng",
      "xây dựng",
      "đô thị",
      "hoàng văn tuấn",
    ],
  },
  {
    id: "KHOA_KTO",
    code: "KHOA_KTO",
    name: "Khoa Kinh tế & Du lịch",
    head: {
      name: "ThS. Đỗ Thị Hồng",
      title: "Trưởng khoa",
      email: "hong.do@qcet.edu.vn",
    },
    aliases: [
      "KHOA_KTO",
      "K_KTO",
      "dept-k-kt",
      "dept-k-kto",
      "KINH_TE",
      "KTO",
      "DU_LICH",
    ],
    keywords: [
      "kinh tế & du lịch",
      "kinh tế và du lịch",
      "khoa kinh tế",
      "kinh tế",
      "du lịch",
      "đỗ thị hồng",
    ],
  },
  {
    id: "KHOA_SP",
    code: "KHOA_SP",
    name: "Khoa Sư phạm & Cơ bản",
    head: {
      name: "ThS. Nguyễn Thị Lan",
      title: "Trưởng khoa",
      email: "lan.nguyen@qcet.edu.vn",
    },
    aliases: ["KHOA_SP", "K_SP", "dept-k-sp", "SU_PHAM", "SP", "CO_BAN"],
    keywords: [
      "sư phạm & cơ bản",
      "sư phạm và cơ bản",
      "khoa sư phạm",
      "sư phạm",
      "cơ bản",
      "nguyễn thị lan",
    ],
  },
  {
    id: "PHONG_DT",
    code: "PHONG_DT",
    name: "Phòng Đào tạo & Quản lý Khoa học",
    head: {
      name: "ThS. Nguyễn Đình Hùng",
      title: "Trưởng phòng",
      email: "hung.nguyen@qcet.edu.vn",
    },
    aliases: [
      "PHONG_DT",
      "P_DT",
      "P_DTQLKH",
      "dept-p-dtqlkh",
      "dept-p-dt",
      "DAO_TAO",
      "QLKH",
      "DTQLKH",
    ],
    keywords: [
      "đào tạo & quản lý khoa học",
      "đào tạo & qlkh",
      "phòng đào tạo",
      "quản lý khoa học",
      "đào tạo",
      "thời khóa biểu",
      "nguyễn đình hùng",
      "đỗ quang trung",
    ],
  },
  {
    id: "PHONG_HCQT",
    code: "PHONG_HCQT",
    name: "Phòng Hành chính - Quản trị",
    head: {
      name: "Ông Vũ Đức Thịnh",
      title: "Trưởng phòng",
      email: "thinh.vu@qcet.edu.vn",
    },
    aliases: ["PHONG_HCQT", "P_HCQT", "dept-p-hcqt", "HANH_CHINH", "HCQT"],
    keywords: [
      "hành chính - quản trị",
      "hành chính và quản trị",
      "phòng hành chính",
      "hành chính",
      "hcqt",
      "vũ đức thịnh",
      "phan văn thanh",
    ],
  },
  {
    id: "PHONG_KHTC",
    code: "PHONG_KHTC",
    name: "Phòng Kế hoạch - Tài chính",
    head: {
      name: "Bà Trần Thị Ngọc Mai",
      title: "Kế toán trưởng, Trưởng phòng",
      email: "mai.tran@qcet.edu.vn",
    },
    aliases: [
      "PHONG_KHTC",
      "P_KHTC",
      "dept-p-khtc",
      "TAI_CHINH",
      "KE_HOACH",
      "KHTC",
    ],
    keywords: [
      "kế hoạch - tài chính",
      "kế hoạch và tài chính",
      "phòng kế hoạch",
      "phòng tài chính",
      "kế toán",
      "tài chính",
      "khtc",
      "trần thị ngọc mai",
      "trần thị mai loan",
    ],
  },
  {
    id: "PHONG_CTHSSV",
    code: "PHONG_CTHSSV",
    name: "Phòng Công tác HSSV",
    head: {
      name: "ThS. Đặng Hữu Phúc",
      title: "Trưởng phòng",
      email: "phuc.dang@qcet.edu.vn",
    },
    aliases: [
      "PHONG_CTHSSV",
      "P_CTHSSV",
      "dept-p-cthssv",
      "CTHSSV",
      "HSSV",
    ],
    keywords: [
      "công tác hssv",
      "phòng công tác hssv",
      "công tác học sinh sinh viên",
      "hssv",
      "học sinh sinh viên",
      "đặng hữu phúc",
      "huỳnh công tuấn",
    ],
  },
  {
    id: "TT_TTTV",
    code: "TT_TTTV",
    name: "Trung tâm Thông tin Thư viện",
    head: {
      name: "ThS. Bùi Thị Vân",
      title: "Giám đốc",
      email: "van.bui@qcet.edu.vn",
    },
    aliases: ["TT_TTTV", "TTTV", "THU_VIEN", "dept-tt-tttv", "dept-tt-tv"],
    keywords: [
      "thông tin thư viện",
      "trung tâm thông tin thư viện",
      "trung tâm thư viện",
      "thư viện",
      "bùi thị vân",
      "chu đình thắng",
    ],
  },
  {
    id: "TT_NNTH",
    code: "TT_NNTH",
    name: "Trung tâm Ngoại ngữ - Tin học",
    head: {
      name: "ThS. Lê Công Hậu",
      title: "Giám đốc",
      email: "hau.le@qcet.edu.vn",
    },
    aliases: ["TT_NNTH", "NNTH", "NGOAI_NGU", "TIN_HOC", "dept-tt-nnth"],
    keywords: [
      "ngoại ngữ - tin học",
      "ngoại ngữ và tin học",
      "trung tâm ngoại ngữ",
      "ngoại ngữ",
      "nnth",
      "lê công hậu",
    ],
  },
];

export const REFERENCE_DATE_DEFAULT = "2026-09-06";

function cleanString(str?: string): string {
  return (str || "").trim().toLowerCase();
}

function stripDeptPrefix(id: string): string {
  return id.replace(/^(dept|khoa|phong|tt)-/i, "");
}

export function matchDepartmentForTask(
  task: SchoolTask,
  departments: DepartmentMetadata[] = QCET_12_DEPARTMENTS
): DepartmentMetadata | undefined {
  // 1. Direct code/ID match on leadDepartmentId or leadDepartmentCode
  const explicitCodes = [
    task.leadDepartmentId,
    task.leadDepartmentCode,
    task.leadDepartment,
  ]
    .filter(Boolean)
    .map((c) => (c as string).trim().toUpperCase());

  for (const code of explicitCodes) {
    const stripped = stripDeptPrefix(code);
    const directMatch = departments.find(
      (d) =>
        d.id === code ||
        d.code === code ||
        stripDeptPrefix(d.id) === stripped ||
        d.aliases.some((a) => a.toUpperCase() === code || stripDeptPrefix(a.toUpperCase()) === stripped)
    );
    if (directMatch) return directMatch;
  }

  // 2. Match by leadAssigneeName
  const leadName = cleanString(task.leadAssigneeName);
  if (leadName) {
    // Check aliases first for exact parenthetical or keyword tag, e.g. "(Khoa CNTT)"
    for (const dept of departments) {
      if (
        dept.aliases.some((a) => {
          const cleanAlias = a.toLowerCase();
          return leadName.includes(cleanAlias);
        })
      ) {
        return dept;
      }
    }

    // Check dept full name
    for (const dept of departments) {
      if (leadName.includes(dept.name.toLowerCase())) {
        return dept;
      }
    }

    // Check dept keywords
    for (const dept of departments) {
      if (dept.keywords.some((kw) => leadName.includes(kw.toLowerCase()))) {
        return dept;
      }
    }
  }

  // 3. Match by task title
  const title = cleanString(task.title);
  if (title) {
    // Check specific multi-word keywords first, then aliases
    const sortedDepts = [...departments].sort((a, b) => {
      const maxLenA = Math.max(...a.keywords.map((k) => k.length));
      const maxLenB = Math.max(...b.keywords.map((k) => k.length));
      return maxLenB - maxLenA;
    });

    for (const dept of sortedDepts) {
      if (dept.keywords.some((kw) => title.includes(kw.toLowerCase()))) {
        return dept;
      }
    }

    for (const dept of departments) {
      if (dept.aliases.some((a) => title.includes(a.toLowerCase()))) {
        return dept;
      }
    }
  }

  // 4. Match by subtasks
  for (const sub of task.subTasks || []) {
    const subDeptCode = (sub.departmentCode || sub.departmentId || "").trim().toUpperCase();
    if (subDeptCode) {
      const match = departments.find(
        (d) =>
          d.id === subDeptCode ||
          d.code === subDeptCode ||
          d.aliases.some((a) => a.toUpperCase() === subDeptCode)
      );
      if (match) return match;
    }

    const subAssignee = cleanString(sub.assigneeName);
    if (subAssignee) {
      for (const dept of departments) {
        if (
          dept.keywords.some((kw) => subAssignee.includes(kw.toLowerCase())) ||
          dept.aliases.some((a) => subAssignee.includes(a.toLowerCase()))
        ) {
          return dept;
        }
      }
    }
  }

  return undefined;
}

export function isTaskOverdue(
  dueDate?: string,
  referenceDate: string = REFERENCE_DATE_DEFAULT
): boolean {
  if (!dueDate) return false;
  const due = dueDate.split("T")[0];
  const ref = referenceDate.split("T")[0];
  return due < ref;
}

export function isTaskDueSoon(
  dueDate?: string,
  referenceDate: string = REFERENCE_DATE_DEFAULT,
  daysWindow: number = 3
): boolean {
  if (!dueDate) return false;
  const dueStr = dueDate.split("T")[0];
  const refStr = referenceDate.split("T")[0];
  if (dueStr < refStr) return false; // Already overdue

  const dueTime = new Date(dueStr).getTime();
  const refTime = new Date(refStr).getTime();
  const diffDays = (dueTime - refTime) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= daysWindow;
}

function resolveTaskPriorityWeight(
  task: SchoolTask,
  referenceDate: string
): number {
  const explicitPriority = (task as unknown as { priority?: string }).priority;
  if (explicitPriority === "HIGH") return 3;
  if (explicitPriority === "MEDIUM") return 2;
  if (explicitPriority === "LOW") return 1;

  if (isTaskOverdue(task.dueDate, referenceDate) || isTaskDueSoon(task.dueDate, referenceDate)) {
    return 3;
  }
  if ((task.progressPercent ?? 0) < 50) {
    return 3;
  }
  if ((task.progressPercent ?? 0) < 80) {
    return 2;
  }
  return 1;
}

export function extractFocusInitiative(
  tasks: SchoolTask[],
  referenceDate: string = REFERENCE_DATE_DEFAULT
): FocusInitiative | undefined {
  if (tasks.length === 0) return undefined;

  const openTasks = tasks.filter((t) => t.status !== "COMPLETED");

  if (openTasks.length > 0) {
    const sorted = [...openTasks].sort((a, b) => {
      const weightA = resolveTaskPriorityWeight(a, referenceDate);
      const weightB = resolveTaskPriorityWeight(b, referenceDate);
      if (weightB !== weightA) {
        return weightB - weightA;
      }
      return (a.dueDate || "").localeCompare(b.dueDate || "");
    });

    const chosen = sorted[0];
    const weight = resolveTaskPriorityWeight(chosen, referenceDate);
    const priority: "HIGH" | "MEDIUM" | "LOW" =
      weight === 3 ? "HIGH" : weight === 2 ? "MEDIUM" : "LOW";

    return {
      taskId: chosen.id,
      title: chosen.title,
      dueDate: chosen.dueDate,
      progressPercent: chosen.progressPercent ?? 0,
      priority,
      categoryLabel: chosen.categoryLabel,
    };
  }

  // Fallback to latest completed task
  const latestCompleted = [...tasks].sort((a, b) =>
    (b.dueDate || "").localeCompare(a.dueDate || "")
  )[0];

  return {
    taskId: latestCompleted.id,
    title: latestCompleted.title,
    dueDate: latestCompleted.dueDate,
    progressPercent: 100,
    priority: "LOW",
    categoryLabel: latestCompleted.categoryLabel,
  };
}

export function computeExecutiveDepartmentSummaries(
  tasks: SchoolTask[],
  referenceDate: string = REFERENCE_DATE_DEFAULT
): ExecutiveDepartmentSummary[] {
  // Map tasks to their corresponding departments
  const tasksByDept = new Map<string, SchoolTask[]>();
  for (const dept of QCET_12_DEPARTMENTS) {
    tasksByDept.set(dept.id, []);
  }

  for (const task of tasks) {
    const matched = matchDepartmentForTask(task, QCET_12_DEPARTMENTS);
    if (matched) {
      tasksByDept.get(matched.id)?.push(task);
    }
  }

  return QCET_12_DEPARTMENTS.map((dept) => {
    const deptTasks = tasksByDept.get(dept.id) || [];
    const totalTasks = deptTasks.length;

    let completed = 0;
    let inProgress = 0;
    let overdue = 0;
    let dueSoon = 0;
    let progressSum = 0;

    for (const task of deptTasks) {
      const isCompleted = task.status === "COMPLETED";
      if (isCompleted) {
        completed++;
        progressSum += 100;
      } else {
        inProgress++;
        progressSum += typeof task.progressPercent === "number" ? task.progressPercent : 0;
        if (isTaskOverdue(task.dueDate, referenceDate)) {
          overdue++;
        } else if (isTaskDueSoon(task.dueDate, referenceDate)) {
          dueSoon++;
        }
      }
    }

    const completionRate = totalTasks > 0 ? Math.round(progressSum / totalTasks) : 100;

    // Evaluate RAG status
    let ragStatus: ExecutiveRAGStatus = "GREEN";
    let ragReason = `Tiến độ đảm bảo (${completionRate}%)`;

    if (overdue > 0 || (completionRate < 35 && totalTasks > 0)) {
      ragStatus = "RED";
      ragReason =
        overdue > 0
          ? `Có ${overdue} nhiệm vụ quá hạn cần BGH chỉ đạo`
          : `Tiến độ hoàn thành thấp (${completionRate}%)`;
    } else if (dueSoon > 0 || (completionRate < 60 && totalTasks > 0)) {
      ragStatus = "AMBER";
      ragReason =
        dueSoon > 0
          ? `Có ${dueSoon} nhiệm vụ sắp đến hạn`
          : `Tiến độ cần theo sát (${completionRate}%)`;
    }

    const pendingApprovalCount = deptTasks.filter(
      (t) =>
        t.status === "PENDING_EXECUTIVE_APPROVAL" ||
        (t.progressPercent === 100 && t.status !== "COMPLETED") ||
        t.subTasks?.some((st) => st.status === "NEEDS_REVIEW" || st.requiresReview === true)
    ).length;

    const schoolLevelTaskCount = deptTasks.length;
    const unitLevelTaskCount = deptTasks.reduce(
      (acc, t) =>
        acc +
        (Array.isArray(t.subTasks) ? t.subTasks.length : t.totalSubTasks || 0),
      0
    );

    const focusInitiative = extractFocusInitiative(deptTasks, referenceDate);

    return {
      departmentId: dept.id,
      departmentCode: dept.code,
      departmentName: dept.name,
      headOfDepartment: { ...dept.head },
      ragStatus,
      ragReason,
      focusInitiative,
      metrics: {
        totalTasks,
        inProgress,
        dueSoon,
        overdue,
        completed,
        completionRate,
      },
      pendingApprovalCount,
      schoolLevelTaskCount,
      unitLevelTaskCount,
      tasks: deptTasks,
    };
  });
}
