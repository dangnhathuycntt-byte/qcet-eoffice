"use client";

import * as React from "react";
import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScopeSwitcher } from "@/components/layout/scope-switcher";
import { GlobalMonthSelector } from "@/components/layout/global-month-selector";
import { DashboardSituationStrip } from "@/components/dashboard/dashboard-situation-strip";
import { ExecutiveActionCenter } from "@/components/dashboard/executive-action-center";
import { DepartmentAttentionPreview } from "@/components/dashboard/department-attention-preview";
import { UpcomingDeadlinesWidget } from "@/components/dashboard/upcoming-deadlines-widget";
import { ActivityFeedWidget } from "@/components/dashboard/activity-feed-widget";
import { PersonalWorkbench } from "@/components/dashboard/personal-workbench";
import { WorkbenchMobileFeed } from "@/components/dashboard/workbench-mobile-feed";
import {
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
} from "@/components/dashboard/dashboard-context";

function DashboardZoneComponent() {
  const {
    tasks, monthScopedBaseTasks, filteredTasks, user, displayedStats, executiveStats,
    executiveFilter, executiveActionItems, departmentHealth, isExecutive, isManager, isStaff,
    roleUpcoming, activities, isRefreshing, isLoading, errorMessage,
  } = useDashboardData();

  const { setExecutiveFilter, handleManualRefresh } = useDashboardActions();
  const { openTaskDetail, openTaskDetailById } = useDashboardModal();

  // The scope + period set, so the personal queue's counts match the shared context.
  const baseTasks = monthScopedBaseTasks ?? tasks;

  return (
    <div className="space-y-5 sm:space-y-6" data-slot="zone-dashboard">
      {/* Mobile Attention-First Feed (viewports < 640px) */}
      <div className="block sm:hidden" data-slot="mobile-workbench-feed-container">
        <WorkbenchMobileFeed />
      </div>

      {/* Desktop Layout (viewports >= 640px) — SUMMARY → ACTION → CONTEXT */}
      <div className="hidden sm:block space-y-6" data-slot="desktop-workbench-container">

        {/* HEADER: Scope / Period / Actions */}
        <div className="space-y-4" data-slot="dashboard-header">
          <h1 className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-foreground">
            Bàn làm việc
          </h1>
          <div
            aria-label="Thanh tác vụ ngữ cảnh: KỲ VẬN HÀNH THÁNG và Phạm vi"
            className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-muted/30 border border-border/50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <div id="tour-scope-switcher"><Suspense fallback={<div className="h-8 w-44 rounded-lg bg-muted/40 animate-pulse" />}><ScopeSwitcher /></Suspense></div>
              <div id="tour-month-selector"><Suspense fallback={<div className="h-8 w-32 rounded-lg bg-muted/40 animate-pulse" />}><GlobalMonthSelector /></Suspense></div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={handleManualRefresh} disabled={isRefreshing} className="gap-1.5 text-xs rounded-xl min-h-[44px] sm:min-h-[36px] touch-manipulation text-muted-foreground">
                <RefreshCw size={14} className={isRefreshing ? "animate-spin text-primary" : ""} strokeWidth={1.5} />
                <span>Làm mới dữ liệu</span>
              </Button>
            </div>
          </div>
        </div>

        {/* SECTION 1 — SITUATION (TÌNH HÌNH): compact summary BEFORE the queue */}
        <section aria-label="TÌNH HÌNH" data-slot="section-situation">
          <DashboardSituationStrip
            stats={displayedStats}
            executiveStats={executiveStats}
            departmentHealth={departmentHealth}
            isExecutive={isExecutive}
          />
        </section>

        {/* SECTION 2 — ACTION (CẦN XỬ LÝ): exactly ONE attention surface */}
        <section aria-label="CẦN XỬ LÝ" data-slot="section-action">
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

        {/* SECTION 3 — CONTEXT (ĐƠN VỊ CẦN CHÚ Ý / Hạn chót / Hoạt động) */}
        <section aria-label="ĐƠN VỊ CẦN CHÚ Ý" data-slot="section-context" className="space-y-4">
          {isExecutive && departmentHealth.length > 0 && (
            <DepartmentAttentionPreview departments={departmentHealth} limit={5} />
          )}
          <UpcomingDeadlinesWidget
            items={roleUpcoming}
            onSelectTask={(item) => openTaskDetailById(item.taskId || item.id)}
          />
          <ActivityFeedWidget activities={activities} initialLimit={3} />
        </section>
      </div>
    </div>
  );
}

export const DashboardZone = React.memo(DashboardZoneComponent);
