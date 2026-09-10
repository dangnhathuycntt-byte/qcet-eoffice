import * as React from "react";

export default function NotificationsLoading() {
  return (
    <div
      className="max-w-3xl mx-auto py-4 px-2 sm:px-0 space-y-4 animate-pulse"
      aria-label="Đang tải thông báo..."
    >
      {/* Top back action skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-44 rounded-lg bg-muted/60" />
        <div className="h-8 w-24 rounded-lg bg-muted/60" />
      </div>

      {/* Card Container Skeleton */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-card overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-56 rounded-md bg-muted/80" />
              <div className="h-5 w-14 rounded-md bg-muted/50" />
            </div>
            <div className="h-7 w-28 rounded-lg bg-muted/50" />
          </div>
          <div className="h-4 w-72 rounded bg-muted/40 mt-1.5" />
        </div>

        {/* Triage Tabs Skeleton */}
        <div className="p-3 bg-muted/10 border-b border-border/40">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-muted/40 rounded-xl">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 rounded-lg bg-muted/60" />
            ))}
          </div>
        </div>

        {/* Notification List Skeleton */}
        <div className="divide-y divide-border/40">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-start gap-3.5">
              <div className="size-10 rounded-full bg-muted/60 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="h-4 w-48 rounded bg-muted/70" />
                  <div className="h-3 w-16 rounded bg-muted/40" />
                </div>
                <div className="h-3.5 w-5/6 rounded bg-muted/50" />
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-4 w-20 rounded-full bg-muted/40" />
                  <div className="h-4 w-24 rounded-full bg-muted/40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
