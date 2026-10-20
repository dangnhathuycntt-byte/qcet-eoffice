"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { MENU_ROW_CLASS } from "@/components/ui/menu";

/** Mốc giờ trong danh sách: 15 phút một mốc như lịch Google (họp thường bắt đầu ở :00, :15, :30, :45). */
const SLOT_MINUTES = 15;
const DAY_MINUTES = 24 * 60;

export const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export const fromMinutes = (minutes: number) => {
  const clamped = Math.min(Math.max(minutes, 0), DAY_MINUTES - 1);
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
};

/** "1 giờ 30 phút"; giờ kết thúc không sau giờ bắt đầu thì null. */
export function durationText(start: string, end: string): string | null {
  if (!start || !end) return null;
  const minutes = toMinutes(end) - toMinutes(start);
  if (minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} giờ` : "", m ? `${m} phút` : ""].filter(Boolean).join(" ");
}

/** Hàng mốc giờ: rê chuột nền nhạt, đang chọn nền accent + chữ đậm như hàng chọn giá trị của menu. */
const SLOT_ROW_CLASS = cn(MENU_ROW_CLASS, "justify-between tabular-nums hover:bg-muted data-[selected]:bg-accent data-[selected]:font-medium");

function SlotList({
  slots,
  value,
  onPick,
  label,
  hint,
}: {
  slots: number[];
  value: string;
  onPick: (time: string) => void;
  label: string;
  hint?: (minutes: number) => string | null;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const selected = value ? toMinutes(value) : null;

  // Mở ra thì mốc đang chọn (hoặc mốc gần nhất) nằm giữa danh sách; chỉ cuộn danh sách, không cuộn cả hộp
  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || selected === null) return;
    const nearest = slots.reduce((best, slot) => (Math.abs(slot - selected) < Math.abs(best - selected) ? slot : best), slots[0] ?? 0);
    const row = list.querySelector<HTMLElement>(`[data-minutes="${nearest}"]`);
    if (row) list.scrollTop = row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2;
    // Chỉ khi mở danh sách và khi tập mốc đổi (giờ bắt đầu đổi thì danh sách kết thúc đổi)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  return (
    <div ref={listRef} role="listbox" aria-label={label} className="relative max-h-44 overflow-y-auto overscroll-contain">
      {slots.map((minutes) => {
        const time = fromMinutes(minutes);
        const isSelected = selected === minutes;
        const extra = hint?.(minutes);
        return (
          <Pressable
            key={minutes}
            role="option"
            aria-selected={isSelected}
            data-selected={isSelected ? "" : undefined}
            data-minutes={minutes}
            className={SLOT_ROW_CLASS}
            onClick={() => onPick(time)}
          >
            <span>{time}</span>
            {extra ? <span className="truncate font-normal text-muted-foreground">{extra}</span> : null}
          </Pressable>
        );
      })}
    </div>
  );
}

/**
 * Chọn giờ bắt đầu và kết thúc trong popover chip "Giờ" của hộp tạo cuộc họp: ô gõ giờ chính xác (ẩn bảng chọn giờ của
 * trình duyệt, người dùng chê bảng từng phút viền đen 20/10/2026) và hai danh sách mốc 15 phút theo kiểu menu của app.
 * Danh sách kết thúc chỉ có mốc sau giờ bắt đầu, kèm thời lượng như lịch Google.
 */
export function TimeRangeFields({
  start,
  end,
  onStartChange,
  onEndChange,
  endRef,
  endInvalid,
  endDescribedBy,
}: {
  start: string;
  end: string;
  onStartChange: (time: string) => void;
  onEndChange: (time: string) => void;
  endRef?: React.Ref<HTMLInputElement>;
  endInvalid?: boolean;
  endDescribedBy?: string;
}) {
  const startSlots = React.useMemo(() => Array.from({ length: DAY_MINUTES / SLOT_MINUTES }, (_, i) => i * SLOT_MINUTES), []);
  const startMinutes = start ? toMinutes(start) : 0;
  const endSlots = React.useMemo(() => startSlots.filter((m) => m > startMinutes), [startSlots, startMinutes]);
  // Ẩn nút mở bảng chọn giờ của Chrome; vẫn gõ được từng phần giờ/phút và dùng phím mũi tên
  const inputClass = "tabular-nums [&::-webkit-calendar-picker-indicator]:hidden";

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex min-w-0 flex-col gap-1">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Bắt đầu
          <Input type="time" compact value={start} className={inputClass} onChange={(event) => onStartChange(event.target.value)} />
        </label>
        <SlotList slots={startSlots} value={start} onPick={onStartChange} label="Giờ bắt đầu" />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Kết thúc
          <Input
            ref={endRef}
            type="time"
            compact
            value={end}
            className={inputClass}
            aria-invalid={endInvalid ? true : undefined}
            aria-describedby={endDescribedBy}
            onChange={(event) => onEndChange(event.target.value)}
          />
        </label>
        <SlotList
          slots={endSlots}
          value={end}
          onPick={onEndChange}
          label="Giờ kết thúc"
          // Cột hẹp: "1 giờ 30" thay vì "1 giờ 30 phút"
          hint={(minutes) => durationText(start, fromMinutes(minutes))?.replace(/ giờ (\d+) phút$/, " giờ $1") ?? null}
        />
      </div>
    </div>
  );
}
