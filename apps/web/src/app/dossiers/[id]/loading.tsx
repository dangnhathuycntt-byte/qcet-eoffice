export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-start gap-3">
        <div className="mt-1 h-7 w-7 rounded-lg bg-muted/60" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-20 rounded bg-muted/60" />
            <div className="h-5 w-24 rounded-full bg-muted/40" />
          </div>
          <div className="h-6 w-2/3 rounded bg-muted/60" />
        </div>
      </div>
      {/* Two-column grid skeleton */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <div className="h-48 rounded-xl border border-border/50 bg-muted/20" />
          <div className="h-64 rounded-xl border border-border/50 bg-muted/20" />
        </div>
        <div className="space-y-4">
          <div className="h-32 rounded-xl border border-border/50 bg-muted/20" />
          <div className="h-32 rounded-xl border border-border/50 bg-muted/20" />
        </div>
      </div>
    </div>
  );
}
