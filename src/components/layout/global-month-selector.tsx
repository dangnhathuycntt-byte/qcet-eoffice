"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, ChevronDown, Check, Sparkles, Layers } from "lucide-react";
import {
  ACADEMIC_MONTH_ORDER,
  getAcademicMonthPeriod,
  getAcademicMonthInfo,
  getAcademicYear,
  type AcademicMonthPeriod,
} from "@/lib/academic-calendar";
import {
  useDashboardData,
  useOptionalDashboardData,
  useOptionalDashboardActions,
} from "@/components/dashboard/dashboard-context";
import { cn } from "@/lib/utils";

export interface SemesterGroup {
  id: string;
  name: string;
  shortName: string;
  months: number[];
}

export const SEMESTER_GROUPS: SemesterGroup[] = [
  {
    id: "hk1",
    name: "Học kỳ I",
    shortName: "HK I",
    months: [9, 10, 11, 12],
  },
  {
    id: "hk2",
    name: "Học kỳ II",
    shortName: "HK II",
    months: [1, 2, 3, 4, 5],
  },
  {
    id: "summer",
    name: "Học kỳ Hè",
    shortName: "HK Hè",
    months: [6, 7, 8],
  },
];

/**
 * Accessible Popover container for GlobalMonthSelector.
 */
interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Popover({ open, onOpenChange, children }: PopoverProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={containerRef} className="relative inline-block text-left" data-slot="popover">
      {children}
    </div>
  );
}

interface GlobalMonthSelectorProps {
  className?: string;
}

export function GlobalMonthSelector({ className }: GlobalMonthSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Safely consume dashboard context if mounted within DashboardStateProvider
  const optionalData = useOptionalDashboardData();
  const optionalActions = useOptionalDashboardActions();

  const [isOpen, setIsOpen] = React.useState(false);

  // Compute current actual operational month and academic year
  const now = React.useMemo(() => new Date(), []);
  const currentActualPeriod = React.useMemo(() => getAcademicMonthInfo(now), [now]);
  const currentActualMonth = currentActualPeriod.monthNumber;
  const currentAcademicYear = React.useMemo(() => getAcademicYear(now), [now]);

  // Determine active month: prioritize dashboard context if available, otherwise searchParams, fallback to current actual month
  const monthParam = searchParams?.get("month");
  const selectedMonth: number | "ALL" = React.useMemo(() => {
    if (optionalData?.selectedAcademicMonth !== undefined) {
      return optionalData.selectedAcademicMonth;
    }
    if (monthParam === "ALL") return "ALL";
    if (monthParam) {
      const parsed = parseInt(monthParam, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
        return parsed;
      }
    }
    return currentActualMonth;
  }, [optionalData?.selectedAcademicMonth, monthParam, currentActualMonth]);

  // Active period details
  const activePeriod: AcademicMonthPeriod | null = React.useMemo(() => {
    if (selectedMonth === "ALL") return null;
    return getAcademicMonthPeriod(selectedMonth, currentAcademicYear);
  }, [selectedMonth, currentAcademicYear]);

  // Task counts per month map
  const monthlyTaskCounts = optionalData?.monthlyTaskCounts || {};

  // Formulate trigger labels
  const triggerDesktopLabel = React.useMemo(() => {
    if (selectedMonth === "ALL") {
      return `Cả năm ${currentAcademicYear}`;
    }
    if (activePeriod) {
      return `${activePeriod.label} (${activePeriod.shortDateSpan})`;
    }
    return `Tháng ${selectedMonth}`;
  }, [selectedMonth, activePeriod, currentAcademicYear]);

  const triggerMobileLabel = React.useMemo(() => {
    if (selectedMonth === "ALL") {
      return "Cả năm";
    }
    return `T${selectedMonth}`;
  }, [selectedMonth]);

  // Handle month selection
  const handleSelectMonth = React.useCallback(
    (month: number | "ALL") => {
      // 1. Update state through dashboard actions if available
      if (optionalActions?.handleAcademicMonthChange) {
        optionalActions.handleAcademicMonthChange(month);
      }

      // 2. Sync URL query parameter
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (month === "ALL") {
        params.set("month", "ALL");
      } else {
        params.set("month", String(month));
      }

      const queryString = params.toString();
      const targetUrl = pathname === "/"
        ? `/?${queryString}`
        : `${pathname}?${queryString}`;

      router.push(targetUrl, { scroll: false });
      setIsOpen(false);
    },
    [optionalActions, searchParams, pathname, router]
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Chọn tháng học thuật"
        className={cn(
          "group inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/40 hover:bg-secondary/80 px-2.5 text-xs font-medium text-foreground transition-all cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.98]",
          className
        )}
      >
        <Calendar size={13} strokeWidth={1.5} className="text-primary shrink-0" />
        <span className="truncate max-w-[120px] sm:max-w-[200px] md:max-w-[240px]">
          <span className="hidden sm:inline">{triggerDesktopLabel}</span>
          <span className="sm:hidden">{triggerMobileLabel}</span>
        </span>
        <ChevronDown
          size={12}
          strokeWidth={1.5}
          className={cn(
            "text-muted-foreground transition-transform duration-150 group-hover:text-foreground shrink-0 ml-0.5",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Popover Content */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chọn tháng học thuật và học kỳ"
          className="absolute left-0 sm:left-auto sm:right-0 md:left-0 md:right-auto top-full mt-1.5 w-[330px] sm:w-[390px] max-w-[calc(100vw-24px)] rounded-xl border border-border/70 bg-card p-3 text-popover-foreground shadow-xl backdrop-blur-md z-50 animate-in fade-in-0 zoom-in-95 focus:outline-none"
        >
          {/* Header & Year Info */}
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div>
              <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                NĂM HỌC {currentAcademicYear}
              </span>
              <p className="text-xs text-muted-foreground">
                Chu kỳ nghiệp vụ: ngày 25 đến 24 hàng tháng
              </p>
            </div>
            {selectedMonth !== "ALL" && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                Tháng {selectedMonth}
              </span>
            )}
          </div>

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-2 gap-1.5 py-2.5 border-b border-border/50">
            <button
              type="button"
              onClick={() => handleSelectMonth(currentActualMonth)}
              className={cn(
                "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer border",
                selectedMonth === currentActualMonth
                  ? "bg-primary/10 text-primary border-primary/30 font-semibold shadow-2xs"
                  : "bg-muted/40 hover:bg-muted/80 text-foreground border-border/40"
              )}
            >
              <div className="flex items-center gap-1.5 truncate">
                <Sparkles size={12} className="text-primary shrink-0" />
                <span className="truncate">Tháng hiện tại: T{currentActualMonth}</span>
              </div>
              {selectedMonth === currentActualMonth && (
                <Check size={12} className="text-primary shrink-0 ml-1" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectMonth("ALL")}
              className={cn(
                "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer border",
                selectedMonth === "ALL"
                  ? "bg-primary/10 text-primary border-primary/30 font-semibold shadow-2xs"
                  : "bg-muted/40 hover:bg-muted/80 text-foreground border-border/40"
              )}
            >
              <div className="flex items-center gap-1.5 truncate">
                <Layers size={12} className="text-primary shrink-0" />
                <span className="truncate">Xem cả năm</span>
              </div>
              {selectedMonth === "ALL" && (
                <Check size={12} className="text-primary shrink-0 ml-1" />
              )}
            </button>
          </div>

          {/* Semesters & Month Groups */}
          <div className="pt-2 space-y-3 max-h-[60vh] overflow-y-auto pr-0.5">
            {SEMESTER_GROUPS.map((semester) => (
              <div key={semester.id} className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-foreground/80">
                    {semester.name}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {semester.months.length} tháng
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {semester.months.map((m) => {
                    const period = getAcademicMonthPeriod(m, currentAcademicYear);
                    const isSelected = selectedMonth === m;
                    const isActualCurrent = currentActualMonth === m;
                    const count = monthlyTaskCounts[m];

                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleSelectMonth(m)}
                        className={cn(
                          "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer border min-h-[42px]",
                          isSelected
                            ? "bg-primary/10 text-primary border-primary/40 font-semibold shadow-2xs ring-1 ring-primary/20"
                            : "bg-muted/30 hover:bg-muted/70 text-foreground border-border/40"
                        )}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium leading-tight truncate">
                              {period.label}
                            </span>
                            {isActualCurrent && (
                              <span
                                title="Tháng hiện tại trên lịch thực tế"
                                className="size-1.5 rounded-full bg-emerald-500 shrink-0"
                              />
                            )}
                          </div>
                          <span className="block text-xs text-muted-foreground font-mono leading-tight mt-0.5">
                            {period.shortDateSpan}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {typeof count === "number" && count > 0 && (
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded-full text-xs font-semibold font-mono",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {count}
                            </span>
                          )}
                          {isSelected && (
                            <Check size={13} className="text-primary shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}
