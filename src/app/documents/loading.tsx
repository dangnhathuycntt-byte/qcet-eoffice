import * as React from "react";

export default function DocumentsLoading() {
  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-4 px-4 sm:px-6 py-4 pb-24 md:pb-10 animate-pulse"
      aria-label="Đang tải phân hệ quản lý văn bản..."
    >
      {/* Roadmap / Header Banner Skeleton */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-5 w-36 rounded-full bg-muted/70" />
          <div className="h-5 w-24 rounded-full bg-muted/50" />
        </div>
        <div className="h-7 w-72 max-w-full rounded-md bg-muted/80" />
        <div className="h-4 w-full max-w-2xl rounded bg-muted/40" />
      </div>

      {/* Control / Filter Bar Skeleton */}
      <div className="rounded-xl border border-border/70 bg-card p-3 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Document Type Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-28 rounded-lg bg-muted/60 shrink-0" />
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="h-8.5 w-32 rounded-lg bg-muted/60 border border-border/60" />
            <div className="h-8.5 w-28 rounded-lg bg-muted/60 border border-border/60" />
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-border/40">
          <div className="h-9 w-full sm:w-80 rounded-lg bg-muted/40 border border-border/50" />
          <div className="h-9 w-36 rounded-lg bg-muted/40 border border-border/50" />
          <div className="h-9 w-36 rounded-lg bg-muted/40 border border-border/50" />
        </div>
      </div>

      {/* Document Registry Table Skeleton */}
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-3 p-3.5 border-b border-border/50 bg-muted/20">
          <div className="col-span-3 h-4 rounded bg-muted/70" />
          <div className="col-span-4 h-4 rounded bg-muted/70" />
          <div className="col-span-2 h-4 rounded bg-muted/70" />
          <div className="col-span-2 h-4 rounded bg-muted/70" />
          <div className="col-span-1 h-4 rounded bg-muted/70" />
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-border/40">
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div key={row} className="grid grid-cols-12 gap-3 p-3.5 items-center">
              <div className="col-span-3 space-y-1.5">
                <div className="h-4 w-28 rounded bg-muted/70" />
                <div className="h-3 w-16 rounded bg-muted/40" />
              </div>
              <div className="col-span-4 space-y-1.5">
                <div className="h-4 w-4/5 rounded bg-muted/70" />
                <div className="h-3 w-1/2 rounded bg-muted/40" />
              </div>
              <div className="col-span-2">
                <div className="h-4 w-24 rounded bg-muted/50" />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <div className="h-5 w-20 rounded-full bg-muted/60" />
              </div>
              <div className="col-span-1 flex justify-end">
                <div className="size-7 rounded-md bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
