import * as React from "react";

export default function OutgoingDocumentDetailLoading() {
  return (
    <div
      className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-4 pb-24 md:pb-10 space-y-4 animate-pulse"
      aria-label="Đang tải chi tiết văn bản đi..."
    >
      {/* Back nav skeleton */}
      <div className="h-4 w-32 rounded bg-muted/60" />

      {/* Header card skeleton */}
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-3">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-muted/60 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-2/3 rounded bg-muted/70" />
            <div className="h-3.5 w-full max-w-xl rounded bg-muted/40" />
            <div className="flex gap-4 mt-1">
              <div className="h-3.5 w-24 rounded bg-muted/50" />
              <div className="h-3.5 w-16 rounded bg-muted/40" />
              <div className="h-3.5 w-20 rounded bg-muted/40" />
            </div>
          </div>
        </div>
      </div>

      {/* 2-col layout skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* Left: PDF viewer skeleton */}
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs min-h-[500px] flex flex-col">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/30 border-b border-border/60 gap-2">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-muted/60" />
              <div className="space-y-1">
                <div className="h-3.5 w-36 rounded bg-muted/70" />
                <div className="h-3 w-16 rounded bg-muted/40" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-20 rounded-lg bg-muted/50" />
              <div className="h-7 w-16 rounded-lg bg-muted/50" />
            </div>
          </div>
          <div className="flex-1 bg-muted/40" />
        </div>

        {/* Right sidebar skeleton */}
        <div className="space-y-3">
          {/* Stepper skeleton */}
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
            <div className="h-3.5 w-28 rounded bg-muted/60 mb-4" />
            <div className="space-y-5">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="size-7 rounded-full bg-muted/60 shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3.5 w-32 rounded bg-muted/70" />
                    <div className="h-3 w-20 rounded bg-muted/40" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action panel skeleton */}
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs space-y-2">
            <div className="h-3.5 w-20 rounded bg-muted/60 mb-3" />
            <div className="h-12 rounded-lg bg-muted/40 border border-border/50" />
          </div>

          {/* Recipient list skeleton */}
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
            <div className="h-3.5 w-24 rounded bg-muted/60 mb-3" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-2">
                  <div className="size-3.5 rounded bg-muted/60 shrink-0" />
                  <div className="h-3.5 flex-1 rounded bg-muted/50" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
