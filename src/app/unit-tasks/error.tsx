"use client";

import * as React from "react";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UnitTasksError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("UnitTasks error boundary caught error:", error);
  }, [error]);

  return (
    <div className="max-w-[1440px] w-full mx-auto py-16 px-4">
      <div className="rounded-xl border border-destructive/20 bg-card p-6 text-center max-w-md mx-auto space-y-4 shadow-sm">
        <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="size-6" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground font-heading">
            Đã xảy ra lỗi khi tải trang nhiệm vụ đơn vị
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {error?.message ||
              "Không thể xử lý giao diện quản lý nhiệm vụ đơn vị. Vui lòng thử lại hoặc quay về bảng điều khiển."}
          </p>
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
