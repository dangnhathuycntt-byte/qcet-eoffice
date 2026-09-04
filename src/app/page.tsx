"use client";

import * as React from "react";
import {
  SchoolTask,
  StaffTask,
  UpcomingItem,
  DashboardPayload,
  TaskStatus,
} from "@/types/dashboard";
import { getMockDashboardPayload } from "@/lib/mock-dashboard-data";
import { computeSchoolTaskRollup, computeDashboardStats } from "@/lib/dashboard-aggregator";
import { ExecutiveStatStrip } from "@/components/dashboard/executive-stat-strip";
import { CascadingTaskTable } from "@/components/dashboard/cascading-task-table";
import { UpcomingDeadlinesWidget } from "@/components/dashboard/upcoming-deadlines-widget";
import { ActivityFeedWidget } from "@/components/dashboard/activity-feed-widget";
import {
  TaskDetailSideSheet,
  isSchoolTask,
} from "@/components/dashboard/task-detail-side-sheet";
import {
  CreateTaskModal,
  CreateTaskFormData,
} from "@/components/dashboard/create-task-modal";
import { CATEGORY_TABS } from "@/components/dashboard/cascading-task-table";
import { Button } from "@/components/ui/button";
import { Clock, RefreshCw, CheckCircle2, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { filterTasksByRole, filterUpcomingByRole } from "@/lib/role-task-filter";
import { RoleViewpointBanner } from "@/components/auth/role-viewpoint-banner";

export default function DashboardPage() {
  const { user } = useAuth();

  // 1. Synchronous optimistic initial state from getMockDashboardPayload (0ms blank screen)
  const [dashboardData, setDashboardData] = React.useState<DashboardPayload>(
    () => getMockDashboardPayload()
  );
  const [selectedTask, setSelectedTask] = React.useState<
    SchoolTask | StaffTask | null
  >(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);

  // Filter tasks and stats dynamically by active role viewpoint
  const visibleTasks = React.useMemo(
    () => filterTasksByRole(dashboardData.tasks, user),
    [dashboardData.tasks, user]
  );

  const visibleStats = React.useMemo(
    () => computeDashboardStats(visibleTasks),
    [visibleTasks]
  );

  const visibleUpcoming = React.useMemo(
    () => filterUpcomingByRole(dashboardData.upcoming, user, visibleTasks),
    [dashboardData.upcoming, user, visibleTasks]
  );

  // 2. Client-side background sync fetching live overview from /api/dashboard/overview
  React.useEffect(() => {
    let isMounted = true;

    async function syncDashboardOverview() {
      try {
        const response = await fetch("/api/dashboard/overview");
        if (response.ok && isMounted) {
          const liveData: DashboardPayload = await response.json();
          if (liveData && liveData.tasks && liveData.stats) {
            setDashboardData(liveData);
          }
        }
      } catch {
        // Silently preserve high-fidelity optimistic payload on network/offline fallback
      }
    }

    syncDashboardOverview();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handler to manually trigger sync/refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/dashboard/overview");
      if (response.ok) {
        const liveData: DashboardPayload = await response.json();
        if (liveData && liveData.tasks && liveData.stats) {
          setDashboardData(liveData);
        }
      }
    } catch {
      // Keep existing data
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Find task when an upcoming deadline item is clicked
  const handleSelectUpcoming = (item: UpcomingItem) => {
    for (const schoolTask of dashboardData.tasks) {
      if (schoolTask.id === item.taskId || schoolTask.title === item.title) {
        setSelectedTask(schoolTask);
        return;
      }
      for (const sub of schoolTask.subTasks) {
        if (sub.id === item.taskId || sub.title === item.title) {
          setSelectedTask(sub);
          return;
        }
      }
    }
  };

  // Optimistic status update when changed inside TaskDetailSideSheet
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
      // Recompute rollup (progress bar, completedSubTasks) and dashboard stats
      const rolledUpTasks = updatedTasks.map((t) => computeSchoolTaskRollup(t));
      return { ...prev, tasks: rolledUpTasks, stats: computeDashboardStats(rolledUpTasks) };
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

  // Task creation handler with full rollup recalculation
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
            CATEGORY_TABS.find((c) => c.id === data.category)?.label || data.category,
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
          parentSchoolTaskId: data.parentTaskId || updatedTasks[0]?.id || "task-1",
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

  // Listen to global task created or open modal events
  React.useEffect(() => {
    const handleGlobalTaskCreated = (e: Event) => {
      const customEvent = e as CustomEvent<CreateTaskFormData>;
      if (customEvent.detail) {
        handleCreateTask(customEvent.detail);
      }
    };
    const handleGlobalOpenCreate = () => {
      setIsCreateModalOpen(true);
    };

    window.addEventListener("qcet:task-created", handleGlobalTaskCreated);
    window.addEventListener("qcet:open-create-task", handleGlobalOpenCreate);
    return () => {
      window.removeEventListener("qcet:task-created", handleGlobalTaskCreated);
      window.removeEventListener("qcet:open-create-task", handleGlobalOpenCreate);
    };
  }, []);

  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-6 pb-24 md:pb-10"
      data-slot="twenty-dashboard"
    >
      {/* ========================================================================= */}
      {/* 1. Header Greeting & Breadcrumbs                                         */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
            <span>Văn phòng Điều hành</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-foreground font-semibold">
              Dashboard Điều hành Toàn trường
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Bảng điều hành công việc toàn trường
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Giám sát 2 tầng: Nhiệm vụ cấp Trường & Công việc Đơn vị trực thuộc theo thời gian thực
          </p>
        </div>

        {/* Right Actions: Live Sync Tag & Manual Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="h-8.5 gap-1.5 rounded-xl px-3.5 text-xs font-semibold shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Giao việc</span>
          </Button>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-border/60 bg-background/80 backdrop-blur-xs px-3 text-xs font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground cursor-pointer disabled:opacity-60"
            title="Làm mới dữ liệu từ máy chủ"
          >
            <RefreshCw
              className={`size-3.5 ${isRefreshing ? "animate-spin text-foreground" : ""}`}
            />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <span className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500"></span>
            </span>
            <span>Trực tuyến</span>
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Role Viewpoint Banner (RBAC Real-time Scope Indicator)                */}
      {/* ========================================================================= */}
      <section aria-label="Góc nhìn vai trò">
        <RoleViewpointBanner />
      </section>

      {/* ========================================================================= */}
      {/* 3. ExecutiveStatStrip across the top                                      */}
      {/* ========================================================================= */}
      <section aria-label="Chỉ số hiệu suất toàn trường">
        <ExecutiveStatStrip stats={visibleStats} />
      </section>

      {/* ========================================================================= */}
      {/* 4. Two-Column Grid: 8 Cols (~65%) Left | 4 Cols (~35%) Right              */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (8 cols): Cascading 2-Tier Task Table */}
        <div className="lg:col-span-8 space-y-4">
          <CascadingTaskTable
            tasks={visibleTasks}
            onSelectTask={(task) => setSelectedTask(task)}
            onAddTask={() => setIsCreateModalOpen(true)}
          />
        </div>

        {/* Right Column (4 cols): Upcoming Deadlines & Activity Feed */}
        <div className="lg:col-span-4 space-y-6">
          <UpcomingDeadlinesWidget
            items={visibleUpcoming}
            onSelectTask={handleSelectUpcoming}
          />
          <ActivityFeedWidget activities={dashboardData.activities} />
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. TaskDetailSideSheet Slide-Over                                        */}
      {/* ========================================================================= */}
      <TaskDetailSideSheet
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={handleStatusChange}
      />

      {/* ========================================================================= */}
      {/* 6. CreateTaskModal Dialog                                                */}
      {/* ========================================================================= */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTask}
        schoolTasks={visibleTasks}
      />
    </div>
  );
}
