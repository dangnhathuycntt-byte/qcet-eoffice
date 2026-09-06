import type { SchoolTask, StaffTask } from "@/types/dashboard";
import type { DepartmentNode } from "@/components/org/organization-tree";

export type DepartmentRAGStatus = "GREEN" | "AMBER" | "RED";

export interface DepartmentTaskStats {
  totalTasks: number;
  schoolTasksCount: number;
  unitTasksCount: number;
  completedTasksCount: number;
  inProgressTasksCount: number;
  blockedTasksCount: number;
  overdueTasksCount: number;
  averageProgress: number;
  ragStatus: DepartmentRAGStatus;
  ragReason: string;
}

export interface DepartmentTaskGroup {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  category: string;
  categoryLabel: string;
  leaderName: string;
  leaderRole: string;
  stats: DepartmentTaskStats;
  schoolTasks: SchoolTask[];
  unitTasks: StaffTask[];
  allTasks: (SchoolTask | StaffTask)[];
}

function isDatePast(dueDateStr?: string, refDateStr: string = "2026-09-06"): boolean {
  if (!dueDateStr) return false;
  return dueDateStr < refDateStr;
}

export function aggregateTasksByDepartment(
  tasks: SchoolTask[],
  departments: DepartmentNode[],
  referenceDate: string = "2026-09-06"
): DepartmentTaskGroup[] {
  interface DepartmentAccumulator {
    dept: DepartmentNode;
    schoolTasks: SchoolTask[];
    unitTasks: StaffTask[];
  }

  // Accumulator theo dept.code chuan
  const groupsByCode = new Map<string, DepartmentAccumulator>();
  // Lookup map ho tro tra cuu da chieu (code, id, name, shortName)
  const lookupMap = new Map<string, DepartmentAccumulator>();

  for (const dept of departments) {
    const acc: DepartmentAccumulator = {
      dept,
      schoolTasks: [],
      unitTasks: [],
    };
    groupsByCode.set(dept.code.toUpperCase(), acc);

    // 1. Theo code
    lookupMap.set(dept.code.toUpperCase(), acc);
    lookupMap.set(dept.code.toLowerCase(), acc);

    // 2. Theo ID
    lookupMap.set(dept.id.toUpperCase(), acc);
    lookupMap.set(dept.id.toLowerCase(), acc);

    // 3. Theo bien the ID (bo tien to dept-, khoa-, phong-, tt-)
    const strippedId = dept.id.replace(/^(dept|khoa|phong|tt)-/i, "");
    lookupMap.set(strippedId.toUpperCase(), acc);
    lookupMap.set(strippedId.toLowerCase(), acc);
    lookupMap.set(`khoa-${strippedId}`.toLowerCase(), acc);
    lookupMap.set(`phong-${strippedId}`.toLowerCase(), acc);
    lookupMap.set(`dept-${strippedId}`.toLowerCase(), acc);

    // 4. Theo ten day du (normalized lowercase)
    lookupMap.set(dept.name.trim().toLowerCase(), acc);

    // 5. Theo ten viet tat neu co
    if (dept.shortName) {
      lookupMap.set(dept.shortName.trim().toLowerCase(), acc);
    }
  }

  function resolveTarget(identifier?: string): DepartmentAccumulator | undefined {
    if (!identifier) return undefined;
    const clean = identifier.trim();
    if (!clean) return undefined;

    return (
      lookupMap.get(clean) ||
      lookupMap.get(clean.toUpperCase()) ||
      lookupMap.get(clean.toLowerCase()) ||
      Array.from(groupsByCode.values()).find(
        (acc) =>
          acc.dept.name.toLowerCase() === clean.toLowerCase() ||
          acc.dept.code.toLowerCase() === clean.toLowerCase() ||
          acc.dept.id.toLowerCase() === clean.toLowerCase() ||
          (acc.dept.shortName && acc.dept.shortName.toLowerCase() === clean.toLowerCase())
      )
    );
  }

  const fallbackBgh = lookupMap.get("BGH") || Array.from(groupsByCode.values())[0];

  // Gom cac school tasks
  for (const task of tasks) {
    const target =
      resolveTarget(task.leadDepartmentId) ||
      resolveTarget(task.leadDepartmentCode) ||
      resolveTarget(task.leadDepartment) ||
      fallbackBgh;

    if (target) {
      target.schoolTasks.push(task);
    }

    // Gom cac subTasks (cong viec don vi / chuyen vien)
    for (const sub of task.subTasks || []) {
      const subTarget =
        resolveTarget(sub.departmentId) ||
        resolveTarget(sub.departmentCode) ||
        resolveTarget((sub as any).department) ||
        target;

      if (subTarget) {
        subTarget.unitTasks.push(sub);
      }
    }
  }

  // Tinh toan chi so thong ke va RAG status
  return departments.map((dept) => {
    const data = groupsByCode.get(dept.code.toUpperCase())!;
    const schoolTasks = data.schoolTasks;
    const unitTasks = data.unitTasks;

    let completed = 0;
    let inProgress = 0;
    let blocked = 0;
    let overdue = 0;
    let totalProgressSum = 0;

    // Xet School Tasks
    for (const st of schoolTasks) {
      const isCompleted = st.status === "COMPLETED";
      const isPast = !isCompleted && isDatePast(st.dueDate, referenceDate);
      if (isCompleted) {
        completed++;
        totalProgressSum += 100;
      } else {
        inProgress++;
        totalProgressSum += typeof st.progressPercent === "number" ? st.progressPercent : 0;
      }
      if (isPast) overdue++;
    }

    // Xet Unit Tasks
    for (const ut of unitTasks) {
      const isCompleted = ut.status === "COMPLETED";
      const isBlocked = ut.status === "BLOCKED";
      const isPast = !isCompleted && isDatePast(ut.dueDate, referenceDate);

      if (isCompleted) {
        completed++;
        totalProgressSum += 100;
      } else if (isBlocked) {
        blocked++;
      } else {
        inProgress++;
        if (ut.status === "IN_PROGRESS" || ut.status === "NEEDS_REVIEW") {
          totalProgressSum += 50;
        }
      }

      if (isPast) overdue++;
    }

    const totalTasks = schoolTasks.length + unitTasks.length;
    const averageProgress =
      totalTasks > 0 ? Math.round(totalProgressSum / totalTasks) : 0;

    // Xac dinh RAG Status theo chuan kiem soat dai hoc
    let ragStatus: DepartmentRAGStatus = "GREEN";
    let ragReason = "Tiến độ bình thường";

    if (overdue > 0 || (totalTasks > 0 && averageProgress < 40)) {
      ragStatus = "RED";
      ragReason = overdue > 0 ? `Có ${overdue} nhiệm vụ trễ hạn` : `Tiến độ thấp (${averageProgress}%)`;
    } else if (blocked > 0 || (totalTasks > 0 && averageProgress < 70)) {
      ragStatus = "AMBER";
      ragReason = blocked > 0 ? `Có ${blocked} nhiệm vụ bị nghẽn` : `Cần theo dõi (${averageProgress}%)`;
    }

    const stats: DepartmentTaskStats = {
      totalTasks,
      schoolTasksCount: schoolTasks.length,
      unitTasksCount: unitTasks.length,
      completedTasksCount: completed,
      inProgressTasksCount: inProgress,
      blockedTasksCount: blocked,
      overdueTasksCount: overdue,
      averageProgress,
      ragStatus,
      ragReason,
    };

    return {
      departmentId: dept.id,
      departmentCode: dept.code,
      departmentName: dept.name,
      category: dept.category,
      categoryLabel: dept.categoryLabel,
      leaderName: dept.leaderName,
      leaderRole: dept.leaderRole,
      stats,
      schoolTasks,
      unitTasks,
      allTasks: [...schoolTasks, ...unitTasks],
    };
  });
}
