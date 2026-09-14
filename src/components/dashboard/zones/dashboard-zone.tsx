"use client";

import * as React from "react";
import { Suspense } from "react";
import { Plus, RefreshCw } from "lucide-react";
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
import { resolveCreateTaskPolicy } from "@/components/dashboard/create-task-modal";
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
  const { openTaskDetail, openTaskDetailById, openCreateModal } = useDashboardModal();

  const createPolicy = React.useMemo(() => resolveCreateTaskPolicy(user), [user]);

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
        <div className="space-y-3" data-slot="dashboard-header">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-foreground">
              Bàn làm việc
            </h1>
            {createPolicy.canCreate && openCreateModal && (
              <Button
                size="sm"
                onClick={() => openCreateModal(isExecutive ? "TRUONG" : "DON_VI")}
                className="h-8 gap-1.5 px-3 text-xs font-semibold rounded-lg shadow-xs"
              >
                <Plus size={14} strokeWidth={2} />
                <span>Tạo nhiệm vụ</span>
              </Button>
            )}
          </div>
          <div
            aria-label="Thanh tác vụ ngữ cảnh: KỲ VẬN HÀNH và Phạm vi"
            className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-xl bg-card border border-border/60"
          >
            <div className="flex flex-wrap items-center gap-2">
              <div id="tour-scope-switcher"><Suspense fallback={<div className="h-8 w-44 rounded-lg bg-muted/40 animate-pulse" />}><ScopeSwitcher /></Suspense></div>
              <div id="tour-month-selector"><Suspense fallback={<div className="h-8 w-32 rounded-lg bg-muted/40 animate-pulse" />}><GlobalMonthSelector /></Suspense></div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                title="Làm mới dữ liệu"
                aria-label="Làm mới dữ liệu"
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <RefreshCw size={14} className={isRefreshing ? "animate-spin text-primary" : ""} strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        </div>

        {/* SECTION 1 — ACTION (CẦN XỬ LÝ): action-first hierarchy */}
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

        {/* SECTION 2 — SITUATION (TÌNH HÌNH): compact summary following the queue */}
        <section aria-label="TÌNH HÌNH" data-slot="section-situation">
          <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tình hình trong kỳ</p>
          <DashboardSituationStrip
            stats={displayedStats}
            executiveStats={executiveStats}
            departmentHealth={departmentHealth}
            isExecutive={isExecutive}
          />
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
