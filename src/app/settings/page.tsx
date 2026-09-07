import * as React from "react";
import type { Metadata } from "next";
import { MaintenanceView } from "@/components/common/maintenance-view";

export const metadata: Metadata = {
  title: "Cài đặt Hệ thống - QCET E-Office",
  description:
    "Cài đặt hệ thống chuyển đổi số Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (Version 2.4.3)",
};

export default function SettingsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-6 animate-pulse">
          <div className="h-6 w-1/3 bg-muted rounded" />
          <div className="h-64 bg-muted/40 rounded-2xl" />
        </div>
      }
    >
      <MaintenanceView
        feature="settings"
        title="Cài đặt hệ thống"
        description="Mô-đun cấu hình và quản trị thông số hệ thống đang được rà soát phân quyền bảo mật theo phiên bản Version 2.4.3. Quý Thầy/Cô và Cán bộ vui lòng quay lại sau."
      />
    </React.Suspense>
  );
}
