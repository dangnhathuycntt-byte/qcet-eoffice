import * as React from "react";

export default function TaskDetailLoading() {
  return (
    <div
      className="min-h-screen bg-background text-foreground animate-pulse"
      aria-label="Đang tải chi tiết nhiệm vụ..."
    >
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top bar: Back button + Task Code */}
        <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div className="h-9 w-44 rounded-lg bg-muted/70" />
          <div className="h-7 w-28 rounded-md bg-muted/50" />
        </div>

        {/* Title Header + Actions Banner */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-card border border-border/60 rounded-xl p-5 shadow-xs">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 rounded-md bg-muted/60" />
              <div className="h-5 w-20 rounded-md bg-muted/50" />
            </div>
            <div className="h-7 w-96 max-w-full rounded-md bg-muted/80" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-32 rounded-lg bg-muted/60" />
            <div className="h-9 w-28 rounded-lg bg-muted/50" />
          </div>
        </div>

        {/* 2-Column Responsive Layout: 2/3 Main + 1/3 Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description Card */}
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3 shadow-xs">
              <div className="h-5 w-40 rounded bg-muted/70" />
              <div className="space-y-2 pt-1">
                <div className="h-4 w-full rounded bg-muted/40" />
                <div className="h-4 w-5/6 rounded bg-muted/40" />
                <div className="h-4 w-2/3 rounded bg-muted/40" />
              </div>
            </div>

            {/* Deliverables Card */}
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3 shadow-xs">
              <div className="h-5 w-48 rounded bg-muted/70" />
              <div className="h-16 w-full rounded-lg bg-muted/30 border border-border/40" />
            </div>

            {/* Subtasks Card */}
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="h-5 w-36 rounded bg-muted/70" />
                <div className="h-7 w-28 rounded-lg bg-muted/50" />
              </div>
              <div className="space-y-2">
                <div className="h-12 w-full rounded-lg bg-muted/30 border border-border/40" />
                <div className="h-12 w-full rounded-lg bg-muted/30 border border-border/40" />
              </div>
            </div>

            {/* Processing History Card */}
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3 shadow-xs">
              <div className="h-5 w-44 rounded bg-muted/70" />
              <div className="space-y-3 pl-4 pt-2">
                <div className="h-4 w-3/4 rounded bg-muted/40" />
                <div className="h-4 w-1/2 rounded bg-muted/40" />
              </div>
            </div>
          </div>

          {/* Sidebar Column (1/3) */}
          <div className="space-y-6">
            {/* Operational Info Card */}
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-5 shadow-xs">
              <div className="h-5 w-40 rounded bg-muted/70 border-b border-border/40 pb-2" />

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="h-3.5 w-24 rounded bg-muted/40" />
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-full bg-muted/60" />
                    <div className="h-4 w-32 rounded bg-muted/70" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="h-3.5 w-24 rounded bg-muted/40" />
                  <div className="h-4 w-40 rounded bg-muted/60" />
                </div>

                <div className="space-y-1.5">
                  <div className="h-3.5 w-24 rounded bg-muted/40" />
                  <div className="h-4 w-36 rounded bg-muted/60" />
                </div>

                <div className="space-y-1.5">
                  <div className="h-3.5 w-24 rounded bg-muted/40" />
                  <div className="h-4 w-28 rounded bg-muted/60" />
                </div>

                <div className="space-y-2 pt-2 border-t border-border/40">
                  <div className="h-3.5 w-28 rounded bg-muted/40" />
                  <div className="h-2 w-full rounded-full bg-muted/50" />
                  <div className="h-4 w-16 rounded bg-muted/60" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
