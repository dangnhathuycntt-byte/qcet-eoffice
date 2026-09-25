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
  return (
    <BottomSheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <BottomSheetContent
        className="max-h-[85dvh] flex flex-col sm:hidden"
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
              className="size-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Đóng bộ lọc"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </BottomSheetClose>
        </BottomSheetHeader>

        <div className="py-4 space-y-4 flex-1 overflow-y-auto px-5 thin-scrollbar">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">
              Đơn vị
            </label>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => onDepartmentChange("ALL")}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md min-h-[44px] flex items-center justify-between transition-colors cursor-pointer",
                  departmentFilter === "ALL"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <span>Tất cả đơn vị</span>
                {departmentFilter === "ALL" && (
                  <Check className="h-4 w-4" strokeWidth={1.5} />
                )}
              </button>
              {availableDepartments.map((dept) => (
                <button
                  key={dept.code}
                  type="button"
                  onClick={() => onDepartmentChange(dept.code)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-md min-h-[44px] flex items-center justify-between transition-colors cursor-pointer",
                    departmentFilter === dept.code
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <span>{dept.name}</span>
                  {departmentFilter === dept.code && (
                    <Check className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <BottomSheetFooter className="pt-3 border-t border-border flex flex-row items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            className="flex-1 min-h-[44px] gap-1.5"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
            Thiết lập lại
          </Button>
          <Button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px]"
          >
            Áp dụng
          </Button>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  );
}
