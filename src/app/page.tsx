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
import { Clock, RefreshCw, CheckCircle2 } from "lucide-react";

export default function DashboardPage() {
  // 1. Synchronous optimistic initial state from getMockDashboardPayload (0ms blank screen)
  const [dashboardData, setDashboardData] = React.useState<DashboardPayload>(
    () => getMockDashboardPayload()
  );
  const [selectedTask, setSelectedTask] = React.useState<
    SchoolTask | StaffTask | null
  >(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

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

  return (
    <div className="space-y-6 pb-12" data-slot="twenty-dashboard">
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
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer disabled:opacity-60"
            title="Làm mới dữ liệu từ máy chủ"
          >
            <RefreshCw
              className={`size-3.5 ${isRefreshing ? "animate-spin text-foreground" : ""}`}
            />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-200/80 bg-emerald-50/70 px-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
            </span>
            <span>Trực tuyến</span>
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ExecutiveStatStrip across the top                                      */}
      {/* ========================================================================= */}
      <section aria-label="Chỉ số hiệu suất toàn trường">
        <ExecutiveStatStrip stats={dashboardData.stats} />
      </section>

      {/* ========================================================================= */}
      {/* 3. Two-Column Grid: 8 Cols (~65%) Left | 4 Cols (~35%) Right              */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (8 cols): Cascading 2-Tier Task Table */}
        <div className="lg:col-span-8 space-y-4">
          <CascadingTaskTable
            tasks={dashboardData.tasks}
            onSelectTask={(task) => setSelectedTask(task)}
          />
        </div>

        {/* Right Column (4 cols): Upcoming Deadlines & Activity Feed */}
        <div className="lg:col-span-4 space-y-6">
          <UpcomingDeadlinesWidget
            items={dashboardData.upcoming}
            onSelectTask={handleSelectUpcoming}
          />
          <ActivityFeedWidget activities={dashboardData.activities} />
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. TaskDetailSideSheet Slide-Over                                        */}
      {/* ========================================================================= */}
      <TaskDetailSideSheet
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
