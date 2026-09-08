"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Wrench,
  ArrowLeft,
  LayoutDashboard,
  FileText,
  Clock,
  ShieldAlert,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MaintenanceViewProps {
  feature?: string;
  title?: string;
  description?: string;
}

const FEATURE_TITLES: Record<string, string> = {
  "starred-docs": "Văn bản đánh dấu",
  "fyi-docs": "Văn bản xem để biết",
  "search-docs": "Tra cứu văn bản nâng cao",
  settings: "Cài đặt hệ thống",
  logout: "Đăng xuất tài khoản",
  "unit-calendar": "Quản lý lịch đơn vị",
  reports: "Báo cáo thống kê chuyên sâu",
};

export function MaintenanceView({
  feature: propFeature,
  title: propTitle,
  description: propDescription,
}: MaintenanceViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const feature = propFeature || searchParams.get("feature") || "general";
  const title =
    propTitle ||
    searchParams.get("title") ||
    FEATURE_TITLES[feature] ||
    "Tính năng hệ thống";

  const description =
    propDescription ||
    searchParams.get("desc") ||
    "Tính năng này đang trong lộ trình nâng cấp và đồng bộ theo tiến trình Chuyển đổi số của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET - Version 2.4.3). Hệ thống đang hoàn thiện kết nối dữ liệu để đưa vào vận hành chính thức.";

  return (
    <div
      className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-6"
      data-slot="maintenance-view"
    >
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          href="/"
          className="hover:text-foreground transition-colors flex items-center gap-1"
        >
          <LayoutDashboard className="size-3.5" />
          <span>Trang chủ</span>
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">
          Bảo trì & Nâng cấp
        </span>
        <span>/</span>
        <span className="text-primary font-medium truncate">{title}</span>
      </div>

      {/* Main Maintenance Banner Card */}
      <Card className="p-6 md:p-8 border-border/80 shadow-xs relative overflow-hidden bg-card/80 backdrop-blur-sm">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col md:flex-row items-start md:items-center gap-5 relative z-10">
          <div className="size-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
            <Wrench className="size-7" strokeWidth={1.75} />
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-xs font-medium"
              >
                <Clock className="size-3 mr-1 inline-block" />
                Đang bảo trì & nâng cấp
              </Badge>
              <Badge
                variant="outline"
                className="border-border text-muted-foreground text-xs font-mono"
              >
                Version 2.4.3
              </Badge>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Technical Info Grid */}
        <div className="mt-8 pt-6 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1 p-3 rounded-xl bg-muted/40 border border-border/40">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Mã phân hệ
            </div>
            <div className="text-xs font-mono font-bold text-foreground">
              QCET-CDS-{feature}
            </div>
          </div>

          <div className="space-y-1 p-3 rounded-xl bg-muted/40 border border-border/40">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Trạng thái
            </div>
            <div className="text-xs font-semibold text-amber-600 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              Đang hoàn thiện
            </div>
          </div>

          <div className="space-y-1 p-3 rounded-xl bg-muted/40 border border-border/40">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Phạm vi áp dụng
            </div>
            <div className="text-xs font-medium text-foreground">
              Toàn trường QCET
            </div>
          </div>

          <div className="space-y-1 p-3 rounded-xl bg-muted/40 border border-border/40">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Hỗ trợ kỹ thuật
            </div>
            <div className="text-xs font-medium text-foreground">
              Phòng CNTT & ĐBCL
            </div>
          </div>
        </div>
      </Card>

      {/* Action Buttons & Guidance */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-border/60 bg-muted/20">
        <div className="flex items-center gap-2 text-xs text-muted-foreground w-full sm:w-auto">
          <ShieldAlert className="size-4 text-primary shrink-0" />
          <span>Dữ liệu nghiệp vụ hiện hành không bị ảnh hưởng.</span>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="text-xs gap-1.5"
          >
            <ArrowLeft className="size-3.5" />
            <span>Quay lại</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            asChild
            className="text-xs gap-1.5"
          >
            <Link href="/">
              <LayoutDashboard className="size-3.5" />
              <span>Về Trang chủ</span>
            </Link>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            asChild
            className="text-xs gap-1.5"
          >
            <Link href="/documents">
              <FileText className="size-3.5" />
              <span>Sổ Văn bản</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
