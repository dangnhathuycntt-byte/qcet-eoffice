import * as React from "react";
import type { Metadata } from "next";
import { MaintenanceView } from "@/components/common/maintenance-view";

export const metadata: Metadata = {
  title: "Bảo trì & Nâng cấp Hệ thống - QCET E-Office",
  description:
    "Thông báo bảo trì và lộ trình nâng cấp tính năng hệ thống chuyển đổi số Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (Version 2.4.3)",
};

export default function MaintenancePage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-6 animate-pulse">
          <div className="h-6 w-1/3 bg-muted rounded" />
          <div className="h-64 bg-muted/40 rounded-2xl" />
        </div>
      }
    >
      <MaintenanceView />
    </React.Suspense>
  );
}
