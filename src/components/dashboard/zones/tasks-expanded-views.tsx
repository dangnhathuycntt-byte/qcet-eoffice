"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  RefreshCw, UserCheck, ShieldAlert, Table, KanbanSquare,
  Calendar, Building2, FileCheck, SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DensityToggle } from "@/components/ui/density-toggle";
import { ExecutiveStatStrip } from "@/components/dashboard/executive-stat-strip";
import { CascadingTaskTable } from "@/components/dashboard/cascading-task-table";
import { SimplifiedTaskFilterBar } from "@/components/dashboard/simplified-task-filter-bar";
import { UnifiedTaskToolbar, type TaskViewMode } from "@/components/dashboard/unified-task-toolbar";
import {
  useDashboardNav,
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
} from "@/components/dashboard/dashboard-context";

const TaskKanbanBoard = dynamic(
  () => import("@/components/tasks/task-kanban-board").then((m) => m.TaskKanbanBoard),
  { ssr: false, loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" /> }
);
const CalendarMonthView = dynamic(
  () => import("@/components/calendar/calendar-month-view").then((m) => m.CalendarMonthView),
  { ssr: false, loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" /> }
);
const DepartmentGroupedTaskView = dynamic(
  () => import("@/components/dashboard/department-grouped-task-view").then((m) => m.DepartmentGroupedTaskView),
  { ssr: false, loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" /> }
);
const ExecutiveDepartmentCommandCenter = dynamic(
  () => import("@/components/tasks/executive-department-command-center").then((m) => m.ExecutiveDepartmentCommandCenter),
  { ssr: false, loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" /> }
);

interface ViewModeButton {
  id: TaskViewMode;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  adminOnly?: boolean;
}

const VIEW_MODE_BUTTONS: ViewModeButton[] = [
  { id: "executive", label: "Chỉ huy BGH", icon: ShieldAlert, adminOnly: true },
  { id: "table", label: "Bảng phân cấp", icon: Table },
  { id: "kanban", label: "Kanban", icon: KanbanSquare },
  { id: "calendar", label: "Lịch tháng", icon: Calendar },
  { id: "department", label: "Theo đơn vị", icon: Building2 },
];

function TasksExpandedViewsComponent() {
  const {
    scope, viewMode, isStaffExpanded, useAdvancedToolbar,
    handleScopeChange, handleViewModeChange, setUseAdvancedToolbar, handleToggleStaffExpanded,
  } = useDashboardNav();

  const {
    filteredTasks, displayedStats, activeWorkbox, selectedDepartment,
    selectedAcademicMonth, selectedMonthPeriod, monthlyTaskCounts,
    selectedPriority, selectedCategory, searchQuery, user,
    isExecutive, delegations, isRefreshing,
  } = useDashboardData();

  const {
    handleDepartmentChange, handleAcademicMonthChange, setSelectedPriority,
    setSelectedCategory, setSearchQuery, setActiveWorkbox, setExecutiveFilter,
    handleResetFilters, handleStatusChange, handleManualRefresh,
  } = useDashboardActions();

  const { openTaskDetail, openCreateModal, openDelegationModal } = useDashboardModal();

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-2xs font-mono">
              Năm học 2026 - 2027
            </span>
            {selectedMonthPeriod ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-sky-500/10 text-sky-600 border border-sky-500/20 shadow-2xs font-mono">
                <span className="size-1.5 rounded-full bg-sky-500 animate-pulse" />
                <span>{selectedMonthPeriod.label} ({selectedMonthPeriod.shortDateSpan})</span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground font-medium">Cả năm học (12 tháng chu kỳ)</span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-heading">
            Quản lý Giao việc & Nhiệm vụ
          </h1>
          <p className="text-xs text-muted-foreground mt-1 text-balance">
            Trung tâm điều hành và giao việc hợp nhất: Phân cấp nhiệm vụ toàn trường, khoa phòng và cá nhân
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {user?.role === "STAFF" && isStaffExpanded && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleStaffExpanded}
              className="gap-1.5 text-xs rounded-xl border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
            >
              <UserCheck size={14} strokeWidth={1.5} />
              <span>Quay lại Chế độ trọng tâm (Cá nhân)</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="gap-1.5 text-xs rounded-xl"
          >
            <RefreshCw
              size={14}
              strokeWidth={1.5}
              className={isRefreshing ? "animate-spin text-primary" : ""}
            />
            <span className="hidden sm:inline">Làm mới dữ liệu</span>
          </Button>
        </div>
      </div>

      {/* Executive Stat Strip / Interactive Workbox Filter */}
      <section aria-label="Chỉ số điều hành toàn trường">
        <ExecutiveStatStrip
          stats={displayedStats}
          activeFilter={activeWorkbox}
          onFilterChange={(filter) => setActiveWorkbox(filter)}
        />
      </section>

      {/* Simplified Filter Bar for Admin / Manager OR Unified Toolbar when toggled or fallback */}
      {(user?.role === "ADMIN" || user?.role === "MANAGER") && !useAdvancedToolbar ? (
        <section aria-label="Thanh lọc tối giản & Điều hướng nhanh" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground mr-1">Chế độ xem:</span>
              {VIEW_MODE_BUTTONS.filter((b) => !b.adminOnly || user?.role === "ADMIN").map((b) => {
                const Icon = b.icon;
                const isActive = viewMode === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleViewModeChange(b.id as TaskViewMode)}
                    className={cn(
                      "px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-card hover:bg-muted text-muted-foreground border border-border"
                    )}
                  >
                    <Icon size={13} strokeWidth={1.5} />
                    <span>{b.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isExecutive) {
                    handleViewModeChange("executive");
                    setExecutiveFilter("PENDING_APPROVAL");
                  } else {
                    setActiveWorkbox("NEEDS_REVIEW");
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/30 hover:bg-amber-500/20 transition-colors cursor-pointer"
              >
                <FileCheck size={13} strokeWidth={1.5} />
                <span>Hàng đợi phê duyệt</span>
              </button>

              <button
                type="button"
                onClick={() => setUseAdvancedToolbar(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors cursor-pointer"
                title="Mở thanh công cụ đầy đủ"
              >
                <SlidersHorizontal size={13} strokeWidth={1.5} />
                <span className="hidden md:inline">Thanh công cụ đầy đủ</span>
              </button>

              <DensityToggle className="h-7.5 rounded-xl border-border/70 shadow-2xs" />
            </div>
          </div>

          <SimplifiedTaskFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeStatus={
              activeWorkbox === "NEEDS_REVIEW" || activeWorkbox === "URGENT_OVERDUE"
                ? "ACTION_REQUIRED"
                : activeWorkbox === "COMPLETED" ? "COMPLETED" : "ALL"
            }
            onStatusChange={(newStatus) => {
              if (newStatus === "ACTION_REQUIRED") setActiveWorkbox("NEEDS_REVIEW");
              else if (newStatus === "COMPLETED") setActiveWorkbox("COMPLETED");
              else setActiveWorkbox("ALL");
            }}
            selectedDepartment={selectedDepartment}
            onDepartmentChange={handleDepartmentChange}
            selectedAcademicMonth={selectedAcademicMonth}
            onAcademicMonthChange={handleAcademicMonthChange}
            selectedPriority={selectedPriority}
            onPriorityChange={setSelectedPriority}
            totalCount={filteredTasks.length}
            onResetFilters={handleResetFilters}
          />
        </section>
      ) : (
        <section aria-label="Thanh công cụ điều khiển nhiệm vụ" className="space-y-2">
          {(user?.role === "ADMIN" || user?.role === "MANAGER") && useAdvancedToolbar && (
            <div className="flex justify-end mb-1">
              <button
                type="button"
                onClick={() => setUseAdvancedToolbar(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-colors cursor-pointer"
              >
                <SlidersHorizontal size={13} strokeWidth={1.5} />
                <span>Quay lại Bộ lọc tinh giản</span>
              </button>
            </div>
          )}
          <UnifiedTaskToolbar
            scope={scope}
            onScopeChange={handleScopeChange}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            selectedDepartment={selectedDepartment}
            onDepartmentChange={handleDepartmentChange}
            selectedPriority={selectedPriority}
            onPriorityChange={setSelectedPriority}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onNewTaskClick={() => openCreateModal("TRUONG")}
            totalTasksCount={filteredTasks.length}
            isExecutive={isExecutive}
            userRole={user?.role}
            selectedAcademicMonth={selectedAcademicMonth}
            onAcademicMonthChange={handleAcademicMonthChange}
            academicYear="2026-2027"
            monthlyTaskCounts={monthlyTaskCounts}
          />

          {selectedMonthPeriod && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block size-1.5 rounded-full bg-primary shrink-0" />
                <span className="truncate">
                  Đang lọc hiển thị theo chu kỳ <strong>{selectedMonthPeriod.fullLabel}</strong> ({filteredTasks.length} nhiệm vụ)
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleAcademicMonthChange("ALL")}
                className="shrink-0 text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                Hiển thị cả năm
              </button>
            </div>
          )}
        </section>
      )}

      {/* Dynamic Work Canvas */}
      <section
        aria-label="Không gian làm việc nhiệm vụ"
        className="min-h-[420px]"
        data-slot="work-canvas"
      >
        {viewMode === "table" && (
          <CascadingTaskTable
            tasks={filteredTasks}
            onSelectTask={(task) => openTaskDetail(task)}
            onAddTask={() => openCreateModal("TRUONG")}
            onStatusChange={handleStatusChange}
            hideWorkbox
            hideToolbar
          />
        )}

        {viewMode === "kanban" && (
          <TaskKanbanBoard
            tasks={filteredTasks}
            onSelectTask={(task) => openTaskDetail(task)}
            onStatusChange={handleStatusChange}
            onAddTask={() => openCreateModal("TRUONG")}
          />
        )}

        {viewMode === "calendar" && (
          <CalendarMonthView
            tasks={filteredTasks}
            initialMonth={typeof selectedAcademicMonth === "number" ? selectedAcademicMonth : 9}
            initialYear={2026}
            onSelectTask={(task) => openTaskDetail(task)}
            onAddTask={() => openCreateModal("TRUONG")}
          />
        )}

        {viewMode === "department" && (
          <DepartmentGroupedTaskView
            tasks={filteredTasks}
            onSelectTask={(task) => openTaskDetail(task)}
            onStatusChange={handleStatusChange}
            onAddTask={(_deptCode) => openCreateModal("TRUONG")}
            selectedDepartmentFilter={selectedDepartment}
            searchQuery={searchQuery}
            delegations={delegations}
            onManageDelegation={openDelegationModal}
          />
        )}

        {viewMode === "executive" && (
          <ExecutiveDepartmentCommandCenter
            tasks={filteredTasks}
            onSelectTask={(task) => openTaskDetail(task)}
            onSelectDepartment={(deptId) => handleDepartmentChange(deptId || "ALL")}
            selectedDepartmentId={selectedDepartment !== "ALL" ? selectedDepartment : null}
          />
        )}
      </section>
    </>
  );
}

export const TasksExpandedViews = React.memo(TasksExpandedViewsComponent);
