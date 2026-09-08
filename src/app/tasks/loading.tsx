export default function TasksLoading() {
  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-4 pb-24 md:pb-10 animate-pulse"
      aria-label="Đang tải danh sách công việc..."
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

      {/* Content Area Skeleton: Kanban Columns */}
      <section aria-label="Đang tải dữ liệu công việc" className="min-h-[420px]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((col) => (
            <div
              key={col}
              className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3 min-h-[380px]"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="h-4 w-28 rounded bg-muted/70" />
                <div className="size-5 rounded-full bg-muted/50" />
              </div>
              <div className="space-y-2.5">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="rounded-lg border border-border/60 bg-card p-3 space-y-2 shadow-2xs"
                  >
                    <div className="h-4 w-3/4 rounded bg-muted/70" />
                    <div className="h-3 w-1/2 rounded bg-muted/40" />
                    <div className="flex items-center justify-between pt-2 border-t border-border/30">
                      <div className="size-6 rounded-full bg-muted/50" />
                      <div className="h-3 w-16 rounded bg-muted/40" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
