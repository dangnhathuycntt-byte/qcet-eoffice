"use client";

import * as React from "react";
import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScopeSwitcher } from "@/components/layout/scope-switcher";
import { GlobalMonthSelector } from "@/components/layout/global-month-selector";
import { DashboardSituationStrip } from "@/components/dashboard/dashboard-situation-strip";
import { ExecutiveActionCenter } from "@/components/dashboard/executive-action-center";
import { DepartmentProgressMatrix } from "@/components/dashboard/department-progress-matrix";
import { UpcomingDeadlinesWidget } from "@/components/dashboard/upcoming-deadlines-widget";
import { ActivityFeedWidget } from "@/components/dashboard/activity-feed-widget";
import { PersonalWorkbench } from "@/components/dashboard/personal-workbench";
import { WorkbenchMobileFeed } from "@/components/dashboard/workbench-mobile-feed";
import { QCET_DEPARTMENTS } from "@/components/org/organization-tree";
import {
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
  useDashboardNav,
} from "@/components/dashboard/dashboard-context";

function DashboardZoneComponent() {
  const {
    tasks, monthScopedBaseTasks, filteredTasks, user, displayedStats, executiveStats,
    executiveFilter, executiveActionItems, departmentHealth, isExecutive, isManager, isStaff,
    selectedAcademicMonth, selectedMonthPeriod, roleUpcoming, activities, isRefreshing,
  } = useDashboardData();

  const { setExecutiveFilter, handleManualRefresh } = useDashboardActions();
  const { openTaskDetail } = useDashboardModal();
  const { scope } = useDashboardNav();

  const baseTasks = monthScopedBaseTasks ?? tasks;
  const reactiveTasks = filteredTasks;
  const operationalUnitCount = QCET_DEPARTMENTS.filter((d) => d.category !== "BGH").length;

  const roleBadge = isExecutive ? "Bàn làm việc Điều hành" : isManager ? "Bàn làm việc Quản lý" : "Bàn làm việc Cá nhân";
  const roleTitle = isExecutive ? "Bàn làm việc Ban Giám hiệu" : isManager ? `Bàn làm việc ${user?.department || "Đơn vị"}` : `Bàn làm việc: ${user?.name || "Cán bộ / Giảng viên"}`;
  const roleSubtitle = isExecutive ? `Theo dõi toàn cảnh tiến độ, điểm nghẽn và hàng đợi phê duyệt của ${operationalUnitCount} đơn vị trực thuộc` : isManager ? "Điều phối công việc đơn vị, thẩm định minh chứng L1 và kiểm soát tiến độ" : "Nhiệm vụ cá nhân hôm nay, việc chờ nộp minh chứng và hạn chót cần xử lý";

  return (
    <div className="space-y-5 sm:space-y-6" data-slot="zone-dashboard">
      {/* Mobile Attention-First Feed (viewports < 640px) */}
      <div className="block sm:hidden" data-slot="mobile-workbench-feed-container">
        <WorkbenchMobileFeed />
      </div>

      {/* Desktop Layout (viewports >= 640px) — strict ACTION → SITUATION → CONTEXT */}
      <div className="hidden sm:block space-y-6" data-slot="desktop-workbench-container">

        {/* HEADER: Scope / Period / Actions */}
        <div className="space-y-4" data-slot="dashboard-header">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-sans font-medium text-xs bg-primary/10 text-primary border border-primary/20 shadow-2xs">{roleBadge}</span>
            </div>
            <h1 className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-foreground">{roleTitle}</h1>
            <p className="text-xs text-muted-foreground mt-1 text-balance">{roleSubtitle}</p>
          </div>
          <div aria-label="Thanh tác vụ ngữ cảnh: KỲ VẬN HÀNH THÁNG và Phạm vi" className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-muted/30 border border-border/50">
            <div className="flex flex-wrap items-center gap-2">
              <div id="tour-scope-switcher"><Suspense fallback={<div className="h-8 w-44 rounded-lg bg-muted/40 animate-pulse" />}><ScopeSwitcher /></Suspense></div>
              <div id="tour-month-selector"><Suspense fallback={<div className="h-8 w-32 rounded-lg bg-muted/40 animate-pulse" />}><GlobalMonthSelector /></Suspense></div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={isRefreshing} className="gap-1.5 text-xs rounded-xl min-h-[44px] sm:min-h-[36px] touch-manipulation">
                <RefreshCw size={14} className={isRefreshing ? "animate-spin text-primary" : ""} />
                <span>Làm mới dữ liệu</span>
              </Button>
            </div>
          </div>
        </div>

        {/* SECTION 1 — ACTION (CẦN XỬ LÝ): exactly ONE attention surface */}
        <section aria-label="CẦN XỬ LÝ" data-slot="section-action">
          {(isExecutive && executiveStats) ? (
            <ExecutiveActionCenter
              stats={executiveStats}
              activeFilter={executiveFilter}
              onFilterChange={setExecutiveFilter}
              items={executiveActionItems}
              onAction={(_type, item) => {
                const matched = baseTasks.find((t) => t.id === item.id || t.id === item.taskId);
                if (matched) openTaskDetail(matched);
              }}
            />
          ) : !isExecutive ? (
            <PersonalWorkbench
              tasks={reactiveTasks}
              filteredTasks={reactiveTasks}
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

        {/* SECTION 2 — SITUATION (TÌNH HÌNH): compact macro situation summary */}
        <section aria-label="TÌNH HÌNH" data-slot="section-situation">
          <DashboardSituationStrip
            stats={displayedStats}
            executiveStats={executiveStats}
            departmentHealth={departmentHealth}
            isExecutive={isExecutive}
          />
        </section>

        {/* SECTION 3 — CONTEXT (ĐƠN VỊ CẦN CHÚ Ý / Chi tiết / Drill-down) */}
        <section aria-label="ĐƠN VỊ CẦN CHÚ Ý" data-slot="section-context" className="space-y-4">
          {isExecutive && departmentHealth.length > 0 && (
            <DepartmentProgressMatrix departments={departmentHealth} defaultViewMode="ranking" />
          )}
          {roleUpcoming.length > 0 && (
            <UpcomingDeadlinesWidget items={roleUpcoming.slice(0, 5)} />
          )}
          {activities.length > 0 && (
            <ActivityFeedWidget activities={activities.slice(0, 5)} />
          )}
        </section>
      </div>
    </div>
  );
}

export const DashboardZone = React.memo(DashboardZoneComponent);
