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
  // Khoi tao accumulator cho tung department
  const groupsMap = new Map<
    string,
    {
      dept: DepartmentNode;
      schoolTasks: SchoolTask[];
      unitTasks: StaffTask[];
    }
  >();

  for (const dept of departments) {
    groupsMap.set(dept.code.toUpperCase(), {
      dept,
      schoolTasks: [],
      unitTasks: [],
    });
  }

  // Gom cac school tasks
  for (const task of tasks) {
    const rawCode = (task.leadDepartmentCode || task.leadDepartment || "BGH").toUpperCase();
    const target = groupsMap.get(rawCode) || groupsMap.get("BGH");
    if (target) {
      target.schoolTasks.push(task);
    }

    // Gom cac subTasks (cong viec don vi / chuyen vien)
    for (const sub of task.subTasks || []) {
      const subCode = (sub.departmentCode || rawCode).toUpperCase();
      const subTarget = groupsMap.get(subCode) || target;
      if (subTarget) {
        subTarget.unitTasks.push(sub);
      }
    }
  }

  // Tinh toan chi so thong ke va RAG status
  return departments.map((dept) => {
    const data = groupsMap.get(dept.code.toUpperCase())!;
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
      } else if (isBlocked) {
        blocked++;
      } else {
        inProgress++;
      }

      if (isPast) overdue++;
    }

    const totalTasks = schoolTasks.length + unitTasks.length;
    const averageProgress =
      schoolTasks.length > 0 ? Math.round(totalProgressSum / schoolTasks.length) : 0;

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
