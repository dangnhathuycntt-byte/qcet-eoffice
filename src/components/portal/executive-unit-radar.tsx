"use client";

import * as React from "react";
import { Bell, Building2, FilterX, AlertCircle, X } from "lucide-react";
import type { ElevenDepartmentRadarItem } from "@/types/workspace";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pressable } from "@/components/ui/pressable";

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
 * and bulk escalation reminder capabilities with confirmation guard.
 */
export function ExecutiveUnitRadar({
  radarItems,
  selectedDepartment,
  onSelectDepartment,
  onRemindAll,
}: ExecutiveUnitRadarProps): React.JSX.Element {
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);

  // Count total units with issues
  const unitsWithIssues = React.useMemo(() => {
    return radarItems.filter((item) => {
      const status = getRadarDotStatus(item);
      return status.color === "RED";
    }).length;
  }, [radarItems]);

  // Handle ESC key for confirmation modal
  React.useEffect(() => {
    if (!showConfirmModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowConfirmModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showConfirmModal]);

  const handleConfirmRemind = () => {
    setShowConfirmModal(false);
    onRemindAll();
  };

  return (
    <>
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
            <h3 className="text-xs font-bold text-foreground truncate">
              TỔNG QUAN 11 ĐƠN VỊ
            </h3>
            {unitsWithIssues > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold rounded-full bg-destructive/15 text-destructive tabular-nums">
                {unitsWithIssues}
              </span>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfirmModal(true)}
            className="h-7 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground border-border hover:bg-muted/80 transition-colors shrink-0"
            title="Gửi thông báo đôn đốc toàn diện tới tất cả các đơn vị có vấn đề"
          >
            <Bell className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
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
            <Pressable
              onClick={() => onSelectDepartment("")}
              className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1 shrink-0 ml-1"
            >
              <FilterX className="w-3 h-3" />
              Xem tất cả
            </Pressable>
          </div>
        )}

        {/* 11 QCET Units List */}
        <div className="flex flex-col gap-1">
          {radarItems.map((item) => {
            const isSelected = selectedDepartment === item.departmentCode;
            const { color, count } = getRadarDotStatus(item);
            const shortName = formatRadarUnitName(item.departmentName);

            return (
              <Pressable
                key={item.departmentCode}
                onClick={() =>
                  onSelectDepartment(isSelected ? "" : item.departmentCode)
                }
                className={cn(
                  "group flex items-center justify-between py-1.5 px-2.5 rounded-lg text-left transition-colors border",
                  isSelected
                    ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/25 border-primary/30"
                    : color === "RED"
                    ? "bg-destructive/10 border-destructive/30 hover:bg-destructive/15 text-foreground"
                    : color === "YELLOW"
                    ? "bg-warning/[0.07] border-warning/25 hover:bg-warning/[0.13] text-foreground"
                    : "border-transparent hover:bg-muted/60 text-foreground"
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
                      isSelected
                        ? "text-primary font-semibold"
                        : color === "RED"
                        ? "font-semibold text-destructive"
                        : "text-foreground"
                    )}
                  >
                    {shortName}
                  </span>
                </div>

                {/* Right: Health Indicator Badge (Clear inline count badge, Zero Emojis) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {color === "RED" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-destructive bg-destructive/20 border border-destructive/35 px-2 py-0.5 rounded-md shadow-2xs tabular-nums">
                      <span className="w-2 h-2 rounded-full bg-destructive shrink-0 animate-pulse" />
                      <span>{count}</span>
                    </span>
                  ) : color === "YELLOW" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning bg-warning/20 border border-warning/30 px-1.5 py-0.5 rounded-md tabular-nums">
                      <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
                      <span>{count > 0 ? count : 1}</span>
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md"
                      title="Vận hành tốt"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-xs font-medium">Tốt</span>
                    </span>
                  )}
                </div>
              </Pressable>
            );
          })}
        </div>
      </div>

      {/* Confirm Dialog for Đôn đốc tất cả */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-remind-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 text-warning">
                <div className="p-2 rounded-lg bg-warning/15">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <h3
                  id="confirm-remind-title"
                  className="text-sm font-bold text-foreground"
                >
                  Xác nhận đôn đốc toàn trường
                </h3>
              </div>
              <Pressable
                onClick={() => setShowConfirmModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </Pressable>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Lệnh điều hành này sẽ gửi thông báo đôn đốc đồng loạt tới các đơn vị
              đang có phát sinh điểm nghẽn hoặc chậm tiến độ. Hoạt động này sẽ
              được lưu vết trong lịch sử chỉ đạo của Ban Giám Hiệu.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmModal(false)}
                className="text-xs h-8"
              >
                Hủy bỏ
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmRemind}
                className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                Xác nhận đôn đốc
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
