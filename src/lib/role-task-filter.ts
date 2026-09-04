import { SchoolTask, UpcomingItem } from "../types/dashboard";
import { AuthUser, UserRole } from "../types/auth";

export { type AuthUser, type UserRole } from "../types/auth";

export const DEFAULT_DEMO_USERS: AuthUser[] = [
  {
    id: "user-admin-bgh",
    name: "Ban Giám hiệu (Hiệu trưởng)",
    email: "bgh@cdktcnqn.edu.vn",
    role: "ADMIN",
    roleLabel: "Ban Giám hiệu (Hiệu trưởng)",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "user-manager-daotao",
    name: "Trần Hùng",
    email: "daotao@cdktcnqn.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng phòng Đào tạo & QLKH (Trần Hùng)",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "user-staff-vinh",
    name: "Nguyễn Ngọc Vinh",
    email: "vinhnn@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên CNTT (Nguyễn Ngọc Vinh)",
    department: "Khoa Công nghệ thông tin",
    departmentCode: "CNTT",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
  },
];

export function canCreateSchoolTask(roleOrUser: UserRole | AuthUser): boolean {
  const role = typeof roleOrUser === "string" ? roleOrUser : roleOrUser.role;
  return role === "ADMIN";
}

export function canAssignUnitTask(roleOrUser: UserRole | AuthUser): boolean {
  const role = typeof roleOrUser === "string" ? roleOrUser : roleOrUser.role;
  return role === "ADMIN" || role === "MANAGER";
}

export function matchesUser(assigneeName?: string, user?: AuthUser): boolean {
  if (!assigneeName || !user) return false;
  const a = assigneeName.trim().toLowerCase();
  const uName = user.name.trim().toLowerCase();
  if (a === uName) return true;
  if (uName.includes(a) || a.includes(uName)) return true;
  if (user.roleLabel) {
    const rLabel = user.roleLabel.trim().toLowerCase();
    if (rLabel.includes(a) || a.includes(rLabel)) return true;
  }
  return false;
}

export function filterTasksByRole(tasks: SchoolTask[], user: AuthUser): SchoolTask[] {
  if (user.role === "ADMIN") {
    return [...tasks];
  }

  if (user.role === "MANAGER") {
    return tasks.filter((task) => {
      // 1. Lead assignee matches manager
      if (matchesUser(task.leadAssigneeName, user)) return true;
      // 2. Co-assignees include manager
      if (task.coAssignees && task.coAssignees.some((ca) => matchesUser(ca, user))) return true;
      // 3. Any subtask belongs to manager's unit/name
      if (task.subTasks && task.subTasks.some((sub) => matchesUser(sub.assigneeName, user))) return true;
      return false;
    });
  }

  // STAFF role: only school tasks that have subtasks assigned to staff,
  // with subtasks filtered down to user's subtasks only, with rollup recalculated
  const result: SchoolTask[] = [];
  for (const task of tasks) {
    const userSubTasks = (task.subTasks || []).filter((sub) => matchesUser(sub.assigneeName, user));
    if (userSubTasks.length > 0) {
      const totalSubTasks = userSubTasks.length;
      const completedSubTasks = userSubTasks.filter((st) => st.status === "COMPLETED").length;
      const progressPercent = totalSubTasks > 0
        ? Math.round((completedSubTasks / totalSubTasks) * 100)
        : (task.status === "COMPLETED" ? 100 : 0);

      result.push({
        ...task,
        subTasks: userSubTasks,
        totalSubTasks,
        completedSubTasks,
        progressPercent,
      });
    }
  }

  return result;
}

export function filterUpcomingByRole(
  items: UpcomingItem[],
  user: AuthUser,
  visibleTasks?: SchoolTask[]
): UpcomingItem[] {
  if (user.role === "ADMIN") {
    return [...items];
  }

  if (user.role === "MANAGER") {
    const visibleTaskIds = visibleTasks
      ? new Set(
          visibleTasks.flatMap((t) => [
            t.id,
            ...t.subTasks.map((st) => st.id),
          ])
        )
      : null;

    return items.filter((item) => {
      if (matchesUser(item.assigneeName, user)) return true;
      if (visibleTaskIds && item.taskId && visibleTaskIds.has(item.taskId)) return true;
      return false;
    });
  }

  // STAFF sees only items assigned directly to them
  return items.filter((item) => matchesUser(item.assigneeName, user));
}
