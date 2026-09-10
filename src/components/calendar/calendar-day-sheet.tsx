"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  X,
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Building2,
  Briefcase,
  User,
  Layers,
  MapPin,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskCategory, TaskStatus } from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCategoryBadgeConfig, getStatusBadgeConfig } from "@/components/tasks/cascading-task-table";

export interface DayTaskItem {
  id: string;
  title: string;
  level: "Trường" | "Đơn vị";
  category?: TaskCategory;
  categoryLabel?: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  dueDate: string;
  status: TaskStatus | string;
  progressPercent?: number;
  parentSchoolTaskId?: string;
  parentSchoolTaskTitle?: string;
  originalTask?: SchoolTask | StaffTask;
  isEvent?: boolean;
  time?: string;
  location?: string;
  host?: string;
  participants?: string;
}

export interface CalendarDaySheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string | null; // "YYYY-MM-DD"
  tasks: DayTaskItem[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onAddTaskOnDate?: (dateStr: string) => void;
  className?: string;
}

function formatDateVi(dateStr: string): string {
  try {
    const clean = dateStr.split("T")[0];
    const [year, month, day] = clean.split("-");
    const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
    const dayNames = [
      "Chủ Nhật",
      "Thứ Hai",
      "Thứ Ba",
      "Thứ Tư",
      "Thứ Năm",
      "Thứ Sáu",
      "Thứ Bảy",
    ];
    const dayName = dayNames[dateObj.getDay()] || "Ngày";
    return `${dayName}, ngày ${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

export function CalendarDaySheet({
  isOpen,
  onClose,
  selectedDate,
  tasks = [],
  onSelectTask,
  onAddTaskOnDate,
  className,
}: CalendarDaySheetProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Handle ESC key to dismiss
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) {
    return null;
  }

  const isDateSelected = Boolean(selectedDate);
  const formattedDate = selectedDate ? formatDateVi(selectedDate) : "Chưa chọn ngày";
  const hasTasks = tasks.length > 0;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-day-sheet-title"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop overlay */}
      <div
        data-slot="calendar-day-sheet-backdrop"
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Side Sheet Panel */}
      <aside
        data-slot="calendar-day-sheet-panel"
        className={cn(
          "fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto z-50 flex h-full flex-col bg-card border-l border-border/70 shadow-2xl transition-all duration-300 animate-in slide-in-from-right",
          "w-full sm:w-[460px] md:w-[500px]",
          className
        )}
      >
        {/* Sticky Sheet Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 px-4 sm:px-5 py-3.5 bg-card/95 backdrop-blur-md gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile Back Button (<640px) */}
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer active:scale-95 shrink-0"
              aria-label="Đóng chi tiết ngày"
            >
              <ArrowLeft className="size-5" strokeWidth={1.5} />
            </button>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                <CalendarIcon className="size-3.5 shrink-0" strokeWidth={1.5} />
                <span>Chi tiết lịch công tác</span>
              </div>
              <h2
                id="calendar-day-sheet-title"
                className="text-sm sm:text-base font-bold text-foreground truncate font-heading tracking-tight"
              >
                {formattedDate}
              </h2>
            </div>
          </div>

          {/* Desktop Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="hidden sm:inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
            aria-label="Đóng chi tiết ngày"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Sub-header Contextual Action & Task Count Summary */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-muted/20 border-b border-border/50 gap-2">
          <span className="text-xs text-muted-foreground">
            {hasTasks ? (
              <>
                Tổng cộng:{" "}
                <strong className="text-foreground font-semibold font-mono tabular-nums">
                  {tasks.length}
                </strong>{" "}
                nhiệm vụ / sự kiện
              </>
            ) : (
              "Không có lịch công tác"
            )}
          </span>

          {/* Contextual Action Button (NOT a competing primary CTA) */}
          {selectedDate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddTaskOnDate?.(selectedDate)}
              className="h-8 min-h-[32px] sm:min-h-0 text-xs font-medium gap-1.5 border-dashed border-border hover:border-primary/50 text-foreground hover:bg-secondary/80 cursor-pointer rounded-lg px-2.5"
            >
              <Plus className="size-3.5" strokeWidth={1.5} />
              <span>+ Thêm việc ngày này</span>
            </Button>
          )}
        </div>

        {/* Sheet Body: Task List or Polite Empty State */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {!isDateSelected || !hasTasks ? (
            /* Requirement 4: Polite, clean empty state without wasted vertical space */
            <div className="flex flex-col items-center justify-center text-center py-8 sm:py-10 px-4 rounded-2xl border border-dashed border-border/70 bg-muted/10 space-y-3 my-2">
              <div className="size-11 rounded-xl bg-secondary/80 flex items-center justify-center border border-border/60 text-muted-foreground/60">
                <CalendarIcon className="size-5" strokeWidth={1.5} />
              </div>
              <div className="space-y-1 max-w-xs">
                <h3 className="text-sm font-bold text-foreground">
                  {isDateSelected ? "Không có nhiệm vụ trong ngày" : "Chưa chọn ngày công tác"}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isDateSelected
                    ? "Không có sự kiện, hạn chót hoặc nhiệm vụ nào cần thực hiện vào ngày này. Bạn có thể bấm thêm việc mới."
                    : "Vui lòng chọn một ngày trên lưới tháng hoặc danh sách nghị sự để xem chi tiết các nhiệm vụ."}
                </p>
              </div>
              {selectedDate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAddTaskOnDate?.(selectedDate)}
                  className="min-h-[44px] sm:min-h-0 h-9 px-4 text-xs font-semibold gap-1.5 rounded-xl border-dashed border-border/80 hover:border-primary/50 text-foreground hover:bg-secondary cursor-pointer"
                >
                  <Plus className="size-4" strokeWidth={1.5} />
                  <span>+ Thêm việc ngày này</span>
                </Button>
              )}
            </div>
          ) : (
            /* Tasks / Events List for Selected Day */
            <div className="space-y-2.5">
              {tasks.map((item) => {
                const isSchool = item.level === "Trường";
                const catConfig = getCategoryBadgeConfig(item.category || "KHAC");
                const statusConfig = getStatusBadgeConfig(item.status as TaskStatus);
                const isCompleted = item.status === "COMPLETED";

                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (item.originalTask) {
                        onSelectTask?.(item.originalTask);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (item.originalTask) {
                          onSelectTask?.(item.originalTask);
                        }
                      }
                    }}
                    className={cn(
                      "group flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3.5 transition-all",
                      "hover:border-primary/40 hover:shadow-card cursor-pointer focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.99]",
                      isCompleted && "opacity-75 bg-muted/20"
                    )}
                    aria-label={`Xem chi tiết ${item.title}`}
                  >
                    {/* Row 1: Badges (Level, Category, Status) */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border",
                            isSchool
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-indigo-50 text-indigo-700 border-indigo-200"
                          )}
                        >
                          {isSchool ? "Cấp Trường" : "Đơn vị"}
                        </span>

                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs px-1.5 py-0 h-4.5 font-medium rounded-md",
                            catConfig.className
                          )}
                        >
                          {catConfig.label}
                        </Badge>
                      </div>

                      <Badge
                        variant={statusConfig.variant}
                        className={cn(
                          "text-xs px-1.5 py-0 h-4.5 font-semibold rounded-md",
                          statusConfig.className
                        )}
                      >
                        {statusConfig.label}
                      </Badge>
                    </div>

                    {/* Row 2: Title */}
                    <h4
                      className={cn(
                        "text-xs sm:text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors",
                        isCompleted && "line-through text-muted-foreground"
                      )}
                    >
                      {item.title}
                    </h4>

                    {/* Parent School Task Title (if Subtask) */}
                    {!isSchool && item.parentSchoolTaskTitle && (
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Layers className="size-3 text-muted-foreground/70 shrink-0" strokeWidth={1.5} />
                        <span className="truncate">Thuộc: {item.parentSchoolTaskTitle}</span>
                      </div>
                    )}

                    {/* Row 3: Metadata (Assignee, Time, Location) */}
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-1 border-t border-border/40 flex-wrap">
                      {item.assigneeName ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <User className="size-3 text-muted-foreground/80 shrink-0" strokeWidth={1.5} />
                          <span className="truncate">{item.assigneeName}</span>
                        </div>
                      ) : (
                        <div />
                      )}

                      <div className="flex items-center gap-2 font-mono tabular-nums shrink-0">
                        {item.time && (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <Clock className="size-3" strokeWidth={1.5} />
                            <span>{item.time}</span>
                          </span>
                        )}
                        {item.location && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <MapPin className="size-3 text-muted-foreground/70" strokeWidth={1.5} />
                            <span className="truncate max-w-[120px]">{item.location}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sheet Footer */}
        <div className="border-t border-border/60 px-4 sm:px-5 py-3 bg-card/90 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs min-h-[36px] rounded-lg cursor-pointer px-4"
          >
            Đóng
          </Button>

          {selectedDate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddTaskOnDate?.(selectedDate)}
              className="text-xs min-h-[36px] rounded-lg cursor-pointer px-3.5 border-dashed"
            >
              <Plus className="size-3.5 mr-1" strokeWidth={1.5} />
              <span>Thêm việc</span>
            </Button>
          )}
        </div>
      </aside>
    </div>
  );

  return createPortal(content, document.body);
}
