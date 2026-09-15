"use client";

import * as React from "react";
import { Suspense } from "react";
import { Plus, RefreshCw, Calendar as CalendarIcon, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScopeSwitcher } from "@/components/layout/scope-switcher";
import { GlobalMonthSelector } from "@/components/layout/global-month-selector";
import { DashboardSituationStrip } from "@/components/dashboard/dashboard-situation-strip";
import { ExecutiveActionCenter } from "@/components/dashboard/executive-action-center";
import { DepartmentAttentionPreview } from "@/components/dashboard/department-attention-preview";
import { UpcomingDeadlinesWidget } from "@/components/dashboard/upcoming-deadlines-widget";
import { TodayAgendaWidget } from "@/components/dashboard/today-agenda-widget";
import { ActivityFeedWidget } from "@/components/dashboard/activity-feed-widget";
import { PersonalWorkbench } from "@/components/dashboard/personal-workbench";
import { WorkbenchMobileFeed } from "@/components/dashboard/workbench-mobile-feed";
import { resolveCreateTaskPolicy } from "@/components/dashboard/create-task-modal";
import {
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
} from "@/components/dashboard/dashboard-context";
import { cn } from "@/lib/utils";

function DashboardZoneComponent() {
  const {
    tasks, monthScopedBaseTasks, filteredTasks, user, displayedStats, executiveStats,
    executiveFilter, executiveActionItems, departmentHealth, isExecutive, isManager, isStaff,
    roleUpcoming, activities, isRefreshing, isLoading, errorMessage,
  } = useDashboardData();

  const { setExecutiveFilter, handleManualRefresh } = useDashboardActions();
  const { openTaskDetail, openTaskDetailById, openCreateModal } = useDashboardModal();

  const createPolicy = React.useMemo(() => resolveCreateTaskPolicy(user), [user]);

  // The scope + period set, so the personal queue's counts match the shared context.
  const baseTasks = monthScopedBaseTasks ?? tasks;

  // Management by exception: only show attention preview if there are units needing executive intervention
  const unitsNeedingAttention = React.useMemo(() => {
    return departmentHealth.filter(
      (d) => (d.overdueTasksCount ?? d.overdueTasks ?? 0) > 0 || (d.blockedTasksCount ?? 0) > 0
    );
  }, [departmentHealth]);

  // Tab chuyển đổi giữa Lịch công tác hôm nay và Nhật ký hoạt động ở Tầng 3
  const [activeOpsTab, setActiveOpsTab] = React.useState<"agenda" | "activity">("agenda");

  return (
    <div className="space-y-6 relative min-h-screen pb-10" data-slot="zone-dashboard">
      {/* Mobile Attention-First Feed (viewports < 640px) */}
      <div className="block sm:hidden" data-slot="mobile-workbench-feed-container">
        <WorkbenchMobileFeed />
      </div>

      {/* Desktop Layout (viewports >= 640px) — 3-TIER ARCHITECTURE */}
      <div className="hidden sm:block space-y-6" data-slot="desktop-workbench-container">

        {/* ============================================================
            TẦNG 1: SMART VERDICT BANNER & QUICK TOOLBAR
            ============================================================ */}
        <section aria-label="KẾT LUẬN & NGỮ CẢNH VẬN HÀNH" data-slot="tier-1-verdict-toolbar" className="space-y-3.5">
          {/* Header Title + Action buttons */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-heading font-bold text-2xl sm:text-3xl tracking-tight text-foreground leading-[1.15]">
                Bàn làm việc
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {createPolicy.canCreate && openCreateModal && (
                <Button
                  size="sm"
                  onClick={() => openCreateModal(isExecutive ? "TRUONG" : "DON_VI")}
                  className="h-8 gap-1.5 px-3 text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-[0.97]"
                >
                  <Plus size={14} strokeWidth={1.5} />
                  <span>Tạo nhiệm vụ</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                title="Làm mới dữ liệu"
                aria-label="Làm mới dữ liệu"
                className="size-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <RefreshCw
                  size={14}
                  className={isRefreshing ? "animate-spin text-primary" : "transition-transform"}
                  strokeWidth={1.5}
                />
              </Button>
            </div>
          </div>

          {/* Quick Context Toolbar: Tinh gọn, giảm visual noise */}
          <div
            aria-label="Thanh tác vụ ngữ cảnh: Kỳ vận hành và Phạm vi"
            className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-1.5 rounded-xl bg-muted/30 border border-border/40"
          >
            <div className="flex flex-wrap items-center gap-2">
              <div id="tour-scope-switcher">
                <Suspense fallback={<div className="h-8 w-44 rounded-lg bg-muted/40 animate-pulse" />}>
                  <ScopeSwitcher />
                </Suspense>
              </div>
              <div id="tour-month-selector">
                <Suspense fallback={<div className="h-8 w-32 rounded-lg bg-muted/40 animate-pulse" />}>
                  <GlobalMonthSelector />
                </Suspense>
              </div>
            </div>

            <span className="text-2xs font-mono text-muted-foreground hidden lg:inline-block">
              Múi giờ ICT (UTC+7)
            </span>
          </div>

          {/* 5-Second Smart Verdict Banner */}
          <DashboardSituationStrip
            stats={displayedStats}
            executiveStats={executiveStats}
            departmentHealth={departmentHealth}
            isExecutive={isExecutive}
            user={user}
          />
        </section>

        {/* ============================================================
            TẦNG 2: ACTION CENTER / PERSONAL WORKBENCH (HÀNH ĐỘNG 1-CHẠM)
            ============================================================ */}
        <section aria-label="CẦN XỬ LÝ" data-slot="section-action" className="space-y-4">
          {(isExecutive && executiveStats) ? (
            <ExecutiveActionCenter
              stats={executiveStats}
              activeFilter={executiveFilter}
              onFilterChange={setExecutiveFilter}
              items={executiveActionItems ?? []}
              isLoading={isLoading}
              errorMessage={errorMessage}
              onAction={(_type, item) => openTaskDetailById(item.taskId)}
            />
          ) : !isExecutive ? (
            <PersonalWorkbench
              tasks={baseTasks}
              filteredTasks={filteredTasks}
              user={user}
              role={isManager ? "MANAGER" : "STAFF"}
              isManager={isManager}
              isStaff={isStaff}
              onSelectTask={openTaskDetail}
              hideHeader
              attentionOnly
            />
          ) : null}
        </section>

        {/* ============================================================
            TẦNG 3: OPERATIONS CONTEXT (NGỮ CẢNH VẬN HÀNH & LỊCH TRÌNH)
            ============================================================ */}
        <section aria-label="CHI TIẾT VẬN HÀNH" data-slot="section-details" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Cột 1: Nhiệm vụ sắp tới hạn (Upcoming Deadlines) */}
            <div className="lg:col-span-7 space-y-4">
              <UpcomingDeadlinesWidget
                items={roleUpcoming}
                onSelectTask={(item) => openTaskDetailById(item.taskId || item.id)}
              />
            </div>

            {/* Cột 2: Lịch công tác hôm nay & Hoạt động vừa cập nhật */}
            <div className="lg:col-span-5 space-y-3">
              {/* Cảnh báo đơn vị cần chú ý cho BGH */}
              {isExecutive && unitsNeedingAttention.length > 0 && (
                <DepartmentAttentionPreview departments={unitsNeedingAttention} limit={5} />
              )}

              {/* Tab selector giữa Lịch công tác hôm nay và Nhật ký hoạt động */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1 p-0.5 rounded-xl bg-muted/50 border border-border/40 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveOpsTab("agenda")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer",
                      activeOpsTab === "agenda"
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <CalendarIcon className="size-3.5" strokeWidth={1.5} />
                    <span>Lịch công tác</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveOpsTab("activity")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer",
                      activeOpsTab === "activity"
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <History className="size-3.5" strokeWidth={1.5} />
                    <span>Hoạt động</span>
                  </button>
                </div>
              </div>

              {/* Nội dung theo tab được chọn */}
              {activeOpsTab === "agenda" ? (
                <TodayAgendaWidget
                  tasks={tasks}
                  onSelectTask={openTaskDetail}
                />
              ) : (
                <ActivityFeedWidget
                  activities={activities}
                  initialLimit={4}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export const DashboardZone = React.memo(DashboardZoneComponent);
