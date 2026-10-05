import * as React from "react";
import type { Metadata } from "next";
import { UserDirectoryView } from "@/components/admin/user-directory-view";
import { INSTITUTION_CONFIG } from "@/config/institution";

export const metadata: Metadata = {
  title: `Danh bạ Nhân sự - ${INSTITUTION_CONFIG.shortName} E-Office`,
  description: `Quản lý danh bạ nhân sự ${INSTITUTION_CONFIG.officialName}`,
};

export default function UserDirectoryPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Danh bạ Nhân sự</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tra cứu thông tin nhân sự toàn trường - chế độ chỉ đọc
        </p>
      </div>
      <React.Suspense
        fallback={
          <div className="h-96 rounded-xl border border-border bg-muted/50 animate-pulse" />
        }
      >
        <UserDirectoryView />
      </React.Suspense>
    </div>
  );
}
