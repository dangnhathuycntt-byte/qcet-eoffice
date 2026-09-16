import type { SchoolTask, StaffTask, TaskStatus, TaskCategory } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import type { WorkspaceScope } from "../types";
import { matchesUser } from "@/lib/role-task-filter";
import { computeSchoolTaskRollup } from "@/lib/dashboard-aggregator";
import { CATEGORY_TABS } from "@/components/tasks/cascading-task-table";
import type { CreateTaskFormData, TaskLevel } from "@/components/dashboard/create-task-modal";

export type OptimisticTaskCreationInput = Partial<CreateTaskFormData> & {
  title: string;
  category: TaskCategory;
  dueDate: string;
  level: TaskLevel;
  leadAssigneeName: string;
};

/**
 * Pure helper function to filter tasks according to workspace scope
 */
export function filterTasksByScope(
  tasks: SchoolTask[],
  scope: WorkspaceScope | string = "school",
  user?: AuthUser | null,
  selectedDepartment?: string
): SchoolTask[] {
  const normScope = scope === "SCHOOL_TASKS" ? "school" : scope === "UNIT_TASKS" ? "unit" : scope === "MY_TASKS" ? "my" : scope;

  if (normScope === "school") {
    return tasks;
  }

  if (normScope === "my") {
    if (!user) return [];

    return tasks
      .map((task) => {
        const isLead =
          matchesUser(task.leadAssigneeName, user) ||
          (user.id && (task as any).leadAssigneeId === user.id) ||
          (user.id && (task as any).assignedTo === user.id);

        const isCoAssignee = Boolean(
          task.coAssignees &&
            task.coAssignees.some(
              (ca: any) =>
                (typeof ca === "string" && (ca === user.name || matchesUser(ca, user))) ||
                (ca && typeof ca === "object" && ((user.id && ca.id === user.id) || ca.name === user.name || matchesUser(ca.name, user)))
            )
        );

        const matchingSubtasks = (task.subTasks || []).filter((sub: any) => {
          const isSubAssignee =
            (user.id && (sub.assigneeId === user.id || sub.assignedTo === user.id)) ||
            sub.assigneeName === user.name ||
            matchesUser(sub.assigneeName, user) ||
            matchesUser(sub.assignedTo, user);

          const isSubCollab = Array.isArray(sub.collaborators)
            ? sub.collaborators.some(
                (c: any) =>
                  (user.id && c.id === user.id) ||
                  c.name === user.name ||
                  matchesUser(c.name, user)
              )
            : false;

          return Boolean(isSubAssignee || isSubCollab);
        });

        // If user is DRI (lead), retain full task with all subtasks for coordination
        if (isLead) {
          return { ...task };
        }

        // If user is co-assignee without personal subtasks, show task with subtasks
        if (isCoAssignee && matchingSubtasks.length === 0) {
          return { ...task };
        }

        // If user has specific assigned subtasks, filter to their subtasks
        if (matchingSubtasks.length > 0) {
          return {
            ...task,
            subTasks: matchingSubtasks,
          };
        }

        return null;
      })
      .filter((t): t is SchoolTask => t !== null);
  }

  // scope === "unit"
  const targetDept =
    selectedDepartment && selectedDepartment !== "ALL"
      ? selectedDepartment
      : user?.departmentCode || user?.department;

  if (!targetDept || targetDept === "ALL") {
    return tasks;
  }

  const deptUpper = targetDept.trim().toUpperCase();
  const deptLower = targetDept.trim().toLowerCase();

  return tasks
    .map((task) => {
      const taskDeptCode = (task.departmentCode || task.leadDepartmentCode || "").toUpperCase();
      const taskDeptName = (task.department || task.leadDepartment || "").toLowerCase();
      const taskDeptId = (task as any).departmentId || (task as any).leadDepartmentId || "";

      const isLeadDept =
        taskDeptCode === deptUpper ||
        taskDeptName === deptLower ||
        taskDeptName.includes(deptLower) ||
        (taskDeptId && taskDeptId.toUpperCase() === deptUpper);

      const isCoDept = Boolean(
        task.coDepartmentCodes?.some((c) => c.toUpperCase() === deptUpper) ||
        task.coDepartments?.some(
          (d) => d.toLowerCase() === deptLower || d.toLowerCase().includes(deptLower)
        )
      );

      const matchingSubtasks = (task.subTasks || []).filter((sub: any) => {
        const subDeptCode = (sub.departmentCode || "").toUpperCase();
        const subDeptName = (sub.department || "").toLowerCase();
        const subDeptId = (sub.departmentId || "").toUpperCase();

        return (
          subDeptCode === deptUpper ||
          subDeptName === deptLower ||
          subDeptName.includes(deptLower) ||
          subDeptId === deptUpper
        );
      });

      if (isLeadDept || isCoDept) {
        return {
          ...task,
          subTasks: matchingSubtasks.length > 0 ? matchingSubtasks : task.subTasks,
        };
      }

      if (matchingSubtasks.length > 0) {
        return {
          ...task,
          subTasks: matchingSubtasks,
        };
      }

      return null;
    })
    .filter((t): t is SchoolTask => t !== null);
}

/**
 * Pure helper function to apply optimistic status changes and recalculate rollups
 */
export function applyOptimisticStatusChange(
  tasks: SchoolTask[],
  taskId: string,
  newStatus: TaskStatus
): SchoolTask[] {
  const updatedTasks = tasks.map((st) => {
    if (st.id === taskId) {
      const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
        newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
      return { ...st, status: schoolStatus };
    }
    const updatedSubs = (st.subTasks || []).map((sub) =>
      sub.id === taskId ? { ...sub, status: newStatus } : sub
    );
    return { ...st, subTasks: updatedSubs };
  });

  return updatedTasks.map((t) => computeSchoolTaskRollup(t));
}

/**
 * Pure helper function to apply optimistic task creation
 */
export function applyOptimisticCreateTask(
  tasks: SchoolTask[],
  data: OptimisticTaskCreationInput,
  todayStr: string = new Date().toISOString().split("T")[0]
): SchoolTask[] {
  let updatedTasks = [...tasks];

  if (data.level === "TRUONG") {
    const newTask: SchoolTask = {
      id: `task-temp-${Date.now()}`,
      title: data.title,
      category: data.category,
      categoryLabel:
        CATEGORY_TABS.find((c) => c.id === data.category)?.label || data.category,
      leadAssigneeName: data.leadAssigneeName,
      coAssignees: data.coAssignees || [],
      assignedDate: todayStr,
      dueDate: data.dueDate,
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 0,
    };
    updatedTasks = [newTask, ...updatedTasks];
  } else {
    const newSubTask: StaffTask = {
      id: `sub-temp-${Date.now()}`,
      title: data.title,
      assigneeName: data.leadAssigneeName,
      status: "NEW",
      dueDate: data.dueDate,
      internalDueDate: data.internalDueDate,
      deliverableDescription: data.requiredDeliverables,
      vtvlRole: data.vtvlRole,
      requiresReview: data.requiresReview,
      parentSchoolTaskId: data.parentTaskId || updatedTasks[0]?.id || "task-1",
      updatedAt: todayStr,
    };

    if (data.parentTaskId) {
      updatedTasks = updatedTasks.map((st) => {
        if (st.id === data.parentTaskId) {
          return {
            ...st,
            subTasks: [newSubTask, ...(st.subTasks || [])],
          };
        }
        return st;
      });
    } else if (updatedTasks.length > 0) {
      updatedTasks[0] = {
        ...updatedTasks[0],
        subTasks: [newSubTask, ...(updatedTasks[0].subTasks || [])],
      };
    }
  }

  return updatedTasks.map((t) => computeSchoolTaskRollup(t));
}
