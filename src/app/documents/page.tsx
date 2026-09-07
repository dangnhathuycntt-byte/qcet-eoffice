import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Clock } from "lucide-react";
import { DocumentRegistryView } from "@/components/documents/document-registry-view";

export const metadata: Metadata = {
  title: "Văn bản & Quản lý Công văn - QCET E-Office",
  description:
    "Sổ quản lý văn bản, công văn đi - đến, tờ trình duyệt và liên thông nhiệm vụ Nghị định 30/2020/NĐ-CP - Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
};

export default function DocumentsPage() {
  return (
    <div className="space-y-4">
      {/* High-visibility senior-friendly roadmap announcement banner */}
      <section
        aria-label="Thông báo lộ trình phân hệ văn bản"
        className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-4"
      >
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 select-none">
                  <Clock size={13} className="shrink-0" />
                  LỘ TRÌNH GIAI ĐOẠN 2
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 select-none">
                  ĐANG PHÁT TRIỂN
                </span>
              </div>

              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                Phân hệ Quản lý & Lưu trữ Văn bản (Đang hoàn thiện)
              </h1>

              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Hệ thống hiện đang tập trung toàn lực vận hành Phân hệ Quản lý & Điều hành Công việc. Phân hệ Văn bản đang trong giai đoạn kết nối trục liên thông Nghị định 30/2020/NĐ-CP và chữ ký số từ xa. Quý Thầy/Cô và Cán bộ có thể xem trước giao diện và trải nghiệm các tính năng thử nghiệm bên dưới.
              </p>
            </div>

            <div className="shrink-0 flex items-center">
              <Link
                href="/?zone=tasks"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-colors active:scale-95 touch-manipulation"
              >
                <Briefcase size={16} className="shrink-0" />
                <span>Quay lại Bàn làm việc công việc</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <React.Suspense
        fallback={
          <div className="max-w-[1440px] w-full mx-auto p-6 space-y-4 animate-pulse">
            <div className="h-10 bg-muted/60 rounded-xl w-1/3" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-24 bg-muted/40 rounded-2xl" />
              <div className="h-24 bg-muted/40 rounded-2xl" />
              <div className="h-24 bg-muted/40 rounded-2xl" />
              <div className="h-24 bg-muted/40 rounded-2xl" />
            </div>
            <div className="h-64 bg-muted/30 rounded-2xl w-full" />
          </div>
        }
      >
        <DocumentRegistryView />
      </React.Suspense>
    </div>
  );
}
