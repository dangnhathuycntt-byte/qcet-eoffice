import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  FileText,
  Clock,
  ArrowLeft,
  CheckSquare,
  Sparkles,
  Inbox,
  FileCheck,
  ChevronRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Văn bản & Công văn - QCET E-Office",
  description:
    "Phân hệ Văn bản & Quản lý Công văn - Hệ thống E-Office Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
};

interface PlannedFeature {
  id: string;
  title: string;
  description: string;
  icon: typeof FileText;
  tag: string;
}

const PLANNED_FEATURES: PlannedFeature[] = [
  {
    id: "electronic-inbox",
    title: "Sổ công văn điện tử",
    description:
      "Tiếp nhận, số hóa và lưu trữ công văn đến/đi từ các cơ quan cấp trên.",
    icon: Inbox,
    tag: "Giai đoạn 1",
  },
  {
    id: "submission-signature",
    title: "Tờ trình & Bút phê số",
    description:
      "Trình duyệt tờ trình điện tử liên phòng khoa, hỗ trợ ký số lãnh đạo.",
    icon: FileCheck,
    tag: "Giai đoạn 2",
  },
  {
    id: "task-auto-delegation",
    title: "Tự động giao việc từ công văn",
    description:
      "Liên thông trực tiếp văn bản vào Kho nhiệm vụ của từng đơn vị.",
    icon: Sparkles,
    tag: "Giai đoạn 3",
  },
];

export default function DocumentsPage() {
  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-6 pb-16 md:pb-12"
      data-slot="documents-roadmap-page"
    >
      {/* 1. Header with Breadcrumb */}
      <div>
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2.5"
        >
          <Link
            href="/"
            className="transition-colors hover:text-foreground hover:underline underline-offset-4"
          >
            Trang chủ
          </Link>
          <ChevronRight className="size-3 text-muted-foreground/60" strokeWidth={1.5} />
          <span className="font-medium text-foreground">Văn bản &amp; Công văn</span>
        </nav>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Clock className="size-3" strokeWidth={1.5} />
                <span>Đang phát triển - Lộ trình Năm học 2025-2026</span>
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Phân hệ Văn bản &amp; Quản lý Công văn
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Quản lý luồng công văn đi/đến, hồ sơ tờ trình và lưu trữ số hóa văn thư trường QCET
            </p>
          </div>
        </div>
      </div>

      {/* 2. Central Feature Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xs p-6 sm:p-10 shadow-xs">
        {/* Subtle decorative background accents */}
        <div
          className="pointer-events-none absolute -top-12 -right-12 size-64 rounded-full bg-primary/5 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-12 -left-12 size-64 rounded-full bg-amber-500/5 blur-3xl"
          aria-hidden="true"
        />

        {/* Central Icon & Heading */}
        <div className="relative flex flex-col items-center text-center max-w-2xl mx-auto">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
            <FileText className="size-8" strokeWidth={1.5} />
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
            Tính năng đang trong lộ trình phát triển
          </h2>

          <p className="mt-2.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Hệ thống đang tập trung nguồn lực tối ưu hóa phân hệ Quản lý công việc &amp; Bàn làm việc số.
            Phân hệ Quản lý Công văn, Tờ trình và Ký số điện tử đang được hoàn thiện kỹ thuật và sẽ sớm ra mắt.
          </p>
        </div>

        {/* 3 Planned Features Preview Cards */}
        <div className="relative mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANNED_FEATURES.map((feature) => {
            const FeatureIcon = feature.icon;
            return (
              <div
                key={feature.id}
                className="flex flex-col justify-between rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/30 hover:border-border"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/15">
                      <FeatureIcon className="size-4.5" strokeWidth={1.5} />
                    </div>
                    <span className="text-[10px] font-medium font-mono px-2 py-0.5 rounded-md bg-background border border-border/60 text-muted-foreground">
                      {feature.tag}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1.5">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-medium text-[10px] text-primary">
                    <Clock className="size-3" strokeWidth={1.5} />
                    Năm học 2025-2026
                  </span>
                  <span className="text-[10px] text-muted-foreground/80">Kế hoạch triển khai</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="relative mt-8 pt-6 border-t border-border/50 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-xs sm:text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="size-4" strokeWidth={1.5} />
            <span>Quay về Bàn làm việc</span>
          </Link>
          <Link
            href="/tasks"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-secondary px-4 text-xs sm:text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-all active:scale-[0.98]"
          >
            <CheckSquare className="size-4" strokeWidth={1.5} />
            <span>Xem Kho 304 nhiệm vụ</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
