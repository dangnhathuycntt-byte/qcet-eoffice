"use client";

import * as React from "react";
import { X, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetClose,
} from "@/components/ui/bottom-sheet";
import { CORE_STATUS_OPTIONS } from "@/domain/tasks/display-config";
import { cn } from "@/lib/utils";

export interface MobileTaskFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  departmentFilter: string;
  onDepartmentChange: (department: string) => void;
  monthFilter: string | number;
  onMonthChange: (month: string | number) => void;
  availableDepartments: { code: string; name: string }[];
  onReset: () => void;
  activeFilterCount: number;
}

const MONTH_OPTIONS = [
  { value: "ALL", label: "Tất cả các tháng" },
  { value: "9", label: "Tháng 9" },
  { value: "10", label: "Tháng 10" },
  { value: "11", label: "Tháng 11" },
  { value: "12", label: "Tháng 12" },
  { value: "1", label: "Tháng 1" },
  { value: "2", label: "Tháng 2" },
  { value: "3", label: "Tháng 3" },
  { value: "4", label: "Tháng 4" },
  { value: "5", label: "Tháng 5" },
];

export function MobileTaskFilterSheet({
  isOpen,
  onClose,
  statusFilter,
  onStatusChange,
  departmentFilter,
  onDepartmentChange,
  monthFilter,
  onMonthChange,
  availableDepartments,
  onReset,
  activeFilterCount,
}: MobileTaskFilterSheetProps) {
  const [snapPoint, setSnapPoint] = React.useState<number | string | null>(0.45);

  return (
    <BottomSheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      snapPoints={[0.45, 0.9]}
      activeSnapPoint={snapPoint}
      setActiveSnapPoint={setSnapPoint}
    >
      <BottomSheetContent
        className="h-[90dvh] max-h-[90dvh] flex flex-col sm:hidden"
        aria-label="Bộ lọc công việc"
      >
        <BottomSheetHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <BottomSheetTitle className="text-base font-semibold text-foreground">
              Bộ lọc công việc
            </BottomSheetTitle>
            {activeFilterCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {activeFilterCount}
              </span>
            )}
            <BottomSheetDescription className="sr-only">
              Chọn các tiêu chí để lọc danh sách công việc
            </BottomSheetDescription>
          </div>
          <BottomSheetClose asChild>
            <button
              type="button"
              className="min-h-[44px] min-w-[44px] size-11 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-[0.98] touch-manipulation cursor-pointer"
              aria-label="Đóng bộ lọc"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </BottomSheetClose>
        </BottomSheetHeader>

        <div className="py-4 space-y-6 flex-1 overflow-y-auto px-5 thin-scrollbar">
          {/* Nhóm 1: Trạng thái */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground block">
              Trạng thái
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onStatusChange("ALL")}
                className={cn(
                  "min-h-[44px] px-3 py-2 text-xs rounded-xl border flex items-center justify-between font-medium transition-all touch-manipulation cursor-pointer active:scale-[0.98]",
                  statusFilter === "ALL"
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                    : "border-border/70 bg-background text-muted-foreground hover:bg-muted/50"
                )}
              >
                <span>Tất cả trạng thái</span>
                {statusFilter === "ALL" && (
                  <Check className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                )}
              </button>
              {CORE_STATUS_OPTIONS.map((status) => (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => onStatusChange(status.value)}
                  className={cn(
                    "min-h-[44px] px-3 py-2 text-xs rounded-xl border flex items-center justify-between font-medium transition-all touch-manipulation cursor-pointer active:scale-[0.98]",
                    statusFilter === status.value
                      ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                      : "border-border/70 bg-background text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <span className="truncate">{status.label}</span>
                  {statusFilter === status.value && (
                    <Check className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Nhóm 2: Tháng học thuật */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground block">
              Thời gian (Tháng)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {MONTH_OPTIONS.map((month) => {
                const isSelected = String(monthFilter) === String(month.value);
                return (
                  <button
                    key={month.value}
                    type="button"
                    onClick={() => onMonthChange(month.value)}
                    className={cn(
                      "min-h-[44px] px-3 py-2 text-xs rounded-xl border flex items-center justify-between font-medium transition-all touch-manipulation cursor-pointer active:scale-[0.98]",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                        : "border-border/70 bg-background text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <span>{month.label}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nhóm 3: Đơn vị */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground block">
              Đơn vị thực hiện
            </label>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => onDepartmentChange("ALL")}
                className={cn(
                  "w-full text-left px-3.5 py-2 text-sm rounded-xl min-h-[44px] flex items-center justify-between border transition-all touch-manipulation cursor-pointer active:scale-[0.98]",
                  departmentFilter === "ALL"
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                    : "border-border/70 bg-background text-muted-foreground hover:bg-muted/50"
                )}
              >
                <span>Tất cả đơn vị</span>
                {departmentFilter === "ALL" && (
                  <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
                )}
              </button>
              {availableDepartments.map((dept) => {
                const isSelected = departmentFilter === dept.code;
                return (
                  <button
                    key={dept.code}
                    type="button"
                    onClick={() => onDepartmentChange(dept.code)}
                    className={cn(
                      "w-full text-left px-3.5 py-2 text-sm rounded-xl min-h-[44px] flex items-center justify-between border transition-all touch-manipulation cursor-pointer active:scale-[0.98]",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                        : "border-border/70 bg-background text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <span className="truncate">{dept.name}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <BottomSheetFooter className="flex flex-row items-center gap-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            className="flex-1 min-h-[44px] gap-1.5 active:scale-[0.98] touch-manipulation cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
            Thiết lập lại
          </Button>
          <BottomSheetClose asChild>
            <Button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] active:scale-[0.98] touch-manipulation cursor-pointer"
            >
              Áp dụng
            </Button>
          </BottomSheetClose>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  );
}
