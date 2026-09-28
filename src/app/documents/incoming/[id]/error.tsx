"use client";

import { AlertCircle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border/50 bg-card p-8 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">
            Không thể tải chi tiết văn bản đến
          </h2>
          <p className="text-xs text-muted-foreground">
            {error.message || "Không thể tải dữ liệu. Vui lòng thử lại."}
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 active:scale-[0.98]"
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}
