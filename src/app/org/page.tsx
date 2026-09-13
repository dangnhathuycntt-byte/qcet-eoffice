"use client";

import * as React from "react";
import { Network } from "lucide-react";
import {
  OrganizationTree,
  QCET_DEPARTMENTS,
} from "@/components/org/organization-tree";

/**
 * Org / Directory surface contract (C7 / C15 / D12 / T56).
 *
 * Primary work     : find a person or unit and understand organizational relationships.
 * Primary context  : toàn trường.
 * Primary action   : search the directory. It is owned by <OrganizationTree/>, which
 *                    opens on the directory/tree view by default.
 * Secondary controls: print / export are owned by the single OrganizationTree toolbar.
 *                    This page renders no duplicate toolbar, no page-level search,
 *                    and no timeout-only "refresh" control.
 *
 * Data-source audit (T57):
 * There is no client-facing organizational-units API. The canonical server registry
 * (OrganizationalUnitService over Prisma OrganizationalUnit + UnitClosurePath) is
 * gated behind `org.manage` and is not exposed to the browser. The directory dataset
 * therefore lives in exactly one in-surface source — QCET_DEPARTMENTS — consumed here
 * and rendered by <OrganizationTree/>. The counts below are derived from that same
 * dataset; nothing on this page is fabricated.
 *
 * Removed by this migration:
 * - the hard-coded digital-identity coverage claim (T61 — unproven static metric);
 * - the presentation-only refresh control that pretended a server reload (T60/P1-07);
 * - the page-level duplicate print/export actions (single control point, rule 10-ui §5).
 */
export default function OrgPage() {
  const totals = React.useMemo(
    () => ({
      units: QCET_DEPARTMENTS.length,
      staff: QCET_DEPARTMENTS.reduce(
        (acc, dept) => acc + dept.members.length,
        0
      ),
    }),
    []
  );

  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-5 pb-24 md:pb-10"
      data-slot="twenty-org-page"
    >
      {/* Page header: identity + primary context. No metric cards, no duplicate actions. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <Network className="size-3" strokeWidth={1.5} />
            <span>CƠ CẤU BỘ MÁY & DANH BẠ QCET</span>
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            • Toàn trường
          </span>
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Cơ cấu Tổ chức & Danh bạ Cán bộ
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sơ đồ bộ máy tổ chức, các đơn vị phòng ban, khoa chuyên môn và danh bạ
            liên hệ toàn trường QCET
          </p>
          <p className="text-xs text-muted-foreground/80 mt-1 font-mono tabular-nums">
            Danh bạ toàn trường · {totals.units} đơn vị · {totals.staff} cán bộ,
            giảng viên
          </p>
        </div>
      </div>

      {/* Primary surface: directory/tree. Search-first, state-preserving. */}
      <OrganizationTree persistContext />
    </div>
  );
}
