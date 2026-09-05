"use client";

import * as React from "react";
import Link from "next/link";
import {
  SchoolTask,
  StaffTask,
  UpcomingItem,
  DashboardPayload,
  TaskStatus,
} from "@/types/dashboard";
import { getMockDashboardPayload } from "@/lib/mock-dashboard-data";
import { computeDashboardStats } from "@/lib/dashboard-aggregator";
import { ExecutiveStatStrip } from "@/components/dashboard/executive-stat-strip";
import { UpcomingDeadlinesWidget } from "@/components/dashboard/upcoming-deadlines-widget";
import { ActivityFeedWidget } from "@/components/dashboard/activity-feed-widget";
import {
  TaskDetailSideSheet,
  isSchoolTask,
} from "@/components/dashboard/task-detail-side-sheet";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckSquare, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { filterTasksByRole, filterUpcomingByRole } from "@/lib/role-task-filter";

export default function StandaloneDashboardAnalyticsPage() {
  const { user } = useAuth();

  const [dashboardData, setDashboardData] = React.useState<DashboardPayload>(
    () => getMockDashboardPayload()
  );
  const [selectedTask, setSelectedTask] = React.useState<
    SchoolTask | StaffTask | null
  >(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

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

  React.useEffect(() => {
    let isMounted = true;
    async function syncData() {
      try {
        const response = await fetch("/api/dashboard/overview");
        if (response.ok && isMounted) {
          const liveData: DashboardPayload = await response.json();
          if (liveData?.tasks && liveData?.stats) {
            setDashboardData(liveData);
          }
        }
      } catch {
        // Fallback
      }
    }
    syncData();
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
        if (liveData?.tasks && liveData?.stats) {
          setDashboardData(liveData);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectUpcoming = (item: UpcomingItem) => {
    const matched = visibleTasks.find((t) => t.id === item.id || t.id === item.taskId);
    if (matched) {
      setSelectedTask(matched);
      return;
    }
    for (const parent of visibleTasks) {
      const foundSub = parent.subTasks.find((s) => s.id === item.id || s.id === item.taskId);
      if (foundSub) {
        setSelectedTask(foundSub);
        return;
      }
    }
  };

  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-6 pb-24 md:pb-10"
      data-slot="twenty-dashboard-analytics"
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="size-3" />
              <span>Về Quản lý công việc</span>
            </Link>
          </div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-heading">
            Bảng điều hành & Thống kê
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tổng hợp chỉ số KPI, tiến độ toàn trường và nhật ký hoạt động điều hành
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/"
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <CheckSquare className="size-3.5 text-primary" />
            <span>Xem Danh sách công việc</span>
          </Link>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-8.5 gap-1.5 text-xs font-medium"
          >
            <RefreshCw
              className={`size-3.5 ${isRefreshing ? "animate-spin text-foreground" : ""}`}
            />
            <span className="hidden sm:inline">Làm mới dữ liệu</span>
          </Button>
        </div>
      </div>

      {/* Bento Stat Cards */}
      <section aria-label="Chỉ số hiệu suất toàn trường">
        <ExecutiveStatStrip stats={visibleStats} />
      </section>

      {/* 2-column: Upcoming Deadlines + Activity Feed */}
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

      {/* TaskDetailSideSheet */}
      <TaskDetailSideSheet
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        parentSchoolTaskTitle={parentSchoolTaskTitle}
      />
    </div>
  );
}
