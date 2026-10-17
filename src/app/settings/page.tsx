import * as React from "react";
import type { Metadata } from "next";
import { PWAHealthSettings } from "@/components/pwa/pwa-health-settings";
import { WorkspacePageCard } from "@/components/workspace/page-card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Cài đặt hệ thống" };

export default function SettingsPage() {
  return (
    <WorkspacePageCard
      title="Cài đặt hệ thống"
      description="Ứng dụng, thông báo và dữ liệu ngoại tuyến trên thiết bị đang dùng"
      hideTitleOnMobile
      className="max-w-3xl"
    >
      <React.Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <PWAHealthSettings className="pb-6" />
      </React.Suspense>
    </WorkspacePageCard>
  );
}
