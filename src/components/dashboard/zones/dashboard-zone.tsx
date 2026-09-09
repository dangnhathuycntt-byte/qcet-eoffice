"use client";

import * as React from "react";
import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScopeSwitcher } from "@/components/layout/scope-switcher";
import { GlobalMonthSelector } from "@/components/layout/global-month-selector";
import { ExecutiveStatStrip } from "@/components/dashboard/executive-stat-strip";
import { ExecutiveActionCenter } from "@/components/dashboard/executive-action-center";
import { DepartmentProgressMatrix } from "@/components/dashboard/department-progress-matrix";
import { UpcomingDeadlinesWidget } from "@/components/dashboard/upcoming-deadlines-widget";
import { ActivityFeedWidget } from "@/components/dashboard/activity-feed-widget";
import { PriorOverdueBacklogBanner } from "@/components/dashboard/prior-overdue-backlog-banner";
import { CascadingTaskTable } from "@/components/dashboard/cascading-task-table";
import { QCET_DEPARTMENTS } from "@/components/org/organization-tree";
import {
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
  useDashboardNav,
} from "@/components/dashboard/dashboard-context";
import type { SchoolTask } from "@/types/dashboard";

function DashboardZoneComponent() {
  const {
    tasks, monthScopedBaseTasks, filteredTasks, user, displayedStats, activeWorkbox,
    isExecutive, executiveStats, executiveFilter, executiveActionItems, departmentHealth,
    selectedDepartment, selectedAcademicMonth, selectedMonthPeriod,
    priorOverdueBacklog, roleUpcoming, activities, isRefreshing,
  } = useDashboardData();

  const {
    setActiveWorkbox, setExecutiveFilter, handleDepartmentChange,
    handleManualRefresh, handleSelectUpcoming, handleStatusChange,
  } = useDashboardActions();
  const { openTaskDetail, openCreateModal } = useDashboardModal();
  const { scope } = useDashboardNav();

  const baseTasks = monthScopedBaseTasks ?? tasks;
  const reactiveTasks = filteredTasks;
  const operationalUnitCount = QCET_DEPARTMENTS.filter((d) => d.category !== "BGH").length;

  return (
    <div className="space-y-5 sm:space-y-6" data-slot="zone-dashboard">
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-sans font-medium text-xs bg-primary/10 text-primary border border-primary/20 shadow-2xs">Phân khu Điều hành</span>
          </div>
          <h1 className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-foreground">Dashboard Điều Hành & Báo Cáo KPI</h1>
          <p className="text-xs text-muted-foreground mt-1 text-balance">
            Theo dõi toàn cảnh tiến độ, điểm nghẽn, và hàng đợi phê duyệt chiến lược của {operationalUnitCount} đơn vị trực thuộc
          </p>
        </div>

        {/* Contextual Action Bar: KỲ VẬN HÀNH THÁNG & Phạm vi */}
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

      {/* Stat Strip */}
      <section aria-label="Chỉ số điều hành toàn trường">
        <ExecutiveStatStrip stats={displayedStats} activeFilter={activeWorkbox} onFilterChange={(filter) => setActiveWorkbox(filter)} />
      </section>

      {/* Prior Overdue Backlog Banner */}
      {priorOverdueBacklog && priorOverdueBacklog.length > 0 && selectedAcademicMonth !== "ALL" && (
        <PriorOverdueBacklogBanner tasks={priorOverdueBacklog} selectedMonth={selectedAcademicMonth} monthPeriod={selectedMonthPeriod} />
      )}

      {/* Executive Cockpit (BGH only) */}
      {isExecutive && executiveStats && (
        <section aria-label="Khoang điều hành Ban Giám hiệu" className="space-y-4">
          <ExecutiveActionCenter
            stats={executiveStats}
            activeFilter={executiveFilter}
            onFilterChange={setExecutiveFilter}
            items={executiveActionItems}
            onAction={(actionType, item) => {
              const matched = baseTasks.find((t) => t.id === item.id || t.id === item.taskId);
              if (matched) openTaskDetail(matched);
            }}
          />
          <DepartmentProgressMatrix departments={departmentHealth} selectedDepartment={selectedDepartment} onSelectDepartment={handleDepartmentChange} />
        </section>
      )}

      {/* Bảng nhiệm vụ liên thông phản hồi theo bộ lọc */}
      <section aria-label="Bảng nhiệm vụ liên thông" className="space-y-3">
        <CascadingTaskTable
          tasks={reactiveTasks}
          scope={scope}
          defaultExpanded={scope === "MY_TASKS"}
          onSelectTask={openTaskDetail}
          onAddTask={() => openCreateModal("TRUONG")}
          onStatusChange={handleStatusChange}
          hideWorkbox
          hideToolbar
          priorOverdueBacklog={[]}
          selectedAcademicMonth={selectedAcademicMonth}
        />
      </section>

      {/* Widgets Grid: Upcoming Deadlines & Live Activity Feed */}
      <section aria-label="Tiện ích theo dõi tiến độ và hoạt động" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <UpcomingDeadlinesWidget items={roleUpcoming} onSelectTask={handleSelectUpcoming} />
        <ActivityFeedWidget activities={activities} />
      </section>
    </div>
  );
}

export const DashboardZone = React.memo(DashboardZoneComponent);
