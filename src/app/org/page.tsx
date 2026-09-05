"use client";

import * as React from "react";
import { OrganizationTree, QCET_DEPARTMENTS } from "@/components/org/organization-tree";
import {
  Building2,
  Users,
  Download,
  Printer,
  RefreshCw,
  CheckCircle2,
  Briefcase,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OrgPage() {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  const handlePrint = () => {
    window.print();
  };

  // Aggregated directory metrics
  const totalUnits = QCET_DEPARTMENTS.length;
  const totalStaff = QCET_DEPARTMENTS.reduce(
    (acc, dept) => acc + dept.members.length,
    0
  );
  const totalActiveTasks = QCET_DEPARTMENTS.reduce(
    (acc, dept) =>
      acc +
      dept.members.reduce((mAcc, m) => mAcc + (m.activeTaskCount || 0), 0),
    0
  );

  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-6 pb-24 md:pb-10"
      data-slot="twenty-org-page"
    >
      {/* ===================================================================== */}
      {/* 1. Page Header with QCET Badge, Bold Title, and Actions               */}
      {/* ===================================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
              <Network className="size-3" strokeWidth={1.5} />
              <span>CƠ CẤU BỘ MÁY & DANH BẠ QCET</span>
            </span>
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
              • Toàn trường
            </span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
            <span>Cơ cấu Tổ chức & Danh bạ Cán bộ</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sơ đồ bộ máy tổ chức, các đơn vị phòng ban, khoa chuyên môn và danh bạ liên hệ toàn trường QCET
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer disabled:opacity-60 shadow-2xs"
            title="Làm mới danh bạ"
          >
            <RefreshCw
              strokeWidth={1.5}
              className={`size-3.5 ${
                isRefreshing ? "animate-spin text-foreground" : ""
              }`}
            />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer shadow-2xs"
            title="In sơ đồ danh bạ"
          >
            <Printer className="size-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">In danh bạ</span>
          </button>

          <Button
            type="button"
            className="h-8.5 gap-1.5 px-3.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs transition-all cursor-pointer rounded-lg"
            onClick={() => {
              // Quick export as CSV
              const rows = [
                ["Họ tên", "Chức vụ", "Đơn vị", "Email", "Số điện thoại", "Phòng làm việc"],
                ...QCET_DEPARTMENTS.flatMap((d) =>
                  d.members.map((m) => [
                    m.name,
                    m.role,
                    m.departmentName,
                    m.email,
                    m.phone,
                    m.room || "",
                  ])
                ),
              ];
              const csvContent =
                "data:text/csv;charset=utf-8,﻿" +
                rows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", "danh-ba-can-bo-qcet.csv");
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            <Download className="size-3.5" strokeWidth={1.5} />
            <span>Xuất Excel/CSV</span>
          </Button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. Metric Cards Strip with Modern Styling                             */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Total Units */}
        <div className="flex items-center gap-3.5 rounded-xl border border-border/60 bg-card p-3.5 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Building2 className="size-4.5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground block truncate">
              Tổng số đơn vị
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold text-foreground font-mono tabular-nums">{totalUnits}</span>
              <span className="text-[10px] text-muted-foreground font-medium">phòng/khoa/TT</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Total Staff */}
        <div className="flex items-center gap-3.5 rounded-xl border border-border/60 bg-card p-3.5 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Users className="size-4.5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground block truncate">
              Cán bộ & Giảng viên
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold text-foreground font-mono tabular-nums">{totalStaff}</span>
              <span className="text-[10px] text-muted-foreground font-medium">nhân sự</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Active Delegated Tasks */}
        <div className="flex items-center gap-3.5 rounded-xl border border-border/60 bg-card p-3.5 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <Briefcase className="size-4.5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground block truncate">
              Nhiệm vụ đang điều phối
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold text-foreground font-mono tabular-nums">
                {totalActiveTasks}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">đầu việc</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Digital Identity Coverage */}
        <div className="flex items-center gap-3.5 rounded-xl border border-border/60 bg-card p-3.5 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="size-4.5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground block truncate">
              Định danh số E-Office
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold text-foreground font-mono tabular-nums">100%</span>
              <span className="text-[10px] text-emerald-600 font-semibold">
                Email công vụ
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. Main Organization Hierarchy Tree & Staff Directory Component        */}
      {/* ===================================================================== */}
      <OrganizationTree />
    </div>
  );
}
