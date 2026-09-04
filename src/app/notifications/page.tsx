"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { getMockDashboardPayload } from "@/lib/mock-dashboard-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function NotificationsPage() {
  const payload = getMockDashboardPayload();

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon-sm" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Thông báo hệ thống
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cập nhật trạng thái nhiệm vụ và hoạt động điều hành QCET E-Office
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border/80 bg-card p-4 shadow-xs divide-y divide-border/50">
        {payload.activities.map((act) => (
          <div key={act.id} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
              <Bell className="size-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {act.actorName}
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3" />
                  {act.timestamp}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-medium text-foreground">{act.action}</span>{" "}
                &ldquo;{act.targetTitle}&rdquo;
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
