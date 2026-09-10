"use client";

import * as React from "react";
import { Plus, RefreshCw, Calendar as CalendarIcon, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
} from "@/components/dashboard/dashboard-context";
import {
  ACADEMIC_MONTH_ORDER,
  getAcademicMonthPeriod,
  type AcademicMonthPeriod,
} from "@/lib/academic-calendar";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";

function CalendarZoneComponent() {
  const {
    filteredTasks,
    selectedAcademicMonth,
    monthlyTaskCounts,
    isExecutive,
    isRefreshing,
  } = useDashboardData();
  const { handleManualRefresh, handleAcademicMonthChange } = useDashboardActions();
  const { openCreateModal, openTaskDetail } = useDashboardModal();

  const activePeriod: AcademicMonthPeriod | null = React.useMemo(() => {
    if (typeof selectedAcademicMonth === "number") {
      return getAcademicMonthPeriod(selectedAcademicMonth, "2026-2027");
    }
    return null;
  }, [selectedAcademicMonth]);

  const totalAllTasks = React.useMemo(() => {
    return Object.values(monthlyTaskCounts).reduce((sum, count) => sum + count, 0);
  }, [monthlyTaskCounts]);

  return (
    <div className="space-y-6" data-slot="zone-calendar">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-2xs font-mono">
              Phân khu Lịch công tác
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-heading">
            Lịch Công Tác & Hạn Chót Toàn Trường
          </h1>
          <p className="text-xs text-muted-foreground mt-1 text-balance">
            Theo dõi lịch trình các nhiệm vụ, sự kiện BGH và hạn chót giao việc theo thời gian thực
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isExecutive && (
            <Button
              onClick={() => openCreateModal("TRUONG")}
              className="gap-1.5 text-xs font-bold rounded-xl"
            >
              <Plus size={14} />
              <span>Thêm sự kiện / Việc mới</span>
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
              className={isRefreshing ? "animate-spin text-primary" : ""}
            />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* 12-Month Interactive Strip Selector */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/70 p-3 shadow-xs">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Chu kỳ tháng học thuật (2026 - 2027)
          </span>
          <span className="text-2xs font-mono text-muted-foreground">
            QCET Cycle 25th - 24th
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {/* Option: Cả năm */}
          <button
            type="button"
            onClick={() => handleAcademicMonthChange("ALL")}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all cursor-pointer border",
              selectedAcademicMonth === "ALL"
                ? "bg-primary text-primary-foreground font-semibold border-primary shadow-xs"
                : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground border-border/70"
            )}
          >
            <span>Cả năm</span>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-2xs font-mono font-bold tabular-nums",
                selectedAcademicMonth === "ALL"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {totalAllTasks}
            </span>
          </button>

          {/* 12 Academic Months in Order */}
          {ACADEMIC_MONTH_ORDER.map((m) => {
            const period = getAcademicMonthPeriod(m, "2026-2027");
            const isSelected = selectedAcademicMonth === m;
            const taskCount = monthlyTaskCounts[m] || 0;

            return (
              <button
                key={m}
                type="button"
                onClick={() => handleAcademicMonthChange(m)}
                title={`Kỳ vận hành Tháng ${m}: ${period.startDate} đến ${period.endDate}`}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all cursor-pointer border",
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold border-primary shadow-xs"
                    : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground border-border/70"
                )}
              >
                <span>Tháng {m}</span>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-2xs font-mono font-bold tabular-nums",
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {taskCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Operational Cycle Status Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
          {activePeriod ? (
            <div className="flex items-center gap-2 text-foreground">
              <CalendarIcon size={14} className="text-primary shrink-0" />
              <span>
                <strong>Kỳ vận hành Tháng {activePeriod.monthNumber} / {activePeriod.calendarYear}</strong>: Từ ngày{" "}
                <span className="font-mono font-semibold text-primary">{activePeriod.startDate}</span> đến ngày{" "}
                <span className="font-mono font-semibold text-primary">{activePeriod.endDate}</span> ({activePeriod.dateSpanVi})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarIcon size={14} className="text-muted-foreground shrink-0" />
              <span>
                <strong>Toàn năm học 2026 - 2027</strong>: Hiển thị tổng thể toàn bộ 12 kỳ vận hành
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <Clock size={12} className="text-muted-foreground/80" />
            <span>Ngày chốt số liệu: 24 hàng tháng</span>
          </div>
        </div>
      </div>

      {/* Main Calendar View Section */}
      <section aria-label="Lưới lịch tháng">
        <CalendarMonthView
          tasks={filteredTasks}
          selectedAcademicMonth={selectedAcademicMonth}
          onAcademicMonthChange={handleAcademicMonthChange}
          initialMonth={typeof selectedAcademicMonth === "number" ? selectedAcademicMonth : 9}
          initialYear={2026}
          onPeriodChange={(newPeriod) => {
            handleAcademicMonthChange(newPeriod.monthNumber);
          }}
          onSelectTask={(task) => openTaskDetail(task)}
          onAddTask={() => openCreateModal("TRUONG")}
        />
      </section>
    </div>
  );
}

export const CalendarZone = React.memo(CalendarZoneComponent);
