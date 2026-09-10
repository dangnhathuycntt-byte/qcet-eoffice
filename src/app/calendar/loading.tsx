import * as React from "react";

export default function CalendarLoading() {
  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-6 px-4 sm:px-6 py-4 pb-24 md:pb-10 animate-pulse"
      aria-label="Đang tải lịch công tác..."
    >
      {/* Breadcrumb & Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-5">
        <div className="space-y-2">
          <div className="h-4 w-44 rounded bg-muted/60" />
          <div className="h-7 w-64 rounded-md bg-muted/80" />
          <div className="h-4 w-80 max-w-full rounded bg-muted/50" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 rounded-lg bg-muted/60 border border-border/60" />
          <div className="h-9 w-32 rounded-lg bg-muted/80 border border-border/60" />
        </div>
      </div>

      {/* Control Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/60 bg-card">
        <div className="flex items-center gap-2">
          <div className="h-8.5 w-8.5 rounded-lg bg-muted/60" />
          <div className="h-8.5 w-8.5 rounded-lg bg-muted/60" />
          <div className="h-8.5 w-44 rounded-lg bg-muted/60" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8.5 w-24 rounded-lg bg-muted/60" />
          <div className="h-8.5 w-24 rounded-lg bg-muted/60" />
        </div>
      </div>

      {/* Week Grid Skeleton */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-2xs">
        {/* Day Column Headers */}
        <div className="grid grid-cols-7 border-b border-border/60 bg-muted/20">
          {[
            "Thứ 2",
            "Thứ 3",
            "Thứ 4",
            "Thứ 5",
            "Thứ 6",
            "Thứ 7",
            "Chủ nhật",
          ].map((day, i) => (
            <div
              key={i}
              className="p-3 border-r border-border/40 last:border-r-0 text-center space-y-1"
            >
              <div className="h-3 w-10 bg-muted/50 rounded mx-auto" />
              <div className="h-4 w-6 bg-muted/70 rounded mx-auto" />
            </div>
          ))}
        </div>

        {/* Day Column Content Cells */}
        <div className="grid grid-cols-7 min-h-[420px] divide-x divide-border/40">
          {[1, 2, 3, 4, 5, 6, 7].map((col) => (
            <div key={col} className="p-2 space-y-2">
              {col <= 5 && (
                <>
                  <div className="rounded-lg border border-border/50 bg-muted/30 p-2 space-y-1.5 shadow-2xs">
                    <div className="h-3.5 w-3/4 rounded bg-muted/70" />
                    <div className="h-2.5 w-1/2 rounded bg-muted/40" />
                    <div className="h-2 w-1/3 rounded bg-muted/40" />
                  </div>
                  {col % 2 === 1 && (
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-2 space-y-1.5 shadow-2xs">
                      <div className="h-3.5 w-4/5 rounded bg-muted/70" />
                      <div className="h-2.5 w-2/3 rounded bg-muted/40" />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
