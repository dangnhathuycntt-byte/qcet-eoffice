"use client";

import type * as React from "react";
import { Bookmark, BookOpen, ChevronLeft, ChevronRight, Copy, Lock, PlusSquare, Share } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ảnh động "Cài ứng dụng trên điện thoại" trong thư chào mừng: iPhone (Safari) là máy duy nhất phải cài tay,
 * nên minh họa đúng các bước của hộp Cài ứng dụng (mobile-app-install-modal): nhấn Chia sẻ → Thêm vào MH chính →
 * biểu tượng QCET E-Office hiện trên màn hình chính → mở ra, thông báo việc mới đến. Bên cạnh là các bước, sáng lần lượt
 * cùng nhịp (mỗi bước 1/4 chu kỳ). Màn hình điện thoại cố định 180×360 px (toạ độ chạm `welcome-phone-tap` tính theo khung này).
 * Giảm chuyển động: đứng yên ở màn hình chính đã có biểu tượng, các bước hiện đủ.
 */
const LOOP_MS = 12000;
const anim = (name: string, delayMs = 0): React.CSSProperties => ({
  animationName: name,
  animationDuration: `${LOOP_MS}ms`,
  animationDelay: `${delayMs}ms`,
  animationTimingFunction: "ease-in-out",
  animationIterationCount: "infinite",
  animationFillMode: "both",
});
/** Giảm chuyển động: bỏ animation (thắng style inline nhờ !important), phần tử về trạng thái tĩnh trong class. */
const STILL = "motion-reduce:animate-none!";
const APP_ICON = "/icons/icon-192.png";

const STEPS = [
  "Mở trang bằng Safari, nhấn Chia sẻ",
  "Chọn Thêm vào MH chính",
  "Mở QCET E-Office từ màn hình chính",
  "Nhận thông báo khi có việc mới",
] as const;

/** Ô ứng dụng giả trên màn hình chính: [cột, hàng]; ô [2, 1] để trống cho QCET E-Office. */
const HOME_CELLS = [
  [0, 0], [1, 0], [2, 0], [3, 0],
  [0, 1], [1, 1], [3, 1],
  [0, 2], [1, 2],
] as const;
const cellX = (col: number) => 10 + col * 42;
const cellY = (row: number) => 44 + row * 48;

function Lines({ widths, className }: { widths: number[]; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {widths.map((w, index) => (
        <span key={index} className="block h-2 rounded-full bg-foreground/[0.07]" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function StatusBar() {
  return (
    <div className="flex h-7 items-center justify-between px-5 text-xs font-medium text-foreground">
      9:41
      <span className="h-3 w-12 rounded-full bg-foreground/90" />
      <span className="h-2 w-5 rounded-sm bg-foreground/60" />
    </div>
  );
}

export function WelcomeInstallDemo() {
  return (
    <div
      aria-hidden
      className="mt-4 flex justify-center gap-10 rounded-xl border border-border/60 bg-muted/40 px-6 py-6 select-none max-sm:gap-4 max-sm:px-3"
    >
      {/* design-lint-ignore no-arbitrary-radius: khung máy điện thoại trong hình minh họa, bo theo máy thật */}
      <div className="shrink-0 self-center rounded-[30px] bg-background p-1.5 shadow-low ring-1 ring-border/70 max-sm:[zoom:0.8]">
        {/* design-lint-ignore no-arbitrary-radius: màn hình điện thoại trong hình minh họa */}
        <div className="relative h-[360px] w-[180px] overflow-hidden rounded-[24px] bg-background text-xs">
          {/* Safari đang mở QCET E-Office */}
          <StatusBar />
          <div className="px-4 pt-3">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <img src={APP_ICON} alt="" className="size-5 rounded-md" />
              QCET E-Office
            </div>
            <Lines widths={[90, 72, 84, 60]} className="mt-4" />
            <span className="mt-5 block h-7 rounded-md bg-primary/80" />
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-muted/60 pb-1 pt-1.5">
            <div className="mx-3 flex h-7 items-center justify-center gap-1 rounded-lg bg-background text-muted-foreground shadow-low">
              <Lock className="size-3" />
              <span className="h-1.5 w-16 rounded-full bg-foreground/15" />
            </div>
            <div className="flex h-9 items-center justify-around px-2 text-primary">
              <ChevronLeft className="size-4" />
              <ChevronRight className="size-4 opacity-40" />
              <Share className="size-4" />
              <BookOpen className="size-4" />
              <Copy className="size-4" />
            </div>
          </div>

          {/* Bảng Chia sẻ */}
          <div className={cn("absolute inset-0 bg-overlay/30 opacity-0", STILL)} style={anim("welcome-phone-dim")} />
          <div
            className={cn("absolute inset-x-0 bottom-0 h-[172px] translate-y-full rounded-t-2xl bg-popover p-2 shadow-menu", STILL)}
            style={anim("welcome-phone-sheet")}
          >
            <div className="mb-1 flex h-10 items-center gap-2 px-1.5">
              <img src={APP_ICON} alt="" className="size-7 rounded-md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">QCET E-Office</span>
                <span className="mt-1 block h-1.5 w-14 rounded-full bg-foreground/15" />
              </span>
            </div>
            <div className="flex h-8 items-center justify-between rounded-md px-2 text-foreground">
              Sao chép <Copy className="size-3.5 text-muted-foreground" />
            </div>
            <div className={cn("flex h-8 items-center justify-between rounded-md px-2 text-foreground", STILL)} style={anim("welcome-phone-row")}>
              Thêm vào MH chính <PlusSquare className="size-3.5 text-muted-foreground" />
            </div>
            <div className="flex h-8 items-center justify-between rounded-md px-2 text-foreground">
              Thêm dấu trang <Bookmark className="size-3.5 text-muted-foreground" />
            </div>
          </div>

          {/* Màn hình chính: biểu tượng QCET E-Office mới thêm */}
          <div className={cn("absolute inset-0 bg-muted opacity-0 motion-reduce:opacity-100", STILL)} style={anim("welcome-phone-home")}>
            <StatusBar />
            {HOME_CELLS.map(([col, row]) => (
              <span
                key={`${col}-${row}`}
                className="absolute size-9 rounded-sm bg-foreground/10"
                style={{ left: cellX(col), top: cellY(row) }}
              />
            ))}
            <img
              src={APP_ICON}
              alt=""
              className={cn("absolute size-9 rounded-sm shadow-low", STILL)}
              style={{ left: cellX(2), top: cellY(1), ...anim("welcome-phone-icon") }}
            />
            <div className="absolute inset-x-2 bottom-2 flex h-12 items-center justify-around rounded-2xl bg-foreground/[0.06] px-1">
              {[0, 1, 2, 3].map((index) => (
                <span key={index} className="size-9 rounded-sm bg-foreground/10" />
              ))}
            </div>
          </div>

          {/* Ứng dụng mở ra từ biểu tượng, thông báo việc mới trượt xuống */}
          <div
            className={cn("absolute inset-0 bg-background opacity-0", STILL)}
            style={{ transformOrigin: `${cellX(2) + 18}px ${cellY(1) + 18}px`, ...anim("welcome-phone-app") }}
          >
            <StatusBar />
            <div className="px-4 pt-2">
              <p className="text-sm font-semibold text-foreground">Hộp thư</p>
              <Lines widths={[88, 64, 80, 56, 72, 48]} className="mt-4 space-y-3" />
            </div>
          </div>
          <div
            className={cn("absolute inset-x-2 top-2 flex -translate-y-[120%] items-center gap-2 rounded-2xl bg-popover p-2 opacity-0 shadow-menu", STILL)}
            style={anim("welcome-phone-banner")}
          >
            <img src={APP_ICON} alt="" className="size-7 shrink-0 rounded-md" />
            <span className="min-w-0">
              <span className="block truncate font-medium text-foreground">QCET E-Office</span>
              <span className="block truncate text-muted-foreground">Bạn có nhiệm vụ mới</span>
            </span>
          </div>

          {/* Điểm chạm */}
          <span
            className="absolute left-0 top-0 size-7 rounded-full bg-foreground/15 opacity-0 ring-2 ring-foreground/20 motion-reduce:hidden"
            style={anim("welcome-phone-tap")}
          />
        </div>
      </div>

      <ol className="min-w-0 max-w-56 space-y-3 self-center text-compact max-sm:text-xs">
        {STEPS.map((step, index) => (
          <li
            key={step}
            className={cn("flex gap-2.5 text-muted-foreground motion-reduce:text-foreground", STILL)}
            style={anim("welcome-phone-step", (index * LOOP_MS) / STEPS.length)}
          >
            <span className="w-3 shrink-0 text-right tabular-nums">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
