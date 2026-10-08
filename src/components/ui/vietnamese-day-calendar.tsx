"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toIctDateTimeParts } from "@/lib/format/date";

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export interface VietnameseDayCalendarProps {
  /** Ngày đang chọn, dạng `YYYY-MM-DD` hoặc rỗng */
  value?: string | null;
  /** Trả về `YYYY-MM-DD` khi người dùng bấm một ngày */
  onSelect: (isoDate: string) => void;
  className?: string;
}

/**
 * Lịch ngày tiếng Việt dạng nhúng (không có trigger/popover) — cùng cách hiển thị
 * và cùng nguồn ngày (`toIctDateTimeParts`, giờ ICT) với `VietnameseDatePicker`.
 * Dùng khi lịch nằm trong một popover/menu có sẵn.
 */
export function VietnameseDayCalendar({ value, onSelect, className }: VietnameseDayCalendarProps) {
  const selected = React.useMemo(() => (value ? toIctDateTimeParts(value) : null), [value]);
  const today = React.useMemo(() => toIctDateTimeParts(new Date()), []);

  const [view, setView] = React.useState(() => ({
    year: selected?.year ?? today?.year ?? new Date().getFullYear(),
    month: selected?.month ?? today?.month ?? new Date().getMonth() + 1,
  }));

  const shift = (delta: number) =>
    setView((v) => {
      const idx = v.year * 12 + (v.month - 1) + delta;
      return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
    });

  const cells = React.useMemo(() => {
    const first = new Date(view.year, view.month - 1, 1).getDay(); // 0 = CN
    const total = 35 + (first + new Date(view.year, view.month, 0).getDate() > 35 ? 7 : 0);
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(view.year, view.month - 1, 1 - first + i);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      return {
        iso: `${y}-${pad2(m)}-${pad2(day)}`,
        day,
        inMonth: m === view.month,
        isToday: today?.year === y && today?.month === m && today?.day === day,
        isSelected: selected?.year === y && selected?.month === m && selected?.day === day,
      };
    });
  }, [view, today, selected]);

  const iconBtn =
    "p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer";

  return (
    <div className={cn("flex flex-col gap-1.5 select-none", className)} data-slot="vietnamese-day-calendar">
      <div className="flex items-center justify-between px-1 text-xs">
        <span className="font-semibold text-foreground">Tháng {view.month} {view.year}</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Về tháng này"
            onClick={() => today && setView({ year: today.year, month: today.month })}
            className={iconBtn}
          >
            <ArrowRight className="size-3.5 -rotate-45" strokeWidth={1.5} />
          </button>
          <button type="button" aria-label="Tháng trước" onClick={() => shift(-1)} className={iconBtn}>
            <ChevronLeft className="size-3.5" strokeWidth={1.5} />
          </button>
          <button type="button" aria-label="Tháng sau" onClick={() => shift(1)} className={iconBtn}>
            <ChevronRight className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="py-1 text-xs font-medium text-muted-foreground">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {cells.map((cell) => (
          <button
            key={cell.iso}
            type="button"
            onClick={() => onSelect(cell.iso)}
            aria-current={cell.isSelected ? "date" : undefined}
            className={cn(
              "mx-auto flex size-7 items-center justify-center rounded-full text-xs transition-colors cursor-pointer",
              cell.inMonth ? "text-foreground hover:bg-muted" : "text-disabled hover:bg-muted/60",
              cell.isSelected && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
              cell.isToday && !cell.isSelected && "font-semibold text-primary underline"
            )}
          >
            {cell.day}
          </button>
        ))}
      </div>
    </div>
  );
}
