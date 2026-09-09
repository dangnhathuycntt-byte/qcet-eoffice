import { prisma } from "@/lib/prisma";
import { mapPrismaTaskToStaffTask, formatLocalDate } from "@/lib/adapters/task-db-adapter";
import type {
  DashboardPayload,
  SchoolTask,
  StaffTask,
  DashboardStats,
  UpcomingItem,
  ActivityEvent,
} from "@/types/dashboard";
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
      parentTask: {
        select: { id: true, code: true, title: true, scope: true },
      },
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
      const staff = mapPrismaTaskToStaffTask(sub as any);
      staff.parentSchoolTaskId = staff.parentSchoolTaskId || t.id;
      staff.parentSchoolTaskTitle = staff.parentSchoolTaskTitle || t.title;
      staff.parentSchoolTaskCode = staff.parentSchoolTaskCode || t.code;
      staff.parentTaskScope = staff.parentTaskScope || t.scope;
      return staff;
    });

    const totalSub = subTasks.length;
    const completedSub = subTasks.filter((s) => s.status === "COMPLETED").length;
    const rolledUpProgress = totalSub > 0
      ? Math.round(
          subTasks.reduce((acc, s) => {
            const isCompleted = s.status === "COMPLETED";
            const p = isCompleted ? 100 : ((s as any).progressPercent ?? 0);
            return acc + p;
          }, 0) / totalSub
        )
      : 0;
    const progressPercent = t.progressPercent > 0 ? t.progressPercent : rolledUpProgress;

    return {
      id: t.id,
      code: t.code,
      taskCode: t.code,
      title: t.title,
      category: (t.scope === "SCHOOL" ? "Chỉ đạo cấp Trường" : "Chuyên môn") as any,
      categoryLabel: t.scope === "SCHOOL" ? "Chỉ đạo cấp Trường" : "Chuyên môn",
      leadAssigneeName: leadAssignee?.user?.name || "Chưa phân công",
      leadAssigneeId: leadAssignee?.user?.id || leadAssignee?.userId,
      leadAssigneeAvatar: leadAssignee?.user?.avatarUrl || undefined,
      assignedTo: leadAssignee?.user?.name || "Chưa phân công",
      leadDepartment: t.department?.name,
      leadDepartmentCode: t.department?.id,
      leadDepartmentId: t.department?.id,
      department: t.department?.name,
      departmentCode: t.department?.id,
      departmentId: t.department?.id,
      coAssignees,
      assignedDate: t.startDate.toISOString().split("T")[0],
      dueDate: t.dueDate.toISOString().split("T")[0],
      status: t.status as any,
      subTasks,
      totalSubTasks: totalSub,
      completedSubTasks: completedSub,
      progressPercent,
      parentTaskId: t.parentTaskId || (t as any).parentTask?.id || undefined,
      parentTaskTitle: (t as any).parentTask?.title || undefined,
      parentTaskCode: (t as any).parentTask?.code || undefined,
      parentTask: (t as any).parentTask || undefined,
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

  // Tổng hợp Upcoming Items (Hạn chót sắp đến & Quá hạn từ nhiệm vụ cấp trường và đơn vị)
  const referenceDateStr = "2026-09-09";
  const upcomingItems: UpcomingItem[] = [];

  for (const t of mappedTasks) {
    if (t.status !== "COMPLETED") {
      upcomingItems.push({
        id: `upcoming-school-${t.id}`,
        taskId: t.id,
        title: t.title,
        dueDate: t.dueDate,
        assigneeName: t.leadAssigneeName,
        assigneeAvatar: t.leadAssigneeAvatar,
        level: "Trường",
        category: t.category,
        isOverdue: t.dueDate < referenceDateStr,
      });
    }

    for (const sub of t.subTasks || []) {
      if (sub.status !== "COMPLETED") {
        upcomingItems.push({
          id: `upcoming-sub-${sub.id}`,
          taskId: sub.id,
          title: sub.title,
          dueDate: sub.dueDate,
          assigneeName: sub.assigneeName,
          level: "Đơn vị",
          category: t.category,
          isOverdue: sub.dueDate < referenceDateStr,
        });
      }
    }
  }

  // Sắp xếp theo thứ tự hạn chót tăng dần (quá hạn và cận hạn lên trước)
  upcomingItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const upcoming = mappedTasks.length > 0 ? upcomingItems.slice(0, 20) : [];

  // Tổng hợp Activity Events từ thông báo hệ thống và tác vụ gần nhất (khi có tasks)
  let activities: ActivityEvent[] = [];
  if (mappedTasks.length > 0) {
    const recentNotifications = await prisma.notification.findMany({
      take: 15,
      orderBy: { createdAt: "desc" },
      include: { user: true },
    });

    activities = recentNotifications.map((n) => {
      let action = "cập nhật trạng thái";
      if (n.type === "assigned" || n.title.includes("GIAO VIỆC")) {
        action = "đã phân công nhiệm vụ";
      } else if (n.type === "directive" || n.title.includes("CHỈ ĐẠO")) {
        action = "đã ban hành ý kiến chỉ đạo";
      } else if (n.title.includes("hoàn thành")) {
        action = "đã hoàn thành nhiệm vụ";
      } else if (n.title.includes("minh chứng") || n.title.includes("sản phẩm")) {
        action = "đã nộp minh chứng cho";
      }

      return {
        id: `act-notif-${n.id}`,
        actorName: n.actorName || n.user?.name || "Lãnh đạo QCET",
        action,
        targetTitle: n.title.replace(/^\[.*?\]\s*/, ""),
        timestamp: n.createdAt.toISOString(),
        category: n.category === "resolution" ? "CHUYEN_DOI_SO" : "CNTT",
      };
    });
  }

  return {
    source: "database",
    tasks: mappedTasks,
    stats,
    departmentHealth,
    upcoming,
    activities,
    syncTimestamp: new Date().toISOString(),
  };
}
