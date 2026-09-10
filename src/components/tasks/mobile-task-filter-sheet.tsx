"use client";

import * as React from "react";
import { X, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bộ lọc công việc"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-xs sm:hidden"
    >
      <div className="bg-background rounded-t-xl border-t border-border p-4 max-h-[85vh] flex flex-col shadow-lg overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Bộ lọc công việc</h2>
            {activeFilterCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {activeFilterCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="py-4 space-y-4 flex-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">Đơn vị</label>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => onDepartmentChange("ALL")}
                className={`w-full text-left px-3 py-2 text-sm rounded-md min-h-[44px] flex items-center justify-between ${
                  departmentFilter === "ALL"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <span>Tất cả đơn vị</span>
                {departmentFilter === "ALL" && <Check className="h-4 w-4" strokeWidth={1.5} />}
              </button>
              {availableDepartments.map((dept) => (
                <button
                  key={dept.code}
                  type="button"
                  onClick={() => onDepartmentChange(dept.code)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md min-h-[44px] flex items-center justify-between ${
                    departmentFilter === dept.code
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <span>{dept.name}</span>
                  {departmentFilter === dept.code && <Check className="h-4 w-4" strokeWidth={1.5} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-border flex items-center gap-2">
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
        </div>
      </div>
    </div>
  );
}
