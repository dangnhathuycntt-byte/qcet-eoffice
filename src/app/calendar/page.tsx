"use client";

import * as React from "react";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";

function CalendarRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("zone", "calendar");
    params.set("view", "calendar");
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/?zone=calendar&view=calendar");
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
      <div className="flex size-10 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
        <Calendar strokeWidth={1.5} className="size-5 text-primary" />
      </div>
      <div className="space-y-1">
        <h1 className="text-sm font-semibold text-foreground">
          Lịch biểu công việc
        </h1>
        <p className="text-xs text-muted-foreground">
          Đang chuyển hướng tới Lịch biểu công việc...
        </p>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <CalendarRedirectContent />
    </Suspense>
  );
}
