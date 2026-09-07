import { prisma } from "@/lib/prisma";
import type { DashboardPayload, SchoolTask, StaffTask, DashboardStats } from "@/types/dashboard";
import type { DepartmentHealthSummary } from "@/lib/executive-matrix-aggregator";
import { TaskScope, TaskStatus } from "@prisma/client";

export interface LiveDashboardOptions {
  userId?: string;
  departmentId?: string;
  academicMonth?: number;
  academicYear?: string;
}

export async function getLiveDashboardData(options?: LiveDashboardOptions): Promise<DashboardPayload> {
  const whereTask: any = { scope: TaskScope.SCHOOL };
  if (options?.academicMonth) whereTask.academicMonth = options.academicMonth;
  if (options?.academicYear) whereTask.academicYear = options.academicYear;
  if (options?.departmentId && options.departmentId !== "all") {
    whereTask.departmentId = options.departmentId;
  }

  // Tải danh sách nhiệm vụ cấp trường kèm subTasks và assignees
  const dbTasks = await prisma.task.findMany({
    where: whereTask,
    include: {
      department: true,
      assignees: { include: { user: true } },
      deliverables: true,
      resolutions: true,
      subTasks: {
        include: {
          department: true,
          assignees: { include: { user: true } },
          deliverables: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  // Chuyển đổi Prisma Tasks sang định dạng SchoolTask[]
  const mappedTasks: SchoolTask[] = dbTasks.map((t) => {
    const leadAssignee = t.assignees.find((a) => a.roleInTask === "PRIMARY_OWNER");
    const coAssignees = t.assignees
      .filter((a) => a.roleInTask !== "PRIMARY_OWNER")
      .map((a) => a.user?.name || "")
      .filter(Boolean);

    const subTasks: StaffTask[] = (t.subTasks || []).map((sub) => {
      const subOwner = sub.assignees.find((a) => a.roleInTask === "PRIMARY_OWNER");
      return {
        id: sub.id,
        title: sub.title,
        assigneeName: subOwner?.user?.name || "Chưa phân công",
        status: sub.status as any,
        dueDate: sub.dueDate.toISOString().split("T")[0],
        internalDueDate: sub.dueDate.toISOString().split("T")[0],
        deliverableDescription: sub.description || "",
        parentSchoolTaskId: t.id,
        departmentCode: sub.department?.id || undefined,
        departmentId: sub.department?.id || undefined,
        deliverables: (sub.deliverables || []).map((d) => ({
          id: d.id,
          name: d.title,
          url: d.fileUrl,
          fileType: "application/pdf",
          submittedAt: d.createdAt.toISOString().split("T")[0],
        })),
        updatedAt: sub.updatedAt.toISOString().split("T")[0],
      };
    });

    return {
      id: t.id,
      title: t.title,
      category: (t.scope === "SCHOOL" ? "Chỉ đạo cấp Trường" : "Chuyên môn") as any,
      categoryLabel: t.scope === "SCHOOL" ? "Chỉ đạo cấp Trường" : "Chuyên môn",
      leadAssigneeName: leadAssignee?.user?.name || "Chưa phân công",
      leadAssigneeAvatar: leadAssignee?.user?.avatarUrl || undefined,
      leadDepartment: t.department?.name,
      leadDepartmentCode: t.department?.id,
      leadDepartmentId: t.department?.id,
      coAssignees,
      assignedDate: t.startDate.toISOString().split("T")[0],
      dueDate: t.dueDate.toISOString().split("T")[0],
      status: t.status as any,
      subTasks,
      totalSubTasks: subTasks.length,
      completedSubTasks: subTasks.filter((s) => s.status === "COMPLETED").length,
      progressPercent: t.progressPercent,
    };
  });

  // Tính toán DashboardStats
  const total = mappedTasks.length;
  const inProgress = mappedTasks.filter((t) => t.status === "IN_PROGRESS").length;
  const completed = mappedTasks.filter((t) => t.status === "COMPLETED").length;
  const overdue = mappedTasks.filter(
    (t) => (t.status as string) === "OVERDUE" || (t.dueDate < "2026-09-07" && t.status !== "COMPLETED")
  ).length;
  const pendingApprovals = mappedTasks.filter(
    (t) => (t.status as string) === "WAITING_APPROVAL" || t.status === "PENDING_EXECUTIVE_APPROVAL"
  ).length;

  const stats: DashboardStats = {
    totalTasks: total,
    inProgressTasks: inProgress,
    completedTasks: completed,
    overdueTasks: overdue,
    pendingApprovals,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,

    totalSchoolTasks: total,
    schoolTasksInProgress: inProgress,
    schoolTasksCompleted: completed,
    totalStaffTasks: mappedTasks.reduce((acc, t) => acc + (t.subTasks?.length || 0), 0),
    staffTasksInProgress: mappedTasks.reduce((acc, t) => acc + (t.subTasks?.filter((s) => s.status === "IN_PROGRESS").length || 0), 0),
    staffTasksCompleted: mappedTasks.reduce((acc, t) => acc + (t.subTasks?.filter((s) => s.status === "COMPLETED").length || 0), 0),
    needsReviewTasksCount: pendingApprovals,
    overdueTasksCount: overdue,
    averageSchoolProgressPercent: total > 0 ? Math.round(mappedTasks.reduce((acc, t) => acc + (t.progressPercent || 0), 0) / total) : 0,
  };

  // Ma trận 11 phòng ban
  const departments = await prisma.department.findMany({
    include: { tasks: true },
  });

  const departmentHealth: DepartmentHealthSummary[] = departments.map((d) => {
    const dTasks = d.tasks || [];
    const dTotal = dTasks.length;
    const dCompleted = dTasks.filter((t) => t.status === "COMPLETED").length;
    const dInProgress = dTasks.filter((t) => t.status === "IN_PROGRESS").length;
    const dOverdue = dTasks.filter((t) => t.status === "OVERDUE" || (t.dueDate < new Date() && t.status !== "COMPLETED")).length;

    return {
      departmentId: d.id,
      departmentCode: d.id,
      departmentName: d.name,
      shortName: d.shortName || d.id,
      leadName: d.name,
      totalTasks: dTotal,
      totalTasksCount: dTotal,
      completedTasks: dCompleted,
      completedTasksCount: dCompleted,
      inProgressTasks: dInProgress,
      inProgressTasksCount: dInProgress,
      overdueTasks: dOverdue,
      overdueTasksCount: dOverdue,
      blockedTasksCount: 0,
      averageProgressPercent: dTotal > 0 ? Math.round((dCompleted / dTotal) * 100) : 0,
      completionRate: dTotal > 0 ? Math.round((dCompleted / dTotal) * 100) : 0,
      status: dOverdue > 0 ? "critical" : dCompleted === dTotal && dTotal > 0 ? "good" : "warning",
    };
  });

  return {
    source: "database",
    tasks: mappedTasks,
    stats,
    departmentHealth,
    upcoming: [],
    activities: [],
    syncTimestamp: new Date().toISOString(),
  };
}
