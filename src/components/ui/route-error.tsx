"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Nhãn ghi log, vd "Tasks" → "Tasks error boundary caught error:". */
  logLabel: string;
  title: string;
  fallbackMessage: string;
  backHref: string;
  backLabel: string;
  containerClassName?: string;
}

/** Màn lỗi dùng chung cho các `error.tsx` của route; mỗi route chỉ khai báo chữ và đích quay về. */
export function RouteError({
  error,
  reset,
  logLabel,
  title,
  fallbackMessage,
  backHref,
  backLabel,
  containerClassName = "max-w-[1440px] w-full mx-auto py-16 px-4",
}: RouteErrorProps) {
  React.useEffect(() => {
    console.error(`${logLabel} error boundary caught error:`, error);
  }, [error, logLabel]);

  return (
    <div className={containerClassName} role="alert">
      <div className="rounded-xl border border-destructive/20 bg-card p-6 text-center max-w-md mx-auto space-y-4 shadow-sm">
        <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="size-6" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground font-heading">{title}</h2>
          <p className="text-xs text-muted-foreground mt-1">{error?.message || fallbackMessage}</p>
          {error?.digest && (
            <p className="mt-2 text-xs font-mono text-muted-foreground/80 bg-muted/50 px-2 py-0.5 rounded border border-border/40 inline-block">
              Mã yêu cầu: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="gap-1.5 text-xs font-medium"
          >
            <RefreshCw className="size-3.5" />
            <span>Thử lại</span>
          </Button>
          <Button variant="secondary" size="sm" asChild className="gap-1.5 text-xs font-medium">
            <Link href={backHref}>
              <ArrowLeft className="size-3.5" />
              <span>{backLabel}</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
