"use client";

import * as React from "react";
import Link from "next/link";
import {
  SchoolTask,
  StaffTask,
  UpcomingItem,
  DashboardPayload,
} from "@/types/dashboard";
import { computeDashboardStats } from "@/lib/dashboard-aggregator";
import { ExecutiveStatStrip } from "@/components/dashboard/executive-stat-strip";
import { UpcomingDeadlinesWidget } from "@/components/dashboard/upcoming-deadlines-widget";
import { ActivityFeedWidget } from "@/components/dashboard/activity-feed-widget";
import {
  TaskDetailSideSheet,
  isSchoolTask,
} from "@/components/dashboard/task-detail-side-sheet";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckSquare, ArrowLeft, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { filterTasksByRole, filterUpcomingByRole } from "@/lib/role-task-filter";

export default function StandaloneDashboardAnalyticsPage() {
  const { user } = useAuth();

  const [dashboardData, setDashboardData] = React.useState<DashboardPayload | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedTask, setSelectedTask] = React.useState<
    SchoolTask | StaffTask | null
  >(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/overview");
      if (!response.ok) {
        throw new Error("Không thể kết nối đến máy chủ bảng điều hành");
      }
      const liveData: DashboardPayload = await response.json();
      if (liveData?.tasks && liveData?.stats) {
        setDashboardData(liveData);
      } else {
        throw new Error("Dữ liệu nhận được từ máy chủ không hợp lệ");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Đã xảy ra lỗi khi tải dữ liệu điều hành";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/dashboard/overview");
      if (response.ok) {
        const liveData: DashboardPayload = await response.json();
        if (liveData?.tasks && liveData?.stats) {
          setDashboardData(liveData);
          setError(null);
        }
      }
    } catch {
      // Fallback: maintain existing state
    } finally {
      setIsRefreshing(false);
    }
  };

  const visibleTasks = React.useMemo(
    () => (dashboardData ? filterTasksByRole(dashboardData.tasks, user) : []),
    [dashboardData, user]
  );

  const parentSchoolTaskTitle = React.useMemo(() => {
    if (!selectedTask || isSchoolTask(selectedTask) || !dashboardData) return undefined;
    const parent = dashboardData.tasks.find(
      (t) => t.id === selectedTask.parentSchoolTaskId
    );
    return parent?.title;
  }, [selectedTask, dashboardData]);

  const visibleStats = React.useMemo(
    () => computeDashboardStats(visibleTasks),
    [visibleTasks]
  );

  const visibleUpcoming = React.useMemo(
    () => (dashboardData ? filterUpcomingByRole(dashboardData.upcoming, user, visibleTasks) : []),
    [dashboardData, user, visibleTasks]
  );

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

  // Error State: Graceful error card with retry button
  if (error && !dashboardData) {
    return (
      <div className="max-w-[1440px] w-full mx-auto py-12 px-4">
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center max-w-md mx-auto space-y-4">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="size-6" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground font-heading">
              Không thể tải dữ liệu điều hành
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="gap-1.5 text-xs font-medium"
          >
            <RefreshCw className="size-3.5" strokeWidth={1.5} />
            <span>Thử lại</span>
          </Button>
        </div>
      </div>
    );
  }

  // Loading Skeleton State
  if (isLoading && !dashboardData) {
    return (
      <div
        className="max-w-[1440px] w-full mx-auto space-y-6 pb-24 md:pb-10 animate-pulse"
        aria-label="Đang nạp dữ liệu điều hành..."
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-2">
            <div className="h-4 w-28 rounded bg-muted/60" />
            <div className="h-7 w-64 rounded-md bg-muted/80" />
            <div className="h-4 w-96 max-w-full rounded bg-muted/50" />
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="h-8.5 w-36 rounded-lg bg-muted/60 border border-border/60" />
            <div className="h-8.5 w-32 rounded-lg bg-muted/60 border border-border/60" />
          </div>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border/70 bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 rounded bg-muted/60" />
                <div className="size-8 rounded-lg bg-muted/60" />
              </div>
              <div className="h-8 w-16 rounded bg-muted/80" />
              <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full w-1/3 bg-muted/60 rounded-full" />
              </div>
              <div className="h-3 w-28 rounded bg-muted/40" />
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-xl border border-border/70 bg-card p-4 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <div className="h-5 w-40 rounded bg-muted/70" />
                <div className="h-4 w-16 rounded bg-muted/40" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/20">
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 w-3/4 rounded bg-muted/70" />
                      <div className="h-3 w-1/3 rounded bg-muted/40" />
                    </div>
                    <div className="h-5 w-20 rounded bg-muted/50" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-xl border border-border/70 bg-card p-4 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <div className="h-5 w-36 rounded bg-muted/70" />
                <div className="h-4 w-14 rounded bg-muted/40" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg">
                    <div className="size-9 rounded-full bg-muted/60 shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 w-5/6 rounded bg-muted/70" />
                      <div className="h-3 w-1/4 rounded bg-muted/40" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

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
              href="/?zone=portal"
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="size-3" strokeWidth={1.5} />
              <span>Về Cổng Portal</span>
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
            href="/?zone=tasks"
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <CheckSquare className="size-3.5 text-primary" strokeWidth={1.5} />
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
              strokeWidth={1.5}
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
          <ActivityFeedWidget activities={dashboardData?.activities || []} />
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
