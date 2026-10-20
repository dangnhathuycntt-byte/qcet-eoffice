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
    const measure = () => setCapacity(Math.max(0, Math.floor((el.clientWidth + 3) / PITCH_PX)));
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

function Bars({ values, className }: { values: readonly number[]; className?: string }) {
  return (
    <div className={cn("flex h-full items-center gap-0.75", className)}>
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
  /** Tên cho trình đọc màn hình ("Sóng âm, đang tải lên 40%"). */
  label: string;
  className?: string;
}

/**
 * Sóng âm của một bản ghi cuộc họp, vẽ bằng cột DOM từ độ lớn máy chủ đã đo (không giải mã âm thanh trên trình duyệt: bản
 * 2 giờ tốn hàng trăm MB bộ nhớ). Không phát lại được vì âm thanh không có đường tải về (ADR-013).
 */
export function RecordingWaveform({ peaks, tone = "strong", scanning = false, head = null, live = false, label, className }: RecordingWaveformProps) {
  const [ref, capacity] = useBarCapacity();
  const color = tone === "strong" ? "text-foreground" : "text-muted-foreground/45";

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
    body = scanning ? (
      <div className="relative h-full">
        <Bars values={values} className="text-muted-foreground/35" />
        <Bars values={values} className="animate-waveform-scan absolute inset-0 text-foreground" />
      </div>
    ) : (
      <Bars values={values} className={cn(color, "motion-safe:animate-[fade-in_0.3s_ease-out]")} />
    );
  }

  return (
    <div ref={ref} role="img" aria-label={label} className={cn("h-10 w-full overflow-hidden", className)}>
      {capacity > 0 ? body : null}
    </div>
  );
}
