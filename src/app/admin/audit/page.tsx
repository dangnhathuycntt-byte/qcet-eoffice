import * as React from "react";
import type { Metadata } from "next";
import { AuditLogView } from "@/components/admin/audit-log-view";
import { INSTITUTION_CONFIG } from "@/config/institution";

export const metadata: Metadata = {
  title: `Nhật ký Kiểm toán - ${INSTITUTION_CONFIG.shortName} E-Office`,
  description: `Nhật ký hoạt động hệ thống ${INSTITUTION_CONFIG.officialName}`,
};

export default function AuditLogPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Nhật ký Kiểm toán</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lịch sử hoạt động và thay đổi trong hệ thống
        </p>
      </div>
      <React.Suspense
        fallback={
          <div className="h-96 rounded-xl border border-border bg-muted/50 animate-pulse" />
        }
      >
        <AuditLogView />
      </React.Suspense>
    </div>
  );
}
