import * as React from "react";
import type { Metadata } from "next";
import { MaintenanceView } from "@/components/common/maintenance-view";
import { PWAHealthSettings } from "@/components/pwa/pwa-health-settings";
import { INSTITUTION_CONFIG } from "@/config/institution";

export const metadata: Metadata = {
  title: `Cài đặt Hệ thống - ${INSTITUTION_CONFIG.shortName} E-Office`,
  description: `Cài đặt hệ thống chuyển đổi số ${INSTITUTION_CONFIG.officialName}`,
};

export default function SettingsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cài đặt hệ thống</h1>
        <p className="text-sm text-slate-500 mt-1">
          Cấu hình ứng dụng, bộ nhớ ngoại tuyến và tùy chọn cá nhân hóa trên thiết bị
        </p>
      </div>

      <React.Suspense
        fallback={
          <div className="h-64 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
        }
      >
        <PWAHealthSettings />
      </React.Suspense>

      <MaintenanceView
        feature="settings"
        title="Quản trị thông số nâng cao"
        description="Mô-đun quản trị phân quyền tập trung và tích hợp hạ tầng số đang được đồng bộ theo tiêu chuẩn an toàn thông tin QCET."
      />
    </div>
  );
}
