"use client";

import * as React from "react";
import { Filter, X, Check, RotateCcw } from "lucide-react";
import { PopoverRoot, PopoverTrigger, PopoverContent } from "./popover";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";

export interface FilterCriteria {
  documentType?: string;
  department?: string;
  academicSemester?: string;
  urgency?: string;
  status?: string;
}

export interface AdvancedFilterPopoverProps {
  criteria: FilterCriteria;
  onApply: (criteria: FilterCriteria) => void;
  onReset?: () => void;
  departments?: { id: string; name: string }[];
  documentTypes?: { id: string; name: string }[];
  semesters?: { id: string; name: string }[];
  className?: string;
}

const defaultDepartments = [
  { id: "pdt", name: "Phòng Quản lý Đào tạo" },
  { id: "hcth", name: "Phòng Hành chính - Tổng hợp" },
  { id: "ctsv", name: "Phòng Công tác Sinh viên" },
  { id: "cntt", name: "Khoa Công nghệ Thông tin" },
  { id: "ktqt", name: "Khoa Kinh tế & Quản trị" },
];

const defaultDocTypes = [
  { id: "tb", name: "Thông báo" },
  { id: "qd", name: "Quyết định" },
  { id: "tt", name: "Tờ trình" },
  { id: "cv", name: "Công văn" },
  { id: "bc", name: "Báo cáo" },
];

const defaultSemesters = [
  { id: "hk1_2627", name: "Học kỳ I (2026 - 2027)" },
  { id: "hk2_2627", name: "Học kỳ II (2026 - 2027)" },
  { id: "hk1_2526", name: "Học kỳ I (2025 - 2026)" },
];

/**
 * Bộ lọc nâng cao đa tiêu chí dạng Popover cho bảng văn bản / nhiệm vụ.
 */
export function AdvancedFilterPopover({
  criteria,
  onApply,
  onReset,
  departments = defaultDepartments,
  documentTypes = defaultDocTypes,
  semesters = defaultSemesters,
  className,
}: AdvancedFilterPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<FilterCriteria>(criteria);

  // Sync draft when criteria changes
  React.useEffect(() => {
    setDraft(criteria);
  }, [criteria]);

  const activeFilterCount = Object.values(criteria).filter(Boolean).length;

  const handleApply = () => {
    onApply(draft);
    setOpen(false);
  };

  const handleReset = () => {
    const empty: FilterCriteria = {};
    setDraft(empty);
    onReset?.();
    onApply(empty);
    setOpen(false);
  };

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          `inline-flex items-center gap-1.5 rounded-xl border-0 px-3 py-1.5 text-xs font-medium transition-colors duration-100 outline-none ${focusRingClass} cursor-pointer`,
          activeFilterCount > 0
            ? "bg-selected text-foreground font-semibold"
            : "bg-secondary text-foreground hover:bg-accent"
        )}
      >
        <Filter className="size-3.5" />
        <span>Bộ lọc nâng cao</span>
        {activeFilterCount > 0 ? (
          <span className="flex size-4 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {activeFilterCount}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className={cn("w-80 p-4 shadow-menu border-0 rounded-2xl bg-popover text-popover-foreground", className)}
      >
        <div className="flex items-center justify-between border-0 pb-2 mb-3">
          <h4 className="text-xs font-semibold text-foreground">Bộ lọc tìm kiếm</h4>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3" />
              <span>Xóa bộ lọc</span>
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 text-xs">
          {/* Đơn vị chủ trì */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Đơn vị ban hành</label>
            <select
              value={draft.department ?? ""}
              onChange={(e) => setDraft({ ...draft, department: e.target.value || undefined })}
              className="mt-1 w-full rounded-xl border-0 bg-secondary px-3 py-2 text-xs text-foreground outline-none focus:bg-selected focus:outline-2 focus:outline-primary"
            >
              <option value="">Tất cả đơn vị</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Loại văn bản */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Loại văn bản</label>
            <select
              value={draft.documentType ?? ""}
              onChange={(e) => setDraft({ ...draft, documentType: e.target.value || undefined })}
              className="mt-1 w-full rounded-xl border-0 bg-secondary px-3 py-2 text-xs text-foreground outline-none focus:bg-selected focus:outline-2 focus:outline-primary"
            >
              <option value="">Tất cả loại văn bản</option>
              {documentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Học kỳ / Năm học */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Học kỳ / Năm học</label>
            <select
              value={draft.academicSemester ?? ""}
              onChange={(e) => setDraft({ ...draft, academicSemester: e.target.value || undefined })}
              className="mt-1 w-full rounded-xl border-0 bg-secondary px-3 py-2 text-xs text-foreground outline-none focus:bg-selected focus:outline-2 focus:outline-primary"
            >
              <option value="">Mọi học kỳ</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mức độ khẩn */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Mức độ khẩn</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {[
                { id: "all", label: "Tất cả" },
                { id: "urgent", label: "Khẩn" },
                { id: "express", label: "Hỏa tốc" },
              ].map((opt) => {
                const isSelected = (!draft.urgency && opt.id === "all") || draft.urgency === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        urgency: opt.id === "all" ? undefined : opt.id,
                      })
                    }
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors border-0",
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 flex items-center justify-end gap-2 border-0 pt-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
          >
            <Check className="size-3" />
            <span>Áp dụng</span>
          </button>
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}
