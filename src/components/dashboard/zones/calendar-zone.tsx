"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
} from "@/components/dashboard/dashboard-context";

const CalendarMonthView = dynamic(
  () => import("@/components/calendar/calendar-month-view").then((m) => m.CalendarMonthView),
  { ssr: false, loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" /> }
);

function CalendarZoneComponent() {
  const { filteredTasks, selectedAcademicMonth, isExecutive, isRefreshing } = useDashboardData();
  const { handleManualRefresh } = useDashboardActions();
  const { openCreateModal, openTaskDetail } = useDashboardModal();

  return (
    <div className="space-y-6" data-slot="zone-calendar">
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

      <section aria-label="Lưới lịch tháng">
        <CalendarMonthView
          tasks={filteredTasks}
          initialMonth={typeof selectedAcademicMonth === "number" ? selectedAcademicMonth : 9}
          initialYear={2026}
          onSelectTask={(task) => openTaskDetail(task)}
          onAddTask={() => openCreateModal("TRUONG")}
        />
      </section>
    </div>
  );
}

export const CalendarZone = React.memo(CalendarZoneComponent);
