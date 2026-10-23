"use client";

import * as React from "react";
import { DropletOff, Palette } from "lucide-react";
import { PERSONAL_NOTE_COLORS, type PersonalNoteColor } from "@qcet/contracts/personal-notes";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { PopoverContent, PopoverRoot, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Tên màu cho nhãn truy cập và tooltip; màu thật là token `--note-*` ở `globals.css`, gắn qua `data-note-color`. */
export const NOTE_COLOR_LABELS: Record<PersonalNoteColor, string> = {
  coral: "Đỏ san hô",
  peach: "Cam đào",
  sand: "Vàng cát",
  mint: "Xanh bạc hà",
  sage: "Xanh ngọc",
  fog: "Xanh sương",
  storm: "Xanh trời",
  dusk: "Tím nhạt",
  blossom: "Hồng",
  clay: "Be",
  chalk: "Xám",
};

const SWATCH_CLASS =
  "flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-shadow";

/**
 * Nút "Màu nền" của thanh công cụ ghi chú (như bảng màu của Google Keep): bấm mở ô chọn 12 mục, mục đầu là màu mặc định.
 * Mũi tên dời tiêu điểm giữa các ô, Enter/Space chọn; ô đang chọn có vòng `primary` và `aria-pressed` (không chỉ bằng màu).
 */
export function NoteColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: PersonalNoteColor | null;
  onChange: (color: PersonalNoteColor | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const groupRef = React.useRef<HTMLDivElement>(null);
  const selectedRef = React.useRef<HTMLButtonElement>(null);
  const options: Array<PersonalNoteColor | null> = [null, ...PERSONAL_NOTE_COLORS];

  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    const buttons = Array.from(groupRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    buttons[(index + step + buttons.length) % buttons.length]?.focus();
  };

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-xs" title="Màu nền" aria-label="Màu nền ghi chú" disabled={disabled} className="data-[popup-open]:bg-accent">
          <Palette />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        mobileSheet
        sheetTitle="Màu nền"
        side="top"
        align="start"
        sideOffset={6}
        initialFocus={selectedRef}
        positionerClassName="z-[60]"
        className="z-[60] w-56 p-3"
      >
        <PopoverTitle className="sr-only">Màu nền ghi chú</PopoverTitle>
        <div ref={groupRef} role="group" aria-label="Màu nền ghi chú" onKeyDown={moveFocus} className="grid grid-cols-6 justify-items-center gap-1">
          {options.map((color) => {
            const label = color ? NOTE_COLOR_LABELS[color] : "Màu mặc định";
            const selected = color === value;
            return (
              <Pressable
                key={color ?? "default"}
                ref={selected ? selectedRef : undefined}
                title={label}
                aria-label={label}
                aria-pressed={selected}
                data-note-color={color ?? undefined}
                onClick={() => {
                  onChange(color);
                  setOpen(false);
                }}
                className={cn(SWATCH_CLASS, color === null && "bg-card", selected ? "ring-2 ring-primary" : "hover:shadow-low")}
              >
                {color === null ? <DropletOff className="size-4" /> : null}
              </Pressable>
            );
          })}
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}
