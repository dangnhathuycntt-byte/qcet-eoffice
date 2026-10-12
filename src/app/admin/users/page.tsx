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
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-6 max-md:px-0 max-md:py-1">
      {/* Điện thoại: tên trang đã nằm trên thanh trên cùng, chỉ giữ cho trình đọc màn hình */}
      <div className="max-md:sr-only">
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
