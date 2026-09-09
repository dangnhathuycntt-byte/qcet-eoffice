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
    isExecutive, isManager, isStaff, executiveStats, executiveFilter, executiveActionItems, departmentHealth,
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

  const roleBadge = isExecutive ? "Bàn làm việc Điều hành" : isManager ? "Bàn làm việc Quản lý" : "Bàn làm việc Cá nhân";
  const roleTitle = isExecutive ? "Bàn làm việc Ban Giám hiệu" : isManager ? `Bàn làm việc ${user?.department || "Đơn vị"}` : `Bàn làm việc: ${user?.name || "Cán bộ / Giảng viên"}`;
  const roleSubtitle = isExecutive ? `Theo dõi toàn cảnh tiến độ, điểm nghẽn và hàng đợi phê duyệt chiến lược của ${operationalUnitCount} đơn vị trực thuộc` : isManager ? "Điều phối công việc đơn vị, thẩm định minh chứng L1, theo dõi tiến độ và kiểm soát nguy cơ trễ hạn" : "Tập trung các nhiệm vụ cá nhân hôm nay, việc chờ nộp minh chứng và lịch công tác cần xử lý";

  return (
    <div className="space-y-5 sm:space-y-6" data-slot="zone-dashboard">
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-sans font-medium text-xs bg-primary/10 text-primary border border-primary/20 shadow-2xs">{roleBadge}</span>
          </div>
          <h1 className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-foreground">{roleTitle}</h1>
          <p className="text-xs text-muted-foreground mt-1 text-balance">{roleSubtitle}</p>
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
          <DepartmentProgressMatrix departments={departmentHealth} selectedDepartment={selectedDepartment} onSelectDepartment={handleDepartmentChange} defaultViewMode="ranking" />
        </section>
      )}

      {/* Bảng nhiệm vụ liên thông phản hồi theo bộ lọc */}
      <section aria-label="Bảng nhiệm vụ liên thông" className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="font-heading font-semibold text-base text-foreground">
            {isExecutive ? "Nhiệm vụ điều hành trọng tâm" : isManager ? "Nhiệm vụ quản lý đơn vị" : "Nhiệm vụ cá nhân hôm nay"}
          </h2>
          <a href={isExecutive ? "/tasks?scope=school" : isManager ? "/tasks?scope=unit" : "/tasks?scope=my"} className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1">
            <span>Mở Không gian Nhiệm vụ &rarr;</span>
          </a>
        </div>
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
