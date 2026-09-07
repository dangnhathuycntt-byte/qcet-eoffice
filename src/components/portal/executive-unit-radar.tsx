"use client";

import * as React from "react";
import { Zap, Building2, FilterX } from "lucide-react";
import type { ElevenDepartmentRadarItem } from "@/types/workspace";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ExecutiveUnitRadarProps {
  radarItems: ElevenDepartmentRadarItem[];
  selectedDepartment: string;
  onSelectDepartment: (deptId: string) => void;
  onRemindAll: () => void;
}

/**
 * Maps unit names to canonical short abbreviations suitable for compact radar display.
 */
export function formatRadarUnitName(name: string): string {
  if (!name) return "";
  const mapping: Record<string, string> = {
    "Khoa Công nghệ thông tin": "Khoa CNTT",
    "Khoa Cơ khí - Động lực": "Khoa Cơ khí",
    "Khoa Điện - Điện tử": "Khoa Điện",
    "Khoa Kỹ thuật - Du lịch": "Khoa KT-DL",
    "Khoa Khoa học cơ bản": "Khoa KHCB",
    "Phòng Đào tạo & QLKH": "Phòng Đào tạo",
    "Phòng Hành chính - Quản trị": "Phòng HC-QT",
    "Phòng Quản trị Thiết bị": "Phòng QTTB",
    "TT Truyền thông & Số hóa": "TT Truyền thông",
    "TT Đào tạo theo Nhu cầu XH": "TT ĐT-NCXH",
    "Ban Giám hiệu": "Ban Giám hiệu",
  };
  return (
    mapping[name] ||
    name
      .replace("Công nghệ thông tin", "CNTT")
      .replace("Hành chính - Quản trị", "HC-QT")
  );
}

/**
 * Calculates dot status color and issue count for a unit radar item.
 */
export function getRadarDotStatus(item: {
  blockedTasks?: number;
  delayedTasks?: number;
  healthStatus?: "GREEN" | "YELLOW" | "RED" | string;
}): { color: "RED" | "YELLOW" | "GREEN"; count: number } {
  const blocked = item.blockedTasks || 0;
  const delayed = item.delayedTasks || 0;
  const totalIssue = blocked + delayed;

  if (totalIssue > 0 || item.healthStatus === "RED") {
    return { color: "RED", count: totalIssue > 0 ? totalIssue : 1 };
  }
  if (item.healthStatus === "YELLOW") {
    return { color: "YELLOW", count: totalIssue };
  }
  return { color: "GREEN", count: 0 };
}

/**
 * ExecutiveUnitRadar - 11-Unit Mini-Radar Panel.
 *
 * Provides real-time health indicator per department with instant single-click filtering
 * and bulk escalation reminder capabilities. Conforms to Zero-Decorative-Emoji standard.
 */
export function ExecutiveUnitRadar({
  radarItems,
  selectedDepartment,
  onSelectDepartment,
  onRemindAll,
}: ExecutiveUnitRadarProps): React.JSX.Element {
  // Count total units with issues
  const unitsWithIssues = React.useMemo(() => {
    return radarItems.filter((item) => {
      const status = getRadarDotStatus(item);
      return status.color === "RED";
    }).length;
  }, [radarItems]);

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs",
        "flex flex-col gap-3"
      )}
      data-testid="executive-unit-radar"
    >
      {/* Header: Title and Bulk Action */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
        <div className="flex items-center gap-1.5 min-w-0">
          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground truncate">
            TỔNG QUAN 11 ĐƠN VỊ
          </h3>
          {unitsWithIssues > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 tabular-nums">
              {unitsWithIssues}
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRemindAll}
          className="h-7 px-2 text-xs font-semibold text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 hover:text-amber-800 transition-colors shrink-0"
          title="Gửi thông báo đôn đốc toàn diện tới tất cả 11 đơn vị"
        >
          <Zap className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" />
          Đôn đốc tất cả
        </Button>
      </div>

      {/* Filter Reset if filtering is active */}
      {selectedDepartment && (
        <div className="flex items-center justify-between px-2 py-1 rounded-md bg-muted/60 text-xs">
          <span className="text-muted-foreground truncate">
            Đang lọc:{" "}
            <strong className="text-foreground">
              {formatRadarUnitName(
                radarItems.find((d) => d.departmentCode === selectedDepartment)
                  ?.departmentName || selectedDepartment
              )}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => onSelectDepartment("")}
            className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1 shrink-0 ml-1 cursor-pointer"
          >
            <FilterX className="w-3 h-3" />
            Xem tất cả
          </button>
        </div>
      )}

      {/* 11 QCET Units List */}
      <div className="flex flex-col gap-1">
        {radarItems.map((item) => {
          const isSelected = selectedDepartment === item.departmentCode;
          const { color, count } = getRadarDotStatus(item);
          const shortName = formatRadarUnitName(item.departmentName);

          return (
            <button
              key={item.departmentCode}
              type="button"
              onClick={() =>
                onSelectDepartment(isSelected ? "" : item.departmentCode)
              }
              className={cn(
                "group flex items-center justify-between py-1.5 px-2.5 rounded-lg text-left transition-colors cursor-pointer",
                isSelected
                  ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/25"
                  : "hover:bg-muted/60 text-foreground"
              )}
              title={`${item.departmentName} - Nhấp để ${
                isSelected ? "bỏ lọc" : "lọc danh sách điểm nghẽn"
              }`}
            >
              {/* Left: Unit short name */}
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "text-xs truncate transition-colors",
                    isSelected ? "text-primary font-semibold" : "text-foreground"
                  )}
                >
                  {shortName}
                </span>
              </div>

              {/* Right: Health Indicator Badge (Geometric Dot Badges, Zero Emojis) */}
              <div className="flex items-center gap-1.5 shrink-0">
                {color === "RED" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                    <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0 animate-pulse" />
                    <span className="tabular-nums">{count}</span>
                  </span>
                ) : color === "YELLOW" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    {count > 0 && <span className="tabular-nums">{count}</span>}
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center p-1 text-xs" title="Đúng tiến độ">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
