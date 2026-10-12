import * as React from "react";

/** Skeleton chung cho trang danh sách nhiệm vụ và nhiệm vụ đơn vị. */
export function TaskBoardLoading({ label }: { label: string }) {
  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-4 pb-6 md:pb-10 animate-pulse"
      aria-label={`Đang tải danh sách ${label}...`}
    >
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-2">
          <div className="h-4 w-28 rounded bg-muted/60" />
          <div className="h-7 w-56 rounded-md bg-muted/80" />
          <div className="h-4 w-80 max-w-full rounded bg-muted/50" />
        </div>

        <div className="flex items-center gap-2">
          <div className="h-8.5 w-32 rounded-lg bg-muted/60 border border-border/60" />
          <div className="h-8.5 w-24 rounded-lg bg-muted/60 border border-border/60" />
        </div>
      </div>

      {/* Control Bar Skeleton */}
      <div className="rounded-xl border border-border/70 bg-card p-3 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-7 w-20 rounded-md bg-muted/50 shrink-0" />
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="h-6 w-44 rounded-md bg-muted/40 border border-border/50" />
            <div className="h-7 w-24 rounded-lg bg-muted/50 border border-border/60" />
          </div>
        </div>

        <div className="pt-2 border-t border-border/40">
          <div className="h-8 w-full rounded-lg bg-muted/30 border border-border/50" />
        </div>
      </div>

      {/* Content Area Skeleton: các dòng của bảng danh sách */}
      <section aria-label={`Đang tải dữ liệu ${label}`} className="min-h-[420px] space-y-1">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
          <div key={row} className="flex h-12 items-center gap-4 rounded-lg px-3">
            <div className="size-4 rounded bg-muted/50 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-2/3 rounded bg-muted/70" />
              <div className="h-3 w-1/3 rounded bg-muted/40" />
            </div>
            <div className="hidden md:block h-3 w-24 rounded bg-muted/40" />
            <div className="hidden md:block h-3 w-16 rounded bg-muted/40" />
          </div>
        ))}
      </section>
    </div>
  );
}
