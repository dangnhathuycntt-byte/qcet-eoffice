"use client";

import * as React from "react";
import { resampleWaveform } from "@qcet/shared/domain/meetings/recording-waveform";
import { cn } from "@/lib/utils";

/** Cột 2px cách 3px như Ghi âm của iOS; số cột theo bề rộng thật của khung. */
const PITCH_PX = 5;
/** Ghi trực tiếp: cột dồn tới chừng này bề rộng rồi trôi sang trái, phần còn lại là đường chấm phía sau vạch đỏ. */
const LIVE_FILL = 0.82;

function useBarCapacity(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = React.useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // Bề rộng phần nội dung (trừ lề trong khi khung được đẩy thẳng cột tiêu đề)
      const style = getComputedStyle(el);
      const width = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setCapacity(Math.max(0, Math.floor((width + 3) / PITCH_PX)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, capacity];
}

/** Đúng `count` cột: nhiều hơn thì gộp (lấy lớn nhất), ít hơn (bản rất ngắn) thì giãn theo cột gần nhất. */
function fitBars(peaks: readonly number[], count: number): number[] {
  if (count <= 0 || peaks.length === 0) return [];
  if (peaks.length >= count) return resampleWaveform(peaks, count);
  return Array.from({ length: count }, (_, i) => peaks[Math.floor((i * peaks.length) / count)] ?? 0);
}

function Bars({ values, className, style }: { values: readonly number[]; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn("flex h-full items-center gap-0.75", className)} style={style}>
      {values.map((value, i) => (
        <span key={i} className="min-h-0.5 w-0.5 shrink-0 rounded-full bg-current" style={{ height: `${Math.max(4, value)}%` }} />
      ))}
    </div>
  );
}

const DottedLine = ({ className }: { className?: string }) => (
  // design-lint-ignore no-card-accent-bar: đường chấm của sóng âm (phần chưa có tiếng), không phải viền nhấn của thẻ
  <div aria-hidden="true" className={cn("h-0 border-t-2 border-dotted border-muted-foreground/35", className)} />
);

export interface RecordingWaveformProps {
  /** Độ lớn 0–100 theo khoảng đều nhau; null hoặc rỗng (chưa đo, không đo được) thì vẽ đường chấm. */
  peaks: readonly number[] | null;
  /** `strong`: bản sẵn sàng tạo biên bản; `muted`: đã xong, lỗi, hay đang chờ. */
  tone?: "strong" | "muted";
  /** Agent đang nghe: dải sáng quét ngang qua sóng (`.animate-waveform-scan`). */
  scanning?: boolean;
  /** 0–1: vạch đỏ khi đang tải lên; phía trước vạch là nét liền, phía sau là đường chấm. */
  head?: number | null;
  /** Ghi trực tiếp: các cột mới nhất dồn sang phải tới vạch đỏ, phía sau là đường chấm (như Ghi âm của iOS). */
  live?: boolean;
  /** 0–1: vị trí đang nghe; phần đã nghe đậm, phần chưa nghe mờ, vạch đỏ ở vị trí này. null khi chưa nghe. */
  progress?: number | null;
  /** Có thì sóng là thanh tua (`role="slider"`): bấm/kéo để tới vị trí, mũi tên trái/phải lùi/tới `step`, Home/End về đầu/cuối. */
  onSeek?: (fraction: number) => void;
  /** Bước tua bằng phím, theo tỉ lệ thời lượng (5 giây / thời lượng). */
  step?: number;
  /** Chữ đọc vị trí cho trình đọc màn hình ("12:05 trên 2:16:21"). */
  valueText?: string;
  /** Tên cho trình đọc màn hình ("Sóng âm, đang tải lên 40%"). */
  label: string;
  className?: string;
}

/**
 * Sóng âm của một bản ghi cuộc họp, vẽ bằng cột DOM từ độ lớn máy chủ đã đo (không giải mã âm thanh trên trình duyệt: bản
 * 2 giờ tốn hàng trăm MB bộ nhớ). Có `onSeek` thì là thanh tua của `RecordingPlayer`.
 */
export function RecordingWaveform({
  peaks,
  tone = "strong",
  scanning = false,
  head = null,
  live = false,
  progress = null,
  onSeek,
  step = 0.02,
  valueText,
  label,
  className,
}: RecordingWaveformProps) {
  const [ref, capacity] = useBarCapacity();
  const color = tone === "strong" ? "text-foreground" : "text-muted-foreground/45";
  const played = progress === null ? null : Math.min(1, Math.max(0, progress));

  let body: React.ReactNode;
  if (live) {
    const shown = (peaks ?? []).slice(-Math.floor(capacity * LIVE_FILL));
    body = (
      <div className="flex h-full items-center gap-0.75">
        <Bars values={shown} className="text-foreground" />
        <span aria-hidden="true" className="h-full w-0.5 shrink-0 rounded-full bg-destructive" />
        <DottedLine className="min-w-4 flex-1" />
      </div>
    );
  } else if (!peaks || peaks.length === 0) {
    const at = head === null ? null : Math.min(1, Math.max(0, head));
    body = (
      <div className="relative flex h-full items-center">
        <DottedLine className="w-full" />
        {at !== null && (
          <>
            <span aria-hidden="true" className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 rounded-full bg-foreground/60" style={{ width: `${at * 100}%` }} />
            <span aria-hidden="true" className="absolute inset-y-0 w-0.5 rounded-full bg-destructive transition-[left] duration-300" style={{ left: `calc(${at * 100}% - 1px)` }} />
          </>
        )}
      </div>
    );
  } else {
    const values = fitBars(peaks, capacity);
    body =
      scanning || played !== null ? (
        <div className="relative h-full">
          <Bars values={values} className="text-muted-foreground/35" />
          {scanning && <Bars values={values} className="animate-waveform-scan absolute inset-0 text-foreground" />}
          {played !== null && (
            // Phần đã nghe: cùng các cột, cắt tới vị trí đang nghe
            <Bars values={values} className="absolute inset-0 text-foreground" style={{ clipPath: `inset(0 ${(1 - played) * 100}% 0 0)` }} />
          )}
        </div>
      ) : (
        <Bars values={values} className={cn(color, "motion-safe:animate-[fade-in_0.3s_ease-out]")} />
      );
  }

  const playhead =
    played !== null && !live ? (
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 rounded-full bg-destructive" style={{ left: `calc(${played * 100}% - 1px)` }} />
    ) : null;

  if (!onSeek) {
    return (
      <div ref={ref} role="img" aria-label={label} className={cn("relative h-10 w-full overflow-hidden", className)}>
        {capacity > 0 ? body : null}
        {playhead}
      </div>
    );
  }

  const seekAt = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    onSeek(Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width))));
  };
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((played ?? 0) * 100)}
      aria-valuetext={valueText}
      className={cn(
        "relative h-10 w-full cursor-pointer touch-none overflow-hidden rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        seekAt(event.clientX, event.currentTarget);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) seekAt(event.clientX, event.currentTarget);
      }}
      onKeyDown={(event) => {
        const at = played ?? 0;
        const next =
          event.key === "ArrowRight" || event.key === "ArrowUp"
            ? at + step
            : event.key === "ArrowLeft" || event.key === "ArrowDown"
              ? at - step
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? 1
                  : null;
        if (next === null) return;
        event.preventDefault();
        onSeek(Math.min(1, Math.max(0, next)));
      }}
    >
      {capacity > 0 ? body : null}
      {playhead}
    </div>
  );
}
