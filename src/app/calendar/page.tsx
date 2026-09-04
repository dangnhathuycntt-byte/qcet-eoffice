"use client";

import * as React from "react";
import {
  SchoolTask,
  StaffTask,
  DashboardPayload,
  TaskStatus,
} from "@/types/dashboard";
import { getMockDashboardPayload } from "@/lib/mock-dashboard-data";
import {
  computeSchoolTaskRollup,
  computeDashboardStats,
} from "@/lib/dashboard-aggregator";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";
import {
  TaskDetailSideSheet,
  isSchoolTask,
} from "@/components/dashboard/task-detail-side-sheet";
import {
  CreateTaskModal,
  CreateTaskFormData,
  TaskLevel,
} from "@/components/dashboard/create-task-modal";
import { CATEGORY_TABS } from "@/components/dashboard/cascading-task-table";
import { RefreshCw, Calendar as CalendarIcon, Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { filterTasksByRole } from "@/lib/role-task-filter";
import { RoleViewpointBanner } from "@/components/auth/role-viewpoint-banner";

export default function CalendarPage() {
  const { user } = useAuth();

  // 1. Synchronous optimistic initial state (0ms blank screen)
  const [dashboardData, setDashboardData] = React.useState<DashboardPayload>(
    () => getMockDashboardPayload()
  );
  const [selectedTask, setSelectedTask] = React.useState<
    SchoolTask | StaffTask | null
  >(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Filter tasks dynamically by active role viewpoint
  const visibleTasks = React.useMemo(
    () => filterTasksByRole(dashboardData.tasks, user),
    [dashboardData.tasks, user]
  );

  // 2. Create Task Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [createInitialDate, setCreateInitialDate] = React.useState<
    string | undefined
  >("2026-09-04");

  // 3. Background Sync from /api/dashboard/overview
  React.useEffect(() => {
    let isMounted = true;

    async function syncCalendarData() {
      try {
        const response = await fetch("/api/dashboard/overview");
        if (response.ok && isMounted) {
          const liveData: DashboardPayload = await response.json();
          if (liveData && liveData.tasks) {
            setDashboardData(liveData);
          }
        }
      } catch {
        // Retain optimistic payload
      }
    }

    syncCalendarData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/dashboard/overview");
      if (response.ok) {
        const liveData: DashboardPayload = await response.json();
        if (liveData && liveData.tasks) {
          setDashboardData(liveData);
        }
      }
    } catch {
      // Retain state
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // 4. Status update handler
  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setDashboardData((prev) => {
      const updatedTasks: SchoolTask[] = prev.tasks.map((st) => {
        if (st.id === taskId) {
          const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
            newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
          return { ...st, status: schoolStatus };
        }
        const updatedSubs: StaffTask[] = st.subTasks.map((sub) =>
          sub.id === taskId ? { ...sub, status: newStatus } : sub
        );
        return { ...st, subTasks: updatedSubs };
      });

      const rolledUpTasks = updatedTasks.map((t) => computeSchoolTaskRollup(t));
      return {
        ...prev,
        tasks: rolledUpTasks,
        stats: computeDashboardStats(rolledUpTasks),
      };
    });

    setSelectedTask((prev) => {
      if (!prev || prev.id !== taskId) return prev;
      if (isSchoolTask(prev)) {
        const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
          newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
        return { ...prev, status: schoolStatus };
      }
      return { ...prev, status: newStatus };
    });
  };

  // 5. Create task from calendar
  const handleCreateTask = (data: CreateTaskFormData) => {
    const todayStr = "2026-09-04";

    setDashboardData((prev) => {
      let updatedTasks = [...prev.tasks];

      if (data.level === "TRUONG") {
        const newTask: SchoolTask = {
          id: `task-${Date.now()}`,
          title: data.title,
          category: data.category,
          categoryLabel:
            CATEGORY_TABS.find((c) => c.id === data.category)?.label ||
            data.category,
          leadAssigneeName: data.leadAssigneeName,
          coAssignees: data.coAssignees,
          assignedDate: todayStr,
          dueDate: data.dueDate,
          status: "IN_PROGRESS",
          subTasks: [],
          totalSubTasks: 0,
          completedSubTasks: 0,
          progressPercent: 0,
        };
        updatedTasks.unshift(newTask);
      } else {
        const newSubTask: StaffTask = {
          id: `sub-${Date.now()}`,
          title: data.title,
          assigneeName: data.leadAssigneeName,
          status: "NEW",
          dueDate: data.dueDate,
          parentSchoolTaskId:
            data.parentTaskId || updatedTasks[0]?.id || "task-1",
          updatedAt: todayStr,
        };

        if (data.parentTaskId) {
          updatedTasks = updatedTasks.map((st) => {
            if (st.id === data.parentTaskId) {
              return {
                ...st,
                subTasks: [newSubTask, ...st.subTasks],
              };
            }
            return st;
          });
        } else if (updatedTasks.length > 0) {
          updatedTasks[0] = {
            ...updatedTasks[0],
            subTasks: [newSubTask, ...updatedTasks[0].subTasks],
          };
        }
      }

      const rolledUp = updatedTasks.map((t) => computeSchoolTaskRollup(t));
      return {
        ...prev,
        tasks: rolledUp,
        stats: computeDashboardStats(rolledUp),
      };
    });
  };

  const handleOpenAddTask = (initialDate?: string) => {
    setCreateInitialDate(initialDate || "2026-09-04");
    setIsCreateModalOpen(true);
  };

  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-6 pb-24 md:pb-10"
      data-slot="twenty-calendar-page"
    >
      {/* ========================================================================= */}
      {/* 1. Page Header with QCET Badge, Bold Title, and Actions                   */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
              <CalendarIcon className="size-3" />
              <span>LỊCH CÔNG TÁC & TIẾN ĐỘ QCET</span>
            </span>
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
              • Hạn chót toàn trường
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
            <span>Lịch công tác & Hạn chót toàn trường</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lịch tổng hợp tiến độ và hạn chót giao ban, nhiệm vụ cấp Trường & Đơn vị theo tháng
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer disabled:opacity-60 shadow-2xs"
            title="Làm mới dữ liệu"
          >
            <RefreshCw
              className={`size-3.5 ${
                isRefreshing ? "animate-spin text-foreground" : ""
              }`}
            />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <Button
            type="button"
            onClick={() => handleOpenAddTask()}
            className="h-8.5 gap-1.5 px-3.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-card hover:shadow-card-hover transition-all cursor-pointer rounded-lg"
          >
            <Plus className="size-3.5" />
            <span>+ Giao việc</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Role Viewpoint Banner (RBAC Real-time Scope Indicator)                */}
      {/* ========================================================================= */}
      <section aria-label="Góc nhìn vai trò">
        <RoleViewpointBanner />
      </section>

      {/* ========================================================================= */}
      {/* 3. Calendar Month View Component                                         */}
      {/* ========================================================================= */}
      <CalendarMonthView
        tasks={visibleTasks}
        onSelectTask={(task) => setSelectedTask(task)}
        onAddTask={handleOpenAddTask}
        initialYear={2026}
        initialMonth={8}
      />

      {/* ========================================================================= */}
      {/* 4. TaskDetailSideSheet Slide-Over                                        */}
      {/* ========================================================================= */}
      <TaskDetailSideSheet
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={handleStatusChange}
      />

      {/* ========================================================================= */}
      {/* 5. CreateTaskModal                                                       */}
      {/* ========================================================================= */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTask}
        schoolTasks={visibleTasks}
        initialDueDate={createInitialDate}
        initialLevel="TRUONG"
      />
    </div>
  );
}
