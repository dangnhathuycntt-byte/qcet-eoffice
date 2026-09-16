import { prisma } from "@/lib/prisma";
import { mapPrismaTaskToStaffTask, formatLocalDate } from "@/lib/adapters/task-db-adapter";
import type {
  DashboardPayload,
  SchoolTask,
  StaffTask,
  DashboardStats,
  UpcomingItem,
  ActivityEvent,
  TaskCategory,
} from "@/types/dashboard";
import type { DepartmentHealthSummary } from "@/lib/executive-matrix-aggregator";
import { TaskScope, TaskStatus } from "@prisma/client";
import { getSystemReferenceDate, isTaskPastDue } from "@/lib/academic-calendar";

export const VALID_TASK_CATEGORIES = new Set<string>([
  "CHUYEN_DOI_SO",
  "TRUYEN_THONG",
  "CNTT",
  "ATTT",
  "THU_VIEN",
  "BAO_CAO",
  "KHAC",
]);

export interface LiveDashboardOptions {
  userId?: string;
  departmentId?: string;
  academicMonth?: number;
  academicYear?: string;
}

export async function getLiveDashboardData(options?: LiveDashboardOptions): Promise<DashboardPayload> {
  const referenceDate = getSystemReferenceDate();

  // Active dataset scope for this request. `"all"` (school-wide view) disables department confinement.
  const scopedDepartmentId =
    options?.departmentId && options.departmentId !== "all" ? options.departmentId : undefined;

  const whereTask: any = {
    scope: { in: [TaskScope.SCHOOL, TaskScope.DEPARTMENT] },
    parentTaskId: null,
    status: { not: TaskStatus.CANCELLED },
  };
  if (options?.academicMonth) whereTask.academicMonth = options.academicMonth;
  if (options?.academicYear) whereTask.academicYear = options.academicYear;
  if (scopedDepartmentId) {
    whereTask.departmentId = scopedDepartmentId;
  }
  if (options?.userId) {
    whereTask.assignees = {
      some: { userId: options.userId },
    };
  }

  // Ma trận 11 phòng ban
  const deptTaskWhere: any = {
    status: { not: TaskStatus.CANCELLED },
  };
  if (options?.academicMonth) deptTaskWhere.academicMonth = options.academicMonth;
  if (options?.academicYear) deptTaskWhere.academicYear = options.academicYear;

  // Tối ưu hóa truy vấn song song (Parallel execution) & loại bỏ overfetching (QCET-PERF-2025-01)
  const [dbTasks, departments, recentNotifications] = await Promise.all([
    prisma.task.findMany({
      where: whereTask,
      include: {
        department: true,
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        parentTask: {
          select: { id: true, code: true, title: true, scope: true },
        },
        subTasks: {
          where: {
            status: { not: TaskStatus.CANCELLED },
            // Confine child tasks to the same department scope as their parent query. A parent task
            // anchored to the caller's department (e.g. a SCHOOL directive) would otherwise serialize
            // every cross-department subtask, leaking titles, assignee names and deliverable `fileUrl`
            // evidence links. `departmentId` is the canonical Task-level ownership field (mapPrismaTaskToStaffTask
            // never populates `assignedToDepartmentId`, which the route-level prune relied on).
            ...(scopedDepartmentId ? { departmentId: scopedDepartmentId } : {}),
          },
          include: {
            department: true,
            assignees: {
              include: {
                user: {
                  select: { id: true, name: true, avatarUrl: true },
                },
              },
            },
            deliverables: {
              select: { id: true, title: true, fileUrl: true, createdAt: true },
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.department.findMany({
      include: {
        users: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        tasks: {
          where: deptTaskWhere,
          select: {
            id: true,
            status: true,
            dueDate: true,
            progressPercent: true,
          },
        },
      },
    }),
    prisma.notification.findMany({
      take: 15,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        actorName: true,
        title: true,
        type: true,
        category: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

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
            const p = isCompleted ? 100 : (typeof s.progressPercent === "number" ? s.progressPercent : 0);
            return acc + p;
          }, 0) / totalSub
        )
      : 0;
    const progressPercent = t.progressPercent > 0 ? t.progressPercent : rolledUpProgress;

    const isSchool = t.scope === TaskScope.SCHOOL;
    const rawCategory = (t as any).category;
    const category: TaskCategory = rawCategory && VALID_TASK_CATEGORIES.has(rawCategory)
      ? (rawCategory as TaskCategory)
      : "KHAC";
    const categoryLabel =
      (t as any).categoryLabel ||
      (isSchool ? "Nhiệm vụ cấp Trường" : "Nhiệm vụ đơn vị");

    return {
      id: t.id,
      code: t.code,
      taskCode: t.code,
      title: t.title,
      scope: t.scope,
      category: category as any,
      categoryLabel,
      academicMonth: t.academicMonth,
      academicYear: t.academicYear,
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
      departmentName: t.department?.name,
      coAssignees,
      assignedDate: formatLocalDate(t.startDate),
      dueDate: formatLocalDate(t.dueDate),
      status: t.status,
      subTasks,
      totalSubTasks: totalSub,
      completedSubTasks: completedSub,
      progressPercent,
      parentTaskId: t.parentTaskId || (t as any).parentTask?.id || undefined,
      parentTaskTitle: (t as any).parentTask?.title || undefined,
      parentTaskCode: (t as any).parentTask?.code || undefined,
      parentTask: (t as any).parentTask || undefined,
    } as SchoolTask;
  }).filter((t) => !t.title?.includes("Nhiệm vụ kiểm thử") && !t.title?.includes("kiểm thử V2"));

  // Tính toán DashboardStats
  const total = mappedTasks.length;
  const inProgress = mappedTasks.filter((t) => t.status === "IN_PROGRESS").length;
  const completed = mappedTasks.filter((t) => t.status === "COMPLETED").length;
  const overdue = mappedTasks.filter(
    (t) => t.status === "OVERDUE" || (isTaskPastDue(t.dueDate, referenceDate) && t.status !== "COMPLETED")
  ).length;
  const pendingApprovals = mappedTasks.filter(
    (t) => t.status === "WAITING_APPROVAL" || t.status === "PENDING_EXECUTIVE_APPROVAL"
  ).length;

  const schoolTasksList = mappedTasks.filter(
    (t) =>
      (t as any).scope === TaskScope.SCHOOL ||
      t.categoryLabel === "Nhiệm vụ cấp Trường" ||
      t.categoryLabel === "Chỉ đạo cấp Trường"
  );
  const totalSchool = schoolTasksList.length;
  const inProgressSchool = schoolTasksList.filter((t) => t.status === "IN_PROGRESS").length;
  const completedSchool = schoolTasksList.filter((t) => t.status === "COMPLETED").length;
  const averageSchoolProgressPercent =
    totalSchool > 0
      ? Math.round(schoolTasksList.reduce((acc, t) => acc + (t.progressPercent || 0), 0) / totalSchool)
      : total > 0
      ? Math.round(mappedTasks.reduce((acc, t) => acc + (t.progressPercent || 0), 0) / total)
      : 0;

  const totalStaffTasks = mappedTasks.reduce((acc, t) => acc + (t.subTasks?.length || 0), 0);
  const staffTasksInProgress = mappedTasks.reduce(
    (acc, t) => acc + (t.subTasks?.filter((s) => s.status === "IN_PROGRESS").length || 0),
    0
  );
  const staffTasksCompleted = mappedTasks.reduce(
    (acc, t) => acc + (t.subTasks?.filter((s) => s.status === "COMPLETED").length || 0),
    0
  );

  const stats: DashboardStats = {
    totalTasks: total,
    inProgressTasks: inProgress,
    completedTasks: completed,
    overdueTasks: overdue,
    pendingApprovals,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,

    totalSchoolTasks: totalSchool > 0 ? totalSchool : total,
    schoolTasksInProgress: totalSchool > 0 ? inProgressSchool : inProgress,
    schoolTasksCompleted: totalSchool > 0 ? completedSchool : completed,
    totalStaffTasks,
    staffTasksInProgress,
    staffTasksCompleted,
    needsReviewTasksCount: pendingApprovals,
    overdueTasksCount: overdue,
    averageSchoolProgressPercent,
  };

// departments đã được tải song song ở Promise.all phía trên

  const departmentHealth: DepartmentHealthSummary[] = departments.map((d) => {
    const dTasks = d.tasks || [];
    const dTotal = dTasks.length;
    const dCompleted = dTasks.filter((t) => t.status === "COMPLETED").length;
    const dInProgress = dTasks.filter((t) => t.status === "IN_PROGRESS").length;
    const dOverdue = dTasks.filter(
      (t) => t.status === "OVERDUE" || (isTaskPastDue(t.dueDate, referenceDate) && t.status !== "COMPLETED")
    ).length;

    const totalProgress = dTasks.reduce((acc, t) => {
      const isCompleted = t.status === "COMPLETED";
      const p = isCompleted ? 100 : (t.progressPercent ?? 0);
      return acc + (typeof p === "number" && !isNaN(p) ? p : 0);
    }, 0);

    const averageProgressPercent = dTotal > 0 ? Math.round(totalProgress / dTotal) : 0;
    const completionRate = dTotal > 0 ? Math.round((dCompleted / dTotal) * 100) : 0;

    const leader = d.users?.find(
      (u) =>
        (u.role === "TRUONG_PHONG" || u.role === "BAN_GIAM_HIEU") &&
        u.name.trim().toLowerCase() !== d.name.trim().toLowerCase()
    );
    const leadName = leader?.name || "Chưa phân công";

    return {
      departmentId: d.id,
      departmentCode: d.id,
      departmentName: d.name,
      shortName: d.shortName || d.id,
      leadName,
      totalTasks: dTotal,
      totalTasksCount: dTotal,
      completedTasks: dCompleted,
      completedTasksCount: dCompleted,
      inProgressTasks: dInProgress,
      inProgressTasksCount: dInProgress,
      overdueTasks: dOverdue,
      overdueTasksCount: dOverdue,
      blockedTasksCount: 0,
      averageProgressPercent,
      completionRate,
      status: dOverdue > 0 ? "critical" : dCompleted === dTotal && dTotal > 0 ? "good" : "warning",
    };
  });

  // Tổng hợp Upcoming Items (Hạn chót sắp đến & Quá hạn từ nhiệm vụ cấp trường và đơn vị)
  const upcomingItems: UpcomingItem[] = [];

  for (const t of mappedTasks) {
    if (t.status !== "COMPLETED" && (t.status as string) !== "CANCELLED") {
      upcomingItems.push({
        id: `upcoming-${(t as any).scope === TaskScope.DEPARTMENT ? "dept" : "school"}-${t.id}`,
        taskId: t.id,
        title: t.title,
        dueDate: t.dueDate,
        assigneeName: t.leadAssigneeName,
        assigneeAvatar: t.leadAssigneeAvatar,
        level: (t as any).scope === TaskScope.DEPARTMENT ? "Đơn vị" : "Trường",
        category: t.category,
        isOverdue: isTaskPastDue(t.dueDate, referenceDate),
      });
    }

    for (const sub of t.subTasks || []) {
      if (sub.status !== "COMPLETED" && (sub.status as string) !== "CANCELLED") {
        upcomingItems.push({
          id: `upcoming-sub-${sub.id}`,
          taskId: sub.id,
          title: sub.title,
          dueDate: sub.dueDate,
          assigneeName: sub.assigneeName,
          level: "Đơn vị",
          category: t.category,
          isOverdue: isTaskPastDue(sub.dueDate, referenceDate),
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
// recentNotifications đã được tải song song ở Promise.all phía trên

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

      const eventCategory: TaskCategory =
        n.category && VALID_TASK_CATEGORIES.has(n.category)
          ? (n.category as TaskCategory)
          : "KHAC";

      return {
        id: `act-notif-${n.id}`,
        actorName: n.actorName || n.user?.name || "Lãnh đạo QCET",
        action,
        targetTitle: n.title.replace(/^\[.*?\]\s*/, ""),
        timestamp: n.createdAt.toISOString(),
        category: eventCategory,
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
