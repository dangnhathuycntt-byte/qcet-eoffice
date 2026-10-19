export default function AssistantLoading() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" aria-busy="true" aria-label="Đang tải Trợ lý">
      <div className="flex min-h-12 shrink-0 items-center border-b border-border/60 px-3 md:px-4">
        <div className="h-7 w-44 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-6">
        <div className="h-7 w-72 max-w-full animate-pulse rounded bg-muted" />
        <div className="h-24 w-full max-w-[640px] animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
