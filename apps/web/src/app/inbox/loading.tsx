export default function InboxLoading() {
  return (
    <div className="space-y-4 p-6 animate-pulse" aria-label="Đang tải hộp thư...">
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-border/50 p-4">
            <div className="size-8 shrink-0 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
