"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExecutiveStatStrip } from "@/components/dashboard/executive-stat-strip";
import { ExecutiveActionCenter } from "@/components/dashboard/executive-action-center";
import { DepartmentProgressMatrix } from "@/components/dashboard/department-progress-matrix";
import { UpcomingDeadlinesWidget } from "@/components/dashboard/upcoming-deadlines-widget";
import { ActivityFeedWidget } from "@/components/dashboard/activity-feed-widget";
import { PriorOverdueBacklogBanner } from "@/components/dashboard/prior-overdue-backlog-banner";
import {
  useDashboardData,
  useDashboardActions,
} from "@/components/dashboard/dashboard-context";

function DashboardZoneComponent() {
  const {
    displayedStats,
    activeWorkbox,
    isExecutive,
    executiveStats,
    executiveFilter,
    departmentHealth,
    selectedDepartment,
    selectedAcademicMonth,
    selectedMonthPeriod,
    priorOverdueBacklog,
    roleUpcoming,
    activities,
    isRefreshing,
    user,
  } = useDashboardData();

  const {
    setActiveWorkbox,
    setExecutiveFilter,
    handleDepartmentChange,
    handleManualRefresh,
    handleSelectUpcoming,
  } = useDashboardActions();

  return (
    <div className="space-y-6" data-slot="zone-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-2xs font-mono">
              Phân khu Điều hành
            </span>
            {selectedAcademicMonth !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-900 border border-amber-500/20 shadow-2xs font-mono">
                {selectedMonthPeriod
                  ? `KỲ VẬN HÀNH THÁNG ${selectedAcademicMonth} (${selectedMonthPeriod.shortDateSpan}/2026)`
                  : `KỲ VẬN HÀNH THÁNG ${selectedAcademicMonth}`}
              </span>
            )}
            <span className="text-xs text-muted-foreground font-medium">
              {isExecutive ? "BGH Giám sát toàn trường" : `Đơn vị: ${user?.department || "QCET"}`}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-heading">
            Dashboard Điều Hành & Báo Cáo KPI
          </h1>
          <p className="text-xs text-muted-foreground mt-1 text-balance">
            Theo dõi toàn cảnh tiến độ, điểm nghẽn, và hàng đợi phê duyệt chiến lược của 11 đơn vị
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="hidden sm:inline-flex gap-1.5 text-xs rounded-xl"
          >
            <RefreshCw
              size={14}
              className={isRefreshing ? "animate-spin text-primary" : ""}
            />
            <span className="hidden sm:inline">Làm mới dữ liệu</span>
          </Button>
        </div>
      </div>

      {/* Stat Strip */}
      <section aria-label="Chỉ số điều hành toàn trường">
        <ExecutiveStatStrip
          stats={displayedStats}
          activeFilter={activeWorkbox}
          onFilterChange={(filter) => setActiveWorkbox(filter)}
        />
      </section>

      {/* Prior Overdue Backlog Banner */}
      {priorOverdueBacklog && priorOverdueBacklog.length > 0 && selectedAcademicMonth !== "ALL" && (
        <PriorOverdueBacklogBanner
          tasks={priorOverdueBacklog}
          selectedMonth={selectedAcademicMonth}
          monthPeriod={selectedMonthPeriod}
        />
      )}

      {/* Executive Cockpit (BGH only) */}
      {isExecutive && executiveStats && (
        <section aria-label="Khoang điều hành Ban Giám hiệu" className="space-y-4">
          <ExecutiveActionCenter
            stats={executiveStats}
            activeFilter={executiveFilter}
            onFilterChange={setExecutiveFilter}
          />
          <DepartmentProgressMatrix
            departments={departmentHealth}
            selectedDepartment={selectedDepartment}
            onSelectDepartment={handleDepartmentChange}
          />
        </section>
      )}

      {/* Widgets Grid: Upcoming Deadlines & Live Activity Feed */}
      <section
        aria-label="Tiện ích theo dõi tiến độ và hoạt động"
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
      >
        <UpcomingDeadlinesWidget
          items={roleUpcoming}
          onSelectTask={handleSelectUpcoming}
        />
        <ActivityFeedWidget activities={activities} />
      </section>
    </div>
  );
}

export const DashboardZone = React.memo(DashboardZoneComponent);
