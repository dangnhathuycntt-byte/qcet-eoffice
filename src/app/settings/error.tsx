"use client";

import * as React from "react";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Settings error boundary caught error:", error);
  }, [error]);

  return (
    <div className="max-w-[1440px] w-full mx-auto py-16 px-4" role="alert">
      <div className="rounded-xl border border-destructive/20 bg-card p-6 text-center max-w-md mx-auto space-y-4 shadow-sm">
        <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="size-6" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground font-heading">
            Đã xảy ra lỗi khi tải Cài đặt
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {error?.message ||
              "Không thể tải trang cài đặt hệ thống. Vui lòng thử lại hoặc quay về bảng điều khiển."}
          </p>
          {error?.digest && (
            <p className="mt-2 text-xs font-mono text-muted-foreground/80 bg-muted/50 px-2 py-0.5 rounded border border-border/40 inline-block">
              Mã yêu cầu: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={reset}
            className="gap-1.5 text-xs font-medium cursor-pointer"
          >
            <RefreshCw className="size-3.5" strokeWidth={1.5} />
            <span>Thử lại</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            asChild
            className="gap-1.5 text-xs font-medium cursor-pointer"
          >
            <Link href="/dashboard">
              <ArrowLeft className="size-3.5" strokeWidth={1.5} />
              <span>Bảng điều khiển</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
