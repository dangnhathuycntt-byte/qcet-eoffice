"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Network, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardData, useDashboardActions } from "@/components/dashboard/dashboard-context";

const OrganizationTree = dynamic(
  () => import("@/components/org/organization-tree").then((m) => m.OrganizationTree),
  { ssr: false, loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" /> }
);

function OrgZoneComponent() {
  const { isRefreshing } = useDashboardData();
  const { handleManualRefresh } = useDashboardActions();

  return (
    <div className="space-y-6" data-slot="zone-org">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Network className="size-3" strokeWidth={1.5} />
              <span>CƠ CẤU BỘ MÁY & DANH BẠ QCET</span>
            </span>
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
              • 11 Đơn vị • 95 Cán bộ
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-heading">
            Cơ Cấu Tổ Chức & Danh Bạ Cán Bộ
          </h1>
          <p className="text-xs text-muted-foreground mt-1 text-balance">
            Sơ đồ phân cấp bộ máy tổ chức và danh bạ liên hệ toàn trường QCET
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="gap-1.5 text-xs rounded-xl"
          >
            <RefreshCw
              size={14}
              className={isRefreshing ? "animate-spin text-primary" : ""}
            />
            <span className="hidden sm:inline">Làm mới danh bạ</span>
          </Button>
        </div>
      </div>

      <section aria-label="Sơ đồ cây tổ chức">
        <OrganizationTree />
      </section>
    </div>
  );
}

export const OrgZone = React.memo(OrgZoneComponent);
