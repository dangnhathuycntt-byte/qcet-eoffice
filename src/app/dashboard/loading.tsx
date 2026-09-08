export default function DashboardLoading() {
  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-6 pb-24 md:pb-10 animate-pulse"
      aria-label="Đang tải bảng điều hành..."
    >
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-2">
          <div className="h-4 w-28 rounded bg-muted/60" />
          <div className="h-7 w-64 rounded-md bg-muted/80" />
          <div className="h-4 w-96 max-w-full rounded bg-muted/50" />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="h-8.5 w-36 rounded-lg bg-muted/60 border border-border/60" />
          <div className="h-8.5 w-32 rounded-lg bg-muted/60 border border-border/60" />
        </div>
      </div>

      {/* Bento Stat Cards Skeleton (4 KPI cards) */}
      <section aria-label="Đang tải chỉ số hiệu suất" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border/70 bg-card p-4 space-y-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded bg-muted/60" />
              <div className="size-8 rounded-lg bg-muted/60" />
            </div>
            <div className="h-8 w-16 rounded bg-muted/80" />
            <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
              <div className="h-full w-1/3 bg-muted/60 rounded-full" />
            </div>
            <div className="h-3 w-28 rounded bg-muted/40" />
          </div>
        ))}
      </section>

      {/* 2-column: Upcoming Deadlines + Activity Feed Skeletons */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-xl border border-border/70 bg-card p-4 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="h-5 w-40 rounded bg-muted/70" />
              <div className="h-4 w-16 rounded bg-muted/40" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/20">
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-3/4 rounded bg-muted/70" />
                    <div className="h-3 w-1/3 rounded bg-muted/40" />
                  </div>
                  <div className="h-5 w-20 rounded bg-muted/50" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-xl border border-border/70 bg-card p-4 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="h-5 w-36 rounded bg-muted/70" />
              <div className="h-4 w-14 rounded bg-muted/40" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg">
                  <div className="size-9 rounded-full bg-muted/60 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-5/6 rounded bg-muted/70" />
                    <div className="h-3 w-1/4 rounded bg-muted/40" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
