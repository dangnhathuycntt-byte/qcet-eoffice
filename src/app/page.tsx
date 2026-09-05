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
import { RefreshCw, CheckSquare, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { filterTasksByRole, filterUpcomingByRole } from "@/lib/role-task-filter";

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
  const [activeView, setActiveView] = React.useState<"tasks" | "dashboard">("tasks");

  // Filter tasks and stats dynamically by active role viewpoint
  const visibleTasks = React.useMemo(
    () => filterTasksByRole(dashboardData.tasks, user),
    [dashboardData.tasks, user]
  );

  const parentSchoolTaskTitle = React.useMemo(() => {
    if (!selectedTask || isSchoolTask(selectedTask)) return undefined;
    const parent = dashboardData.tasks.find(
      (t) => t.id === selectedTask.parentSchoolTaskId
    );
    return parent?.title;
  }, [selectedTask, dashboardData.tasks]);

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
      {/* Executive Mode Switcher: Tasks (Main) vs Thống kê (Analytics) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-heading">
            {activeView === "tasks" ? "Quản lý Giao việc & Nhiệm vụ" : "Bảng điều hành & Thống kê"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeView === "tasks"
              ? "Danh mục nhiệm vụ trường, công việc đơn vị và theo dõi tiến độ"
              : "Tổng hợp chỉ số KPI, tiến độ toàn trường và nhật ký hoạt động"}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Segmented Mode Toggle */}
          <div className="inline-flex items-center rounded-xl border border-border/80 bg-muted/40 p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveView("tasks")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                activeView === "tasks"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Danh sách nhiệm vụ & giao việc"
            >
              <CheckSquare className="size-3.5" />
              <span>Nhiệm vụ & Giao việc</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView("dashboard")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                activeView === "dashboard"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Thống kê điều hành BGH"
            >
              <LayoutDashboard className="size-3.5" />
              <span>Thống kê & Báo cáo</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer disabled:opacity-60 shadow-2xs"
            title="Làm mới dữ liệu từ máy chủ"
          >
            <RefreshCw
              className={`size-3.5 ${isRefreshing ? "animate-spin text-foreground" : ""}`}
            />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Tasks View (Default, Spacious, Paginated, Focused) */}
      {activeView === "tasks" ? (
        <section aria-label="Bảng nhiệm vụ phân cấp toàn trường">
          <CascadingTaskTable
            tasks={visibleTasks}
            onSelectTask={(task) => setSelectedTask(task)}
            onAddTask={() => setIsCreateModalOpen(true)}
            onStatusChange={handleStatusChange}
          />
        </section>
      ) : (
        /* Mode 2: Dashboard & Thống kê View (Executive Bento Cards + Widgets) */
        <div className="space-y-6 animate-in fade-in duration-200">
          <section aria-label="Chỉ số hiệu suất toàn trường">
            <ExecutiveStatStrip stats={visibleStats} />
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6 space-y-4">
              <UpcomingDeadlinesWidget
                items={visibleUpcoming}
                onSelectTask={handleSelectUpcoming}
              />
            </div>
            <div className="lg:col-span-6 space-y-4">
              <ActivityFeedWidget activities={dashboardData.activities} />
            </div>
          </section>
        </div>
      )}

      {/* TaskDetailSideSheet Slide-Over */}
      <TaskDetailSideSheet
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={handleStatusChange}
        parentSchoolTaskTitle={parentSchoolTaskTitle}
      />

      {/* CreateTaskModal Dialog */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTask}
        schoolTasks={visibleTasks}
      />
    </div>
  );
}
