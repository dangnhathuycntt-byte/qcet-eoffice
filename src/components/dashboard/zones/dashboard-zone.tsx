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
    <div className="space-y-6 sm:space-y-8 relative min-h-screen" data-slot="zone-dashboard">
      {/* Ambient background gradient — decorative only, pointer-events-none */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 20% 0%, oklch(0.95 0.025 250 / 0.35) 0%, transparent 60%), " +
            "radial-gradient(ellipse 60% 40% at 80% 100%, oklch(0.96 0.018 150 / 0.2) 0%, transparent 55%)",
        }}
      />
      {/* Mobile Attention-First Feed (viewports < 640px) */}
      <div className="block sm:hidden" data-slot="mobile-workbench-feed-container">
        <WorkbenchMobileFeed />
      </div>

      {/* Desktop Layout (viewports >= 640px) — SUMMARY → ACTION → CONTEXT */}
      <div className="hidden sm:block space-y-7" data-slot="desktop-workbench-container">

        {/* HEADER: Title + Create + Toolbar + Situation */}
        <div className="space-y-3" data-slot="dashboard-header">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-heading font-bold text-2xl sm:text-3xl tracking-tight text-foreground leading-[1.15]">
                Bàn làm việc
              </h1>
              {/* Situation strip inline dưới tiêu đề trên tablet */}
              <div className="md:hidden mt-1">
                <DashboardSituationStrip
                  stats={displayedStats}
                  executiveStats={executiveStats}
                  departmentHealth={departmentHealth}
                  isExecutive={isExecutive}
                  className="py-0 px-0"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {createPolicy.canCreate && openCreateModal && (
                <Button
                  size="sm"
                  onClick={() => openCreateModal(isExecutive ? "TRUONG" : "DON_VI")}
                  className="h-8 gap-1.5 px-3 text-xs font-semibold rounded-lg shadow-xs transition-all active:scale-[0.97]"
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
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw
                  size={14}
                  className={isRefreshing ? "animate-spin text-primary" : "transition-transform"}
                  strokeWidth={1.5}
                />
              </Button>
            </div>
          </div>

          {/* Toolbar: Scope / Period / Situation (desktop) */}
          <div
            aria-label="Thanh tác vụ ngữ cảnh: KỲ VẬN HÀNH và Phạm vi"
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/50 shadow-xs"
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
            <DashboardSituationStrip
              stats={displayedStats}
              executiveStats={executiveStats}
              departmentHealth={departmentHealth}
              isExecutive={isExecutive}
              className="hidden md:flex py-0 px-1"
            />
          </div>
        </div>

        {/* SECTION 1 — CẦN XỬ LÝ */}
        <section aria-label="CẦN XỬ LÝ" data-slot="section-action" className="space-y-3 rounded-2xl bg-primary/[0.03] border border-primary/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold tracking-widest uppercase select-none inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{background: "oklch(0.42 0.18 250)", color: "white", letterSpacing: "0.1em"}}>Cần xử lý</span>
            <div className="flex-1 h-px" style={{background: "linear-gradient(to right, oklch(0.42 0.18 250 / 0.3), transparent)"}} />
          </div>
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

        {/* SECTION 2 — CHI TIẾT VẬN HÀNH */}
        <section aria-label="CHI TIẾT VẬN HÀNH" data-slot="section-details" className="space-y-3 pt-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold tracking-widest text-muted-foreground/60 uppercase select-none">Ngữ cảnh vận hành</span>
            <div className="flex-1 h-px bg-border/40" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 space-y-4">
              <UpcomingDeadlinesWidget
                items={roleUpcoming}
                onSelectTask={(item) => openTaskDetailById(item.taskId || item.id)}
              />
            </div>
            <div className="lg:col-span-5 space-y-4">
              {isExecutive && departmentHealth.length > 0 && (
                <DepartmentAttentionPreview departments={departmentHealth} limit={5} />
              )}
              <ActivityFeedWidget activities={activities} initialLimit={4} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export const DashboardZone = React.memo(DashboardZoneComponent);
