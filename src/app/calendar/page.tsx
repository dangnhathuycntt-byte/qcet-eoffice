"use client";

import * as React from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";

export default function CalendarPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?view=calendar");
  }, [router]);

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
